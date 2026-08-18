import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  CheckCircle,
  XCircle,
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Sliders,
  FileText,
  AlertTriangle,
  Play,
  Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Deposit, Withdrawal, User, GamePublicState, PlatformSettings } from '../types';

export const AdminDashboard: React.FC = () => {
  const { user, token, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'users' | 'games' | 'settings' | 'audit'>('deposits');
  const [metrics, setMetrics] = useState<any>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [gamesList, setGamesList] = useState<GamePublicState[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error('Metrics fetch error:', e);
    }
  };

  const fetchTabContent = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeTab === 'deposits') {
        const res = await fetch('/api/admin/deposits', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDeposits(data.deposits || []);
        }
      } else if (activeTab === 'withdrawals') {
        const res = await fetch('/api/admin/withdrawals', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWithdrawals(data.withdrawals || []);
        }
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsersList(data.users || []);
        }
      } else if (activeTab === 'games') {
        const res = await fetch('/api/games', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setGamesList(data.games || []);
        }
      } else if (activeTab === 'settings') {
        const res = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
        }
      } else if (activeTab === 'audit') {
        const res = await fetch('/api/admin/audit-logs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.logs || []);
        }
      }
    } catch (e) {
      console.error('Tab content fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchTabContent();
  }, [activeTab]);

  const handleApproveDeposit = async (depositId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/deposits/${depositId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      setActionNotice('Deposit approved & wallet credited!');
      setTimeout(() => setActionNotice(null), 3000);
      fetchMetrics();
      fetchTabContent();
      refreshProfile();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    const reason = prompt('Enter rejection reason:') || 'Invalid transaction code';
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/deposits/${depositId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setActionNotice('Deposit rejected.');
        setTimeout(() => setActionNotice(null), 3000);
        fetchMetrics();
        fetchTabContent();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId: string) => {
    if (!token) return;
    if (!confirm('Confirm that you have transferred Telebirr funds to the user?')) return;

    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout confirmation failed');

      setActionNotice('Withdrawal marked as paid & finalized!');
      setTimeout(() => setActionNotice(null), 3000);
      fetchMetrics();
      fetchTabContent();
      refreshProfile();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectWithdrawal = async (withdrawalId: string) => {
    const reason = prompt('Enter rejection reason:') || 'Telebirr number mismatch';
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setActionNotice('Withdrawal rejected and funds refunded to user.');
        setTimeout(() => setActionNotice(null), 3000);
        fetchMetrics();
        fetchTabContent();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleFreezeUser = async (targetUserId: string, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'FROZEN' ? 'ACTIVE' : 'FROZEN';
    const reason = newStatus === 'FROZEN' ? prompt('Reason for account freeze:') || 'Security hold' : undefined;

    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      if (res.ok) {
        setActionNotice(`User account ${newStatus.toLowerCase()}!`);
        setTimeout(() => setActionNotice(null), 3000);
        fetchTabContent();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCancelGame = async (gameId: string) => {
    if (!token) return;
    const reason = prompt('Enter cancellation reason:') || 'Table maintenance';
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/games/${gameId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setActionNotice('Game cancelled & all players refunded.');
        setTimeout(() => setActionNotice(null), 3000);
        fetchMetrics();
        fetchTabContent();
        refreshProfile();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !settings) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setActionNotice('Platform settings updated successfully!');
        setTimeout(() => setActionNotice(null), 3000);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white uppercase">Admin Master Control</h2>
            <p className="text-xs text-zinc-400">Ledger verification, manual payouts & table oversight</p>
          </div>
        </div>
        <button
          onClick={() => {
            fetchMetrics();
            fetchTabContent();
          }}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-fadeIn flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Bento Grid Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">Total Wallets</div>
          <div className="text-lg font-black text-white font-mono">{metrics?.totalUserBalance || 0} ETB</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-400">Platform Rev</div>
          <div className="text-lg font-black text-emerald-400 font-mono">{metrics?.platformRevenue || 0} ETB</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-400">Active Tables</div>
          <div className="text-lg font-black text-amber-400 font-mono">{metrics?.activeGamesCount || 0}</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400">Pending Deps</div>
          <div className="text-lg font-black text-blue-400 font-mono">{metrics?.pendingDepositsCount || 0}</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-rose-400">Pending Payouts</div>
          <div className="text-lg font-black text-rose-400 font-mono">{metrics?.pendingWithdrawalsCount || 0}</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-purple-400">Total Players</div>
          <div className="text-lg font-black text-purple-400 font-mono">{metrics?.totalUsersCount || 0}</div>
        </div>
      </div>

      {/* Admin Bento Tabs Pill Nav */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-full p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'deposits', label: 'Deposits', count: metrics?.pendingDepositsCount },
          { id: 'withdrawals', label: 'Withdrawals', count: metrics?.pendingWithdrawalsCount },
          { id: 'users', label: 'Users' },
          { id: 'games', label: 'Games' },
          { id: 'settings', label: 'Settings' },
          { id: 'audit', label: 'Audit Logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>{tab.label}</span>
            {Boolean(tab.count) && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Panels in Bento Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
        {/* TAB 1: DEPOSITS */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Telebirr Deposit Verification Queue ({deposits.length})
              </h3>
            </div>

            {deposits.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">No pending deposit requests.</div>
            ) : (
              <div className="divide-y divide-zinc-800 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
                {deposits.map((dep) => (
                  <div key={dep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>@{dep.username || dep.userId}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                          Ref: {dep.reference}
                        </span>
                      </div>
                      <div className="text-zinc-400">
                        Method: {dep.paymentMethod} {dep.notes ? `• ${dep.notes}` : ''}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(dep.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="font-mono font-black text-emerald-400 text-base">
                        +{dep.amount} ETB
                      </div>

                      {dep.status === 'PENDING' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveDeposit(dep.id)}
                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(dep.id)}
                            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-rose-950 text-rose-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                          {dep.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Telebirr Payout Queue ({withdrawals.length})
              </h3>
            </div>

            {withdrawals.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">No pending withdrawal requests.</div>
            ) : (
              <div className="divide-y divide-zinc-800 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
                {withdrawals.map((w) => (
                  <div key={w.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>@{w.username || w.userId}</span>
                        <span className="font-mono text-emerald-400">📱 {w.telebirrPhone}</span>
                      </div>
                      <div className="text-zinc-400">Account: {w.accountName || 'Telebirr'}</div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(w.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="font-mono font-black text-amber-400 text-base">
                        {w.amount} ETB
                      </div>

                      {w.status === 'PENDING' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveWithdrawal(w.id)}
                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(w.id)}
                            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-rose-950 text-rose-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                          >
                            Reject & Refund
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                          {w.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Registered Accounts ({usersList.length})
            </h3>
            <div className="divide-y divide-zinc-800 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
              {usersList.map((u) => (
                <div key={u.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">
                      {u.firstName || u.username} (@{u.username})
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      TG: {u.telegramId} • Role: {u.role} • Status: {u.status}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="font-mono font-bold text-emerald-400 text-xs">
                      {u.wallet?.availableBalance || 0} ETB
                    </div>
                    <button
                      onClick={() => handleToggleFreezeUser(u.id, u.status)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        u.status === 'FROZEN'
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-zinc-800 text-rose-400 hover:bg-rose-950'
                      }`}
                    >
                      {u.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: GAMES */}
        {activeTab === 'games' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Active & Waiting Matches ({gamesList.length})
            </h3>
            <div className="divide-y divide-zinc-800 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
              {gamesList.map((g) => (
                <div key={g.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{g.name} ({g.tableNumber || 'Table 1'})</div>
                    <div className="text-[11px] text-zinc-400">
                      Status: {g.status} • Fee: {g.entryFee} ETB • Pot: {g.totalPot} ETB
                    </div>
                  </div>

                  {g.status !== 'COMPLETED' && g.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCancelGame(g.id)}
                      className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-rose-950 text-rose-400 text-xs font-bold cursor-pointer"
                    >
                      Cancel & Refund
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && settings && (
          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs max-w-lg">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              System Parameters
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-zinc-400">Platform Fee (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.platformFeePercent}
                  onChange={(e) => setSettings({ ...settings, platformFeePercent: parseFloat(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400">Min Deposit (ETB)</label>
                <input
                  type="number"
                  value={settings.minDeposit || 10}
                  onChange={(e) => setSettings({ ...settings, minDeposit: parseFloat(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400">Min Withdrawal (ETB)</label>
                <input
                  type="number"
                  value={settings.minWithdrawal || 50}
                  onChange={(e) => setSettings({ ...settings, minWithdrawal: parseFloat(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400">Maintenance Mode</label>
                <select
                  value={settings.maintenanceMode ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.value === 'true' })}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono"
                >
                  <option value="false">Off (Live)</option>
                  <option value="true">On (Paused)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
            >
              Save Configuration
            </button>
          </form>
        )}

        {/* TAB 6: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Admin Action Audit Log ({auditLogs.length})
            </h3>
            <div className="divide-y divide-zinc-800 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 text-xs">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="text-emerald-400">{log.adminName}</span>
                    <span>•</span>
                    <span>{log.action}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{log.details}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
