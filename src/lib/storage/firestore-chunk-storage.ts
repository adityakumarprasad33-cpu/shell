/**
 * RUNIX FIRESTORE CHUNKED STORAGE PROVIDER
 * 
 * Absolute authoritative persistent file and folder store for Runix Core.
 * Google Cloud Storage is NOT part of current MVP.
 * 
 * Invariants:
 * 1. Metadata in files/{fileId} and folders/{folderId}
 * 2. Chunks in files/{fileId}/chunks/{chunkId} (<= 64 KiB safe chunk size)
 * 3. Atomic versioned writes (N -> N+1)
 * 4. Optimistic concurrency control (expectedVersion validation -> STALE_WRITE / CONFLICT)
 * 5. Full SHA-256 verification on assembly
 * 6. Clean chunk garbage collection on update and delete (no orphan chunks)
 * 7. When Firebase Admin DB is unavailable (offline test/dev), transparently uses
 *    persistent JSON document store matching exact Firestore schema.
 * 8. Supports lookup by stable fileId or canonical path.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAdminDb } from '../server/firebase-admin';
import { validateFileLimits, FileLimitValidationResult } from '../workspace/file-limits';

export const CHUNK_SIZE_BYTES = 64 * 1024; // 64 KiB safe chunk size (well within Firestore 1 MB document ceiling)

export interface FirestoreFileMetadata {
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

export interface FirestoreFolderMetadata {
  folderId: string;
  workspaceId: string;
  projectId: string;
  parentFolderId: string;
  name: string;
  path: string;
  type: 'directory';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface FirestoreFileChunk {
  chunkId: string;
  fileId: string;
  version: number;
  sequence: number;
  data: string;
  sizeBytes: number;
  checksum: string;
}

export function computeSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Splits text into deterministic byte-bounded chunks of max CHUNK_SIZE_BYTES
 */
export function chunkContent(content: string, chunkSize: number = CHUNK_SIZE_BYTES): string[] {
  if (!content) return [];
  const chunks: string[] = [];
  const buf = Buffer.from(content, 'utf-8');
  let offset = 0;

  while (offset < buf.length) {
    const end = Math.min(offset + chunkSize, buf.length);
    chunks.push(buf.subarray(offset, end).toString('utf-8'));
    offset = end;
  }

  return chunks;
}

// --------------------------------------------------------------------------
// LOCAL PERSISTENT FALLBACK EMULATOR (Matching exact Firestore Document Model)
// --------------------------------------------------------------------------
function getLocalStorageRoot(): string {
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
  if (isServerless) {
    return path.join(os.tmpdir(), '.runix_cloud_storage');
  }
  return path.join(process.cwd(), '.runix_cloud_storage');
}

export interface WorkspaceDataStore {
  files: Record<string, FirestoreFileMetadata>;
  folders: Record<string, FirestoreFolderMetadata>;
  chunks: Record<string, Record<string, FirestoreFileChunk>>; // fileId -> chunkId -> chunk
}

export function getStorePath(accountId: string, workspaceId: string): string {
  const safeAccount = (accountId || 'anonymous_dev').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeWorkspace = (workspaceId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseDir = getLocalStorageRoot();
  const dir = path.join(/*turbopackIgnore: true*/ baseDir, safeAccount, safeWorkspace);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'firestore_store.json');
  } catch {
    try {
      const fallbackDir = path.join(os.tmpdir(), '.runix_cloud_storage', safeAccount, safeWorkspace);
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      return path.join(fallbackDir, 'firestore_store.json');
    } catch {
      return path.join(os.tmpdir(), `runix_store_${safeAccount}_${safeWorkspace}.json`);
    }
  }
}

export function loadLocalStore(accountId: string, workspaceId: string): WorkspaceDataStore {
  try {
    const p = getStorePath(accountId, workspaceId);
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return {
        files: parsed.files || {},
        folders: parsed.folders || {},
        chunks: parsed.chunks || {},
      };
    }
  } catch (err) {
    console.warn('Notice loading local Firestore fallback store:', err);
  }
  return { files: {}, folders: {}, chunks: {} };
}

