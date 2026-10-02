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
import Image from 'next/image';
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
      fileCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');

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

  // UI state
  const [terminalOnlyMode, setTerminalOnlyMode] = useState(false);
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

  // Fetch workspaces for current account
  useEffect(() => {
    if (!user) return;
    const fetchWorkspaces = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/workspaces?accountId=${encodeURIComponent(user.uid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.workspaces && data.workspaces.length > 0) {
            setWorkspaces(data.workspaces);
            setActiveWorkspaceId(data.workspaces[0].workspaceId);
          }
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      }
    };
    fetchWorkspaces();
  }, [user]);

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
    terminalHandlers.current.focus();
    const commandToRun = action.startsWith('runix ') ? action : `runix run "${action}"`;
    terminalHandlers.current.runCommand(commandToRun);
  };

  // Rerun command from history
  const handleRerunCommand = (cmd: string) => {
    if (terminalHandlers.current) {
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
        onSelectWorkspace={setActiveWorkspaceId}
        executionMode={executionMode}
        onToggleExecutionMode={() =>
          setExecutionMode((prev) => (prev === 'remote' ? 'local' : 'remote'))
        }
        terminalOnlyMode={terminalOnlyMode}
        onToggleTerminalOnly={() => setTerminalOnlyMode((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Center Body (Workspace Explorer + Terminal Viewport + Editor) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Workspace File Explorer (collapsible in terminalOnlyMode) */}
        {!terminalOnlyMode && currentWorkspace && (
          <WorkspaceExplorer
            workspace={currentWorkspace}
            onOpenFile={setActiveFile}
            activeFilePath={activeFile?.path}
            refreshTrigger={fileRefreshKey}
          />
        )}

        {/* Center: Real Terminal XTerm Canvas */}
        <main className="flex-1 h-full relative flex flex-col min-w-0 bg-[#090A0F]">
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

        {/* Slide-over Workspace File Editor */}
        {activeFile && currentWorkspace && (
          <WorkspaceEditor
            file={activeFile}
            workspace={currentWorkspace}
            onClose={() => setActiveFile(null)}
            onRunFile={handleRunFile}
            onFileSaved={handleFileMutation}
          />
        )}
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
