'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Terminal,
  FolderPlus,
  FolderGit2,
  History,
  Download,
  Upload,
  RefreshCw,
  Settings,
  Trash2,
  Laptop,
  Cloud,
  X,
} from 'lucide-react';
import { TerminalSession, ExecutionMode } from '@/lib/types/terminal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: TerminalSession[];
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onClearTerminal: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onExportWorkspace: () => void;
  onTriggerImportWorkspace: () => void;
  executionMode: ExecutionMode;
  onToggleExecutionMode: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onCreateSession,
  onClearTerminal,
  onOpenSettings,
  onOpenHistory,
  onExportWorkspace,
  onTriggerImportWorkspace,
  executionMode,
  onToggleExecutionMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  // Keyboard shortcut listener (Cmd+K / Ctrl+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'download-runix',
      name: 'Download Runix Terminal Desktop & CLI',
      category: 'Distribution',
      icon: Download,
      run: () => {
        router.push('/download');
        onClose();
      },
    },
    {
      id: 'create-session',
      name: 'Create New Terminal Session',
      category: 'Sessions',
      icon: Terminal,
      run: () => {
        onCreateSession();
        onClose();
      },
    },
    {
      id: 'clear-terminal',
      name: 'Clear Terminal Screen',
      category: 'Terminal',
      icon: Trash2,
      run: () => {
        onClearTerminal();
        onClose();
      },
    },
    {
      id: 'toggle-mode',
      name: `Switch Execution Mode to ${executionMode === 'remote' ? 'LOCAL' : 'REMOTE'}`,
      category: 'Environment',
      icon: executionMode === 'remote' ? Laptop : Cloud,
      run: () => {
        onToggleExecutionMode();
        onClose();
      },
    },
    {
      id: 'search-history',
      name: 'Search Command History',
      category: 'History',
      icon: History,
      run: () => {
        onOpenHistory();
        onClose();
      },
    },
    {
      id: 'export-workspace',
      name: 'Export Workspace as ZIP Archive',
      category: 'Workspace',
      icon: Download,
      run: () => {
        onExportWorkspace();
        onClose();
      },
    },
    {
      id: 'import-workspace',
      name: 'Import Workspace Archive (.zip)',
      category: 'Workspace',
      icon: Upload,
      run: () => {
        onTriggerImportWorkspace();
        onClose();
      },
    },
    {
      id: 'terminal-settings',
      name: 'Terminal Preferences & Fonts',
      category: 'Settings',
      icon: Settings,
      run: () => {
        onOpenSettings();
        onClose();
      },
    },
  ];

  // Also include switching directly to active sessions
  sessions.forEach((s) => {
    actions.push({
      id: `switch-session-${s.sessionId}`,
      name: `Switch to Session: ${s.title} (${s.shell})`,
      category: 'Active Sessions',
      icon: Terminal,
      run: () => {
        onSelectSession(s.sessionId);
        onClose();
      },
    });
  });

  const filtered = actions.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-xl bg-[#0E1117] border border-white/15 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-white/10 gap-3">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-mono"
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="max-h-80 overflow-y-auto auth-scroll py-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              No actions matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.run}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/5 active:bg-[#315EF7]/20 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-white/5 group-hover:bg-[#315EF7]/20 text-zinc-300 group-hover:text-[#315EF7] transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm text-zinc-200 group-hover:text-white block font-medium">
                        {action.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-2 py-0.5 rounded bg-white/5">
                    {action.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[#090A0F] border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Navigate with arrows or type</span>
          <span>[ESC] to close</span>
        </div>
      </div>
    </div>
  );
}
