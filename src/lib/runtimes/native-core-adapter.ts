/**
 * Runix Core — Native C++20 Execution Engine Adapter
 * 
 * Thin adapter bridge connecting Next.js / TypeScript / React / Terminal
 * directly to the native C++20 Runix Core binary.
 * 
 * Responsibilities:
 * - IPC protocol over stdin/stdout (JSONL) and direct process invocation
 * - Real-time streaming of stdout, stderr, status, and exit events
 * - Capability, detection, and preflight queries
 * - Graceful fallback to TypeScript engine if binary is not yet compiled
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { FileCapabilityState } from './capability-resolver';
import { getEffectiveSystemPath } from './discovery';

export interface NativeStreamEvent {
  type: 'stdout' | 'stderr' | 'status' | 'exit' | 'error';
  data?: string;
  exitCode?: number;
  durationMs?: number;
  status?: string;
  phase?: string;
  tool?: string;
  errorCode?: string;
  message?: string;
}

export interface NativeRunRequest {
  operation: 'run' | 'build';
  executionId: string;
  workspaceId: string;
  projectId?: string;
  filename: string;
  targetFile?: string;
  workspaceDir?: string;
  languageId?: string;
  stdinInput?: string;
  timeoutMs?: number;
  files?: { path: string; content: string }[];
}

export interface NativeDetectionResult {
  filename: string;
  fileType: string;
  languageId: string;
  languageName: string;
  editorLanguage: string;
  runtimeId: string;
  compilerId?: string;
  interpreterId?: string;
  builderId?: string;
  packageManagerId?: string;
  mimeType: string;
  projectType: string;
  category: string;
  confidence: number;
  capabilities: {
    build: boolean;
    run: boolean;
    debug: boolean;
    test: boolean;
    multiFile: boolean;
    package: boolean;
    stdin: boolean;
    stdout: boolean;
    stderr: boolean;
  };
  defaultBuildCommand?: string;
  defaultRunCommand?: string;
  defaultTestCommand?: string;
}

export class NativeCoreAdapter {
  private static binaryPath: string | null = null;
  private static activeProcesses = new Map<string, ChildProcess>();

  /**
   * Resolves the location of the compiled native C++20 runix-core binary
   */
  public static getBinaryPath(): string | null {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      return this.binaryPath;
    }

    const rootDir = process.cwd();
    const candidatePaths = [
      path.join(rootDir, 'runix-core', 'bin', 'runix-core.exe'),
      path.join(rootDir, 'runix-core', 'bin', 'runix-core'),
      path.join(rootDir, 'runix-core', 'build', 'runix-core.exe'),
      path.join(rootDir, 'runix-core', 'build', 'runix-core'),
      path.join(rootDir, 'runix-core', 'build', 'Release', 'runix-core.exe'),
      path.join(rootDir, 'runix-core', 'build', 'Debug', 'runix-core.exe'),
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        try {
          const stat = fs.statSync(cand);
          if (stat.isFile()) {
            this.binaryPath = cand;
            return cand;
          }
        } catch {}
      }
    }

    return null;
  }

  public static isAvailable(): boolean {
    return this.getBinaryPath() !== null;
  }

  /**
   * Central Detection via native C++20 detector
   */
  public static detect(filename: string): NativeDetectionResult | null {
    const bin = this.getBinaryPath();
    if (!bin) return null;

    try {
      const output = execSync(`"${bin}" detect "${filename}"`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return JSON.parse(output.trim());
    } catch {
      return null;
    }
  }

  /**
   * Central Capability resolution via native C++20 resolver
   */
  public static getCapabilities(filename: string, workspaceDir?: string): FileCapabilityState | null {
    const bin = this.getBinaryPath();
    if (!bin) return null;

    try {
      const output = execSync(`"${bin}" capabilities "${filename}"`, {
        encoding: 'utf-8',
        timeout: 8000,
        env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const data = JSON.parse(output.trim());
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Executes Runix Core with streaming JSONL communication
   */
  public static execute(
    request: NativeRunRequest,
    onEvent: (event: NativeStreamEvent) => void
  ): Promise<{ exitCode: number; durationMs: number }> {
    const bin = this.getBinaryPath();
    if (!bin) {
      onEvent({
        type: 'error',
        message: 'Runix Core native binary not found',
      });
      onEvent({ type: 'exit', exitCode: 1, durationMs: 0 });
      return Promise.resolve({ exitCode: 1, durationMs: 0 });
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(bin, [], {
        env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(request.executionId, child);

      let stdoutBuffer = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf-8');
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev: NativeStreamEvent = JSON.parse(trimmed);
            onEvent(ev);
          } catch {
            // Raw text line fallback
            onEvent({ type: 'stdout', data: line + '\n' });
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        onEvent({ type: 'stderr', data: chunk.toString('utf-8') });
      });

      child.on('close', (code) => {
        this.activeProcesses.delete(request.executionId);
        const duration = Date.now() - startTime;
        onEvent({ type: 'exit', exitCode: code ?? 0, durationMs: duration });
        resolve({ exitCode: code ?? 0, durationMs: duration });
      });

      child.on('error', (err) => {
        this.activeProcesses.delete(request.executionId);
        onEvent({ type: 'error', message: err.message });
        resolve({ exitCode: 1, durationMs: Date.now() - startTime });
      });

      // Send the request as single JSON line to native core stdin
      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();
    });
  }

  /**
   * Cancels active execution in native core
   */
  public static cancel(executionId: string): void {
    const child = this.activeProcesses.get(executionId);
    if (child) {
      try {
        child.kill('SIGKILL');
      } catch {}
      this.activeProcesses.delete(executionId);
    }

    const bin = this.getBinaryPath();
    if (bin) {
      try {
        execSync(`"${bin}" cancel "${executionId}"`, {
          timeout: 2000,
          stdio: 'ignore',
        });
      } catch {}
    }
  }
}
