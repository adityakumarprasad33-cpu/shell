'use client';

import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  ShieldCheck,
  Monitor,
  Laptop,
  Terminal,
  Smartphone,
  Zap,
} from 'lucide-react';
import { ReleaseItem } from '@/lib/types/terminal';

interface DownloadCardProps {
  release: ReleaseItem;
  isRecommended?: boolean;
  onViewChecksum: (release: ReleaseItem) => void;
}

export function DownloadCard({
  release,
  isRecommended,
  onViewChecksum,
}: DownloadCardProps) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'windows':
        return <Monitor className="w-5 h-5 text-[#315EF7]" />;
      case 'macos':
        return <Laptop className="w-5 h-5 text-zinc-200" />;
      case 'linux':
        return <Terminal className="w-5 h-5 text-emerald-400" />;
      case 'android':
        return <Smartphone className="w-5 h-5 text-cyan-400" />;
      case 'cli':
      default:
        return <Zap className="w-5 h-5 text-amber-400" />;
    }
  };

  const handleCopyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash.replace(/^sha256:/, ''));
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleDownloadClick = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 3000);
  };

  const displayTitle =
    release.platform === 'windows'
      ? 'Windows Client'
      : release.platform === 'macos'
      ? 'macOS Client'
      : release.platform === 'linux'
      ? 'Linux Package'
      : release.platform === 'android'
      ? 'Android / Termux'
      : 'Runix CLI';

  return (
    <div
      className={`p-6 rounded-2xl bg-[#0E1117] border flex flex-col justify-between transition-all relative ${
        isRecommended
          ? 'border-[#315EF7] shadow-[0_0_30px_rgba(49,94,247,0.15)] ring-1 ring-[#315EF7]'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {isRecommended && (
        <div className="absolute top-4 right-4 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#315EF7] text-white">
          RECOMMENDED FOR YOUR SYSTEM
        </div>
      )}

      <div>
        {/* Header: Platform icon & names */}
        <div className="flex items-center gap-3.5 mb-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            {getPlatformIcon(release.platform)}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{displayTitle}</h3>
            <span className="text-xs font-mono text-zinc-400">
              v{release.version} • {release.architecture}
            </span>
          </div>
        </div>

        {/* Release Notes / description */}
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          {release.releaseNotes}
        </p>

        {/* Quick Install Snippet if available */}
        {release.installCommand && (
          <div className="mb-4 p-2.5 rounded-lg bg-[#090A0F] border border-white/5 flex items-center justify-between text-xs font-mono">
            <code className="text-zinc-300 truncate max-w-[260px]">
              {release.installCommand}
            </code>
            <button
              onClick={() => handleCopyCmd(release.installCommand || '')}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Copy installation command"
            >
              {copiedCmd ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer: SHA-256 + File size + Download action */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="text-[11px] font-mono text-zinc-500">
          <span>{release.fileSize}</span>
          {release.status === 'available' && release.checksum !== 'sha256:pending' && (
            <>
              <span className="mx-1.5">•</span>
              <button
                onClick={() => onViewChecksum(release)}
                className="text-[#315EF7] hover:underline cursor-pointer"
                title="Inspect SHA-256 integrity hash"
              >
                SHA-256
              </button>
            </>
          )}
        </div>

        {release.status === 'comingSoon' ? (
          <span className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-500 bg-white/5 border border-white/5 cursor-not-allowed">
            Coming soon
          </span>
        ) : release.status === 'unavailable' ? (
          <span className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-600 bg-white/5 border border-white/5 cursor-not-allowed">
            Unavailable
          </span>
        ) : (
          <a
            href={release.downloadUrl}
            onClick={handleDownloadClick}
            download={release.filename}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isRecommended
                ? 'bg-[#315EF7] hover:bg-[#254cc9] text-white shadow-[0_0_15px_rgba(49,94,247,0.3)]'
                : 'bg-white/10 hover:bg-white/15 text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
          </a>
        )}
      </div>
    </div>
  );
}
