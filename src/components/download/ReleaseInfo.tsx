'use client';

import React from 'react';
import { Sparkles, ShieldCheck, Check, FileText, GitCommit, ExternalLink } from 'lucide-react';

export function ReleaseInfo() {
  const highlights = [
    'GPU-accelerated terminal canvas rendering with sub-millisecond input latency',
    'Isolated execution sandboxes with zero-trust token authentication',
    'Unified workspace file synchronization between local desktop and cloud runtimes',
    'Multi-tab persistent terminal sessions with background daemon process tracking',
    'Real-time output streaming with full ANSI color palette and VT100/Xterm emulation',
    'Automated secret redacting and command sanitation for API keys and credentials',
  ];

  return (
    <section id="releases" className="mb-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-mono font-semibold tracking-wider text-emerald-400 uppercase">
            Changelog & Integrity
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            Latest Stable Release
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold">
            v0.1.0 OFFICIAL
          </span>
          <span className="text-xs font-mono text-zinc-500">October 2, 2026</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Release Notes Main Box */}
        <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-[#0E1117] border border-white/10 shadow-xl">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              What&apos;s New in v0.1.0
            </h3>
          </div>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6 font-sans">
            Runix Terminal v0.1.0 delivers the first official native desktop client for Windows x64
            built with Tauri v2, alongside cross-platform CLI distribution, offline fallback, and cloud sandbox integration.
          </p>

          <ul className="space-y-3">
            {highlights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Distribution Trust & Architecture */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#0E1117] border border-white/10 shadow-xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>

            <h3 className="text-base font-bold text-white mb-2">
              Official Runix Release
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              All Runix Terminal binaries are built directly from certified source repositories, signed
              cryptographically, and distributed through official Runix release infrastructure.
            </p>

            <div className="space-y-2.5 font-mono text-xs text-zinc-400 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span>Signing Authority:</span>
                <span className="text-white font-medium">Runix Infrastructure</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Distribution Hub:</span>
                <span className="text-[#00E5FF]">console.runix.in</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Release Ring:</span>
                <span className="text-emerald-400">Production GA</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <a
              href="https://github.com/runix-system/runix-terminal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#315EF7] hover:underline font-mono"
            >
              <span>View full release notes on GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
