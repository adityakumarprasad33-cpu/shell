'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FileText,
  FolderOpen,
  Save,
  Play,
  Terminal,
  Plus,
  Trash2,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TerminalAuthGate } from '@/components/auth/TerminalAuthGate';
import {
  TerminalWorkspace,
  WorkspaceFile,
} from '@/lib/types/terminal';
import { identifyLanguage } from '@/lib/runtimes/language-registry';

export default function EditorPage() {
  const { user, terminalAccount, loading } = useAuth();

  const [workspaces, setWorkspaces] = useState<TerminalWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);

  // Fetch workspaces
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
          if (data.workspaces?.length > 0) {
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

  // Fetch files for active workspace
  const fetchFiles = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    setLoadingFiles(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/files?accountId=${encodeURIComponent(user.uid)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Open file
  const handleOpenFile = async (file: WorkspaceFile) => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Continue?')) return;
    setActiveFile(file);
    setFileContent(file.content || '');
    setHasUnsavedChanges(false);
  };

  // Save file
  const handleSave = async () => {
    if (!user || !activeFile) return;
    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      await fetch(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/files?accountId=${encodeURIComponent(user.uid)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: activeFile.path, content: fileContent }),
        }
      );
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get file language hint for syntax from central registry
  const getLanguageLabel = (filename: string) => {
    return identifyLanguage(filename).displayName;
  };

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && hasUnsavedChanges) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, hasUnsavedChanges, fileContent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080C] text-[#F3F4F6] flex flex-col items-center justify-center p-4 font-mono select-none">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-8 h-8">
            <Image src="/logo-v2.png" alt="Runix" width={32} height={32} className="object-contain animate-pulse" />
          </div>
          <span className="font-bold tracking-wider text-sm text-zinc-200">RUNIX EDITOR</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>LOADING WORKSPACE...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <TerminalAuthGate />;
  }

  const currentWorkspace = workspaces.find(w => w.workspaceId === activeWorkspaceId) || workspaces[0];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090A0F] text-[#F3F4F6]">
      {/* Editor Top Bar */}
      <header className="h-11 border-b border-white/[0.06] bg-[#0A0D14] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="relative w-5 h-5">
              <Image src="/logo-v2.png" alt="Runix" width={20} height={20} className="object-contain" />
            </div>
            <span className="font-bold text-xs tracking-tight text-white font-mono">RUNIX</span>
          </Link>
          <span className="text-zinc-600 text-[10px] font-mono">EDITOR</span>
          {currentWorkspace && (
            <>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <span className="text-[11px] font-mono text-zinc-400">{currentWorkspace.name}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFile && hasUnsavedChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#315EF7] hover:bg-[#244CD0] text-white text-[11px] font-mono transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
          <Link
            href="/shell"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[11px] font-mono transition-colors"
          >
            <Terminal className="w-3 h-3" />
            Terminal
          </Link>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Sidebar */}
        <aside className="w-56 border-r border-white/[0.06] bg-[#0A0D14] flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Files</span>
            <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {loadingFiles ? (
              <div className="px-3 py-4 text-[11px] text-zinc-500 font-mono">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-zinc-500 font-mono">No files in workspace</div>
            ) : (
              files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleOpenFile(file)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-mono transition-colors ${
                    activeFile?.path === file.path
                      ? 'bg-[#315EF7]/10 text-[#315EF7] border-l-2 border-[#315EF7]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              ))
            )}
          </div>

          {/* Back to home link */}
          <div className="px-3 py-2 border-t border-white/[0.04]">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Console
            </Link>
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#090A0F]">
          {activeFile ? (
            <>
              {/* File tab bar */}
              <div className="h-8 border-b border-white/[0.06] bg-[#0C0F16] flex items-center px-2 shrink-0">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-t bg-[#090A0F] border border-white/[0.06] border-b-0 text-[11px] font-mono text-zinc-300">
                  <FileText className="w-3 h-3 text-zinc-500" />
                  {activeFile.name}
                  {hasUnsavedChanges && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1" />}
                </div>
                <div className="ml-auto flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                  <span>{getLanguageLabel(activeFile.name)}</span>
                  <span>·</span>
                  <span>Ctrl+S to save</span>
                </div>
              </div>

              {/* Text area editor */}
              <div className="flex-1 relative">
                <textarea
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full bg-[#090A0F] text-zinc-200 text-xs font-mono p-4 leading-relaxed resize-none outline-none border-none selection:bg-[#315EF7]/30"
                  placeholder="// Start typing..."
                />
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-zinc-500" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">No file open</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                Select a file from the sidebar to view and edit it, or open the terminal to create new files.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <div className="h-6 border-t border-white/[0.06] bg-[#0A0D14] flex items-center px-3 text-[10px] font-mono text-zinc-500 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Connected
        </span>
        {activeFile && (
          <>
            <span className="mx-3 text-zinc-700">|</span>
            <span>{activeFile.path}</span>
            <span className="mx-3 text-zinc-700">|</span>
            <span>{getLanguageLabel(activeFile.name)}</span>
          </>
        )}
        <span className="ml-auto">Runix Editor</span>
      </div>
    </div>
  );
}
