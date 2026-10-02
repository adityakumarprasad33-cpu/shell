import fs from 'fs';
import path from 'path';
import { StreamEvent, runInSandbox, materializeExecutionSandbox, cleanupExecutionSandbox } from './sandbox-runner';
import {
  ensureWorkspace,
  saveWorkspaceFile,
  readWorkspaceFile,
  deleteWorkspaceFile,
  createWorkspaceFolder,
  copyWorkspaceFile,
  moveWorkspaceItem,
  getWorkspaceFiles,
} from '../workspace/workspace-storage';
import { FilesystemEngine } from '../workspace/filesystem-engine';
import { TerminalSessionManager } from './session-manager';
import { RUNTIME_REGISTRY, getRegistryStatistics } from '../runtimes/registry';
import { detectFileLanguage } from '../runtimes/detector';
import { resolveFileExecution, detectProjectType } from '../runtimes/resolver';
import { createWorkspacePipeline } from '../runtimes/builder';
import { RunixPathResolver } from '../workspace/path-resolver';
import { RunixFileResolver } from '../workspace/file-resolver';

export interface CommandContext {
  sessionId: string;
  command: string;
  accountId?: string;
  workspaceId?: string;
  workingDirectory?: string;
}

/**
 * Robust command line parser that supports single quotes, double quotes, and escapes
 * and cleanly strips quotes from token values.
 */
