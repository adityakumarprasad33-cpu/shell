import { ExecutionMode, ShellType, TerminalSession } from '../types/terminal';
import { safeFetchJson, safeParseResponse } from '../safe-json';

export interface ExecuteOptions {
  sessionId: string;
  command: string;
  workingDirectory: string;
  accountId?: string;
  workspaceId?: string;
  token?: string;
  env?: Record<string, string>;
  onData: (data: string) => void;
  onError: (error: string) => void;
  onExit: (exitCode: number) => void;
  onCwd?: (cwd: string) => void;
}

export interface TerminalExecutionProvider {
  mode: ExecutionMode;
  createSession(params: {
    accountId: string;
    title: string;
    shell: ShellType;
    workingDirectory: string;
  }): Promise<TerminalSession>;
  execute(options: ExecuteOptions): Promise<{ cancel: () => void }>;
  write(sessionId: string, input: string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  interrupt(sessionId: string): Promise<void>;
  terminate(sessionId: string): Promise<void>;
  reconnect(sessionId: string): Promise<TerminalSession | null>;
}

/**
 * Remote Sandbox Provider
 * Connects browser clients to isolated remote execution sandboxes
 * via SSE progressive streaming.
 */
export class RemoteSandboxProvider implements TerminalExecutionProvider {
  mode: ExecutionMode = 'remote';
  private activeControllers = new Map<string, AbortController>();

  async createSession(params: {
    accountId: string;
    title: string;
    shell: ShellType;
    workingDirectory: string;
  }): Promise<TerminalSession> {
    const res = await fetch('/api/terminal/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await safeParseResponse<{ session: TerminalSession }>(res);
    if (!result.ok || !result.data?.session) {
      throw new Error(result.error || `Failed to create remote terminal session: ${res.statusText}`);
    }

    return result.data.session;
  }

  async execute(options: ExecuteOptions): Promise<{ cancel: () => void }> {
    const controller = new AbortController();
    this.activeControllers.set(options.sessionId, controller);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }

      const response = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: options.sessionId,
          command: options.command,
          workingDirectory: options.workingDirectory,
          accountId: options.accountId,
          workspaceId: options.workspaceId,
          env: options.env,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        options.onError(`\r\n\x1b[31m[Runix Sandbox Error] HTTP ${response.status}: ${response.statusText}\x1b[0m\r\n`);
        options.onExit(1);
        return { cancel: () => {} };
      }

      if (!response.body) {
        options.onError(`\r\n\x1b[31m[Runix Sandbox Error] Empty response stream\x1b[0m\r\n`);
        options.onExit(1);
        return { cancel: () => {} };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let hasExited = false;

      const handleChunk = (chunk: string) => {
        const trimmed = chunk.trim();
        if (!trimmed.startsWith('data: ')) return;
        const jsonStr = trimmed.replace(/^data: /, '');

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'stdout') {
            options.onData(event.data);
          } else if (event.type === 'stderr') {
            options.onError(event.data);
          } else if (event.type === 'cwd') {
            options.onCwd?.(event.data);
          } else if (event.type === 'exit') {
            hasExited = true;
            options.onExit(event.exitCode ?? 0);
          } else if (event.type === 'error') {
            options.onError(`\r\n\x1b[31m${event.data}\x1b[0m\r\n`);
          }
        } catch {
          options.onData(jsonStr);
        }
      };

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const chunk of lines) {
              handleChunk(chunk);
            }
          }

          if (buffer.trim()) {
            handleChunk(buffer);
          }

          if (!hasExited) {
            hasExited = true;
            options.onExit(0);
          }
        } catch (streamErr: any) {
          if (streamErr.name !== 'AbortError') {
            options.onError(`\r\n\x1b[31m[Stream Disconnected]: ${streamErr.message}\x1b[0m\r\n`);
          }
          if (!hasExited) {
            hasExited = true;
            options.onExit(1);
          }
        } finally {
          this.activeControllers.delete(options.sessionId);
        }
      })();

      return {
        cancel: () => {
          controller.abort();
          this.interrupt(options.sessionId).catch(() => {});
        },
      };
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        options.onError(`\r\n\x1b[31m[Sandbox Connection Failed]: ${err.message}\x1b[0m\r\n`);
      }
      options.onExit(1);
      return { cancel: () => {} };
    }
  }

  async write(sessionId: string, input: string): Promise<void> {
    await fetch('/api/terminal/execute', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, input }),
    });
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    await fetch('/api/terminal/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, cols, rows }),
    });
  }

  async interrupt(sessionId: string): Promise<void> {
    const controller = this.activeControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(sessionId);
    }
    await fetch('/api/terminal/execute', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'SIGINT' }),
    });
  }

  async terminate(sessionId: string): Promise<void> {
    await fetch(`/api/terminal/session?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  async reconnect(sessionId: string): Promise<TerminalSession | null> {
    try {
      const result = await safeFetchJson<{ session: TerminalSession }>(
        `/api/terminal/session?sessionId=${encodeURIComponent(sessionId)}`
      );
      if (!result.ok || !result.data?.session) return null;
      return result.data.session;
    } catch {
      return null;
    }
  }
}

/**
 * Local Terminal Provider
 * Utilized by Runix Desktop (Electron/Tauri) or local dev proxy
 * to execute directly against the host OS shell.
 */
export class LocalTerminalProvider implements TerminalExecutionProvider {
  mode: ExecutionMode = 'local';

  async createSession(params: {
    accountId: string;
    title: string;
    shell: ShellType;
    workingDirectory: string;
  }): Promise<TerminalSession> {
    const sessionId = `local_${Date.now()}`;
    return {
      sessionId,
      accountId: params.accountId,
      title: `${params.title} (Local)`,
      shell: params.shell,
      workingDirectory: params.workingDirectory || (typeof process !== 'undefined' ? process.cwd() : '~'),
      executionMode: 'local',
      status: 'connected',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  }

  async execute(options: ExecuteOptions): Promise<{ cancel: () => void }> {
    // If running in browser without native bridge, delegate with local flag to sandbox runner
    const remote = new RemoteSandboxProvider();
    return remote.execute(options);
  }

  async write(_sessionId: string, _input: string): Promise<void> {}
  async resize(_sessionId: string, _cols: number, _rows: number): Promise<void> {}
  async interrupt(_sessionId: string): Promise<void> {}
  async terminate(_sessionId: string): Promise<void> {}
  async reconnect(_sessionId: string): Promise<TerminalSession | null> {
    return null;
  }
}
