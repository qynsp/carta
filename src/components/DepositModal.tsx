import React, { useState } from 'react';
import { X, ArrowDownRight, Copy, Check, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { soundFx } from '../utils/audio';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const [amount, setAmount] = useState<number>(100);
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const TELEBIRR_NUMBER = '0911223344';
  const TELEBIRR_NAME = 'Pool Cards Addis';

  const copyToClipboard = (text: string) => {
    soundFx.playButtonClick();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    soundFx.playButtonClick();

    if (amount <= 0) {
      setError(language === 'am' ? 'እባክዎ ትክክለኛ የብር መጠን ያስገቡ' : 'Please enter a valid deposit amount');
      return;
    }

    if (!reference.trim()) {
      setError(language === 'am' ? 'እባክዎ የቴሌብር SMS ኮድ ያስገቡ' : 'Please enter the Telebirr SMS transaction code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          reference: reference.trim(),
          paymentMethod: 'Telebirr',
          notes: notes.trim(),
        }),
      });

      const contentType = res.headers.get('content-type');
      const data = contentType && contentType.includes('application/json') ? await res.json() : {};
      if (!res.ok) throw new Error(data.error || 'Failed to submit deposit');

      soundFx.playCoinWin();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deposit submission error');
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
                <span>🪙</span>
                <span>{t('addMoney')}</span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                {language === 'am' ? 'በቴሌብር ፈጣን አከፋፈል' : 'Fast & Simple Telebirr'}
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

        {/* 2-Step Visual Instructions for non-tech users */}
        <div className="space-y-2.5">
          {/* STEP 1 */}
          <div className="p-3.5 rounded-2xl bg-[#080d1a] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                {language === 'am' ? 'ደረጃ 1፡ በቴሌብር ይላኩ' : 'STEP 1: Send via Telebirr'}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                TELEBIRR
              </span>
            </div>

            <div className="flex items-center justify-between bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-bold">{language === 'am' ? 'የተቀባይ ስልክ' : 'Recipient Phone'}</p>
                <p className="font-mono font-black text-amber-400 text-sm">{TELEBIRR_NUMBER}</p>
                <p className="text-[10px] text-zinc-400">{TELEBIRR_NAME}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(TELEBIRR_NUMBER)}
                className="px-3.5 py-2 rounded-xl btn-game-gold text-zinc-950 font-black text-xs transition-all flex items-center gap-1 cursor-pointer shadow-md"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (language === 'am' ? 'ተቀድቷል' : 'Copied') : (language === 'am' ? 'ቁጥር ቅዳ' : 'Copy')}</span>
              </button>
            </div>
          </div>

          {/* STEP 2 */}
          <div className="p-3.5 rounded-2xl bg-[#080d1a] border border-zinc-800 space-y-3">
            <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">
              {language === 'am' ? 'ደረጃ 2፡ የላኩትን መረጃ እዚህ ያስገቡ' : 'STEP 2: Submit Details'}
            </span>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
                  {language === 'am' ? 'የላኩት የብር መጠን' : 'Amount Sent (ETB)'}
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
                          ? 'btn-game-green text-zinc-950 border-emerald-400 shadow-md'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {val} ብር
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-emerald-500 font-black"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
                  {language === 'am' ? 'የቴሌብር SMS ኮድ (Transaction Code)' : 'Telebirr SMS Code (Txn ID)'}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TLB87492018"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-emerald-500 uppercase font-black"
                />
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

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
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl btn-game-green font-black text-xs uppercase tracking-wider text-zinc-950 shadow-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowDownRight className="w-4 h-4 stroke-[3]" />
                  <span>{loading ? '...' : language === 'am' ? 'አስገባ' : 'CONFIRM'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
