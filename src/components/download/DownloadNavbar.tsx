'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Terminal, ExternalLink, ArrowRight } from 'lucide-react';

export function DownloadNavbar() {
  return (
    <header className="h-16 border-b border-white/10 bg-[#0E1117]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="relative w-7 h-7">
            <Image
              src="/logo-v2.png"
              alt="Runix"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <span className="font-semibold text-lg tracking-tight text-white flex items-center gap-1.5">
            Runix <span className="text-[#315EF7] font-mono text-xs px-1.5 py-0.5 rounded bg-[#315EF7]/15 border border-[#315EF7]/20">TERMINAL</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            Console
          </Link>
          <Link href="/download" className="text-white font-semibold flex items-center gap-1.5 relative py-1">
            <span>Download</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#315EF7]" />
          </Link>
          <a
            href="https://runix.in/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Docs</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
          <a
            href="https://github.com/runix-system/runix-terminal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#315EF7] hover:bg-[#254cc9] text-white text-xs font-medium transition-all shadow-[0_0_15px_rgba(49,94,247,0.25)]"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Launch Console</span>
        </Link>
      </div>
    </header>
  );
}
