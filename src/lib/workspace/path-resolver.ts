/**
 * RUNIX CANONICAL PATH RESOLVER
 * 
 * Single authoritative path resolution engine across all Runix subsystems:
 * Editor, File Explorer, Terminal, CLI, BuildEngine, and ExecutionEngine.
 * 
 * Strict invariants:
 * 1. Logical vs Physical separation:
 *    - Logical Workspace Root: /workspace/{workspaceId}
 *    - Canonical Logical Path: /workspace/{workspaceId}/path/to/file.ext
 *    - Execution Relative Path: path/to/file.ext
 *    - Physical Runner Root: <isolated-temporary-runner-dir>
 *    - Physical File Path: <isolated-temporary-runner-dir>/path/to/file.ext
 * 2. Duplicate Segment Prevention:
 *    - Resolving "test/main.py" inside "test" never blindly creates "test/test/main.py"
 * 3. Security:
 *    - Prevents traversal, UNC, Windows drive escapes, and null-byte injection
 */

import path from 'path';

export interface ResolvedPathResult {
  workspaceId: string;
  logicalWorkspaceRoot: string;      // e.g. "/workspace/default"
  canonicalLogicalPath: string;      // e.g. "/workspace/default/src/main.cpp"
  executionRelativePath: string;     // e.g. "src/main.cpp" (or "" for workspace root)
  parentLogicalPath: string;         // e.g. "/workspace/default/src"
  parentRelativePath: string;        // e.g. "src" (or "" for root)
  name: string;                      // e.g. "main.cpp"
  isRoot: boolean;
}

