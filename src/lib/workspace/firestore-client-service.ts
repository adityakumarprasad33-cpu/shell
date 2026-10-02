/**
 * RUNIX CLIENT-SIDE FIRESTORE STORAGE ENGINE
 * 
 * Authoritative Firestore backend engine for the Runix Web Console.
 * Directly integrates with client Firebase SDK and enforces exact architecture:
 * 
 * terminalAccounts/{accountId}
 *         │
 *         └── workspaces/{workspaceId}
 *                 │
 *                 ├── folders/{folderId}
 *                 │
 *                 └── files/{fileId}
 *                         │
 *                         └── chunks/{chunkId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { WorkspaceFile } from '../types/terminal';
import { LanguageDetectionService } from '../runtimes/language-detection-service';
import { validateFileLimits, FileLimitValidationResult } from './file-limits';
import { RunixPathResolver } from './path-resolver';
import { OFFICIAL_RUNIX_COMMAND_REFERENCE } from './command-reference';

export const CHUNK_SIZE_BYTES = 64 * 1024; // 64 KiB safe chunk size

export interface ClientFileMetadata {
  fileId: string;
  workspaceId: string;
  projectId: string;
  parentFolderId: string;
  name: string;
  path: string;
  type: 'file';
  languageId?: string;
  mimeType?: string;
  sizeBytes: number;
  lineCount: number;
  wordCount: number;
  contentStorage: 'firestore-chunks';
  contentVersion: number;
  chunkCount: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ClientFolderMetadata {
  folderId: string;
  workspaceId: string;
  projectId: string;
  parentFolderId: string;
  name: string;
  path: string;
  type: 'directory';
  createdAt: string;
  updatedAt: string;
}

export interface ClientFileChunk {
  chunkId: string;
  fileId: string;
  version: number;
  sequence: number;
  data: string;
  sizeBytes: number;
  checksum: string;
}

/**
 * Universal SHA-256 calculation for browser and Node.
 */
export async function computeSha256(content: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  } catch {
    return 'sha256_fallback';
  }
}

/**
 * Splits content into chunks of <= chunkSize (default 64 KiB).
 */
export function chunkContent(content: string, chunkSize: number = CHUNK_SIZE_BYTES): string[] {
  if (!content) return [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < content.length) {
    const end = Math.min(offset + chunkSize, content.length);
    chunks.push(content.slice(offset, end));
    offset = end;
  }
  return chunks;
}

/**
 * Generates deterministic, stable canonical ID from workspaceId and relative path.
 */
