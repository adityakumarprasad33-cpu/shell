'use client';

import React, { useState } from 'react';
import { Zap, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { ReleaseItem } from '@/lib/types/terminal';

interface CliInstallProps {
  cliRelease?: ReleaseItem;
}

export function CliInstall({ cliRelease }: CliInstallProps) {
  const [activeTab, setActiveTab] = useState<'unix' | 'windows' | 'npm'>('unix');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const snippets = {
    unix: {
      label: 'Linux / macOS',
      command: 'curl -fsSL https://console.runix.in/install.sh | bash',
      shell: 'bash',
      desc: 'One-line shell installer. Detects CPU architecture (x64 / ARM64), downloads the release tarball, and installs the runix binary to /usr/local/bin.',
    },
    windows: {
      label: 'Windows (PowerShell)',
      command: 'irm https://console.runix.in/install.ps1 | iex',
      shell: 'powershell',
      desc: 'Native PowerShell installer. Downloads the Windows x64 binary and registers runix in your user PATH.',
    },
    npm: {
      label: 'Node Package Manager',
      command: 'npm install -g @runix/terminal',
      shell: 'npm',
      desc: 'Global npm package distribution with cross-platform wrapper and automatic updates.',
    },
  };

  const handleCopy = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const current = snippets[activeTab];

  return (
    <section className="mb-14 p-6 sm:p-8 rounded-2xl bg-[#0E1117] border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#315EF7]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-mono font-semibold tracking-wider text-amber-400 uppercase">
              Command Line Interface
            </span>
            {cliRelease && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                v{cliRelease.version}
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
            RUNIX CLI
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-4">
            Install Runix Terminal directly from your command line. Manage persistent cloud sessions,
            execute local workspace sandboxes, and authenticate via secure browser device tokens.
          </p>

          {/* Platform Tab Buttons */}
          <div className="flex items-center gap-2">
            {(Object.keys(snippets) as Array<'unix' | 'windows' | 'npm'>).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  activeTab === tab
                    ? 'bg-[#315EF7] text-white font-semibold shadow-sm'
                    : 'bg-[#090A0F] text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                {snippets[tab].label}
              </button>
            ))}
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="w-full lg:w-[480px] shrink-0">
          <div className="rounded-xl bg-[#090A0F] border border-white/10 overflow-hidden shadow-2xl">
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                <span>{current.shell}</span>
              </div>
              <button
                onClick={() => handleCopy(current.command, activeTab)}
                className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors"
                title="Copy installation command"
              >
                {copiedId === activeTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy command</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 font-mono text-xs overflow-x-auto">
              <div className="flex items-center gap-2 text-zinc-500 mb-1 select-none">
                <span>$</span>
                <span className="text-zinc-400 text-[11px]">{current.label} installation</span>
              </div>
              <div className="text-[#00E5FF] selection:bg-[#315EF7]/40 leading-relaxed break-all">
                {current.command}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/5 text-[11px] text-zinc-500 font-sans leading-normal">
              {current.desc}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
