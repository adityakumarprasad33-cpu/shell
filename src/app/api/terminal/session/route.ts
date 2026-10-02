import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';
import { TerminalSession } from '@/lib/types/terminal';
import { killProcessTree } from '@/lib/terminal/sandbox-runner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, shell = 'bash', workingDirectory = '~', accountId: rawAccountId } = body;

    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || rawAccountId || 'anonymous_dev';

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSession: TerminalSession = {
      sessionId,
      accountId,
      title: title || 'main',
      shell,
      workingDirectory,
      executionMode: 'remote',
      status: 'connected',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    const adminDb = getAdminDb();
    if (adminDb && accountId) {
      try {
        await adminDb
          .collection('terminalAccounts')
          .doc(accountId)
          .collection('sessions')
          .doc(sessionId)
          .set(newSession);
      } catch (err) {
        console.warn('Could not persist session to Firestore:', err);
      }
    }

    return NextResponse.json({ session: newSession });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const accountId = searchParams.get('accountId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  if (adminDb && accountId) {
    try {
      const snap = await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('sessions')
        .doc(sessionId)
        .get();

      if (snap.exists) {
        return NextResponse.json({ session: snap.data() });
      }
    } catch {}
  }

  return NextResponse.json({
    session: {
      sessionId,
      accountId: accountId || 'anonymous_dev',
      title: 'main',
      shell: 'bash',
      workingDirectory: '~',
      executionMode: 'remote',
      status: 'connected',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const accountId = searchParams.get('accountId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  killProcessTree(sessionId);

  const adminDb = getAdminDb();
  if (adminDb && accountId) {
    try {
      await adminDb
        .collection('terminalAccounts')
        .doc(accountId)
        .collection('sessions')
        .doc(sessionId)
        .update({ status: 'terminated' });
    } catch {}
  }

  return NextResponse.json({ success: true, terminated: sessionId });
}

export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, cols, rows } = await request.json();
    return NextResponse.json({ success: true, sessionId, cols, rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
