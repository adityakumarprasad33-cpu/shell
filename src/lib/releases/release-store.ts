import fs from 'fs';
import path from 'path';
import os from 'os';
import { ReleaseItem } from '@/lib/types/terminal';
import { RUNIX_TERMINAL_RELEASES } from './release-manifest';

function getReleasesFilePath(): string {
  const isServerless = typeof process !== 'undefined' && (
    !!process.env.NETLIFY ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );
  if (isServerless) {
    return path.join(os.tmpdir(), 'runix_data', 'releases.json');
  }
  return path.resolve(process.cwd(), 'data/releases.json');
}

function ensureDirectory(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn('Notice in ensureDirectory for releases:', err);
  }
}

/**
 * Get all current releases from the persistent store
 */
export function getAllReleases(): ReleaseItem[] {
  const file = getReleasesFilePath();
  ensureDirectory(file);
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
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
  const file = getReleasesFilePath();
  ensureDirectory(file);
  try {
    fs.writeFileSync(file, JSON.stringify(releases, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Notice saving releases to store:', err);
  }
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
