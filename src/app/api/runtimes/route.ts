import { NextRequest, NextResponse } from 'next/server';
import {
  RUNTIME_REGISTRY,
  RuntimeDefinition,
  getRegistryStatistics,
} from '@/lib/runtimes/registry';
import { searchRuntimes, getRuntimesForExtension } from '@/lib/runtimes/resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const verifiedOnly = searchParams.get('verified') === 'true';
    const query = searchParams.get('q') || searchParams.get('search');
    const ext = searchParams.get('ext');

    // Single runtime lookup
    if (id) {
      const runtimeDef = RUNTIME_REGISTRY[id.toLowerCase()];
      if (!runtimeDef) {
        return NextResponse.json(
          { error: `Runtime '${id}' not found in registry.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ runtime: runtimeDef });
    }

    // Extension lookup
    if (ext) {
      const matched = getRuntimesForExtension(ext);
      return NextResponse.json({
        extension: ext,
        count: matched.length,
        runtimes: matched,
      });
    }

    let results: RuntimeDefinition[] = Object.values(RUNTIME_REGISTRY);

    // Search query
    if (query) {
      results = searchRuntimes(query);
    }

    // Type filter
    if (type) {
      results = results.filter((r) => r.type.toLowerCase() === type.toLowerCase());
    }

    // Verified filter
    if (verifiedOnly) {
      results = results.filter((r) => r.verificationStatus === 'PASS');
    }

    const statistics = getRegistryStatistics();

    return NextResponse.json({
      status: 'success',
      totalCount: results.length,
      statistics,
      runtimes: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to retrieve runtime registry data: ${error.message}` },
      { status: 500 }
    );
  }
}
