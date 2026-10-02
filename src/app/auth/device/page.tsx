'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Terminal, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

function DeviceAuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, terminalAccount, loading: authLoading } = useAuth();

  const codeParam = searchParams.get('code') || '';
  const [userCode, setUserCode] = useState(codeParam);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codeParam) {
      setUserCode(codeParam);
    }
  }, [codeParam]);

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCode.trim() || !user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/device-code', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCode: userCode.trim().toUpperCase(),
          accountId: terminalAccount?.accountId || user.uid,
          token,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAuthorized(true);
      } else {
        setError(data.error || 'Failed to authorize device');
      }
    } catch (err: any) {
      setError(err.message || 'Authorization failed');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-center text-zinc-400 font-mono text-xs">Authenticating...</div>;
  }

  if (!user) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Sign In Required</h2>
        <p className="text-xs text-zinc-400">
          You must sign in to your Runix Terminal account to authorize the CLI client.
        </p>
        <Link
          href={`/auth/login?redirect=/auth/device${userCode ? `?code=${userCode}` : ''}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#315EF7] text-white text-xs font-medium hover:bg-[#244CD0]"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      {authorized ? (
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">CLI Authorized!</h2>
          <p className="text-xs text-zinc-400">
            Your terminal CLI is now connected to account{' '}
            <strong className="text-white">{terminalAccount?.displayName}</strong>. You may close this
            window and return to your terminal.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#315EF7] hover:underline font-mono"
          >
            <span>Open Web Terminal Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleAuthorize} className="space-y-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300">
            Connecting as: <strong className="text-white">{terminalAccount?.email || user.email}</strong>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">User Verification Code</label>
            <input
              type="text"
              required
              placeholder="RNX-XXXX"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              className="w-full bg-[#131722] border border-white/10 rounded-lg px-3 py-2 text-center text-lg tracking-widest text-[#00E5FF] placeholder-zinc-600 outline-none focus:border-[#315EF7] font-mono transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !userCode.trim()}
            className="w-full py-2.5 rounded-lg bg-[#315EF7] hover:bg-[#244CD0] text-white text-sm font-medium transition-colors cursor-pointer mt-2 shadow-lg"
          >
            {loading ? 'Authorizing CLI...' : 'Approve CLI Authorization'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function DeviceAuthPage() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none runix-grid-bg opacity-30" />

      <div className="w-full max-w-md bg-[#0E1117] border border-white/10 rounded-2xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:opacity-90">
            <div className="relative w-8 h-8">
              <Image src="/logo-v2.png" alt="Runix" width={32} height={32} className="object-contain" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-white">Runix</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white">AUTHORIZE RUNIX CLI</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">Secure device handshake for terminal client.</p>
        </div>

        <Suspense fallback={<div className="p-4 text-center text-xs text-zinc-400">Loading...</div>}>
          <DeviceAuthContent />
        </Suspense>
      </div>
    </div>
  );
}
