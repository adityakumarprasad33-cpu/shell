import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/server/firebase-admin';

// In-memory cache fallback for device authorization codes
const deviceCodesMap = new Map<
  string,
  {
    deviceCode: string;
    userCode: string;
    expiresAt: number;
    status: 'pending' | 'authorized' | 'expired';
    token?: string;
    accountId?: string;
  }
>();

export async function POST(_request: NextRequest) {
  try {
    const deviceCode = crypto.randomBytes(24).toString('hex');
    const userCode = `RNX-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const payload = {
      deviceCode,
      userCode,
      verificationUri: 'https://console.runix.in/auth/device',
      expiresAt,
      interval: 3,
      status: 'pending' as const,
    };

    deviceCodesMap.set(deviceCode, payload);
    deviceCodesMap.set(userCode, payload);

    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb.collection('deviceCodes').doc(deviceCode).set(payload);
        await adminDb.collection('deviceCodes').doc(userCode).set({ deviceCode });
      } catch {}
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceCode = searchParams.get('deviceCode');

  if (!deviceCode) {
    return NextResponse.json({ error: 'deviceCode required' }, { status: 400 });
  }

  let codeRecord = deviceCodesMap.get(deviceCode);

  if (!codeRecord) {
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        const snap = await adminDb.collection('deviceCodes').doc(deviceCode).get();
        if (snap.exists) {
          codeRecord = snap.data() as any;
        }
      } catch {}
    }
  }

  if (!codeRecord) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  }

  if (Date.now() > codeRecord.expiresAt) {
    return NextResponse.json({ status: 'expired' });
  }

  return NextResponse.json({
    status: codeRecord.status,
    token: codeRecord.token,
    accountId: codeRecord.accountId,
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userCode, accountId, token } = body;

    if (!userCode || !accountId) {
      return NextResponse.json({ error: 'userCode and accountId required' }, { status: 400 });
    }

    const codeRecord = deviceCodesMap.get(userCode);
    if (!codeRecord) {
      return NextResponse.json({ error: 'Invalid or expired user code' }, { status: 404 });
    }

    codeRecord.status = 'authorized';
    codeRecord.accountId = accountId;
    codeRecord.token = token || `token_${Date.now()}_${accountId.substring(0, 8)}`;

    deviceCodesMap.set(codeRecord.deviceCode, codeRecord);
    deviceCodesMap.set(userCode, codeRecord);

    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb.collection('deviceCodes').doc(codeRecord.deviceCode).update({
          status: 'authorized',
          accountId,
          token: codeRecord.token,
        });
      } catch {}
    }

    return NextResponse.json({ success: true, message: 'CLI successfully authorized!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
