import fs from 'fs';
import path from 'path';
import {
  FilesystemEngine,
  getWorkspaceRoot,
  ensureWorkspace,
  generateCanonicalId,
  getParentFolderId,
  sanitizePath,
  loadWorkspaceMeta,
  saveWorkspaceMeta,
  MoveWorkspaceResult,
  RenameResult,
} from './filesystem-engine';
import { WorkspaceFile } from '../types/terminal';
import { OFFICIAL_RUNIX_COMMAND_REFERENCE } from './command-reference';

export {
  FilesystemEngine,
  getWorkspaceRoot,
  ensureWorkspace,
  generateCanonicalId,
  getParentFolderId,
  sanitizePath,
  loadWorkspaceMeta,
  saveWorkspaceMeta,
  OFFICIAL_RUNIX_COMMAND_REFERENCE,
};
export type { MoveWorkspaceResult, RenameResult };

export function getWorkspaceFiles(accountId: string = 'anonymous_dev', workspaceId: string = 'default'): WorkspaceFile[] {
  return FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
}

export function saveWorkspaceFile(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  relativePath: string,
  content: string
): WorkspaceFile {
  return FilesystemEngine.saveFileSync(accountId, workspaceId, relativePath, content);
}

export function readWorkspaceFile(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  relativePath: string
): WorkspaceFile | null {
  const safeRelPath = sanitizePath(relativePath);
  const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
  const matched = allFiles.find((f) => f.path.toLowerCase() === safeRelPath.toLowerCase() && f.type === 'file');
  if (!matched) return null;

  const storePath = path.join(
    process.cwd(),
    '.runix_cloud_storage',
    accountId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    'firestore_store.json'
  );

  let content = matched.content || '';
  if (fs.existsSync(storePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      const fileId = matched.fileId;
      if (fileId && parsed.chunks?.[fileId]) {
        const fileChunks = Object.values(parsed.chunks[fileId]) as any[];
        fileChunks.sort((a, b) => a.sequence - b.sequence);
        content = fileChunks.map((c) => c.data).join('');
      }
    } catch {}
  }

  // Fallback to legacy disk file if content not yet populated
  if (!content) {
    const legacyPath = path.join(getWorkspaceRoot(accountId, workspaceId), safeRelPath);
    if (fs.existsSync(legacyPath) && !fs.statSync(legacyPath).isDirectory()) {
      content = fs.readFileSync(legacyPath, 'utf-8');
    }
  }

  return {
    ...matched,
    content,
  };
}

export function renameWorkspaceFile(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  oldRelativePath: string,
  newRelativePath: string
): WorkspaceFile | null {
  const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
  const safeOld = sanitizePath(oldRelativePath);
  const item = allFiles.find((f) => f.path.toLowerCase() === safeOld.toLowerCase());
  if (!item) return null;

  if (item.type === 'directory') {
    const res = FilesystemEngine.renameFolderSync(accountId, workspaceId, oldRelativePath, newRelativePath);
    return res.item || null;
  } else {
    const res = FilesystemEngine.renameFileSync(accountId, workspaceId, oldRelativePath, newRelativePath);
    return res.item || null;
  }
}

export function deleteWorkspaceFile(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  relativePath: string
): boolean {
  return FilesystemEngine.deleteItemSync(accountId, workspaceId, relativePath, true);
}

export function createWorkspaceFolder(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  relativePath: string
): WorkspaceFile {
  return FilesystemEngine.createFolder(accountId, workspaceId, relativePath);
}

export function copyWorkspaceFile(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  sourcePath: string,
  destPath: string
): WorkspaceFile | null {
  const file = readWorkspaceFile(accountId, workspaceId, sourcePath);
  if (!file) return null;
  return saveWorkspaceFile(accountId, workspaceId, destPath, file.content || '');
}

export function moveWorkspaceItem(
  accountId: string = 'anonymous_dev',
  workspaceId: string = 'default',
  sourceRelativePath: string,
  destinationFolder: string = ''
): MoveWorkspaceResult {
  return FilesystemEngine.moveItemSync(accountId, workspaceId, sourceRelativePath, destinationFolder);
}
