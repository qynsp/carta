import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardValue } from '../types';
import { getCardLabel, getCardFullName, POOL_BALL_COLORS } from '../utils/cardUtils';

interface CardHandProps {
  cards: CardValue[];
  isMyTurn?: boolean;
  isGameOver?: boolean;
  isWinner?: boolean;
}

export const CardHand: React.FC<CardHandProps> = ({
  cards,
  isMyTurn = false,
  isGameOver = false,
  isWinner = false,
}) => {
  // Count frequency of duplicate cards
  const cardCounts: Record<number, number> = {};
  for (const val of cards) {
    cardCounts[val] = (cardCounts[val] || 0) + 1;
  }

  const suits = ['♠', '♥', '♦', '♣'];

  // Check for duplicate card advice
  const duplicateEntries = Object.entries(cardCounts).filter(([_, count]) => count > 1);

  if (cards.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center">
        {isWinner ? (
          <div className="space-y-3">
            <div className="text-5xl animate-bounce">🏆</div>
            <div className="text-2xl font-black text-emerald-400 uppercase tracking-tight">
              All Cards Cleared!
            </div>
            <p className="text-sm text-zinc-300 max-w-sm mx-auto">
              You won the pool showdown and the prize payout has been credited to your wallet balance!
            </p>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm font-medium">No remaining cards in hand.</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hand Bento Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 font-bold">●</span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
            MY PRIVATE CARDS
          </h3>
          <span className="text-zinc-500 text-xs italic">({cards.length} left)</span>
        </div>

        {isMyTurn && !isGameOver && (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-zinc-950 animate-pulse shadow-sm shadow-emerald-500/40 tracking-wider uppercase">
            YOUR TURN TO SHOOT
          </span>
        )}
      </div>

      {/* Bento Playing Cards Shelf */}
      <div className="flex items-center justify-start sm:justify-center gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar">
        <AnimatePresence>
          {cards.map((cardVal, index) => {
            const label = getCardLabel(cardVal);
            const ballColor = POOL_BALL_COLORS[cardVal];
            const isRed = cardVal % 2 === 0;
            const suit = suits[cardVal % suits.length];
            const count = cardCounts[cardVal];

            return (
              <motion.div
                key={`card-${index}-${cardVal}`}
                initial={{ scale: 0.8, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: -20 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="relative shrink-0 w-24 h-38 sm:w-28 sm:h-44 bg-white rounded-2xl shadow-xl border-2 border-slate-200 flex flex-col justify-between p-3 select-none hover:-translate-y-1.5 transition-transform"
              >
                {/* Top Corner */}
                <div className="flex items-center justify-between leading-none">
                  <span className={`text-xl font-black ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
                    {label}
                  </span>
                  <span className={`text-sm ${isRed ? 'text-red-600' : 'text-zinc-700'}`}>{suit}</span>
                </div>

                {/* Center Giant Suit / Ball rank badge */}
                <div className="flex flex-col items-center justify-center my-auto">
                  <div className={`text-3xl sm:text-4xl ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
                    {suit}
                  </div>
                  <div
                    className="mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-black border border-zinc-200 shadow-sm"
                    style={{ backgroundColor: ballColor.bg, color: ballColor.text }}
                  >
                    Ball {cardVal}
                  </div>
                </div>

                {/* Bottom Corner (Rotated) */}
                <div className="flex items-center justify-between leading-none rotate-180">
                  <span className={`text-xl font-black ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
                    {label}
                  </span>
                  <span className={`text-sm ${isRed ? 'text-red-600' : 'text-zinc-700'}`}>{suit}</span>
                </div>

                {/* Duplicate Badge */}
                {count > 1 && (
                  <div className="absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-xs font-black shadow-md border-2 border-zinc-900">
                    {count}x
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Duplicate Advantage Bento Banner */}
      {duplicateEntries.length > 0 ? (
        <div className="text-center pt-1">
          <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs inline-block px-4 py-2 rounded-full shadow-sm">
            Sink ball{' '}
            <span className="text-emerald-400 font-bold">
              {duplicateEntries.map(([val]) => getCardLabel(Number(val) as CardValue)).join(', ')}
            </span>{' '}
            to remove <span className="text-emerald-400 font-bold underline">all copies</span> at once!
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500 text-center italic">
          Visible only to you • Sinking your card ball removes it from your hand.
        </p>
      )}
    </div>
  );
};