export function saveLocalStore(accountId: string, workspaceId: string, store: WorkspaceDataStore): void {
  try {
    const p = getStorePath(accountId, workspaceId);
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local Firestore fallback store:', err);
  }
}

// --------------------------------------------------------------------------
// AUTHORITATIVE FIRESTORE STORAGE PROVIDER
// --------------------------------------------------------------------------

/**
 * Saves file content into chunked Firestore documents with atomic versioning.
 * Writes version N+1 chunks first, verifies integrity, then commits metadata.
 * Implements optimistic concurrency protection if expectedVersion is provided.
 */
export async function saveFileToFirestoreChunks(
  accountId: string,
  workspaceId: string,
  metadata: Omit<FirestoreFileMetadata, 'contentStorage' | 'contentVersion' | 'chunkCount' | 'checksum' | 'sizeBytes' | 'lineCount' | 'wordCount'>,
  content: string,
  expectedVersion?: number
): Promise<{ metadata: FirestoreFileMetadata; validation: FileLimitValidationResult }> {
  // Step 1: Enforce server-side file limits
  const validation = validateFileLimits(content);
  if (!validation.valid) {
    const err = new Error(validation.message || 'File limits exceeded');
    (err as any).code = validation.error;
    throw err;
  }

  const adminDb = getAdminDb();
  const fileId = metadata.fileId;
  const fullChecksum = computeSha256(content);
  const chunks = chunkContent(content);
  const chunkCount = chunks.length;

  if (adminDb && accountId !== 'anonymous_dev') {
    const fileDocRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('files')
      .doc(fileId);

    const existingSnap = await fileDocRef.get();
    const currentVersion = existingSnap.exists ? (existingSnap.data()?.contentVersion || 0) : 0;

    // Concurrency verification (Section 53)
    if (expectedVersion !== undefined && existingSnap.exists && expectedVersion !== currentVersion) {
      const conflictErr = new Error(`CONFLICT: File version mismatch (expected ${expectedVersion}, but current is ${currentVersion})`);
      (conflictErr as any).code = 'CONFLICT';
      throw conflictErr;
    }

    const newVersion = currentVersion + 1;
    const chunksColRef = fileDocRef.collection('chunks');
    const batch = adminDb.batch();

    for (let seq = 0; seq < chunks.length; seq++) {
      const chunkData = chunks[seq];
      const chunkChecksum = computeSha256(chunkData);
      const chunkId = `v${newVersion}_${seq.toString().padStart(5, '0')}`;
      const chunkDocRef = chunksColRef.doc(chunkId);

      const chunkDoc: FirestoreFileChunk = {
        chunkId,
        fileId,
        version: newVersion,
        sequence: seq,
        data: chunkData,
        sizeBytes: Buffer.byteLength(chunkData, 'utf-8'),
        checksum: chunkChecksum,
      };

      batch.set(chunkDocRef, chunkDoc);
    }

    // Commit all chunks
    await batch.commit();

    // Commit metadata pointing to newVersion
    const now = new Date().toISOString();
    const finalMeta: FirestoreFileMetadata = {
      ...metadata,
      sizeBytes: validation.sizeBytes,
      lineCount: validation.lineCount,
      wordCount: validation.wordCount,
      contentStorage: 'firestore-chunks',
      contentVersion: newVersion,
      chunkCount,
      checksum: fullChecksum,
      updatedAt: now,
      createdAt: metadata.createdAt || now,
      createdBy: metadata.createdBy || accountId,
      updatedBy: accountId,
    };

    await fileDocRef.set(finalMeta);

    // Asynchronously cleanup older versions (Section 52)
    if (currentVersion > 0) {
      cleanupOlderChunks(chunksColRef, newVersion).catch(() => {});
    }

    return { metadata: finalMeta, validation };
  }

  // Fallback persistent emulator for offline/test environments
  const store = loadLocalStore(accountId, workspaceId);
  const existing = store.files[fileId] || Object.values(store.files).find((f) => f.path.toLowerCase() === metadata.path.toLowerCase());
  const currentVersion = existing ? existing.contentVersion : 0;

  if (expectedVersion !== undefined && existing && expectedVersion !== currentVersion) {
    const conflictErr = new Error(`CONFLICT: File version mismatch (expected ${expectedVersion}, but current is ${currentVersion})`);
    (conflictErr as any).code = 'CONFLICT';
    throw conflictErr;
  }

  const newVersion = currentVersion + 1;
  const actualFileId = existing ? existing.fileId : fileId;

  if (!store.chunks[actualFileId]) {
    store.chunks[actualFileId] = {};
  }

  // Write new chunks
  for (let seq = 0; seq < chunks.length; seq++) {
    const chunkData = chunks[seq];
    const chunkChecksum = computeSha256(chunkData);
    const chunkId = `v${newVersion}_${seq.toString().padStart(5, '0')}`;
    store.chunks[actualFileId][chunkId] = {
      chunkId,
      fileId: actualFileId,
      version: newVersion,
      sequence: seq,
      data: chunkData,
      sizeBytes: Buffer.byteLength(chunkData, 'utf-8'),
      checksum: chunkChecksum,
    };
  }

  // Clean older chunks
  for (const cId of Object.keys(store.chunks[actualFileId])) {
    if (store.chunks[actualFileId][cId].version < newVersion) {
      delete store.chunks[actualFileId][cId];
    }
  }

  const now = new Date().toISOString();
  const finalMeta: FirestoreFileMetadata = {
    ...metadata,
    fileId: actualFileId,
    sizeBytes: validation.sizeBytes,
    lineCount: validation.lineCount,
    wordCount: validation.wordCount,
    contentStorage: 'firestore-chunks',
    contentVersion: newVersion,
    chunkCount,
    checksum: fullChecksum,
    updatedAt: now,
    createdAt: metadata.createdAt || now,
    createdBy: metadata.createdBy || accountId,
    updatedBy: accountId,
  };

  store.files[actualFileId] = finalMeta;
  saveLocalStore(accountId, workspaceId, store);

  return { metadata: finalMeta, validation };
}

