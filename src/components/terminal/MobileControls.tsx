'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft, Copy, Scissors, Trash2 } from 'lucide-react';

interface MobileControlsProps {
  onSendKey: (key: string) => void;
  onSendSpecial: (action: 'ctrl-c' | 'ctrl-d' | 'clear' | 'tab' | 'esc') => void;
}

export function MobileControls({ onSendKey, onSendSpecial }: MobileControlsProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#0E1117] border-t border-white/10 overflow-x-auto auth-scroll select-none shrink-0 md:hidden z-20">
      <button
        onClick={() => onSendSpecial('esc')}
        className="px-2.5 py-1 rounded bg-white/5 active:bg-[#315EF7] text-xs font-mono text-zinc-300 active:text-white border border-white/10"
      >
        ESC
      </button>

      <button
        onClick={() => onSendSpecial('tab')}
        className="px-2.5 py-1 rounded bg-white/5 active:bg-[#315EF7] text-xs font-mono text-zinc-300 active:text-white border border-white/10"
      >
        TAB
      </button>

      <button
        onClick={() => onSendSpecial('ctrl-c')}
        className="px-2.5 py-1 rounded bg-red-500/15 active:bg-red-500 text-xs font-mono text-red-400 active:text-white border border-red-500/30"
        title="Interrupt Process (Ctrl+C)"
      >
        ^C
      </button>

      <button
        onClick={() => onSendSpecial('ctrl-d')}
        className="px-2.5 py-1 rounded bg-white/5 active:bg-[#315EF7] text-xs font-mono text-zinc-300 active:text-white border border-white/10"
        title="EOF (Ctrl+D)"
      >
        ^D
      </button>

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      {/* Navigation Arrows */}
      <button
        onClick={() => onSendKey('\x1b[A')}
        className="p-1.5 rounded bg-white/5 active:bg-white/20 text-zinc-300 border border-white/10"
        title="Up Arrow"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onSendKey('\x1b[B')}
        className="p-1.5 rounded bg-white/5 active:bg-white/20 text-zinc-300 border border-white/10"
        title="Down Arrow"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onSendKey('\x1b[D')}
        className="p-1.5 rounded bg-white/5 active:bg-white/20 text-zinc-300 border border-white/10"
        title="Left Arrow"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onSendKey('\x1b[C')}
        className="p-1.5 rounded bg-white/5 active:bg-white/20 text-zinc-300 border border-white/10"
        title="Right Arrow"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      {/* Clear Screen */}
      <button
        onClick={() => onSendSpecial('clear')}
        className="px-2 py-1 rounded bg-white/5 active:bg-[#315EF7] text-xs font-mono text-zinc-300 active:text-white border border-white/10"
      >
        clear
      </button>
    </div>
  );
}
