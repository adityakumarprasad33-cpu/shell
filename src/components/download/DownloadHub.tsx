'use client';

import React, { useState, useEffect } from 'react';
import { ReleaseItem } from '@/lib/types/terminal';
import { DownloadNavbar } from './DownloadNavbar';
import { DownloadHero } from './DownloadHero';
import { PlatformSelector } from './PlatformSelector';
import { DownloadCard } from './DownloadCard';
import { CliInstall } from './CliInstall';
import { InstallGuide } from './InstallGuide';
import { ReleaseInfo } from './ReleaseInfo';
import { SystemRequirements } from './SystemRequirements';
import { VerificationSection } from './VerificationSection';
import { DownloadFaq } from './DownloadFaq';
import { ChecksumModal } from './ChecksumModal';
import { EcosystemFooter } from './EcosystemFooter';
import { safeFetchJson } from '@/lib/safe-json';

export function DownloadHub() {
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [detectedPlatform, setDetectedPlatform] = useState<string>('windows');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [activeChecksum, setActiveChecksum] = useState<ReleaseItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Platform detection & API release fetch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes('android')) {
        setDetectedPlatform('android');
      } else if (ua.includes('mac')) {
        setDetectedPlatform('macos');
      } else if (ua.includes('linux')) {
        setDetectedPlatform('linux');
      } else if (ua.includes('win')) {
        setDetectedPlatform('windows');
      }
    }

    safeFetchJson<{ releases?: ReleaseItem[] }>('/api/releases')
      .then((res) => {
        if (res.ok && res.data?.releases) {
          setReleases(res.data.releases);
        }
      })
      .catch((err) => console.error('Failed to load release manifest:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleScrollToPlatforms = () => {
    const el = document.getElementById('platforms');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const cliRelease = releases.find((r) => r.platform === 'cli');
  const recommendedRelease = releases.find((r) => r.platform === detectedPlatform);

  // Filter releases for download cards
  const filteredReleases = releases.filter((r) => {
    if (selectedFilter === 'all') return true;
    return r.platform === selectedFilter;
  });

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6] flex flex-col font-sans selection:bg-[#315EF7]/30 selection:text-white">
      {/* 1. Navbar */}
      <DownloadNavbar />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* 2. Hero Section */}
        <DownloadHero
          detectedPlatform={detectedPlatform}
          recommendedRelease={recommendedRelease}
          onScrollToPlatforms={handleScrollToPlatforms}
        />

        {/* 3. Platform Detection / Download Cards */}
        <PlatformSelector
          detectedPlatform={detectedPlatform}
          selectedFilter={selectedFilter}
          onSelectFilter={setSelectedFilter}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
          {loading ? (
            <div className="col-span-full py-12 text-center text-zinc-500 font-mono text-xs">
              Loading verified Runix releases...
            </div>
          ) : (
            filteredReleases.map((release) => (
              <DownloadCard
                key={release.releaseId}
                release={release}
                isRecommended={release.platform === detectedPlatform}
                onViewChecksum={(item) => setActiveChecksum(item)}
              />
            ))
          )}
        </div>

        {/* 4. CLI Installation */}
        <CliInstall cliRelease={cliRelease} />

        {/* 5. Installation Information */}
        <InstallGuide />

        {/* 6. Release Information */}
        <ReleaseInfo />

        {/* 7. System Requirements */}
        <SystemRequirements />

        {/* 8. Verification / Checksums */}
        <VerificationSection
          releases={releases}
          onSelectRelease={(item) => setActiveChecksum(item)}
        />

        {/* 9. FAQ */}
        <DownloadFaq />
      </main>

      {/* Checksum Modal Popup */}
      <ChecksumModal
        release={activeChecksum}
        onClose={() => setActiveChecksum(null)}
      />

      {/* 10. Ecosystem Footer */}
      <EcosystemFooter />
    </div>
  );
}