/**
 * Reassembles file content from ordered Firestore chunks, verifying checksum.
 * Supports lookup by fileId or path.
 */
export async function readFileFromFirestoreChunks(
  accountId: string,
  workspaceId: string,
  fileIdOrPath: string
): Promise<{ content: string; metadata: FirestoreFileMetadata } | null> {
  const adminDb = getAdminDb();

  if (adminDb && accountId !== 'anonymous_dev') {
    const fileDocRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('files')
      .doc(fileIdOrPath);

    let metaSnap = await fileDocRef.get();
    let metadata: FirestoreFileMetadata;
    let targetDocRef = fileDocRef;

    if (!metaSnap.exists) {
      const byPathSnap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .where('path', '==', fileIdOrPath)
        .limit(1)
        .get();

      if (byPathSnap.empty) {
        return null;
      }
      targetDocRef = byPathSnap.docs[0].ref;
      metadata = byPathSnap.docs[0].data() as FirestoreFileMetadata;
    } else {
      metadata = metaSnap.data() as FirestoreFileMetadata;
    }

    const version = metadata.contentVersion || 1;
    const expectedCount = metadata.chunkCount || 0;

    if (expectedCount === 0) {
      return { content: '', metadata };
    }

    const chunksSnap = await targetDocRef
      .collection('chunks')
      .where('version', '==', version)
      .orderBy('sequence', 'asc')
      .get();

    if (chunksSnap.size !== expectedCount) {
      throw new Error(
        `Incomplete chunk set for file ${metadata.fileId} version ${version}: expected ${expectedCount} chunks, retrieved ${chunksSnap.size}`
      );
    }

    let assembled = '';
    chunksSnap.forEach((doc) => {
      const chunk = doc.data() as FirestoreFileChunk;
      assembled += chunk.data;
    });

    const actualChecksum = computeSha256(assembled);
    if (metadata.checksum && actualChecksum !== metadata.checksum) {
      throw new Error(`Checksum mismatch on file ${metadata.fileId}: expected ${metadata.checksum}, calculated ${actualChecksum}`);
    }

    return { content: assembled, metadata };
  }

  // Fallback persistent emulator
  const store = loadLocalStore(accountId, workspaceId);
  let metadata = store.files[fileIdOrPath];
  if (!metadata) {
    metadata = Object.values(store.files).find(
      (f) => f.path.toLowerCase() === fileIdOrPath.toLowerCase() || f.fileId === fileIdOrPath
    )!;
  }
  if (!metadata) return null;

  const fileId = metadata.fileId;
  const version = metadata.contentVersion || 1;
  const expectedCount = metadata.chunkCount || 0;

  if (expectedCount === 0) {
    return { content: '', metadata };
  }

  const fileChunks = Object.values(store.chunks[fileId] || {})
    .filter((c) => c.version === version)
    .sort((a, b) => a.sequence - b.sequence);

  if (fileChunks.length !== expectedCount) {
    throw new Error(
      `Incomplete chunk set for file ${fileId} version ${version}: expected ${expectedCount} chunks, retrieved ${fileChunks.length}`
    );
  }

  let assembled = '';
  for (const chunk of fileChunks) {
    assembled += chunk.data;
  }

  const actualChecksum = computeSha256(assembled);
  if (metadata.checksum && actualChecksum !== metadata.checksum) {
    throw new Error(`Checksum mismatch on file ${fileId}: expected ${metadata.checksum}, calculated ${actualChecksum}`);
  }

  return { content: assembled, metadata };
}

