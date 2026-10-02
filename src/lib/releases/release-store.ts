import fs from 'fs';
import path from 'path';
import { ReleaseItem } from '@/lib/types/terminal';
import { RUNIX_TERMINAL_RELEASES } from './release-manifest';

const RELEASES_FILE = path.resolve(process.cwd(), 'data/releases.json');

function ensureDirectory() {
  const dir = path.dirname(RELEASES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get all current releases from the persistent store
 */
export function getAllReleases(): ReleaseItem[] {
  ensureDirectory();
  try {
    if (fs.existsSync(RELEASES_FILE)) {
      const content = fs.readFileSync(RELEASES_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to read releases from store:', err);
  }

  // Fallback to static manifest if store not yet written
  return [...RUNIX_TERMINAL_RELEASES];
}

/**
 * Save all releases to the persistent store
 */
export function saveAllReleases(releases: ReleaseItem[]): void {
  ensureDirectory();
  fs.writeFileSync(RELEASES_FILE, JSON.stringify(releases, null, 2), 'utf-8');
}

/**
 * Get a single release by ID or Platform
 */
export function getReleaseById(releaseId: string): ReleaseItem | undefined {
  const list = getAllReleases();
  return list.find((r) => r.releaseId === releaseId);
}

export function getReleaseByPlatform(platform: string): ReleaseItem | undefined {
  const list = getAllReleases();
  return list.find((r) => r.platform.toLowerCase() === platform.toLowerCase());
}

/**
 * Get the latest active release published by the Super Admin
 */
export function getLatestRelease(): ReleaseItem {
  const list = getAllReleases();
  const available = list.filter((r) => r.status === 'available');
  if (available.length > 0) {
    return available[0];
  }
  return list[0];
}

/**
 * Create or update a release (Super Admin operation)
 */
export function upsertRelease(release: ReleaseItem): ReleaseItem[] {
  const list = getAllReleases();
  const idx = list.findIndex((r) => r.releaseId === release.releaseId);

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...release };
  } else {
    list.unshift(release);
  }

  saveAllReleases(list);
  return list;
}

/**
 * Delete a release by ID (Super Admin operation)
 */
export function removeRelease(releaseId: string): ReleaseItem[] {
  const list = getAllReleases();
  const filtered = list.filter((r) => r.releaseId !== releaseId);
  saveAllReleases(filtered);
  return filtered;
}
