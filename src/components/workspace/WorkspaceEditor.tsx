'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, Play, FileCode, Check, AlertCircle, Hammer } from 'lucide-react';
import { WorkspaceFile, TerminalWorkspace } from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';
import { FileCapabilityState } from '@/lib/runtimes/capability-resolver';
import { identifyLanguage } from '@/lib/runtimes/language-registry';
import { safeFetchJson } from '@/lib/safe-json';
import { FileIcon } from './FileIcon';

interface WorkspaceEditorProps {
  file: WorkspaceFile | null;
  workspace: TerminalWorkspace;
  onClose: () => void;
  onRunFile?: (path: string) => void;
  onFileSaved?: (file: WorkspaceFile) => void;
  className?: string;
}

export function WorkspaceEditor({
  file,
  workspace,
  onClose,
  onRunFile,
  onFileSaved,
  className = '',
}: WorkspaceEditorProps) {
  const { user, terminalAccount } = useAuth();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<FileCapabilityState | null>(null);

  // Synchronously compute initial language and fetch verified capability state from central API
  useEffect(() => {
    if (!file) {
      setCapabilities(null);
      return;
    }

    // Immediate optimistic initial state from central language registry
    const lang = identifyLanguage(file.name);
    setCapabilities({
      filename: file.name,
      fileType: lang.type,
      languageId: lang.languageId,
      languageName: lang.displayName,
      editorLanguage: lang.editorLanguage,
      category: lang.category,
      runtimeId: lang.runtimeId,
      runtimeAvailable: false,
      verificationStatus: 'CHECKING',
      capabilities: {
        run: false,
        build: false,
        debug: false,
        test: false,
        stdin: lang.stdinCapability,
        stdout: lang.stdoutCapability,
        stderr: lang.stderrCapability,
        multiFile: lang.multiFileCapability,
        packages: lang.packageCapability,
        network: lang.networkCapability,
      },
      isRunnable: lang.runCapability,
    });

    let active = true;
    safeFetchJson<FileCapabilityState>(
      `/api/capabilities?file=${encodeURIComponent(file.name)}&workspaceId=${encodeURIComponent(workspace.workspaceId)}`
    ).then((result) => {
      if (active && result.ok && result.data && !('error' in result.data)) {
        setCapabilities(result.data);
      }
    });

    return () => {
      active = false;
    };
  }, [file?.name, workspace.workspaceId]);

  useEffect(() => {
    if (!file) return;

    // Load fresh file content from API
    const loadContent = async () => {
      try {
        const token = user ? await user.getIdToken() : '';
        const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');
        const result = await safeFetchJson<{ file?: WorkspaceFile }>(
          `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files?path=${encodeURIComponent(
            file.path
          )}&accountId=${encodeURIComponent(accountId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (result.ok && result.data?.file) {
          setContent(result.data.file.content ?? file.content ?? '');
        } else {
          setContent(file.content ?? '');
        }
      } catch {
        setContent(file.content ?? '');
      }
    };

    loadContent();
  }, [file, workspace, user, terminalAccount]);

  const handleSave = async (): Promise<boolean> => {
    if (!file) return false;
    setIsSaving(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');
      const result = await safeFetchJson<{ file?: WorkspaceFile; message?: string; error?: string }>(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            accountId,
            path: file.path,
            content,
          }),
        }
      );
      if (result.ok) {
        setSaveError(null);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        onFileSaved?.(result.data?.file || { ...file, content });
        return true;
      } else {
        setSaveError(result.error || result.data?.message || 'Save failed');
        return false;
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveError(err.message || 'Network error during save');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, file]);

  if (!file) return null;

  return (
    <div className={`border-l border-white/10 bg-[#0E1117] flex flex-col h-full shrink-0 select-none z-10 animate-in slide-in-from-right-4 duration-200 ${className || 'w-96'}`}>
      {/* Editor Header */}
      <div className="h-10 px-3 border-b border-white/10 flex items-center justify-between bg-[#131722]">
        <div className="flex items-center gap-2 truncate">
          <FileIcon filename={file.name} size={15} />
          <span className="font-mono text-xs text-white font-medium truncate">{file.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Universal Capability-Driven Run Button */}
          {onRunFile && capabilities?.capabilities.run && (
            <button
              onClick={async () => {
                await handleSave();
                onRunFile(file.path);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-400 text-xs font-mono font-medium transition-colors"
              title={`Save & Run ${capabilities.languageName} in terminal`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Run</span>
            </button>
          )}

          {/* Capability-Driven Build Button */}
          {onRunFile && capabilities?.capabilities.build && (
            <button
              onClick={async () => {
                await handleSave();
                onRunFile(`runix build "${file.path}"`);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/35 text-blue-400 text-xs font-mono font-medium transition-colors"
              title={`Build ${capabilities.languageName}`}
            >
              <Hammer className="w-3 h-3" />
              <span>Build</span>
            </button>
          )}

          {/* Truthful Runtime Status when Runnable but Runtime is Unavailable */}
          {capabilities?.isRunnable && !capabilities?.capabilities.run && capabilities?.verificationStatus !== 'CHECKING' && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono cursor-help"
              title={capabilities.statusReason || `${capabilities.languageName} runtime is unavailable in current environment.`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Runtime unavailable</span>
            </span>
          )}

          {/* Limit / Save Error Badge */}
          {saveError && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-mono truncate max-w-[140px]"
              title={saveError}
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{saveError}</span>
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#315EF7] hover:bg-[#244CD0] text-white text-xs font-medium transition-colors"
            title="Save file (Ctrl+S)"
          >
            {isSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            <span>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Close Editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Textarea */}
      <div className="flex-1 relative bg-[#090A0F]">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="w-full h-full p-3 bg-transparent text-zinc-200 font-mono text-xs leading-relaxed outline-none resize-none auth-scroll"
          placeholder="Type or paste code here..."
        />
      </div>

      {/* Editor Footer — Exposing Real File Intelligence */}
      <div className="h-6 px-3 border-t border-white/10 bg-[#090A0F] flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-2 truncate max-w-[220px]">
          <span className="text-zinc-300 font-medium">{capabilities?.languageName || 'File'}</span>
          {capabilities?.runtimeVersion && (
            <>
              <span>·</span>
              <span className="text-zinc-500 truncate">{capabilities.runtimeVersion}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span>{content.split('\n').length} lines</span>
          <span>Ctrl+S to save</span>
        </div>
      </div>
    </div>
  );
}