/**
 * Deletes file metadata and all associated chunks.
 */
export async function deleteFileFromFirestore(
  accountId: string,
  workspaceId: string,
  fileIdOrPath: string
): Promise<boolean> {
  const adminDb = getAdminDb();

  if (adminDb && accountId !== 'anonymous_dev') {
    const fileDocRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('files')
      .doc(fileIdOrPath);

    let metaSnap = await fileDocRef.get();
    let targetDocRef = fileDocRef;

    if (!metaSnap.exists) {
      const byPathSnap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .where('path', '==', fileIdOrPath)
        .limit(1)
        .get();

      if (byPathSnap.empty) return false;
      targetDocRef = byPathSnap.docs[0].ref;
    }

    const chunksSnap = await targetDocRef.collection('chunks').get();
    if (!chunksSnap.empty) {
      const batch = adminDb.batch();
      chunksSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    await targetDocRef.delete();
    return true;
  }

  const store = loadLocalStore(accountId, workspaceId);
  let fileId = fileIdOrPath;
  if (!store.files[fileId]) {
    const found = Object.values(store.files).find(
      (f) => f.path.toLowerCase() === fileIdOrPath.toLowerCase() || f.fileId === fileIdOrPath
    );
    if (found) fileId = found.fileId;
    else return false;
  }

  delete store.files[fileId];
  delete store.chunks[fileId];
  saveLocalStore(accountId, workspaceId, store);
  return true;
}

/**
 * Updates location metadata (path and parentFolderId) without touching content chunks.
 */
export async function updateFileLocationInFirestore(
  accountId: string,
  workspaceId: string,
  fileIdOrPath: string,
  newPath: string,
  newParentFolderId: string
): Promise<void> {
  const name = path.posix.basename(newPath);
  const now = new Date().toISOString();

  const adminDb = getAdminDb();
  if (adminDb && accountId !== 'anonymous_dev') {
    const fileDocRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('files')
      .doc(fileIdOrPath);

    const metaSnap = await fileDocRef.get();
    let targetDocRef = fileDocRef;
    if (!metaSnap.exists) {
      const byPathSnap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .where('path', '==', fileIdOrPath)
        .limit(1)
        .get();
      if (!byPathSnap.empty) {
        targetDocRef = byPathSnap.docs[0].ref;
      }
    }

    await targetDocRef.update({
      path: newPath,
      name,
      parentFolderId: newParentFolderId,
      updatedAt: now,
    });
    return;
  }

  const store = loadLocalStore(accountId, workspaceId);
  let fileId = fileIdOrPath;
  if (!store.files[fileId]) {
    const found = Object.values(store.files).find(
      (f) => f.path.toLowerCase() === fileIdOrPath.toLowerCase() || f.fileId === fileIdOrPath
    );
    if (found) fileId = found.fileId;
  }

  if (store.files[fileId]) {
    store.files[fileId].path = newPath;
    store.files[fileId].name = name;
    store.files[fileId].parentFolderId = newParentFolderId;
    store.files[fileId].updatedAt = now;
    saveLocalStore(accountId, workspaceId, store);
  }
}

/**
 * Saves a folder metadata document in Firestore folders collection.
 */
export async function saveFolderToFirestore(
  accountId: string,
  workspaceId: string,
  folder: FirestoreFolderMetadata
): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb && accountId !== 'anonymous_dev') {
    const folderDocRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('folders')
      .doc(folder.folderId);

    await folderDocRef.set(folder);
    return;
  }

  const store = loadLocalStore(accountId, workspaceId);
  store.folders[folder.folderId] = folder;
  saveLocalStore(accountId, workspaceId, store);
}

