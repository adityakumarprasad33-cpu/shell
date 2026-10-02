'use client';

import React, { useState, useMemo } from 'react';
import {
  RUNTIME_REGISTRY,
  RuntimeDefinition,
  getRegistryStatistics,
} from '@/lib/runtimes/registry';
import { Search, CheckCircle2, AlertCircle, Clock, ShieldCheck, Terminal, Cpu, Box } from 'lucide-react';

export function RuntimeRegistrySection() {
  const stats = useMemo(() => getRegistryStatistics(), []);
  const allRuntimes = useMemo(() => Object.values(RUNTIME_REGISTRY), []);

  const [activeTab, setActiveTab] = useState<'all' | 'verified' | 'languages' | 'frameworks' | 'databases' | 'tools'>('verified');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeDefinition | null>(
    RUNTIME_REGISTRY['python'] || null
  );

  // Filter runtimes
  const filteredRuntimes = useMemo(() => {
    let list = allRuntimes;

    if (activeTab === 'verified') {
      list = list.filter((r) => r.verificationStatus === 'PASS');
    } else if (activeTab === 'languages') {
      list = list.filter((r) => r.type === 'language');
    } else if (activeTab === 'frameworks') {
      list = list.filter((r) => r.type === 'framework');
    } else if (activeTab === 'databases') {
      list = list.filter((r) => r.type === 'database');
    } else if (activeTab === 'tools') {
      list = list.filter((r) => r.type === 'tool' || r.type === 'compiler' || r.type === 'interpreter' || r.type === 'shell');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          r.extensions.some((ext) => ext.toLowerCase().includes(q)) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // Sort verified first, then alphabetical
    return list.sort((a, b) => {
      if (a.verificationStatus === 'PASS' && b.verificationStatus !== 'PASS') return -1;
      if (a.verificationStatus !== 'PASS' && b.verificationStatus === 'PASS') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allRuntimes, activeTab, searchQuery]);

  return (
    <section id="runtimes" className="border-t border-white/[0.08] bg-[#09090B] py-24 sm:py-32">
      <div className="max-w-[1280px] mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#71717A]">
                Runtime & Environment Registry
              </span>
            </div>
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-[-0.02em] text-white">
              Universal Multi-Language Runtime Matrix
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#A1A1AA] max-w-2xl mt-2 leading-relaxed">
              Every environment capability in Runix is verified against real execution benchmarks.
              We do not claim support for compilers or runtimes that have not passed automated verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded border border-white/[0.08] bg-[#0F0F11] text-[12px] font-mono text-[#A1A1AA]">
              <span className="text-white font-semibold">{stats.totalTargetBenchmark}</span> Benchmark Catalog
            </div>
            <div className="px-3.5 py-1.5 rounded border border-[#22C55E]/30 bg-[#22C55E]/10 text-[12px] font-mono text-[#22C55E]">
              <span className="font-semibold">{stats.verifiedCount}</span> Host Verified
            </div>
          </div>
        </div>

        {/* Telemetry Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg border border-white/[0.06] bg-[#0C0E12]">
            <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">Catalog Target</div>
            <div className="text-[26px] font-bold text-white mt-1 font-mono">{stats.totalTargetBenchmark}</div>
            <div className="text-[12px] text-[#52525B] mt-0.5">Industry benchmark scope</div>
          </div>
          <div className="p-4 rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/[0.02]">
            <div className="text-[11px] font-mono text-[#22C55E] uppercase tracking-wider">Verified PASS</div>
            <div className="text-[26px] font-bold text-[#22C55E] mt-1 font-mono">{stats.passCount}</div>
            <div className="text-[12px] text-[#71717A] mt-0.5">Automated test verified</div>
          </div>
          <div className="p-4 rounded-lg border border-white/[0.06] bg-[#0C0E12]">
            <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">Languages & Compilers</div>
            <div className="text-[26px] font-bold text-white mt-1 font-mono">{stats.languagesCount}</div>
            <div className="text-[12px] text-[#52525B] mt-0.5">Primary languages indexed</div>
          </div>
          <div className="p-4 rounded-lg border border-white/[0.06] bg-[#0C0E12]">
            <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">Database & Frameworks</div>
            <div className="text-[26px] font-bold text-white mt-1 font-mono">{stats.databasesCount + stats.frameworksCount}</div>
            <div className="text-[12px] text-[#52525B] mt-0.5">Ecosystem components</div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-white/[0.08] bg-[#0C0E12]">
            <button
              onClick={() => setActiveTab('verified')}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                activeTab === 'verified'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Host Verified ({stats.verifiedCount})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              All Benchmark ({stats.totalTargetBenchmark})
            </button>
            <button
              onClick={() => setActiveTab('languages')}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                activeTab === 'languages'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Languages ({stats.languagesCount})
            </button>
            <button
              onClick={() => setActiveTab('frameworks')}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                activeTab === 'frameworks'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Frameworks ({stats.frameworksCount})
            </button>
            <button
              onClick={() => setActiveTab('databases')}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                activeTab === 'databases'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Databases ({stats.databasesCount})
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                activeTab === 'tools'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Tools & Shells ({stats.toolsCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-[#52525B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search language, ext (.py, .rs)..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-white/[0.08] bg-[#0C0E12] text-[12px] text-white placeholder-[#52525B] focus:outline-none focus:border-white/[0.2]"
            />
          </div>
        </div>

        {/* Matrix & Detail Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Table — Left 8 cols */}
          <div className="lg:col-span-7 xl:col-span-8 rounded-lg border border-white/[0.08] bg-[#0C0E12] overflow-hidden">
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[12px] font-mono">
                <thead className="sticky top-0 bg-[#0F0F11] border-b border-white/[0.08] z-10 text-[11px] text-[#71717A] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Environment</th>
                    <th className="py-2.5 px-3 font-medium">Type</th>
                    <th className="py-2.5 px-3 font-medium">Version</th>
                    <th className="py-2.5 px-3 font-medium">Verification</th>
                    <th className="py-2.5 px-4 font-medium text-right">Extensions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredRuntimes.map((r) => {
                    const isSelected = selectedRuntime?.id === r.id;
                    const isVerified = r.verificationStatus === 'PASS';

                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRuntime(r)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-white/[0.08]'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{r.name}</span>
                            <span className="text-[10px] text-[#52525B]">({r.id})</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[#A1A1AA]">{r.type}</td>
                        <td className="py-2.5 px-3 text-[#71717A]">{r.version}</td>
                        <td className="py-2.5 px-3">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" />
                              {r.status === 'comingSoon' ? 'PLANNED' : r.status.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#52525B] text-[11px]">
                          {r.extensions.length > 0 ? r.extensions.slice(0, 3).join(', ') : 'manifest'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRuntimes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#52525B]">
                        No matching runtimes found in registry for "{searchQuery}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-white/[0.06] bg-[#0F0F11] flex items-center justify-between text-[11px] text-[#52525B]">
              <span>Showing {filteredRuntimes.length} of {allRuntimes.length} environments</span>
              <span>Audit rule: Non-verified environments are marked strictly</span>
            </div>
          </div>

          {/* Runtime Inspector Detail Card — Right 4-5 cols */}
          <div className="lg:col-span-5 xl:col-span-4 rounded-lg border border-white/[0.08] bg-[#0C0E12] p-6 sticky top-24">
            {selectedRuntime ? (
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#71717A]">
                      {selectedRuntime.type}
                    </span>
                    <h3 className="text-[20px] font-bold text-white tracking-tight mt-0.5">
                      {selectedRuntime.name}
                    </h3>
                  </div>
                  {selectedRuntime.verificationStatus === 'PASS' ? (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2 py-0.5 rounded">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      VERIFIED
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#71717A] bg-white/[0.05] border border-white/[0.1] px-2 py-0.5 rounded">
                      <Clock className="w-3.5 h-3.5" />
                      IN ROADMAP
                    </div>
                  )}
                </div>

                <p className="text-[13px] text-[#A1A1AA] leading-relaxed mb-6">
                  {selectedRuntime.description}
                </p>

                {/* Commands */}
                <div className="space-y-3 font-mono text-[11px] mb-6">
                  {selectedRuntime.runCommand && (
                    <div>
                      <div className="text-[10px] text-[#52525B] uppercase mb-1">Execution Command</div>
                      <div className="p-2.5 rounded bg-[#09090B] border border-white/[0.06] text-[#22C55E] overflow-x-auto">
                        {selectedRuntime.runCommand}
                      </div>
                    </div>
                  )}

                  {selectedRuntime.buildCommand && (
                    <div>
                      <div className="text-[10px] text-[#52525B] uppercase mb-1">Compiler / Build Command</div>
                      <div className="p-2.5 rounded bg-[#09090B] border border-white/[0.06] text-[#315EF7] overflow-x-auto">
                        {selectedRuntime.buildCommand}
                      </div>
                    </div>
                  )}

                  {selectedRuntime.packageManager && (
                    <div>
                      <div className="text-[10px] text-[#52525B] uppercase mb-1">Package Manager</div>
                      <div className="p-2 rounded bg-[#09090B] border border-white/[0.06] text-[#E4E4E7]">
                        {selectedRuntime.packageManager}
                      </div>
                    </div>
                  )}
                </div>

                {/* Verification Capabilities Checklist */}
                <div className="border-t border-white/[0.06] pt-4 mb-6">
                  <div className="text-[10px] font-mono text-[#52525B] uppercase mb-3">Verified Capabilities</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={selectedRuntime.verifiedCapabilities.run ? 'text-[#22C55E]' : 'text-[#52525B]'}>
                        {selectedRuntime.verifiedCapabilities.run ? '✓' : '—'}
                      </span>
                      <span className="text-[#A1A1AA]">Run Execution</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={selectedRuntime.verifiedCapabilities.build ? 'text-[#22C55E]' : 'text-[#52525B]'}>
                        {selectedRuntime.verifiedCapabilities.build ? '✓' : '—'}
                      </span>
                      <span className="text-[#A1A1AA]">Compilation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={selectedRuntime.verifiedCapabilities.multiFile ? 'text-[#22C55E]' : 'text-[#52525B]'}>
                        {selectedRuntime.verifiedCapabilities.multiFile ? '✓' : '—'}
                      </span>
                      <span className="text-[#A1A1AA]">Multi-File Projects</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={selectedRuntime.verifiedCapabilities.packages ? 'text-[#22C55E]' : 'text-[#52525B]'}>
                        {selectedRuntime.verifiedCapabilities.packages ? '✓' : '—'}
                      </span>
                      <span className="text-[#A1A1AA]">Package Support</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={selectedRuntime.verifiedCapabilities.stdin ? 'text-[#22C55E]' : 'text-[#52525B]'}>
                        {selectedRuntime.verifiedCapabilities.stdin ? '✓' : '—'}
                      </span>
                      <span className="text-[#A1A1AA]">Standard Input (PTY)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={selectedRuntime.verifiedCapabilities.test ? 'text-[#22C55E]' : 'text-[#52525B]'}>
                        {selectedRuntime.verifiedCapabilities.test ? '✓' : '—'}
                      </span>
                      <span className="text-[#A1A1AA]">Test Suites</span>
                    </div>
                  </div>
                </div>

                {/* Resource Limits */}
                <div className="p-3 rounded bg-[#09090B] border border-white/[0.06] text-[11px] font-mono text-[#71717A] space-y-1">
                  <div className="flex justify-between">
                    <span>Memory Sandbox:</span>
                    <span className="text-white">{selectedRuntime.resourceProfile.memoryLimit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Execution Timeout:</span>
                    <span className="text-white">{selectedRuntime.resourceProfile.timeoutSec}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network Policy:</span>
                    <span className="text-white uppercase">{selectedRuntime.networkPolicy}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-[#52525B] text-[13px]">
                Select any environment from the matrix to inspect verified capabilities.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
