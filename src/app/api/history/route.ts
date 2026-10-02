import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    const sessionId = searchParams.get('sessionId');
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ history: [] });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ history: [] });
    }

    let collRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('history');

    const snap = await collRef.orderBy('timestamp', 'desc').limit(100).get();
    let records = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (sessionId) {
      records = records.filter((r: any) => r.sessionId === sessionId);
    }

    if (query) {
      records = records.filter((r: any) =>
        r.command?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ history: records });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const historyId = searchParams.get('id');
    const clearAll = searchParams.get('all') === 'true';
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ success: true });
    }

    const historyRef = adminDb
      .collection('terminalAccounts')
      .doc(accountId)
      .collection('history');

    if (clearAll) {
      const snap = await historyRef.limit(500).get();
      const batch = adminDb.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      return NextResponse.json({ success: true, cleared: 'all' });
    }

    if (historyId) {
      await historyRef.doc(historyId).delete();
      return NextResponse.json({ success: true, deleted: historyId });
    }

    return NextResponse.json({ error: 'Missing history id or all=true' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
