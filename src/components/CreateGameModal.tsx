import React, { useState } from 'react';
import { X, Trophy, Users, Coins, AlertCircle, ArrowLeft, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameCreated: (gameId: string) => void;
}

export const CreateGameModal: React.FC<CreateGameModalProps> = ({
  isOpen,
  onClose,
  onGameCreated,
}) => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const [name, setName] = useState<string>('Friday Night Match');
  const [entryFee, setEntryFee] = useState<number>(50);
  const [tableNumber, setTableNumber] = useState<string>('Table 1');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const userBalance = user?.wallet?.availableBalance || 0;
  const hasEnoughFunds = userBalance >= entryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    soundFx.playButtonClick();

    if (!hasEnoughFunds && entryFee > 0) {
      setError(
        language === 'am'
          ? `በቂ ሂሳብ የለዎትም። ቢያንስ ${entryFee} ብር ያስፈልጋል።`
          : `Insufficient wallet balance. You need at least ${entryFee} ETB.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim() || (language === 'am' ? 'የፑል ጨዋታ' : 'Pool Match'),
          entryFee,
          tableNumber: tableNumber.trim() || 'Table 1',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create game');

      soundFx.playYourTurn();
      onGameCreated(data.game.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Game creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
    >
      <div className="w-full max-w-md bg-[#0f172a] border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-white max-h-[88vh] overflow-y-auto my-auto relative">
        {/* Header with Clear Back Option */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundFx.playButtonClick();
                onClose();
              }}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
              title={language === 'am' ? 'ተመለስ' : 'Go Back'}
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>{language === 'am' ? 'ተመለስ' : 'Back'}</span>
            </button>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>🎱</span>
                <span>{language === 'am' ? 'አዲስ ጠረጴዛ ክፈት' : 'Host Match Table'}</span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                {language === 'am' ? 'ተጫዋቾች በራሳቸው ይቀላቀላሉ' : 'Players join & pot grows dynamically'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playButtonClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
              {language === 'am' ? 'የጨዋታው ስም' : 'Match Title'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'am' ? 'ምሳሌ፡ የሳምንቱ ውድድር' : 'e.g. Friday Championship'}
              required
              className="w-full px-4 py-3 rounded-2xl bg-[#080d1a] border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
              {language === 'am' ? 'የጠረጴዛ ቁጥር / መለያ' : 'Table Number / Arena'}
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Table 1"
              required
              className="w-full px-4 py-3 rounded-2xl bg-[#080d1a] border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
              {language === 'am' ? 'የአንድ ተጫዋች መግቢያ ክፍያ' : 'Entry Fee Per Player (ETB)'}
            </label>
            <div className="grid grid-cols-4 gap-2 mb-1.5">
              {[20, 50, 100, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    soundFx.playButtonClick();
                    setEntryFee(val);
                  }}
                  className={`py-2.5 rounded-2xl text-xs font-black border-2 transition-all cursor-pointer ${
                    entryFee === val
                      ? 'btn-game-green text-zinc-950 border-emerald-400 shadow-md'
                      : 'bg-[#080d1a] border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {val} ብር
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              value={entryFee}
              onChange={(e) => setEntryFee(Number(e.target.value))}
              required
              className="w-full px-4 py-2.5 rounded-2xl bg-[#080d1a] border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-emerald-500 font-black"
            />
          </div>

          {/* Dynamic Join & Pot Information Banner */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2 font-black text-emerald-400 uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>{language === 'am' ? 'ተጫዋቾች በራሳቸው ቁጥራቸው ይጨምራል' : 'Dynamic Auto-Scaling Pot'}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
              {language === 'am'
                ? 'ሌሎች ተጫዋቾች በተቀላቀሉ ቁጥር የተጫዋቾች ብዛት እና የሽልማት መጠኑ በራስ-ሰር ይጨምራል! 2 ወይም ከዚያ በላይ ተጫዋቾች ሲገቡ ጨዋታውን መጀመር ይችላሉ።'
                : 'Player count and prize pot will increase automatically as players join. You can start the match as soon as 2 or more players join!'}
            </p>
          </div>

          {/* Action Buttons: Cancel / Back + Submit */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playButtonClick();
                onClose();
              }}
              className="w-full py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 font-black text-xs uppercase tracking-wider text-zinc-300 border border-zinc-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
              <span>{language === 'am' ? 'ተመለስ' : 'Cancel'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl btn-game-green font-black text-xs uppercase tracking-wider text-zinc-950 shadow-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? '...' : `✓ ${language === 'am' ? 'ክፈት' : 'OPEN'} (${entryFee} ETB)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
