/**
 * Runix Platform - Safe JSON Fetch Utility
 * Prevents "Unexpected token 'I', 'Internal Server Error' is not valid JSON" SyntaxErrors
 * by inspecting response content-type, status, and handling non-JSON error payloads gracefully.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeParseResponse<T = any>(res: Response): Promise<SafeFetchResult<T>> {
  try {
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const rawText = await res.text().catch(() => '');
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: rawText.trim() || `HTTP ${res.status}: ${res.statusText || 'Internal Server Error'}`,
        };
      }
      return {
        ok: true,
        status: res.status,
        data: rawText as any,
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: data?.message || data?.error || `HTTP ${res.status} error`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: res.status || 0,
      error: err?.message || 'Failed to parse server response',
    };
  }
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    return await safeParseResponse<T>(res);
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Network request failed',
    };
  }
}
