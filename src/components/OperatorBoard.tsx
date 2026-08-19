import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Volume2, ShieldCheck, ArrowLeft, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { GamePublicState } from '../types';
import { PoolBall } from './PoolBall';
import { soundFx } from '../utils/audio';

interface OperatorBoardProps {
  initialGameId?: string;
  onBack?: () => void;
}

export const OperatorBoard: React.FC<OperatorBoardProps> = ({ initialGameId, onBack }) => {
  const { user, token } = useAuth();
  const { subscribeToGame, unsubscribeFromGame, activeGame } = useSocket();
  const { t, language } = useLanguage();

  const [activeGames, setActiveGames] = useState<GamePublicState[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [shotNotice, setShotNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveGames = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/games?status=ACTIVE');
      if (res.ok) {
        const data = await res.json();
        setActiveGames(data.games || []);
        if (!selectedGameId && data.games?.length > 0) {
          setSelectedGameId(data.games[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load operator active games:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveGames();
  }, []);

  useEffect(() => {
    if (selectedGameId) {
      subscribeToGame(selectedGameId);
    }
    return () => {
      unsubscribeFromGame();
    };
  }, [selectedGameId]);

  const currentGame = activeGame?.id === selectedGameId ? activeGame : activeGames.find((g) => g.id === selectedGameId);

  const handleShot = async (ballNumber?: number, isScratch = false, isMiss = false) => {
    if (!selectedGameId || !token || processing) return;

    setProcessing(true);
    setError(null);
    setShotNotice(null);

    if (isScratch) {
      soundFx.playScratch();
    } else if (isMiss) {
      soundFx.playButtonClick();
    } else {
      soundFx.playBallPocket();
    }

    try {
      const res = await fetch(`/api/operator/games/${selectedGameId}/shot`, {
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
      if (!res.ok) throw new Error(data.error || 'Failed to submit shot event');

      setShotNotice(data.result?.message || (language === 'am' ? 'ምቱ በትክክል ተመዝግቧል' : 'Shot reported successfully'));
      setTimeout(() => setShotNotice(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Shot reporting error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2 rounded-2xl transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>{t('backToLobby')}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-white">
            <div className="bg-emerald-500 p-1.5 rounded-xl text-zinc-950">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <span className="text-sm font-black tracking-wider uppercase">{t('operator')}</span>
          </div>
        )}

        <button
          onClick={fetchActiveGames}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-3.5 py-2 rounded-2xl transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{language === 'am' ? 'አድስ' : 'Refresh Tables'}</span>
        </button>
      </div>

      {/* Bento Row: Table Selector + Current Shooter Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Table Selector Box (col-span-5) */}
        <div className="md:col-span-5 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-3">
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-black">
            {language === 'am' ? 'ጠረጴዛ ይምረጡ' : 'Select Active Table'}
          </p>
          {activeGames.length === 0 ? (
            <div className="text-xs text-zinc-500 py-3 font-medium">
              {language === 'am'
                ? 'በአሁኑ ሰዓት ንቁ ጨዋታ የለም። ከጨዋታዎች ገጽ አዲስ ይጀምሩ!'
                : 'No active matches in progress right now.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {activeGames.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGameId(g.id)}
                  className={`w-full p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                    selectedGameId === g.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div className="font-black text-sm text-white truncate">{g.name}</div>
                  <div className="text-xs text-emerald-400 flex justify-between mt-1 font-bold">
                    <span>{g.tableNumber || 'Table 1'}</span>
                    <span>{g.currentTurnUsername}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Shooter Banner (col-span-7) */}
        <div className="md:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-3">
          {currentGame && currentGame.status === 'ACTIVE' ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest font-black">
                    {language === 'am' ? 'በጠረጴዛው ላይ ያለው ተኳሽ' : 'Current Shooter'}
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 uppercase tracking-tight mt-1">
                    {currentGame.currentTurnUsername || 'Active Player'}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-zinc-950 animate-pulse uppercase">
                  {language === 'am' ? 'እየመታ ነው' : 'SHOOTING'}
                </span>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-400">
                <span>{currentGame.name}</span>
                <span className="font-mono text-emerald-400 font-bold">{t('prizePot')}: {currentGame.winnerPayout} ETB</span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs my-auto">
              {language === 'am'
                ? 'ምቶችን ለመመዝገብ በግራ በኩል ጠረጴዛ ይምረጡ'
                : 'Select an active table on the left to report shots.'}
            </div>
          )}
        </div>
      </div>

      {/* Notifications & Error feedback */}
      {shotNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{shotNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Keypad */}
      {currentGame && currentGame.status === 'ACTIVE' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">●</span>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                {language === 'am' ? 'የገባች ኳስ ምረጥ (1–15)' : 'SUNK BALL KEYPAD (1–15)'}
              </h3>
            </div>
            <span className="text-[11px] text-zinc-400">
              {language === 'am' ? 'ኳሷ ስትገባ ቁጥሯን ይጫኑ' : 'Tap ball when pocketed on table'}
            </span>
          </div>

          {/* Grid of 15 pool balls */}
          <div className="grid grid-cols-5 gap-3 sm:gap-4 justify-items-center py-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((num) => (
              <div key={num} className="flex flex-col items-center space-y-1.5 w-full">
                <PoolBall
                  number={num}
                  size="lg"
                  disabled={processing}
                  onClick={() => handleShot(num, false)}
                />
                <span className="text-[11px] font-black text-zinc-400">
                  {num <= 13 ? (num === 1 ? 'A (1)' : num === 11 ? 'J (11)' : num === 12 ? 'Q (12)' : num === 13 ? 'K (13)' : `Ball ${num}`) : 'Neutral'}
                </span>
              </div>
            ))}
          </div>

          {/* Scratch / Foul Button */}
          <div className="pt-2">
            <button
              onClick={() => handleShot(undefined, true)}
              disabled={processing}
              className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.99] text-white border border-zinc-700 hover:border-amber-500/50 font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="text-xl">⚠️</span>
              <span>
                {language === 'am'
                  ? 'ስክራች / ቅጣት (ነጭ ኳስ ከገባች ወይም ጥፋት)'
                  : 'SCRATCH (CUE BALL POCKET / FOUL)'}
              </span>
            </button>
            <p className="text-[11px] text-zinc-500 text-center mt-2 font-medium">
              {language === 'am'
                ? 'ስክራች ሲከሰት ተኳሹ ተጨማሪ 1 ካርድ ተቀጥቶ ተራው ያልፋል።'
                : 'Scratch penalizes current shooter with 1 secret card and passes the turn.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
