'use client';

import React from 'react';
import { X, Sliders, Type, Palette, Terminal, Shield } from 'lucide-react';
import { TerminalSettings, DEFAULT_TERMINAL_SETTINGS } from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TerminalSettings;
  onUpdateSettings: (newSettings: Partial<TerminalSettings>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  const { updateAccountSettings } = useAuth();

  if (!isOpen) return null;

  const handleSaveAndSync = (partial: Partial<TerminalSettings>) => {
    onUpdateSettings(partial);
    updateAccountSettings(partial).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0E1117] border border-white/15 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="h-12 px-5 border-b border-white/10 flex items-center justify-between bg-[#131722]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#315EF7]" />
            <span className="font-semibold text-sm text-white">Terminal Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh] auth-scroll text-xs">
          {/* Theme */}
          <div>
            <label className="text-zinc-300 font-medium block mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#315EF7]" />
              Color Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'runix-dark', name: 'Runix Obsidian (Default)', desc: 'Dark titanium with precision blue' },
                { id: 'runix-matrix', name: 'Cyber Matrix', desc: 'Phosphor green terminal' },
                { id: 'runix-amber', name: 'Vintage Amber', desc: 'Warm amber CRT monitor' },
                { id: 'runix-titanium', name: 'Machined Titanium', desc: 'Sleek zinc with cobalt accents' },
                { id: 'runix-cyber', name: 'Neon Cyberpunk', desc: 'Vibrant cyan & magenta' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleSaveAndSync({ theme: theme.id as any })}
                  className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                    settings.theme === theme.id
                      ? 'border-[#315EF7] bg-[#315EF7]/10 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <span className="font-medium block text-zinc-200">{theme.name}</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">{theme.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <label className="text-zinc-300 font-medium block flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-[#315EF7]" />
              Typography & Font
            </label>

            <div>
              <span className="text-zinc-400 block mb-1">Font Family</span>
              <select
                value={settings.fontFamily}
                onChange={(e) => handleSaveAndSync({ fontFamily: e.target.value })}
                className="w-full bg-[#131722] border border-white/10 rounded px-3 py-1.5 text-zinc-200 outline-none font-mono"
              >
                <option value='JetBrains Mono, Menlo, Monaco, "Courier New", monospace'>JetBrains Mono (Recommended)</option>
                <option value='Menlo, Monaco, "Courier New", monospace'>Menlo / Monaco</option>
                <option value='"Fira Code", monospace'>Fira Code</option>
                <option value='"Source Code Pro", monospace'>Source Code Pro</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span>Font Size</span>
                <span className="font-mono text-white">{settings.fontSize}px</span>
              </div>
              <input
                type="range"
                min="11"
                max="22"
                value={settings.fontSize}
                onChange={(e) => handleSaveAndSync({ fontSize: parseInt(e.target.value) })}
                className="w-full accent-[#315EF7]"
              />
            </div>
          </div>

          {/* Cursor */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <label className="text-zinc-300 font-medium block flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#315EF7]" />
              Cursor Behavior
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(['block', 'underline', 'bar'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => handleSaveAndSync({ cursorStyle: style })}
                  className={`py-2 rounded font-mono text-center border uppercase transition-colors ${
                    settings.cursorStyle === style
                      ? 'border-[#315EF7] bg-[#315EF7]/10 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-zinc-300">Cursor Blinking</span>
              <input
                type="checkbox"
                checked={settings.cursorBlink}
                onChange={(e) => handleSaveAndSync({ cursorBlink: e.target.checked })}
                className="accent-[#315EF7] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Copy Selection on Mouse Release</span>
              <input
                type="checkbox"
                checked={settings.copyOnSelect}
                onChange={(e) => handleSaveAndSync({ copyOnSelect: e.target.checked })}
                className="accent-[#315EF7] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Execution Sandbox Defaults */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <label className="text-zinc-300 font-medium block flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#315EF7]" />
              Execution Defaults
            </label>

            <div>
              <span className="text-zinc-400 block mb-1">Default Shell</span>
              <select
                value={settings.defaultShell}
                onChange={(e) => handleSaveAndSync({ defaultShell: e.target.value as any })}
                className="w-full bg-[#131722] border border-white/10 rounded px-3 py-1.5 text-zinc-200 outline-none font-mono"
              >
                <option value="bash">bash (Bourne-Again SHell)</option>
                <option value="zsh">zsh (Z Shell)</option>
                <option value="sh">sh (Standard POSIX)</option>
                <option value="powershell">powershell (Windows / PowerShell Core)</option>
                <option value="cmd">cmd (Windows Command Prompt)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-white/10 bg-[#090A0F] flex items-center justify-between text-xs">
          <button
            onClick={() => handleSaveAndSync(DEFAULT_TERMINAL_SETTINGS)}
            className="text-zinc-500 hover:text-zinc-300 underline font-mono"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#315EF7] hover:bg-[#244CD0] text-white font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
