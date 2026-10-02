'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldAlert,
  Upload,
  Key,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  Terminal,
  FileCheck,
  RefreshCw,
  AlertTriangle,
  Lock,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { ReleaseItem } from '@/lib/types/terminal';

export function ReleaseCmsHub() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New release form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState<string>('windows');
  const [architecture, setArchitecture] = useState<string>('x64');
  const [version, setVersion] = useState<string>('0.1.0');
  const [artifactType, setArtifactType] = useState<string>('portable');
  const [status, setStatus] = useState<string>('available');
  const [publishedAt, setPublishedAt] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Editing modal/state
  const [editingRelease, setEditingRelease] = useState<ReleaseItem | null>(null);
  const [originalReleaseId, setOriginalReleaseId] = useState<string | null>(null);

  // Terminal preview output state
  const [terminalPreview, setTerminalPreview] = useState<string>('');

  useEffect(() => {
    // Check saved super admin key
    const saved = localStorage.getItem('runix_super_admin_key');
    if (saved) {
      setAdminKey(saved);
      verifyKey(saved);
    }
  }, []);

  const verifyKey = async (keyToTest: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/releases', {
        headers: { 'x-super-admin-key': keyToTest },
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        setIsAuthenticated(true);
        localStorage.setItem('runix_super_admin_key', keyToTest);
        setReleases(data.releases || []);
        fetchTerminalPreview();
      } else {
        setIsAuthenticated(false);
        setAuthError(data.error || 'Invalid Super Admin Access Key');
      }
    } catch (err: any) {
      setAuthError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyKey(adminKey);
  };

  const handleLogout = () => {
    localStorage.removeItem('runix_super_admin_key');
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const fetchTerminalPreview = async () => {
    try {
      const res = await fetch('/api/releases?latest=true');
      const data = await res.json();
      const r = data.release;
      if (r) {
        setTerminalPreview(`RUNIX TERMINAL v${r.version}  (Official Release)
  Release Date:  ${r.publishedAt}
  Distribution:  ${r.platform.toUpperCase()} (${r.architecture})
  Artifact:      ${r.filename} (${r.fileSize})
  SHA-256 Hash:  ${r.checksum}
  Status:        ${r.status === 'available' ? 'Production GA' : 'Pipeline Processing'}
  Download Hub:  https://console.runix.in/download`);
      }
    } catch {}
  };

  const reloadReleases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/releases', {
        headers: { 'x-super-admin-key': adminKey },
      });
      const data = await res.json();
      if (data.releases) {
        setReleases(data.releases);
        fetchTerminalPreview();
      }
    } finally {
      setLoading(false);
    }
  };

  // Upload or create release
  const handleUploadRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setActionMessage(null);

    try {
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('platform', platform);
        formData.append('architecture', architecture);
        formData.append('version', version);
        formData.append('artifactType', artifactType);
        formData.append('status', status);
        formData.append('publishedAt', publishedAt);
        formData.append('releaseNotes', releaseNotes);
        formData.append('filename', customFilename || uploadFile.name);

        const res = await fetch('/api/admin/releases', {
          method: 'POST',
          headers: { 'x-super-admin-key': adminKey },
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          setActionMessage(`Successfully uploaded and published ${data.release.filename}!`);
          setUploadFile(null);
          setReleaseNotes('');
          setCustomFilename('');
          reloadReleases();
        } else {
          alert('Upload failed: ' + (data.error || 'Server error'));
        }
      } else {
        // Metadata only update/create
        const payload = {
          platform,
          architecture,
          version,
          artifactType,
          status,
          publishedAt,
          releaseNotes,
          filename: customFilename || `runix-${platform}-${version}`,
        };

        const res = await fetch('/api/admin/releases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-super-admin-key': adminKey,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          setActionMessage(`Release ${data.release.releaseId} published!`);
          reloadReleases();
        } else {
          alert('Save failed: ' + (data.error || 'Server error'));
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Update existing release
  const handleUpdateRelease = async () => {
    if (!editingRelease) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/releases', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-super-admin-key': adminKey,
        },
        body: JSON.stringify({
          ...editingRelease,
          originalReleaseId: originalReleaseId || editingRelease.releaseId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage(`Release ${data.release?.releaseId || editingRelease.releaseId} updated successfully.`);
        setEditingRelease(null);
        setOriginalReleaseId(null);
        reloadReleases();
      } else {
        alert('Update failed: ' + (data.error || 'Error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Delete release
  const handleDeleteRelease = async (releaseId: string) => {
    if (!confirm(`Are you sure you want to withdraw release ${releaseId}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/releases?releaseId=${releaseId}`, {
        method: 'DELETE',
        headers: { 'x-super-admin-key': adminKey },
      });

      if (res.ok) {
        setActionMessage(`Release ${releaseId} withdrawn.`);
        reloadReleases();
      }
    } finally {
      setLoading(false);
    }
  };

  // If not authenticated, render Super Admin passkey challenge
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#07080C] text-[#F3F4F6] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md p-8 rounded-2xl bg-[#0E1117] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#315EF7]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight uppercase font-mono">
                Runix Release CMS
              </h1>
              <span className="text-[11px] font-mono text-zinc-400">
                Restricted Super Admin Access Only
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-sans">
            Enter your Super Admin Access Key to manage official Runix Terminal builds, upload installers,
            change release versions, and publish live ecosystem distribution updates.
          </p>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-2">
                SUPER ADMIN MASTER SECRET KEY:
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter Super Admin Key"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#090A0F] border border-white/10 text-white font-mono text-xs focus:border-[#315EF7] outline-none"
                />
                <Key className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3" />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#315EF7] hover:bg-[#254cc9] text-white text-xs font-semibold font-mono tracking-wider transition-all shadow-[0_0_20px_rgba(49,94,247,0.3)] cursor-pointer"
            >
              {loading ? 'VERIFYING CREDENTIALS...' : 'AUTHENTICATE AS SUPER ADMIN'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <Link href="/" className="hover:text-zinc-300">
              ← Return to Console
            </Link>
            <Link href="/download" className="hover:text-zinc-300">
              Download Hub ↗
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080C] text-[#F3F4F6] flex flex-col font-sans">
      {/* Admin Header */}
      <header className="h-16 border-b border-white/10 bg-[#0E1117] px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-6 h-6">
              <Image src="/logo-v2.png" alt="Runix" width={24} height={24} className="object-contain" />
            </div>
            <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              RUNIX <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">SUPER ADMIN CMS</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <Link
            href="/download"
            target="_blank"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <span>Live Download Hub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={reloadReleases}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
          >
            Lock Session
          </button>
        </div>
      </header>

      {/* Main CMS Container */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {actionMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-zinc-500 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Live Interconnection Simulator Box */}
        <div className="mb-8 p-5 rounded-2xl bg-[#0E1117] border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Live Terminal & CLI Interconnection Preview ($ runix version)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Synchronized Live
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#090A0F] border border-white/5 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {terminalPreview || 'Loading live terminal preview...'}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 font-sans">
            Any version, date, or binary updated below automatically updates the terminal output for all users worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Upload New Binary Form */}
          <div className="lg:col-span-1 p-6 rounded-2xl bg-[#0E1117] border border-white/10 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
              <Upload className="w-4 h-4 text-[#315EF7]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Upload New App / Release
              </h2>
            </div>

            <form onSubmit={handleUploadRelease} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-zinc-400 mb-1.5">BINARY / PACKAGE FILE:</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-zinc-300 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#315EF7] file:text-white file:font-mono file:text-xs hover:file:bg-[#254cc9] cursor-pointer"
                />
                {uploadFile && (
                  <p className="text-[11px] text-emerald-400 mt-1">
                    Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">TARGET PLATFORM:</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                >
                  <option value="windows">Windows</option>
                  <option value="linux">Linux</option>
                  <option value="macos">macOS</option>
                  <option value="cli">Runix CLI</option>
                  <option value="android">Android / Termux</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1.5">ARCHITECTURE:</label>
                  <select
                    value={architecture}
                    onChange={(e) => setArchitecture(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                  >
                    <option value="x64">x64</option>
                    <option value="arm64">ARM64</option>
                    <option value="universal">Universal</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1.5">VERSION:</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. 0.2.0"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1.5">ARTIFACT TYPE:</label>
                  <select
                    value={artifactType}
                    onChange={(e) => setArtifactType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                  >
                    <option value="portable">Portable Binary</option>
                    <option value="installer">Installer (.exe)</option>
                    <option value="package">Package (.tar / .dmg)</option>
                    <option value="script">Installer Script</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1.5">STATUS:</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                  >
                    <option value="available">Available (Public)</option>
                    <option value="comingSoon">Coming Soon</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">RELEASE DATE:</label>
                <input
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">CUSTOM FILENAME (OPTIONAL):</label>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder="RunixTerminal.exe"
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">RELEASE NOTES / CHANGELOG:</label>
                <textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe improvements, fixes, or security patches..."
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none font-sans text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 rounded-xl bg-[#315EF7] hover:bg-[#254cc9] text-white font-semibold font-mono tracking-wider transition-all shadow-[0_0_15px_rgba(49,94,247,0.3)] cursor-pointer"
              >
                {uploading ? 'PROCESSING & COMPUTING HASH...' : 'PUBLISH RELEASE'}
              </button>
            </form>
          </div>

          {/* Right Column: Manage Existing Releases */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Current Software Distribution Targets ({releases.length})
              </h2>
              <span className="text-xs font-mono text-zinc-500">Live Manifest</span>
            </div>

            <div className="space-y-3.5">
              {releases.map((release) => (
                <div
                  key={release.releaseId}
                  className="p-5 rounded-2xl bg-[#0E1117] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white font-mono uppercase bg-white/5 px-2.5 py-1 rounded border border-white/10">
                        {release.platform}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        v{release.version} • {release.architecture}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          release.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {release.status?.toUpperCase() || 'AVAILABLE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingRelease({ ...release });
                          setOriginalReleaseId(release.releaseId);
                        }}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteRelease(release.releaseId)}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Withdraw release"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 mb-3 font-sans leading-relaxed">
                    {release.releaseNotes}
                  </p>

                  <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                    <div className="truncate max-w-md">
                      <span className="text-zinc-300 font-semibold">{release.filename}</span>
                      <span className="mx-2">•</span>
                      <span>{release.fileSize}</span>
                      <span className="mx-2">•</span>
                      <span>{release.publishedAt}</span>
                    </div>

                    <div className="text-emerald-400/90 truncate max-w-xs select-all">
                      {release.checksum}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Release Modal */}
      {editingRelease && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0E1117] border border-white/15 rounded-2xl shadow-2xl p-6 relative">
            <h3 className="font-bold text-sm text-white mb-4 font-mono">
              Edit Release Metadata: {editingRelease.releaseId}
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-zinc-400 mb-1">VERSION:</label>
                <input
                  type="text"
                  value={editingRelease.version}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditingRelease({
                      ...editingRelease,
                      version: v,
                      releaseId: `${editingRelease.platform}-${editingRelease.architecture}-v${v}`,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">STATUS:</label>
                <select
                  value={editingRelease.status}
                  onChange={(e) =>
                    setEditingRelease({
                      ...editingRelease,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                >
                  <option value="available">Available (Public)</option>
                  <option value="comingSoon">Coming Soon</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">RELEASE DATE:</label>
                <input
                  type="text"
                  value={editingRelease.publishedAt}
                  onChange={(e) =>
                    setEditingRelease({ ...editingRelease, publishedAt: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">RELEASE NOTES:</label>
                <textarea
                  value={editingRelease.releaseNotes}
                  onChange={(e) =>
                    setEditingRelease({ ...editingRelease, releaseNotes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none font-sans text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">DOWNLOAD URL:</label>
                <input
                  type="text"
                  value={editingRelease.downloadUrl}
                  onChange={(e) =>
                    setEditingRelease({ ...editingRelease, downloadUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">CHECKSUM:</label>
                <input
                  type="text"
                  value={editingRelease.checksum}
                  onChange={(e) =>
                    setEditingRelease({ ...editingRelease, checksum: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090A0F] border border-white/10 text-white outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 font-mono text-xs">
              <button
                onClick={() => setEditingRelease(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRelease}
                className="px-4 py-2 rounded-xl bg-[#315EF7] hover:bg-[#254cc9] text-white font-semibold"
              >
                Save & Broadcast Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
