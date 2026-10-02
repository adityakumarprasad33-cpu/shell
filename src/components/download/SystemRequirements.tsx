'use client';

import React from 'react';
import { Monitor, Laptop, Terminal, Smartphone, Cpu, HardDrive } from 'lucide-react';

export function SystemRequirements() {
  const requirements = [
    {
      platform: 'Windows',
      icon: Monitor,
      os: 'Windows 10 / 11 (64-bit)',
      cpu: 'x86_64 compatible processor',
      ram: '2 GB RAM minimum (4 GB recommended)',
      disk: '250 MB free disk space',
      notes: 'PowerShell 5.1+ or Windows Terminal recommended',
    },
    {
      platform: 'macOS',
      icon: Laptop,
      os: 'macOS 11.0 (Big Sur) or newer',
      cpu: 'Apple Silicon (M1/M2/M3/M4) or Intel 64-bit',
      ram: '2 GB RAM minimum (4 GB recommended)',
      disk: '220 MB free disk space',
      notes: 'Universal binary with native ARM64 & x86_64 builds',
    },
    {
      platform: 'Linux',
      icon: Terminal,
      os: 'Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch',
      cpu: 'x86_64 or aarch64 (ARM64)',
      ram: '2 GB RAM minimum',
      disk: '200 MB free disk space',
      notes: 'Requires glibc 2.28+ and X11 or Wayland display server',
    },
    {
      platform: 'Android / Termux',
      icon: Smartphone,
      os: 'Android 8.0 (Oreo) or newer',
      cpu: 'ARM64 (aarch64) or ARMv7',
      ram: '1 GB RAM available',
      disk: '50 MB free storage',
      notes: 'Requires Termux environment with bash and curl',
    },
  ];

  return (
    <section className="mb-14">
      <div className="mb-6">
        <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
          Hardware & OS
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
          System Requirements
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {requirements.map((req) => {
          const Icon = req.icon;
          return (
            <div
              key={req.platform}
              className="p-5 rounded-2xl bg-[#0E1117] border border-white/10 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-zinc-300" />
                  </div>
                  <h3 className="font-bold text-sm text-white">{req.platform}</h3>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-400 font-sans">
                  <div>
                    <span className="text-[11px] font-mono text-zinc-500 block uppercase">OS Version</span>
                    <span className="text-zinc-200">{req.os}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-zinc-500 block uppercase">Architecture</span>
                    <span className="text-zinc-200">{req.cpu}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-zinc-500 block uppercase">Memory & Disk</span>
                    <span className="text-zinc-200">{req.ram} • {req.disk}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-white/5 text-[11px] text-zinc-500 leading-normal">
                {req.notes}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
