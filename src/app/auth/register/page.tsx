'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Mail, User, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { LegalModal } from '@/components/legal/LegalModal';

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions and Privacy Policy to register.');
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName || email.split('@')[0]);
      router.push('/');
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Failed to create terminal account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError(null);

    if (!termsAccepted) {
      setError('Please check the Terms & Conditions and Privacy Policy agreement checkbox before registering with Google.');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Failed to register with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6] flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
      <div className="fixed inset-0 pointer-events-none runix-grid-bg opacity-30" />

      <div className="w-full max-w-md bg-[#0E1117] border border-white/10 rounded-2xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:opacity-90">
            <div className="relative w-8 h-8">
              <Image src="/logo-v2.png" alt="Runix" width={32} height={32} className="object-contain" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-white font-mono">Runix</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">CREATE TERMINAL ACCOUNT</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">Dedicated cloud sandboxes and workspaces.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">Developer Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full bg-[#131722] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#315EF7] font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@runix.in"
                className="w-full bg-[#131722] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#315EF7] font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#131722] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#315EF7] font-mono transition-colors"
              />
            </div>
          </div>

          {/* Mandatory Checkbox for T&C and Privacy Policy */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 text-xs text-zinc-300 font-sans cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (error?.includes('Terms & Conditions')) setError(null);
                }}
                className="mt-0.5 rounded bg-[#131722] border-white/20 text-[#315EF7] focus:ring-0 cursor-pointer w-4 h-4 accent-[#315EF7]"
              />
              <span className="text-[12px] leading-snug">
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="text-[#315EF7] hover:underline font-semibold"
                >
                  Terms & Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  Privacy Policy
                </button>
                .
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#315EF7] hover:bg-[#244CD0] text-white text-xs font-semibold uppercase tracking-wider font-mono transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-lg disabled:opacity-50"
          >
            <span>{loading ? 'Creating Account...' : 'Initialize Terminal Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] font-mono text-zinc-500">OR REGISTER WITH</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google Registration */}
        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2.5 font-sans cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-zinc-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#315EF7] hover:underline font-medium">
            Sign In
          </Link>
        </div>
      </div>

      <LegalModal
        isOpen={legalModal !== null}
        type={legalModal}
        onClose={() => setLegalModal(null)}
        onAccept={() => setTermsAccepted(true)}
      />
    </div>
  );
}
