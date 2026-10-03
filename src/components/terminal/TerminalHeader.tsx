'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  FolderGit2,
  ChevronDown,
  Download,
  Settings as SettingsIcon,
  History,
  Maximize2,
  Minimize2,
  LogOut,
  Command,
  Cloud,
  Laptop,
  FolderTree,
  Code2,
  LayoutGrid,
  Layers,
} from 'lucide-react';
import { TerminalSession, ExecutionMode, TerminalWorkspace } from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';

interface TerminalHeaderProps {
  sessions: TerminalSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onCloseSession: (id: string) => void;
  workspaces: TerminalWorkspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onOpenWorkspaceManager: () => void;
  executionMode: ExecutionMode;
  onToggleExecutionMode: () => void;
  filePanelCollapsed: boolean;
  onToggleFilePanel: () => void;
  terminalPanelCollapsed: boolean;
  onToggleTerminalPanel: () => void;
  editorPanelCollapsed: boolean;
  onToggleEditorPanel: () => void;
  focusMode: 'default' | 'terminal' | 'editor' | 'files';
  onSetFocusMode: (mode: 'default' | 'terminal' | 'editor' | 'files') => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenRuntimesMatrix?: () => void;
}

export function TerminalHeader({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  workspaces,
  activeWorkspaceId,
  onOpenWorkspaceManager,
  executionMode,
  onToggleExecutionMode,
  filePanelCollapsed,
  onToggleFilePanel,
  terminalPanelCollapsed,
  onToggleTerminalPanel,
  editorPanelCollapsed,
  onToggleEditorPanel,
  focusMode,
  onSetFocusMode,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenHistory,
  onOpenRuntimesMatrix,
}: TerminalHeaderProps) {
  const { user, terminalAccount, signOut } = useAuth();
  const activeWorkspace = workspaces.find((w) => w.workspaceId === activeWorkspaceId) || workspaces[0];

  return (
    <header className="h-12 border-b border-white/10 bg-[#0E1117] px-3 flex items-center justify-between select-none shrink-0 z-20">
      {/* Left: Brand + Workspaces + Session Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto auth-scroll max-w-[65%]">
        {/* Brand link */}
        <Link
          href="/"
          className="flex items-center gap-2 pr-2 border-r border-white/10 shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="relative w-5 h-5">
            <Image
              src="/logo-v2.png"
              alt="Runix"
              width={20}
              height={20}
              className="object-contain"
            />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white hidden sm:inline">
            Runix <span className="text-[#315EF7] font-mono text-xs">TERM</span>
          </span>
        </Link>

        {/* Real Workspace Manager Selector (Section 12 & 13) */}
        <button
          onClick={onOpenWorkspaceManager}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#315EF7]/40 text-xs text-zinc-200 transition-all shrink-0 group"
          title="Open Workspace Manager (+ New, Rename, Delete, Switch)"
          id="workspace-manager-trigger"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-[#315EF7]" />
          <span className="font-medium max-w-[130px] truncate">{activeWorkspace?.name || 'Workspace'}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-white transition-transform" />
        </button>

        {/* Session Tabs */}
        <div className="flex items-center gap-1">
          {sessions.map((sess) => {
            const isActive = sess.sessionId === activeSessionId;
            return (
              <div
                key={sess.sessionId}
                onClick={() => onSelectSession(sess.sessionId)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1A1F2C] text-white border border-white/15 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#10B981]' : 'bg-zinc-600'}`} />
                <span className="font-mono truncate max-w-[90px]">{sess.title}</span>
                {sessions.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseSession(sess.sessionId);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                    title="Close session"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={onCreateSession}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Create new terminal session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Controls: Panel Toggles, Focus Modes, Download, Actions */}
      <div className="flex items-center gap-2">
        {/* IDE Panel Quick Toggles (Section 2 & 9) */}
        <div className="hidden lg:flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs">
          <button
            onClick={onToggleFilePanel}
            className={`p-1 rounded transition-colors ${
              !filePanelCollapsed ? 'bg-[#315EF7]/20 text-[#315EF7]' : 'text-zinc-400 hover:text-white'
            }`}
            title={filePanelCollapsed ? 'Restore Files Panel (Alt+1)' : 'Collapse Files Panel (Alt+1)'}
          >
            <FolderTree className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleTerminalPanel}
            className={`p-1 rounded transition-colors ${
              !terminalPanelCollapsed ? 'bg-[#315EF7]/20 text-[#315EF7]' : 'text-zinc-400 hover:text-white'
            }`}
            title={terminalPanelCollapsed ? 'Restore Terminal Panel (Alt+2)' : 'Collapse Terminal Panel (Alt+2)'}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleEditorPanel}
            className={`p-1 rounded transition-colors ${
              !editorPanelCollapsed ? 'bg-[#315EF7]/20 text-[#315EF7]' : 'text-zinc-400 hover:text-white'
            }`}
            title={editorPanelCollapsed ? 'Restore Editor Panel (Alt+3)' : 'Collapse Editor Panel (Alt+3)'}
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Focus Mode Selector (Section 7) */}
        {focusMode !== 'default' ? (
          <button
            onClick={() => onSetFocusMode('default')}
            className="px-2 py-0.5 rounded bg-[#315EF7] text-white text-[11px] font-mono flex items-center gap-1 shadow-sm"
            title="Restore 3-Panel IDE Layout"
          >
            <LayoutGrid className="w-3 h-3" />
            <span>RESTORE</span>
          </button>
        ) : (
          <button
            onClick={() => onSetFocusMode('terminal')}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors hidden sm:block"
            title="Focus Mode: Fullscreen Terminal"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Execution Mode Toggle */}
        <button
          onClick={onToggleExecutionMode}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-all ${
            executionMode === 'remote'
              ? 'bg-[#315EF7]/15 text-[#315EF7] border border-[#315EF7]/30 hover:bg-[#315EF7]/25'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
          }`}
          title="Toggle execution mode (Remote Cloud Sandbox vs Local OS Host)"
        >
          {executionMode === 'remote' ? (
            <>
              <Cloud className="w-3 h-3" />
              <span>REMOTE</span>
            </>
          ) : (
            <>
              <Laptop className="w-3 h-3" />
              <span>LOCAL</span>
            </>
          )}
        </button>

        {/* Universal Runtime Matrix Trigger */}
        {onOpenRuntimesMatrix && (
          <button
            onClick={onOpenRuntimesMatrix}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-[#315EF7]/40 transition-all font-mono"
            title="Universal Runtime Matrix (C++20 Core)"
          >
            <Layers className="w-3.5 h-3.5 text-[#315EF7]" />
            <span className="text-[11px]">Runtimes</span>
          </button>
        )}

        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all"
          title="Command Palette (Ctrl+K)"
        >
          <Command className="w-3 h-3" />
          <span className="text-[11px] font-mono">⌘K</span>
        </button>

        {/* Download Link */}
        <Link
          href="/download"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-[#315EF7] text-white text-xs font-medium transition-colors border border-white/10"
          title="Official Runix Terminal Download Page"
        >
          <Download className="w-3.5 h-3.5 text-[#315EF7] group-hover:text-white" />
          <span className="hidden sm:inline">Download</span>
        </Link>

        {/* Command History Drawer Trigger */}
        <button
          onClick={onOpenHistory}
          className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Command History"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Settings Modal Trigger */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Terminal Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* Account / User Menu */}
        {user ? (
          <div className="flex items-center gap-1 pl-1 border-l border-white/10">
            <span
              className="text-xs font-mono text-zinc-300 max-w-[80px] truncate hidden md:inline"
              title={terminalAccount?.email || user.email || ''}
            >
              {terminalAccount?.displayName || user.email?.split('@')[0]}
            </span>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="px-2.5 py-1 rounded bg-[#315EF7] text-white text-xs font-medium hover:bg-[#244CD0] transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
