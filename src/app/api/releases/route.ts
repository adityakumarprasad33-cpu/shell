import { NextRequest, NextResponse } from 'next/server';
import { getAllReleases, getReleaseByPlatform, getLatestRelease } from '@/lib/releases/release-store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const latest = searchParams.get('latest');

  if (latest === 'true') {
    const release = getLatestRelease();
    return NextResponse.json({ release });
  }

  if (platform) {
    const release = getReleaseByPlatform(platform);
    if (!release) {
      return NextResponse.json(
        { error: `No release found for platform: ${platform}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ release });
  }

  const releases = getAllReleases();

  return NextResponse.json({
    releases,
    totalCount: releases.length,
    canonicalDownloadUrl: 'https://console.runix.in/download',
    updatedAt: new Date().toISOString(),
  });
}
