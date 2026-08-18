import React, { useState } from 'react';
import { X, ArrowUpRight, AlertCircle, ArrowLeft, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const availableBalance = user?.wallet?.availableBalance || 0;

  const [amount, setAmount] = useState<number>(Math.min(100, availableBalance || 100));
  const [telebirrPhone, setTelebirrPhone] = useState<string>('09');
  const [accountName, setAccountName] = useState<string>(user?.firstName || user?.username || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    soundFx.playButtonClick();

    if (amount <= 0) {
      setError(language === 'am' ? 'እባክዎ ትክክለኛ የብር መጠን ያስገቡ' : 'Please enter a valid withdrawal amount');
      return;
    }

    if (amount > availableBalance) {
      setError(
        language === 'am'
          ? `የጠየቁት መጠን (${amount} ብር) ካለዎት ቀሪ ሂሳብ (${availableBalance} ብር) ይበልጣል`
          : `Requested amount (${amount} ETB) exceeds your balance (${availableBalance} ETB)`
      );
      return;
    }

    if (telebirrPhone.length < 9) {
      setError(
        language === 'am'
          ? 'እባክዎ ትክክለኛ የቴሌብር ስልክ ቁጥር ያስገቡ'
          : 'Please enter a valid Telebirr phone number'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          telebirrPhone: telebirrPhone.trim(),
          accountName: accountName.trim(),
          paymentMethod: 'Telebirr',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal request failed');

      soundFx.playCoinWin();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Withdrawal error');
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
      <div className="w-full max-w-md bg-[#0f172a] border-2 border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-white max-h-[88vh] overflow-y-auto my-auto relative">
        {/* Header with Back Button */}
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
                <span>💵</span>
                <span>{t('withdraw')}</span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                {language === 'am' ? 'ያሸነፉትን ወደ ቴሌብር ይላኩ' : 'Transfer winnings to Telebirr'}
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

        {/* Balance Card */}
        <div className="p-3.5 rounded-2xl bg-[#080d1a] border border-zinc-800 flex justify-between items-center">
          <span className="text-xs text-zinc-400 font-black uppercase tracking-wider">{t('availableBalance')}</span>
          <span className="font-mono font-black text-amber-400 text-base flex items-center gap-1">
            <span>🪙</span>
            <span>{availableBalance.toLocaleString()} ብር</span>
          </span>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
              {language === 'am' ? 'የሚወጣው የብር መጠን' : 'Withdrawal Amount (ETB)'}
            </label>
            <div className="grid grid-cols-4 gap-2 mb-1">
              {[50, 100, 200, 500].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    soundFx.playButtonClick();
                    setAmount(val);
                  }}
                  className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                    amount === val
                      ? 'btn-game-gold text-zinc-950 border-amber-400 shadow-md'
                      : 'bg-[#080d1a] border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {val} ብር
                </button>
              ))}
            </div>
            <input
              type="number"
              min="10"
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080d1a] border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-amber-500 font-black"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
              {language === 'am' ? 'የቴሌብር ስልክ ቁጥርህ' : 'Your Telebirr Phone Number'}
            </label>
            <input
              type="tel"
              value={telebirrPhone}
              onChange={(e) => setTelebirrPhone(e.target.value)}
              placeholder="09XXXXXXXX"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080d1a] border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-amber-500 font-black"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
              {language === 'am' ? 'የቴሌብር ስም' : 'Telebirr Account Full Name'}
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Abebe Bikila"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080d1a] border border-zinc-800 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
            />
          </div>

          <p className="text-[10px] text-zinc-400 bg-[#080d1a] p-2.5 rounded-xl border border-zinc-800 leading-relaxed font-medium">
            {language === 'am'
              ? 'የክፍያ ጥያቄዎ በአስተዳዳሪው ከተረጋገጠ በኋላ ብሩ በቴሌብር ይላክልዎታል።'
              : 'Withdrawals are reviewed and sent to your Telebirr phone swiftly by our operators.'}
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
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
              disabled={loading || availableBalance < amount}
              className="w-full py-3.5 rounded-2xl btn-game-gold font-black text-xs uppercase tracking-wider text-zinc-950 shadow-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[3]" />
              <span>{loading ? '...' : language === 'am' ? 'ብር አውጣ' : 'SUBMIT'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
