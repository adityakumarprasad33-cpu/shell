'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Save,
  Play,
  Hammer,
  Terminal,
  Plus,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Layers,
  Check,
  X,
  FileCode,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TerminalAuthGate } from '@/components/auth/TerminalAuthGate';
import {
  TerminalWorkspace,
  WorkspaceFile,
} from '@/lib/types/terminal';
import { identifyLanguage } from '@/lib/runtimes/language-registry';
import { safeFetchJson } from '@/lib/safe-json';
import { FileIcon } from '@/components/workspace/FileIcon';
import { LanguageSupportModal } from '@/components/workspace/LanguageSupportModal';

export default function EditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<TerminalWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);

  // New file inline creation state
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Universal Runtime Matrix modal
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  // Editor cursor position
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Fetch workspaces
  useEffect(() => {
    if (!user) return;
    const fetchWorkspaces = async () => {
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
          setActiveWorkspaceId(res.data.workspaces[0].workspaceId);
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
      const res = await safeFetchJson<{ files?: WorkspaceFile[] }>(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/files?accountId=${encodeURIComponent(user.uid)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok && res.data?.files) {
        setFiles(res.data.files);
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
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Discard and switch file?')) return;
    setActiveFile(file);
    setFileContent(file.content || '');
    setHasUnsavedChanges(false);
    setCursorPos({ line: 1, col: 1 });
  };

  // Save file
  const handleSave = async (): Promise<boolean> => {
    if (!user || !activeFile) return false;
    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/files?accountId=${encodeURIComponent(user.uid)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: activeFile.path, content: fileContent }),
        }
      );
      if (res.ok) {
        setHasUnsavedChanges(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
        // Refresh local file representation
        setFiles((prev) =>
          prev.map((f) => (f.path === activeFile.path ? { ...f, content: fileContent } : f))
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('Save failed:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Create new file
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFileName.trim()) return;
    const cleanPath = newFileName.trim().replace(/^[/\\]+/, '');
    try {
      const token = await user.getIdToken();
      const res = await safeFetchJson<{ file?: WorkspaceFile }>(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/files?accountId=${encodeURIComponent(user.uid)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: cleanPath, content: '' }),
        }
      );
      if (res.ok && res.data?.file) {
        setFiles((prev) => [...prev, res.data!.file!]);
        setActiveFile(res.data.file);
        setFileContent('');
        setHasUnsavedChanges(false);
        setIsCreatingFile(false);
        setNewFileName('');
      }
    } catch (err) {
      console.error('Create file failed:', err);
    }
  };

  // Delete file
  const handleDeleteFile = async (e: React.MouseEvent, file: WorkspaceFile) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm(`Are you sure you want to delete "${file.name}"?`)) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/files?path=${encodeURIComponent(file.path)}&accountId=${encodeURIComponent(user.uid)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.path !== file.path));
        if (activeFile?.path === file.path) {
          setActiveFile(null);
          setFileContent('');
          setHasUnsavedChanges(false);
        }
      }
    } catch (err) {
      console.error('Delete file failed:', err);
    }
  };

  // Run file in shell
  const handleRunInShell = async () => {
    if (!activeFile) return;
    if (hasUnsavedChanges) {
      await handleSave();
    }
    router.push(`/shell?file=${encodeURIComponent(activeFile.path)}&action=run`);
  };

  // Build file in shell
  const handleBuildInShell = async () => {
    if (!activeFile) return;
    if (hasUnsavedChanges) {
      await handleSave();
    }
    router.push(`/shell?file=${encodeURIComponent(activeFile.path)}&action=build`);
  };

  // Active language definition
  const activeLang = activeFile ? identifyLanguage(activeFile.name) : null;

  // Track cursor position
  const handleCursorMove = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value;
    const selStart = textareaRef.current.selectionStart;
    const lines = text.slice(0, selStart).split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Sync scroll between textarea and line numbers gutter
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, hasUnsavedChanges, fileContent]);

  const totalLines = fileContent.split('\n').length;

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

  const currentWorkspace = workspaces.find((w) => w.workspaceId === activeWorkspaceId) || workspaces[0];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090A0F] text-[#F3F4F6]">
      {/* Editor Top Bar */}
      <header className="h-12 border-b border-white/[0.08] bg-[#0A0D14] flex items-center justify-between px-4 shrink-0 shadow-md">
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
          {/* Universal Matrix / Runtimes button */}
          <button
            onClick={() => setIsMatrixOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 text-xs font-mono transition-all"
            title="View Supported Runtimes & Capabilities"
          >
            <Layers className="w-3.5 h-3.5 text-[#315EF7]" />
            <span className="hidden sm:inline">Runtimes</span>
          </button>

          {/* Capability-driven Build button */}
          {activeFile && activeLang?.buildCapability && (
            <button
              onClick={handleBuildInShell}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#315EF7]/15 hover:bg-[#315EF7]/30 border border-[#315EF7]/40 text-[#60A5FA] text-xs font-mono font-medium transition-all shadow-sm"
              title={`Build ${activeLang.displayName} in Terminal`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Build</span>
            </button>
          )}

          {/* Capability-driven Run button */}
          {activeFile && activeLang?.runCapability && (
            <button
              onClick={handleRunInShell}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-medium transition-all shadow-sm"
              title={`Save & Execute ${activeLang.displayName} in Terminal`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run</span>
            </button>
          )}

          {/* Save button */}
          {activeFile && (
            <button
              onClick={() => handleSave()}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-50 ${
                justSaved
                  ? 'bg-emerald-500 text-white'
                  : hasUnsavedChanges
                  ? 'bg-[#315EF7] hover:bg-[#244CD0] text-white shadow-md shadow-[#315EF7]/30'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.08]'
              }`}
              title="Save File (Ctrl+S)"
            >
              {justSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </>
              )}
            </button>
          )}

          {/* Jump to Shell terminal */}
          <Link
            href="/shell"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-mono transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shell</span>
          </Link>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Sidebar */}
        <aside className="w-60 border-r border-white/[0.08] bg-[#0A0D14] flex flex-col shrink-0 select-none">
          <div className="px-3.5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-[#315EF7]" />
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Explorer
              </span>
            </div>
            <button
              onClick={() => setIsCreatingFile(true)}
              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Create New File"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline File Creator Form */}
          {isCreatingFile && (
            <form onSubmit={handleCreateFile} className="p-2 border-b border-white/[0.06] bg-[#0F121C]">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. main.py, query.sql"
                  autoFocus
                  className="flex-1 bg-[#090A0F] border border-white/15 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#315EF7]"
                />
                <button
                  type="submit"
                  className="p-1 rounded bg-[#315EF7] text-white hover:bg-[#244CD0]"
                  title="Create"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFile(false);
                    setNewFileName('');
                  }}
                  className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}

          {/* Files List */}
          <div className="flex-1 overflow-y-auto py-1">
            {loadingFiles ? (
              <div className="px-3 py-4 text-[11px] text-zinc-500 font-mono">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-zinc-500 font-mono">
                No files in workspace.<br />
                Click + to create one.
              </div>
            ) : (
              files.map((file, fileIdx) => {
                const isActive = activeFile?.path === file.path;
                return (
                  <div
                    key={file.fileId ? `${file.fileId}-${fileIdx}` : `${file.path}-${fileIdx}`}
                    onClick={() => handleOpenFile(file)}
                    className={`group w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-mono cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#315EF7]/15 text-white border-l-2 border-[#315EF7]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FileIcon filename={file.name} size={15} />
                      <span className="truncate">{file.name}</span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteFile(e, file)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-opacity"
                      title="Delete file"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Back to Console link */}
          <div className="px-3 py-2.5 border-t border-white/[0.06] bg-[#0A0D14]">
            <Link
              href="/"
              className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-500" />
              <span>Back to Console</span>
            </Link>
          </div>
        </aside>

        {/* Main Editor Viewport */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#090A0F]">
          {activeFile ? (
            <>
              {/* File tab bar */}
              <div className="h-9 border-b border-white/[0.08] bg-[#0C0F16] flex items-center px-2 shrink-0 select-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-t bg-[#090A0F] border border-white/[0.08] border-b-0 text-xs font-mono text-zinc-200">
                  <FileIcon filename={activeFile.name} size={14} />
                  <span>{activeFile.name}</span>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" title="Unsaved changes" />
                  )}
                  <button
                    onClick={() => {
                      if (!hasUnsavedChanges || window.confirm('Discard unsaved changes?')) {
                        setActiveFile(null);
                        setFileContent('');
                        setHasUnsavedChanges(false);
                      }
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                    title="Close file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="ml-auto flex items-center gap-2.5 text-[11px] font-mono text-zinc-400 pr-2">
                  {activeLang && (
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                      {activeLang.displayName}
                    </span>
                  )}
                  <span className="hidden md:inline text-zinc-600">·</span>
                  <span className="hidden md:inline text-zinc-500">Ctrl+S to save</span>
                </div>
              </div>

              {/* Text area editor with line numbers gutter */}
              <div className="flex-1 relative flex overflow-hidden bg-[#090A0F]">
                {/* Line numbers gutter */}
                <div
                  ref={lineNumbersRef}
                  className="w-12 py-4 select-none text-right pr-3 font-mono text-xs text-zinc-600 bg-[#090A0F] border-r border-white/[0.04] overflow-hidden leading-relaxed shrink-0"
                >
                  {Array.from({ length: totalLines }).map((_, i) => (
                    <div
                      key={i + 1}
                      className={cursorPos.line === i + 1 ? 'text-[#315EF7] font-semibold' : ''}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Textarea code editor */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    onSelect={handleCursorMove}
                    onClick={handleCursorMove}
                    onKeyUp={handleCursorMove}
                    onScroll={handleScroll}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full bg-[#090A0F] text-zinc-200 text-xs font-mono p-4 leading-relaxed resize-none outline-none border-none selection:bg-[#315EF7]/30"
                    placeholder="// Write your code here..."
                  />
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-4 text-zinc-500">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">No file selected</h3>
              <p className="text-xs text-zinc-400 max-w-sm mb-4 leading-relaxed">
                Choose a file from the Explorer to edit code, or create a new file in your workspace.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreatingFile(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#315EF7] hover:bg-[#244CD0] text-white text-xs font-mono transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create File</span>
                </button>
                <button
                  onClick={() => setIsMatrixOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 text-xs font-mono transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-[#315EF7]" />
                  <span>View Supported Runtimes</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Status Bar */}
      <footer className="h-6 border-t border-white/[0.08] bg-[#0A0D14] flex items-center justify-between px-3 text-[10px] font-mono text-zinc-400 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Runix Core Connected
          </span>
          {activeFile && (
            <>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-300 truncate max-w-xs">{activeFile.path}</span>
              <span className="text-zinc-700">|</span>
              <span className="text-[#315EF7] font-semibold">{activeLang?.displayName || 'Plain Text'}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeFile && (
            <>
              <span>
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
              <span className="text-zinc-700">|</span>
              <span>{totalLines} lines</span>
              <span className="text-zinc-700">|</span>
              <span>{fileContent.length} chars</span>
              <span className="text-zinc-700">|</span>
            </>
          )}
          <span>UTF-8</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-300">Runix v2.4</span>
        </div>
      </footer>

      {/* Universal Runtime Matrix Modal */}
      <LanguageSupportModal
        isOpen={isMatrixOpen}
        onClose={() => setIsMatrixOpen(false)}
      />
    </div>
  );
}
