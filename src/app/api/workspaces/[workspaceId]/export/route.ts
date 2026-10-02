import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';
import JSZip from 'jszip';

export async function GET(
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

    const adminDb = getAdminDb();
    const zip = new JSZip();

    if (adminDb) {
      const snap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .get();

      for (const doc of snap.docs) {
        const file = doc.data();
        if (file.path && file.content !== undefined) {
          zip.file(file.path, file.content);
        }
      }
    } else {
      // Default fallback starter files
      zip.file('README.md', '# Runix Terminal Project\nExported from Runix Terminal.\n');
      zip.file('main.py', 'print("Hello from Runix Terminal!")\n');
      zip.file('runix.json', '{\n  "name": "runix-project"\n}\n');
    }

    const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="runix-${workspaceId}.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
