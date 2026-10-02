'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none runix-grid-bg opacity-30" />

      <div className="w-full max-w-md bg-[#0E1117] border border-white/10 rounded-2xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:opacity-90">
            <div className="relative w-8 h-8">
              <Image src="/logo-v2.png" alt="Runix" width={32} height={32} className="object-contain" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-white">Runix</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">RESET PASSWORD</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">Enter your registered email address.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm text-zinc-200">
              Recovery instructions sent to <strong className="text-white">{email}</strong>.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-xs text-[#315EF7] hover:underline font-mono"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1.5">Terminal Account Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@runix.in"
                  className="w-full bg-[#131722] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#315EF7] font-mono transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#315EF7] hover:bg-[#244CD0] text-white text-sm font-medium transition-colors cursor-pointer mt-2 shadow-lg"
            >
              {loading ? 'Sending Recovery Link...' : 'Send Recovery Link'}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
