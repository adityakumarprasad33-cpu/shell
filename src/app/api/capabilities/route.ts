import { NextRequest, NextResponse } from 'next/server';
import { resolveFileCapabilities } from '@/lib/runtimes/capability-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const workspaceId = searchParams.get('workspaceId') || 'default';

    if (!file) {
      return NextResponse.json(
        { error: 'Query parameter "file" is required.' },
        { status: 400 }
      );
    }

    const state = await resolveFileCapabilities(file);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Capability resolution failed: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, workspaceId = 'default' } = body;

    if (!file) {
      return NextResponse.json(
        { error: 'Property "file" is required in request body.' },
        { status: 400 }
      );
    }

    const state = await resolveFileCapabilities(file);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Capability resolution failed: ${error.message}` },
      { status: 500 }
    );
  }
}
