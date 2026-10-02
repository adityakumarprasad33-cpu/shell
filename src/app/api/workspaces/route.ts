import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';
import { TerminalWorkspace } from '@/lib/types/terminal';
import { OFFICIAL_RUNIX_COMMAND_REFERENCE } from '@/lib/workspace/workspace-storage';
import { FilesystemEngine } from '@/lib/workspace/filesystem-engine';
import fs from 'fs';
import path from 'path';

const LOCAL_STORE_BASE = path.join(process.cwd(), '.runix_cloud_storage');

function getLocalWorkspacesFile(accountId: string): string {
  const safeAcc = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(LOCAL_STORE_BASE, safeAcc);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'workspaces.json');
}

function loadLocalWorkspaces(accountId: string): TerminalWorkspace[] {
  const filePath = getLocalWorkspacesFile(accountId);
  if (!fs.existsSync(filePath)) {
    const defaultWs: TerminalWorkspace = {
      workspaceId: 'default',
      accountId,
      name: 'main-workspace',
      description: 'Primary Runix developer workspace',
      rootPath: `/home/runix/workspaces/main-workspace`,
      fileCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveLocalWorkspaces(accountId, [defaultWs]);
    return [defaultWs];
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) && data.length > 0 ? data : [];
  } catch {
    return [];
  }
}

function saveLocalWorkspaces(accountId: string, list: TerminalWorkspace[]): void {
  const filePath = getLocalWorkspacesFile(accountId);
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const { searchParams } = new URL(request.url);
    const accountId = tokenUser?.uid || searchParams.get('accountId') || 'anonymous_dev';

    const adminDb = getAdminDb();
    if (adminDb && accountId !== 'anonymous_dev') {
      const snap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .get();

      if (!snap.empty) {
        const workspaces = snap.docs.map((d) => ({
          workspaceId: d.id,
          ...d.data(),
        })) as TerminalWorkspace[];
        return NextResponse.json({ workspaces });
      }

      // Bootstrap default workspace if user has none
      const defaultWs: TerminalWorkspace = {
        workspaceId: 'default',
        accountId,
        name: 'main-workspace',
        description: 'Primary Runix developer workspace',
        rootPath: '/home/runix/workspaces/main-workspace',
        fileCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc('default')
        .set(defaultWs);

      return NextResponse.json({ workspaces: [defaultWs] });
    }

    // Local / Offline fallback
    const workspaces = loadLocalWorkspaces(accountId);
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
    const accountId = tokenUser?.uid || body.accountId || 'anonymous_dev';

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Workspace name is required.' }, { status: 400 });
    }

    // Generate safe unique workspace ID
    const sanitizedName = trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const workspaceId = `ws_${Date.now()}_${sanitizedName.substring(0, 16)}`;

    const workspace: TerminalWorkspace = {
      workspaceId,
      accountId,
      name: trimmedName,
      description: description || 'Runix developer workspace',
      rootPath: `/home/runix/workspaces/${trimmedName}`,
      fileCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const adminDb = getAdminDb();
    if (adminDb && accountId !== 'anonymous_dev') {
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
    } else {
      // Local fallback store
      const list = loadLocalWorkspaces(accountId);
      list.push(workspace);
      saveLocalWorkspaces(accountId, list);

      // Seed clean runix-command.txt in local filesystem engine store
      FilesystemEngine.saveFileSync(accountId, workspaceId, 'runix-command.txt', OFFICIAL_RUNIX_COMMAND_REFERENCE);
    }

    return NextResponse.json({ workspace, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, name } = body;
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || body.accountId || 'anonymous_dev';

    const trimmedName = (name || '').trim();
    if (!workspaceId || !trimmedName) {
      return NextResponse.json(
        { error: 'Both workspaceId and new name are required.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const adminDb = getAdminDb();
    let updatedWorkspace: TerminalWorkspace | null = null;

    if (adminDb && accountId !== 'anonymous_dev') {
      const docRef = adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces')
        .doc(workspaceId);

      const snap = await docRef.get();
      if (!snap.exists) {
        return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
      }

      await docRef.update({
        name: trimmedName,
        updatedAt: now,
      });

      const updatedSnap = await docRef.get();
      updatedWorkspace = {
        workspaceId: updatedSnap.id,
        ...updatedSnap.data(),
      } as TerminalWorkspace;
    } else {
      const list = loadLocalWorkspaces(accountId);
      const ws = list.find((w) => w.workspaceId === workspaceId);
      if (!ws) {
        return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
      }
      ws.name = trimmedName;
      ws.updatedAt = now;
      saveLocalWorkspaces(accountId, list);
      updatedWorkspace = ws;
    }

    return NextResponse.json({ workspace: updatedWorkspace, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);

    // Read from body or searchParams
    let workspaceId = searchParams.get('workspaceId');
    let rawAccountId = searchParams.get('accountId');

    if (!workspaceId) {
      try {
        const body = await request.json();
        workspaceId = body.workspaceId;
        rawAccountId = body.accountId;
      } catch {}
    }

    const accountId = tokenUser?.uid || rawAccountId || 'anonymous_dev';

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required for deletion.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (adminDb && accountId !== 'anonymous_dev') {
      const colRef = adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('workspaces');

      const allSnap = await colRef.get();
      if (allSnap.size <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only remaining workspace. Runix requires at least one active workspace.' },
          { status: 400 }
        );
      }

      // Delete workspace doc
      await colRef.doc(workspaceId).delete();
    } else {
      const list = loadLocalWorkspaces(accountId);
      if (list.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only remaining workspace. Runix requires at least one active workspace.' },
          { status: 400 }
        );
      }
      const filtered = list.filter((w) => w.workspaceId !== workspaceId);
      saveLocalWorkspaces(accountId, filtered);

      // Clean up local store file
      const safeAcc = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const wsFile = path.join(LOCAL_STORE_BASE, `${safeAcc}_${workspaceId}.json`);
      if (fs.existsSync(wsFile)) {
        try { fs.unlinkSync(wsFile); } catch {}
      }
    }

    return NextResponse.json({ success: true, deletedWorkspaceId: workspaceId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
