import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  getAllReleases,
  upsertRelease,
  removeRelease,
  getReleaseById,
} from '@/lib/releases/release-store';
import { ReleaseItem } from '@/lib/types/terminal';
import { verifyPEBinary, formatBytes } from '@/lib/releases/pe-verifier';

// Configurable Super Admin Master Secret Key
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_KEY || 'runix-superadmin-master-2026';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') || '';
  const adminKey = request.headers.get('x-super-admin-key') || '';

  if (adminKey === SUPER_ADMIN_SECRET) return true;
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === SUPER_ADMIN_SECRET) return true;

  // Also allow cookie-based admin session
  const cookieKey = request.cookies.get('super_admin_token')?.value;
  if (cookieKey === SUPER_ADMIN_SECRET) return true;

  return false;
}

/**
 * GET /api/admin/releases
 * List all releases with administrative metadata
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Super Admin access required' },
      { status: 401 }
    );
  }

  const releases = getAllReleases();
  return NextResponse.json({
    authorized: true,
    releases,
    totalCount: releases.length,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * POST /api/admin/releases
 * Upload new executable / app binary or create a release record
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Super Admin access required' },
      { status: 401 }
    );
  }

  const contentType = request.headers.get('content-type') || '';

  // 1. Multipart Form Data (Binary file upload)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const platform = (formData.get('platform') as string) || 'windows';
      const architecture = (formData.get('architecture') as string) || 'x64';
      const version = (formData.get('version') as string) || '0.1.0';
      const artifactType = (formData.get('artifactType') as string) || 'portable';
      const status = (formData.get('status') as string) || 'available';
      const releaseNotes = (formData.get('releaseNotes') as string) || 'Official release update.';
      const publishedAt = (formData.get('publishedAt') as string) || new Date().toISOString().split('T')[0];
      const customFilename = (formData.get('filename') as string) || (file ? file.name : 'runix-artifact');

      let downloadUrl = `/releases/${platform}/${customFilename}`;
      let fileSize = '0 B';
      let checksum = 'sha256:pending';

      if (file) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Compute real SHA-256 hash
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        checksum = `sha256:${hash}`;
        fileSize = formatBytes(buffer.length);

        // Save file to public release storage
        const targetDir = path.resolve(process.cwd(), `public/releases/${platform}`);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const filePath = path.join(targetDir, customFilename);
        fs.writeFileSync(filePath, buffer);

        // Also save to versioned directory for immutability
        const versionDir = path.resolve(process.cwd(), `public/releases/v${version}/${platform}/${architecture}`);
        if (!fs.existsSync(versionDir)) {
          fs.mkdirSync(versionDir, { recursive: true });
        }
        fs.writeFileSync(path.join(versionDir, customFilename), buffer);

        // Optional PE verification for Windows
        if (platform === 'windows' && customFilename.endsWith('.exe')) {
          const pe = verifyPEBinary(filePath);
          if (!pe.isValidPE) {
            console.warn('Uploaded Windows binary PE check warning:', pe.error);
          }
        }
      }

      const releaseId = `${platform}-${architecture}-v${version}`;
      const newRelease: ReleaseItem = {
        releaseId,
        version,
        platform: platform as any,
        architecture,
        artifactType: artifactType as any,
        downloadUrl,
        filename: customFilename,
        checksum,
        fileSize,
        releaseNotes,
        publishedAt,
        status: status as any,
        isAvailable: status === 'available',
      };

      const updated = upsertRelease(newRelease);

      return NextResponse.json({
        success: true,
        message: `Release ${releaseId} published successfully by Super Admin`,
        release: newRelease,
        allReleases: updated,
      });
    } catch (err: any) {
      console.error('Release upload failed:', err);
      return NextResponse.json(
        { error: `Release upload failed: ${err.message}` },
        { status: 500 }
      );
    }
  }

  // 2. Direct JSON Release metadata creation
  try {
    const body = await request.json();
    if (!body.platform || !body.version || !body.filename) {
      return NextResponse.json(
        { error: 'platform, version, and filename are required' },
        { status: 400 }
      );
    }

    const releaseId = body.releaseId || `${body.platform}-${body.architecture || 'x64'}-v${body.version}`;
    const newRelease: ReleaseItem = {
      releaseId,
      version: body.version,
      platform: body.platform,
      architecture: body.architecture || 'x64',
      artifactType: body.artifactType || 'portable',
      downloadUrl: body.downloadUrl || `/releases/${body.platform}/${body.filename}`,
      filename: body.filename,
      checksum: body.checksum || 'sha256:pending',
      fileSize: body.fileSize || 'Pending',
      releaseNotes: body.releaseNotes || 'Official release update.',
      publishedAt: body.publishedAt || new Date().toISOString().split('T')[0],
      status: body.status || 'available',
      isAvailable: body.status === 'available',
      installCommand: body.installCommand,
    };

    const updated = upsertRelease(newRelease);

    return NextResponse.json({
      success: true,
      message: `Release ${releaseId} published successfully by Super Admin`,
      release: newRelease,
      allReleases: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to process release: ${err.message}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/releases
 * Update existing release metadata
 */
export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Super Admin access required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const targetId = body.originalReleaseId || body.releaseId;
    if (!targetId) {
      return NextResponse.json(
        { error: 'releaseId is required for update' },
        { status: 400 }
      );
    }

    const existing = getReleaseById(targetId);
    if (!existing) {
      return NextResponse.json(
        { error: `Release ${targetId} not found` },
        { status: 404 }
      );
    }

    // If releaseId has changed, remove the old one first
    if (body.releaseId && body.releaseId !== targetId) {
      removeRelease(targetId);
    }

    const merged: ReleaseItem = {
      ...existing,
      ...body,
      isAvailable: body.status ? body.status === 'available' : existing.isAvailable,
    };

    const updated = upsertRelease(merged);

    return NextResponse.json({
      success: true,
      message: `Release ${merged.releaseId} updated successfully`,
      release: merged,
      allReleases: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to update release: ${err.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/releases
 * Withdraw / Delete a release
 */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Super Admin access required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get('releaseId');

  if (!releaseId) {
    return NextResponse.json(
      { error: 'releaseId parameter is required' },
      { status: 400 }
    );
  }

  const updated = removeRelease(releaseId);

  return NextResponse.json({
    success: true,
    message: `Release ${releaseId} withdrawn successfully by Super Admin`,
    allReleases: updated,
  });
}
