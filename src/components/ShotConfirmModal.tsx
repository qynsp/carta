import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PoolBall } from './PoolBall';
import { getCardLabel } from '../utils/cardUtils';
import { ShieldCheck, AlertCircle, Sparkles, X, Check, Zap } from 'lucide-react';

export interface ShotConfirmData {
  ballNumber?: number;
  isScratch?: boolean;
  isMiss?: boolean;
}

interface ShotConfirmModalProps {
  isOpen: boolean;
  data: ShotConfirmData | null;
  myCards: number[];
  language: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ShotConfirmModal: React.FC<ShotConfirmModalProps> = ({
  isOpen,
  data,
  myCards,
  language,
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || !data) return null;

  const { ballNumber, isScratch, isMiss } = data;
  const isNeutral = ballNumber === 14 || ballNumber === 15;
  const isMatch = ballNumber !== undefined && myCards.includes(ballNumber);
  const cardLabel = ballNumber !== undefined ? getCardLabel(ballNumber) : '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[#0f172a] border-2 border-emerald-500/50 rounded-3xl p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
        >
          {/* Top Decorative Glow */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  {language === 'am' ? 'ምቱን ያረጋግጡ' : 'Confirm Action'}
                </h3>
                <p className="text-[10px] text-zinc-400">
                  {language === 'am' ? 'ስህተት እንዳይፈጠር ማረጋገጫ' : 'Accidental Touch Protection'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Central Target Display */}
          <div className="py-2 flex flex-col items-center justify-center text-center space-y-3">
            {isScratch ? (
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto text-4xl shadow-xl shadow-rose-500/20 animate-pulse">
                  ⚠️
                </div>
                <h4 className="text-lg font-black text-rose-400 uppercase tracking-tight">
                  {language === 'am' ? 'ስክራች / ፎል' : 'Scratch / Foul'}
                </h4>
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-200 leading-relaxed max-w-xs mx-auto">
                  {language === 'am'
                    ? '⚠️ ተጨማሪ 1 የቅጣት ካርድ ይሰጥዎታል እንዲሁም ተራው ወደ ቀጣዩ ተጫዋች ያልፋል።'
                    : '⚠️ 1 random penalty card will be added to your hand and the turn will pass.'}
                </div>
              </div>
            ) : isMiss ? (
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-500 text-blue-400 flex items-center justify-center mx-auto text-4xl shadow-xl shadow-blue-500/20">
                  🎯
                </div>
                <h4 className="text-lg font-black text-blue-400 uppercase tracking-tight">
                  {language === 'am' ? 'ምት አምልጧል' : 'Missed Shot'}
                </h4>
                <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-2xl text-xs text-blue-200 leading-relaxed max-w-xs mx-auto">
                  {language === 'am'
                    ? '🎯 ኳስ አልገባም። ተራው ወደ ቀጣዩ ተጫዋች ያልፋል።'
                    : '🎯 No ball pocketed. Turn passes to the next player.'}
                </div>
              </div>
            ) : ballNumber !== undefined ? (
              <div className="space-y-3 w-full">
                <div className="flex items-center justify-center">
                  <div className="p-2 rounded-full bg-zinc-900 border-2 border-zinc-700 shadow-2xl scale-125">
                    <PoolBall number={ballNumber} size="lg" />
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                    <span>
                      {language === 'am' ? `ኳስ #${ballNumber} ገብቷል?` : `Sink Ball #${ballNumber}?`}
                    </span>
                    {cardLabel && (
                      <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-amber-300 text-xs font-mono border border-zinc-700">
                        Card: {cardLabel}
                      </span>
                    )}
                  </h4>
                </div>

                {/* Specific Rule Badges for Ball Types */}
                {isNeutral ? (
                  <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border-2 border-emerald-500/60 rounded-2xl text-left shadow-lg">
                    <div className="flex items-center gap-2 text-emerald-300 font-black text-xs uppercase tracking-wider mb-1">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>{language === 'am' ? '⚪ ገለልተኛ ኳስ (14 & 15)' : '⚪ NEUTRAL BALL (14 & 15)'}</span>
                    </div>
                    <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                      {language === 'am'
                        ? 'ይህች ኳስ ገለልተኛ ናት። ካርድ አይቀነስም ግን ተኳሹ ተራውን ጠብቆ መምታት ይቀጥላል!'
                        : 'Neutral ball: No cards are removed, and YOU KEEP SHOOTING (turn continues)!'}
                    </p>
                  </div>
                ) : isMatch ? (
                  <div className="p-3.5 bg-gradient-to-r from-amber-950/80 to-emerald-950/80 border-2 border-amber-500/60 rounded-2xl text-left shadow-lg">
                    <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider mb-1">
                      <Zap className="w-4 h-4 fill-current text-amber-400" />
                      <span>{language === 'am' ? '🔥 የእርስዎ ሚስጥር ካርድ!' : '🔥 MATCHES YOUR SECRET HAND!'}</span>
                    </div>
                    <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                      {language === 'am'
                        ? 'ይህ ኳስ ከእጅዎ ካርዶች ውስጥ ይወገዳል እና ተራዎን ጠብቀው መምታት ይቀጥላሉ!'
                        : 'This card will be pocketed & discarded from your hand, and you keep your turn!'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-left">
                    <div className="flex items-center gap-1.5 text-zinc-400 font-bold text-xs uppercase tracking-wider mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{language === 'am' ? 'የእርስዎ ካርድ አይደለም' : 'Not in your hand'}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {language === 'am'
                        ? 'ኳሱ ገብቷል ግን በእጅዎ የለም። ተራው ወደ ቀጣዩ ተጫዋች ያልፋል።'
                        : 'Ball is pocketed, but not in your hand. Turn will pass to next player.'}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>{language === 'am' ? 'ተመለስ' : 'Cancel'}</span>
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xl disabled:opacity-50 ${
                isScratch
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : isMiss
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  : isNeutral
                  ? 'btn-game-green text-zinc-950 shadow-emerald-500/30'
                  : 'btn-game-gold text-zinc-950 shadow-amber-500/30'
              }`}
            >
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{language === 'am' ? 'አረጋግጥና መዝግብ' : 'Confirm Shot'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
