import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift, Sparkles, Trophy, CheckCircle, Flame } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward: (amount: number, xp: number) => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  isOpen,
  onClose,
  onClaimReward,
}) => {
  const { t, language } = useLanguage();
  const [opened, setOpened] = useState<boolean>(false);
  const [rewardAmount] = useState<number>(() => Math.floor(Math.random() * 30) + 20); // 20 - 50 ETB
  const [rewardXp] = useState<number>(100);

  if (!isOpen) return null;

  const handleOpenChest = () => {
    if (opened) return;
    setOpened(true);
    soundFx.playCoinWin();
    onClaimReward(rewardAmount, rewardXp);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
    >
      <div className="w-full max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-white text-center relative overflow-hidden my-auto">
        {/* Glowing ambient background */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'am' ? 'ዕለታዊ የስጦታ ሳጥን' : 'DAILY LUCKY BOX'}</span>
          </div>
          <h3 className="text-xl font-black text-white">
            {language === 'am' ? 'ነፃ የጨዋታ ሽልማትህን ውሰድ!' : 'Claim Your Free Play Bonus!'}
          </h3>
        </div>

        {/* Interactive Chest / Gift Visual */}
        <div className="py-4 flex justify-center">
          <AnimatePresence mode="wait">
            {!opened ? (
              <motion.div
                key="closed-box"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenChest}
                className="cursor-pointer group flex flex-col items-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 p-1 shadow-xl shadow-amber-500/30 flex items-center justify-center text-5xl border-4 border-yellow-200"
                  >
                    🎁
                  </motion.div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full uppercase shadow animate-pulse">
                    Tap me!
                  </span>
                </div>
                <p className="text-xs text-amber-300 font-black mt-3 group-hover:text-amber-200 transition-colors">
                  {language === 'am' ? 'ሳጥኑን ለመክፈት ይጫኑ' : 'Tap to Open Box!'}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="opened-box"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-3"
              >
                <div className="text-6xl animate-bounce">🪙</div>
                <div className="space-y-1">
                  <div className="text-3xl font-black text-amber-400 font-mono">
                    +{rewardAmount} ETB
                  </div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    <span>+{rewardXp} Player XP</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300">
                  {language === 'am'
                    ? 'ሽልማቱ ወደ ሒሳብህ ገብቷል! አሁኑኑ ተጫወት!'
                    : 'Bonus credited to your wallet! Enjoy your matches!'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Button */}
        <div>
          {!opened ? (
            <button
              type="button"
              onClick={handleOpenChest}
              className="w-full py-3.5 rounded-2xl btn-game-gold font-black text-sm uppercase tracking-wider text-zinc-950 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Gift className="w-4 h-4" />
              <span>{language === 'am' ? 'ሳጥኑን ክፈት' : 'OPEN LUCKY BOX'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl btn-game-green font-black text-sm uppercase tracking-wider text-zinc-950 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{language === 'am' ? 'ጨዋታ ጀምር' : 'PLAY MATCHES NOW'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
