'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Terminal as XTermType } from 'xterm';
import type { FitAddon as FitAddonType } from 'xterm-addon-fit';
import { RemoteSandboxProvider } from '@/lib/terminal/execution-provider';
import { TerminalSession, TerminalSettings } from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';

interface RunixTerminalProps {
  session: TerminalSession;
  settings: TerminalSettings;
  workspaceId?: string;
  onActiveCommandChange?: (cmd: string | null) => void;
  onHistoryAppend?: (cmd: string) => void;
  onFileMutation?: () => void;
  terminalRefCallback?: (handlers: {
    sendInput: (text: string) => void;
    runCommand: (command: string) => void;
    clear: () => void;
    focus: () => void;
  }) => void;
}

export function RunixTerminal({
  session,
  settings,
  workspaceId = 'default',
  onActiveCommandChange,
  onHistoryAppend,
  onFileMutation,
  terminalRefCallback,
}: RunixTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const { user, terminalAccount } = useAuth();

  const [inputBuffer, setInputBuffer] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const cancelExecutionRef = useRef<(() => void) | null>(null);

  const sandboxProvider = useRef(new RemoteSandboxProvider());

  // Mutable refs to prevent useEffect teardown loops
  const onFileMutationRef = useRef(onFileMutation);
  onFileMutationRef.current = onFileMutation;
  const onActiveCommandChangeRef = useRef(onActiveCommandChange);
  onActiveCommandChangeRef.current = onActiveCommandChange;
  const onHistoryAppendRef = useRef(onHistoryAppend);
  onHistoryAppendRef.current = onHistoryAppend;
  const terminalRefCallbackRef = useRef(terminalRefCallback);
  terminalRefCallbackRef.current = terminalRefCallback;

  // Color themes mapped for XTerm
  const getThemeColors = useCallback((theme: TerminalSettings['theme']) => {
    switch (theme) {
      case 'runix-matrix':
        return {
          background: '#040d06',
          foreground: '#00ff66',
          cursor: '#00ff66',
          cursorAccent: '#040d06',
          selectionBackground: 'rgba(0, 255, 102, 0.3)',
          black: '#040d06',
          red: '#ff3333',
          green: '#00ff66',
          yellow: '#ffcc00',
          blue: '#315ef7',
          magenta: '#cc00ff',
          cyan: '#00ffff',
          white: '#e6ffe6',
        };
      case 'runix-amber':
        return {
          background: '#0d0903',
          foreground: '#ffb000',
          cursor: '#ffb000',
          cursorAccent: '#0d0903',
          selectionBackground: 'rgba(255, 176, 0, 0.3)',
          black: '#0d0903',
          red: '#ff4444',
          green: '#77dd77',
          yellow: '#ffb000',
          blue: '#4da6ff',
          magenta: '#d580ff',
          cyan: '#33d6ff',
          white: '#fff2cc',
        };
      case 'runix-titanium':
        return {
          background: '#12141a',
          foreground: '#e4e4e7',
          cursor: '#315ef7',
          cursorAccent: '#12141a',
          selectionBackground: 'rgba(49, 94, 247, 0.35)',
          black: '#12141a',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#315ef7',
          magenta: '#8b5cf6',
          cyan: '#06b6d4',
          white: '#f9fafb',
        };
      case 'runix-cyber':
        return {
          background: '#070814',
          foreground: '#00e5ff',
          cursor: '#ff007f',
          cursorAccent: '#070814',
          selectionBackground: 'rgba(255, 0, 127, 0.3)',
          black: '#070814',
          red: '#ff0055',
          green: '#00ffaa',
          yellow: '#ffe600',
          blue: '#0077ff',
          magenta: '#ff007f',
          cyan: '#00e5ff',
          white: '#f0faff',
        };
      default: // runix-dark (Obsidian Default)
        return {
          background: '#090a0f',
          foreground: '#f3f4f6',
          cursor: '#315ef7',
          cursorAccent: '#090a0f',
          selectionBackground: 'rgba(49, 94, 247, 0.35)',
          black: '#090a0f',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#00e5ff',
          white: '#f9fafb',
        };
    }
  }, []);

  const [currentWorkingDir, setCurrentWorkingDir] = useState<string>(
    session.workingDirectory || `/workspace/${workspaceId || 'default'}`
  );

  const getPrompt = useCallback(() => {
    const user = terminalAccount?.displayName?.toLowerCase().replace(/\s+/g, '') || 'runix-dev';
    const host = session.executionMode === 'remote' ? 'cloud' : 'local';
    return `\x1b[1;36m${user}@${host}\x1b[0m:\x1b[1;32m${currentWorkingDir}\x1b[0m$ `;
  }, [terminalAccount, session.executionMode, currentWorkingDir]);

  const getPromptRef = useRef(getPrompt);
  getPromptRef.current = getPrompt;

  // Execute typed command
  const executeCommand = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      const promptStr = getPromptRef.current();

      if (!trimmed) {
        termRef.current?.write(`\r\n${promptStr}`);
        return;
      }

      // Add to local history
      setHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);
      onHistoryAppendRef.current?.(trimmed);

      // Handle terminal built-in commands that don't need backend trip
      if (trimmed === 'clear' || trimmed === 'cls') {
        termRef.current?.clear();
        termRef.current?.write(promptStr);
        return;
      }

      if (trimmed === 'help' || trimmed === 'runix help') {
        termRef.current?.write('\r\n\x1b[1;36mRUNIX TERMINAL PLATFORM COMMANDS:\x1b[0m\r\n');
        termRef.current?.write('  \x1b[32mrunix version\x1b[0m          Inspect active release distribution and platform telemetry\r\n');
        termRef.current?.write('  \x1b[32mrunix status\x1b[0m           View cloud telemetry, latency, and SLA health\r\n');
        termRef.current?.write('  \x1b[32mrunix download\x1b[0m         Open official distribution page at /download\r\n');
        termRef.current?.write('  \x1b[32mclear\x1b[0m / \x1b[32mcls\x1b[0m            Clear terminal canvas buffer\r\n');
        termRef.current?.write('  \x1b[32mls\x1b[0m, \x1b[32mtouch\x1b[0m, \x1b[32mmkdir\x1b[0m, \x1b[32mcp\x1b[0m, \x1b[32mmv\x1b[0m, \x1b[32mrm\x1b[0m   File management commands\r\n');
        termRef.current?.write('  \x1b[32mpython <file>\x1b[0m, \x1b[32mnode <file>\x1b[0m Real code execution in isolated sandbox\r\n\r\n');
        termRef.current?.write(promptStr);
        return;
      }

      if (
        trimmed === 'runix version' ||
        trimmed === 'runix -v' ||
        trimmed === 'runix --version' ||
        trimmed === 'version'
      ) {
        termRef.current?.write('\r\n\x1b[90mChecking latest release from Runix infrastructure...\x1b[0m\r\n');
        try {
          const res = await fetch('/api/releases?latest=true');
          const data = await res.json();
          const r = data.release || {
            version: '0.1.0',
            publishedAt: '2026-10-02',
            platform: 'windows',
            architecture: 'x64',
            filename: 'RunixTerminal.exe',
            fileSize: '8.4 MB',
            checksum: 'sha256:57f46725bf0b5c6b6ff7224108c9e5b68fdf9aac04cf0e7f26b859ef82c3d030',
            status: 'available',
          };

          termRef.current?.write(`\x1b[1;36mRUNIX TERMINAL\x1b[0m \x1b[1mv${r.version}\x1b[0m  \x1b[32m(Official Release)\x1b[0m\r\n`);
          termRef.current?.write(`  Release Date:  \x1b[37m${r.publishedAt}\x1b[0m\r\n`);
          termRef.current?.write(`  Distribution:  \x1b[37m${r.platform.toUpperCase()} (${r.architecture})\x1b[0m\r\n`);
          termRef.current?.write(`  Artifact:      \x1b[37m${r.filename}\x1b[0m \x1b[90m(${r.fileSize})\x1b[0m\r\n`);
          termRef.current?.write(`  SHA-256 Hash:  \x1b[32m${r.checksum}\x1b[0m\r\n`);
          termRef.current?.write(`  Status:        \x1b[36m${r.status === 'available' ? 'Production GA' : 'Pipeline Processing'}\x1b[0m\r\n`);
          termRef.current?.write(`  Download Hub:  \x1b[34mhttps://console.runix.in/download\x1b[0m\r\n\r\n${promptStr}`);
        } catch {
          termRef.current?.write(`RUNIX TERMINAL v0.1.0 (Official Windows x64 Release)\r\n\r\n${promptStr}`);
        }
        return;
      }

      if (trimmed === 'runix download') {
        termRef.current?.write(`\r\n\x1b[34mNavigating to official download distribution page: https://console.runix.in/download\x1b[0m\r\n`);
        if (typeof window !== 'undefined') {
          window.open('/download', '_blank');
        }
        termRef.current?.write(`\r\n${promptStr}`);
        return;
      }

      // Detect if command mutates files
      const parts = trimmed.split(/\s+/);
      const first = parts[0].toLowerCase();
      const isMutating =
        first === 'touch' ||
        first === 'mkdir' ||
        first === 'rm' ||
        first === 'del' ||
        first === 'rmdir' ||
        first === 'cp' ||
        first === 'mv' ||
        first === 'echo' ||
        (first === 'runix' &&
          (parts[1] === 'create' || parts[1] === 'rm' || parts[1] === 'clean' || parts[1] === 'run' || parts[1] === 'build')) ||
        trimmed.includes('>') ||
        trimmed.includes('>>');

      const token = user ? await user.getIdToken() : undefined;
      const effectiveAccountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      // Execute via sandbox provider
      setIsRunning(true);
      onActiveCommandChangeRef.current?.(trimmed);
      termRef.current?.write('\r\n');

      const { cancel } = await sandboxProvider.current.execute({
        sessionId: session.sessionId,
        command: trimmed,
        workingDirectory: currentWorkingDir,
        accountId: effectiveAccountId,
        workspaceId: workspaceId || 'default',
        token,
        onCwd: (newCwd) => {
          if (newCwd) {
            setCurrentWorkingDir(newCwd);
          }
        },
        onData: (data) => {
          if (!data) return;
          const str = typeof data === 'string' ? data : String(data);
          termRef.current?.write(str.replace(/\r?\n/g, '\r\n'));
        },
        onError: (err) => {
          if (!err) return;
          const str = typeof err === 'string' ? err : String(err);
          termRef.current?.write(str.replace(/\r?\n/g, '\r\n'));
        },
        onExit: (code) => {
          setIsRunning(false);
          onActiveCommandChangeRef.current?.(null);
          cancelExecutionRef.current = null;
          termRef.current?.write(`\r\n${getPromptRef.current()}`);

          if (isMutating) {
            onFileMutationRef.current?.();
          }
        },
      });

      cancelExecutionRef.current = cancel;
    },
    [session.sessionId, session.workingDirectory, terminalAccount?.accountId, user, workspaceId]
  );

  const executeCommandRef = useRef(executeCommand);
  executeCommandRef.current = executeCommand;

  // Initialize XTerm.js (runs once per session.sessionId)
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let term: XTermType;
    let fitAddon: FitAddonType;
    let currentLine = '';

    const initTerminal = async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');
      const { WebLinksAddon } = await import('xterm-addon-web-links');
      const { SearchAddon } = await import('xterm-addon-search');

      if (!isMounted || !containerRef.current) return;

      term = new Terminal({
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        cursorStyle: settings.cursorStyle,
        cursorBlink: settings.cursorBlink,
        scrollback: settings.scrollback,
        theme: getThemeColors(settings.theme),
        allowProposedApi: true,
        convertEol: true,
        logLevel: 'off',
      });

      // Suppress parser warnings for unsupported proprietary / Windows control sequences
      try {
        const core = (term as any)._core;
        if (core?._inputHandler?._parser) {
          core._inputHandler._parser.setErrorHandler((state: any) => state);
        }
      } catch {}

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(new SearchAddon());

      containerRef.current.innerHTML = '';
      term.open(containerRef.current);

      try {
        fitAddon.fit();
      } catch {}

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Welcome Banner (Clean ASCII, No Emojis)
      term.write('\x1b[1;36m+--------------------------------------------------------------+\x1b[0m\r\n');
      term.write('\x1b[1;36m|\x1b[0m   \x1b[1;37mRUNIX TERMINAL PLATFORM\x1b[0m - \x1b[90mIsolated Developer Engine        \x1b[0m\x1b[1;36m|\x1b[0m\r\n');
      term.write('\x1b[1;36m|\x1b[0m   \x1b[32m[CONNECTED]\x1b[0m  |  Mode: \x1b[35mREMOTE\x1b[0m  |  Type \x1b[36mhelp\x1b[0m for commands        \x1b[1;36m|\x1b[0m\r\n');
      term.write('\x1b[1;36m+--------------------------------------------------------------+\x1b[0m\r\n\r\n');
      term.write(getPromptRef.current());

      // Keyboard Event Listener
      term.onKey(({ key, domEvent }) => {
        const ev = domEvent;

        // Ctrl+C (Interrupt running process or cancel line)
        if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C')) {
          if (cancelExecutionRef.current) {
            cancelExecutionRef.current();
            term.write('^C\r\n');
          } else {
            term.write('^C\r\n' + getPromptRef.current());
            currentLine = '';
            setInputBuffer('');
          }
          return;
        }

        // Ctrl+L (Clear screen)
        if (ev.ctrlKey && (ev.key === 'l' || ev.key === 'L')) {
          term.clear();
          term.write(getPromptRef.current() + currentLine);
          return;
        }

        // Ctrl+V (Clipboard paste)
        if (ev.ctrlKey && (ev.key === 'v' || ev.key === 'V')) {
          if (navigator.clipboard) {
            navigator.clipboard.readText().then((clipText) => {
              if (clipText) {
                currentLine += clipText;
                setInputBuffer(currentLine);
                term.write(clipText);
              }
            }).catch(() => {});
          }
          return;
        }

        // Enter key (submit command)
        if (ev.key === 'Enter') {
          const toRun = currentLine;
          currentLine = '';
          setInputBuffer('');
          executeCommandRef.current?.(toRun);
          return;
        }

        // Backspace
        if (ev.key === 'Backspace') {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            setInputBuffer(currentLine);
            term.write('\b \b');
          }
          return;
        }

        // Up Arrow (Command History Backward)
        if (ev.key === 'ArrowUp') {
          setHistory((currHist) => {
            if (currHist.length === 0) return currHist;
            setHistoryIndex((prevIdx) => {
              const newIdx = prevIdx === -1 ? currHist.length - 1 : Math.max(0, prevIdx - 1);
              const cmd = currHist[newIdx];
              while (currentLine.length > 0) {
                term.write('\b \b');
                currentLine = currentLine.slice(0, -1);
              }
              currentLine = cmd;
              setInputBuffer(cmd);
              term.write(cmd);
              return newIdx;
            });
            return currHist;
          });
          return;
        }

        // Down Arrow (Command History Forward)
        if (ev.key === 'ArrowDown') {
          setHistory((currHist) => {
            if (currHist.length === 0) return currHist;
            setHistoryIndex((prevIdx) => {
              if (prevIdx === -1) return -1;
              const newIdx = prevIdx + 1;
              while (currentLine.length > 0) {
                term.write('\b \b');
                currentLine = currentLine.slice(0, -1);
              }
              if (newIdx >= currHist.length) {
                currentLine = '';
                setInputBuffer('');
                return -1;
              } else {
                const cmd = currHist[newIdx];
                currentLine = cmd;
                setInputBuffer(cmd);
                term.write(cmd);
                return newIdx;
              }
            });
            return currHist;
          });
          return;
        }

        // Printable single characters
        if (!ev.altKey && !ev.ctrlKey && !ev.metaKey && key.length === 1) {
          currentLine += key;
          setInputBuffer(currentLine);
          term.write(key);
        }
      });

      // Browser Paste Event on container
      const handlePaste = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text');
        if (text) {
          e.preventDefault();
          currentLine += text;
          setInputBuffer(currentLine);
          term.write(text);
        }
      };
      containerRef.current?.addEventListener('paste', handlePaste);

      // Window resize observer
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch {}
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // Expose controls to parent
      if (terminalRefCallbackRef.current) {
        terminalRefCallbackRef.current({
          sendInput: (text: string) => {
            if (text.includes('\n')) {
              // Direct execution if text ends in newline or multiline
              const lines = text.split('\n');
              for (const l of lines) {
                if (l.trim()) {
                  term.write(l + '\r\n');
                  executeCommandRef.current?.(l);
                }
              }
            } else {
              currentLine += text;
              setInputBuffer(currentLine);
              term.write(text);
            }
          },
          runCommand: (command: string) => {
            const trimmed = command.trim();
            if (!trimmed) return;
            term.write(trimmed + '\r\n');
            currentLine = '';
            setInputBuffer('');
            executeCommandRef.current?.(trimmed);
          },
          clear: () => {
            term.clear();
            term.write(getPromptRef.current());
            currentLine = '';
            setInputBuffer('');
          },
          focus: () => {
            term.focus();
          },
        });
      }
    };

    initTerminal();

    return () => {
      isMounted = false;
      if (termRef.current) {
        termRef.current.dispose();
      }
    };
  }, [session.sessionId]); // ONLY depends on session.sessionId to prevent unneeded re-inits!

  // Update theme & font dynamically when settings change
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getThemeColors(settings.theme);
      termRef.current.options.fontSize = settings.fontSize;
      termRef.current.options.fontFamily = settings.fontFamily;
      termRef.current.options.cursorStyle = settings.cursorStyle;
      termRef.current.options.cursorBlink = settings.cursorBlink;
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }
  }, [settings, getThemeColors]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090A0F] overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full focus:outline-none"
        tabIndex={0}
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
}
