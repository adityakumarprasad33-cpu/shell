'use client';

import React, { useState } from 'react';
import { Monitor, Laptop, Terminal, Smartphone, CheckCircle2 } from 'lucide-react';

export function InstallGuide() {
  const [activeTab, setActiveTab] = useState<'windows' | 'macos' | 'linux' | 'android'>('windows');

  const guides = {
    windows: {
      platform: 'Windows (x64)',
      icon: Monitor,
      filename: 'RunixTerminal.exe (Portable Binary)',
      steps: [
        'Download the official standalone Windows x64 executable (RunixTerminal.exe).',
        'Double-click RunixTerminal.exe to launch Runix Terminal immediately — no installation or admin rights required.',
        'The application starts instantly with local PowerShell / CMD execution and cloud backend sync.',
        'Authenticate your Runix account with device code verification or develop in offline sandbox mode.',
        'Optional: Move RunixTerminal.exe to your preferred tools folder and add it to your user PATH.',
      ],
    },
    macos: {
      platform: 'macOS (Universal)',
      icon: Laptop,
      filename: 'Runix-Terminal-0.1.0.dmg (Coming Soon)',
      steps: [
        'macOS distribution is currently undergoing automated packaging and notarization.',
        'Universal binary supporting both Apple Silicon (M1/M2/M3/M4) and Intel x86_64 architectures will be published once certified.',
        'In the meantime, macOS users can use the Runix CLI via npm: npm install -g @runix/terminal.',
      ],
    },
    linux: {
      platform: 'Linux (x64)',
      icon: Terminal,
      filename: 'runix-terminal-0.1.0.tar.gz (Coming Soon)',
      steps: [
        'Linux native client is currently in automated CI build verification.',
        'Direct deb, rpm, and tar.gz distributions with Wayland & X11 support will be released once pipeline testing finishes.',
        'Linux developers can execute commands immediately using the Runix CLI: npm install -g @runix/terminal.',
      ],
    },
    android: {
      platform: 'Android / Termux',
      icon: Smartphone,
      filename: 'termux.sh (Coming Soon)',
      steps: [
        'Dedicated Android Termux packages are currently in pipeline development.',
        'Termux users will be able to launch cloud terminal sessions using the automated termux installer script.',
        'Track upcoming release availability on GitHub.',
      ],
    },
  };

  const current = guides[activeTab];
  const CurrentIcon = current.icon;

  return (
    <section className="mb-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-mono font-semibold tracking-wider text-[#315EF7] uppercase">
            Step-by-Step Setup
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            Installation Guide
          </h2>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0E1117] border border-white/10 overflow-x-auto">
          {(Object.keys(guides) as Array<'windows' | 'macos' | 'linux' | 'android'>).map((key) => {
            const item = guides[key];
            const Icon = item.icon;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#315EF7] text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.platform}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Guide Content Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0E1117] border border-white/10 shadow-xl">
        <div className="flex items-center gap-3 pb-6 border-b border-white/10 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#315EF7]/10 border border-[#315EF7]/20 flex items-center justify-center">
            <CurrentIcon className="w-4 h-4 text-[#315EF7]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Installing on {current.platform}
            </h3>
            <p className="text-xs font-mono text-zinc-400">
              Primary package: {current.filename}
            </p>
          </div>
        </div>

        <ol className="space-y-4">
          {current.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3.5">
              <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono text-[#00E5FF] shrink-0 mt-0.5 font-semibold">
                {index + 1}
              </span>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans pt-0.5">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
