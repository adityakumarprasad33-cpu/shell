'use client';

import React from 'react';
import { Download, ArrowDown, ShieldCheck, Sparkles } from 'lucide-react';
import { ReleaseItem } from '@/lib/types/terminal';

interface DownloadHeroProps {
  detectedPlatform: string;
  recommendedRelease?: ReleaseItem;
  onScrollToPlatforms: () => void;
}

export function DownloadHero({
  detectedPlatform,
  recommendedRelease,
  onScrollToPlatforms,
}: DownloadHeroProps) {
  const platformName =
    detectedPlatform === 'windows'
      ? 'Windows x64'
      : detectedPlatform === 'macos'
      ? 'macOS (Universal)'
      : detectedPlatform === 'linux'
      ? 'Linux x64'
      : detectedPlatform === 'android'
      ? 'Android / Termux'
      : 'Cross-Platform CLI';

  return (
    <section className="text-center max-w-3xl mx-auto pt-6 pb-12">
      {/* Brand & Ecosystem relationship badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#315EF7]/10 border border-[#315EF7]/20 text-[#315EF7] text-xs font-mono mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[#315EF7] animate-pulse" />
        <span>RUNIX TERMINAL · PART OF THE RUNIX ECOSYSTEM</span>
      </div>

      {/* Main Core Purpose Headings */}
      <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-4 leading-tight">
        Your terminal. <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
          Your environment. Anywhere.
        </span>
      </h1>

      <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto mb-8">
        A modern terminal platform for the Runix ecosystem. Run commands locally, connect to
        isolated cloud execution sandboxes, and manage your code across desktop, mobile, and CLI.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-6">
        {recommendedRelease && (
          <a
            href={recommendedRelease.downloadUrl}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#315EF7] hover:bg-[#234bd3] text-white text-sm font-semibold transition-all shadow-[0_0_25px_rgba(49,94,247,0.35)] hover:shadow-[0_0_35px_rgba(49,94,247,0.5)] cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download for {platformName}</span>
          </a>
        )}

        <button
          onClick={onScrollToPlatforms}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-medium border border-white/10 transition-colors"
        >
          <span>View All Platforms</span>
          <ArrowDown className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Release Meta info */}
      <div className="flex items-center justify-center gap-4 text-xs font-mono text-zinc-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>v0.1.0 Official</span>
        </span>
        <span>•</span>
        <span>Released October 2, 2026</span>
        <span>•</span>
        <span>Windows x64 Native</span>
      </div>
    </section>
  );
}