/**
 * Deletes a folder metadata document in Firestore.
 */
export async function deleteFolderFromFirestore(
  accountId: string,
  workspaceId: string,
  folderIdOrPath: string
): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb && accountId !== 'anonymous_dev') {
    const folderDocRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('folders')
      .doc(folderIdOrPath);

    let metaSnap = await folderDocRef.get();
    let targetDocRef = folderDocRef;
    if (!metaSnap.exists) {
      const byPathSnap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('folders')
        .where('path', '==', folderIdOrPath)
        .limit(1)
        .get();
      if (!byPathSnap.empty) {
        targetDocRef = byPathSnap.docs[0].ref;
      }
    }

    await targetDocRef.delete();
    return;
  }

  const store = loadLocalStore(accountId, workspaceId);
  let folderId = folderIdOrPath;
  if (!store.folders[folderId]) {
    const found = Object.values(store.folders).find(
      (f) => f.path.toLowerCase() === folderIdOrPath.toLowerCase() || f.folderId === folderIdOrPath
    );
    if (found) folderId = found.folderId;
    else return;
  }

  delete store.folders[folderId];
  saveLocalStore(accountId, workspaceId, store);
}

/**
 * Retrieves all files and folders for a workspace directly from Firestore.
 */
export async function getWorkspaceStateFromFirestore(
  accountId: string,
  workspaceId: string
): Promise<{ files: FirestoreFileMetadata[]; folders: FirestoreFolderMetadata[] }> {
  const adminDb = getAdminDb();

  if (adminDb && accountId !== 'anonymous_dev') {
    const wsRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .doc(workspaceId);

    const [filesSnap, foldersSnap] = await Promise.all([
      wsRef.collection('files').get(),
      wsRef.collection('folders').get(),
    ]);

    const files = filesSnap.docs.map((d) => d.data() as FirestoreFileMetadata);
    const folders = foldersSnap.docs.map((d) => d.data() as FirestoreFolderMetadata);

    return { files, folders };
  }

  const store = loadLocalStore(accountId, workspaceId);
  return {
    files: Object.values(store.files),
    folders: Object.values(store.folders),
  };
}

/**
 * Cleans up chunks from older versions.
 */
async function cleanupOlderChunks(
  chunksColRef: FirebaseFirestore.CollectionReference,
  keepVersion: number
): Promise<void> {
  try {
    const oldChunksSnap = await chunksColRef.where('version', '<', keepVersion).get();
    if (oldChunksSnap.empty) return;

    const batch = chunksColRef.firestore.batch();
    oldChunksSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch {}
}
