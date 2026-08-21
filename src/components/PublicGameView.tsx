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
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { GamePublicState, GamePrivateState } from '../types';
import { CardHand } from './CardHand';
import { PoolBall } from './PoolBall';
import { ShotConfirmModal, ShotConfirmData } from './ShotConfirmModal';
import { soundFx } from '../utils/audio';
import { translateGameEvent, getGameEventStyle } from '../utils/eventTranslator';

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
  const [togglingReady, setTogglingReady] = useState<boolean>(false);
  const [shooting, setShooting] = useState<boolean>(false);
  const [shotFeedback, setShotFeedback] = useState<string | null>(null);
  const [pendingShot, setPendingShot] = useState<ShotConfirmData | null>(null);
  const [showEventHistory, setShowEventHistory] = useState<boolean>(false);
  const [votingDisband, setVotingDisband] = useState<boolean>(false);
  const [showDisbandConfirm, setShowDisbandConfirm] = useState<boolean>(false);
  const [disbandToast, setDisbandToast] = useState<string | null>(null);
  const [submittingVote, setSubmittingVote] = useState<boolean>(false);
  const [voteToast, setVoteToast] = useState<string | null>(null);
  const [touchSafetyEnabled, setTouchSafetyEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('poolcards_touch_safety');
    return saved !== null ? saved === 'true' : true;
  });

  const prevTurnUserRef = useRef<string | null>(null);
  const prevSunkLengthRef = useRef<number>(0);

  const handleToggleSafety = () => {
    soundFx.playButtonClick();
    const nextVal = !touchSafetyEnabled;
    setTouchSafetyEnabled(nextVal);
    localStorage.setItem('poolcards_touch_safety', String(nextVal));
  };

  const triggerShootAction = (ballNumber?: number, isScratch = false, isMiss = false) => {
    if (touchSafetyEnabled) {
      soundFx.playButtonClick();
      setPendingShot({ ballNumber, isScratch, isMiss });
    } else {
      handleShootBall(ballNumber, isScratch, isMiss);
    }
  };

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

  const handleToggleReady = async () => {
    if (!token || togglingReady) return;
    soundFx.playButtonClick();
    setTogglingReady(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/ready`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update ready status');

      if (data.isReady) {
        soundFx.playCardFlip();
      }
      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error updating ready status');
    } finally {
      setTogglingReady(false);
    }
  };

  const handleToggleDisbandVote = async (explicitVote?: boolean) => {
    if (!token || votingDisband) return;
    soundFx.playButtonClick();
    setVotingDisband(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/disband-vote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vote: explicitVote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update disband vote');

      if (data.disbanded) {
        soundFx.playCoinWin();
        setDisbandToast(
          language === 'am'
            ? '🎉 ጨዋታው በሁሉም ተጫዋቾች ስምምነት ፈርሷል! የመግቢያ ክፍያው ሙሉ በሙሉ ተመላሽ ተደርጓል።'
            : '🎉 Game Disbanded by unanimous vote! 100% of entry fees refunded to everyone.'
        );
      } else if (data.voted) {
        soundFx.playCardFlip();
      }

      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error submitting disband vote');
    } finally {
      setVotingDisband(false);
      setShowDisbandConfirm(false);
    }
  };

  const handleVerifyVote = async (vote: 'CONFIRMED' | 'MANIPULATED') => {
    if (!token || submittingVote) return;
    soundFx.playButtonClick();
    setSubmittingVote(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/verify-vote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit verification vote');

      if (vote === 'CONFIRMED') {
        soundFx.playCoinWin();
        setVoteToast(language === 'am' ? '✅ ጨዋታውን ትክክለኛ ነው ብለው አረጋግጠዋል!' : '✅ You confirmed the game as fair!');
      } else {
        soundFx.playScratch();
        setVoteToast(language === 'am' ? '🚨 ጨዋታው ተጭበርብሯል ብለው ሪፖርት አድርገዋል!' : '🚨 You reported the game as manipulated!');
      }
      setTimeout(() => setVoteToast(null), 4000);

      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error submitting verification vote');
    } finally {
      setSubmittingVote(false);
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

  const handleShootBall = async (ballNumber?: number, isScratch = false, isMiss = false) => {
    if (!token || shooting) return;
    if (localGame?.status !== 'ACTIVE' && activeGame?.status !== 'ACTIVE') return;

    setShooting(true);
    setError(null);
    setShotFeedback(null);

    if (isScratch) {
      soundFx.playScratch();
    } else if (isMiss) {
      soundFx.playButtonClick();
    } else {
      soundFx.playBallPocket();
    }

    try {
      const res = await fetch(`/api/games/${gameId}/shot`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ballNumber,
          isScratch,
          isMiss,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process shot event');

      if (data.result?.outcome === 'GAME_WON') {
        soundFx.playWinnerFanfare();
      } else if (data.result?.outcome === 'MATCH_SUNK') {
        soundFx.playCoinWin();
      } else if (data.result?.outcome === 'SCRATCH') {
        soundFx.playScratch();
      }

      const rawEventMsg = data.result?.message;
      const eventObj = rawEventMsg
        ? {
            id: `temp-${Date.now()}`,
            gameId,
            type: (data.result?.outcome === 'GAME_WON'
              ? 'GAME_WON'
              : data.result?.outcome === 'SCRATCH'
              ? 'SCRATCH'
              : data.result?.outcome === 'MISS'
              ? 'TURN_PASSED'
              : 'BALL_SUNK') as any,
            ballNumber,
            message: rawEventMsg,
            createdAt: new Date().toISOString(),
          }
        : null;

      const msg = eventObj
        ? translateGameEvent(eventObj, language)
        : isScratch
        ? language === 'am'
          ? '⚠️ ፎል ተመዝግቧል! ካርድ ተጨምሮ ተራው አልፏል'
          : '⚠️ Scratch recorded! Turn passed with +1 card'
        : isMiss
        ? language === 'am'
          ? '🎯 ምት አልፏል! ተራው ወደ ቀጣዩ ተጫዋች ሄዷል'
          : '🎯 Shot missed! Turn passed to next player'
        : language === 'am'
        ? `🎱 ኳስ #${ballNumber} ገብቷል!`
        : `🎱 Ball #${ballNumber} pocketed!`;

      setShotFeedback(msg);
      setTimeout(() => setShotFeedback(null), 4500);

      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error reporting shot');
      setTimeout(() => setError(null), 4000);
    } finally {
      setShooting(false);
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

  const isMyDisbandVoted = Boolean(players.find((p) => p.userId === user?.id)?.votedDisband);
  const votedDisbandCount = players.filter((p) => Boolean(p.votedDisband)).length;

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
          {/* Touch Safety Lock Toggle to prevent accidental taps */}
          <button
            type="button"
            onClick={handleToggleSafety}
            className={`px-3 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer shadow-md ${
              touchSafetyEnabled
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
            title={
              touchSafetyEnabled
                ? 'Touch Safety is ON (Prompts confirmation before shooting)'
                : 'Touch Safety is OFF (Single tap shoots instantly)'
            }
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${touchSafetyEnabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">
              {touchSafetyEnabled
                ? language === 'am'
                  ? '🛡️ ጥበቃ፡ በርቷል'
                  : '🛡️ Touch Safety: ON'
                : language === 'am'
                ? '🛡️ ጥበቃ፡ ጠፍቷል'
                : '🛡️ Touch Safety: OFF'}
            </span>
          </button>

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
            <div className="space-y-3 relative z-10">
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-black uppercase tracking-tight flex items-center justify-center gap-2">
                  <Zap className="w-8 h-8 fill-zinc-950 animate-bounce" />
                  <span>{t('yourTurn')}</span>
                </div>
                <p className="text-xs sm:text-sm font-black uppercase tracking-wide">
                  {language === 'am'
                    ? '🎯 ካርድህ ላይ ያለውን ኳስ ጠረጴዛው ላይ ምታና አስገባ! (ኳሱን ነካ በማድረግ መመዝገብ ትችላለህ)'
                    : '🎯 Hit your ball into any pocket, or tap below to record your shot!'}
                </p>
              </div>

              {/* Quick Shoot Actions in Banner */}
              <div className="pt-2.5 border-t border-zinc-950/15 flex flex-wrap items-center justify-center gap-2">
                {myCards.length > 0 &&
                  (Array.from(new Set(myCards)) as number[]).map((cVal) => (
                    <button
                      key={cVal}
                      type="button"
                      onClick={() => triggerShootAction(cVal)}
                      disabled={shooting || sunkBalls.includes(cVal)}
                      className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-emerald-400 border border-emerald-400/40 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40"
                    >
                      <span>🎱</span>
                      <span>{language === 'am' ? `ኳስ ${cVal} አስገባ` : `Sink #${cVal}`}</span>
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => triggerShootAction(undefined, false, true)}
                  disabled={shooting}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40"
                >
                  <span>🎯</span>
                  <span>{language === 'am' ? 'ምት አምልጧል / ተራ ማለፍ' : 'Missed / Next Player'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerShootAction(undefined, true, false)}
                  disabled={shooting}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{language === 'am' ? '⚠️ ፎል/ጭረት' : '⚠️ Scratch / Foul'}</span>
                </button>
              </div>
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

      {/* Real-time Shot Feedback Toast */}
      {shotFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-black text-sm text-center flex items-center justify-center gap-2 shadow-xl animate-fadeIn">
          <Sparkles className="w-5 h-5 text-emerald-400 animate-spin" />
          <span>{shotFeedback}</span>
        </div>
      )}

      {/* Disband Toast Message */}
      {disbandToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-black text-sm text-center flex items-center justify-center gap-2 shadow-xl animate-fadeIn">
          <span>{disbandToast}</span>
        </div>
      )}

      {/* Verification Vote Toast Message */}
      {voteToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-black text-sm text-center flex items-center justify-center gap-2 shadow-xl animate-fadeIn">
          <span>{voteToast}</span>
        </div>
      )}

      {/* Real-time Disband / ይፍረስ Progress Banner */}
      {votedDisbandCount > 0 && game.status !== 'COMPLETED' && game.status !== 'CANCELLED' && (
        <div className="p-4 rounded-3xl bg-amber-950/60 border-2 border-amber-500/60 text-amber-200 shadow-2xl animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-xl shrink-0">
              ⚠️
            </div>
            <div>
              <div className="font-black text-sm text-amber-300 flex items-center gap-2">
                <span>{t('disbandProgress')}</span>
                <span className="font-mono bg-amber-950 px-2.5 py-0.5 rounded-xl border border-amber-500/50 text-xs">
                  {votedDisbandCount}/{players.length} {language === 'am' ? 'ድምጽ ተሰጥቷል' : 'Votes'}
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-medium">
                {language === 'am'
                  ? 'ሁሉም ተጫዋቾች "ይፍረስ" ካሉ ጨዋታው ተሰርዞ የመግቢያ ክፍያው 100% ወደ ዋሌትዎ ወዲያው ይመለሳል።'
                  : 'If all players agree to disband (ይፍረስ), the match ends and 100% of entry fees are refunded.'}
              </p>
            </div>
          </div>

          {isPlayerInGame && (
            <button
              type="button"
              onClick={() => {
                if (!isMyDisbandVoted) {
                  setShowDisbandConfirm(true);
                } else {
                  handleToggleDisbandVote(false);
                }
              }}
              disabled={votingDisband}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 shrink-0 ${
                isMyDisbandVoted
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/60'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
              }`}
            >
              <span>{isMyDisbandVoted ? t('cancelDisbandVote') : t('voteDisband')}</span>
            </button>
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
                    : game.status === 'CANCELLED'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
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

                    {/* Disband vote indicator badge */}
                    {p.votedDisband && game.status !== 'COMPLETED' && game.status !== 'CANCELLED' && (
                      <span className="px-2 py-0.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm animate-pulse">
                        <span>⚠️</span>
                        <span>{language === 'am' ? 'ይፍረስ' : 'Disband'}</span>
                      </span>
                    )}

                    {/* Waiting Lobby: Player Ready status */}
                    {game.status === 'WAITING' && (
                      <div>
                        {p.isReady ? (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>{language === 'am' ? 'ዝግጁ' : 'READY'}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-800/90 text-zinc-400 border border-zinc-700/60 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400/90" />
                            <span>{language === 'am' ? 'አልተዘጋጀም' : 'NOT READY'}</span>
                          </span>
                        )}
                      </div>
                    )}

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
            {game.status === 'WAITING' && (() => {
              const myPlayer = players.find((p) => p.userId === user?.id);
              const isMeReady = Boolean(myPlayer?.isReady);
              const readyPlayersCount = players.filter((p) => Boolean(p.isReady)).length;
              const allReady = players.length >= 2 && readyPlayersCount === players.length;

              return (
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

                  {/* If user is in game, prominent Ready/Not Ready toggle button */}
                  {isPlayerInGame && (
                    <button
                      onClick={handleToggleReady}
                      disabled={togglingReady}
                      className={`w-full py-4 rounded-2xl font-black text-sm tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 ${
                        isMeReady
                          ? 'bg-zinc-900 border-2 border-emerald-500/80 text-emerald-300 hover:bg-zinc-800'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 border-2 border-emerald-300 animate-pulse'
                      }`}
                    >
                      <CheckCircle2 className={`w-5 h-5 ${isMeReady ? 'text-emerald-400' : 'stroke-[2.5]'}`} />
                      <span>
                        {togglingReady
                          ? '...'
                          : isMeReady
                          ? language === 'am'
                            ? '✅ እርስዎ ዝግጁ ኖት (ለመሰረዝ ይጫኑ)'
                            : '✅ YOU ARE READY (Tap to Cancel)'
                          : language === 'am'
                          ? '🟢 እኔ ዝግጁ ነኝ ይጫኑ (TAP READY)'
                          : '🟢 TAP I AM READY'}
                      </span>
                    </button>
                  )}

                  {/* Ready status indicator banner */}
                  {players.length >= 2 ? (
                    allReady ? (
                      <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-center flex items-center justify-center gap-2 text-emerald-300 font-black text-xs uppercase tracking-wide">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {language === 'am'
                            ? `⚡ ሁሉም ተጫዋቾች ዝግጁ ናቸው (${readyPlayersCount}/${players.length})!`
                            : `⚡ ALL PLAYERS READY (${readyPlayersCount}/${players.length})!`}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-1">
                        <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wide">
                          <Clock className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                          <span>
                            {language === 'am'
                              ? `ሁሉንም ተጫዋቾች በመጠበቅ ላይ (${readyPlayersCount}/${players.length} ዝግጁ)`
                              : `Waiting for all players to tap Ready (${readyPlayersCount}/${players.length} Ready)`}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          {language === 'am'
                            ? 'ሁሉም ተጫዋቾች "ዝግጁ ነኝ" ሳይሉ ጨዋታው መጀመር አይችልም'
                            : 'Game will not start until every joined player taps Ready'}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="p-3 bg-[#080d1a] border border-zinc-800 rounded-2xl text-center text-xs text-zinc-400 font-bold">
                      {t('minPlayersNotice')}
                    </div>
                  )}

                  {/* Disband Option inside Waiting Lobby for Joined Players */}
                  {isPlayerInGame && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isMyDisbandVoted) {
                          setShowDisbandConfirm(true);
                        } else {
                          handleToggleDisbandVote(false);
                        }
                      }}
                      disabled={votingDisband}
                      className={`w-full py-2.5 px-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                        isMyDisbandVoted
                          ? 'bg-amber-950/60 border border-amber-500/60 text-amber-300'
                          : 'bg-zinc-900/90 border border-zinc-700/80 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40'
                      }`}
                    >
                      <span>⚠️</span>
                      <span>
                        {isMyDisbandVoted
                          ? language === 'am'
                            ? 'የይፍረስ ድምፅህን አንሳ (Cancel Vote)'
                            : 'Cancel Disband Vote'
                          : language === 'am'
                          ? 'ይፍረስ / ሙሉ ተመላሽ ምረጥ (Disband)'
                          : 'Vote to Disband & Refund (ይፍረስ)'}
                      </span>
                    </button>
                  )}

                  {/* If 2 or more players have joined, allow match start ONLY if all players are ready */}
                  {players.length >= 2 && (isPlayerInGame || isOperatorOrAdmin) && (
                    allReady ? (
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
                    ) : (
                      <button
                        disabled={true}
                        className="w-full py-3.5 rounded-2xl bg-zinc-800/50 border border-zinc-700/60 text-zinc-400 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
                      >
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>
                          {language === 'am'
                            ? `መጀመር አይቻልም (${players.length - readyPlayersCount} ያልተዘጋጁ ተጫዋቾች አሉ)`
                            : `CANNOT START (${players.length - readyPlayersCount} player(s) not ready)`}
                        </span>
                      </button>
                    )
                  )}
                </div>
              );
            })()}

            {/* Disband Option in Active Game for Joined Players */}
            {game.status === 'ACTIVE' && isPlayerInGame && (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!isMyDisbandVoted) {
                      setShowDisbandConfirm(true);
                    } else {
                      handleToggleDisbandVote(false);
                    }
                  }}
                  disabled={votingDisband}
                  className={`w-full py-2.5 px-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                    isMyDisbandVoted
                      ? 'bg-amber-950/60 border border-amber-500/60 text-amber-300'
                      : 'bg-zinc-900/90 border border-zinc-700/80 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40'
                  }`}
                >
                  <span>⚠️</span>
                  <span>
                    {isMyDisbandVoted
                      ? language === 'am'
                        ? 'የይፍረስ ድምፅህን አንሳ (Cancel Vote)'
                        : 'Cancel Disband Vote'
                      : language === 'am'
                      ? 'ይፍረስ / ሙሉ ተመላሽ ምረጥ (Disband)'
                      : 'Vote to Disband & Refund (ይፍረስ)'}
                  </span>
                </button>
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
              onCardClick={(val) => triggerShootAction(val)}
            />
          ) : game.status === 'COMPLETED' ? (
            <div className="space-y-4 my-auto">
              {/* Winner Celebration / Status Banner */}
              <div className="bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-4 text-center relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-2xl">🏆</span>
                  {game.verificationStatus === 'CONFIRMED' ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'am' ? 'በተጫዋቾች ስምምነት ጸድቋል • ተከፍሏል' : 'Verified Fair • Payout Released'}
                    </span>
                  ) : game.verificationStatus === 'MANIPULATED' ? (
                    <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {language === 'am' ? 'ተጭበርብሯል ተብሏል • 100% ተመላሽ ተደርጓል' : 'Manipulated • 100% Refunded'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      {language === 'am'
                        ? `ማረጋገጫ በመጠበቅ ላይ (${game.confirmedVotesCount || 0}/${game.requiredConfirmations || Math.ceil(players.length * 0.5)} ድምጽ)`
                        : `Verification Pending (${game.confirmedVotesCount || 0}/${game.requiredConfirmations || Math.ceil(players.length * 0.5)} needed)`}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black text-amber-400 uppercase tracking-tight">
                  {game.winnerName} {language === 'am' ? 'አሸንፏል!' : 'Won the Match!'}
                </h3>
                <p className="text-zinc-300 text-xs mt-1">
                  {language === 'am'
                    ? `የሽልማት ገቢ፡ ${game.winnerPayout} ብር (ጠቅላላ ፖት፡ ${game.totalPot} ብር)`
                    : `Winner Pot: ${game.winnerPayout} ETB (Total Pool: ${game.totalPot} ETB)`}
                </p>
              </div>

              {/* Anti-Manipulation Protection Box */}
              <div className="bg-slate-900/80 border border-slate-700/70 rounded-2xl p-3.5 text-xs text-zinc-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{language === 'am' ? 'የማጭበርበር መከላከያ (Anti-Manipulation Protection)' : 'Anti-Manipulation Protection'}</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {t('antiManipulationNotice')}
                </p>

                {/* Vote Progress Bar */}
                <div className="pt-1.5 space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-emerald-400">
                      ✅ {t('confirmedVotesLabel')}: {game.confirmedVotesCount || 0}/{players.length}
                    </span>
                    <span className="text-rose-400">
                      🚨 {t('manipulatedVotesLabel')}: {game.manipulatedVotesCount || 0}/{players.length}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{
                        width: `${((game.confirmedVotesCount || 0) / Math.max(players.length, 1)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{
                        width: `${((game.manipulatedVotesCount || 0) / Math.max(players.length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Winner Revealed Cards Audit */}
              {game.winnerCardsRevealed && game.winnerCardsRevealed.length > 0 && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                    <span>{t('winnerHandAudit')}</span>
                    <span className="text-emerald-400 text-[10px]">
                      {language === 'am' ? '5ቱም ካርዶች ተመተዋል' : 'All 5 Target Balls Sunk'}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {game.winnerCardsRevealed.map((c) => (
                      <div
                        key={c.cardValue}
                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-800/90 border border-emerald-500/40 min-w-[52px]"
                      >
                        <PoolBall number={c.cardValue} size="sm" />
                        <span className="text-[9px] font-black text-emerald-400 mt-1">✓ SUNK</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sank Balls Chronological Audit */}
              {game.sunkBallsAudit && game.sunkBallsAudit.length > 0 && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    {t('sunkBallsChronological')}
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {game.sunkBallsAudit.map((s, idx) => (
                      <div
                        key={`${s.ballNumber}-${idx}`}
                        className="flex items-center justify-between py-1 px-2 rounded-lg bg-zinc-800/50 border border-zinc-700/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-mono text-[10px]">#{idx + 1}</span>
                          <PoolBall number={s.ballNumber} size="sm" />
                          <span className="font-bold text-zinc-200">{s.sunkByName || 'Player'}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Player Voting Controls */}
              {isPlayerInGame && (game.verificationStatus === 'PENDING' || !game.verificationStatus) && (
                <div className="pt-2 space-y-2">
                  {(() => {
                    const myPlayer = players.find((p) => p.userId === user?.id);
                    const myVote = myPlayer?.endGameVote;

                    return (
                      <div className="space-y-2">
                        {myVote && (
                          <p className="text-center text-xs font-bold text-zinc-300">
                            {language === 'am' ? 'የመረጡት ድምጽ፡' : 'Your submitted vote:'}{' '}
                            <span className={myVote === 'CONFIRMED' ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                              {myVote === 'CONFIRMED'
                                ? (language === 'am' ? '✅ ትክክለኛ ነው' : '✅ Fair Game')
                                : (language === 'am' ? '🚨 ተጭበርብሯል' : '🚨 Manipulated')}
                            </span>
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyVote('CONFIRMED')}
                            disabled={submittingVote || myVote === 'CONFIRMED'}
                            className={`py-3 px-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg ${
                              myVote === 'CONFIRMED'
                                ? 'bg-emerald-900/60 border-2 border-emerald-400 text-emerald-200'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 active:scale-95'
                            } disabled:opacity-50`}
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{t('confirmFairGame')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVerifyVote('MANIPULATED')}
                            disabled={submittingVote || myVote === 'MANIPULATED'}
                            className={`py-3 px-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg ${
                              myVote === 'MANIPULATED'
                                ? 'bg-rose-900/60 border-2 border-rose-400 text-rose-200'
                                : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95'
                            } disabled:opacity-50`}
                          >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{t('reportManipulated')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : game.status === 'CANCELLED' ? (
            <div className="p-8 text-center space-y-4 my-auto">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="text-7xl"
              >
                💸
              </motion.div>
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black uppercase tracking-wider">
                  DISBANDED & REFUNDED
                </span>
                <h3 className="text-2xl font-black text-rose-400 uppercase">
                  {language === 'am' ? 'ጨዋታው ፈርሷል (ይፍረስ)' : 'Game Disbanded & Refunded'}
                </h3>
              </div>
              <p className="text-zinc-300 text-sm max-w-sm mx-auto font-medium leading-relaxed">
                {language === 'am'
                  ? `ሁሉም ተጫዋቾች ይፍረስ በማለታቸው ጨዋታው ተሰርዟል። የመግቢያ ክፍያው (${game.entryFee} ብር) ለሁሉም ተጫዋቾች ሙሉ በሙሉ 100% ወደ ዋሌታቸው ተመላሽ ተደርጓል።`
                  : `All players agreed to disband the match (ይፍረስ). The full entry fee of ${game.entryFee} ETB has been 100% refunded to everyone's wallet balance.`}
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
                {isMyTurn
                  ? language === 'am'
                    ? '⚡ ኳስ ምረጥና አስገባ'
                    : '⚡ Tap any ball to sink'
                  : language === 'am'
                  ? '14 እና 15 ገለልተኛ ናቸው'
                  : '14 & 15 neutral'}
              </span>
            </div>

            {/* Balls Display Grid with Interactive Clickable 3D Spheres */}
            <div className="flex flex-wrap gap-2.5 py-1">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((ballNum) => {
                const isSunk = sunkBalls.includes(ballNum);
                const isCardMatch = myCards.includes(ballNum);
                const isNeutral = ballNum === 14 || ballNum === 15;
                const canClick =
                  !isSunk &&
                  !shooting &&
                  game.status === 'ACTIVE' &&
                  (isMyTurn || isOperatorOrAdmin || game.createdBy === user?.id);

                return (
                  <button
                    key={ballNum}
                    type="button"
                    onClick={() => {
                      if (canClick) {
                        triggerShootAction(ballNum);
                      }
                    }}
                    disabled={isSunk || shooting || game.status !== 'ACTIVE'}
                    title={
                      isSunk
                        ? `Ball ${ballNum} pocketed`
                        : isNeutral
                        ? `Ball ${ballNum} (Neutral: keeps shooter turn)`
                        : isMyTurn
                        ? `Tap to sink ball #${ballNum}`
                        : `Ball ${ballNum}`
                    }
                    className={`transition-all duration-200 relative rounded-full p-0.5 select-none ${
                      isSunk
                        ? 'opacity-20 grayscale scale-90 cursor-not-allowed'
                        : canClick
                        ? 'opacity-100 scale-100 hover:scale-115 active:scale-95 cursor-pointer ring-2 ring-transparent hover:ring-emerald-400'
                        : 'opacity-80 scale-100 cursor-default'
                    } ${isCardMatch && !isSunk && isMyTurn ? 'ring-2 ring-amber-400 animate-pulse' : ''} ${
                      isNeutral && !isSunk ? 'ring-1 ring-emerald-400/60' : ''
                    }`}
                  >
                    <PoolBall number={ballNum} size="md" />
                    {isCardMatch && !isSunk && isMyTurn && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-zinc-950 text-[9px] font-black rounded-full flex items-center justify-center border border-zinc-900 shadow">
                        ★
                      </span>
                    )}
                    {isNeutral && !isSunk && (
                      <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-emerald-500 text-zinc-950 text-[7px] font-black rounded uppercase border border-zinc-900 shadow">
                        N
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Miss & Scratch Options in Section 3 */}
            {game.status === 'ACTIVE' && (isMyTurn || isOperatorOrAdmin || game.createdBy === user?.id) && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => triggerShootAction(undefined, false, true)}
                  disabled={shooting}
                  className="py-2 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/90 border border-blue-500/40 text-blue-300 hover:text-blue-100 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50 shadow-md"
                >
                  <span>🎯</span>
                  <span>
                    {language === 'am'
                      ? 'ምት አምልጧል (ተራ ማለፍ)'
                      : 'Miss Shot / Next Player'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerShootAction(undefined, true, false)}
                  disabled={shooting}
                  className="py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 hover:text-rose-100 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50 shadow-md"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    {language === 'am'
                      ? 'ፎል / ስክራች (+1 ካርድ)'
                      : 'Scratch / Foul (+1 Card)'}
                  </span>
                </button>
              </div>
            )}
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
        <section className="md:col-span-6 bg-[#0f172a] border-2 border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <p className="text-white text-xs uppercase tracking-widest font-black">{t('liveFeed')}</p>
              </div>

              {game.recentEvents && game.recentEvents.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playButtonClick();
                    setShowEventHistory(!showEventHistory);
                  }}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>{showEventHistory ? t('hideAllEvents') : `${t('eventHistory')} (${game.recentEvents.length})`}</span>
                </button>
              )}
            </div>

            {/* Main / Latest Event Card */}
            <div>
              {game.lastEvent ? (() => {
                const style = getGameEventStyle(game.lastEvent.type);
                const translatedText = translateGameEvent(game.lastEvent, language);

                return (
                  <div className="p-4 bg-[#080d1a] border border-zinc-800 rounded-2xl shadow-inner space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${style.badgeBg} ${style.badgeBorder} ${style.badgeText} border flex items-center gap-1.5`}>
                        <span>{style.icon}</span>
                        <span>{t('latestEvent')}</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(game.lastEvent.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div className="text-2xl animate-pulse">{style.icon}</div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-black text-white leading-snug">
                          {translatedText}
                        </p>
                      </div>
                      {game.lastEvent.ballNumber && (
                        <div className="shrink-0">
                          <PoolBall number={game.lastEvent.ballNumber} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <p className="text-xs text-zinc-500 italic py-4 font-medium">
                  {t('noEventsYet')}
                </p>
              )}
            </div>

            {/* Collapsible/Expandable Event History Timeline */}
            <AnimatePresence>
              {showEventHistory && game.recentEvents && game.recentEvents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2 max-h-48 overflow-y-auto pr-1"
                >
                  <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                    {t('eventHistory')}
                  </p>
                  {game.recentEvents.map((ev) => {
                    const evStyle = getGameEventStyle(ev.type);
                    const evText = translateGameEvent(ev, language);
                    return (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5 text-xs"
                      >
                        <span className="text-sm shrink-0">{evStyle.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-200 font-bold truncate text-[11px] sm:text-xs">
                            {evText}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono">
                            {new Date(ev.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        {ev.ballNumber && (
                          <div className="shrink-0">
                            <PoolBall number={ev.ballNumber} size="sm" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* Accidental Touch Protection Modal */}
      <ShotConfirmModal
        isOpen={pendingShot !== null}
        data={pendingShot}
        myCards={myCards}
        language={language}
        loading={shooting}
        onConfirm={() => {
          if (pendingShot) {
            const { ballNumber, isScratch, isMiss } = pendingShot;
            setPendingShot(null);
            handleShootBall(ballNumber, isScratch, isMiss);
          }
        }}
        onClose={() => setPendingShot(null)}
      />

      {/* Disband Confirmation Dialog Modal */}
      <AnimatePresence>
        {showDisbandConfirm && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f172a] border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-2xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    {t('disbandTitle')}
                  </h3>
                  <p className="text-xs text-amber-400 font-bold">
                    {language === 'am' ? 'ሙሉ ተመላሽ እና ጨዋታውን ማቆም' : '100% Refund & Cancel Match'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-zinc-300 text-xs space-y-2.5">
                <p className="font-bold text-amber-200 leading-relaxed">
                  {t('disbandPrompt')}
                </p>
                <div className="pt-2 border-t border-amber-800/50 flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-400">{t('entryFee')}:</span>
                  <span className="font-black text-emerald-400">+{game.entryFee} ETB (100% Refund)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDisbandConfirm(false)}
                  className="py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  {language === 'am' ? 'ተመለስ (ይቅር)' : 'Keep Playing'}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDisbandVote(true)}
                  disabled={votingDisband}
                  className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>⚠️</span>
                  <span>
                    {votingDisband
                      ? '...'
                      : language === 'am'
                      ? 'ይፍረስ (ድምጽ ስጥ)'
                      : 'Vote Disband'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
