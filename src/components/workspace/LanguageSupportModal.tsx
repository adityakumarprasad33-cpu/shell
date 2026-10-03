'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, CheckCircle2, XCircle, Terminal, Cpu, Hammer, Play, Layers } from 'lucide-react';
import { RUNIX_LANGUAGE_REGISTRY, LanguageDefinition } from '@/lib/runtimes/language-registry';
import { FileIcon } from './FileIcon';

interface LanguageSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLanguageSample?: (ext: string) => void;
}

export function LanguageSupportModal({ isOpen, onClose }: LanguageSupportModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const languages = useMemo(() => {
    return Object.values(RUNIX_LANGUAGE_REGISTRY);
  }, []);

  const filteredLanguages = useMemo(() => {
    return languages.filter((lang) => {
      const matchesSearch =
        lang.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lang.languageId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lang.extensions.some((ext) => ext.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lang.runtimeRequirements && lang.runtimeRequirements.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType =
        filterType === 'all' ||
        (filterType === 'compiled' && lang.type === 'compiled') ||
        (filterType === 'interpreted' && lang.type === 'interpreted') ||
        (filterType === 'hybrid' && lang.type === 'hybrid') ||
        (filterType === 'data' && (lang.type === 'data' || lang.type === 'config' || lang.type === 'shell'));

      return matchesSearch && matchesType;
    });
  }, [languages, searchTerm, filterType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-[#0C0E14] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden text-zinc-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0F121C]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#315EF7]/15 border border-[#315EF7]/30 flex items-center justify-center text-[#315EF7]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-white">Universal Runtime Matrix</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  C++20 Core Verified
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Native multi-language execution engine powered by Runix Core
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

        {/* Toolbar: Search & Filters */}
        <div className="px-6 py-3 border-b border-white/[0.06] bg-[#0A0C12] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by language, extension (.awk, .sql, .ts)..."
              className="w-full bg-[#121520] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#315EF7]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            {['all', 'compiled', 'interpreted', 'hybrid', 'data'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-md text-[11px] capitalize transition-colors ${
                  filterType === type
                    ? 'bg-[#315EF7] text-white font-medium shadow-sm shadow-[#315EF7]/40'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Languages List / Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredLanguages.length === 0 ? (
            <div className="col-span-full py-12 text-center text-zinc-500 font-mono text-xs">
              No runtime matches your search query.
            </div>
          ) : (
            filteredLanguages.map((lang: LanguageDefinition) => (
              <div
                key={lang.languageId}
                className="p-4 rounded-xl bg-[#111420]/80 border border-white/[0.06] hover:border-white/15 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <FileIcon filename={`sample${lang.extensions[0] || '.txt'}`} size={20} />
                      <div>
                        <h4 className="font-semibold text-xs text-white group-hover:text-[#315EF7] transition-colors">
                          {lang.displayName}
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                          {lang.type} · {lang.runtimeId}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {lang.runCapability && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          Run
                        </span>
                      )}
                      {lang.buildCapability && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono">
                          <Hammer className="w-2.5 h-2.5" />
                          Build
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {lang.extensions.map((ext) => (
                      <span
                        key={ext}
                        className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 font-mono text-[10px] border border-white/[0.04]"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>

                  {lang.defaultRunCommand && (
                    <div className="bg-[#090B10] px-2.5 py-1.5 rounded-md font-mono text-[11px] text-zinc-400 border border-white/[0.03] flex items-center gap-2 truncate mb-2">
                      <Terminal className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="truncate text-zinc-300">{lang.defaultRunCommand}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>Req: {lang.runtimeRequirements || 'Standard'}</span>
                  <span>{lang.supportedOS.join('/')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-[#0A0C12] flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>{filteredLanguages.length} of {languages.length} runtimes shown</span>
          <span className="text-[11px] text-zinc-400">Runix C++20 Core v2.4</span>
        </div>
      </div>
    </div>
  );
}