export function generateCanonicalId(workspaceId: string, relPath: string): string {
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
  const raw = `${workspaceId}:${norm}`;
  if (typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(raw))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

export class FirestoreClientService {
  /**
   * Retrieves all files and folders for a workspace directly from Firestore.
   * If workspace is completely empty, bootstraps with runix-command.txt.
   */
  public static async listWorkspaceItems(
    accountId: string,
    workspaceId: string = 'default'
  ): Promise<WorkspaceFile[]> {
    const db = getFirebaseDb();
    const wsRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId);
    const foldersCol = collection(wsRef, 'folders');
    const filesCol = collection(wsRef, 'files');

    const [foldersSnap, filesSnap] = await Promise.all([
      getDocs(foldersCol),
      getDocs(filesCol),
    ]);

    const items: WorkspaceFile[] = [];

    // Parse folders
    foldersSnap.forEach((d) => {
      const data = d.data() as ClientFolderMetadata;
      items.push({
        folderId: data.folderId || d.id,
        workspaceId,
        parentFolderId: data.parentFolderId || 'root',
        path: data.path,
        name: data.name,
        type: 'directory',
        size: 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // Parse files
    filesSnap.forEach((d) => {
      const data = d.data() as ClientFileMetadata;
      const detected = LanguageDetectionService.detect(data.path);
      items.push({
        fileId: data.fileId || d.id,
        workspaceId,
        parentFolderId: data.parentFolderId || 'root',
        path: data.path,
        name: data.name,
        type: 'file',
        size: data.sizeBytes || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        languageId: data.languageId || detected.languageId,
        mimeType: data.mimeType || 'text/plain',
        fileType: detected.fileType,
        isRunnable: detected.canExecute,
      });
    });

    // Clean bootstrap if account has zero files and zero folders
    if (items.length === 0) {
      try {
        const bootstrapFile = await this.saveFile(
          accountId,
          workspaceId,
          'runix-command.txt',
          OFFICIAL_RUNIX_COMMAND_REFERENCE
        );
        items.push(bootstrapFile);
      } catch (err) {
        console.warn('Notice during clean Firestore bootstrap:', err);
      }
    }

    return items;
  }

  /**
   * Ensures intermediate folder documents exist in Firestore.
   */
  private static async ensureFolderHierarchy(
    accountId: string,
    workspaceId: string,
    folderPath: string
  ): Promise<string> {
    const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!clean) return 'root';

    const segments = clean.split('/').filter(Boolean);
    let currentPath = '';
    let parentFolderId = 'root';

    for (let i = 0; i < segments.length; i++) {
      currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i];
      const folderId = generateCanonicalId(workspaceId, currentPath);

      const db = getFirebaseDb();
      const folderRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders', folderId);
      const snap = await getDoc(folderRef);

      if (!snap.exists()) {
        const now = new Date().toISOString();
        const folderMeta: ClientFolderMetadata = {
          folderId,
          workspaceId,
          projectId: 'main',
          parentFolderId,
          name: segments[i],
          path: currentPath,
          type: 'directory',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(folderRef, folderMeta);
      }

      parentFolderId = folderId;
    }

    return parentFolderId;
  }

  /**
   * Creates a folder document in Firestore.
   */
  public static async createFolder(
    accountId: string,
    workspaceId: string = 'default',
    rawPath: string
  ): Promise<WorkspaceFile> {
    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parentRel = cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : '';
    const parentFolderId = parentRel
      ? await this.ensureFolderHierarchy(accountId, workspaceId, parentRel)
      : 'root';

    const folderId = generateCanonicalId(workspaceId, cleanPath);
    const now = new Date().toISOString();
    const folderMeta: ClientFolderMetadata = {
      folderId,
      workspaceId,
      projectId: 'main',
      parentFolderId,
      name: cleanPath.split('/').pop() || cleanPath,
      path: cleanPath,
      type: 'directory',
      createdAt: now,
      updatedAt: now,
    };

    const db = getFirebaseDb();
    const folderRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders', folderId);
    await setDoc(folderRef, folderMeta);

    return {
      folderId,
      workspaceId,
      parentFolderId,
      path: cleanPath,
      name: folderMeta.name,
      type: 'directory',
      size: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Saves or creates a file with chunked storage in Firestore.
   */
  public static async saveFile(
    accountId: string,
    workspaceId: string = 'default',
    rawPath: string,
    content: string = '',
    expectedVersion?: number
  ): Promise<WorkspaceFile> {
    // Step 1: Validate file limits
    const validation = validateFileLimits(content);
    if (!validation.valid) {
      const err = new Error(validation.message || 'File limit exceeded');
      (err as any).code = validation.error;
      throw err;
    }

    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parentRel = cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : '';
    const parentFolderId = parentRel
      ? await this.ensureFolderHierarchy(accountId, workspaceId, parentRel)
      : 'root';

    const fileId = generateCanonicalId(workspaceId, cleanPath);
    const detected = LanguageDetectionService.detect(cleanPath);
    const fullChecksum = await computeSha256(content);
    const chunks = chunkContent(content);

    const db = getFirebaseDb();
    const fileRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files', fileId);
    const existingSnap = await getDoc(fileRef);

    const currentVersion = existingSnap.exists() ? existingSnap.data()?.contentVersion || 0 : 0;
    if (expectedVersion !== undefined && existingSnap.exists() && expectedVersion !== currentVersion) {
      const conflictErr = new Error(`CONFLICT: File version mismatch (expected ${expectedVersion}, current ${currentVersion})`);
      (conflictErr as any).code = 'CONFLICT';
      throw conflictErr;
    }

    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();

    // Step 2: Write all chunks
    const batch = writeBatch(db);
    for (let seq = 0; seq < chunks.length; seq++) {
      const chunkData = chunks[seq];
      const chunkChecksum = await computeSha256(chunkData);
      const chunkId = `v${newVersion}_${seq.toString().padStart(5, '0')}`;
      const chunkRef = doc(
        db,
        'terminalAccounts',
        accountId,
        'workspaces',
        workspaceId,
        'files',
        fileId,
        'chunks',
        chunkId
      );

      const chunkDoc: ClientFileChunk = {
        chunkId,
        fileId,
        version: newVersion,
        sequence: seq,
        data: chunkData,
        sizeBytes: chunkData.length,
        checksum: chunkChecksum,
      };

      batch.set(chunkRef, chunkDoc);
    }

    // Step 3: Write metadata document pointing to newVersion
    const meta: ClientFileMetadata = {
      fileId,
      workspaceId,
      projectId: 'main',
      parentFolderId,
      name: cleanPath.split('/').pop() || cleanPath,
      path: cleanPath,
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
      createdAt: existingSnap.exists() ? existingSnap.data()?.createdAt || now : now,
      updatedAt: now,
      createdBy: accountId,
      updatedBy: accountId,
    };

    batch.set(fileRef, meta);
    await batch.commit();

    return {
      fileId,
      workspaceId,
      parentFolderId,
      path: cleanPath,
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
  }

  /**
   * Reassembles a file's content from its ordered Firestore chunks.
   */
  public static async readFile(
    accountId: string,
    workspaceId: string = 'default',
    fileIdOrPath: string
  ): Promise<{ file: WorkspaceFile; content: string } | null> {
    const db = getFirebaseDb();
    const clean = fileIdOrPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const fileId = clean.includes(':') ? clean : generateCanonicalId(workspaceId, clean);

    const fileRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files', fileId);
    let snap = await getDoc(fileRef);

    // If not found by generated ID, check query by path
    if (!snap.exists()) {
      const filesCol = collection(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files');
      const q = query(filesCol, where('path', '==', clean));
      const qSnap = await getDocs(q);
      if (qSnap.empty) {
        return null;
      }
      snap = qSnap.docs[0];
    }

    const meta = snap.data() as ClientFileMetadata;
    const version = meta.contentVersion || 1;
    const expectedCount = meta.chunkCount || 0;

    if (expectedCount === 0) {
      const detected = LanguageDetectionService.detect(meta.path);
      const record: WorkspaceFile = {
        fileId: meta.fileId,
        workspaceId,
        parentFolderId: meta.parentFolderId,
        path: meta.path,
        name: meta.name,
        type: 'file',
        size: 0,
        content: '',
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        languageId: detected.languageId,
        mimeType: 'text/plain',
        fileType: detected.fileType,
        isRunnable: detected.canExecute,
      };
      return { file: record, content: '' };
    }

    // Query chunks for current version
    const chunksCol = collection(
      db,
      'terminalAccounts',
      accountId,
      'workspaces',
      workspaceId,
      'files',
      meta.fileId,
      'chunks'
    );
    const chunksQuery = query(chunksCol, where('version', '==', version), orderBy('sequence', 'asc'));
    const chunksSnap = await getDocs(chunksQuery);

    let assembled = '';
    chunksSnap.forEach((cDoc) => {
      const chunk = cDoc.data() as ClientFileChunk;
      assembled += chunk.data;
    });

    // Checksum verification
    const actualChecksum = await computeSha256(assembled);
    if (meta.checksum && actualChecksum !== meta.checksum) {
      console.warn(`Checksum mismatch on ${meta.fileId}: expected ${meta.checksum}, got ${actualChecksum}`);
    }

    const detected = LanguageDetectionService.detect(meta.path);
    const record: WorkspaceFile = {
      fileId: meta.fileId,
      workspaceId,
      parentFolderId: meta.parentFolderId,
      path: meta.path,
      name: meta.name,
      type: 'file',
      size: meta.sizeBytes,
      content: assembled,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      languageId: meta.languageId || detected.languageId,
      mimeType: 'text/plain',
      fileType: detected.fileType,
      isRunnable: detected.canExecute,
    };

    return { file: record, content: assembled };
  }

  /**
   * Renames a file while keeping stable fileId.
   */
  public static async renameFile(
    accountId: string,
    workspaceId: string = 'default',
    oldPath: string,
    newPath: string
  ): Promise<{ success: boolean; item?: WorkspaceFile; error?: string }> {
    const db = getFirebaseDb();
    const cleanOld = oldPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const cleanNew = newPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

    const fileId = generateCanonicalId(workspaceId, cleanOld);
    const fileRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files', fileId);
    const snap = await getDoc(fileRef);

    if (!snap.exists()) {
      return { success: false, error: 'File not found in Firestore' };
    }

    const parentRel = cleanNew.includes('/') ? cleanNew.substring(0, cleanNew.lastIndexOf('/')) : '';
    const parentFolderId = parentRel
      ? await this.ensureFolderHierarchy(accountId, workspaceId, parentRel)
      : 'root';

    const now = new Date().toISOString();
    const newName = cleanNew.split('/').pop() || cleanNew;
    const detected = LanguageDetectionService.detect(cleanNew);

    await updateDoc(fileRef, {
      path: cleanNew,
      name: newName,
      parentFolderId,
      updatedAt: now,
      languageId: detected.languageId,
    });

    const data = snap.data() as ClientFileMetadata;
    return {
      success: true,
      item: {
        fileId,
        workspaceId,
        parentFolderId,
        path: cleanNew,
        name: newName,
        type: 'file',
        size: data.sizeBytes,
        createdAt: data.createdAt,
        updatedAt: now,
        languageId: detected.languageId,
        mimeType: 'text/plain',
        fileType: detected.fileType,
        isRunnable: detected.canExecute,
      },
    };
  }

  /**
   * Renames a folder and recursively updates descendant paths with stable IDs.
   */
  public static async renameFolder(
    accountId: string,
    workspaceId: string = 'default',
    oldPath: string,
    newPath: string
  ): Promise<{ success: boolean; item?: WorkspaceFile; error?: string }> {
    const db = getFirebaseDb();
    const cleanOld = oldPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const cleanNew = newPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

    const folderId = generateCanonicalId(workspaceId, cleanOld);
    const folderRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders', folderId);
    const snap = await getDoc(folderRef);

    if (!snap.exists()) {
      return { success: false, error: 'Folder not found in Firestore' };
    }

    const parentRel = cleanNew.includes('/') ? cleanNew.substring(0, cleanNew.lastIndexOf('/')) : '';
    const parentFolderId = parentRel
      ? await this.ensureFolderHierarchy(accountId, workspaceId, parentRel)
      : 'root';

    const now = new Date().toISOString();
    const newName = cleanNew.split('/').pop() || cleanNew;

    await updateDoc(folderRef, {
      path: cleanNew,
      name: newName,
      parentFolderId,
      updatedAt: now,
    });

    // Update all descendant folders and files
    const [foldersSnap, filesSnap] = await Promise.all([
      getDocs(collection(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders')),
      getDocs(collection(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files')),
    ]);

    const batch = writeBatch(db);
    const oldPrefix = `${cleanOld}/`;

    foldersSnap.forEach((fDoc) => {
      const data = fDoc.data() as ClientFolderMetadata;
      if (data.path.startsWith(oldPrefix)) {
        const subRel = data.path.substring(oldPrefix.length);
        const updatedPath = `${cleanNew}/${subRel}`;
        batch.update(fDoc.ref, { path: updatedPath, updatedAt: now });
      }
    });

    filesSnap.forEach((fDoc) => {
      const data = fDoc.data() as ClientFileMetadata;
      if (data.path.startsWith(oldPrefix)) {
        const subRel = data.path.substring(oldPrefix.length);
        const updatedPath = `${cleanNew}/${subRel}`;
        batch.update(fDoc.ref, { path: updatedPath, updatedAt: now });
      }
    });

    await batch.commit();

    return {
      success: true,
      item: {
        folderId,
        workspaceId,
        parentFolderId,
        path: cleanNew,
        name: newName,
        type: 'directory',
        size: 0,
        createdAt: snap.data()?.createdAt || now,
        updatedAt: now,
      },
    };
  }

  /**
   * Moves a file or folder into a destination folder.
   */
  public static async moveItem(
    accountId: string,
    workspaceId: string = 'default',
    sourcePath: string,
    destinationFolder: string
  ): Promise<{ success: boolean; item?: WorkspaceFile; error?: string }> {
    const cleanSource = sourcePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const cleanDest = destinationFolder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemName = cleanSource.split('/').pop() || cleanSource;
    const targetPath = cleanDest ? `${cleanDest}/${itemName}` : itemName;

    // Check if moving file or folder
    const fileId = generateCanonicalId(workspaceId, cleanSource);
    const db = getFirebaseDb();
    const fileRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files', fileId);
    const fileSnap = await getDoc(fileRef);

    if (fileSnap.exists()) {
      return this.renameFile(accountId, workspaceId, cleanSource, targetPath);
    }

    const folderId = generateCanonicalId(workspaceId, cleanSource);
    const folderRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders', folderId);
    const folderSnap = await getDoc(folderRef);

    if (folderSnap.exists()) {
      return this.renameFolder(accountId, workspaceId, cleanSource, targetPath);
    }

    return { success: false, error: 'Item not found in Firestore' };
  }

  /**
   * Deletes a file or folder and all associated chunk documents.
   */
  public static async deleteItem(
    accountId: string,
    workspaceId: string = 'default',
    rawPath: string,
    recursive: boolean = false
  ): Promise<boolean> {
    const clean = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const db = getFirebaseDb();

    // Check if it's a file
    const fileId = generateCanonicalId(workspaceId, clean);
    const fileRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files', fileId);
    const fileSnap = await getDoc(fileRef);

    if (fileSnap.exists()) {
      // Delete all chunks for this file
      const chunksCol = collection(
        db,
        'terminalAccounts',
        accountId,
        'workspaces',
        workspaceId,
        'files',
        fileId,
        'chunks'
      );
      const chunksSnap = await getDocs(chunksCol);
      const batch = writeBatch(db);
      chunksSnap.forEach((cDoc) => batch.delete(cDoc.ref));
      batch.delete(fileRef);
      await batch.commit();
      return true;
    }

    // Check if it's a folder
    const folderId = generateCanonicalId(workspaceId, clean);
    const folderRef = doc(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders', folderId);
    const folderSnap = await getDoc(folderRef);

    if (folderSnap.exists()) {
      const prefix = `${clean}/`;
      const [foldersSnap, filesSnap] = await Promise.all([
        getDocs(collection(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'folders')),
        getDocs(collection(db, 'terminalAccounts', accountId, 'workspaces', workspaceId, 'files')),
      ]);

      const descendantFiles = filesSnap.docs.filter((d) => (d.data() as ClientFileMetadata).path.startsWith(prefix));
      const descendantFolders = foldersSnap.docs.filter(
        (d) => (d.data() as ClientFolderMetadata).path.startsWith(prefix)
      );

      if (!recursive && (descendantFiles.length > 0 || descendantFolders.length > 0)) {
        throw new Error('Directory not empty');
      }

      // Delete descendant files and their chunks
      for (const fDoc of descendantFiles) {
        const cSnap = await getDocs(collection(fDoc.ref, 'chunks'));
        const batch = writeBatch(db);
        cSnap.forEach((cDoc) => batch.delete(cDoc.ref));
        batch.delete(fDoc.ref);
        await batch.commit();
      }

      // Delete descendant folders
      const fBatch = writeBatch(db);
      descendantFolders.forEach((dDoc) => fBatch.delete(dDoc.ref));
      fBatch.delete(folderRef);
      await fBatch.commit();

      return true;
    }

    return false;
  }
}
