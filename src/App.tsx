import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Volume2,
  VolumeX,
  Languages,
  Flame,
  Zap,
  Star,
  Award,
  CircleDot,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { GamePublicState, WalletTransaction } from './types';
import { PublicGameView } from './components/PublicGameView';
import { OperatorBoard } from './components/OperatorBoard';
import { AdminPortal } from './components/AdminPortal';
import { CreateGameModal } from './components/CreateGameModal';
import { DepositModal } from './components/DepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { RulesModal } from './components/RulesModal';
import { WelcomeNameModal } from './components/WelcomeNameModal';
import { soundFx } from './utils/audio';

function MainAppContent({ onNavigateAdmin }: { onNavigateAdmin: () => void }) {
  const { user, token, refreshProfile, updateProfileName } = useAuth();
  const { isConnected } = useSocket();
  const { t, language, setLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<'games' | 'wallet' | 'leaderboard' | 'profile' | 'operator'>('games');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [games, setGames] = useState<GamePublicState[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [gamesLoading, setGamesLoading] = useState<boolean>(false);
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getIsMuted());

  // Player Name Editing States
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState<boolean>(false);

  // Player Gamification Stats
  const [playerXp, setPlayerXp] = useState<number>(360);
  const [winStreak, setWinStreak] = useState<number>(3);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);

  // Check if first-time user needs to enter their name
  useEffect(() => {
    if (user) {
      const welcomed = localStorage.getItem('poolcards_welcomed_v1');
      const isDefault = !user.firstName || user.firstName === 'Player' || user.firstName.startsWith('player_');
      if (!welcomed && isDefault) {
        setShowWelcomeModal(true);
      }
    }
  }, [user]);

  const playerLevel = Math.floor(playerXp / 150) + 1;
  const currentLevelXp = playerXp % 150;
  const levelTitleKeys = ['levelRookie', 'levelClubPlayer', 'levelHustler', 'levelCueShark', 'levelGrandmaster'];
  const currentTitleKey = levelTitleKeys[Math.min(playerLevel - 1, levelTitleKeys.length - 1)];
  const currentTitle = t(currentTitleKey);

  const toggleMute = () => {
    soundFx.playButtonClick();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundFx.setMuted(nextMuted);
  };

  const toggleLanguage = () => {
    soundFx.playButtonClick();
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  const fetchGames = async () => {
    setGamesLoading(true);
    try {
      const res = await fetch('/api/games');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
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
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* Gamified Top Header HUD */}
      <header className="sticky top-0 z-30 bg-[#0c1222]/95 backdrop-blur-md border-b border-emerald-500/20 px-3 sm:px-6 py-2.5 shadow-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Brand Logo & Level Badge */}
          <div
            onClick={() => {
              soundFx.playButtonClick();
              setSelectedGameId(null);
              setActiveTab('games');
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform flex items-center justify-center font-black text-2xl text-zinc-950">
              🎱
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1">
                  <span>POOL</span>
                  <span className="text-emerald-400">ROYALE</span>
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black uppercase border border-emerald-500/40">
                  LVL {playerLevel}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                {currentTitle}
              </p>
            </div>
          </div>

          {/* Level XP Progress Bar (Middle Desktop) */}
          <div className="hidden md:flex items-center gap-3 bg-zinc-900/80 px-4 py-1.5 rounded-2xl border border-zinc-800">
            <div className="space-y-1 w-32">
              <div className="flex justify-between text-[10px] font-black text-zinc-400">
                <span className="text-emerald-400">XP PROGRESS</span>
                <span className="font-mono">{currentLevelXp}/150</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden p-0.5 border border-zinc-700">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-300 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${(currentLevelXp / 150) * 100}%` }}
                />
              </div>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl text-amber-400 text-xs font-black">
              <Flame className="w-3.5 h-3.5 fill-current animate-pulse text-amber-500" />
              <span>{winStreak} STREAK</span>
            </div>
          </div>

          {/* Right Header Widgets */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="bg-zinc-900 border border-zinc-700 hover:border-emerald-500 text-xs font-black px-2.5 py-2 rounded-2xl flex items-center gap-1 transition-all text-white cursor-pointer shadow-sm"
              title="Change Language"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xs:inline">{language === 'en' ? 'አማርኛ' : 'EN'}</span>
            </button>

            {/* Sound Mute / Unmute */}
            <button
              onClick={toggleMute}
              className="bg-zinc-900 border border-zinc-800 p-2 rounded-2xl text-zinc-400 hover:text-emerald-400 hover:border-zinc-700 transition-all cursor-pointer"
              title={isMuted ? t('soundOff') : t('soundOn')}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Quick Wallet Pill */}
            <div
              onClick={() => {
                soundFx.playButtonClick();
                setSelectedGameId(null);
                setActiveTab('wallet');
              }}
              className="bg-gradient-to-r from-zinc-900 to-zinc-950 border-2 border-emerald-500/40 hover:border-emerald-400 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-all shadow-md group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">🪙</span>
              <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm">
                {(user?.wallet?.availableBalance || 0).toLocaleString()} <span className="text-[10px] text-zinc-300 font-sans">ብር</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3.5 sm:p-6 pb-24">
        {selectedGameId ? (
          <PublicGameView
            gameId={selectedGameId}
            onBack={() => {
              setSelectedGameId(null);
              fetchGames();
            }}
            onOpenOperator={() => {
              setSelectedGameId(null);
              setActiveTab('operator');
            }}
          />
        ) : (
          <>
            {/* TAB: OPERATOR */}
            {activeTab === 'operator' && (
              <OperatorBoard
                onBack={() => {
                  setActiveTab('games');
                  fetchGames();
                }}
              />
            )}

            {/* TAB: GAMES (Arcade Lobby) */}
            {activeTab === 'games' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Hero Gaming Arena Billboard */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Banner 1: Animated Arcade Table Callout */}
                  <div className="md:col-span-8 bg-gradient-to-br from-[#0f172a] via-[#0b1329] to-[#040915] border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-2xl">
                    {/* Glowing ambient neon orbs */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-10 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

                    <div className="space-y-3 z-10">
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black tracking-wider uppercase">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>{language === 'am' ? 'የቀጥታ ጠረጴዛዎች' : 'LIVE 5-CARD ARENA'}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>{winStreak}X STREAK ACTIVE</span>
                        </span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                        {language === 'am'
                          ? '5 ሚስጥር ካርዶችህን አስገባና ሽልማቱን ውሰድ!'
                          : 'Pocket Your 5 Secret Balls to Win the Pot!'}
                      </h2>

                      <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-lg">
                        {language === 'am'
                          ? 'የተሰጡህን 5 ሚስጥር ካርዶች በጠረጴዛው ላይ ምታ። ተጫዋቾች በተቀላቀሉ ቁጥር የሽልማት መጠኑ በራስ-ሰር ይጨምራል!'
                          : 'Match pool balls 1–13 with your secret cards. Sink duplicate cards simultaneously, level up your cue rank, and claim real Telebirr rewards!'}
                      </p>
                    </div>

                    <div className="pt-5 z-10 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => {
                          soundFx.playButtonClick();
                          setShowCreateModal(true);
                        }}
                        className="px-6 py-3.5 rounded-2xl btn-game-green font-black text-xs sm:text-sm tracking-wider uppercase text-zinc-950 flex items-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>{t('createMatch')}</span>
                      </button>

                      <button
                        onClick={() => {
                          soundFx.playButtonClick();
                          setShowRulesModal(true);
                        }}
                        className="px-5 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-2 border-zinc-700 text-xs font-black tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        <span>{t('howToPlay')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner 2: Lucky Telebirr Deposit Vault */}
                  <div
                    onClick={() => {
                      soundFx.playButtonClick();
                      setShowDepositModal(true);
                    }}
                    className="md:col-span-4 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 rounded-3xl p-5 sm:p-6 flex flex-col justify-between text-zinc-950 shadow-2xl transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
                  >
                    <div className="absolute -right-6 -bottom-6 text-7xl opacity-20 group-hover:scale-110 transition-transform pointer-events-none">
                      💵
                    </div>

                    <div>
                      <div className="inline-block bg-zinc-950/30 px-3 py-1 rounded-full text-zinc-950 font-black text-[10px] uppercase tracking-wider mb-2">
                        {language === 'am' ? 'ፈጣን ቴሌብር' : 'INSTANT TELEBIRR'}
                      </div>
                      <h3 className="text-white font-black text-2xl sm:text-3xl leading-tight">
                        {language === 'am' ? 'ብር አስገባ' : 'ADD MONEY'}
                      </h3>
                      <p className="text-emerald-950 text-xs mt-1.5 font-bold leading-relaxed">
                        {language === 'am'
                          ? 'በቴሌብር ብር ይላኩና ወዲያውኑ ውድድር ይጀምሩ'
                          : 'Top up in seconds and jump straight into live cash tables.'}
                      </p>
                    </div>

                    <div className="flex justify-between items-center bg-zinc-950/25 p-3 rounded-2xl mt-4">
                      <span className="text-white font-black text-xs uppercase tracking-wider">
                        {t('addMoney')}
                      </span>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Player Badges & Achievements Carousel Shelf */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-[#0f172a] border border-zinc-800 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                      🎯
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Sharpshooter</h4>
                      <p className="text-[10px] text-zinc-400">Level {playerLevel} Perk</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#0f172a] border border-zinc-800 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                      🔥
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{winStreak} Win Streak</h4>
                      <p className="text-[10px] text-emerald-400">+50 XP Bonus</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#0f172a] border border-zinc-800 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl shrink-0">
                      👑
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Table Hustler</h4>
                      <p className="text-[10px] text-zinc-400">8 Matches Won</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#0f172a] border border-zinc-800 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
                      🎁
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Daily Bonus</h4>
                      <p className="text-[10px] text-amber-400">Ready to Claim</p>
                    </div>
                  </div>
                </div>

                {/* Active Tables List Header */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">
                        {t('activeGames')} ({games.length})
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        soundFx.playButtonClick();
                        fetchGames();
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer flex items-center gap-1"
                    >
                      <span>↻</span>
                      <span>{language === 'am' ? 'አድስ (Refresh)' : 'Refresh Tables'}</span>
                    </button>
                  </div>

                  {gamesLoading ? (
                    <div className="p-12 text-center text-zinc-500 text-xs font-bold space-y-2">
                      <div className="text-3xl animate-spin">🎱</div>
                      <p>{language === 'am' ? 'ጠረጴዛዎች በመጫን ላይ...' : 'Loading tables...'}</p>
                    </div>
                  ) : games.length === 0 ? (
                    <div className="p-10 bg-[#0f172a] border-2 border-dashed border-zinc-800 rounded-3xl text-center space-y-3">
                      <div className="text-5xl">🎱</div>
                      <p className="text-sm text-zinc-300 font-bold">
                        {language === 'am' ? 'ምንም ክፍት ጨዋታ የለም' : 'No active games found.'}
                      </p>
                      <button
                        onClick={() => {
                          soundFx.playButtonClick();
                          setShowCreateModal(true);
                        }}
                        className="px-6 py-3 rounded-2xl btn-game-green font-black text-xs text-zinc-950 cursor-pointer shadow-md"
                      >
                        {t('createMatch')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {games.map((g) => {
                        const isLive = g.status === 'ACTIVE';
                        const isWaiting = g.status === 'WAITING';

                        return (
                          <div
                            key={g.id}
                            onClick={() => {
                              soundFx.playButtonClick();
                              setSelectedGameId(g.id);
                            }}
                            className={`bg-gradient-to-b from-[#111a2e] to-[#0a1120] border-2 rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all cursor-pointer group hover:-translate-y-1.5 ${
                              isLive
                                ? 'border-emerald-500/50 hover:border-emerald-400 shadow-emerald-950/20'
                                : 'border-zinc-800 hover:border-amber-500/50'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-zinc-300 flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800">
                                  <span>🎱</span>
                                  <span>{g.tableNumber || 'Table 1'}</span>
                                </span>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                    isLive
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                                      : isWaiting
                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {isLive
                                    ? (language === 'am' ? '⚡ በመጫወት ላይ' : '⚡ LIVE MATCH')
                                    : isWaiting
                                    ? (language === 'am' ? 'ክፍት ጠረጴዛ' : 'OPEN LOBBY')
                                    : g.status}
                                </span>
                              </div>

                              <h4 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors">
                                {g.name}
                              </h4>

                              <div className="flex items-center gap-3 text-xs text-zinc-400">
                                <span className="flex items-center gap-1 font-bold text-zinc-300">
                                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>
                                    {g.players.length} {t('players')} {isWaiting ? (language === 'am' ? '(ክፍት)' : '(Open)') : ''}
                                  </span>
                                </span>
                                <span>•</span>
                                <span>{t('entryFee')}: <strong className="text-white">{g.entryFee} ብር</strong></span>
                              </div>

                              {isLive && g.currentTurnUsername && (
                                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-black flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                  <span>{language === 'am' ? `ተራ፡ ${g.currentTurnUsername}` : `Turn: ${g.currentTurnUsername}`}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                              <div>
                                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">{t('prizePot')}</p>
                                <p className="font-mono font-black text-amber-400 text-xl flex items-center gap-1">
                                  <span>🪙</span>
                                  <span>{g.winnerPayout} ETB</span>
                                </p>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-black text-zinc-950 btn-game-green px-4 py-2 rounded-2xl transition-all shadow-md inline-block uppercase tracking-wider">
                                  {isWaiting ? t('joinGame') : t('spectate')} →
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

            {/* TAB: WALLET */}
            {activeTab === 'wallet' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Wallet Balance Card */}
                  <div className="md:col-span-8 bg-gradient-to-br from-[#111a2e] to-[#0a1120] border-2 border-emerald-500/30 rounded-3xl p-6 space-y-4 shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-zinc-400 text-xs uppercase tracking-widest font-black">
                          {t('availableMoney')}
                        </span>
                        <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono mt-1 flex items-center gap-2">
                          <span>🪙</span>
                          <span>{(user?.wallet?.availableBalance || 0).toLocaleString()}</span>
                          <span className="text-lg font-bold text-white">ብር (ETB)</span>
                        </div>
                      </div>

                      {user?.wallet?.lockedBalance ? (
                        <div className="text-right bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                            {language === 'am' ? 'በማረጋገጥ ላይ' : 'In Review'}
                          </p>
                          <p className="font-mono font-bold text-amber-300 text-sm">{user.wallet.lockedBalance} ETB</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => {
                          soundFx.playButtonClick();
                          setShowDepositModal(true);
                        }}
                        className="py-4 rounded-2xl btn-game-green text-zinc-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>{t('addMoney')}</span>
                      </button>

                      <button
                        onClick={() => {
                          soundFx.playButtonClick();
                          setShowWithdrawModal(true);
                        }}
                        className="py-4 rounded-2xl btn-game-gold text-zinc-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>{t('withdrawMoney')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Payment Guide Tile */}
                  <div className="md:col-span-4 bg-[#0f172a] border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                      <span className="text-emerald-400 text-xs uppercase tracking-widest font-black">
                        {language === 'am' ? 'የአከፋፈል መመሪያ' : 'Payment Method'}
                      </span>
                      <h4 className="text-white font-bold text-base mt-1 flex items-center gap-1.5">
                        <span>📱</span>
                        <span>Telebirr (ቴሌብር)</span>
                      </h4>
                      <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
                        {t('depositNote')}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-800 flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-bold">Safe & Secure</span>
                      <span className="text-emerald-400 font-mono font-black">VERIFIED 🛡️</span>
                    </div>
                  </div>
                </div>

                {/* Transactions Ledger */}
                <div className="bg-[#0f172a] border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">●</span>
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                        {language === 'am' ? 'የገንዘብ እንቅስቃሴ ታሪክ' : 'Recent Transactions'}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        soundFx.playButtonClick();
                        fetchTransactions();
                      }}
                      className="text-xs text-emerald-400 hover:underline font-bold cursor-pointer"
                    >
                      {language === 'am' ? 'አድስ' : 'Refresh'}
                    </button>
                  </div>

                  {txLoading ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">
                      {language === 'am' ? 'በመጫን ላይ...' : 'Loading history...'}
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-2xl text-center text-zinc-500 text-xs">
                      {language === 'am' ? 'ምንም የገንዘብ እንቅስቃሴ አልተመዘገበም' : 'No transactions recorded yet.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
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

            {/* TAB: LEADERBOARD / RANKS */}
            {activeTab === 'leaderboard' && (
              <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn">
                {/* Tournament Trophy Banner */}
                <div className="rounded-3xl bg-gradient-to-r from-amber-950/60 via-[#15102a] to-emerald-950/60 border-2 border-amber-500/30 p-6 shadow-2xl space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-amber-400 text-zinc-950 flex items-center justify-center text-xl font-black shadow-lg shadow-amber-400/20">
                        🏆
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">
                          Weekly Grand Championship
                        </h3>
                        <p className="text-xs text-amber-300 font-medium">Addis Pool Cards Arena Season 4</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                      ENDS IN 2D
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#080c16]/80 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-black">Tournament Pot</div>
                      <div className="text-xl font-mono font-black text-amber-400">25,000 ETB</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-400 uppercase font-black">Your Rank</div>
                      <div className="text-sm font-mono font-black text-emerald-400">#4 (Top 5%)</div>
                    </div>
                  </div>
                </div>

                {/* Leaderboard Table */}
                <div className="bg-[#0f172a] border border-zinc-800 rounded-3xl p-5 space-y-3">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>Top Cue Masters & Sharks</span>
                  </h4>

                  <div className="space-y-2">
                    {[
                      { rank: 1, name: 'Dawit Cue King', tag: '@dawit_pool', wins: 84, earned: '8,400 ETB', badge: '👑 Grandmaster' },
                      { rank: 2, name: 'Bole Shark', tag: '@shark_bole', wins: 62, earned: '5,200 ETB', badge: '🦈 Shark' },
                      { rank: 3, name: 'Yonas 8-Ball', tag: '@yonas_addis', wins: 51, earned: '4,100 ETB', badge: '🎱 Hustler' },
                      { rank: 4, name: user?.firstName || 'You (Current Player)', tag: `@${user?.username}`, wins: 28, earned: `${user?.wallet?.availableBalance || 0} ETB`, badge: `⚡ ${currentTitle}`, isMe: true },
                      { rank: 5, name: 'Hirut Master', tag: '@hirut_m', wins: 24, earned: '1,900 ETB', badge: '⭐ Club Player' },
                    ].map((item) => (
                      <div
                        key={item.rank}
                        className={`p-3 rounded-2xl flex items-center justify-between text-xs transition-all ${
                          item.isMe
                            ? 'bg-emerald-500/10 border-2 border-emerald-500/40 text-white'
                            : 'bg-[#080d1a] border border-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                              item.rank === 1
                                ? 'bg-amber-400 text-zinc-950 font-bold'
                                : item.rank === 2
                                ? 'bg-slate-300 text-zinc-950 font-bold'
                                : item.rank === 3
                                ? 'bg-amber-700 text-white font-bold'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {item.rank}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.isMe && (
                                <span className="text-[9px] bg-emerald-400 text-zinc-950 px-1.5 rounded-full font-black">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500">{item.badge}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-black text-amber-400">{item.earned}</div>
                          <div className="text-[10px] text-zinc-500">{item.wins} Wins</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl mx-auto space-y-4 animate-fadeIn">
                <div className="bg-[#0f172a] border border-zinc-800 rounded-3xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 flex items-center justify-center text-2xl font-black shadow-xl shadow-emerald-500/20 shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          <span>{user?.firstName || user?.username}</span>
                          <span className="text-sm text-zinc-400 font-normal">(@{user?.username})</span>
                        </h3>
                        <div className="text-xs text-zinc-400">Telegram ID: <strong className="text-zinc-300 font-mono">{user?.telegramId || 'Guest'}</strong></div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-black border border-emerald-500/30">
                            {user?.role} ACCOUNT
                          </span>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/30">
                            LEVEL {playerLevel} • {currentTitle}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isEditingName && (
                      <button
                        onClick={() => {
                          soundFx.playButtonClick();
                          setEditFirstName(user?.firstName || '');
                          setEditUsername(user?.username || '');
                          setIsEditingName(true);
                        }}
                        className="px-4 py-2 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{language === 'am' ? 'ስም ቀይር' : 'Edit Name'}</span>
                      </button>
                    )}
                  </div>

                  {/* Name Entry / Edit Box */}
                  {isEditingName && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!editFirstName.trim()) return;
                        setIsSavingName(true);
                        try {
                          await updateProfileName(editFirstName.trim(), editUsername.trim() || undefined);
                          setNameUpdateSuccess(true);
                          setTimeout(() => setNameUpdateSuccess(false), 3000);
                          setIsEditingName(false);
                        } catch (err: any) {
                          alert(err.message || 'Failed to update name');
                        } finally {
                          setIsSavingName(false);
                        }
                      }}
                      className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/40 space-y-3 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          {language === 'am' ? 'የተጫዋች ስም ያስገቡ/ያስተካክሉ' : 'Enter & Update Player Identity'}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(false)}
                          className="text-zinc-500 hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 font-bold">
                            {language === 'am' ? 'የተጫዋች ሙሉ ስም *' : 'Display Name (Player Name) *'}
                          </label>
                          <input
                            type="text"
                            required
                            value={editFirstName}
                            onChange={(e) => setEditFirstName(e.target.value)}
                            placeholder="e.g. Dawit Kebede"
                            className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 font-bold">
                            {language === 'am' ? 'የተጠቃሚ መለያ (@username)' : 'User Handle (@username)'}
                          </label>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            placeholder="e.g. dawit_pool"
                            className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingName(false)}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-700"
                        >
                          {language === 'am' ? 'ተው' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingName}
                          className="px-4 py-1.5 rounded-xl btn-game-green text-zinc-950 text-xs font-black uppercase cursor-pointer flex items-center gap-1 shadow-md disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSavingName ? (language === 'am' ? 'በመቀየር ላይ...' : 'Saving...') : (language === 'am' ? 'አስቀምጥ' : 'Save Name')}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {nameUpdateSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{language === 'am' ? 'የተጫዋች ስምዎ በተሳካ ሁኔታ ተቀይሯል!' : 'Your player name has been updated successfully!'}</span>
                    </div>
                  )}

                  <div className="divide-y divide-zinc-800 text-xs pt-2">
                    <button
                      onClick={() => setShowRulesModal(true)}
                      className="w-full py-3.5 text-left flex items-center justify-between text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>{t('howToPlay')}</span>
                      </span>
                      <span className="text-zinc-500">›</span>
                    </button>

                    <div className="py-3.5 flex items-center justify-between text-zinc-400">
                      <span>{language === 'am' ? 'ቋንቋ' : 'Language'}</span>
                      <button
                        onClick={toggleLanguage}
                        className="text-emerald-400 font-bold cursor-pointer hover:underline"
                      >
                        {language === 'en' ? 'English (Switch to አማርኛ)' : 'አማርኛ (Switch to English)'}
                      </button>
                    </div>

                    <div className="py-3.5 flex items-center justify-between text-zinc-400">
                      <span>{language === 'am' ? 'ድምፅ' : 'Sound Effects'}</span>
                      <button
                        onClick={toggleMute}
                        className="text-emerald-400 font-bold cursor-pointer hover:underline"
                      >
                        {isMuted ? (language === 'am' ? 'ጠፍቷል (አብራ)' : 'Muted (Unmute)') : (language === 'am' ? 'በርቷል (አጥፋ)' : 'Active (Mute)')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Arcade Bottom Dock - 100% User Focused */}
      <nav className="fixed bottom-3 inset-x-0 z-30 mx-auto max-w-sm px-4">
        <div className="bg-[#0b1325]/95 backdrop-blur-md border-2 border-emerald-500/30 rounded-full p-1.5 flex items-center justify-around gap-1 shadow-2xl shadow-black">
          <button
            onClick={() => {
              soundFx.playButtonClick();
              setSelectedGameId(null);
              setActiveTab('games');
            }}
            className={`flex-1 py-2 rounded-full font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'games' && !selectedGameId
                ? 'btn-game-green text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🎱</span>
            <span>{t('games')}</span>
          </button>

          <button
            onClick={() => {
              soundFx.playButtonClick();
              setSelectedGameId(null);
              setActiveTab('wallet');
            }}
            className={`flex-1 py-2 rounded-full font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'wallet'
                ? 'btn-game-green text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🪙</span>
            <span>{t('wallet')}</span>
          </button>

          <button
            onClick={() => {
              soundFx.playButtonClick();
              setSelectedGameId(null);
              setActiveTab('leaderboard');
            }}
            className={`flex-1 py-2 rounded-full font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'btn-game-green text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🏆</span>
            <span>{t('leaderboard')}</span>
          </button>

          <button
            onClick={() => {
              soundFx.playButtonClick();
              setSelectedGameId(null);
              setActiveTab('profile');
            }}
            className={`flex-1 py-2 rounded-full font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'btn-game-green text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>👤</span>
            <span>{t('profile')}</span>
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

      {/* First-Time User Onboarding Name Modal */}
      <WelcomeNameModal
        isOpen={showWelcomeModal}
        initialName={user?.firstName || ''}
        language={language}
        onSetLanguage={setLanguage}
        onSubmit={async (name, username) => {
          await updateProfileName(name, username);
          localStorage.setItem('poolcards_welcomed_v1', 'true');
          setShowWelcomeModal(false);
          refreshProfile();
        }}
        onSkip={() => {
          localStorage.setItem('poolcards_welcomed_v1', 'true');
          setShowWelcomeModal(false);
        }}
      />
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin');

  return (
    <LanguageProvider>
      <AuthProvider>
        <SocketProvider>
          {isAdminRoute ? (
            <AdminPortal onNavigateHome={() => navigate('/')} />
          ) : (
            <MainAppContent onNavigateAdmin={() => navigate('/admin')} />
          )}
        </SocketProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