export class RunixPathResolver {
  /**
   * Sanitizes and normalizes an input path string.
   * Strips quotes, backslashes to slashes, validates boundaries.
   */
  public static normalize(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') return '';
    let cleaned = rawPath.trim().replace(/^["']|["']$/g, '');

    // Check for null bytes or traversal injection
    if (cleaned.includes('\0') || /%2e%2e|%2f|%5c/i.test(cleaned)) {
      throw new Error('PATH_SECURITY_VIOLATION: Encoded traversal or null-byte detected');
    }

    // Reject Windows drive letters (e.g. C:\) or UNC paths (\\server\share)
    if (/^[a-zA-Z]:/.test(cleaned) || cleaned.startsWith('\\\\')) {
      throw new Error('PATH_SECURITY_VIOLATION: Host physical path escape rejected');
    }

    // Convert all backslashes to forward slashes
    cleaned = cleaned.replace(/\\/g, '/');

    // Remove redundant multiple slashes
    cleaned = cleaned.replace(/\/+/g, '/');

    return cleaned;
  }

  /**
   * Validates that a path does not escape the workspace boundary.
   */
  public static validateBoundary(normalizedPath: string): void {
    const parts = normalizedPath.split('/').filter(Boolean);
    let depth = 0;
    for (const part of parts) {
      if (part === '..') {
        depth--;
        if (depth < 0) {
          throw new Error('PATH_BOUNDARY_EXCEEDED: Path escapes workspace root');
        }
      } else if (part !== '.') {
        depth++;
      }
    }
  }

  /**
   * Extracts relative workspace path from any format:
   * - "/workspace/default/src/main.cpp" -> "src/main.cpp"
   * - "workspace/default/src/main.cpp"  -> "src/main.cpp"
   * - "~/src/main.cpp"                  -> "src/main.cpp"
   * - "/src/main.cpp"                   -> "src/main.cpp"
   * - "src/main.cpp"                    -> "src/main.cpp"
   */
  public static toRelativePath(inputPath: string, workspaceId: string = 'default'): string {
    const clean = this.normalize(inputPath);
    if (!clean || clean === '.' || clean === './' || clean === '~' || clean === '~/') {
      return '';
    }

    // Absolute logical path with /workspace/<id>/...
    const wsPrefixRegex = new RegExp(`^/?workspace/${workspaceId}(?:/(.*))?$`);
    const match = clean.match(wsPrefixRegex);
    if (match) {
      return this.cleanRelativePath(match[1] || '');
    }

    // Generic /workspace/<other-id>/...
    const genericWsMatch = clean.match(/^\/?workspace\/[^/]+(?:\/(.*))?$/);
    if (genericWsMatch) {
      return this.cleanRelativePath(genericWsMatch[1] || '');
    }

    // Tilde notation
    if (clean.startsWith('~/')) {
      return this.cleanRelativePath(clean.substring(2));
    }

    // Absolute root slash
    if (clean.startsWith('/')) {
      return this.cleanRelativePath(clean.substring(1));
    }

    return this.cleanRelativePath(clean);
  }

  /**
   * Canonicalizes a relative path removing any ./ or safe internal ..
   */
  private static cleanRelativePath(rel: string): string {
    const parts = rel.split('/').filter((p) => p && p !== '.');
    const resolved: string[] = [];

    for (const p of parts) {
      if (p === '..') {
        if (resolved.length > 0) {
          resolved.pop();
        } else {
          throw new Error('PATH_BOUNDARY_EXCEEDED: Cannot navigate above workspace root');
        }
      } else {
        resolved.push(p);
      }
    }

    return resolved.join('/');
  }

  /**
   * Converts any relative or logical path to canonical logical path format:
   * /workspace/{workspaceId}/{relativePath}
   */
  public static toLogicalPath(relativePath: string, workspaceId: string = 'default'): string {
    const cleanRel = this.toRelativePath(relativePath, workspaceId);
    return cleanRel ? `/workspace/${workspaceId}/${cleanRel}` : `/workspace/${workspaceId}`;
  }

  /**
   * Full Canonical Path Resolution:
   * Resolves target path in context of current directory, workspace ID,
   * with duplicate segment prevention and boundary verification.
   *
   * @param currentDirectory Current logical directory (e.g. "/workspace/default/test" or "test")
   * @param targetPath User input target path (e.g. "test/main.py", "main.py", "../utils.cpp")
   * @param workspaceId Workspace ID (default: "default")
   * @param knownExistingPaths Optional set of known existing relative paths to resolve ambiguities
   */
  public static resolve(
    currentDirectory: string,
    targetPath: string,
    workspaceId: string = 'default',
    knownExistingPaths?: Set<string> | string[]
  ): ResolvedPathResult {
    const cleanTarget = this.normalize(targetPath);
    const existingSet = knownExistingPaths instanceof Set
      ? knownExistingPaths
      : knownExistingPaths
      ? new Set(knownExistingPaths)
      : undefined;

    const cwdRelative = this.toRelativePath(currentDirectory, workspaceId);
    let resolvedRelative = '';

    // 1. Target is empty or refers to current directory
    if (!cleanTarget || cleanTarget === '.' || cleanTarget === './') {
      resolvedRelative = cwdRelative;
    }
    // 2. Target is root or tilde
    else if (cleanTarget === '~' || cleanTarget === '~/') {
      resolvedRelative = '';
    }
    else if (cleanTarget.startsWith('~/')) {
      resolvedRelative = this.cleanRelativePath(cleanTarget.substring(2));
    }
    // 3. Target is an explicit logical workspace path (/workspace/{id}/...)
    else if (cleanTarget.startsWith('/workspace/') || cleanTarget.startsWith('workspace/')) {
      resolvedRelative = this.toRelativePath(cleanTarget, workspaceId);
    }
    // 4. Target is an absolute path within workspace (/...)
    else if (cleanTarget.startsWith('/')) {
      resolvedRelative = this.cleanRelativePath(cleanTarget.substring(1));
    }
    // 5. Target is relative to current directory
    else {
      // DUPLICATE SEGMENT PREVENTION (Section 19):
      // If current directory is "test" and target is "test/main.py":
      // Check if target already starts with cwdRelative
      const cwdPrefix = cwdRelative ? `${cwdRelative}/` : '';
      const hasDuplicatePrefix = cwdRelative && (cleanTarget === cwdRelative || cleanTarget.startsWith(cwdPrefix));

      if (hasDuplicatePrefix) {
        // Check if a nested directory actually exists (e.g. test/test/main.py)
        const nestedCandidate = this.cleanRelativePath(`${cwdRelative}/${cleanTarget}`);
        const singleCandidate = this.cleanRelativePath(cleanTarget);

        if (existingSet && existingSet.has(nestedCandidate)) {
          // If the nested path actually exists on the filesystem, use it
          resolvedRelative = nestedCandidate;
        } else {
          // Otherwise, the user specified the path including the folder name, resolve without duplicating!
          resolvedRelative = singleCandidate;
        }
      } else {
        // Standard relative resolution: join CWD + target
        const rawJoined = cwdRelative ? `${cwdRelative}/${cleanTarget}` : cleanTarget;
        resolvedRelative = this.cleanRelativePath(rawJoined);
      }
    }

    const canonicalLogicalPath = resolvedRelative
      ? `/workspace/${workspaceId}/${resolvedRelative}`
      : `/workspace/${workspaceId}`;

    const parentRelativePath = resolvedRelative.includes('/')
      ? resolvedRelative.substring(0, resolvedRelative.lastIndexOf('/'))
      : '';

    const parentLogicalPath = parentRelativePath
      ? `/workspace/${workspaceId}/${parentRelativePath}`
      : `/workspace/${workspaceId}`;

    const name = resolvedRelative.includes('/')
      ? resolvedRelative.substring(resolvedRelative.lastIndexOf('/') + 1)
      : resolvedRelative;

    return {
      workspaceId,
      logicalWorkspaceRoot: `/workspace/${workspaceId}`,
      canonicalLogicalPath,
      executionRelativePath: resolvedRelative,
      parentLogicalPath,
      parentRelativePath,
      name,
      isRoot: resolvedRelative === '',
    };
  }

  /**
   * Maps a canonical logical path or relative path to a runner-isolated physical path.
   * STRICT REQUIREMENT: Physical path is generated exactly ONCE from the executionRelativePath.
   */
  public static toPhysicalRunnerPath(runnerRoot: string, executionRelativePath: string): string {
    const cleanRel = this.toRelativePath(executionRelativePath);
    // Use platform-specific path joining ONLY here for actual OS execution runner
    return cleanRel ? path.join(runnerRoot, ...cleanRel.split('/')) : runnerRoot;
  }
}
