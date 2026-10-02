'use client';

import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { ReleaseItem } from '@/lib/types/terminal';

interface VerificationSectionProps {
  releases: ReleaseItem[];
  onSelectRelease: (release: ReleaseItem) => void;
}

export function VerificationSection({ releases, onSelectRelease }: VerificationSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const verifyCommands = [
    {
      platform: 'Windows (PowerShell)',
      command: 'Get-FileHash .\\RunixTerminal.exe -Algorithm SHA256',
    },
    {
      platform: 'CLI (npm package)',
      command: 'npm view @runix/terminal dist.shasum',
    },
    {
      platform: 'Linux / macOS',
      command: 'sha256sum RunixTerminal.exe',
    },
  ];

  return (
    <section className="mb-14 p-6 sm:p-8 rounded-2xl bg-[#0E1117] border border-white/10 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            VERIFY YOUR DOWNLOAD
          </h2>
          <p className="text-xs text-zinc-400 font-mono">
            Cryptographic SHA-256 integrity verification
          </p>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl mb-6">
        Compare the cryptographic SHA-256 hash of the downloaded binary with the official values
        published below to guarantee your installation file has not been tampered with or corrupted during transfer.
      </p>

      {/* Platform commands grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
        {verifyCommands.map((item, idx) => (
          <div key={idx} className="p-3.5 rounded-xl bg-[#090A0F] border border-white/5 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
              <span>{item.platform}</span>
              <button
                onClick={() => handleCopy(item.command, `cmd-${idx}`)}
                className="hover:text-white transition-colors"
                title="Copy verification command"
              >
                {copiedKey === `cmd-${idx}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                )}
              </button>
            </div>
            <code className="text-zinc-300 break-all select-all block text-[11px]">
              {item.command}
            </code>
          </div>
        ))}
      </div>

      {/* Release checksums table */}
      <div>
        <h3 className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-3">
          Official Release Checksums (v0.1.0)
        </h3>

        <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5 bg-[#090A0F]">
          {releases
            .filter((r) => r.status === 'available')
            .map((release) => {
              const rawHash = release.checksum.replace(/^sha256:/, '');
              return (
                <div
                  key={release.releaseId}
                  className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-white font-mono min-w-[200px]">
                      {release.filename}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 hidden md:inline">
                      {release.architecture}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-emerald-400/90 truncate max-w-[240px] sm:max-w-[320px]">
                      {rawHash}
                    </code>
                    <button
                      onClick={() => handleCopy(rawHash, release.releaseId)}
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Copy full SHA-256 hash"
                    >
                      {copiedKey === release.releaseId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
}
