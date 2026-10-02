'use client';

import React from 'react';
import { Monitor, Laptop, Terminal, Smartphone, Zap } from 'lucide-react';

interface PlatformSelectorProps {
  detectedPlatform: string;
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
}

export function PlatformSelector({
  detectedPlatform,
  selectedFilter,
  onSelectFilter,
}: PlatformSelectorProps) {
  const tabs = [
    { id: 'all', label: 'All Platforms', icon: null },
    { id: 'windows', label: 'Windows', icon: Monitor },
    { id: 'macos', label: 'macOS', icon: Laptop },
    { id: 'linux', label: 'Linux', icon: Terminal },
    { id: 'cli', label: 'Runix CLI', icon: Zap },
    { id: 'android', label: 'Android / Termux', icon: Smartphone },
  ];

  const detectedLabel =
    detectedPlatform === 'windows'
      ? 'Windows x64'
      : detectedPlatform === 'macos'
      ? 'macOS (Apple Silicon & Intel)'
      : detectedPlatform === 'linux'
      ? 'Linux x64'
      : detectedPlatform === 'android'
      ? 'Android / Termux'
      : 'Runix CLI';

  return (
    <div id="platforms" className="mb-8 pt-4">
      {/* Auto-detection notification banner */}
      <div className="p-3.5 rounded-xl bg-[#0E1117] border border-white/10 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#315EF7]/15 border border-[#315EF7]/30 flex items-center justify-center shrink-0">
            <Monitor className="w-4 h-4 text-[#315EF7]" />
          </div>
          <div>
            <p className="text-xs text-zinc-300">
              You are browsing from <strong className="text-white capitalize">{detectedLabel}</strong>.
            </p>
            <p className="text-[11px] text-zinc-500">
              Runix Terminal is officially supported and available for your system architecture.
            </p>
          </div>
        </div>

        <button
          onClick={() => onSelectFilter(detectedPlatform)}
          className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#00E5FF] transition-colors"
        >
          View {detectedPlatform.toUpperCase()} Build
        </button>
      </div>

      {/* Manual platform selection tabs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Available Distributions</h2>
        <span className="text-xs font-mono text-zinc-500">Select target platform</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto auth-scroll pb-2">
        {tabs.map((tab) => {
          const isActive = selectedFilter === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectFilter(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#315EF7] text-white shadow-[0_0_15px_rgba(49,94,247,0.3)] font-semibold'
                  : 'bg-[#0E1117] text-zinc-400 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
