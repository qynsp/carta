import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Users,
  Clock,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Play,
  Volume2,
  Sparkles,
  UserPlus,
  Zap,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { GamePublicState, GamePrivateState } from '../types';
import { CardHand } from './CardHand';
import { PoolBall } from './PoolBall';
import { soundFx } from '../utils/audio';

interface PublicGameViewProps {
  gameId: string;
  onBack: () => void;
  onOpenOperator?: () => void;
}

export const PublicGameView: React.FC<PublicGameViewProps> = ({
  gameId,
  onBack,
  onOpenOperator,
}) => {
  const { user, token } = useAuth();
  const { subscribeToGame, unsubscribeFromGame, activeGame, privateState } = useSocket();
  const { t, language } = useLanguage();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localGame, setLocalGame] = useState<GamePublicState | null>(null);
  const [localPrivate, setLocalPrivate] = useState<GamePrivateState | null>(null);
  const [joining, setJoining] = useState<boolean>(false);
  const [starting, setStarting] = useState<boolean>(false);

  const prevTurnUserRef = useRef<string | null>(null);
  const prevSunkLengthRef = useRef<number>(0);

  // Subscribe to real-time updates for this game
  useEffect(() => {
    subscribeToGame(gameId);
    fetchGameData();

    return () => {
      unsubscribeFromGame();
    };
  }, [gameId]);

  // Sync with WebSocket stream & play sound effects
  useEffect(() => {
    if (activeGame && activeGame.id === gameId) {
      setLocalGame(activeGame);
      setLoading(false);

      const activeSunkLength = activeGame.sunkBalls?.length || 0;
      // Play ball pocket sound when a ball is sunk
      if (activeSunkLength > prevSunkLengthRef.current) {
        soundFx.playBallPocket();
      }
      prevSunkLengthRef.current = activeSunkLength;

      // Play chime when turn shifts to user
      if (
        user &&
        activeGame.currentTurnUserId === user.id &&
        prevTurnUserRef.current !== user.id &&
        activeGame.status === 'ACTIVE'
      ) {
        soundFx.playYourTurn();
      }
      prevTurnUserRef.current = activeGame.currentTurnUserId;
    }
  }, [activeGame, gameId, user]);

  useEffect(() => {
    if (privateState && privateState.game?.id === gameId) {
      setLocalPrivate(privateState);
    }
  }, [privateState, gameId]);

  const fetchGameData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch public state
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load game');
      }
      const data = await res.json();
      if (data.game) {
        setLocalGame(data.game);
        prevSunkLengthRef.current = data.game.sunkBalls?.length || 0;
        prevTurnUserRef.current = data.game.currentTurnUserId;
      }

      // If authenticated, fetch private state
      if (token) {
        const privRes = await fetch(`/api/games/${gameId}/private-state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (privRes.ok) {
          const privData = await privRes.json();
          setLocalPrivate(privData);
        }
      }
    } catch (err: any) {
      console.error('Error in fetchGameData:', err);
      setError(err.message || 'Could not load match details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!token) return;
    soundFx.playButtonClick();
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join game');

      soundFx.playCoinWin();
      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error joining match');
    } finally {
      setJoining(false);
    }
  };

  const handleStartGame = async () => {
    if (!token) return;
    soundFx.playButtonClick();
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start game');

      soundFx.playYourTurn();
      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error starting match');
    } finally {
      setStarting(false);
    }
  };

  const game = localGame || activeGame;
  const players = game?.players || [];
  const sunkBalls = game?.sunkBalls || [];
  const isPlayerInGame = players.some((p) => p.userId === user?.id);
  const myCards = localPrivate?.myCards || [];
  const isMyTurn = Boolean(user && game?.currentTurnUserId === user.id);
  const isWinner = Boolean(user && game?.winnerUserId === user.id);
  const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';

  if (loading && !game) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="text-4xl animate-bounce">🎱</div>
        <span className="text-sm font-bold text-emerald-400">
          {language === 'am' ? 'ጠረጴዛው በመገናኘት ላይ...' : 'Connecting to pool arena...'}
        </span>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-6 rounded-3xl bg-rose-950/40 border-2 border-rose-800 text-center space-y-4 max-w-md mx-auto shadow-2xl animate-fadeIn my-10">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <div className="text-rose-200 font-bold">
          {error || (language === 'am' ? 'የጨዋታው መረጃ ሊገኝ አልቻለም' : 'Could not load match details')}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={fetchGameData}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-black uppercase text-zinc-950 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{language === 'am' ? 'እንደገና ሞክር' : 'Retry'}</span>
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-xs font-black uppercase text-white transition-all cursor-pointer shadow-md"
          >
            {t('backToLobby')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Nav Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            soundFx.playButtonClick();
            onBack();
          }}
          className="bg-zinc-900 border-2 border-zinc-700 hover:border-emerald-500 text-zinc-200 px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>{t('backToLobby')}</span>
        </button>

        <div className="flex items-center gap-2">
          {isOperatorOrAdmin && onOpenOperator && (
            <button
              onClick={() => {
                soundFx.playButtonClick();
                onOpenOperator();
              }}
              className="px-4 py-2.5 rounded-2xl btn-game-green text-zinc-950 text-xs font-black shadow-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t('operator')}</span>
            </button>
          )}
          <span className="px-3.5 py-2 rounded-2xl text-xs font-black bg-[#0f172a] border-2 border-emerald-500/40 text-emerald-400 shadow-md">
            🎱 {game.tableNumber || 'Table 1'}
          </span>
        </div>
      </div>

      {/* GIANT ARCADE TURN CALLOUT BANNER */}
      {game.status === 'ACTIVE' && (
        <div
          className={`p-4 sm:p-6 rounded-3xl border-2 text-center transition-all shadow-2xl relative overflow-hidden ${
            isMyTurn
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-zinc-950 border-emerald-300 shadow-emerald-500/40 animate-glow-pulse'
              : 'bg-gradient-to-br from-[#111a2e] to-[#0a1120] border-zinc-700 text-zinc-300'
          }`}
        >
          {isMyTurn ? (
            <div className="space-y-1.5 relative z-10">
              <div className="text-3xl sm:text-4xl font-black uppercase tracking-tight flex items-center justify-center gap-2">
                <Zap className="w-8 h-8 fill-zinc-950 animate-bounce" />
                <span>{t('yourTurn')}</span>
              </div>
              <p className="text-xs sm:text-sm font-black uppercase tracking-wide">
                {language === 'am'
                  ? '🎯 ካርድህ ላይ ያለውን ኳስ ጠረጴዛው ላይ ምታና አስገባ!'
                  : '🎯 Hit your secret card ball into any physical pocket now!'}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xl animate-spin">
                ⏳
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                  {language === 'am' ? 'የአሁኑ ተራ' : 'CURRENT SHOOTER'}
                </span>
                <span className="text-lg sm:text-xl font-black text-amber-400 font-sans">
                  {game.currentTurnUsername || 'Player'} {t('otherTurn')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Bento Section 1: Roster & Details (col-span-5) */}
        <section className="md:col-span-5 bg-gradient-to-b from-[#111a2e] to-[#0a1120] border-2 border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-5 shadow-2xl">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-0.5">{t('table')}</p>
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  {game.name}
                </h2>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  game.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                    : game.status === 'COMPLETED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                }`}
              >
                {game.status}
              </div>
            </div>

            {/* Players List with Dynamic Count */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs font-black text-zinc-400">
                <span className="uppercase tracking-widest">{t('players')}</span>
                <span className="text-emerald-400 font-mono">
                  {players.length} {language === 'am' ? 'ተጫዋቾች ገብተዋል' : 'PLAYERS JOINED'}
                </span>
              </div>

              {players.map((p) => {
                const isTurn = game.currentTurnUserId === p.userId && game.status === 'ACTIVE';
                const isMe = p.userId === user?.id;

                return (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all ${
                      isTurn
                        ? 'bg-emerald-500/20 border-2 border-emerald-400 text-white shadow-lg'
                        : 'bg-[#080d1a] border border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black ${
                        isTurn ? 'bg-emerald-400 text-zinc-950 animate-ping' : 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      🎱
                    </div>
                    <div className="flex-1 truncate">
                      <span className={`font-black text-sm ${isTurn ? 'text-emerald-300' : 'text-zinc-200'}`}>
                        {p.firstName || p.username} {isMe ? (language === 'am' ? '(እርስዎ)' : '(You)') : ''}
                      </span>
                    </div>
                    {p.isWinner && (
                      <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        <span>{t('winnerWas')}</span>
                      </span>
                    )}
                    {isTurn && (
                      <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider px-2.5 py-1 bg-emerald-950/90 rounded-xl border border-emerald-500/50">
                        {language === 'am' ? 'እየመታ ነው 🎯' : 'SHOOTING 🎯'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons for Waiting Lobby */}
            {game.status === 'WAITING' && (
              <div className="pt-4 space-y-3">
                {/* If user is NOT in game, allow them to join */}
                {!isPlayerInGame && (
                  <button
                    onClick={handleJoinGame}
                    disabled={joining}
                    className="w-full py-4 rounded-2xl btn-game-green text-zinc-950 font-black text-sm tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="w-5 h-5 stroke-[2.5]" />
                    <span>
                      {language === 'am'
                        ? `በ ${game.entryFee} ብር ተቀላቀል`
                        : `JOIN TABLE (${game.entryFee} ETB)`}
                    </span>
                  </button>
                )}

                {/* If 2 or more players have joined, any joined player / host / operator can start the match! */}
                {players.length >= 2 && (isPlayerInGame || isOperatorOrAdmin) && (
                  <button
                    onClick={handleStartGame}
                    disabled={starting}
                    className="w-full py-4 rounded-2xl btn-game-gold text-zinc-950 font-black text-sm tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 animate-pulse"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>
                      {starting
                        ? '...'
                        : language === 'am'
                        ? `⚡ ጨዋታውን ጀምር (${players.length} ተጫዋቾች)`
                        : `⚡ START MATCH NOW (${players.length} PLAYERS)`}
                    </span>
                  </button>
                )}

                {players.length < 2 && (
                  <div className="p-3 bg-[#080d1a] border border-zinc-800 rounded-2xl text-center text-xs text-zinc-400 font-bold">
                    {t('minPlayersNotice')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prize Pool Info */}
          <div className="pt-4 border-t border-zinc-800 flex justify-between items-end">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('entryFee')}</p>
              <p className="font-mono text-sm text-zinc-300 font-bold">{game.entryFee} ETB</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-black">{t('prizePot')}</p>
              <p className="text-2xl font-mono font-black text-amber-400 flex items-center justify-end gap-1">
                <span>🪙</span>
                <span>{game.winnerPayout} ETB</span>
              </p>
            </div>
          </div>
        </section>

        {/* Bento Section 2: Player's Private Cards Tray (col-span-7) */}
        <section className="md:col-span-7 bg-gradient-to-b from-[#111a2e] to-[#0a1120] border-2 border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-2xl">
          {isPlayerInGame && game.status === 'ACTIVE' ? (
            <CardHand
              cards={myCards}
              isMyTurn={isMyTurn}
              isGameOver={game.status === 'COMPLETED'}
              isWinner={isWinner}
            />
          ) : game.status === 'COMPLETED' ? (
            <div className="p-8 text-center space-y-4 my-auto">
              <motion.div
                animate={{ rotate: [-5, 5, -5], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-7xl"
              >
                🏆
              </motion.div>
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider">
                  MATCH CONCLUDED
                </span>
                <h3 className="text-2xl font-black text-amber-400 uppercase">{t('matchEnded')}</h3>
              </div>
              <p className="text-zinc-200 text-sm max-w-sm mx-auto font-medium">
                <strong className="text-emerald-400">{game.winnerName}</strong>{' '}
                {language === 'am'
                  ? `ጨዋታውን አሸንፎ ${game.winnerPayout} ብር ወስዷል!`
                  : `won this pool match and collected the ${game.winnerPayout} ETB pot!`}
              </p>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3 my-auto">
              <div className="text-6xl animate-pulse">🎱</div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                {language === 'am' ? 'ጨዋታው በዝግጅት ላይ' : 'Match Arena Waiting'}
              </h3>
              <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed font-medium">
                {game.status === 'WAITING'
                  ? (language === 'am'
                      ? `ተጫዋቾች እየተቀላቀሉ ነው (${players.length} ተጫዋቾች ገብተዋል)። 2 ወይም ከዚያ በላይ ሲሆኑ ጨዋታው ይጀመራል!`
                      : `Players are joining (${players.length} joined). You can start anytime with 2 or more players!`)
                  : 'Cards are active on the physical table.'}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-400 font-bold">
            <span>{t('entryFee')}: {game.entryFee} ETB</span>
            <span className="text-amber-400 font-black">{t('prizePot')}: {game.winnerPayout} ETB 🪙</span>
          </div>
        </section>

        {/* Bento Section 3: Balls On Table (col-span-6) */}
        <section className="md:col-span-6 bg-[#0f172a] border-2 border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎱</span>
                <p className="text-white text-xs uppercase tracking-widest font-black">
                  {t('ballsOnTable')} (1–15)
                </p>
              </div>
              <span className="text-[11px] text-zinc-400 font-bold">
                {language === 'am' ? '14 እና 15 ገለልተኛ ናቸው' : '14 & 15 neutral'}
              </span>
            </div>

            {/* Balls Display Grid with 3D Spheres */}
            <div className="flex flex-wrap gap-2.5 py-1">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((ballNum) => {
                const isSunk = sunkBalls.includes(ballNum);
                return (
                  <div
                    key={ballNum}
                    className={`transition-all duration-300 ${
                      isSunk ? 'opacity-20 grayscale scale-90 pointer-events-none' : 'opacity-100 scale-100 hover:scale-110'
                    }`}
                  >
                    <PoolBall number={ballNum} size="md" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs font-bold">
            <span className="text-zinc-400">
              {language === 'am' ? 'የገቡ ኳሶች' : 'Balls Pocketed'}: {sunkBalls.length}/15
            </span>
            {isOperatorOrAdmin && onOpenOperator && (
              <button
                onClick={() => {
                  soundFx.playButtonClick();
                  onOpenOperator();
                }}
                className="text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer flex items-center gap-1 uppercase tracking-wider"
              >
                <span>{t('operator')} →</span>
              </button>
            )}
          </div>
        </section>

        {/* Bento Section 4: Live Event Feed (col-span-6) */}
        <section className="md:col-span-6 bg-[#0f172a] border-2 border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <p className="text-white text-xs uppercase tracking-widest font-black">{t('liveFeed')}</p>
          </div>

          <div>
            {game.lastEvent ? (
              <div className="flex items-center gap-3 p-3.5 bg-[#080d1a] border border-zinc-800 rounded-2xl shadow-inner">
                <div className="text-2xl animate-bounce">🎱</div>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-black text-white">{game.lastEvent.message}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {new Date(game.lastEvent.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                {game.lastEvent.ballNumber && (
                  <PoolBall number={game.lastEvent.ballNumber} size="sm" />
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic py-4 font-medium">
                {language === 'am'
                  ? 'እስካሁን ምንም ኳስ አልተመታም'
                  : 'No shots recorded yet on this table.'}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
