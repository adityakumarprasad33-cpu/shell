'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TerminalHeader } from '@/components/terminal/TerminalHeader';
import { RunixTerminal } from '@/components/terminal/RunixTerminal';
import { TerminalStatusBar } from '@/components/terminal/TerminalStatusBar';
import { MobileControls } from '@/components/terminal/MobileControls';
import { WorkspaceExplorer } from '@/components/workspace/WorkspaceExplorer';
import { WorkspaceEditor } from '@/components/workspace/WorkspaceEditor';
import { CommandPalette } from '@/components/terminal/CommandPalette';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { HistoryDrawer } from '@/components/history/HistoryDrawer';
import { WorkspaceManagerModal } from '@/components/workspace/WorkspaceManagerModal';
import Image from 'next/image';
import {
  FolderTree,
  Code2,
  Terminal as TerminalIcon,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Sparkles,
} from 'lucide-react';
import {
  TerminalSession,
  TerminalWorkspace,
  WorkspaceFile,
  TerminalSettings,
  DEFAULT_TERMINAL_SETTINGS,
  ExecutionMode,
} from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';
import { TerminalAuthGate } from '@/components/auth/TerminalAuthGate';
import { safeFetchJson } from '@/lib/safe-json';

export default function ShellPage() {
  const { user, terminalAccount, loading } = useAuth();

  // Settings state (hydrates from terminalAccount preferences)
  const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_TERMINAL_SETTINGS);

  useEffect(() => {
    if (terminalAccount?.preferences) {
      setSettings((prev) => ({ ...prev, ...terminalAccount.preferences }));
    }
  }, [terminalAccount]);

  // Execution Mode (Remote Sandbox by default vs Local Host)
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('remote');

  // File system refresh trigger key
  const [fileRefreshKey, setFileRefreshKey] = useState(0);
  const handleFileMutation = useCallback(() => {
    setFileRefreshKey((k) => k + 1);
  }, []);

  // Workspaces state
  const [workspaces, setWorkspaces] = useState<TerminalWorkspace[]>([
    {
      workspaceId: 'default',
      accountId: terminalAccount?.accountId || 'anonymous_dev',
      name: 'main-workspace',
      description: 'Primary cloud development workspace',
      rootPath: '/home/runix/workspace',
      fileCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [isWorkspaceManagerOpen, setIsWorkspaceManagerOpen] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      sessionId: 'sess_main',
      accountId: terminalAccount?.accountId || 'anonymous_dev',
      title: 'main',
      shell: 'bash',
      workingDirectory: '~/workspace',
      executionMode: 'remote',
      status: 'connected',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('sess_main');

  // 3-Panel Layout & Resizing State
  const [filesWidth, setFilesWidth] = useState<number>(260);
  const [editorWidth, setEditorWidth] = useState<number>(440);
  const [filePanelCollapsed, setFilePanelCollapsed] = useState<boolean>(false);
  const [terminalPanelCollapsed, setTerminalPanelCollapsed] = useState<boolean>(false);
  const [editorPanelCollapsed, setEditorPanelCollapsed] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<'default' | 'terminal' | 'editor' | 'files'>('default');

  // Dragging states
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  // UI Modals state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [activeRunningCommand, setActiveRunningCommand] = useState<string | null>(null);

  // Terminal reference handlers for injecting keyboard inputs / clear
  const terminalHandlers = useRef<{
    sendInput: (text: string) => void;
    runCommand: (command: string) => void;
    clear: () => void;
    focus: () => void;
  } | null>(null);

  const handleTerminalRef = useCallback(
    (handlers: {
      sendInput: (text: string) => void;
      runCommand: (command: string) => void;
      clear: () => void;
      focus: () => void;
    }) => {
      terminalHandlers.current = handlers;
    },
    []
  );

  // Hydrate layout preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('runix_shell_layout_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.filesWidth === 'number') setFilesWidth(parsed.filesWidth);
        if (typeof parsed.editorWidth === 'number') setEditorWidth(parsed.editorWidth);
        if (typeof parsed.filePanelCollapsed === 'boolean') setFilePanelCollapsed(parsed.filePanelCollapsed);
        if (typeof parsed.terminalPanelCollapsed === 'boolean') setTerminalPanelCollapsed(parsed.terminalPanelCollapsed);
        if (typeof parsed.editorPanelCollapsed === 'boolean') setEditorPanelCollapsed(parsed.editorPanelCollapsed);
        if (parsed.focusMode) setFocusMode(parsed.focusMode);
      }
    } catch {}
  }, []);

  const saveLayout = useCallback((partial: Record<string, any>) => {
    try {
      const current = {
        filesWidth,
        editorWidth,
        filePanelCollapsed,
        terminalPanelCollapsed,
        editorPanelCollapsed,
        focusMode,
        ...partial,
      };
      localStorage.setItem('runix_shell_layout_v2', JSON.stringify(current));
    } catch {}
  }, [filesWidth, editorWidth, filePanelCollapsed, terminalPanelCollapsed, editorPanelCollapsed, focusMode]);

  // Handle Drag Resizing between panels
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingFiles) {
        e.preventDefault();
        const newWidth = Math.min(Math.max(e.clientX, 180), 480);
        setFilesWidth(newWidth);
      } else if (isDraggingEditor) {
        e.preventDefault();
        const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 280), 800);
        setEditorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingFiles) {
        setIsDraggingFiles(false);
        saveLayout({ filesWidth });
      }
      if (isDraggingEditor) {
        setIsDraggingEditor(false);
        saveLayout({ editorWidth });
      }
    };

    if (isDraggingFiles || isDraggingEditor) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingFiles, isDraggingEditor, filesWidth, editorWidth, saveLayout]);

  // Keyboard shortcuts Alt+1 (Files), Alt+2 (Terminal), Alt+3 (Editor)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setFilePanelCollapsed((prev) => {
          const next = !prev;
          saveLayout({ filePanelCollapsed: next });
          return next;
        });
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setTerminalPanelCollapsed((prev) => {
          const next = !prev;
          saveLayout({ terminalPanelCollapsed: next });
          return next;
        });
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setEditorPanelCollapsed((prev) => {
          const next = !prev;
          saveLayout({ editorPanelCollapsed: next });
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveLayout]);

  // Focus mode switches
  const handleSetFocusMode = (mode: 'default' | 'terminal' | 'editor' | 'files') => {
    setFocusMode(mode);
    if (mode === 'terminal') {
      setFilePanelCollapsed(true);
      setTerminalPanelCollapsed(false);
      setEditorPanelCollapsed(true);
      saveLayout({ focusMode: mode, filePanelCollapsed: true, terminalPanelCollapsed: false, editorPanelCollapsed: true });
    } else if (mode === 'editor') {
      setFilePanelCollapsed(true);
      setTerminalPanelCollapsed(true);
      setEditorPanelCollapsed(false);
      saveLayout({ focusMode: mode, filePanelCollapsed: true, terminalPanelCollapsed: true, editorPanelCollapsed: false });
    } else if (mode === 'files') {
      setFilePanelCollapsed(false);
      setTerminalPanelCollapsed(false);
      setEditorPanelCollapsed(true);
      saveLayout({ focusMode: mode, filePanelCollapsed: false, terminalPanelCollapsed: false, editorPanelCollapsed: true });
    } else {
      setFilePanelCollapsed(false);
      setTerminalPanelCollapsed(false);
      setEditorPanelCollapsed(false);
      saveLayout({ focusMode: 'default', filePanelCollapsed: false, terminalPanelCollapsed: false, editorPanelCollapsed: false });
    }
  };

  // Fetch workspaces for current account using safe JSON parser
  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await safeFetchJson<{ workspaces?: TerminalWorkspace[] }>(
        `/api/workspaces?accountId=${encodeURIComponent(user.uid)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok && res.data?.workspaces && res.data.workspaces.length > 0) {
        setWorkspaces(res.data.workspaces);
        if (!res.data.workspaces.some((w) => w.workspaceId === activeWorkspaceId)) {
          setActiveWorkspaceId(res.data.workspaces[0].workspaceId);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Create new session
  const handleCreateSession = useCallback(async () => {
    const sessionNum = sessions.length + 1;
    const newSession: TerminalSession = {
      sessionId: `sess_${Date.now()}`,
      accountId: terminalAccount?.accountId || 'runix-dev',
      title: `terminal-${sessionNum}`,
      shell: settings.defaultShell || 'bash',
      workingDirectory: '~/workspace',
      executionMode,
      status: 'connected',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.sessionId);
  }, [executionMode, sessions.length, settings.defaultShell, terminalAccount]);

  // Close session
  const handleCloseSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.sessionId !== sessionId);
      if (filtered.length === 0) {
        return prev;
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].sessionId);
      }
      return filtered;
    });
  }, [activeSessionId]);

  // Active workspace object
  const currentWorkspace =
    workspaces.find((w) => w.workspaceId === activeWorkspaceId) || workspaces[0];

  // Active session object
  const currentSession =
    sessions.find((s) => s.sessionId === activeSessionId) || sessions[0];

  // Export workspace trigger
  const handleExportWorkspace = async () => {
    if (!currentWorkspace) return;
    try {
      const token = user ? await user.getIdToken() : '';
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(currentWorkspace.workspaceId)}/export?accountId=${encodeURIComponent(
          terminalAccount?.accountId || ''
        )}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentWorkspace.name}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Run file or action in terminal using universal Runix execution core
  const handleRunFile = (action: string) => {
    if (!terminalHandlers.current) return;
    // Auto-expand terminal panel if collapsed
    if (terminalPanelCollapsed) {
      setTerminalPanelCollapsed(false);
      saveLayout({ terminalPanelCollapsed: false });
    }
    terminalHandlers.current.focus();
    const commandToRun = action.startsWith('runix ') ? action : `runix run "${action}"`;
    terminalHandlers.current.runCommand(commandToRun);
  };

  // Rerun command from history
  const handleRerunCommand = (cmd: string) => {
    if (terminalHandlers.current) {
      if (terminalPanelCollapsed) {
        setTerminalPanelCollapsed(false);
        saveLayout({ terminalPanelCollapsed: false });
      }
      terminalHandlers.current.focus();
      terminalHandlers.current.runCommand(cmd);
      setIsHistoryOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080C] text-[#F3F4F6] flex flex-col items-center justify-center p-4 font-mono select-none">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-8 h-8">
            <Image src="/logo-v2.png" alt="Runix" width={32} height={32} className="object-contain animate-pulse" />
          </div>
          <span className="font-bold tracking-wider text-sm text-zinc-200">RUNIX TERMINAL</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>INITIALIZING SECURE SESSION ENVIRONMENT...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <TerminalAuthGate />;
  }

  // Calculate effective visibility based on collapsed state and focus mode
  const isFilesEffectiveCollapsed = focusMode === 'terminal' || focusMode === 'editor' ? true : filePanelCollapsed;
  const isTerminalEffectiveCollapsed = focusMode === 'editor' ? true : terminalPanelCollapsed;
  const isEditorEffectiveCollapsed = focusMode === 'terminal' || focusMode === 'files' ? true : editorPanelCollapsed;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090A0F] text-[#F3F4F6]">
      {/* Top Application Header */}
      <TerminalHeader
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onCloseSession={handleCloseSession}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={(id) => {
          setActiveWorkspaceId(id);
          setActiveFile(null);
        }}
        onOpenWorkspaceManager={() => setIsWorkspaceManagerOpen(true)}
        executionMode={executionMode}
        onToggleExecutionMode={() =>
          setExecutionMode((prev) => (prev === 'remote' ? 'local' : 'remote'))
        }
        filePanelCollapsed={isFilesEffectiveCollapsed}
        onToggleFilePanel={() => {
          if (focusMode !== 'default') setFocusMode('default');
          setFilePanelCollapsed((prev) => {
            const next = !prev;
            saveLayout({ filePanelCollapsed: next });
            return next;
          });
        }}
        terminalPanelCollapsed={isTerminalEffectiveCollapsed}
        onToggleTerminalPanel={() => {
          if (focusMode !== 'default') setFocusMode('default');
          setTerminalPanelCollapsed((prev) => {
            const next = !prev;
            saveLayout({ terminalPanelCollapsed: next });
            return next;
          });
        }}
        editorPanelCollapsed={isEditorEffectiveCollapsed}
        onToggleEditorPanel={() => {
          if (focusMode !== 'default') setFocusMode('default');
          setEditorPanelCollapsed((prev) => {
            const next = !prev;
            saveLayout({ editorPanelCollapsed: next });
            return next;
          });
        }}
        focusMode={focusMode}
        onSetFocusMode={handleSetFocusMode}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Center Body (Workspace Explorer + Resizer 1 + Terminal Viewport + Resizer 2 + Editor) */}
      <div className="flex-1 flex overflow-hidden relative select-none">
        {/* PANEL 1: Workspace File Explorer */}
        {currentWorkspace && (
          <div
            style={{ width: isFilesEffectiveCollapsed ? '36px' : `${filesWidth}px` }}
            className="h-full shrink-0 flex flex-col transition-all duration-150 border-r border-white/10 bg-[#0E1117] overflow-hidden relative"
          >
            {isFilesEffectiveCollapsed ? (
              <div className="w-full h-full flex flex-col items-center py-3 bg-[#0E1117]">
                <button
                  onClick={() => {
                    setFilePanelCollapsed(false);
                    if (focusMode === 'terminal' || focusMode === 'editor') setFocusMode('default');
                    saveLayout({ filePanelCollapsed: false });
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Expand Files Panel (Alt+1)"
                >
                  <FolderTree className="w-4 h-4 text-[#315EF7]" />
                </button>
                <div
                  onClick={() => {
                    setFilePanelCollapsed(false);
                    if (focusMode === 'terminal' || focusMode === 'editor') setFocusMode('default');
                    saveLayout({ filePanelCollapsed: false });
                  }}
                  className="mt-6 [writing-mode:vertical-lr] text-[10px] font-mono tracking-widest text-zinc-400 hover:text-zinc-200 cursor-pointer select-none"
                >
                  EXPLORER
                </div>
              </div>
            ) : (
              <WorkspaceExplorer
                workspace={currentWorkspace}
                onOpenFile={(file) => {
                  setActiveFile(file);
                  if (editorPanelCollapsed) {
                    setEditorPanelCollapsed(false);
                    saveLayout({ editorPanelCollapsed: false });
                  }
                }}
                activeFilePath={activeFile?.path}
                refreshTrigger={fileRefreshKey}
                onCollapse={() => {
                  setFilePanelCollapsed(true);
                  saveLayout({ filePanelCollapsed: true });
                }}
                className="w-full"
              />
            )}
          </div>
        )}

        {/* RESIZER 1: Between File Explorer and Terminal */}
        {!isFilesEffectiveCollapsed && !isTerminalEffectiveCollapsed && (
          <div
            onMouseDown={() => setIsDraggingFiles(true)}
            onDoubleClick={() => {
              setFilesWidth(260);
              saveLayout({ filesWidth: 260 });
            }}
            className={`w-1 cursor-col-resize hover:bg-[#315EF7] active:bg-[#315EF7] transition-colors z-20 shrink-0 ${
              isDraggingFiles ? 'bg-[#315EF7]' : 'bg-transparent'
            }`}
            title="Drag to resize Explorer. Double-click to reset (260px)"
          />
        )}

        {/* PANEL 2: Terminal Viewport (Mounted persistently to preserve session execution) */}
        <main
          className={`h-full relative flex flex-col min-w-0 bg-[#090A0F] ${
            isTerminalEffectiveCollapsed ? 'hidden' : 'flex-1'
          }`}
        >
          <RunixTerminal
            key={currentSession.sessionId}
            session={currentSession}
            settings={settings}
            workspaceId={currentWorkspace.workspaceId}
            onActiveCommandChange={setActiveRunningCommand}
            onFileMutation={handleFileMutation}
            terminalRefCallback={handleTerminalRef}
          />
        </main>

        {/* Terminal Collapsed Tab (when terminal is collapsed but files/editor active) */}
        {isTerminalEffectiveCollapsed && (
          <div className="w-9 h-full shrink-0 flex flex-col items-center py-3 bg-[#0E1117] border-r border-white/10">
            <button
              onClick={() => {
                setTerminalPanelCollapsed(false);
                if (focusMode === 'editor') setFocusMode('default');
                saveLayout({ terminalPanelCollapsed: false });
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Expand Terminal (Alt+2)"
            >
              <TerminalIcon className="w-4 h-4 text-emerald-400" />
            </button>
            <div
              onClick={() => {
                setTerminalPanelCollapsed(false);
                if (focusMode === 'editor') setFocusMode('default');
                saveLayout({ terminalPanelCollapsed: false });
              }}
              className="mt-6 [writing-mode:vertical-lr] text-[10px] font-mono tracking-widest text-zinc-400 hover:text-zinc-200 cursor-pointer select-none"
            >
              TERMINAL
            </div>
          </div>
        )}

        {/* RESIZER 2: Between Terminal and Editor */}
        {!isTerminalEffectiveCollapsed && !isEditorEffectiveCollapsed && (
          <div
            onMouseDown={() => setIsDraggingEditor(true)}
            onDoubleClick={() => {
              setEditorWidth(440);
              saveLayout({ editorWidth: 440 });
            }}
            className={`w-1 cursor-col-resize hover:bg-[#315EF7] active:bg-[#315EF7] transition-colors z-20 shrink-0 ${
              isDraggingEditor ? 'bg-[#315EF7]' : 'bg-transparent'
            }`}
            title="Drag to resize Editor. Double-click to reset (440px)"
          />
        )}

        {/* PANEL 3: Workspace File Editor */}
        <div
          style={{ width: isEditorEffectiveCollapsed ? '36px' : `${editorWidth}px` }}
          className={`h-full shrink-0 flex flex-col transition-all duration-150 border-l border-white/10 bg-[#0E1117] overflow-hidden relative ${
            isEditorEffectiveCollapsed ? 'w-9' : ''
          }`}
        >
          {isEditorEffectiveCollapsed ? (
            <div className="w-full h-full flex flex-col items-center py-3 bg-[#0E1117]">
              <button
                onClick={() => {
                  setEditorPanelCollapsed(false);
                  if (focusMode === 'terminal' || focusMode === 'files') setFocusMode('default');
                  saveLayout({ editorPanelCollapsed: false });
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Expand Editor (Alt+3)"
              >
                <Code2 className="w-4 h-4 text-[#315EF7]" />
              </button>
              <div
                onClick={() => {
                  setEditorPanelCollapsed(false);
                  if (focusMode === 'terminal' || focusMode === 'files') setFocusMode('default');
                  saveLayout({ editorPanelCollapsed: false });
                }}
                className="mt-6 [writing-mode:vertical-lr] text-[10px] font-mono tracking-widest text-zinc-400 hover:text-zinc-200 cursor-pointer select-none"
              >
                EDITOR
              </div>
            </div>
          ) : activeFile && currentWorkspace ? (
            <WorkspaceEditor
              file={activeFile}
              workspace={currentWorkspace}
              onClose={() => setActiveFile(null)}
              onRunFile={handleRunFile}
              onFileSaved={handleFileMutation}
              className="w-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col bg-[#0E1117]">
              {/* Clean Empty State when no file is currently selected */}
              <div className="h-10 px-3 border-b border-white/10 flex items-center justify-between text-xs text-zinc-400 bg-[#131722]">
                <span className="font-mono">Editor</span>
                <button
                  onClick={() => {
                    setEditorPanelCollapsed(true);
                    saveLayout({ editorPanelCollapsed: true });
                  }}
                  className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Collapse Editor Panel"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <FileCode className="w-6 h-6 text-zinc-500" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-300 mb-1">No File Open</h4>
                <p className="text-[11px] text-zinc-500 max-w-[200px] leading-relaxed mb-4">
                  Select a file from the Explorer or create a new file to start editing.
                </p>
                <div className="flex flex-col gap-1.5 text-[10px] font-mono text-zinc-500">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">Alt+1</kbd>
                    <span>Toggle File Explorer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">Alt+2</kbd>
                    <span>Toggle Terminal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">Ctrl+K</kbd>
                    <span>Command Palette</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Touch Navigation Row (hidden on md and above) */}
      <MobileControls
        onSendKey={(key) => terminalHandlers.current?.sendInput(key)}
        onSendSpecial={(action) => {
          if (action === 'clear') {
            terminalHandlers.current?.clear();
          } else if (action === 'tab') {
            terminalHandlers.current?.sendInput('\t');
          } else if (action === 'esc') {
            terminalHandlers.current?.sendInput('\x1b');
          } else if (action === 'ctrl-c') {
            terminalHandlers.current?.sendInput('^C');
          } else if (action === 'ctrl-d') {
            terminalHandlers.current?.sendInput('\x04');
          }
        }}
      />

      {/* Bottom Telemetry & Status Bar */}
      <TerminalStatusBar
        session={currentSession}
        activeCommand={activeRunningCommand}
        onStopCommand={() => {
          fetch('/api/terminal/execute', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSession.sessionId, action: 'SIGINT' }),
          }).catch(() => {});
        }}
      />

      {/* Workspace Manager Modal */}
      <WorkspaceManagerModal
        isOpen={isWorkspaceManagerOpen}
        onClose={() => setIsWorkspaceManagerOpen(false)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={(id) => {
          setActiveWorkspaceId(id);
          setActiveFile(null);
          handleFileMutation();
        }}
        onWorkspacesChanged={fetchWorkspaces}
      />

      {/* Command Palette Modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        sessions={sessions}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onClearTerminal={() => terminalHandlers.current?.clear()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onExportWorkspace={handleExportWorkspace}
        onTriggerImportWorkspace={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.zip';
          input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file || !currentWorkspace) return;
            const formData = new FormData();
            formData.append('file', file);
            await fetch(
              `/api/workspaces/${encodeURIComponent(currentWorkspace.workspaceId)}/import?accountId=${encodeURIComponent(
                terminalAccount?.accountId || ''
              )}`,
              { method: 'POST', body: formData }
            );
            window.location.reload();
          };
          input.click();
        }}
        executionMode={executionMode}
        onToggleExecutionMode={() =>
          setExecutionMode((prev) => (prev === 'remote' ? 'local' : 'remote'))
        }
      />

      {/* Terminal Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newPartial) => setSettings((prev) => ({ ...prev, ...newPartial }))}
      />

      {/* Command History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRerunCommand={handleRerunCommand}
      />
    </div>
  );
}
