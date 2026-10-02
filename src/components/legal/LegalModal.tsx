'use client';

import React from 'react';
import { X, ShieldCheck, FileText, Check } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  type: 'terms' | 'privacy' | null;
  onClose: () => void;
  onAccept?: () => void;
}

export function LegalModal({ isOpen, type, onClose, onAccept }: LegalModalProps) {
  if (!isOpen || !type) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0E1117] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#131722]/50">
          <div className="flex items-center gap-2.5">
            {type === 'terms' ? (
              <FileText className="w-5 h-5 text-[#315EF7]" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                {type === 'terms' ? 'Runix Terminal — Terms & Conditions' : 'Runix Terminal — Privacy Policy'}
              </h2>
              <p className="text-[11px] text-zinc-400 font-sans">
                Effective: October 2026 • Platform Security Standard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto auth-scroll text-xs text-zinc-300 space-y-4 font-sans leading-relaxed">
          {type === 'terms' ? (
            <>
              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-[#315EF7]">
                  1. Developer Workspace & Cloud Sandbox Use
                </h3>
                <p>
                  Runix Terminal provides developers with isolated cloud sandboxes, persistent workspace file systems,
                  and local bridge capabilities. By creating an account or accessing the console, you agree to use
                  these resources exclusively for legitimate software engineering, testing, and system development.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-[#315EF7]">
                  2. Acceptable Use & Security Enforcement
                </h3>
                <p>
                  You agree not to deploy malware, unauthorized network scanners, automated vulnerability probes,
                  cryptocurrency miners, or denial-of-service payloads on Runix infrastructure. Violations result
                  in immediate token revocation and permanent workspace termination.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-[#315EF7]">
                  3. Service Reliability & Execution Limits
                </h3>
                <p>
                  Sandbox command execution is bounded by safety timeouts and process memory thresholds (default 30s
                  per command and 5 MB stream buffer). Runix provides these developer tools on an "as-is" basis with high
                  availability SLAs.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-[#315EF7]">
                  4. Intellectual Property & Code Ownership
                </h3>
                <p>
                  You retain 100% full intellectual property and copyright ownership over all source code, files,
                  scripts, and binaries uploaded to or created within your Runix Terminal workspaces.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-emerald-400">
                  1. Information We Collect
                </h3>
                <p>
                  Runix collects only the minimal credentials necessary to authenticate and maintain your developer
                  workspace: email address, display name, and authentication tokens via Firebase Auth or Google OAuth.
                  We never sell or rent developer data to third parties.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-emerald-400">
                  2. Workspace Data & Isolated Storage
                </h3>
                <p>
                  Your files, execution histories, and custom terminal configurations are encrypted and stored in your
                  isolated cloud database. Only your authenticated user account has access to your workspace files.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-emerald-400">
                  3. Telemetry & Analytics
                </h3>
                <p>
                  We monitor latency, command completion status codes, and server health metrics to optimize sandbox
                  performance. Telemetry is anonymized and never contains sensitive code or environment variables.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-zinc-100 font-mono text-xs uppercase text-emerald-400">
                  4. Account Deletion & Data Portability
                </h3>
                <p>
                  You have the right to export your workspace files as a ZIP archive at any time or request complete
                  deletion of your Terminal Account and associated database records.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 flex items-center justify-between shrink-0 bg-[#131722]/50 font-mono text-xs">
          <span className="text-zinc-500 text-[11px]">
            Runix Security Policy v1.0
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
            {onAccept && (
              <button
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="px-4 py-1.5 rounded-lg bg-[#315EF7] hover:bg-[#254cc9] text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Agree & Accept</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
