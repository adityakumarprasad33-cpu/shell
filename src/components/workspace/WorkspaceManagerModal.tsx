'use client';

import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { TerminalWorkspace } from '@/lib/types/terminal';
import { safeFetchJson } from '@/lib/safe-json';
import { useAuth } from '@/lib/auth-context';

interface WorkspaceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: TerminalWorkspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onWorkspacesChanged: () => Promise<void>;
}

export const WorkspaceManagerModal: React.FC<WorkspaceManagerModalProps> = ({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onWorkspacesChanged,
}) => {
  const { user, terminalAccount } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      const res = await safeFetchJson<{ workspace: TerminalWorkspace }>(
        '/api/workspaces',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ accountId, name }),
        }
      );

      if (!res.ok || !res.data?.workspace) {
        setErrorMessage(res.error || 'Failed to create workspace.');
      } else {
        setNewWorkspaceName('');
        setIsCreating(false);
        await onWorkspacesChanged();
        onSelectWorkspace(res.data.workspace.workspaceId);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRename = async (workspaceId: string) => {
    const name = renameInput.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      const res = await safeFetchJson(
        '/api/workspaces',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ accountId, workspaceId, name }),
        }
      );

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to rename workspace.');
      } else {
        setRenamingId(null);
        await onWorkspacesChanged();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error renaming workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    if (workspaces.length <= 1) {
      setErrorMessage('Cannot delete the only remaining workspace.');
      setDeletingId(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      const res = await safeFetchJson(
        `/api/workspaces?workspaceId=${encodeURIComponent(workspaceId)}&accountId=${encodeURIComponent(accountId)}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to delete workspace.');
      } else {
        setDeletingId(null);
        await onWorkspacesChanged();
        if (activeWorkspaceId === workspaceId) {
          const fallback = workspaces.find((w) => w.workspaceId !== workspaceId);
          if (fallback) {
            onSelectWorkspace(fallback.workspaceId);
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error deleting workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletingWs = workspaces.find((w) => w.workspaceId === deletingId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#11141C] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F3F4F6] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#315EF7]/15 border border-[#315EF7]/30 flex items-center justify-center text-[#315EF7]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-white">Workspaces</h2>
              <p className="text-[11px] text-zinc-400">Manage isolated development environments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Workspaces List */}
        <div className="p-4 max-h-72 overflow-y-auto space-y-1.5 auth-scroll">
          {workspaces.map((ws) => {
            const isActive = ws.workspaceId === activeWorkspaceId;
            const isEditing = renamingId === ws.workspaceId;

            return (
              <div
                key={ws.workspaceId}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-[#315EF7]/10 border-[#315EF7]/40 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-zinc-300'
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(ws.workspaceId);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      autoFocus
                      className="flex-1 bg-black/40 border border-[#315EF7] rounded px-2 py-1 text-xs text-white outline-none font-mono"
                    />
                    <button
                      onClick={() => handleRename(ws.workspaceId)}
                      disabled={isSubmitting}
                      className="p-1 rounded bg-[#315EF7] text-white hover:bg-[#2748C4]"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onSelectWorkspace(ws.workspaceId);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                  >
                    <FolderGit2
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#315EF7]' : 'text-zinc-500'}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs truncate">{ws.name}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#315EF7]/20 text-[#315EF7] border border-[#315EF7]/30">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono block truncate">
                        ID: {ws.workspaceId}
                      </span>
                    </div>
                  </button>
                )}

                {/* Actions */}
                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setRenamingId(ws.workspaceId);
                        setRenameInput(ws.name);
                      }}
                      className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Rename workspace"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        onClick={() => setDeletingId(ws.workspaceId)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Delete Confirmation Dialog */}
        {deletingId && deletingWs && (
          <div className="m-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white">Delete Workspace &quot;{deletingWs.name}&quot;?</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  All files, folders, and history within this workspace will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => setDeletingId(null)}
                disabled={isSubmitting}
                className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={isSubmitting}
                className="px-2.5 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}

        {/* Footer: Create Workspace Form or Button */}
        <div className="p-4 border-t border-white/10 bg-white/[0.01]">
          {isCreating ? (
            <form onSubmit={handleCreate} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. embedded-lab, cpp-project"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  autoFocus
                  required
                  className="flex-1 bg-black/40 border border-white/15 focus:border-[#315EF7] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewWorkspaceName('');
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newWorkspaceName.trim()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#315EF7] hover:bg-[#2748C4] text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => {
                setIsCreating(true);
                setErrorMessage(null);
              }}
              className="w-full py-2 px-3 rounded-lg border border-dashed border-white/15 hover:border-[#315EF7]/60 hover:bg-[#315EF7]/5 text-xs text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#315EF7]" />
              <span>New Workspace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
