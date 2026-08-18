import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Lock, ArrowLeft, LogOut, CheckCircle2, AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { User } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { soundFx } from '../utils/audio';

interface AdminPortalProps {
  onNavigateHome: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onNavigateHome }) => {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('pool_admin_jwt') || localStorage.getItem('pool_admin_jwt');
  });
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);

  // Login form state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verify stored admin token on load
  const verifyAdminToken = async (tokenToVerify: string) => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user && data.user.role === 'ADMIN') {
          setAdminUser(data.user);
          setAdminToken(tokenToVerify);
          sessionStorage.setItem('pool_admin_jwt', tokenToVerify);
          return;
        }
      }
      // If not valid admin, reset
      handleLogout();
    } catch (e) {
      handleLogout();
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('pool_admin_jwt') || localStorage.getItem('pool_admin_jwt');
    if (saved) {
      verifyAdminToken(saved);
    } else {
      setIsVerifying(false);
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playButtonClick();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.token || data.user?.role !== 'ADMIN') {
        throw new Error(data.error || 'Access Denied: Invalid administrator credentials.');
      }

      soundFx.playCoinWin();
      setAdminToken(data.token);
      setAdminUser(data.user);
      sessionStorage.setItem('pool_admin_jwt', data.token);
    } catch (err: any) {
      soundFx.playScratch();
      setErrorMessage(err.message || 'Authentication error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    soundFx.playButtonClick();
    setAdminToken(null);
    setAdminUser(null);
    sessionStorage.removeItem('pool_admin_jwt');
    localStorage.removeItem('pool_admin_jwt');
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#050912] flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono tracking-widest uppercase text-emerald-400">Verifying Security Credentials...</p>
        </div>
      </div>
    );
  }

  // Not authenticated as Admin -> Show Secure Gateway Login
  if (!adminToken || !adminUser || adminUser.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#050912] text-slate-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-emerald-500 selection:text-zinc-950 font-sans">
        {/* Top Header */}
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              soundFx.playButtonClick();
              onNavigateHome();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Return to Game Arena</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>PROTECTED ROUTE</span>
          </div>
        </div>

        {/* Center Login Terminal */}
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="bg-[#0b1222] border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/20 space-y-6 relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center space-y-2 relative z-10">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Admin Master Portal
              </h2>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Authorized Personnel Only • Role-Based Authentication Required
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                  Administrator Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-2xl bg-[#070c17] border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                  Secure Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-[#070c17] border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl btn-game-green text-zinc-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isSubmitting ? 'Authenticating...' : 'Authenticate & Unlock'}</span>
              </button>
            </form>

            <div className="pt-2 border-t border-zinc-800/80 text-center">
              <p className="text-[11px] text-zinc-500 font-mono">
                All administrator access is cryptographically signed and logged to immutable audit records.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-zinc-600 text-xs py-2">
          Pool Royale Security Architecture • Protected Endpoint
        </div>
      </div>
    );
  }

  // Authenticated Admin -> Show Full Admin Management Suite
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* Top Admin HUD */}
      <header className="sticky top-0 z-30 bg-[#0c1222]/95 backdrop-blur-md border-b border-amber-500/30 px-4 sm:px-8 py-3 shadow-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center font-black text-zinc-950 text-xl">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  POOL ROYALE <span className="text-amber-400">ADMIN</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black border border-amber-500/40">
                  SYSTEM ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                Operator: @{adminUser.username} (Super Admin)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                soundFx.playButtonClick();
                onNavigateHome();
              }}
              className="px-3 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Open Public Game Arena"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Go to Game</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-300 hover:text-rose-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Sign out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard View */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-20">
        <AdminDashboard
          adminToken={adminToken}
          adminUser={adminUser}
          onLogout={handleLogout}
        />
      </main>
    </div>
  );
};
