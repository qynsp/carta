import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Users,
  CreditCard,
  Gamepad2,
  Shield,
  User as UserIcon,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Wifi,
  WifiOff,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { GamePublicState, WalletTransaction } from './types';
import { PublicGameView } from './components/PublicGameView';
import { OperatorBoard } from './components/OperatorBoard';
import { AdminDashboard } from './components/AdminDashboard';
import { CreateGameModal } from './components/CreateGameModal';
import { DepositModal } from './components/DepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { RulesModal } from './components/RulesModal';
import { DevSimulatorBar } from './components/DevSimulatorBar';

function MainAppContent() {
  const { user, token, refreshProfile } = useAuth();
  const { isConnected } = useSocket();

  const [activeTab, setActiveTab] = useState<'games' | 'wallet' | 'operator' | 'admin' | 'profile'>('games');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [games, setGames] = useState<GamePublicState[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [gamesLoading, setGamesLoading] = useState<boolean>(false);
  const [txLoading, setTxLoading] = useState<boolean>(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  const fetchGames = async () => {
    setGamesLoading(true);
    try {
      const res = await fetch('/api/games');
      if (res.ok) {
        const data = await res.json();
        setGames(data.games || []);
      }
    } catch (e) {
      console.error('Failed to load games:', e);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!token) return;
    setTxLoading(true);
    try {
      const res = await fetch('/api/wallet/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (activeTab === 'wallet') {
      fetchTransactions();
    } else if (activeTab === 'games') {
      fetchGames();
    }
  }, [activeTab]);

  const initials = (user?.firstName || user?.username || 'U')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* Dev Simulator Bar */}
      <DevSimulatorBar />

      {/* Bento Grid Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-xl text-zinc-950 font-black text-xl flex items-center justify-center shadow-lg shadow-emerald-950/40">
              🎱
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center">
                POOL CARDS <span className="text-emerald-500 text-xs font-bold ml-2 px-1.5 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">v1.0</span>
              </h1>
            </div>
          </div>

          {/* Right Header Widgets: Wallet pill + Avatar + Rules */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            <div
              onClick={() => {
                setSelectedGameId(null);
                setActiveTab('wallet');
              }}
              className="bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-2xl flex items-center gap-2 sm:gap-3 cursor-pointer hover:border-zinc-700 transition-colors shadow-sm"
            >
              <span className="text-zinc-400 text-[10px] sm:text-xs uppercase tracking-widest hidden sm:inline">Wallet</span>
              <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                {(user?.wallet?.availableBalance || 0).toLocaleString()} ETB
              </span>
            </div>

            <button
              onClick={() => setShowRulesModal(true)}
              className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl text-zinc-400 hover:text-emerald-400 hover:border-zinc-700 transition-all cursor-pointer"
              title="Game Rules"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Connection Status & Avatar */}
            <div
              className={`h-10 w-10 rounded-2xl border flex items-center justify-center font-bold text-xs ${
                isConnected
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
              title={isConnected ? `Logged in as ${user?.username}` : 'WebSocket Reconnecting...'}
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Main Bento Canvas */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {selectedGameId ? (
          <PublicGameView
            gameId={selectedGameId}
            onBack={() => {
              setSelectedGameId(null);
              fetchGames();
            }}
            onOpenOperator={() => setActiveTab('operator')}
          />
        ) : (
          <>
            {/* TAB: GAMES (BENTO GRID LAYOUT) */}
            {activeTab === 'games' && (
              <div className="space-y-6">
                {/* Top Bento Row: Hero Host Card + Quick Deposit CTA + Live Stats */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Bento Card 1: Host Match Hero (col-span-8) */}
                  <div className="md:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-xl">
                    <div className="space-y-3 z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">
                          Physical Pool Table Mini App
                        </span>
                        <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                          LIVE ENGINE
                        </div>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        5-Card Pool Table Showdown
                      </h2>

                      <p className="text-zinc-400 text-sm max-w-lg leading-relaxed">
                        Play with 5 secret cards matched to balls 1–13. Sink duplicate cards simultaneously, scratch penalties, and claim the winner pot in real-time.
                      </p>
                    </div>

                    <div className="pt-6 z-10 flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-zinc-950 font-black text-sm shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>HOST NEW POOL MATCH</span>
                      </button>

                      <button
                        onClick={() => setShowRulesModal(true)}
                        className="px-5 py-3.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>RULES & PAYOUTS</span>
                      </button>
                    </div>

                    {/* Subtle Background Accent */}
                    <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 text-9xl opacity-5 pointer-events-none select-none">
                      🎱
                    </div>
                  </div>

                  {/* Bento Card 2: Quick Deposit Tile (col-span-4) */}
                  <div
                    onClick={() => setShowDepositModal(true)}
                    className="md:col-span-4 bg-emerald-600 hover:bg-emerald-500 rounded-3xl p-6 sm:p-7 flex flex-col justify-between text-zinc-950 shadow-xl transition-all group cursor-pointer"
                  >
                    <div>
                      <div className="text-emerald-950 text-xs uppercase tracking-widest font-black mb-2">
                        MANUAL VERIFICATION
                      </div>
                      <h3 className="text-white font-black text-3xl sm:text-4xl italic leading-none tracking-tight">
                        WALLET<br />DEPOSIT
                      </h3>
                      <p className="text-emerald-100 text-xs mt-3 leading-normal font-medium">
                        Instant manual verification via Telebirr SMS transaction references.
                      </p>
                    </div>

                    <div className="flex justify-between items-center bg-zinc-950/20 backdrop-blur-sm p-3 rounded-2xl mt-6">
                      <span className="text-white font-bold text-xs tracking-wider uppercase">ADD FUNDS NOW</span>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Second Bento Row: Active Tables Grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">●</span>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                        LIVE TABLES & MATCH LOBBIES ({games.length})
                      </h3>
                    </div>

                    <button
                      onClick={fetchGames}
                      className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${gamesLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {gamesLoading ? (
                    <div className="p-16 text-center text-zinc-500 text-xs bg-zinc-900/30 border border-zinc-800 rounded-3xl">
                      Loading pool tables...
                    </div>
                  ) : games.length === 0 ? (
                    <div className="p-12 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-center space-y-3">
                      <div className="text-3xl">🎱</div>
                      <div className="text-white font-bold text-base">No Active Matches on Table</div>
                      <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                        Tap "Host New Pool Match" to create a table room with custom entry fee and player count.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {games.map((g) => {
                        const isLive = g.status === 'ACTIVE';
                        const isWaiting = g.status === 'WAITING';

                        return (
                          <div
                            key={g.id}
                            onClick={() => setSelectedGameId(g.id)}
                            className="bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/50 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 cursor-pointer transition-all hover:-translate-y-0.5 group"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                  {g.tableNumber || 'Table 1'}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isLive
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : isWaiting
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {g.status}
                                </span>
                              </div>

                              <h4 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                                {g.name}
                              </h4>

                              <div className="flex items-center gap-3 text-xs text-zinc-400">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-zinc-500" />
                                  <span>{g.players.length}/{g.maxPlayers} Players</span>
                                </span>
                                <span>•</span>
                                <span>Fee: {g.entryFee} ETB</span>
                              </div>

                              {isLive && g.currentTurnUsername && (
                                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Shooter: {g.currentTurnUsername}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                              <div>
                                <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Prize Pot</p>
                                <p className="font-mono font-black text-amber-400 text-base">{g.totalPot} ETB</p>
                              </div>

                              <div className="text-right">
                                <span className="text-[11px] font-bold text-emerald-400 bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-700/60 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">
                                  View Table →
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: WALLET (BENTO GRID LAYOUT) */}
            {activeTab === 'wallet' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Bento Wallet Card 1: Available Balance */}
                  <div className="md:col-span-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">Available Funds</span>
                        <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight mt-1">
                          {(user?.wallet?.availableBalance || 0).toLocaleString()} <span className="text-lg font-bold text-emerald-500">ETB</span>
                        </div>
                      </div>

                      {user?.wallet?.lockedBalance ? (
                        <div className="text-right bg-zinc-950/60 border border-zinc-800 p-3 rounded-2xl">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Locked in Review</p>
                          <p className="font-mono font-bold text-amber-300 text-sm">{user.wallet.lockedBalance} ETB</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => setShowDepositModal(true)}
                        className="py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs tracking-wider uppercase shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Deposit (Telebirr)</span>
                      </button>

                      <button
                        onClick={() => setShowWithdrawModal(true)}
                        className="py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Withdraw Funds</span>
                      </button>
                    </div>
                  </div>

                  {/* Bento Wallet Card 2: Manual Payment Info */}
                  <div className="md:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">Payment Engine</span>
                      <h4 className="text-white font-bold text-base mt-1">Telebirr Manual System</h4>
                      <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
                        All deposits are verified manually by system administrators via SMS references within 5 minutes.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-800 flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Security Standard</span>
                      <span className="text-emerald-400 font-mono font-bold">Double-Entry Ledger</span>
                    </div>
                  </div>
                </div>

                {/* Ledger Transactions Bento Box */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">●</span>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        Immutable Ledger Transactions
                      </h3>
                    </div>
                    <button onClick={fetchTransactions} className="text-xs text-emerald-400 hover:underline cursor-pointer">
                      Refresh
                    </button>
                  </div>

                  {txLoading ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">Loading ledger history...</div>
                  ) : transactions.length === 0 ? (
                    <div className="p-8 bg-zinc-950/40 border border-zinc-800 rounded-2xl text-center text-zinc-500 text-xs">
                      No transactions recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/80 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden">
                      {transactions.map((tx) => {
                        const isPositive = tx.amount > 0;
                        return (
                          <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{tx.description || tx.type}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                  {tx.type}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {new Date(tx.createdAt).toLocaleString()} • Ref: {tx.reference || 'N/A'}
                              </div>
                            </div>

                            <div
                              className={`font-mono font-black text-sm ${
                                isPositive ? 'text-emerald-400' : 'text-zinc-300'
                              }`}
                            >
                              {isPositive ? `+${tx.amount}` : tx.amount} ETB
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: OPERATOR KEYPAD */}
            {activeTab === 'operator' && <OperatorBoard />}

            {/* TAB: ADMIN MASTER CONTROL */}
            {activeTab === 'admin' && <AdminDashboard />}

            {/* TAB: PROFILE & SYSTEM SPECS */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-2xl font-black text-emerald-400 shadow-md">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {user?.firstName || user?.username}
                      </h3>
                      <div className="text-xs text-zinc-400">@{user?.username} (TG ID: {user?.telegramId})</div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 inline-block mt-1">
                        {user?.role} ACCOUNT
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-800 text-xs pt-2">
                    <button
                      onClick={() => setShowRulesModal(true)}
                      className="w-full py-3.5 text-left flex items-center justify-between text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>Pool Cards Rules & Payout Guide</span>
                      </span>
                      <span className="text-zinc-500">›</span>
                    </button>

                    <div className="py-3.5 flex items-center justify-between text-zinc-400">
                      <span>Deployment Architecture</span>
                      <span className="font-mono text-emerald-400 font-bold">Render + Neon PostgreSQL</span>
                    </div>

                    <div className="py-3.5 flex items-center justify-between text-zinc-400">
                      <span>Payment Verification</span>
                      <span className="font-bold text-zinc-300">Manual Telebirr System (v1)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Bento Pill Navigation Bar */}
      <nav className="sticky bottom-4 z-30 mx-auto px-4 mt-auto mb-2">
        <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl shadow-black/80">
          <button
            onClick={() => {
              setSelectedGameId(null);
              setActiveTab('games');
            }}
            className={`px-4 sm:px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'games' && !selectedGameId
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            GAMES
          </button>

          <button
            onClick={() => {
              setSelectedGameId(null);
              setActiveTab('wallet');
            }}
            className={`px-4 sm:px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'wallet'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            WALLET
          </button>

          <button
            onClick={() => {
              setSelectedGameId(null);
              setActiveTab('operator');
            }}
            className={`px-4 sm:px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'operator'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            OPERATOR
          </button>

          <button
            onClick={() => {
              setSelectedGameId(null);
              setActiveTab('admin');
            }}
            className={`px-4 sm:px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ADMIN
          </button>

          <button
            onClick={() => {
              setSelectedGameId(null);
              setActiveTab('profile');
            }}
            className={`px-4 sm:px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            PROFILE
          </button>
        </div>
      </nav>

      {/* Modals */}
      <CreateGameModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGameCreated={(gameId) => {
          setSelectedGameId(gameId);
          fetchGames();
          refreshProfile();
        }}
      />

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={() => {
          fetchTransactions();
          refreshProfile();
        }}
      />

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={() => {
          fetchTransactions();
          refreshProfile();
        }}
      />

      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainAppContent />
      </SocketProvider>
    </AuthProvider>
  );
}
