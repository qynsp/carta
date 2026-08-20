import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardValue } from '../types';
import { getCardLabel, POOL_BALL_COLORS } from '../utils/cardUtils';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';
import { Sparkles, Trophy, Flame, Zap, RefreshCw, Layers } from 'lucide-react';

interface CardHandProps {
  cards: CardValue[];
  isMyTurn?: boolean;
  isGameOver?: boolean;
  isWinner?: boolean;
  onCardClick?: (cardValue: CardValue) => void;
}

export const CardHand: React.FC<CardHandProps> = ({
  cards,
  isMyTurn = false,
  isGameOver = false,
  isWinner = false,
  onCardClick,
}) => {
  const { t, language } = useLanguage();

  // Animation dealing state - default to false so cards are immediately visible if animation is not active
  const [isDealing, setIsDealing] = useState<boolean>(false);
  const [revealedCount, setRevealedCount] = useState<number>(cards.length);
  const [activeDealKey, setActiveDealKey] = useState<number>(0);
  const [lastDrawnIndex, setLastDrawnIndex] = useState<number | null>(null);

  const lastHandSignatureRef = useRef<string>('');
  const prevCardsLengthRef = useRef<number>(cards.length);
  const dealingTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Clear pending dealing timers
  const clearDealingTimers = () => {
    dealingTimersRef.current.forEach((timer) => clearTimeout(timer));
    dealingTimersRef.current = [];
  };

  // Trigger full card deal animation sequence
  const startDealAnimation = (handCards: CardValue[]) => {
    clearDealingTimers();

    if (!handCards || handCards.length === 0) {
      setIsDealing(false);
      setRevealedCount(0);
      return;
    }

    const total = handCards.length;
    setIsDealing(true);
    setRevealedCount(0);
    setLastDrawnIndex(null);

    // Initial shuffle riffle sound
    try {
      soundFx.playDeckShuffle();
    } catch {
      // Audio fallback
    }

    // Staggered reveal for each card (snappy 130ms cadence)
    const cardDelay = 130;
    for (let idx = 0; idx < total; idx++) {
      const currentIdx = idx;
      const timer = setTimeout(() => {
        setRevealedCount((prev) => Math.max(prev, currentIdx + 1));
        try {
          soundFx.playCardDraw(currentIdx);
        } catch {
          // Audio fallback
        }
      }, (currentIdx + 1) * cardDelay);
      dealingTimersRef.current.push(timer);
    }

    // Finalize deal state safely
    const totalDuration = (total + 1) * cardDelay + 100;
    const endTimer = setTimeout(() => {
      setIsDealing(false);
      setRevealedCount(total);
      try {
        soundFx.playCardFlip();
      } catch {
        // Audio fallback
      }
    }, totalDuration);
    dealingTimersRef.current.push(endTimer);
  };

  // Trigger deal animation whenever a new hand of cards is populated or deal key increments
  useEffect(() => {
    if (cards.length > 0) {
      const currentSig = `${activeDealKey}-${cards.slice().sort().join(',')}`;
      if (currentSig !== lastHandSignatureRef.current) {
        lastHandSignatureRef.current = currentSig;
        startDealAnimation(cards);
      }
    } else {
      setIsDealing(false);
      setRevealedCount(0);
    }

    return () => clearDealingTimers();
  }, [cards, activeDealKey]);

  // Safety watchdog: ensure isDealing never gets stuck for more than 1.5 seconds
  useEffect(() => {
    if (isDealing) {
      const watchdog = setTimeout(() => {
        setIsDealing(false);
        setRevealedCount(cards.length);
      }, Math.max(cards.length * 150 + 300, 1200));
      return () => clearTimeout(watchdog);
    }
  }, [isDealing, cards.length]);

  // Detect mid-game card additions (e.g. scratch penalty card)
  useEffect(() => {
    if (cards.length > prevCardsLengthRef.current && prevCardsLengthRef.current > 0 && !isDealing) {
      // New single penalty card drawn
      const newCardIdx = cards.length - 1;
      setLastDrawnIndex(newCardIdx);
      setRevealedCount(cards.length);
      try {
        soundFx.playCardDraw(newCardIdx);
      } catch {
        // Audio fallback
      }

      const t = setTimeout(() => {
        setLastDrawnIndex(null);
      }, 3000);
      dealingTimersRef.current.push(t);
    }
    prevCardsLengthRef.current = cards.length;
  }, [cards.length, isDealing]);

  // Play audio sound when it turns into player's turn or wins
  useEffect(() => {
    if (isWinner) {
      try {
        soundFx.playWinnerFanfare();
      } catch {}
    } else if (isMyTurn && !isGameOver && !isDealing) {
      try {
        soundFx.playYourTurn();
      } catch {}
    }
  }, [isMyTurn, isWinner, isGameOver, isDealing]);

  const handleSkipDeal = () => {
    clearDealingTimers();
    setIsDealing(false);
    setRevealedCount(cards.length);
    try {
      soundFx.playCardFlip();
    } catch {}
  };

  const handleReplayDeal = () => {
    setActiveDealKey((prev) => prev + 1);
  };

  // Count frequency of duplicate cards
  const cardCounts: Record<number, number> = {};
  for (const val of cards) {
    cardCounts[val] = (cardCounts[val] || 0) + 1;
  }

  const suits = ['♠', '♥', '♦', '♣'];
  const duplicateEntries = Object.entries(cardCounts).filter(([_, count]) => count > 1);

  if (cards.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-900/40 via-emerald-950/60 to-zinc-950 border-2 border-emerald-500/50 text-center shadow-2xl relative overflow-hidden">
        {/* Celebration Particles */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        {isWinner ? (
          <div className="space-y-4 relative z-10">
            <motion.div
              animate={{ rotate: [-5, 5, -5], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-7xl"
            >
              🏆
            </motion.div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === 'am' ? 'የጠረጴዛው አሸናፊ!' : 'TABLE CHAMPION!'}</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 uppercase tracking-tight">
                {t('youWon')}
              </div>
            </div>
            <div className="inline-block px-4 py-2 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 font-mono font-black text-amber-400 text-lg">
              +150 XP & MATCH POT EARNED! 🪙
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-sm mx-auto">
              {language === 'am'
                ? 'ሁሉንም ካርዶችህን ጨርሰሃል! የውድድሩ ገንዘብ ወደ ሒሳብህ ገብቷል!'
                : 'All your secret cards are pocketed! The match pot has been credited to your wallet!'}
            </p>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm font-medium">{t('remainingCards')}: 0</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Hand Header with Turn Status and Replay Deal Control */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/30 shrink-0">
            🃏
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{t('secretCards')}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                {cards.length} left
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              {language === 'am' ? 'እነዚህን ኳሶች ጠረጴዛው ላይ አስገባ' : 'Pocket these exact ball numbers to win'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Replay Deal button */}
          {!isDealing && (
            <button
              type="button"
              onClick={handleReplayDeal}
              title={t('replayDeal')}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300 border border-zinc-700/80 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('replayDeal')}</span>
            </button>
          )}

          {isMyTurn && !isGameOver && !isDealing && (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="px-4 py-2 rounded-2xl btn-game-green text-zinc-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Zap className="w-4 h-4 fill-current animate-bounce" />
              <span>{t('yourTurn')}</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Dealing Active Banner & Deck Representation */}
      {isDealing ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 border-2 border-amber-500/50 shadow-xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotateY: [0, 180, 360] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              className="w-9 h-12 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-300 shadow-md flex items-center justify-center text-xs font-black text-zinc-950"
            >
              🎱
            </motion.div>
            <div>
              <p className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-2">
                <span>{t('dealingCards')}</span>
                <span className="font-mono text-xs bg-amber-950 px-2 py-0.5 rounded-lg border border-amber-500/40">
                  {Math.min(revealedCount, cards.length)}/{cards.length}
                </span>
              </p>
              <p className="text-[11px] text-zinc-400">
                {language === 'am' ? 'ካርዶችህ በ3D ተገልጠው እየተሰጡህ ነው...' : 'Cards are being dealt and revealed in 3D...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkipDeal}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/40 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
          >
            {language === 'am' ? 'እለፍ (Skip)' : 'Skip'}
          </button>
        </motion.div>
      ) : lastDrawnIndex !== null ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center justify-center gap-2 shadow-lg animate-pulse"
        >
          <span className="text-xl">⚠️</span>
          <span className="text-xs font-black text-amber-300">{t('penaltyCardDrawn')}</span>
        </motion.div>
      ) : (
        /* Visual Instruction Banner: What ball to hit */
        <div className="p-3.5 bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl flex items-center gap-3 shadow-inner">
          <span className="text-2xl animate-bounce">🎯</span>
          <p className="text-xs text-zinc-200">
            <strong className="text-amber-400 font-black">
              {language === 'am' ? 'ዓላማህ፡' : 'YOUR MISSION:'}
            </strong>{' '}
            {language === 'am'
              ? 'ከታች በካርዶችህ ላይ የሚታዩትን ኳሶች ጠረጴዛው ላይ ምታና አስገባ።'
              : 'Hit the physical pool balls matching your cards into the pockets!'}
          </p>
        </div>
      )}

      {/* Bento Playing Cards Shelf - Animated 3D Card Draw Layout */}
      <div
        className="flex items-center justify-start sm:justify-center gap-3.5 overflow-x-auto pb-4 pt-2 no-scrollbar"
        style={{ perspective: 1200 }}
      >
        <AnimatePresence mode="popLayout">
          {cards.map((cardVal, index) => {
            const isRevealed = !isDealing || index < revealedCount;
            const isJustDrawn = lastDrawnIndex === index;
            const label = getCardLabel(cardVal);
            const ballColor = POOL_BALL_COLORS[cardVal];
            const isRed = cardVal % 2 === 0;
            const suit = suits[cardVal % suits.length];
            const count = cardCounts[cardVal];
            const isStriped = cardVal > 8 && cardVal <= 15;

            return (
              <motion.div
                key={`card-deal-${activeDealKey}-${index}-${cardVal}`}
                initial={{
                  opacity: 0,
                  y: -50,
                  x: -15,
                  scale: 0.8,
                  rotateZ: -8 + (index % 3) * 6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  x: 0,
                  scale: isJustDrawn ? [1, 1.1, 1] : 1,
                  rotateZ: 0,
                }}
                exit={{ scale: 0.4, opacity: 0, y: -30 }}
                whileHover={isRevealed ? { y: -8, scale: 1.05 } : {}}
                transition={{
                  duration: 0.35,
                  delay: isDealing ? index * 0.08 : 0,
                  type: 'spring',
                  stiffness: 280,
                  damping: 22,
                }}
                className={`relative shrink-0 w-28 h-44 sm:w-32 sm:h-48 select-none transition-shadow ${
                  isMyTurn && onCardClick && isRevealed
                    ? 'cursor-pointer active:scale-95'
                    : 'cursor-default'
                }`}
                style={{ transformStyle: 'preserve-3d' }}
                onClick={() => {
                  if (isDealing) {
                    handleSkipDeal();
                  } else if (isMyTurn && onCardClick && !isGameOver && isRevealed) {
                    onCardClick(cardVal);
                  }
                }}
              >
                {/* 3D Card Flipper Inner Body */}
                <motion.div
                  className="w-full h-full relative rounded-2xl"
                  style={{ transformStyle: 'preserve-3d' }}
                  animate={{ rotateY: isRevealed ? 0 : 180 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  {/* FRONT FACE (Pool Ball & Rank Info) */}
                  <div
                    className={`absolute inset-0 w-full h-full rounded-2xl shadow-2xl border-2 flex flex-col justify-between p-3 bg-gradient-to-b from-white to-slate-100 ${
                      isMyTurn && onCardClick
                        ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-emerald-500/20'
                        : isJustDrawn
                        ? 'border-amber-400 ring-4 ring-amber-500/50'
                        : 'border-slate-300'
                    }`}
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    {/* Top Corner Card Indicator */}
                    <div className="flex items-center justify-between leading-none">
                      <div className="flex flex-col items-center">
                        <span className={`text-2xl font-black ${isRed ? 'text-rose-600' : 'text-zinc-950'}`}>
                          {label}
                        </span>
                        <span className={`text-xs ${isRed ? 'text-rose-600' : 'text-zinc-800'}`}>{suit}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md font-mono">
                        #{cardVal}
                      </span>
                    </div>

                    {/* Center Visual 3D Pool Ball Badge */}
                    <div className="flex flex-col items-center justify-center my-auto">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg border-2 relative overflow-hidden transition-transform ${
                          isStriped ? 'border-zinc-300 bg-white' : 'border-zinc-950'
                        }`}
                        style={{
                          backgroundColor: isStriped ? '#f8fafc' : ballColor.bg,
                          boxShadow: 'inset -2px -3px 6px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        {/* Stripe Band for Balls 9-15 */}
                        {isStriped && (
                          <div
                            className="absolute inset-y-2 inset-x-0 w-full"
                            style={{ backgroundColor: ballColor.bg }}
                          />
                        )}

                        {/* Ball Number Center White Dot */}
                        <div className="relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-inner border border-zinc-300">
                          <span className="font-black text-xs sm:text-sm text-zinc-950 leading-none">
                            {cardVal}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 text-[11px] font-black text-zinc-900 uppercase tracking-tight flex items-center gap-1">
                        <span>🎱</span>
                        <span>{language === 'am' ? `ኳስ ${cardVal}` : `Ball ${cardVal}`}</span>
                      </div>
                    </div>

                    {/* Bottom Corner Card Indicator (Inverted) */}
                    <div className="flex items-center justify-between leading-none rotate-180">
                      <div className="flex flex-col items-center">
                        <span className={`text-2xl font-black ${isRed ? 'text-rose-600' : 'text-zinc-950'}`}>
                          {label}
                        </span>
                        <span className={`text-xs ${isRed ? 'text-rose-600' : 'text-zinc-800'}`}>{suit}</span>
                      </div>
                    </div>

                    {/* Duplicate Multiple Card Badge */}
                    {count > 1 && (
                      <div className="absolute -top-2.5 -right-2.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 text-xs font-black shadow-lg border-2 border-zinc-950 flex items-center gap-1 animate-pulse z-20">
                        <span>★</span>
                        <span>{count}X COMBO</span>
                      </div>
                    )}

                    {/* Just Drawn Badge */}
                    {isJustDrawn && (
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-black shadow-md border border-zinc-950 uppercase tracking-wider whitespace-nowrap z-20">
                        +1 NEW
                      </div>
                    )}
                  </div>

                  {/* BACK FACE (Pool Card Back with 🎱 Emblem & Gold Guilloche) */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl border-2 border-amber-500/80 bg-gradient-to-br from-[#0c1e3d] via-[#081226] to-[#122852] p-2.5 flex flex-col items-center justify-between overflow-hidden"
                    style={{
                      transform: 'rotateY(180deg)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    {/* Ornate Gold Border Inset */}
                    <div className="w-full h-full rounded-xl border border-amber-400/40 p-2 flex flex-col items-center justify-between relative">
                      {/* Corner Accents */}
                      <div className="w-full flex justify-between text-[10px] text-amber-400/60 font-black">
                        <span>✦</span>
                        <span>✦</span>
                      </div>

                      {/* Center 8-Ball Golden Shield */}
                      <div className="flex flex-col items-center justify-center my-auto">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 p-0.5 shadow-xl shadow-amber-500/30 flex items-center justify-center">
                          <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center border border-amber-300">
                            <span className="text-xl sm:text-2xl">🎱</span>
                          </div>
                        </div>
                        <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-amber-400/90 font-mono">
                          POOL CARDS
                        </span>
                      </div>

                      {/* Bottom Accents */}
                      <div className="w-full flex justify-between text-[10px] text-amber-400/60 font-black">
                        <span>✦</span>
                        <span>✦</span>
                      </div>

                      {/* Shimmering Sheen Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent rounded-xl pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Duplicate Advantage Banner with visual highlight */}
      {duplicateEntries.length > 0 ? (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
          <p className="text-xs text-amber-300 font-black flex items-center justify-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400 fill-current" />
            <span>{t('duplicateBonus')}</span>
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-400 text-center flex items-center justify-center gap-1">
          <span>🔒</span>
          <span>
            {language === 'am'
              ? 'ይህ ሚስጥር ካርድ ነው ለእርስዎ ብቻ ነው የሚታየው'
              : 'Private cards — visible only to you on your phone.'}
          </span>
        </p>
      )}
    </div>
  );
};
