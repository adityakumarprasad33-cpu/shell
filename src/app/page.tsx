'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { RuntimeRegistrySection } from '@/components/landing/RuntimeRegistrySection';

/* ─────────────────────────────────────────────
   Intersection Observer hook for section reveal
   ───────────────────────────────────────────── */
function useSectionReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('section-hidden');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.remove('section-hidden');
          el.classList.add('section-visible');
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ═══════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════ */
export default function LandingPage() {
  const { user } = useAuth();
  const consoleHref = user ? '/shell' : '/auth/login';

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex flex-col">
      {/* subtle background — almost invisible dot pattern */}
      <div className="fixed inset-0 pointer-events-none dot-pattern opacity-40" />

      <Navbar consoleHref={consoleHref} />

      <main className="flex-1">
        <Hero consoleHref={consoleHref} />
        <StatementSection />
        <TerminalSection />
        <WorkspaceSection />
        <EditorSection />
        <RuntimeRegistrySection />
        <Capabilities />
        <ArchitectureSection />
        <SecuritySection />
        <DownloadSection />
      </main>

      <Footer />
    </div>
  );
}

/* ─── NAVBAR ────────────────────────────────── */
function Navbar({ consoleHref }: { consoleHref: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090B]/90 backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between px-6 h-14">
        {/* Left — brand */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="relative w-6 h-6">
            <Image src="/logo-v2.png" alt="Runix" width={24} height={24} className="object-contain" />
          </div>
          <span className="font-semibold text-[13px] tracking-tight text-white">
            RUNIX <span className="text-[#A1A1AA] font-normal">CONSOLE</span>
          </span>
        </Link>

        {/* Center — navigation */}
        <div className="hidden md:flex items-center gap-8 text-[13px] text-[#A1A1AA]">
          <Link href="/shell" className="hover:text-white transition-colors">Terminal</Link>
          <Link href="/editor" className="hover:text-white transition-colors">Editor</Link>
          <a href="#runtimes" className="hover:text-white transition-colors">Runtimes</a>
          <Link href="/download" className="hover:text-white transition-colors">Download</Link>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="hidden sm:block text-[13px] text-[#A1A1AA] hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href={consoleHref}
            className="px-4 py-1.5 rounded-md bg-[#315EF7] hover:bg-[#244CD0] text-white text-[13px] font-medium transition-colors"
          >
            Open Console
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── HERO ──────────────────────────────────── */
function Hero({ consoleHref }: { consoleHref: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">

          {/* ─ Left column: text ─ */}
          <div className="lg:col-span-5 pt-4">
            <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#71717A] mb-5">
              Runix Console
            </p>

            <h1 className="text-[40px] sm:text-[48px] lg:text-[52px] font-bold tracking-[-0.025em] leading-[1.08] text-white mb-6">
              Your development
              <br />
              environment,
              <br />
              <span className="text-[#A1A1AA]">in one console.</span>
            </h1>

            <p className="text-[16px] leading-relaxed text-[#A1A1AA] max-w-md mb-8">
              Terminal, workspace, and editor — connected. Cloud sandboxes
              with persistent sessions across every device.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link
                href={consoleHref}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#315EF7] hover:bg-[#244CD0] text-white text-[14px] font-medium transition-colors"
              >
                Open Console
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-white/[0.10] hover:border-white/[0.18] text-[#A1A1AA] hover:text-white text-[14px] transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Terminal
              </Link>
            </div>
          </div>

          {/* ─ Right column: product visual ─ */}
          <div className="lg:col-span-7">
            <ConsolePreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── CONSOLE PREVIEW (Hero product visual) ── */
function ConsolePreview() {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0C0E12] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 h-9 bg-[#0A0B0F] border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="w-[10px] h-[10px] rounded-full bg-[#FF5F56]/80" />
          <span className="w-[10px] h-[10px] rounded-full bg-[#FFBD2E]/80" />
          <span className="w-[10px] h-[10px] rounded-full bg-[#27C93F]/80" />
        </div>
        <div className="flex items-center gap-0.5 text-[10px] font-mono text-[#52525B]">
          <span className="px-2.5 py-0.5 rounded bg-white/[0.04] text-[#A1A1AA]">main</span>
          <span className="px-2.5 py-0.5 text-[#52525B]">build</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Body */}
      <div className="flex min-h-[340px] md:min-h-[380px]">
        {/* Sidebar */}
        <div className="w-[160px] border-r border-white/[0.06] bg-[#0A0B0F] py-3 px-3 hidden sm:block">
          <p className="text-[9px] font-mono tracking-[0.15em] uppercase text-[#52525B] mb-3 px-1">Workspace</p>
          <div className="space-y-0.5 text-[11px] font-mono">
            <div className="px-1.5 py-1 text-[#71717A]">▸ <span className="text-[#A1A1AA]">src</span></div>
            <div className="px-1.5 py-1 text-[#71717A] pl-5">main.py</div>
            <div className="px-1.5 py-1 text-[#71717A] pl-5">config.json</div>
            <div className="px-1.5 py-1 bg-white/[0.03] rounded text-[#A1A1AA] pl-5">README.md</div>
            <div className="px-1.5 py-1 text-[#71717A]">▸ <span className="text-[#A1A1AA]">tests</span></div>
            <div className="px-1.5 py-1 text-[#52525B]">.gitignore</div>
            <div className="px-1.5 py-1 text-[#52525B]">package.json</div>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 p-4 font-mono text-[11px] leading-[1.7] overflow-hidden">
          <div className="text-[#52525B] mb-1">Last login: Wed Oct 01 2026 on ttys001</div>
          <div className="flex gap-1">
            <span className="text-[#22C55E]">runix</span>
            <span className="text-[#52525B]">@cloud</span>
            <span className="text-[#52525B]">:</span>
            <span className="text-[#315EF7]">~/project</span>
            <span className="text-[#52525B]">$</span>
            <span className="text-[#A1A1AA] ml-1">npm run build</span>
          </div>
          <div className="mt-2 text-[#71717A]">
            <div>&gt; runix-project@1.0.0 build</div>
            <div>&gt; next build</div>
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-[#22C55E]">  ✓ Compiled successfully in 3.2s</div>
            <div className="text-[#22C55E]">  ✓ Linting and checking validity</div>
            <div className="text-[#22C55E]">  ✓ Collecting page data</div>
            <div className="text-[#22C55E]">  ✓ Generating static pages (12/12)</div>
            <div className="text-[#22C55E]">  ✓ Finalizing page optimization</div>
          </div>
          <div className="mt-3 text-[#71717A]">
            <div>  Route (app)              Size</div>
            <div>  ┌ ○ /                    5.2 kB</div>
            <div>  ├ ○ /api/health          312 B</div>
            <div>  └ ○ /dashboard           8.1 kB</div>
          </div>
          <div className="mt-3 flex gap-1">
            <span className="text-[#22C55E]">runix</span>
            <span className="text-[#52525B]">@cloud</span>
            <span className="text-[#52525B]">:</span>
            <span className="text-[#315EF7]">~/project</span>
            <span className="text-[#52525B]">$</span>
            <span className="w-[7px] h-[14px] bg-[#A1A1AA] inline-block ml-1 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 border-t border-white/[0.06] bg-[#0A0B0F] flex items-center justify-between px-4 text-[9px] font-mono text-[#52525B]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          connected
        </span>
        <div className="flex items-center gap-3">
          <span>bash</span>
          <span>~/project</span>
          <span>remote</span>
        </div>
      </div>
    </div>
  );
}

/* ─── EDITORIAL STATEMENT ───────────────────── */
function StatementSection() {
  const ref = useSectionReveal();
  return (
    <section ref={ref} className="border-t border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-bold tracking-[-0.02em] leading-[1.15] text-white max-w-2xl mb-6">
          The workspace around
          <br />
          your terminal.
        </h2>
        <p className="text-[15px] leading-relaxed text-[#A1A1AA] max-w-lg mb-16">
          Most terminal tools stop at the shell. Runix Console connects your terminal,
          file system, editor, and execution into a single persistent environment.
        </p>

        {/* Full-width product composition */}
        <div className="rounded-lg border border-white/[0.08] bg-[#0C0E12] overflow-hidden">
          {/* Chrome bar */}
          <div className="flex items-center px-4 h-8 bg-[#0A0B0F] border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF5F56]/70" />
              <span className="w-2 h-2 rounded-full bg-[#FFBD2E]/70" />
              <span className="w-2 h-2 rounded-full bg-[#27C93F]/70" />
            </div>
            <span className="ml-4 text-[10px] font-mono text-[#52525B]">Runix Console — main-workspace</span>
          </div>

          <div className="flex min-h-[260px] md:min-h-[300px]">
            {/* File tree */}
            <div className="w-[180px] border-r border-white/[0.06] bg-[#0A0B0F] py-3 px-3 hidden md:block">
              <div className="space-y-0.5 text-[10px] font-mono">
                <div className="px-1.5 py-1 text-[#71717A]">▸ src</div>
                <div className="px-1.5 py-1 text-[#52525B] pl-5">index.ts</div>
                <div className="px-1.5 py-1 text-[#52525B] pl-5">server.ts</div>
                <div className="px-1.5 py-1 text-[#52525B] pl-5">routes.ts</div>
                <div className="px-1.5 py-1 text-[#71717A]">▸ tests</div>
                <div className="px-1.5 py-1 text-[#52525B] pl-5">api.test.ts</div>
                <div className="px-1.5 py-1 text-[#52525B]">package.json</div>
                <div className="px-1.5 py-1 text-[#52525B]">tsconfig.json</div>
                <div className="px-1.5 py-1 text-[#52525B]">.env</div>
              </div>
            </div>

            {/* Terminal area */}
            <div className="flex-1 p-4 font-mono text-[10px] leading-[1.8] text-[#71717A]">
              <div className="flex gap-1">
                <span className="text-[#22C55E]">runix</span><span className="text-[#52525B]">:</span><span className="text-[#315EF7]">~/app</span><span className="text-[#52525B]">$</span>
                <span className="text-[#A1A1AA]">npm test</span>
              </div>
              <div className="mt-1">
                <div>&gt; runix-api@2.0.0 test</div>
                <div className="mt-1 text-[#22C55E]">  PASS  tests/api.test.ts</div>
                <div className="text-[#22C55E]">  PASS  tests/auth.test.ts</div>
                <div className="text-[#22C55E]">  PASS  tests/ws.test.ts</div>
                <div className="mt-1">Test Suites: <span className="text-[#22C55E]">3 passed</span>, 3 total</div>
                <div>Tests:       <span className="text-[#22C55E]">24 passed</span>, 24 total</div>
                <div>Time:        1.84s</div>
              </div>
              <div className="mt-3 flex gap-1">
                <span className="text-[#22C55E]">runix</span><span className="text-[#52525B]">:</span><span className="text-[#315EF7]">~/app</span><span className="text-[#52525B]">$</span>
                <span className="w-[6px] h-[12px] bg-[#71717A] inline-block ml-1" />
              </div>
            </div>

            {/* Editor panel */}
            <div className="w-[280px] border-l border-white/[0.06] bg-[#0B0D11] hidden lg:block">
              <div className="h-7 border-b border-white/[0.06] flex items-center px-3">
                <span className="text-[9px] font-mono text-[#A1A1AA]">server.ts</span>
                <span className="ml-auto text-[8px] font-mono text-[#52525B]">TypeScript</span>
              </div>
              <div className="p-3 font-mono text-[10px] leading-[1.7]">
                <div><span className="text-[#52525B]">1</span>  <span className="text-[#C084FC]">import</span> <span className="text-[#A1A1AA]">{'{ createServer }'}</span> <span className="text-[#C084FC]">from</span> <span className="text-[#22C55E]">&apos;http&apos;</span></div>
                <div><span className="text-[#52525B]">2</span>  <span className="text-[#C084FC]">import</span> <span className="text-[#A1A1AA]">{'{ router }'}</span> <span className="text-[#C084FC]">from</span> <span className="text-[#22C55E]">&apos;./routes&apos;</span></div>
                <div><span className="text-[#52525B]">3</span></div>
                <div><span className="text-[#52525B]">4</span>  <span className="text-[#C084FC]">const</span> <span className="text-[#A1A1AA]">port</span> = <span className="text-[#F59E0B]">8080</span></div>
                <div><span className="text-[#52525B]">5</span>  <span className="text-[#C084FC]">const</span> <span className="text-[#A1A1AA]">server</span> = <span className="text-[#71717A]">createServer(router)</span></div>
                <div><span className="text-[#52525B]">6</span></div>
                <div><span className="text-[#52525B]">7</span>  <span className="text-[#71717A]">server.listen(port, () =&gt; {'{'}</span></div>
                <div><span className="text-[#52525B]">8</span>    <span className="text-[#71717A]">console.log(</span><span className="text-[#22C55E]">`Ready :${'{'}<span className="text-[#F59E0B]">port</span>{'}'}`</span><span className="text-[#71717A]">)</span></div>
                <div><span className="text-[#52525B]">9</span>  <span className="text-[#71717A]">{'}'})</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 01: TERMINAL ──────────────────── */
function TerminalSection() {
  const ref = useSectionReveal();
  return (
    <section ref={ref} className="bg-[#0F0F11] border-t border-b border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <div className="flex items-baseline gap-4 mb-4">
          <span className="text-[11px] font-mono tracking-[0.15em] text-[#52525B]">01</span>
          <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white">Terminal</h2>
        </div>
        <p className="text-[15px] text-[#A1A1AA] max-w-md mb-12">
          A real terminal environment — not a simulation. Run commands in isolated
          cloud sandboxes with full PTY support, or connect to a local host runtime.
        </p>

        {/* Full-width terminal visual */}
        <div className="rounded-lg border border-white/[0.08] bg-[#09090B] overflow-hidden">
          <div className="flex items-center px-4 h-8 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF5F56]/70" />
              <span className="w-2 h-2 rounded-full bg-[#FFBD2E]/70" />
              <span className="w-2 h-2 rounded-full bg-[#27C93F]/70" />
            </div>
            <div className="ml-4 flex items-center gap-0.5 text-[9px] font-mono">
              <span className="px-2 py-0.5 rounded bg-white/[0.05] text-[#A1A1AA]">main</span>
              <span className="px-2 py-0.5 text-[#52525B]">deploy</span>
              <span className="px-2 py-0.5 text-[#52525B]">logs</span>
            </div>
          </div>
          <div className="p-5 font-mono text-[11px] leading-[1.8] min-h-[200px]">
            <div className="flex gap-1"><span className="text-[#22C55E]">runix</span><span className="text-[#52525B]">:</span><span className="text-[#315EF7]">~/project</span><span className="text-[#52525B]">$</span> <span className="text-[#A1A1AA]">python main.py</span></div>
            <div className="text-[#71717A] mt-1">Initializing Runix engine...</div>
            <div className="text-[#71717A]">Loading configuration from runix.json</div>
            <div className="text-[#22C55E]">✓ Server running on :8080</div>
            <div className="text-[#71717A]">Watching for file changes...</div>
            <div className="mt-3 flex gap-1"><span className="text-[#22C55E]">runix</span><span className="text-[#52525B]">:</span><span className="text-[#315EF7]">~/project</span><span className="text-[#52525B]">$</span> <span className="text-[#A1A1AA]">runix status</span></div>
            <div className="text-[#71717A] mt-1">Runtime:   python 3.11</div>
            <div className="text-[#71717A]">Sandbox:   remote (isolated)</div>
            <div className="text-[#71717A]">Session:   sess_a7f2</div>
            <div className="text-[#71717A]">Uptime:    12m 34s</div>
            <div className="mt-3 flex gap-1"><span className="text-[#22C55E]">runix</span><span className="text-[#52525B]">:</span><span className="text-[#315EF7]">~/project</span><span className="text-[#52525B]">$</span> <span className="w-[6px] h-[14px] bg-[#71717A] inline-block ml-1" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 02: WORKSPACE ─────────────────── */
function WorkspaceSection() {
  const ref = useSectionReveal();
  return (
    <section ref={ref}>
      <div className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Text — left */}
          <div className="lg:col-span-5 pt-4">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-[11px] font-mono tracking-[0.15em] text-[#52525B]">02</span>
              <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white">Workspace</h2>
            </div>
            <p className="text-[15px] text-[#A1A1AA] leading-relaxed mb-6">
              Persistent file system across sessions. Create projects, organize files,
              and keep your working context intact — even when you close the browser.
            </p>
            <ul className="space-y-2.5 text-[13px] text-[#A1A1AA]">
              <li className="flex items-start gap-2">
                <span className="text-[#52525B] mt-0.5">—</span>
                Files survive session restarts
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#52525B] mt-0.5">—</span>
                Per-account isolation and storage
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#52525B] mt-0.5">—</span>
                Import and export as ZIP archives
              </li>
            </ul>
          </div>

          {/* Visual — right */}
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-white/[0.08] bg-[#0C0E12] overflow-hidden">
              <div className="px-4 h-8 border-b border-white/[0.06] flex items-center">
                <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-[#52525B]">Workspace Explorer</span>
              </div>
              <div className="p-4 font-mono text-[11px] space-y-0.5">
                <div className="flex items-center gap-2 py-1.5 text-[#A1A1AA]">
                  <span className="text-[#52525B]">▸</span>
                  <span className="font-medium">src</span>
                  <span className="text-[#52525B] text-[10px] ml-auto">4 files</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 text-[#71717A] pl-5">
                  <span className="text-[#315EF7]">◆</span> main.py
                  <span className="text-[#52525B] text-[10px] ml-auto">2.1 kB</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 text-[#71717A] pl-5">
                  <span className="text-[#F59E0B]">◆</span> config.json
                  <span className="text-[#52525B] text-[10px] ml-auto">480 B</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 text-[#71717A] pl-5">
                  <span className="text-[#71717A]">◆</span> README.md
                  <span className="text-[#52525B] text-[10px] ml-auto">1.4 kB</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 text-[#A1A1AA]">
                  <span className="text-[#52525B]">▸</span>
                  <span className="font-medium">tests</span>
                  <span className="text-[#52525B] text-[10px] ml-auto">2 files</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 text-[#71717A]">
                  <span className="text-[#52525B]">◆</span> .gitignore
                  <span className="text-[#52525B] text-[10px] ml-auto">264 B</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 text-[#71717A]">
                  <span className="text-[#52525B]">◆</span> package.json
                  <span className="text-[#52525B] text-[10px] ml-auto">920 B</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── SECTION 03: EDITOR ────────────────────── */
function EditorSection() {
  const ref = useSectionReveal();
  return (
    <section ref={ref} className="border-t border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Visual — left */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="rounded-lg border border-white/[0.08] bg-[#0C0E12] overflow-hidden">
              {/* Tab */}
              <div className="h-8 border-b border-white/[0.06] flex items-center px-3 gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono text-[#A1A1AA]">
                  main.py
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono text-[#52525B]">
                  config.json
                </div>
                <span className="ml-auto text-[9px] font-mono text-[#52525B]">Python</span>
              </div>
              {/* Editor body */}
              <div className="p-4 font-mono text-[11px] leading-[1.8] min-h-[240px]">
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">1</span><span className="text-[#C084FC]">import</span> <span className="text-[#A1A1AA]">sys</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">2</span><span className="text-[#C084FC]">from</span> <span className="text-[#A1A1AA]">pathlib</span> <span className="text-[#C084FC]">import</span> <span className="text-[#A1A1AA]">Path</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">3</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">4</span><span className="text-[#C084FC]">def</span> <span className="text-[#F59E0B]">main</span><span className="text-[#71717A]">():</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">5</span>    <span className="text-[#A1A1AA]">config</span> <span className="text-[#71717A]">=</span> <span className="text-[#A1A1AA]">load_config</span><span className="text-[#71717A]">()</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">6</span>    <span className="text-[#A1A1AA]">print</span><span className="text-[#71717A]">(</span><span className="text-[#22C55E]">f&quot;Runix v{'{'}<span className="text-[#F59E0B]">config[&apos;version&apos;]</span>{'}'}&quot;</span><span className="text-[#71717A]">)</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">7</span>    <span className="text-[#A1A1AA]">print</span><span className="text-[#71717A]">(</span><span className="text-[#22C55E]">f&quot;Python {'{'}<span className="text-[#F59E0B]">sys.version</span>{'}'}&quot;</span><span className="text-[#71717A]">)</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">8</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">9</span><span className="text-[#C084FC]">if</span> <span className="text-[#A1A1AA]">__name__</span> <span className="text-[#71717A]">==</span> <span className="text-[#22C55E]">&quot;__main__&quot;</span><span className="text-[#71717A]">:</span></div>
                <div><span className="text-[#52525B] w-6 inline-block text-right mr-4">10</span>    <span className="text-[#A1A1AA]">main</span><span className="text-[#71717A]">()</span></div>
              </div>
            </div>
          </div>

          {/* Text — right */}
          <div className="lg:col-span-5 pt-4 order-1 lg:order-2">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-[11px] font-mono tracking-[0.15em] text-[#52525B]">03</span>
              <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white">Editor</h2>
            </div>
            <p className="text-[15px] text-[#A1A1AA] leading-relaxed mb-6">
              Move from shell to source without leaving the environment. Open, edit,
              save, and run — directly from the console.
            </p>
            <ul className="space-y-2.5 text-[13px] text-[#A1A1AA]">
              <li className="flex items-start gap-2">
                <span className="text-[#52525B] mt-0.5">—</span>
                Syntax-aware editing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#52525B] mt-0.5">—</span>
                Keyboard shortcuts (Ctrl+S to save)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#52525B] mt-0.5">—</span>
                Run files directly in the connected terminal
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── CAPABILITIES ──────────────────────────── */
function Capabilities() {
  const ref = useSectionReveal();
  const items = [
    { label: 'Terminal', desc: 'Real shell interaction with PTY support' },
    { label: 'Workspace', desc: 'Persistent project file system' },
    { label: 'Editor', desc: 'Integrated source editing' },
    { label: 'Sessions', desc: 'Concurrent terminal sessions' },
    { label: 'History', desc: 'Secret-aware command history' },
    { label: 'Execution', desc: 'Isolated cloud runtime sandboxes' },
  ];

  return (
    <section ref={ref} className="bg-[#0F0F11] border-t border-b border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white mb-4">
          Capabilities
        </h2>
        <p className="text-[15px] text-[#A1A1AA] max-w-md mb-12">
          Built for the way developers work.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-0">
          {items.map((item, i) => (
            <div
              key={item.label}
              className="py-5 border-t border-white/[0.06]"
            >
              <h3 className="text-[14px] font-semibold text-white mb-1">{item.label}</h3>
              <p className="text-[13px] text-[#71717A]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── ARCHITECTURE ──────────────────────────── */
function ArchitectureSection() {
  const ref = useSectionReveal();
  const layers = [
    { label: 'Client', sub: 'Browser · Desktop · CLI' },
    { label: 'Runix Console', sub: 'Application Layer' },
    { label: 'Session Manager', sub: 'PTY · WebSocket · State' },
    { label: 'Execution', sub: 'Isolated Sandbox Runtime' },
    { label: 'Storage', sub: 'Workspace · Files · History' },
  ];

  return (
    <section ref={ref}>
      <div className="max-w-[800px] mx-auto px-6 py-24 md:py-32 text-center">
        <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white mb-4">
          Architecture
        </h2>
        <p className="text-[15px] text-[#A1A1AA] mb-16">
          Each layer is isolated. Each connection is authenticated.
        </p>

        <div className="flex flex-col items-center gap-0">
          {layers.map((layer, i) => (
            <React.Fragment key={layer.label}>
              {i > 0 && (
                <div className="w-px h-8 bg-white/[0.10]" />
              )}
              <div className="w-full max-w-[320px] py-3 px-5 rounded border border-white/[0.08] bg-[#0F0F11] text-center">
                <div className="text-[13px] font-semibold text-white">{layer.label}</div>
                <div className="text-[11px] font-mono text-[#52525B] mt-0.5">{layer.sub}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SECURITY ──────────────────────────────── */
function SecuritySection() {
  const ref = useSectionReveal();
  return (
    <section ref={ref} className="border-t border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <div className="max-w-lg">
          <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white mb-4">
            Security by design
          </h2>
          <p className="text-[15px] text-[#A1A1AA] leading-relaxed mb-8">
            Every account operates in complete isolation. No user can access
            another user&apos;s projects, files, sessions, or history.
          </p>

          <div className="space-y-3 text-[14px]">
            {[
              'Account isolation — separate data boundaries per user',
              'Execution isolation — sandboxed runtime environments',
              'Session management — authenticated, expiring connections',
              'Secret redaction — sensitive values filtered from history',
              'Firebase Auth — identity, token verification, password reset',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-[#A1A1AA]">
                <span className="text-[#52525B] mt-1 text-[10px]">●</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── DOWNLOAD ──────────────────────────────── */
function DownloadSection() {
  const ref = useSectionReveal();
  return (
    <section ref={ref} className="bg-[#0F0F11] border-t border-b border-white/[0.06]">
      <div className="max-w-[800px] mx-auto px-6 py-24 md:py-28 text-center">
        <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-white mb-3">
          Runix Terminal
        </h2>
        <p className="text-[15px] text-[#A1A1AA] mb-10">
          Available on supported platforms.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] font-mono text-[#71717A] mb-10">
          <span>Windows</span>
          <span className="text-[#52525B]">·</span>
          <span>Linux</span>
          <span className="text-[#52525B]">·</span>
          <span>macOS</span>
          <span className="text-[#52525B]">·</span>
          <span>CLI</span>
        </div>

        <Link
          href="/download"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#315EF7] hover:bg-[#244CD0] text-white text-[14px] font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Terminal
        </Link>
      </div>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-6 py-14">
        {/* Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-14">
          {/* Products */}
          <div>
            <h4 className="text-[11px] font-mono tracking-[0.15em] uppercase text-[#52525B] mb-4">Products</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link href="/shell" className="text-[#A1A1AA] hover:text-white transition-colors">Console</Link></li>
              <li><Link href="/shell" className="text-[#A1A1AA] hover:text-white transition-colors">Terminal</Link></li>
              <li><Link href="/editor" className="text-[#A1A1AA] hover:text-white transition-colors">Editor</Link></li>
              <li><a href="#runtimes" className="text-[#A1A1AA] hover:text-white transition-colors">Runtimes Matrix</a></li>
              <li><Link href="/download" className="text-[#A1A1AA] hover:text-white transition-colors">Download</Link></li>
            </ul>
          </div>

          {/* Ecosystem */}
          <div>
            <h4 className="text-[11px] font-mono tracking-[0.15em] uppercase text-[#52525B] mb-4">Ecosystem</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><a href="https://runix.in" target="_blank" rel="noopener noreferrer" className="text-[#A1A1AA] hover:text-white transition-colors">runix.in</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-[11px] font-mono tracking-[0.15em] uppercase text-[#52525B] mb-4">Resources</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link href="/download" className="text-[#A1A1AA] hover:text-white transition-colors">Download</Link></li>
              <li><a href="https://github.com/adityakumarprasad33-cpu/shell" target="_blank" rel="noopener noreferrer" className="text-[#A1A1AA] hover:text-white transition-colors">GitHub</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[11px] font-mono tracking-[0.15em] uppercase text-[#52525B] mb-4">Legal</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><span className="text-[#71717A]">Privacy Policy</span></li>
              <li><span className="text-[#71717A]">Terms of Service</span></li>
              <li><span className="text-[#71717A]">Security</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-4 h-4">
              <Image src="/logo-v2.png" alt="Runix" width={16} height={16} className="object-contain" />
            </div>
            <span className="text-[12px] text-[#52525B]">RUNIX</span>
          </div>
          <div className="text-[12px] text-[#52525B]">
            © 2026 Runix &middot; console.runix.in
          </div>
        </div>
      </div>
    </footer>
  );
}
