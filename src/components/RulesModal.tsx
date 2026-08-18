import React from 'react';
import { X, BookOpen, Trophy, Sparkles, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-[#0f172a] border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-white max-h-[88vh] overflow-y-auto relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-xl">
              📖
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>{t('howToPlay')}</span>
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                {language === 'am' ? 'በቀላሉ ተረድተው ያሸንፉ' : 'Quick visual guide to win'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.playButtonClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Simple Pictorial Steps */}
        <div className="space-y-3">
          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl bg-[#080d1a] border border-zinc-800 flex items-start gap-3">
            <div className="text-3xl bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 shrink-0">
              🃏
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-white">
                {language === 'am' ? '1. 5 ካርዶች ይታዩሃል' : '1. You get 5 Secret Cards'}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {t('rule1')}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl bg-[#080d1a] border border-zinc-800 flex items-start gap-3">
            <div className="text-3xl bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 shrink-0">
              🎱
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-white">
                {language === 'am' ? '2. የካርድህን ኳስ ምታ' : '2. Sink Your Card Ball'}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {t('rule2')}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl bg-[#080d1a] border border-zinc-800 flex items-start gap-3">
            <div className="text-3xl bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 shrink-0">
              ✨
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-white">
                {language === 'am' ? '3. ካርድህ ይጠፋል' : '3. Card Clears & Shoot Again'}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {t('rule3')}
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-3 shadow-lg">
            <div className="text-3xl bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/40 shrink-0 animate-bounce">
              🏆
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-emerald-300">
                {language === 'am' ? '4. ቀድመህ ጨርስና ገንዘቡን አሸንፍ!' : '4. Clear All & Win Cash!'}
              </h4>
              <p className="text-xs text-emerald-100 leading-relaxed font-bold">
                {t('rule4')}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            soundFx.playButtonClick();
            onClose();
          }}
          className="w-full py-4 rounded-2xl btn-game-green text-zinc-950 font-black text-sm uppercase tracking-wider transition-all cursor-pointer shadow-xl"
        >
          {t('ruleGotIt')}
        </button>
      </div>
    </div>
  );
};
