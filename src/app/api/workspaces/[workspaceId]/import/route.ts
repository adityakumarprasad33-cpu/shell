import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';
import JSZip from 'jszip';
import path from 'path';

function sanitizePath(filePath: string): string {
  if (!filePath || filePath.includes('\0') || filePath.includes('..')) {
    throw new Error('Dangerous path traversal pattern detected');
  }
  const normalized = path.posix.normalize(filePath).replace(/^\/+/, '');
  if (normalized.startsWith('../') || normalized === '..') {
    throw new Error('Path traversal pattern detected');
  }
  return normalized;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const { searchParams } = new URL(request.url);
    const accountId = tokenUser?.uid || searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No zip file uploaded' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const importedFiles: string[] = [];
    const adminDb = getAdminDb();

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      let safePath: string;
      try {
        safePath = sanitizePath(relativePath);
      } catch (err: any) {
        return NextResponse.json(
          { error: `Rejected file "${relativePath}": ${err.message}` },
          { status: 400 }
        );
      }

      const content = await zipEntry.async('string');
      const name = path.posix.basename(safePath);
      const fileRecord = {
        path: safePath,
        name,
        type: 'file',
        size: Buffer.byteLength(content, 'utf-8'),
        content,
        updatedAt: new Date().toISOString(),
      };

      if (adminDb) {
        const docId = safePath.replace(/\//g, '__slash__');
        await adminDb
          .collection('terminalAccounts')
          .doc(accountId)
          .collection('workspaces')
          .doc(workspaceId)
          .collection('files')
          .doc(docId)
          .set(fileRecord);
      }
      importedFiles.push(safePath);
    }

    return NextResponse.json({
      success: true,
      importedCount: importedFiles.length,
      files: importedFiles,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
