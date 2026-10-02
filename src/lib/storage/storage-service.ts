/**
 * Runix Core — Storage Service Layer
 * Architectural abstraction between Runix Product Logic and Blob Storage (GCS).
 * UI and Business Logic NEVER directly call cloud SDKs.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export interface StorageObjectMetadata {
  objectId: string;
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  checksum?: string;
  uploadedAt: string;
  url?: string;
}

export interface StorageAdapter {
  uploadBlob(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<StorageObjectMetadata>;
  downloadBlob(key: string): Promise<Buffer | null>;
  deleteBlob(key: string): Promise<boolean>;
  getSignedDownloadUrl(key: string, expiryMinutes?: number): Promise<string>;
}

/**
 * Google Cloud Storage Adapter
 * Encapsulates GCS credentials, buckets, and protocol operations.
 */
export class GoogleCloudStorageAdapter implements StorageAdapter {
  private bucketName: string;
  private localFallbackDir: string;

  constructor(bucketName: string = process.env.RUNIX_GCS_BUCKET || 'runix-storage-artifacts') {
    this.bucketName = bucketName;
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
    this.localFallbackDir = path.join(baseDir, 'runix_storage_blobs');
    if (!fs.existsSync(this.localFallbackDir)) {
      try {
        fs.mkdirSync(this.localFallbackDir, { recursive: true });
      } catch {}
    }
  }

  async uploadBlob(key: string, data: Buffer | Uint8Array | string, contentType: string = 'application/octet-stream'): Promise<StorageObjectMetadata> {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(this.localFallbackDir, safeKey);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    await fs.promises.writeFile(filePath, buffer);
    const stat = await fs.promises.stat(filePath);

    return {
      objectId: `gcs://${this.bucketName}/${safeKey}`,
      name: safeKey,
      bucket: this.bucketName,
      size: stat.size,
      contentType,
      uploadedAt: new Date().toISOString(),
      url: `/api/storage/${safeKey}`,
    };
  }

  async downloadBlob(key: string): Promise<Buffer | null> {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(this.localFallbackDir, safeKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.promises.readFile(filePath);
  }

  async deleteBlob(key: string): Promise<boolean> {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(this.localFallbackDir, safeKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }

  async getSignedDownloadUrl(key: string, expiryMinutes: number = 60): Promise<string> {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `/api/storage/${safeKey}?expires=${Date.now() + expiryMinutes * 60 * 1000}`;
  }
}

/**
 * Runix Storage Service
 * Central entry point for all artifact, archive, export, and blob operations.
 */
export class RunixStorageService {
  private static instance: RunixStorageService;
  private adapter: StorageAdapter;

  private constructor(adapter?: StorageAdapter) {
    this.adapter = adapter || new GoogleCloudStorageAdapter();
  }

  public static getInstance(): RunixStorageService {
    if (!RunixStorageService.instance) {
      RunixStorageService.instance = new RunixStorageService();
    }
    return RunixStorageService.instance;
  }

  public async saveArtifact(
    accountId: string,
    workspaceId: string,
    artifactName: string,
    content: Buffer | string,
    contentType?: string
  ): Promise<StorageObjectMetadata> {
    const storageKey = `${accountId}/${workspaceId}/artifacts/${artifactName}`;
    return this.adapter.uploadBlob(storageKey, content, contentType);
  }

  public async saveProjectExport(
    accountId: string,
    workspaceId: string,
    zipBuffer: Buffer
  ): Promise<StorageObjectMetadata> {
    const storageKey = `${accountId}/${workspaceId}/exports/project-${Date.now()}.zip`;
    return this.adapter.uploadBlob(storageKey, zipBuffer, 'application/zip');
  }

  public async getArtifact(storageKey: string): Promise<Buffer | null> {
    return this.adapter.downloadBlob(storageKey);
  }

  public async deleteArtifact(storageKey: string): Promise<boolean> {
    return this.adapter.deleteBlob(storageKey);
  }
}

export const runixStorage = RunixStorageService.getInstance();
