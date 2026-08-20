import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, User, Check, ArrowRight, Languages } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface WelcomeNameModalProps {
  isOpen: boolean;
  initialName?: string;
  language: string;
  onSetLanguage: (lang: 'en' | 'am') => void;
  onSubmit: (name: string, username?: string) => Promise<void>;
  onSkip?: () => void;
}

export const WelcomeNameModal: React.FC<WelcomeNameModalProps> = ({
  isOpen,
  initialName = '',
  language,
  onSetLanguage,
  onSubmit,
  onSkip,
}) => {
  const [name, setName] = useState<string>(initialName === 'Player' ? '' : initialName);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialName && initialName !== 'Player') {
      setName(initialName);
    }
  }, [initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(language === 'am' ? 'እባክዎ ስምዎን ያስገቡ' : 'Please enter your name');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      soundFx.playButtonClick();
      await onSubmit(name.trim(), username.trim() || undefined);
      soundFx.playCoinWin();
    } catch (err: any) {
      setError(err.message || 'Failed to save name');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 25 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 25 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-md bg-[#0c1222] border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-white relative overflow-hidden"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Language Switcher Pill */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/30 flex items-center justify-center font-black text-xl text-zinc-950">
                🎱
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Pool Cards Addis
                </h3>
                <p className="text-[10px] text-zinc-400">
                  {language === 'am' ? 'የተጫዋች ምዝገባ' : 'Player Welcome'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playButtonClick();
                onSetLanguage(language === 'en' ? 'am' : 'en');
              }}
              className="px-2.5 py-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'am' ? 'English' : 'አማርኛ'}</span>
            </button>
          </div>

          {/* Welcome Intro Header */}
          <div className="text-center space-y-1.5 pt-1">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black uppercase tracking-wide mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'am' ? 'እንኳን ደህና መጡ!' : 'Welcome to the Game!'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {language === 'am' ? 'የተጫዋች ስምዎን ያስገቡ' : 'What is your Player Name?'}
            </h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              {language === 'am'
                ? 'በጨዋታ ጠረጴዛው ላይ እና በደረጃ ሰንጠረዥ ላይ የሚታይበትን ስም ያስገቡ።'
                : 'This name will appear on the pool table, scoreboard, and leaderboard.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'am' ? 'የእርስዎ ስም (Display Name) *' : 'Your Name (Display Name) *'}</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={language === 'am' ? 'ለምሳሌ፡ ዳዊት ወይም ዮናስ' : 'e.g. Alex or Dawit'}
                className="w-full px-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-700 text-white font-bold text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400">
                {language === 'am' ? 'የተጠቃሚ ስም (@username - አማራጭ)' : 'Player Handle (@username - optional)'}
              </label>
              <input
                type="text"
                maxLength={25}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. dawit_pool"
                className="w-full px-4 py-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 font-mono text-xs focus:border-emerald-400 focus:outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold animate-shake">
                {error}
              </div>
            )}

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-3.5 px-4 rounded-2xl btn-game-green text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-spin text-base">⏳</span>
                ) : (
                  <>
                    <span>{language === 'am' ? 'ጀምር እና ተጫወት' : 'Get Started & Play'}</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>

              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="w-full py-2 text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {language === 'am' ? 'ለጊዜው እለፍ (በኋላ ቀይር)' : 'Skip for now (edit later)'}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
