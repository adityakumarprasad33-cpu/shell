'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, Terminal } from 'lucide-react';

export function EcosystemFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#07080C] text-zinc-400 font-sans pt-12 pb-8 px-6 mt-auto">
      <div className="max-w-5xl mx-auto w-full">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-6 h-6">
                <Image
                  src="/logo-v2.png"
                  alt="Runix"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <span className="font-semibold text-base tracking-tight text-white">
                RUNIX <span className="text-[#315EF7] font-mono text-xs">TERMINAL</span>
              </span>
            </Link>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
              Developer infrastructure and high-performance terminal environments for the Runix ecosystem.
            </p>

            <div className="pt-2 text-xs font-mono text-zinc-500">
              <span className="text-zinc-300">console.runix.in</span>
              <span className="mx-2">·</span>
              <span>Part of the Runix ecosystem</span>
            </div>
          </div>

          {/* Column: PRODUCTS */}
          <div>
            <h4 className="text-xs font-mono font-semibold tracking-wider text-white uppercase mb-3">
              Products
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://runix.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Runix Platform
                </a>
              </li>
              <li>
                <Link
                  href="/"
                  className="text-white font-medium hover:text-[#315EF7] transition-colors flex items-center gap-1"
                >
                  <span>Terminal</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#315EF7]" />
                </Link>
              </li>
              <li>
                <a
                  href="https://ai.runix.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Runix AI
                </a>
              </li>
              <li>
                <a
                  href="https://si.runix.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Runix SI
                </a>
              </li>
            </ul>
          </div>

          {/* Column: ECOSYSTEM */}
          <div>
            <h4 className="text-xs font-mono font-semibold tracking-wider text-white uppercase mb-3">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <a
                  href="https://runix.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  runix.in
                </a>
              </li>
              <li>
                <Link
                  href="/"
                  className="text-white hover:text-[#00E5FF] transition-colors"
                >
                  console.runix.in
                </Link>
              </li>
              <li>
                <a
                  href="https://ai.runix.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  ai.runix.in
                </a>
              </li>
              <li>
                <a
                  href="https://si.runix.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  si.runix.in
                </a>
              </li>
            </ul>
          </div>

          {/* Column: RESOURCES */}
          <div>
            <h4 className="text-xs font-mono font-semibold tracking-wider text-white uppercase mb-3">
              Resources
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://runix.in/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>Documentation</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/runix-system/runix-terminal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                </a>
              </li>
              <li>
                <a
                  href="#releases"
                  className="hover:text-white transition-colors"
                >
                  Release Notes
                </a>
              </li>
              <li>
                <a
                  href="https://runix.in/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>Support</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>
            © 2026 Runix. All rights reserved.
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/" className="hover:text-zinc-300">Terminal</Link>
            <Link href="/download" className="text-zinc-300">Download</Link>
            <a href="https://runix.in/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">Privacy</a>
            <a href="https://runix.in/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
