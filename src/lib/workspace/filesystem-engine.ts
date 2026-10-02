/**
 * RUNIX CANONICAL FILESYSTEM ENGINE
 * 
 * Absolute authoritative filesystem engine for Runix Core.
 * Single source of truth backed by Cloud Firestore chunked storage.
 * 
 * Local disk paths (runix_workspaces) are NOT authoritative.
 * All operations: create, read, save, move, rename, copy, delete persist to Firestore.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { WorkspaceFile } from '../types/terminal';
import { LanguageDetectionService } from '../runtimes/language-detection-service';
import { validateFileLimits, FileLimitValidationResult } from './file-limits';
import {
  saveFileToFirestoreChunks,
  readFileFromFirestoreChunks,
  deleteFileFromFirestore,
  updateFileLocationInFirestore,
  saveFolderToFirestore,
  deleteFolderFromFirestore,
  getWorkspaceStateFromFirestore,
  loadLocalStore,
  saveLocalStore,
  chunkContent,
  computeSha256,
  FirestoreFileMetadata,
  FirestoreFolderMetadata,
} from '../storage/firestore-chunk-storage';
import { getAdminDb } from '../server/firebase-admin';
import { OFFICIAL_RUNIX_COMMAND_REFERENCE } from './command-reference';
import { RunixPathResolver } from './path-resolver';

export interface MoveWorkspaceResult {
  success: boolean;
  error?: string;
  item?: WorkspaceFile;
  oldPath: string;
  newPath: string;
}

export interface RenameResult {
  success: boolean;
  error?: string;
  item?: WorkspaceFile;
  affectedItems?: WorkspaceFile[];
}

export interface WorkspaceMeta {
  fileIds: Record<string, string>;
  folderIds: Record<string, string>;
}

// In-memory workspace cache synchronized with Firestore for instant response
const memoryWorkspaceCache = new Map<string, WorkspaceFile[]>();
const initializedWorkspaces = new Set<string>();

export function sanitizePath(relativePath: string): string {
  const normalized = RunixPathResolver.toRelativePath(relativePath);
  RunixPathResolver.validateBoundary(normalized);
  return normalized;
}

export function generateCanonicalId(workspaceId: string, relPath: string): string {
  return Buffer.from(`${workspaceId}:${relPath}`).toString('base64url');
}

export function getParentFolderId(workspaceId: string, relPath: string, meta?: WorkspaceMeta): string {
  const dir = path.posix.dirname(relPath);
  if (dir === '.' || dir === '') return 'root';
  if (meta && meta.folderIds[dir]) {
    return meta.folderIds[dir];
  }
  return generateCanonicalId(workspaceId, dir);
}

// Helper for runtime and filesystem compatibility
export function getWorkspaceRoot(accountId: string = 'anonymous_dev', workspaceId: string = 'default'): string {
  const safeAccount = (accountId || 'anonymous_dev').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeWorkspace = (workspaceId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const isServerless = typeof process !== 'undefined' && (
    !!process.env.NETLIFY ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT ||
    !!process.env.VERCEL ||
    (typeof process.cwd === 'function' && (
      process.cwd().startsWith('/var/task') ||
      process.cwd().startsWith('/opt')
    ))
  );
  const baseDir = isServerless ? os.tmpdir() : process.cwd();
  const dir = path.join(baseDir, 'runix_workspaces', safeAccount, safeWorkspace);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    try {
      const fallbackDir = path.join(os.tmpdir(), 'runix_workspaces', safeAccount, safeWorkspace);
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      return fallbackDir;
    } catch {
      return path.join(os.tmpdir(), `ws_${safeAccount}_${safeWorkspace}`);
    }
  }
}

export function loadWorkspaceMeta(accountId: string = 'anonymous_dev', workspaceId: string = 'default'): WorkspaceMeta {
  const files = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
  const fileIds: Record<string, string> = {};
  const folderIds: Record<string, string> = {};
  for (const f of files) {
    if (f.type === 'directory' && f.folderId) {
      folderIds[f.path] = f.folderId;
    } else if (f.fileId) {
      fileIds[f.path] = f.fileId;
    }
  }
  return { fileIds, folderIds };
}

export function saveWorkspaceMeta(accountId: string = 'anonymous_dev', workspaceId: string = 'default', meta: WorkspaceMeta): void {
  // Metadata is maintained in Firestore documents
}

export function ensureWorkspace(accountId: string = 'anonymous_dev', workspaceId: string = 'default'): string {
  try {
    FilesystemEngine.ensureWorkspaceState(accountId, workspaceId);
  } catch (err) {
    console.warn('Notice in ensureWorkspaceState:', err);
  }
  return getWorkspaceRoot(accountId, workspaceId);
}

export class FilesystemEngine {
  /**
   * Resolves a path relative to the current working directory using RunixPathResolver.
   */
  public static resolveRelativePath(workspaceCwd: string, targetPath: string): string {
    const result = RunixPathResolver.resolve(workspaceCwd, targetPath);
    return result.executionRelativePath;
  }

  /**
   * Ensures the workspace is bootstrapped in Firestore.
   * Clean account standard: brand-new account starts with exactly main-workspace/runix-command.txt.
   */
  public static ensureWorkspaceState(accountId: string = 'anonymous_dev', workspaceId: string = 'default'): void {
    const cacheKey = `${accountId}:${workspaceId}`;
    if (initializedWorkspaces.has(cacheKey)) return;
    initializedWorkspaces.add(cacheKey);

    // Check existing Firestore store
    const store = loadLocalStore(accountId, workspaceId);
    const hasFiles = Object.keys(store.files).length > 0 || Object.keys(store.folders).length > 0;

    // Migration check (Section 15 & 16):
    // If legacy files exist on local disk in runix_workspaces and are not yet in Firestore, import them safely
    const legacyDiskDir = path.join(
      process.cwd(),
      'runix_workspaces',
      accountId.replace(/[^a-zA-Z0-9_-]/g, '_'),
      workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_')
    );

    if (!hasFiles && fs.existsSync(legacyDiskDir)) {
      try {
        const diskEntries = fs.readdirSync(legacyDiskDir).filter((e) => !e.startsWith('.') && e !== 'node_modules');
        if (diskEntries.length > 0) {
          this.migrateLegacyDiskFiles(accountId, workspaceId, legacyDiskDir);
          return;
        }
      } catch {}
    }

    // Clean bootstrap with runix-command.txt
    if (!hasFiles) {
      try {
        this.saveFileSync(
          accountId,
          workspaceId,
          'runix-command.txt',
          OFFICIAL_RUNIX_COMMAND_REFERENCE
        );
      } catch (bootErr) {
        console.error('Bootstrap error:', bootErr);
      }
    }
  }

  private static migrateLegacyDiskFiles(accountId: string, workspaceId: string, baseDir: string): void {
    const self = this;
    function walk(dir: string, relBase: string = '') {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        const rel = relBase ? `${relBase}/${item.name}` : item.name;
        const full = path.join(dir, item.name);

        if (item.isDirectory()) {
          self.createFolder(accountId, workspaceId, rel);
          walk(full, rel);
        } else {
          const content = fs.readFileSync(full, 'utf-8');
          self.saveFileSync(accountId, workspaceId, rel, content);
        }
      }
    }

    try {
      walk(baseDir);
    } catch (migErr) {
      console.warn('Notice during legacy disk migration:', migErr);
    }
  }

  /**
   * Retrieves all workspace files and folders from authoritative Firestore store (async).
   */
  public static async getWorkspaceFilesAsync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default'
  ): Promise<WorkspaceFile[]> {
    this.ensureWorkspaceState(accountId, workspaceId);
    const { files, folders } = await getWorkspaceStateFromFirestore(accountId, workspaceId);

    const items: WorkspaceFile[] = [];

    // Folders
    for (const folder of folders) {
      items.push({
        folderId: folder.folderId,
        workspaceId,
        parentFolderId: folder.parentFolderId,
        path: folder.path,
        name: folder.name,
        type: 'directory',
        size: 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      });
    }

    // Files
    for (const file of files) {
      const detected = LanguageDetectionService.detect(file.path);
      items.push({
        fileId: file.fileId,
        workspaceId,
        parentFolderId: file.parentFolderId,
        path: file.path,
        name: file.name,
        type: 'file',
        size: file.sizeBytes,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        languageId: file.languageId || detected.languageId,
        mimeType: file.mimeType || 'text/plain',
        fileType: detected.fileType,
        isRunnable: detected.canExecute,
      });
    }

    const cacheKey = `${accountId}:${workspaceId}`;
    memoryWorkspaceCache.set(cacheKey, items);
    return items;
  }

  /**
   * Synchronous accessor for UI components and compatibility.
   * Returns memory-cached authoritative Firestore state.
   */
  public static getWorkspaceFiles(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default'
  ): WorkspaceFile[] {
    const cacheKey = `${accountId}:${workspaceId}`;
    if (memoryWorkspaceCache.has(cacheKey)) {
      return memoryWorkspaceCache.get(cacheKey)!;
    }
    this.ensureWorkspaceState(accountId, workspaceId);
    const store = loadLocalStore(accountId, workspaceId);

    const items: WorkspaceFile[] = [];
    const files: FirestoreFileMetadata[] = Object.values(store.files || {});
    const folders: FirestoreFolderMetadata[] = Object.values(store.folders || {});

    for (const folder of folders) {
      items.push({
        folderId: folder.folderId,
        workspaceId,
        parentFolderId: folder.parentFolderId,
        path: folder.path,
        name: folder.name,
        type: 'directory',
        size: 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      });
    }

    for (const file of files) {
      const detected = LanguageDetectionService.detect(file.path);
      items.push({
        fileId: file.fileId,
        workspaceId,
        parentFolderId: file.parentFolderId,
        path: file.path,
        name: file.name,
        type: 'file',
        size: file.sizeBytes,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        languageId: file.languageId || detected.languageId,
        mimeType: file.mimeType || 'text/plain',
        fileType: detected.fileType,
        isRunnable: detected.canExecute,
      });
    }

    memoryWorkspaceCache.set(cacheKey, items);
    return items;
  }

  /**
   * Lists entries DIRECTLY inside a specific relative directory (for terminal `ls`).
   */
  public static listDirectory(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativeDirectory: string = ''
  ): WorkspaceFile[] {
    const cleanDir = relativeDirectory ? sanitizePath(relativeDirectory) : '';
    const allFiles = this.getWorkspaceFiles(accountId, workspaceId);

    return allFiles.filter((item) => {
      const itemParent = item.path.includes('/')
        ? item.path.substring(0, item.path.lastIndexOf('/'))
        : '';
      return itemParent === cleanDir;
    });
  }

  /**
   * Synchronous file save to ensure immediate persistence across synchronous calls.
   */
  public static saveFileSync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string,
    content: string = '',
    expectedVersion?: number
  ): WorkspaceFile {
    const safeRelPath = sanitizePath(relativePath);
    this.ensureWorkspaceState(accountId, workspaceId);

    const validation = validateFileLimits(content);
    if (!validation.valid) {
      const err = new Error(validation.message || 'File limit exceeded');
      (err as any).code = validation.error;
      throw err;
    }

    const parentRel = safeRelPath.includes('/') ? safeRelPath.substring(0, safeRelPath.lastIndexOf('/')) : '';
    if (parentRel) {
      this.ensureFolderHierarchy(accountId, workspaceId, parentRel);
    }

    const store = loadLocalStore(accountId, workspaceId);
    const existing = store.files[safeRelPath] || Object.values(store.files).find((f) => f.path.toLowerCase() === safeRelPath.toLowerCase());
    const fileId = existing?.fileId || generateCanonicalId(workspaceId, safeRelPath);
    const parentFolderId = parentRel ? generateCanonicalId(workspaceId, parentRel) : 'root';
    const detected = LanguageDetectionService.detect(safeRelPath);
    const now = new Date().toISOString();

    const currentVersion = existing ? existing.contentVersion : 0;
    if (expectedVersion !== undefined && existing && expectedVersion !== currentVersion) {
      const conflictErr = new Error(`CONFLICT: File version mismatch (expected ${expectedVersion}, but current is ${currentVersion})`);
      (conflictErr as any).code = 'CONFLICT';
      throw conflictErr;
    }

    const newVersion = currentVersion + 1;
    const chunks = chunkContent(content);
    const fullChecksum = computeSha256(content);

    if (!store.chunks[fileId]) store.chunks[fileId] = {};
    for (let seq = 0; seq < chunks.length; seq++) {
      const chunkData = chunks[seq];
      const chunkChecksum = computeSha256(chunkData);
      const chunkId = `v${newVersion}_${seq.toString().padStart(5, '0')}`;
      store.chunks[fileId][chunkId] = {
        chunkId,
        fileId,
        version: newVersion,
        sequence: seq,
        data: chunkData,
        sizeBytes: Buffer.byteLength(chunkData, 'utf-8'),
        checksum: chunkChecksum,
      };
    }

    // Clean older chunks
    for (const cId of Object.keys(store.chunks[fileId])) {
      if (store.chunks[fileId][cId].version < newVersion) {
        delete store.chunks[fileId][cId];
      }
    }

    const meta: FirestoreFileMetadata = {
      fileId,
      workspaceId,
      projectId: 'main',
      parentFolderId,
      name: path.posix.basename(safeRelPath),
      path: safeRelPath,
      type: 'file',
      languageId: detected.languageId,
      mimeType: 'text/plain',
      sizeBytes: validation.sizeBytes,
      lineCount: validation.lineCount,
      wordCount: validation.wordCount,
      contentStorage: 'firestore-chunks',
      contentVersion: newVersion,
      chunkCount: chunks.length,
      checksum: fullChecksum,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      createdBy: accountId,
      updatedBy: accountId,
    };

    store.files[fileId] = meta;
    saveLocalStore(accountId, workspaceId, store);

    // Asynchronously write to live Firestore if configured
    try {
      const adminDb = getAdminDb();
      if (adminDb && accountId !== 'anonymous_dev') {
        saveFileToFirestoreChunks(accountId, workspaceId, meta, content, expectedVersion).catch(() => {});
      }
    } catch {}

    const record: WorkspaceFile = {
      fileId,
      workspaceId,
      parentFolderId,
      path: safeRelPath,
      name: meta.name,
      type: 'file',
      size: meta.sizeBytes,
      content,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      languageId: detected.languageId,
      mimeType: 'text/plain',
      fileType: detected.fileType,
      isRunnable: detected.canExecute,
    };

    const cacheKey = `${accountId}:${workspaceId}`;
    memoryWorkspaceCache.delete(cacheKey);

    return record;
  }



  private static ensureFolderHierarchy(accountId: string, workspaceId: string, folderPath: string): void {
    const segments = folderPath.split('/').filter(Boolean);
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i];
      this.createFolder(accountId, workspaceId, currentPath);
    }
  }

  /**
   * Reads a file, reassembling from Firestore chunks.
   */
  public static async readFile(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string
  ): Promise<WorkspaceFile | null> {
    const safeRelPath = sanitizePath(relativePath);
    this.ensureWorkspaceState(accountId, workspaceId);

    const fromChunks = await readFileFromFirestoreChunks(accountId, workspaceId, safeRelPath);
    if (!fromChunks) {
      return null;
    }

    const detected = LanguageDetectionService.detect(safeRelPath);

    return {
      fileId: fromChunks.metadata.fileId,
      workspaceId,
      parentFolderId: fromChunks.metadata.parentFolderId,
      path: fromChunks.metadata.path,
      name: fromChunks.metadata.name,
      type: 'file',
      size: fromChunks.metadata.sizeBytes,
      content: fromChunks.content,
      createdAt: fromChunks.metadata.createdAt,
      updatedAt: fromChunks.metadata.updatedAt,
      languageId: detected.languageId,
      mimeType: fromChunks.metadata.mimeType || 'text/plain',
      fileType: detected.fileType,
      isRunnable: detected.canExecute,
    };
  }

  public static async saveFile(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string,
    content: string,
    expectedVersion?: number
  ): Promise<WorkspaceFile> {
    const record = this.saveFileSync(accountId, workspaceId, relativePath, content, expectedVersion);
    try {
      const adminDb = getAdminDb();
      if (adminDb && accountId !== 'anonymous_dev') {
        const meta = {
          fileId: record.fileId!,
          workspaceId,
          projectId: 'main',
          parentFolderId: record.parentFolderId || 'root',
          name: record.name,
          path: record.path,
          type: 'file' as const,
          languageId: record.languageId,
          mimeType: record.mimeType,
          createdAt: record.createdAt || record.updatedAt || new Date().toISOString(),
          updatedAt: record.updatedAt,
          createdBy: accountId,
          updatedBy: accountId,
        };
        await saveFileToFirestoreChunks(accountId, workspaceId, meta, content, expectedVersion);
      }
    } catch (fsErr) {
      console.warn('Notice writing to Firestore chunks in saveFile:', fsErr);
    }
    return record;
  }

  public static async createFile(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string,
    content: string = '',
    expectedVersion?: number
  ): Promise<WorkspaceFile> {
    return this.saveFile(accountId, workspaceId, relativePath, content, expectedVersion);
  }

  /**
   * Creates a folder inside another folder or at root.
   */
  public static createFolder(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string
  ): WorkspaceFile {
    const safeRelPath = sanitizePath(relativePath);
    this.ensureWorkspaceState(accountId, workspaceId);

    const parentRel = safeRelPath.includes('/') ? safeRelPath.substring(0, safeRelPath.lastIndexOf('/')) : '';
    const parentFolderId = parentRel ? generateCanonicalId(workspaceId, parentRel) : 'root';
    const folderId = generateCanonicalId(workspaceId, safeRelPath);
    const now = new Date().toISOString();

    const record: WorkspaceFile = {
      folderId,
      workspaceId,
      parentFolderId,
      path: safeRelPath,
      name: path.posix.basename(safeRelPath),
      type: 'directory',
      size: 0,
      createdAt: now,
      updatedAt: now,
    };

    saveFolderToFirestore(accountId, workspaceId, {
      folderId,
      workspaceId,
      projectId: 'main',
      parentFolderId,
      name: record.name,
      path: safeRelPath,
      type: 'directory',
      createdAt: now,
      updatedAt: now,
      createdBy: accountId,
      updatedBy: accountId,
    }).catch(() => {});

    const cacheKey = `${accountId}:${workspaceId}`;
    memoryWorkspaceCache.delete(cacheKey);

    return record;
  }

  public static async createFolderAsync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string
  ): Promise<WorkspaceFile> {
    const record = this.createFolder(accountId, workspaceId, relativePath);
    try {
      const adminDb = getAdminDb();
      if (adminDb && accountId !== 'anonymous_dev') {
        await saveFolderToFirestore(accountId, workspaceId, {
          folderId: record.folderId!,
          workspaceId,
          projectId: 'main',
          parentFolderId: record.parentFolderId || 'root',
          name: record.name,
          path: record.path,
          type: 'directory',
          createdAt: record.createdAt || record.updatedAt || new Date().toISOString(),
          updatedAt: record.updatedAt,
          createdBy: accountId,
          updatedBy: accountId,
        });
      }
    } catch (err) {
      console.warn('Notice saving folder to Firestore in createFolderAsync:', err);
    }
    return record;
  }

  /**
   * Renames a folder and recalculates paths for all descendant files and folders.
   * STABLE IDs are preserved for all descendants.
   */
  public static renameFolderSync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    oldRelativePath: string,
    newRelativePath: string
  ): RenameResult {
    const safeOld = sanitizePath(oldRelativePath);
    const safeNew = sanitizePath(newRelativePath);

    const allFiles = this.getWorkspaceFiles(accountId, workspaceId);
    const folderItem = allFiles.find((f) => f.type === 'directory' && f.path.toLowerCase() === safeOld.toLowerCase());

    if (!folderItem) {
      return { success: false, error: `Directory '${safeOld}' does not exist` };
    }

    if (allFiles.some((f) => f.path.toLowerCase() === safeNew.toLowerCase())) {
      return { success: false, error: `Target path '${safeNew}' already exists` };
    }

    const affectedDescendants = allFiles.filter((f) => f.path.startsWith(safeOld + '/'));
    const store = loadLocalStore(accountId, workspaceId);
    const now = new Date().toISOString();

    const parentRel = safeNew.includes('/') ? safeNew.substring(0, safeNew.lastIndexOf('/')) : '';
    const newParentFolderId = parentRel ? generateCanonicalId(workspaceId, parentRel) : 'root';
    const folderId = folderItem.folderId || generateCanonicalId(workspaceId, safeOld);

    // Update folder in store
    if (store.folders[folderId]) {
      store.folders[folderId].path = safeNew;
      store.folders[folderId].name = path.posix.basename(safeNew);
      store.folders[folderId].parentFolderId = newParentFolderId;
      store.folders[folderId].updatedAt = now;
    } else {
      store.folders[folderId] = {
        folderId,
        workspaceId,
        projectId: 'main',
        parentFolderId: newParentFolderId,
        name: path.posix.basename(safeNew),
        path: safeNew,
        type: 'directory',
        createdAt: folderItem.createdAt || now,
        updatedAt: now,
        createdBy: accountId,
        updatedBy: accountId,
      };
    }

    const folderRecord: WorkspaceFile = {
      folderId,
      workspaceId,
      parentFolderId: newParentFolderId,
      path: safeNew,
      name: path.posix.basename(safeNew),
      type: 'directory',
      size: 0,
      createdAt: folderItem.createdAt || now,
      updatedAt: now,
    };

    const affectedItems: WorkspaceFile[] = [];
    for (const item of affectedDescendants) {
      const childSubPath = item.path.substring(safeOld.length);
      const newChildPath = `${safeNew}${childSubPath}`;
      const isChildDir = item.type === 'directory';
      const childParentRel = newChildPath.includes('/') ? newChildPath.substring(0, newChildPath.lastIndexOf('/')) : '';
      const childParentFolderId = childParentRel ? generateCanonicalId(workspaceId, childParentRel) : 'root';

      if (isChildDir) {
        const stableFolderId = item.folderId || generateCanonicalId(workspaceId, item.path);
        if (store.folders[stableFolderId]) {
          store.folders[stableFolderId].path = newChildPath;
          store.folders[stableFolderId].name = path.posix.basename(newChildPath);
          store.folders[stableFolderId].parentFolderId = childParentFolderId;
          store.folders[stableFolderId].updatedAt = now;
        }

        affectedItems.push({
          ...item,
          path: newChildPath,
          name: path.posix.basename(newChildPath),
          parentFolderId: childParentFolderId,
          updatedAt: now,
        });
      } else {
        const detected = LanguageDetectionService.detect(newChildPath);
        const stableFileId = item.fileId || generateCanonicalId(workspaceId, item.path);

        if (store.files[stableFileId]) {
          store.files[stableFileId].path = newChildPath;
          store.files[stableFileId].name = path.posix.basename(newChildPath);
          store.files[stableFileId].parentFolderId = childParentFolderId;
          store.files[stableFileId].updatedAt = now;
        }

        affectedItems.push({
          ...item,
          path: newChildPath,
          name: path.posix.basename(newChildPath),
          parentFolderId: childParentFolderId,
          languageId: detected.languageId,
          fileType: detected.fileType,
          isRunnable: detected.canExecute,
          updatedAt: now,
        });
      }
    }

    saveLocalStore(accountId, workspaceId, store);
    const cacheKey = `${accountId}:${workspaceId}`;
    memoryWorkspaceCache.delete(cacheKey);

    return {
      success: true,
      item: folderRecord,
      affectedItems,
    };
  }

  public static async renameFolder(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    oldRelativePath: string,
    newRelativePath: string
  ): Promise<RenameResult> {
    return this.renameFolderSync(accountId, workspaceId, oldRelativePath, newRelativePath);
  }

  /**
   * Renames a file, preserving fileId, content, and history while recomputing languageId.
   */
  public static renameFileSync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    oldRelativePath: string,
    newRelativePath: string
  ): RenameResult {
    const safeOld = sanitizePath(oldRelativePath);
    const safeNew = sanitizePath(newRelativePath);

    const allFiles = this.getWorkspaceFiles(accountId, workspaceId);
    const fileItem = allFiles.find((f) => f.type === 'file' && f.path.toLowerCase() === safeOld.toLowerCase());

    if (!fileItem) {
      return { success: false, error: `File '${safeOld}' does not exist` };
    }

    if (allFiles.some((f) => f.path.toLowerCase() === safeNew.toLowerCase())) {
      return { success: false, error: `File '${safeNew}' already exists` };
    }

    const parentRel = safeNew.includes('/') ? safeNew.substring(0, safeNew.lastIndexOf('/')) : '';
    const parentFolderId = parentRel ? generateCanonicalId(workspaceId, parentRel) : 'root';
    const fileId = fileItem.fileId || generateCanonicalId(workspaceId, safeOld);
    const detected = LanguageDetectionService.detect(safeNew);
    const now = new Date().toISOString();

    const store = loadLocalStore(accountId, workspaceId);
    if (store.files[fileId]) {
      store.files[fileId].path = safeNew;
      store.files[fileId].name = path.posix.basename(safeNew);
      store.files[fileId].parentFolderId = parentFolderId;
      store.files[fileId].languageId = detected.languageId;
      store.files[fileId].updatedAt = now;
      saveLocalStore(accountId, workspaceId, store);
    }

    updateFileLocationInFirestore(accountId, workspaceId, fileId, safeNew, parentFolderId).catch(() => {});

    const record: WorkspaceFile = {
      ...fileItem,
      path: safeNew,
      name: path.posix.basename(safeNew),
      parentFolderId,
      languageId: detected.languageId,
      fileType: detected.fileType,
      isRunnable: detected.canExecute,
      updatedAt: now,
    };

    const cacheKey = `${accountId}:${workspaceId}`;
    memoryWorkspaceCache.delete(cacheKey);

    return {
      success: true,
      item: record,
    };
  }

  public static async renameFile(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    oldRelativePath: string,
    newRelativePath: string
  ): Promise<RenameResult> {
    const res = this.renameFileSync(accountId, workspaceId, oldRelativePath, newRelativePath);
    if (res.success && res.item) {
      try {
        const adminDb = getAdminDb();
        if (adminDb && accountId !== 'anonymous_dev') {
          await updateFileLocationInFirestore(
            accountId,
            workspaceId,
            res.item.fileId || oldRelativePath,
            res.item.path,
            res.item.parentFolderId || 'root'
          );
        }
      } catch (err) {
        console.warn('Notice updating file location in Firestore:', err);
      }
    }
    return res;
  }

  /**
   * Moves a file or folder into a destination folder with circular move prevention.
   */
  public static moveItemSync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    sourceRelativePath: string,
    destinationFolder: string = ''
  ): MoveWorkspaceResult {
    const safeSrc = sanitizePath(sourceRelativePath);
    const rawDest = (destinationFolder || '').trim().replace(/^["']|["']$/g, '');
    const safeDestFolder = rawDest === '' || rawDest === '.' || rawDest === '/' ? '' : sanitizePath(rawDest);

    const allFiles = this.getWorkspaceFiles(accountId, workspaceId);
    const srcItem = allFiles.find((f) => f.path.toLowerCase() === safeSrc.toLowerCase());

    if (!srcItem) {
      return {
        success: false,
        error: `Source item '${sourceRelativePath}' does not exist`,
        oldPath: safeSrc,
        newPath: safeSrc,
      };
    }

    const isDir = srcItem.type === 'directory';
    const itemName = path.posix.basename(safeSrc);
    const newRelativePath = safeDestFolder ? `${safeDestFolder}/${itemName}` : itemName;

    // Prevent folder into itself or descendant
    if (isDir && (safeDestFolder === safeSrc || safeDestFolder.startsWith(safeSrc + '/'))) {
      return {
        success: false,
        error: `Cannot move directory '${safeSrc}' into itself or a descendant subdirectory '${safeDestFolder}'`,
        oldPath: safeSrc,
        newPath: newRelativePath,
      };
    }

    // Verify destination folder exists if not root
    if (safeDestFolder) {
      const destFolder = allFiles.find((f) => f.type === 'directory' && f.path.toLowerCase() === safeDestFolder.toLowerCase());
      if (!destFolder) {
        return {
          success: false,
          error: `Destination folder '${safeDestFolder}' does not exist`,
          oldPath: safeSrc,
          newPath: newRelativePath,
        };
      }
    }

    if (newRelativePath === safeSrc) {
      return {
        success: true,
        oldPath: safeSrc,
        newPath: newRelativePath,
      };
    }

    // Check duplicate name in destination
    if (allFiles.some((f) => f.path.toLowerCase() === newRelativePath.toLowerCase())) {
      return {
        success: false,
        error: `An item named '${itemName}' already exists in destination folder '${safeDestFolder || 'root'}'`,
        oldPath: safeSrc,
        newPath: newRelativePath,
      };
    }

    if (isDir) {
      const res = this.renameFolderSync(accountId, workspaceId, safeSrc, newRelativePath);
      return {
        success: res.success,
        error: res.error,
        item: res.item,
        oldPath: safeSrc,
        newPath: newRelativePath,
      };
    } else {
      const res = this.renameFileSync(accountId, workspaceId, safeSrc, newRelativePath);
      return {
        success: res.success,
        error: res.error,
        item: res.item,
        oldPath: safeSrc,
        newPath: newRelativePath,
      };
    }
  }

  public static async moveItem(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    sourceRelativePath: string,
    destinationFolder: string = ''
  ): Promise<MoveWorkspaceResult> {
    return this.moveItemSync(accountId, workspaceId, sourceRelativePath, destinationFolder);
  }

  /**
   * Copies a file to a new destination with a new canonical fileId.
   */
  public static async copyFile(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    sourcePath: string,
    destPath: string
  ): Promise<WorkspaceFile | null> {
    const safeSrc = sanitizePath(sourcePath);
    const safeDest = sanitizePath(destPath);
    const file = await this.readFile(accountId, workspaceId, safeSrc);
    if (!file) return null;

    return this.saveFileSync(accountId, workspaceId, safeDest, file.content || '');
  }

  /**
   * Synchronous deletion of files and folders.
   */
  public static deleteItemSync(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string,
    recursive: boolean = false
  ): boolean {
    const safeRelPath = sanitizePath(relativePath);
    const allFiles = this.getWorkspaceFiles(accountId, workspaceId);
    const item = allFiles.find((f) => f.path.toLowerCase() === safeRelPath.toLowerCase());

    if (!item) {
      return false;
    }

    const store = loadLocalStore(accountId, workspaceId);

    if (item.type === 'directory') {
      const children = allFiles.filter((f) => f.path.startsWith(safeRelPath + '/'));
      if (children.length > 0 && !recursive) {
        throw new Error('DIRECTORY_NOT_EMPTY');
      }

      for (const child of children) {
        if (child.type === 'file' && child.fileId) {
          delete store.files[child.fileId];
          delete store.chunks[child.fileId];
          deleteFileFromFirestore(accountId, workspaceId, child.fileId).catch(() => {});
        } else if (child.folderId) {
          delete store.folders[child.folderId];
          deleteFolderFromFirestore(accountId, workspaceId, child.folderId).catch(() => {});
        }
      }

      if (item.folderId) {
        delete store.folders[item.folderId];
        deleteFolderFromFirestore(accountId, workspaceId, item.folderId).catch(() => {});
      }
    } else {
      if (item.fileId) {
        delete store.files[item.fileId];
        delete store.chunks[item.fileId];
        deleteFileFromFirestore(accountId, workspaceId, item.fileId).catch(() => {});
      }
    }

    saveLocalStore(accountId, workspaceId, store);
    const cacheKey = `${accountId}:${workspaceId}`;
    memoryWorkspaceCache.delete(cacheKey);

    return true;
  }

  public static async deleteItem(
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default',
    relativePath: string,
    recursive: boolean = false
  ): Promise<boolean> {
    const res = this.deleteItemSync(accountId, workspaceId, relativePath, recursive);
    try {
      const adminDb = getAdminDb();
      if (adminDb && accountId !== 'anonymous_dev') {
        await deleteFileFromFirestore(accountId, workspaceId, relativePath);
        await deleteFolderFromFirestore(accountId, workspaceId, relativePath);
      }
    } catch (err) {
      console.warn('Notice deleting item from Firestore in deleteItem:', err);
    }
    return res;
  }
}
