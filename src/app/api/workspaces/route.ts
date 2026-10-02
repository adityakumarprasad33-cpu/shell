import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';
import { TerminalWorkspace } from '@/lib/types/terminal';
import { OFFICIAL_RUNIX_COMMAND_REFERENCE } from '@/lib/workspace/workspace-storage';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const { searchParams } = new URL(request.url);
    const accountId = tokenUser?.uid || searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ workspaces: [] });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      // Fallback workspace
      return NextResponse.json({
        workspaces: [
          {
            workspaceId: 'default',
            accountId,
            name: 'main-workspace',
            description: 'Primary Runix developer workspace',
            rootPath: '/home/runix/workspace',
            fileCount: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    }

    const snap = await adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('workspaces')
      .get();

    const workspaces = snap.docs.map((d) => ({
      workspaceId: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ workspaces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || body.accountId;

    if (!accountId || !name) {
      return NextResponse.json({ error: 'accountId and name required' }, { status: 400 });
    }

    const workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const workspace: TerminalWorkspace = {
      workspaceId,
      accountId,
      name,
      description: description || 'Runix workspace',
      rootPath: `/home/runix/workspaces/${name}`,
      fileCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .set(workspace);

      // Clean account bootstrap: seed exactly ONE file: runix-command.txt
      await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('files')
        .doc('runix-command.txt')
        .set({
          path: 'runix-command.txt',
          name: 'runix-command.txt',
          type: 'file',
          size: Buffer.byteLength(OFFICIAL_RUNIX_COMMAND_REFERENCE, 'utf-8'),
          content: OFFICIAL_RUNIX_COMMAND_REFERENCE,
          updatedAt: new Date().toISOString(),
        });
    }

    return NextResponse.json({ workspace });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