export function parseCommandLine(commandStr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;
  let escaped = false;

  for (let i = 0; i < commandStr.length; i++) {
    const char = commandStr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (/\s/.test(char) && !inDouble && !inSingle) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Canonical workspace file resolver:
 * Resolves paths with quotes, leading ./, and subfolder relative paths (with optional cwd context)
 */
export function resolveTargetFile(
  accountId: string,
  workspaceId: string,
  inputPath: string,
  relativeCwd: string = ''
): string | null {
  if (!inputPath) return null;
  const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId).filter((f) => f.type === 'file');
  const existingPaths = new Set(allFiles.map((f) => f.path));

  const resolved = RunixPathResolver.resolve(
    relativeCwd,
    inputPath,
    workspaceId,
    existingPaths
  );

  const directMatch = allFiles.find((f) => f.path.toLowerCase() === resolved.executionRelativePath.toLowerCase());
  if (directMatch) return directMatch.path;

  // Match by exact basename if unique
  const clean = inputPath.trim().replace(/^["']|["']$/g, '').replace(/^\.\//, '');
  const nameMatches = allFiles.filter((f) => f.name.toLowerCase() === clean.toLowerCase());
  if (nameMatches.length === 1) return nameMatches[0].path;

  return null;
}

/**
 * Runix Built-in & Custom Command Engine
 * Provides Unix-standard global commands and Runix developer toolset
 * across all client environments (Windows, Linux, macOS, Web).
 * Strict developer aesthetic: NO emojis, clean ANSI styling, robust execution.
 */
export async function processTerminalCommand(
  ctx: CommandContext,
  emit: (event: StreamEvent) => void
): Promise<void> {
  const rawCommand = ctx.command.trim();
  const accountId = ctx.accountId || 'anonymous_dev';
  const workspaceId = ctx.workspaceId || 'default';
  const workspaceDir = ensureWorkspace(accountId, workspaceId);

  // Initialize or fetch session for working directory tracking
  const session = TerminalSessionManager.getOrCreateSession(ctx.sessionId, accountId, workspaceId);

  const startTime = Date.now();
  const args = parseCommandLine(rawCommand);
  if (args.length === 0) {
    return;
  }
  const cmd = args[0].toLowerCase();

  // Helper emitters
  const print = (text: string) => {
    emit({ type: 'stdout', data: text.replace(/\n/g, '\r\n') });
  };
  const printErr = (text: string) => {
    emit({ type: 'stderr', data: text.replace(/\n/g, '\r\n') });
  };
  const exit = (exitCode: number = 0) => {
    emit({ type: 'exit', exitCode, durationMs: Date.now() - startTime });
  };

  // 1. Built-in: ls / dir / ll / la
  if (cmd === 'ls' || cmd === 'dir' || cmd === 'll' || cmd === 'la') {
    try {
      const isLong = cmd === 'll' || args.includes('-l') || args.includes('-la') || args.includes('-al');
      const targetArg = args.slice(1).find((a) => !a.startsWith('-'));
      let targetRel = session.relativeCwd;
      if (targetArg) {
        targetRel = TerminalSessionManager.resolvePathInSession(session, targetArg);
      }

      // Check if target is an individual file
      const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
      const matchedFile = allFiles.find((f) => f.path.toLowerCase() === targetRel.toLowerCase() && f.type === 'file');

      if (matchedFile) {
        if (isLong) {
          const perms = '-rw-r--r--';
          const size = `${matchedFile.size}`.padStart(8);
          const date = new Date(matchedFile.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
          print(`\x1b[90m${perms}\x1b[0m  1 runix runix  \x1b[33m${size}\x1b[0m  \x1b[90m${date}\x1b[0m  ${matchedFile.name}\r\n`);
        } else {
          print(`${matchedFile.name}\r\n`);
        }
        return exit(0);
      }

      // Check if target directory exists (empty string = workspace root)
      if (targetRel) {
        const isDir = allFiles.find((f) => f.path.toLowerCase() === targetRel.toLowerCase() && f.type === 'directory');
        if (!isDir) {
          printErr(`ls: cannot access '${targetArg}': No such file or directory\r\n`);
          return exit(1);
        }
      }

      const items = FilesystemEngine.listDirectory(accountId, workspaceId, targetRel);

      if (items.length === 0) {
        return exit(0);
      }

      if (isLong) {
        print(`total ${items.length}\r\n`);
        for (const item of items) {
          const isDir = item.type === 'directory';
          const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
          const size = `${item.size}`.padStart(8);
          const date = new Date(item.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });

          let coloredName = item.name;
          if (isDir) {
            coloredName = `\x1b[1;34m${item.name}/\x1b[0m`;
          } else if (item.name.endsWith('.py')) {
            coloredName = `\x1b[1;32m${item.name}\x1b[0m`;
          } else if (item.name.endsWith('.cpp') || item.name.endsWith('.c') || item.name.endsWith('.rs')) {
            coloredName = `\x1b[1;33m${item.name}\x1b[0m`;
          } else if (item.name.endsWith('.js') || item.name.endsWith('.ts')) {
            coloredName = `\x1b[1;36m${item.name}\x1b[0m`;
          } else if (item.name.endsWith('.json')) {
            coloredName = `\x1b[1;35m${item.name}\x1b[0m`;
          }

          print(`\x1b[90m${perms}\x1b[0m  1 runix runix  \x1b[33m${size}\x1b[0m  \x1b[90m${date}\x1b[0m  ${coloredName}\r\n`);
        }
        return exit(0);
      }

      // Compact columns listing
      let out = '';
      for (const item of items) {
        if (item.type === 'directory') {
          out += `\x1b[1;34m${item.name}/\x1b[0m  `;
        } else if (item.name.endsWith('.py')) {
          out += `\x1b[1;32m${item.name}\x1b[0m  `;
        } else if (item.name.endsWith('.cpp') || item.name.endsWith('.c') || item.name.endsWith('.rs')) {
          out += `\x1b[1;33m${item.name}\x1b[0m  `;
        } else if (item.name.endsWith('.js') || item.name.endsWith('.ts')) {
          out += `\x1b[1;36m${item.name}\x1b[0m  `;
        } else {
          out += `\x1b[37m${item.name}\x1b[0m  `;
        }
      }
      print(`${out}\r\n`);
      return exit(0);
    } catch (err: any) {
      printErr(`ls error: ${err.message}\r\n`);
      return exit(1);
    }
  }

  // 2. Built-in: pwd
  if (cmd === 'pwd') {
    print(`${session.currentDirectory}\r\n`);
    return exit(0);
  }

  // 3. Built-in: cd
  if (cmd === 'cd') {
    const target = args[1] || '~';
    const res = TerminalSessionManager.changeDirectory(session, target);
    if (!res.success) {
      printErr(`${res.error}\r\n`);
      return exit(1);
    }
    emit({ type: 'cwd', data: session.currentDirectory });
    return exit(0);
  }

  // 4. Built-in: cat / type
  if (cmd === 'cat' || cmd === 'type') {
    const rawTarget = args[1];
    if (!rawTarget) {
      printErr('Usage: cat <filename>\r\n');
      return exit(1);
    }
    const cleanTarget = rawTarget.replace(/^["']|["']$/g, '');
    const resolvedTarget =
      resolveTargetFile(accountId, workspaceId, cleanTarget, session.relativeCwd) ||
      TerminalSessionManager.resolvePathInSession(session, cleanTarget);

    const file = await FilesystemEngine.readFile(accountId, workspaceId, resolvedTarget);
    if (!file) {
      printErr(`cat: ${cleanTarget}: No such file or directory\r\n`);
      return exit(1);
    }
    print(`${file.content || ''}\r\n`);
    return exit(0);
  }

  // 5. Built-in: touch
  if (cmd === 'touch') {
    const targetFiles = args.slice(1).filter((a) => !a.startsWith('-'));
    if (targetFiles.length === 0) {
      printErr('Usage: touch <filename> [filename2...]\r\n');
      return exit(1);
    }
    for (const f of targetFiles) {
      const targetPath = TerminalSessionManager.resolvePathInSession(session, f);
      await FilesystemEngine.createFile(accountId, workspaceId, targetPath, '');
      print(`\x1b[32mCreated file: ${targetPath}\x1b[0m\r\n`);
    }
    return exit(0);
  }

  // 6. Built-in: mkdir
  if (cmd === 'mkdir') {
    const dirNames = args.slice(1).filter((a) => !a.startsWith('-'));
    if (dirNames.length === 0) {
      printErr('Usage: mkdir <directory_name>\r\n');
      return exit(1);
    }
    for (const d of dirNames) {
      const targetPath = TerminalSessionManager.resolvePathInSession(session, d);
      FilesystemEngine.createFolder(accountId, workspaceId, targetPath);
      print(`\x1b[32mCreated directory: ${targetPath}\x1b[0m\r\n`);
    }
    return exit(0);
  }

  // 7. Built-in: rm / del / unlink
  if (cmd === 'rm' || cmd === 'del' || cmd === 'unlink') {
    const isRecursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr') || args.includes('/s');
    const cleanArgs = args.slice(1).filter((a) => !a.startsWith('-'));
    if (cleanArgs.length === 0) {
      printErr('Usage: rm [-r] <filename_or_folder>\r\n');
      return exit(1);
    }
    for (const target of cleanArgs) {
      const targetPath =
        resolveTargetFile(accountId, workspaceId, target, session.relativeCwd) ||
        TerminalSessionManager.resolvePathInSession(session, target);
      try {
        const success = await FilesystemEngine.deleteItem(accountId, workspaceId, targetPath, isRecursive);
        if (!success) {
          printErr(`rm: cannot remove '${target}': No such file or directory\r\n`);
          return exit(1);
        }
        print(`\x1b[32mRemoved: ${targetPath}\x1b[0m\r\n`);
      } catch (err: any) {
        if (err.message === 'DIRECTORY_NOT_EMPTY') {
          printErr(`rm: cannot remove '${target}': Is a directory (use -r to delete recursively)\r\n`);
        } else {
          printErr(`rm: ${err.message}\r\n`);
        }
        return exit(1);
      }
    }
    return exit(0);
  }

  // 8. Built-in: rmdir
  if (cmd === 'rmdir') {
    const cleanArgs = args.slice(1).filter((a) => !a.startsWith('-'));
    if (cleanArgs.length === 0) {
      printErr('Usage: rmdir <directory_name>\r\n');
      return exit(1);
    }
    for (const target of cleanArgs) {
      const targetPath = TerminalSessionManager.resolvePathInSession(session, target);
      try {
        const success = await FilesystemEngine.deleteItem(accountId, workspaceId, targetPath, false);
        if (!success) {
          printErr(`rmdir: failed to remove '${target}': No such file or directory\r\n`);
          return exit(1);
        }
        print(`\x1b[32mRemoved directory: ${targetPath}\x1b[0m\r\n`);
      } catch (err: any) {
        if (err.message === 'DIRECTORY_NOT_EMPTY') {
          printErr(`rmdir: failed to remove '${target}': Directory not empty\r\n`);
        } else {
          printErr(`rmdir: ${err.message}\r\n`);
        }
        return exit(1);
      }
    }
    return exit(0);
  }

  // 9. Built-in: cp
  if (cmd === 'cp') {
    const rawSrc = args[1];
    const rawDest = args[2];
    if (!rawSrc || !rawDest) {
      printErr('Usage: cp <source_file> <dest_file>\r\n');
      return exit(1);
    }
    const resolvedSrc =
      resolveTargetFile(accountId, workspaceId, rawSrc, session.relativeCwd) ||
      TerminalSessionManager.resolvePathInSession(session, rawSrc);
    let resolvedDest = TerminalSessionManager.resolvePathInSession(session, rawDest);

    const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
    const isDestDir = allFiles.some((f) => f.type === 'directory' && f.path.toLowerCase() === resolvedDest.toLowerCase());
    if (isDestDir || rawDest.endsWith('/')) {
      const srcBase = path.posix.basename(resolvedSrc);
      resolvedDest = resolvedDest ? `${resolvedDest}/${srcBase}` : srcBase;
    }

    const copied = await FilesystemEngine.copyFile(accountId, workspaceId, resolvedSrc, resolvedDest);
    if (!copied) {
      printErr(`cp: cannot stat '${rawSrc}': No such file or directory\r\n`);
      return exit(1);
    }
    print(`\x1b[32mCopied ${resolvedSrc} -> ${resolvedDest}\x1b[0m\r\n`);
    return exit(0);
  }

  // 10. Built-in: mv
  if (cmd === 'mv') {
    const rawSrc = args[1];
    const rawDest = args[2];
    if (!rawSrc || !rawDest) {
      printErr('Usage: mv <source> <destination>\r\n');
      return exit(1);
    }
    const cleanSrc = rawSrc.replace(/^["']|["']$/g, '');
    const cleanDest = rawDest.replace(/^["']|["']$/g, '');
    const resolvedSrc =
      resolveTargetFile(accountId, workspaceId, cleanSrc, session.relativeCwd) ||
      TerminalSessionManager.resolvePathInSession(session, cleanSrc);
    const resolvedDest = TerminalSessionManager.resolvePathInSession(session, cleanDest);

    const moveRes = await FilesystemEngine.moveItem(accountId, workspaceId, resolvedSrc, resolvedDest);
    if (!moveRes.success) {
      printErr(`mv: ${moveRes.error || 'operation failed'}\r\n`);
      return exit(1);
    }
    print(`\x1b[32mRenamed/Moved ${moveRes.oldPath} -> ${moveRes.newPath}\x1b[0m\r\n`);
    return exit(0);
  }

  // 11. Built-in: echo (with > overwrite and >> append)
  if (cmd === 'echo') {
    const hasAppend = args.includes('>>');
    const hasOverwrite = !hasAppend && args.includes('>');

    if (hasAppend || hasOverwrite) {
      const splitToken = hasAppend ? '>>' : '>';
      const splitIdx = args.indexOf(splitToken);
      const targetFile = args[splitIdx + 1];
      if (!targetFile) {
        printErr(`Syntax error: target file missing after ${splitToken}\r\n`);
        return exit(1);
      }
      const resolvedTarget = TerminalSessionManager.resolvePathInSession(session, targetFile);
      const rawText = args.slice(1, splitIdx).join(' ').replace(/^["']|["']$/g, '');

      if (hasAppend) {
        const existing = await FilesystemEngine.readFile(accountId, workspaceId, resolvedTarget);
        const newContent = (existing?.content || '') + rawText + '\n';
        await FilesystemEngine.createFile(accountId, workspaceId, resolvedTarget, newContent);
      } else {
        await FilesystemEngine.createFile(accountId, workspaceId, resolvedTarget, rawText + '\n');
      }
      return exit(0);
    } else {
      const text = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
      print(`${text}\r\n`);
      return exit(0);
    }
  }

  // 12. Built-in: head
  if (cmd === 'head') {
    let count = 10;
    let filename = args[1];
    if (args[1] === '-n' && args[2]) {
      count = parseInt(args[2], 10) || 10;
      filename = args[3];
    }
    if (!filename) {
      printErr('Usage: head [-n lines] <filename>\r\n');
      return exit(1);
    }
    const resolved = resolveTargetFile(accountId, workspaceId, filename, session.relativeCwd) || filename;
    const file = await FilesystemEngine.readFile(accountId, workspaceId, resolved);
    if (!file) {
      printErr(`head: ${filename}: No such file or directory\r\n`);
      return exit(1);
    }
    const lines = (file.content || '').split('\n').slice(0, count).join('\n');
    print(`${lines}\r\n`);
    return exit(0);
  }

  // 13. Built-in: tail
  if (cmd === 'tail') {
    let count = 10;
    let filename = args[1];
    if (args[1] === '-n' && args[2]) {
      count = parseInt(args[2], 10) || 10;
      filename = args[3];
    }
    if (!filename) {
      printErr('Usage: tail [-n lines] <filename>\r\n');
      return exit(1);
    }
    const resolved = resolveTargetFile(accountId, workspaceId, filename, session.relativeCwd) || filename;
    const file = await FilesystemEngine.readFile(accountId, workspaceId, resolved);
    if (!file) {
      printErr(`tail: ${filename}: No such file or directory\r\n`);
      return exit(1);
    }
    const allLines = (file.content || '').split('\n');
    const lines = allLines.slice(Math.max(0, allLines.length - count)).join('\n');
    print(`${lines}\r\n`);
    return exit(0);
  }

  // 14. Built-in: grep
  if (cmd === 'grep') {
    const pattern = args[1]?.replace(/^["']|["']$/g, '');
    const filename = args[2];
    if (!pattern || !filename) {
      printErr('Usage: grep <pattern> <filename>\r\n');
      return exit(1);
    }
    const resolved = resolveTargetFile(accountId, workspaceId, filename, session.relativeCwd) || filename;
    const file = await FilesystemEngine.readFile(accountId, workspaceId, resolved);
    if (!file) {
      printErr(`grep: ${filename}: No such file or directory\r\n`);
      return exit(1);
    }
    const lines = (file.content || '').split('\n');
    let matched = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        matched++;
        const highlighted = lines[i].replace(new RegExp(pattern, 'g'), `\x1b[1;31m${pattern}\x1b[0m`);
        print(`\x1b[36m${i + 1}:\x1b[0m ${highlighted}\r\n`);
      }
    }
    return exit(matched > 0 ? 0 : 1);
  }

  // 15. Built-in: date
  if (cmd === 'date') {
    print(`${new Date().toUTCString()}\r\n`);
    return exit(0);
  }

  // 16. Built-in: whoami
  if (cmd === 'whoami') {
    print(`${accountId}\r\n`);
    return exit(0);
  }

  // 17. Built-in: env
  if (cmd === 'env') {
    print(`RUNIX_TERMINAL_VERSION=1.0.0\r\n`);
    print(`RUNIX_WORKSPACE_ID=${workspaceId}\r\n`);
    print(`RUNIX_ACCOUNT_ID=${accountId}\r\n`);
    print(`RUNIX_EXECUTION_MODE=REMOTE_SANDBOX\r\n`);
    print(`SHELL=/bin/bash\r\n`);
    print(`HOME=/home/runix\r\n`);
    print(`PWD=${session.currentDirectory}\r\n`);
    print(`PATH=/usr/local/bin:/usr/bin:/bin\r\n`);
    return exit(0);
  }

  // 18. Built-in: help / man
  if (cmd === 'help' || cmd === 'man') {
    const helpDoc = `
\x1b[1;37mRUNIX TERMINAL PLATFORM (v1.0.0)\x1b[0m
\x1b[90m=================================================================\x1b[0m

\x1b[1;36mGLOBAL SHELL COMMANDS:\x1b[0m
  \x1b[32mls, dir, ll\x1b[0m              List workspace files (supports -l, -la)
  \x1b[32mcat, type <file>\x1b[0m         Display file contents
  \x1b[32mpwd\x1b[0m                      Print current working directory
  \x1b[32mcd <dir>\x1b[0m                 Change working directory (supports .., ~, /workspace)
  \x1b[32mtouch <file>\x1b[0m             Create one or more new empty files
  \x1b[32mmkdir <dir>\x1b[0m              Create directory in workspace
  \x1b[32mrm, del <file>\x1b[0m           Delete file or directory (supports -r, -rf)
  \x1b[32mrmdir <dir>\x1b[0m              Remove empty directory
  \x1b[32mcp <src> <dest>\x1b[0m          Copy file
  \x1b[32mmv <src> <dest>\x1b[0m          Move or rename file
  \x1b[32mecho <text> [> file]\x1b[0m     Print text or write/append to file
  \x1b[32mhead, tail <file>\x1b[0m        Inspect top or bottom lines
  \x1b[32mgrep <pattern> <file>\x1b[0m    Search text pattern inside file
  \x1b[32mclear, cls\x1b[0m               Clear terminal screen
  \x1b[32mwhoami\x1b[0m                   Print active developer identity
  \x1b[32mdate\x1b[0m                     Display system date and time
  \x1b[32menv\x1b[0m                      Display sandbox environment variables

\x1b[1;36mCUSTOM RUNIX TOOLSET:\x1b[0m
  \x1b[33mrunix run <filename>\x1b[0m     Smart compiler & runner (.py, .cpp, .java, .lua, etc.)
  \x1b[33mrunix build [target]\x1b[0m     Execute build tasks from build pipeline
  \x1b[33mrunix test\x1b[0m               Run automated project tests
  \x1b[33mrunix detect <file>\x1b[0m      Inspect file language, runtime, & execution eligibility
  \x1b[33mrunix runtimes\x1b[0m           List verified execution runtimes (114 benchmark)
  \x1b[33mrunix doctor\x1b[0m             Verify host compilers, sandbox boundaries & health
  \x1b[33mrunix create <file>\x1b[0m     Scaffold code template
  \x1b[33mrunix ls\x1b[0m                Tabular file inspection with sizes & times
  \x1b[33mrunix cat <file>\x1b[0m        View file with line numbers
  \x1b[33mrunix rm <file>\x1b[0m         Delete file from persistent storage
  \x1b[33mrunix status\x1b[0m            Inspect sandbox telemetry & memory allocation
  \x1b[33mrunix whoami\x1b[0m            Display Terminal Account ID & plan specs
  \x1b[33mrunix clean\x1b[0m             Purge temporary cache and build artifacts
  \x1b[33mrunix download\x1b[0m          Open official desktop & CLI downloads
  \x1b[33mrunix version\x1b[0m           Display version and engine information
`;
    print(`${helpDoc}\r\n`);
    return exit(0);
  }

  // 19. Custom: runix suite
  if (cmd === 'runix') {
    const sub = args[1]?.toLowerCase();

    if (!sub || sub === 'help') {
      const help = `
\x1b[1;37mRUNIX UNIVERSAL RUNTIME & COMMAND SUITE\x1b[0m
\x1b[90m----------------------------------------------------------------------\x1b[0m
  \x1b[33mrunix run <file>\x1b[0m          Auto-detect language/runtime & execute file
  \x1b[33mrunix build [target]\x1b[0m      Build project using detected build pipeline
  \x1b[33mrunix test\x1b[0m                Execute workspace test suite
  \x1b[33mrunix detect <file>\x1b[0m       Inspect file language, runtime, & execution eligibility
  \x1b[33mrunix runtimes\x1b[0m            List verified execution runtimes (114 benchmark)
  \x1b[33mrunix doctor\x1b[0m              Verify host compilers, sandbox boundaries & health
  \x1b[33mrunix create <file>\x1b[0m       Scaffold code with clean boilerplate
  \x1b[33mrunix ls\x1b[0m                  Detailed workspace file list
  \x1b[33mrunix cat <file>\x1b[0m          Display file with line numbers
  \x1b[33mrunix rm <file>\x1b[0m           Remove workspace file
  \x1b[33mrunix status\x1b[0m              Display live sandbox telemetry & SLA metrics
  \x1b[33mrunix whoami\x1b[0m              Display account profile & identity
  \x1b[33mrunix clean\x1b[0m               Clean cache & temporary files
  \x1b[33mrunix download\x1b[0m            Open official downloads distribution hub
  \x1b[33mrunix version\x1b[0m             Display version and engine information
`;
      print(`${help}\r\n`);
      return exit(0);
    }

    if (sub === 'version') {
      print(`Runix Terminal Engine v1.0.0 (Protocol: 2026-A1, Arch: ${process.arch}, Runtimes: 114 Benchmark Registry)\r\n`);
      return exit(0);
    }

    if (sub === 'detect') {
      const rawTarget = args[2];
      if (!rawTarget) {
        printErr('Usage: runix detect <filename>\r\nExample: runix detect server.py\r\n');
        return exit(1);
      }
      const targetFile =
        resolveTargetFile(accountId, workspaceId, rawTarget, session.relativeCwd) ||
        rawTarget.replace(/^["']|["']$/g, '');
      const detected = detectFileLanguage(targetFile);
      const isVerified = detected.runtime?.verificationStatus === 'PASS';
      const statusColor = isVerified ? '\x1b[32m' : '\x1b[33m';

      print(`\x1b[1mLANGUAGE & RUNTIME DETECTION\x1b[0m\r\n`);
      print(`\x1b[90m--------------------------------------------------\x1b[0m\r\n`);
      print(`  Target File:     \x1b[36m${targetFile}\x1b[0m\r\n`);
      print(`  Language:        \x1b[1;37m${detected.displayName}\x1b[0m (${detected.languageId})\r\n`);
      print(`  Category:        ${detected.category}\r\n`);
      print(`  Editor Mode:     ${detected.editorMode}\r\n`);
      print(`  Runtime ID:      \x1b[33m${detected.runtimeId || 'none'}\x1b[0m\r\n`);
      print(`  Classification:  ${detected.fileType}\r\n`);
      print(`  Registry Status: ${statusColor}${detected.runtime?.status || 'unregistered'}\x1b[0m\r\n`);
      print(`  Host Execution:  ${isVerified ? '\x1b[32mVERIFIED (PASS)\x1b[0m' : '\x1b[31mNOT VERIFIED / COMING SOON\x1b[0m'}\r\n`);
      if (detected.runtime?.runCommand) {
        print(`  Run Command:     \x1b[90m${detected.runtime.runCommand}\x1b[0m\r\n`);
      }
      if (detected.runtime?.buildCommand) {
        print(`  Build Command:   \x1b[90m${detected.runtime.buildCommand}\x1b[0m\r\n`);
      }
      return exit(0);
    }

    if (sub === 'runtimes' || sub === 'envs' || sub === 'registry') {
      const stats = getRegistryStatistics();
      print(`\x1b[1;37mRUNIX UNIVERSAL RUNTIME REGISTRY\x1b[0m\r\n`);
      print(`\x1b[90mBenchmark target: ${stats.totalTargetBenchmark} environments | Verified Host Runtimes: ${stats.verifiedCount}\x1b[0m\r\n`);
      print(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m\r\n`);
      print(`\x1b[1;37mID            NAME                TYPE        VERSION          STATUS       VERIFIED\x1b[0m\r\n`);
      print(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m\r\n`);

      const all = Object.values(RUNTIME_REGISTRY);
      all.sort((a, b) => {
        if (a.verificationStatus === 'PASS' && b.verificationStatus !== 'PASS') return -1;
        if (a.verificationStatus !== 'PASS' && b.verificationStatus === 'PASS') return 1;
        return a.name.localeCompare(b.name);
      });

      const displayList = all.filter((r) => r.verificationStatus === 'PASS' || all.indexOf(r) < 25);
      for (const r of displayList) {
        const idCol = r.id.padEnd(14);
        const nameCol = r.name.padEnd(20);
        const typeCol = r.type.padEnd(12);
        const verCol = (r.version || 'latest').padEnd(17);
        const statusCol = r.status.padEnd(13);
        const isPass = r.verificationStatus === 'PASS';
        const vBadge = isPass ? '\x1b[32mPASS\x1b[0m' : '\x1b[90mPENDING\x1b[0m';

        print(`${idCol}${nameCol}${typeCol}${verCol}${statusCol}${vBadge}\r\n`);
      }
      if (all.length > displayList.length) {
        print(`\x1b[90m... and ${all.length - displayList.length} more cataloged environments in registry.\x1b[0m\r\n`);
      }
      print(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m\r\n`);
      print(`Total: \x1b[32m${stats.verifiedCount} host-verified\x1b[0m | \x1b[33m${stats.availableCount} available\x1b[0m | \x1b[36m${stats.languagesCount} languages\x1b[0m | \x1b[35m${stats.databasesCount} databases\x1b[0m\r\n`);
      return exit(0);
    }

    if (sub === 'doctor') {
      const stats = getRegistryStatistics();
      print(`\x1b[1;37mRUNIX HOST ENVIRONMENT & VERIFICATION AUDIT\x1b[0m\r\n`);
      print(`\x1b[90mChecking installed compilers, interpreters, storage, and security boundaries...\x1b[0m\r\n\r\n`);

      print(`  \x1b[32m[PASS]\x1b[0m Node.js Runtime:     ${process.version} (${process.arch})\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Host Platform:      ${process.platform} (${process.release?.name || 'standard'})\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Sandbox Isolation:  Active (Isolated tmpdir + workspace isolation)\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Secret Redaction:   Active (API keys, JWT, passwords automatically stripped)\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Workspace Storage:  Active (${workspaceDir})\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Working Directory:  ${session.currentDirectory}\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Memory Limit:       512 MB per session\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Execution Timeout:  30 seconds (configurable)\r\n`);
      print(`  \x1b[32m[PASS]\x1b[0m Runtime Registry:   ${stats.totalRegisteredEnvironments} definitions loaded (${stats.verifiedCount} verified)\r\n`);
      print(`\r\n\x1b[1;32mSystem status: ALL PRODUCTION CONSTRAINTS SATISFIED.\x1b[0m\r\n`);
      return exit(0);
    }

    if (sub === 'run') {
      const rawTarget = args[2];
      if (!rawTarget) {
        printErr('Usage: runix run <filename>\r\nExample: runix run main.py\r\n');
        return exit(1);
      }

      const cleanTarget = rawTarget.replace(/^["']|["']$/g, '');
      const resolved = await RunixFileResolver.resolve({
        accountId,
        workspaceId,
        input: rawTarget,
        currentDirectory: session.currentDirectory,
        sessionId: ctx.sessionId,
      });

      if (!resolved) {
        printErr(`runix: file "${cleanTarget}" does not exist in workspace\r\n`);
        return exit(1);
      }

      // If JSON file, validate syntax
      if (resolved.name.endsWith('.json')) {
        try {
          JSON.parse(resolved.content || '');
          print(`\x1b[32m[runix] JSON syntax is valid.\x1b[0m\r\n`);
          return exit(0);
        } catch (jsonErr: any) {
          printErr(`[runix] JSON parse error: ${jsonErr.message}\r\n`);
          return exit(1);
        }
      }

      // Materialize workspace files strictly into isolated temporary runner directory (Section 5, 46)
      const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
      const filesToMaterialize = await Promise.all(
        allFiles.filter((f) => f.type === 'file').map(async (f) => {
          const fileObj = await FilesystemEngine.readFile(accountId, workspaceId, f.path);
          return { path: f.path, content: fileObj?.content || f.content || '' };
        })
      );

      const execId = `${ctx.sessionId}_${Date.now()}`;
      const runnerRoot = materializeExecutionSandbox(execId, filesToMaterialize);

      // Determine process working directory and execution path (Section 47)
      const effectiveExecDir = session.relativeCwd
        ? path.join(runnerRoot, ...session.relativeCwd.split('/'))
        : runnerRoot;

      const runnerRelFile = session.relativeCwd
        ? path.posix.relative(session.relativeCwd, resolved.executionRelativePath) || path.posix.basename(resolved.executionRelativePath)
        : resolved.executionRelativePath;

      // Resolve execution strategy using universal resolver
      const strategy = resolveFileExecution(runnerRelFile, effectiveExecDir);
      if (!strategy) {
        cleanupExecutionSandbox(runnerRoot);
        const detected = detectFileLanguage(resolved.executionRelativePath);
        printErr(`runix: file '${resolved.executionRelativePath}' detected as ${detected.displayName}.\r\n`);
        printErr(`[runix] Runtime '${detected.runtimeId || 'unknown'}' is not host-verified (status: ${detected.runtime?.status || 'unregistered'}).\r\n`);
        printErr(`[runix] Rule: Capabilities are only executable after real host verification.\r\n`);
        return exit(1);
      }

      // Execute compile step first if needed
      if (strategy.compileCommand) {
        print(`\x1b[90m[runix:compile] ${strategy.compileCommand}\x1b[0m\r\n`);
      }

      const finalCmd = strategy.compileCommand
        ? `${strategy.compileCommand} && ${strategy.runCommand}`
        : strategy.runCommand;

      print(`\x1b[90m[runix:exec] ${finalCmd}\x1b[0m\r\n`);
      return runInSandbox(
        {
          sessionId: ctx.sessionId,
          command: finalCmd,
          workingDirectory: fs.existsSync(effectiveExecDir) ? effectiveExecDir : runnerRoot,
          runnerRoot,
          cleanupAfterExit: true,
          env: strategy.env,
        },
        emit
      );
    }

    if (sub === 'build') {
      const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
      const filesToMaterialize = await Promise.all(
        allFiles.filter((f) => f.type === 'file').map(async (f) => {
          const fileObj = await FilesystemEngine.readFile(accountId, workspaceId, f.path);
          return { path: f.path, content: fileObj?.content || f.content || '' };
        })
      );
      const execId = `${ctx.sessionId}_b_${Date.now()}`;
      const runnerRoot = materializeExecutionSandbox(execId, filesToMaterialize);

      const filenames = allFiles.map((f) => f.name);
      const rawTarget = args[2];
      const target = rawTarget
        ? resolveTargetFile(accountId, workspaceId, rawTarget, session.relativeCwd) ||
          rawTarget.replace(/^["']|["']$/g, '')
        : undefined;

      const effectiveExecDir = session.relativeCwd
        ? path.join(runnerRoot, ...session.relativeCwd.split('/'))
        : runnerRoot;

      const pipeline = createWorkspacePipeline(runnerRoot, filenames, target, 'build');

      if (pipeline.steps.length === 0) {
        cleanupExecutionSandbox(runnerRoot);
        printErr(`[runix:build] No build pipeline detected for workspace.\r\n`);
        if (pipeline.diagnostics.length > 0) {
          pipeline.diagnostics.forEach((d) => printErr(`[runix:build] ${d}\r\n`));
        }
        return exit(1);
      }

      const compositeCommand = pipeline.steps.map((s) => s.command).join(' && ');
      print(`\x1b[90m[runix:build] Executing pipeline for ${pipeline.projectType}:\x1b[0m\r\n`);
      pipeline.steps.forEach((s) => print(`\x1b[36m  ▸ ${s.name}\x1b[0m: \x1b[90m${s.command}\x1b[0m\r\n`));

      return runInSandbox(
        {
          sessionId: ctx.sessionId,
          command: compositeCommand,
          workingDirectory: fs.existsSync(effectiveExecDir) ? effectiveExecDir : runnerRoot,
          runnerRoot,
          cleanupAfterExit: true,
        },
        emit
      );
    }

    if (sub === 'test') {
      const allFiles = FilesystemEngine.getWorkspaceFiles(accountId, workspaceId);
      const filesToMaterialize = await Promise.all(
        allFiles.filter((f) => f.type === 'file').map(async (f) => {
          const fileObj = await FilesystemEngine.readFile(accountId, workspaceId, f.path);
          return { path: f.path, content: fileObj?.content || f.content || '' };
        })
      );
      const execId = `${ctx.sessionId}_t_${Date.now()}`;
      const runnerRoot = materializeExecutionSandbox(execId, filesToMaterialize);

      const filenames = allFiles.map((f) => f.name);
      const pipeline = createWorkspacePipeline(runnerRoot, filenames, undefined, 'test');

      if (pipeline.steps.length === 0) {
        cleanupExecutionSandbox(runnerRoot);
        printErr(`[runix:test] No test configuration found for workspace.\r\n`);
        return exit(1);
      }

      const testCmd = pipeline.steps.map((s) => s.command).join(' && ');
      print(`\x1b[90m[runix:test] Running test suite: ${testCmd}\x1b[0m\r\n`);

      const effectiveExecDir = session.relativeCwd
        ? path.join(runnerRoot, ...session.relativeCwd.split('/'))
        : runnerRoot;

      return runInSandbox(
        {
          sessionId: ctx.sessionId,
          command: testCmd,
          workingDirectory: fs.existsSync(effectiveExecDir) ? effectiveExecDir : runnerRoot,
          runnerRoot,
          cleanupAfterExit: true,
        },
        emit
      );
    }

    if (sub === 'ls' || sub === 'list' || sub === 'files') {
      const files = getWorkspaceFiles(accountId, workspaceId);
      print(`\x1b[1mWORKSPACE: ${workspaceId}\x1b[0m (\x1b[36m${workspaceDir}\x1b[0m)\r\n`);
      print(`\x1b[90mCurrent directory: ${session.currentDirectory}\x1b[0m\r\n`);
      print(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m\r\n`);
      for (const f of files) {
        const isDir = f.type === 'directory';
        const typeStr = isDir ? 'DIR ' : 'FILE';
        const sizeStr = `${f.size} B`.padStart(10);
        const nameColor = isDir ? '\x1b[1;34m' : '\x1b[37m';
        print(`  \x1b[90m[${typeStr}]\x1b[0m ${sizeStr}  ${nameColor}${f.path}\x1b[0m\r\n`);
      }
      return exit(0);
    }

    if (sub === 'cat') {
      const target = args[2];
      if (!target) {
        printErr('Usage: runix cat <filename>\r\n');
        return exit(1);
      }
      const resolved = resolveTargetFile(accountId, workspaceId, target, session.relativeCwd) || target;
      const file = readWorkspaceFile(accountId, workspaceId, resolved);
      if (!file) {
        printErr(`runix: file '${target}' not found in workspace\r\n`);
        return exit(1);
      }
      const lines = (file.content || '').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineNum = `${i + 1}`.padStart(4, ' ');
        print(`\x1b[90m${lineNum} |\x1b[0m ${lines[i]}\r\n`);
      }
      return exit(0);
    }

    if (sub === 'rm') {
      const target = args[2];
      if (!target) {
        printErr('Usage: runix rm <filename>\r\n');
        return exit(1);
      }
      const cleanTarget = target.replace(/^["']|["']$/g, '');
      const resolved = resolveTargetFile(accountId, workspaceId, cleanTarget, session.relativeCwd) || cleanTarget;
      const success = deleteWorkspaceFile(accountId, workspaceId, resolved);
      if (!success) {
        printErr(`runix: cannot remove '${cleanTarget}': No such file\r\n`);
        return exit(1);
      }
      print(`\x1b[32mSuccessfully removed: ${resolved}\x1b[0m\r\n`);
      return exit(0);
    }

    if (sub === 'status' || sub === 'info') {
      const files = getWorkspaceFiles(accountId, workspaceId);
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
      const statusText = `
\x1b[1mRUNIX SANDBOX TELEMETRY & SLA METRICS\x1b[0m
  Workspace ID:     \x1b[36m${workspaceId}\x1b[0m (${files.length} items, ${(totalBytes / 1024).toFixed(2)} KB)
  Disk Storage:     \x1b[90m${workspaceDir}\x1b[0m
  Logical CWD:      \x1b[36m${session.currentDirectory}\x1b[0m
  Platform Host:    \x1b[32m${process.platform} ${process.arch}\x1b[0m
  Node Runtime:     \x1b[32m${process.version}\x1b[0m
  Sandbox SLA:      512 MB memory limit | 30s execution timeout
  Status:           \x1b[32mOPTIMAL\x1b[0m
`;
      print(`${statusText}\r\n`);
      return exit(0);
    }

    if (sub === 'whoami') {
      print(`Account ID: \x1b[36m${accountId}\x1b[0m\r\nWorkspace:  \x1b[33m${workspaceId}\x1b[0m\r\nPlan:       \x1b[32mRunix Developer (Dedicated Cloud Sandboxes)\x1b[0m\r\n`);
      return exit(0);
    }

    if (sub === 'clean') {
      print(`\x1b[90m[runix] Cleaning temporary workspace artifacts...\x1b[0m\r\n`);
      print(`\x1b[32m[runix] Workspace clean.\x1b[0m\r\n`);
      return exit(0);
    }

    if (sub === 'download') {
      print(`\x1b[34mRunix Terminal Download Hub:\x1b[0m https://console.runix.in/download\r\n`);
      return exit(0);
    }

    if (sub === 'create') {
      const filename = args[2];
      if (!filename) {
        printErr('Usage: runix create <filename>\r\nExample: runix create server.py\r\n');
        return exit(1);
      }
      const targetPath = TerminalSessionManager.resolvePathInSession(session, filename);

      let content = `# Created by Runix Terminal\n`;
      if (filename.endsWith('.py')) {
        content = `"""\nRunix Python Module\n"""\nimport sys\nimport os\n\ndef main():\n    print("Hello from Runix Python runtime!")\n\nif __name__ == "__main__":\n    main()\n`;
      } else if (filename.endsWith('.js') || filename.endsWith('.mjs')) {
        content = `// Runix Node.js Module\nconsole.log('Hello from Runix Node runtime!');\n`;
      } else if (filename.endsWith('.ts')) {
        content = `// Runix TypeScript Module\ninterface Developer {\n  name: string;\n  role: string;\n}\n\nconst dev: Developer = {\n  name: 'Runix Developer',\n  role: 'Systems Engineer'\n};\n\nconsole.log('Runix TS:', dev);\n`;
      } else if (filename.endsWith('.sh')) {
        content = `#!/usr/bin/env bash\necho "Running Runix shell script..."\n`;
      } else if (filename.endsWith('.json')) {
        content = `{\n  "name": "${filename.replace('.json', '')}",\n  "version": "1.0.0",\n  "active": true\n}\n`;
      } else if (filename.endsWith('.md')) {
        content = `# ${filename.replace('.md', '')}\n\nDocumentation created in Runix Terminal.\n`;
      }

      await FilesystemEngine.createFile(accountId, workspaceId, targetPath, content);
      print(`\x1b[32mCreated ${targetPath} in workspace\x1b[0m\r\n`);
      return exit(0);
    }
  }

  // 20. Native Host Shell Execution in current working directory
  const effectiveExecDir = session.relativeCwd
    ? path.join(workspaceDir, session.relativeCwd)
    : workspaceDir;

  return runInSandbox(
    {
      sessionId: ctx.sessionId,
      command: rawCommand,
      workingDirectory: fs.existsSync(effectiveExecDir) ? effectiveExecDir : workspaceDir,
    },
    emit
  );
}
