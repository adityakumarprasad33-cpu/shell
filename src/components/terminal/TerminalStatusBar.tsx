'use client';

import React from 'react';
import {
  Activity,
  HardDrive,
  Cpu,
  Wifi,
  Square,
  Clock,
  Terminal as TerminalIcon,
  ShieldCheck,
} from 'lucide-react';
import { TerminalSession, ExecutionMode } from '@/lib/types/terminal';

interface TerminalStatusBarProps {
  session: TerminalSession;
  activeCommand: string | null;
  onStopCommand?: () => void;
  latencyMs?: number;
}

export function TerminalStatusBar({
  session,
  activeCommand,
  onStopCommand,
  latencyMs = 18,
}: TerminalStatusBarProps) {
  return (
    <footer className="h-7 border-t border-white/10 bg-[#090A0F] px-3 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none shrink-0 z-20">
      {/* Left Telemetry */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow" />
          <span className="font-medium">Connected</span>
          <span className="text-zinc-600">({latencyMs}ms)</span>
        </div>

        {/* Execution Mode */}
        <div className="hidden sm:flex items-center gap-1.5 text-zinc-300">
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Mode:</span>
          <span className={session.executionMode === 'remote' ? 'text-[#315EF7]' : 'text-emerald-400'}>
            {session.executionMode.toUpperCase()}
          </span>
        </div>

        {/* Shell Type */}
        <div className="hidden md:flex items-center gap-1.5 text-zinc-300">
          <TerminalIcon className="w-3 h-3 text-zinc-500" />
          <span>{session.shell}</span>
        </div>

        {/* Working Directory */}
        <div className="hidden lg:flex items-center gap-1.5 text-zinc-400 truncate max-w-[200px]">
          <span>{session.workingDirectory}</span>
        </div>

        {/* Active Running Process with Stop Action */}
        {activeCommand && (
          <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="truncate max-w-[140px]">Running: {activeCommand}</span>
            {onStopCommand && (
              <button
                onClick={onStopCommand}
                className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-[10px] transition-colors"
                title="Send SIGINT (Ctrl+C)"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Telemetry: Sandbox Limits & Security */}
      <div className="flex items-center gap-3">
        {/* Isolation Indicator */}
        <div className="hidden sm:flex items-center gap-1 text-zinc-400">
          <ShieldCheck className="w-3 h-3 text-[#315EF7]" />
          <span>Isolated</span>
        </div>

        {/* RAM Limit */}
        <div className="hidden md:flex items-center gap-1 text-zinc-400">
          <HardDrive className="w-3 h-3 text-zinc-500" />
          <span>512 MB</span>
        </div>

        {/* Execution Timeout Limit */}
        <div className="flex items-center gap-1 text-zinc-400">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span>30s SLA</span>
        </div>

        {/* UTF-8 */}
        <div className="hidden sm:inline text-zinc-500">
          UTF-8
        </div>
      </div>
    </footer>
  );
}
