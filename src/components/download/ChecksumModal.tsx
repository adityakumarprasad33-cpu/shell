'use client';

import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck } from 'lucide-react';
import { ReleaseItem } from '@/lib/types/terminal';

interface ChecksumModalProps {
  release: ReleaseItem | null;
  onClose: () => void;
}

export function ChecksumModal({ release, onClose }: ChecksumModalProps) {
  const [copied, setCopied] = useState(false);

  if (!release) return null;

  const rawHash = release.checksum.replace(/^sha256:/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(rawHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0E1117] border border-white/15 rounded-2xl shadow-2xl p-6 sm:p-7 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">SHA-256 Verification</h3>
              <p className="text-xs font-mono text-zinc-400">{release.filename}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mb-2">
          Official SHA-256 cryptographic hash published by Runix infrastructure:
        </p>

        <div className="p-3.5 rounded-xl bg-[#090A0F] border border-white/10 font-mono text-xs text-emerald-400 break-all select-all flex items-start justify-between gap-3 mb-4">
          <span>{rawHash}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors shrink-0"
            title="Copy checksum"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-400 space-y-2 bg-white/[0.02] p-3.5 rounded-xl border border-white/5 mb-5">
          <div>
            <span className="text-zinc-300 font-semibold block mb-0.5">Windows (PowerShell):</span>
            <code className="text-zinc-400 select-all">Get-FileHash {release.filename} -Algorithm SHA256</code>
          </div>
          <div>
            <span className="text-zinc-300 font-semibold block mb-0.5">Linux / macOS:</span>
            <code className="text-zinc-400 select-all">sha256sum {release.filename}</code>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
