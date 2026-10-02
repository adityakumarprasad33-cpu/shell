import { FilesystemEngine } from '../workspace/filesystem-engine';
import { RunixPathResolver } from '../workspace/path-resolver';

export interface TerminalDirectorySession {
  sessionId: string;
  accountId: string;
  workspaceId: string;
  currentDirectory: string; // e.g. "/workspace/main-workspace" or "/workspace/main-workspace/src"
  relativeCwd: string;      // e.g. "" (root) or "src" or "src/components"
  lastActiveAt: string;
}

// In-memory session registry (isolated per sessionId)
const activeSessions = new Map<string, TerminalDirectorySession>();

export class TerminalSessionManager {
  /**
   * Retrieves or initializes a session with isolated working directory state.
   */
  public static getOrCreateSession(
    sessionId: string,
    accountId: string = 'anonymous_dev',
    workspaceId: string = 'default'
  ): TerminalDirectorySession {
    let session = activeSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        accountId,
        workspaceId,
        currentDirectory: `/workspace/${workspaceId}`,
        relativeCwd: '',
        lastActiveAt: new Date().toISOString(),
      };
      activeSessions.set(sessionId, session);
    } else {
      session.lastActiveAt = new Date().toISOString();
      if (accountId && accountId !== 'anonymous_dev') {
        session.accountId = accountId;
      }
      if (workspaceId && workspaceId !== 'default') {
        session.workspaceId = workspaceId;
      }
    }
    return session;
  }

  /**
   * Resolves a target path against the session's current relative working directory.
   */
  public static resolvePathInSession(session: TerminalDirectorySession, inputPath: string): string {
    const res = RunixPathResolver.resolve(session.currentDirectory, inputPath, session.workspaceId);
    return res.executionRelativePath;
  }

  /**
   * Changes the session directory.
   * Validates that destination exists and is a directory in the Runix filesystem.
   * Returns true if changed, or false with an error message if invalid.
   */
  public static changeDirectory(
    session: TerminalDirectorySession,
    target: string = '~'
  ): { success: boolean; error?: string; newDirectory?: string; newRelativeCwd?: string } {
    const rawTarget = (target || '~').trim().replace(/^["']|["']$/g, '');

    try {
      const allFiles = FilesystemEngine.getWorkspaceFiles(session.accountId, session.workspaceId);
      const existingPaths = new Set(allFiles.map((f) => f.path));

      const resolved = RunixPathResolver.resolve(
        session.currentDirectory,
        rawTarget,
        session.workspaceId,
        existingPaths
      );

      // If resolved to root
      if (resolved.isRoot) {
        session.relativeCwd = '';
        session.currentDirectory = `/workspace/${session.workspaceId}`;
        session.lastActiveAt = new Date().toISOString();
        return {
          success: true,
          newDirectory: session.currentDirectory,
          newRelativeCwd: session.relativeCwd,
        };
      }

      // Check if target directory exists in authoritative workspace
      const targetFolder = allFiles.find(
        (f) => f.type === 'directory' && f.path.toLowerCase() === resolved.executionRelativePath.toLowerCase()
      );

      if (!targetFolder) {
        const isFile = allFiles.find(
          (f) => f.type === 'file' && f.path.toLowerCase() === resolved.executionRelativePath.toLowerCase()
        );
        if (isFile) {
          return {
            success: false,
            error: `cd: ${rawTarget}: Not a directory`,
          };
        }
        return {
          success: false,
          error: `cd: ${rawTarget}: No such file or directory`,
        };
      }

      session.relativeCwd = targetFolder.path;
      session.currentDirectory = `/workspace/${session.workspaceId}/${targetFolder.path}`;
      session.lastActiveAt = new Date().toISOString();

      return {
        success: true,
        newDirectory: session.currentDirectory,
        newRelativeCwd: session.relativeCwd,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `cd: ${rawTarget}: ${err.message}`,
      };
    }
  }
}
