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
  Search,
  DollarSign,
  Phone,
  Edit3,
  X,
  PlusCircle,
  MinusCircle,
  Settings2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Deposit, Withdrawal, User, GamePublicState, PlatformSettings } from '../types';

interface AdminDashboardProps {
  adminToken?: string;
  adminUser?: User | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  adminUser,
  onLogout,
}) => {
  const auth = useAuth();
  const token = adminToken || auth.token;
  const user = adminUser || auth.user;
  const refreshProfile = auth.refreshProfile;

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

  // User search & Balance adjustment states
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<User | null>(null);
  const [balanceActionType, setBalanceActionType] = useState<'CREDIT' | 'DEBIT' | 'SET'>('CREDIT');
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [balanceReason, setBalanceReason] = useState<string>('');
  const [isSubmittingBalance, setIsSubmittingBalance] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

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

  const handleToggleFreezeUser = async (targetUserId: string, currentStatus?: string) => {
    if (!token) return;
    const isCurrentlyFrozen = currentStatus === 'FROZEN';
    const isFrozen = !isCurrentlyFrozen;

    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/freeze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFrozen }),
      });
      if (res.ok) {
        setActionNotice(`User account ${isFrozen ? 'frozen' : 'unfrozen'}!`);
        setTimeout(() => setActionNotice(null), 3000);
        fetchTabContent();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUserForBalance) return;
    const numAmt = parseFloat(balanceAmount);
    if (isNaN(numAmt) || (balanceActionType !== 'SET' && numAmt <= 0) || (balanceActionType === 'SET' && numAmt < 0)) {
      alert('Please enter a valid numeric amount');
      return;
    }

    setIsSubmittingBalance(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserForBalance.id}/adjust-balance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actionType: balanceActionType,
          amount: numAmt,
          reason: balanceReason.trim() || `Admin manual balance ${balanceActionType.toLowerCase()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust user balance');

      setActionNotice(`Updated ${selectedUserForBalance.firstName || selectedUserForBalance.username}'s balance! New balance: ${data.newBalance} ETB`);
      setTimeout(() => setActionNotice(null), 4000);
      setSelectedUserForBalance(null);
      setBalanceAmount('');
      setBalanceReason('');
      fetchMetrics();
      fetchTabContent();
      refreshProfile();
    } catch (err: any) {
      alert(err.message || 'Balance adjustment error');
    } finally {
      setIsSubmittingBalance(false);
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
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setActionNotice('Platform & Telebirr settings updated successfully!');
      setTimeout(() => setActionNotice(null), 3500);
      fetchTabContent();
    } catch (e: any) {
      alert(e.message || 'Error updating settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    const name = (u.firstName || '').toLowerCase();
    const uname = (u.username || '').toLowerCase();
    const tgId = (u.telegramId || '').toLowerCase();
    return name.includes(q) || uname.includes(q) || tgId.includes(q);
  });

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
          { id: 'users', label: 'Users & Balances' },
          { id: 'games', label: 'Games' },
          { id: 'settings', label: 'Settings & Telebirr' },
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
                        <span>{dep.firstName || dep.username || dep.userId} (@{dep.username})</span>
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
                        <span>{w.firstName || w.username || w.userId} (@{w.username})</span>
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

        {/* TAB 3: USERS & BALANCE ADJUSTMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Registered Accounts & Balances ({filteredUsers.length})
                </h3>
                <p className="text-[11px] text-zinc-500">View user names, Telegram IDs and adjust wallet credits/debits</p>
              </div>

              {/* Search User Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search name, @user, TG ID..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="divide-y divide-zinc-800 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs">No users matching search query.</div>
              ) : (
                filteredUsers.map((u) => {
                  const availableBal = u.wallet?.availableBalance ?? (u as any).availableBalance ?? 0;
                  const lockedBal = u.wallet?.lockedBalance ?? (u as any).lockedBalance ?? 0;
                  const isFrozen = u.isFrozen || u.status === 'FROZEN';

                  return (
                    <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span className="text-sm text-emerald-300 font-black">
                            {u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username}
                          </span>
                          <span className="text-zinc-400 font-mono">@{u.username}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : u.role === 'OPERATOR'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            {u.role}
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>TG ID: <strong className="text-zinc-300 font-mono">{u.telegramId || 'Guest'}</strong></span>
                          <span>•</span>
                          <span>Status: <strong className={isFrozen ? 'text-rose-400' : 'text-emerald-400'}>{isFrozen ? 'FROZEN' : 'ACTIVE'}</strong></span>
                          {lockedBal > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-400">Locked: {lockedBal} ETB</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 justify-between sm:justify-end">
                        <div className="text-right sm:mr-2">
                          <div className="text-[10px] text-zinc-500 uppercase font-semibold">Available Balance</div>
                          <div className="font-mono font-black text-emerald-400 text-sm">
                            {availableBal} ETB
                          </div>
                        </div>

                        {/* Adjust Balance Button */}
                        <button
                          onClick={() => {
                            setSelectedUserForBalance(u);
                            setBalanceActionType('CREDIT');
                            setBalanceAmount('');
                            setBalanceReason('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          title="Adjust Balance"
                        >
                          <Coins className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Adjust Balance</span>
                        </button>

                        {/* Freeze / Unfreeze Button */}
                        <button
                          onClick={() => handleToggleFreezeUser(u.id, isFrozen ? 'FROZEN' : 'ACTIVE')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            isFrozen
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-zinc-800 text-rose-400 hover:bg-rose-950'
                          }`}
                        >
                          {isFrozen ? 'Unfreeze' : 'Freeze'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
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

        {/* TAB 5: SETTINGS & TELEBIRR CONFIGURATION */}
        {activeTab === 'settings' && settings && (
          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs max-w-2xl">
            {/* Section 1: Telebirr Payment Receiver Details */}
            <div className="p-5 rounded-2xl bg-zinc-950/80 border-2 border-emerald-500/30 space-y-4 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">
                    Telebirr Payment Receiver Settings
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    This phone number and account name are displayed to players in the Deposit modal.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider text-[11px]">
                    Displayed Telebirr Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.telebirrReceiverNumber || ''}
                    onChange={(e) => setSettings({ ...settings, telebirrReceiverNumber: e.target.value })}
                    placeholder="e.g. 0911223344"
                    className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-emerald-400 font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Players will copy this number when sending money.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider text-[11px]">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={settings.telebirrReceiverName || ''}
                    onChange={(e) => setSettings({ ...settings, telebirrReceiverName: e.target.value })}
                    placeholder="e.g. Pool Cards Addis"
                    className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Name shown next to the recipient phone number.</span>
                </div>
              </div>
            </div>

            {/* Section 2: Platform Financials & Limits */}
            <div className="p-5 rounded-2xl bg-zinc-950/50 border border-zinc-800 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <Settings2 className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">
                  Game Engine & Transaction Limits
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-semibold">Platform Rake Fee (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.platformFeePercent}
                    onChange={(e) => setSettings({ ...settings, platformFeePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-semibold">Maintenance Mode</label>
                  <select
                    value={settings.maintenanceMode ? 'true' : 'false'}
                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.value === 'true' })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  >
                    <option value="false">Off (Live Arena)</option>
                    <option value="true">On (Under Maintenance)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-semibold">Min Deposit (ETB)</label>
                  <input
                    type="number"
                    value={settings.minDeposit || 10}
                    onChange={(e) => setSettings({ ...settings, minDeposit: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-semibold">Max Deposit (ETB)</label>
                  <input
                    type="number"
                    value={settings.maxDeposit || 50000}
                    onChange={(e) => setSettings({ ...settings, maxDeposit: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-semibold">Min Withdrawal (ETB)</label>
                  <input
                    type="number"
                    value={settings.minWithdrawal || 50}
                    onChange={(e) => setSettings({ ...settings, minWithdrawal: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-semibold">Max Withdrawal (ETB)</label>
                  <input
                    type="number"
                    value={settings.maxWithdrawal || 20000}
                    onChange={(e) => setSettings({ ...settings, maxWithdrawal: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg transition-all disabled:opacity-50"
            >
              {isSavingSettings ? 'Saving Settings...' : 'Save Configuration & Telebirr'}
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

      {/* BALANCE ADJUSTMENT MODAL */}
      {selectedUserForBalance && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUserForBalance(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fadeIn"
        >
          <div className="w-full max-w-md bg-[#0f172a] border-2 border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Adjust User Balance</h3>
                  <p className="text-xs text-zinc-400">
                    {selectedUserForBalance.firstName || selectedUserForBalance.username} (@{selectedUserForBalance.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForBalance(null)}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Balance Display */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Current Available Balance:</span>
              <span className="font-mono font-black text-emerald-400 text-base">
                {selectedUserForBalance.wallet?.availableBalance ?? (selectedUserForBalance as any).availableBalance ?? 0} ETB
              </span>
            </div>

            <form onSubmit={handleAdjustBalanceSubmit} className="space-y-4 text-xs">
              {/* Action Type Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setBalanceActionType('CREDIT')}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    balanceActionType === 'CREDIT'
                      ? 'bg-emerald-500 text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Credit (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceActionType('DEBIT')}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    balanceActionType === 'DEBIT'
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Debit (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceActionType('SET')}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    balanceActionType === 'SET'
                      ? 'bg-blue-500 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Set Exact (=)</span>
                </button>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[50, 100, 500, 1000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBalanceAmount(preset.toString())}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono font-bold cursor-pointer transition-colors shrink-0"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="space-y-1">
                <label className="text-zinc-300 font-bold">
                  {balanceActionType === 'CREDIT' && 'Amount to Credit (ETB)'}
                  {balanceActionType === 'DEBIT' && 'Amount to Deduct (ETB)'}
                  {balanceActionType === 'SET' && 'New Total Balance (ETB)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min={balanceActionType === 'SET' ? '0' : '1'}
                    required
                    placeholder="Enter amount (e.g. 500)"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs font-mono text-zinc-400 font-bold">
                    ETB
                  </span>
                </div>
              </div>

              {/* Reason / Memo */}
              <div className="space-y-1">
                <label className="text-zinc-300 font-bold">Reason / Memo for Audit Log</label>
                <input
                  type="text"
                  placeholder="e.g. Manual top-up, tournament prize, correction"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Projected Balance Preview */}
              {Boolean(balanceAmount && !isNaN(parseFloat(balanceAmount))) && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs">
                  <span>Projected New Balance:</span>
                  <span className="font-mono font-black text-sm text-emerald-400">
                    {(() => {
                      const cur = selectedUserForBalance.wallet?.availableBalance ?? (selectedUserForBalance as any).availableBalance ?? 0;
                      const val = parseFloat(balanceAmount) || 0;
                      if (balanceActionType === 'CREDIT') return cur + val;
                      if (balanceActionType === 'DEBIT') return Math.max(0, cur - val);
                      return val;
                    })()} ETB
                  </span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForBalance(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBalance}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isSubmittingBalance ? 'Applying...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
