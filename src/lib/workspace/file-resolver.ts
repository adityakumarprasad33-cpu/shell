/**
 * RUNIX FILE RESOLVER SERVICE
 * 
 * Central authoritative file resolution service across all Runix subsystems:
 * Editor, File Explorer, Terminal, CLI, Builder, Runner, and Capability Resolvers.
 * 
 * Resolves by:
 * 1. fileId (stable canonical UUID/base64)
 * 2. logical path (e.g. "/workspace/default/src/main.cpp")
 * 3. workspace-relative path (e.g. "src/main.cpp")
 * 4. currentDirectory-relative path (e.g. "main.cpp" when CWD is "src")
 * 
 * Returns canonical metadata, version, and content.
 */

import { RunixPathResolver, ResolvedPathResult } from './path-resolver';
import { FilesystemEngine } from './filesystem-engine';
import { WorkspaceFile } from '../types/terminal';
import { LanguageDetectionService } from '../runtimes/language-detection-service';

export interface ResolvedRunixFile {
  workspaceId: string;
  projectId: string;
  fileId: string;
  parentFolderId: string;
  canonicalLogicalPath: string;     // e.g. "/workspace/default/src/main.cpp"
  executionRelativePath: string;    // e.g. "src/main.cpp"
  name: string;                     // e.g. "main.cpp"
  type: 'file' | 'directory';
  languageId?: string;
  mimeType?: string;
  sizeBytes: number;
  content: string;
  contentVersion: number;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  metadata: WorkspaceFile;
}

export interface ResolveFileOptions {
  accountId?: string;
  workspaceId?: string;
  projectId?: string;
  input: string;                    // fileId or path
  currentDirectory?: string;        // logical or relative CWD
  sessionId?: string;
  physicalRunnerRoot?: string;
}

export interface RunixDebugInfo {
  sessionId?: string;
  workspaceId: string;
  projectId: string;
  fileId?: string;
  folderId?: string;
  requestedPath: string;
  currentDirectory: string;
  logicalWorkspaceRoot: string;
  canonicalLogicalPath: string;
  executionRelativePath: string;
  physicalRunnerRoot?: string;
  physicalResolvedPath?: string;
  languageId?: string;
  runtimeId?: string;
}

export class RunixFileResolver {
  /**
   * Authoritative file resolution method.
   * Resolves any fileId, logical path, workspace path, or CWD-relative path.
   */
  public static async resolve(options: ResolveFileOptions): Promise<ResolvedRunixFile | null> {
    const accountId = options.accountId || 'anonymous_dev';
    const workspaceId = options.workspaceId || 'default';
    const projectId = options.projectId || 'main';
    const currentDir = options.currentDirectory || `/workspace/${workspaceId}`;
    const rawInput = (options.input || '').trim().replace(/^["']|["']$/g, '');

    if (!rawInput) return null;

    // Fetch all current workspace files from authoritative FilesystemEngine
    const allFiles = await FilesystemEngine.getWorkspaceFilesAsync(accountId, workspaceId);

    // 1. Direct match by fileId
    const fileById = allFiles.find((f) => f.fileId === rawInput);
    if (fileById && fileById.type === 'file') {
      return this.toResolvedFile(accountId, workspaceId, projectId, fileById);
    }

    // 2. Resolve target path through RunixPathResolver
    const existingPaths = new Set(allFiles.map((f) => f.path));
    const pathResult: ResolvedPathResult = RunixPathResolver.resolve(
      currentDir,
      rawInput,
      workspaceId,
      existingPaths
    );

    // 3. Match by canonical executionRelativePath
    let matchedFile = allFiles.find(
      (f) => f.type === 'file' && f.path.toLowerCase() === pathResult.executionRelativePath.toLowerCase()
    );

    // 4. Secondary fallback: match by exact filename if unique within current directory
    if (!matchedFile && !rawInput.includes('/')) {
      const cwdRel = RunixPathResolver.toRelativePath(currentDir, workspaceId);
      const cwdFiles = allFiles.filter((f) => {
        const parent = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
        return parent === cwdRel && f.type === 'file';
      });
      matchedFile = cwdFiles.find((f) => f.name.toLowerCase() === rawInput.toLowerCase());
    }

    if (!matchedFile) {
      return null;
    }

    return this.toResolvedFile(accountId, workspaceId, projectId, matchedFile);
  }

  /**
   * Converts a WorkspaceFile record to full ResolvedRunixFile with reassembled content.
   */
  private static async toResolvedFile(
    accountId: string,
    workspaceId: string,
    projectId: string,
    file: WorkspaceFile
  ): Promise<ResolvedRunixFile> {
    // Read full persisted content through FilesystemEngine
    const readResult = await FilesystemEngine.readFile(accountId, workspaceId, file.path);
    const content = readResult?.content || file.content || '';
    const detected = LanguageDetectionService.detect(file.path);

    const canonicalLogicalPath = RunixPathResolver.toLogicalPath(file.path, workspaceId);

    return {
      workspaceId,
      projectId,
      fileId: file.fileId || '',
      parentFolderId: file.parentFolderId || 'root',
      canonicalLogicalPath,
      executionRelativePath: file.path,
      name: file.name,
      type: 'file',
      languageId: detected.languageId,
      mimeType: file.mimeType || 'text/plain',
      sizeBytes: file.size || Buffer.byteLength(content, 'utf-8'),
      content,
      contentVersion: 1,
      createdAt: file.createdAt || new Date().toISOString(),
      updatedAt: file.updatedAt || new Date().toISOString(),
      metadata: file,
    };
  }

  /**
   * Generates safe diagnostic debug telemetry complying with Section 72.
   * Strips all secrets, passwords, or authentication keys.
   */
  public static getDebugInfo(
    options: ResolveFileOptions,
    resolved?: ResolvedRunixFile | null
  ): RunixDebugInfo {
    const workspaceId = options.workspaceId || 'default';
    const projectId = options.projectId || 'main';
    const currentDirectory = RunixPathResolver.toLogicalPath(
      options.currentDirectory || '',
      workspaceId
    );
    const pathResult = RunixPathResolver.resolve(
      currentDirectory,
      options.input,
      workspaceId
    );

    const physicalRunnerRoot = options.physicalRunnerRoot;
    const physicalResolvedPath = physicalRunnerRoot
      ? RunixPathResolver.toPhysicalRunnerPath(physicalRunnerRoot, pathResult.executionRelativePath)
      : undefined;

    const detected = LanguageDetectionService.detect(pathResult.name);

    return {
      sessionId: options.sessionId,
      workspaceId,
      projectId,
      fileId: resolved?.fileId,
      folderId: resolved?.parentFolderId,
      requestedPath: options.input,
      currentDirectory,
      logicalWorkspaceRoot: `/workspace/${workspaceId}`,
      canonicalLogicalPath: pathResult.canonicalLogicalPath,
      executionRelativePath: pathResult.executionRelativePath,
      physicalRunnerRoot,
      physicalResolvedPath,
      languageId: resolved?.languageId || detected.languageId,
      runtimeId: detected.runtimeId,
    };
  }
}
