import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardValue } from '../types';
import { getCardLabel, POOL_BALL_COLORS } from '../utils/cardUtils';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';
import { Sparkles, Trophy, Flame, Zap } from 'lucide-react';

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

  // Play audio sound when it turns into player's turn or wins
  useEffect(() => {
    if (isWinner) {
      soundFx.playWinnerFanfare();
    } else if (isMyTurn && !isGameOver) {
      soundFx.playYourTurn();
    }
  }, [isMyTurn, isWinner, isGameOver]);

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
    <div className="space-y-4">
      {/* Hand Header with Ultra-Clear Big Turn Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/30">
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

        {isMyTurn && !isGameOver && (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="px-4 py-2 rounded-2xl btn-game-green text-zinc-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2"
          >
            <Zap className="w-4 h-4 fill-current animate-bounce" />
            <span>{t('yourTurn')}</span>
          </motion.div>
        )}
      </div>

      {/* Visual Instruction Banner: What ball to hit */}
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

      {/* Bento Playing Cards Shelf - Extra Large, High Contrast & Picture Rich */}
      <div className="flex items-center justify-start sm:justify-center gap-3.5 overflow-x-auto pb-4 pt-1 no-scrollbar">
        <AnimatePresence>
          {cards.map((cardVal, index) => {
            const label = getCardLabel(cardVal);
            const ballColor = POOL_BALL_COLORS[cardVal];
            const isRed = cardVal % 2 === 0;
            const suit = suits[cardVal % suits.length];
            const count = cardCounts[cardVal];
            const isStriped = cardVal > 8 && cardVal <= 15;

            return (
              <motion.div
                key={`card-${index}-${cardVal}`}
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: -20 }}
                whileHover={{ y: -8, scale: 1.04 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className={`relative shrink-0 w-28 h-44 sm:w-32 sm:h-48 bg-gradient-to-b from-white to-slate-100 rounded-2xl shadow-2xl border-2 flex flex-col justify-between p-3 select-none transition-all ${
                  isMyTurn && onCardClick
                    ? 'border-emerald-400 ring-4 ring-emerald-500/40 cursor-pointer active:scale-95 hover:shadow-emerald-500/20'
                    : 'border-slate-300 cursor-default'
                }`}
                onClick={() => {
                  if (isMyTurn && onCardClick && !isGameOver) {
                    onCardClick(cardVal);
                  }
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
                  <div className="absolute -top-2.5 -right-2.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 text-xs font-black shadow-lg border-2 border-zinc-950 flex items-center gap-1 animate-pulse">
                    <span>★</span>
                    <span>{count}X COMBO</span>
                  </div>
                )}
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
