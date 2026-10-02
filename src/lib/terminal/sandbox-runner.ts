import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { sanitizeCommand } from './secret-sanitizer';
import { getEffectiveSystemPath } from '../runtimes/discovery';

export interface SandboxExecutionConfig {
  sessionId: string;
  command: string;
  workingDirectory?: string;
  runnerRoot?: string;
  materializedFiles?: { path: string; content: string }[];
  cleanupAfterExit?: boolean;
  env?: Record<string, string>;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface StreamEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'error' | 'cwd';
  data?: string;
  exitCode?: number;
  durationMs?: number;
}

// Active process registry to support SIGINT and process termination
const activeProcesses = new Map<string, { process: ChildProcess; startTime: number }>();

/**
 * Materializes temporary runner filesystem strictly for execution/build.
 * Temporary directory NEVER modifies or becomes the authoritative filesystem.
 */
export function materializeExecutionSandbox(
  executionId: string,
  files: { path: string; content: string }[]
): string {
  const runnerRoot = path.join(os.tmpdir(), 'runix_executions', executionId);
  if (!fs.existsSync(runnerRoot)) {
    fs.mkdirSync(runnerRoot, { recursive: true });
  }

  for (const file of files) {
    const targetPath = path.join(runnerRoot, ...file.path.split('/'));
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(targetPath, file.content || '', 'utf-8');
  }

  // Ensure build directory exists for compiled languages (C++, C, Java, etc.)
  const buildDir = path.join(runnerRoot, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  return runnerRoot;
}

/**
 * Cleans up temporary runner filesystem upon execution completion.
 */
export function cleanupExecutionSandbox(runnerRoot?: string): void {
  if (!runnerRoot) return;
  try {
    if (fs.existsSync(runnerRoot)) {
      fs.rmSync(runnerRoot, { recursive: true, force: true });
    }
  } catch (err) {
    // Ignore cleanup warnings
  }
}

/**
 * Execute command inside a controlled sandbox environment.
 * Dispatches SSE-formatted stream events.
 */
export async function runInSandbox(
  config: SandboxExecutionConfig,
  emit: (event: StreamEvent) => void
): Promise<void> {
  const timeoutMs = config.timeoutMs || 30000;
  const maxOutputBytes = config.maxOutputBytes || 5 * 1024 * 1024; // 5MB limit
  const startTime = Date.now();

  const { sanitizedCommand, secretDetected } = sanitizeCommand(config.command);
  let totalBytes = 0;
  let timedOut = false;

  // Materialize files into temporary execution directory if supplied
  let runnerRoot = config.runnerRoot;
  if (!runnerRoot && config.materializedFiles && config.materializedFiles.length > 0) {
    const execId = `${config.sessionId}_${Date.now()}`;
    runnerRoot = materializeExecutionSandbox(execId, config.materializedFiles);
  }

  // Working directory resolution (isolated to sandbox temp or workspace)
  const defaultBaseDir = runnerRoot || path.join(os.tmpdir(), 'runix_sandboxes', config.sessionId);

  try {
    if (!fs.existsSync(defaultBaseDir)) {
      fs.mkdirSync(defaultBaseDir, { recursive: true });
    }
  } catch {}

  const cwd = config.workingDirectory && fs.existsSync(config.workingDirectory)
    ? config.workingDirectory
    : defaultBaseDir;

  // Restrict and sanitize environment variables to prevent leaking server secrets
  const hostPath = getEffectiveSystemPath();
  const safeEnv: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV || 'production',
    PATH: hostPath,
    Path: hostPath,
    SystemRoot: process.env.SystemRoot || 'C:\\Windows',
    HOME: defaultBaseDir,
    USER: 'runix-dev',
    RUNIX_TERMINAL: '1.0.0',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
    FORCE_COLOR: '1',
    ...(config.env || {}),
  };

  const doCleanup = () => {
    if (config.cleanupAfterExit && runnerRoot) {
      cleanupExecutionSandbox(runnerRoot);
    }
  };

  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(config.command, {
        shell: true,
        cwd,
        env: safeEnv,
        windowsHide: true,
      });
    } catch (spawnErr: any) {
      emit({
        type: 'error',
        data: `Failed to spawn process: ${spawnErr.message}`,
      });
      emit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startTime });
      doCleanup();
      return resolve();
    }

    activeProcesses.set(config.sessionId, { process: child, startTime });

    // Enforce execution timeout
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      emit({
        type: 'stderr',
        data: `\r\n\x1b[31m[Runix Sandbox Timeout] Command exceeded maximum execution limit of ${timeoutMs / 1000}s. Terminated.\x1b[0m\r\n`,
      });
      killProcessTree(config.sessionId);
      emit({ type: 'exit', exitCode: 124, durationMs: Date.now() - startTime });
      doCleanup();
      resolve();
    }, timeoutTimerMs(timeoutMs));

    child.stdout?.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxOutputBytes) {
        emit({
          type: 'stderr',
          data: `\r\n\x1b[33m[Runix Output Limit] Output exceeded ${maxOutputBytes / (1024 * 1024)}MB limit. Truncated.\x1b[0m\r\n`,
        });
        killProcessTree(config.sessionId);
        return;
      }
      emit({ type: 'stdout', data: chunk.toString('utf-8') });
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      emit({ type: 'stderr', data: chunk.toString('utf-8') });
    });

    child.on('error', (err: Error) => {
      clearTimeout(timeoutTimer);
      activeProcesses.delete(config.sessionId);
      emit({
        type: 'error',
        data: `Process error: ${err.message}`,
      });
      emit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startTime });
      doCleanup();
      resolve();
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeoutTimer);
      if (!timedOut) {
        activeProcesses.delete(config.sessionId);
        const exitCode = code ?? 0;
        const durationMs = Date.now() - startTime;
        emit({ type: 'exit', exitCode, durationMs });
        doCleanup();
        resolve();
      }
    });
  });
}

function timeoutTimerMs(ms: number): number {
  return ms;
}

/**
 * Interrupt or terminate an active sandbox process
 */
export function killProcessTree(sessionId: string): boolean {
  const item = activeProcesses.get(sessionId);
  if (!item) return false;

  try {
    if (os.platform() === 'win32' && item.process.pid) {
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${item.process.pid} /T /F`, { stdio: 'ignore' });
    }
  } catch {}

  try {
    item.process.kill();
  } catch {}

  activeProcesses.delete(sessionId);
  return true;
}
