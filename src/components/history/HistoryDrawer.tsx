'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Trash2,
  Copy,
  Play,
  Check,
  X,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { TerminalCommandRecord } from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRerunCommand: (cmd: string) => void;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  onRerunCommand,
}: HistoryDrawerProps) {
  const { user, terminalAccount } = useAuth();
  const [history, setHistory] = useState<TerminalCommandRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadHistory = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const res = await fetch(
        `/api/history?accountId=${encodeURIComponent(terminalAccount?.accountId || '')}&q=${encodeURIComponent(
          searchQuery
        )}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [isOpen, searchQuery]);

  const handleCopy = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      const token = user ? await user.getIdToken() : '';
      await fetch(
        `/api/history?id=${encodeURIComponent(id)}&accountId=${encodeURIComponent(
          terminalAccount?.accountId || ''
        )}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setHistory((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete history error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all command history from server? This cannot be undone.')) return;
    try {
      const token = user ? await user.getIdToken() : '';
      await fetch(
        `/api/history?all=true&accountId=${encodeURIComponent(terminalAccount?.accountId || '')}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setHistory([]);
    } catch (err) {
      console.error('Clear all history error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-[#0E1117] border-l border-white/10 shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between bg-[#131722]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#315EF7]" />
          <span className="font-semibold text-sm text-white">Command History</span>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-zinc-400 hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              title="Clear all persistent history"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-white/10 bg-[#090A0F]">
        <div className="flex items-center px-2.5 py-1.5 rounded bg-white/5 border border-white/10 gap-2">
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search executed commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none font-mono"
          />
        </div>
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto auth-scroll p-3 space-y-2">
        {history.length === 0 && !loading && (
          <div className="text-center py-12 text-xs text-zinc-500 font-mono">
            No command history found. Commands run in terminal will persist here.
          </div>
        )}

        {history.map((record) => (
          <div
            key={record.id}
            className="p-2.5 rounded bg-[#131722] border border-white/5 hover:border-white/15 transition-all group"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-medium ${
                    record.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {record.status}
                </span>

                {record.secretDetected && (
                  <span
                    className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    title="Credentials in this command were automatically sanitized before storage"
                  >
                    <ShieldAlert className="w-2.5 h-2.5" />
                    <span>Secret Masked</span>
                  </span>
                )}

                <span className="text-[10px] font-mono text-zinc-500">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onRerunCommand(record.command)}
                  className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                  title="Rerun command in terminal"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
                <button
                  onClick={() => handleCopy(record.command, record.id)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Copy command"
                >
                  {copiedId === record.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => handleDeleteRecord(record.id)}
                  className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                  title="Delete from history"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <code className="block text-xs font-mono text-zinc-200 break-all bg-[#090A0F] p-1.5 rounded border border-white/5">
              {record.command}
            </code>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="h-7 px-4 border-t border-white/10 bg-[#090A0F] flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>Persistent Firestore Log</span>
        <span>Secret-Aware Redaction</span>
      </div>
    </div>
  );
}
