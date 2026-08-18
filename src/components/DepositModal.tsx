import React, { useState } from 'react';
import { X, ArrowDownRight, Copy, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [amount, setAmount] = useState<number>(100);
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const TELEBIRR_NUMBER = '0911223344';
  const TELEBIRR_NAME = 'Pool Cards Club Admin';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (amount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    if (!reference.trim()) {
      setError('Please enter the Telebirr transaction reference / SMS code');
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit deposit');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deposit submission error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">Deposit Funds</h3>
              <p className="text-xs text-zinc-400">Telebirr Manual Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer instructions banner */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
          <div className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">
            Step 1: Transfer ETB to Club Telebirr Account
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <div>
              <div className="font-mono text-sm font-bold text-emerald-400">{TELEBIRR_NUMBER}</div>
              <div className="text-[11px] text-zinc-400">{TELEBIRR_NAME}</div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(TELEBIRR_NUMBER)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-zinc-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Deposit Amount (ETB)</label>
            <div className="grid grid-cols-4 gap-2 mb-1.5">
              {[50, 100, 250, 500].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                    amount === val
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {val} ETB
                </button>
              ))}
            </div>
            <input
              type="number"
              min="10"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Telebirr Transaction ID / SMS Reference
            </label>
            <input
              type="text"
              placeholder="e.g. TEL9923847"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Optional Notes / Sender Name</label>
            <input
              type="text"
              placeholder="e.g. Sent from Dawit's phone"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] font-black text-xs uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'SUBMITTING...' : `SUBMIT DEPOSIT REQUEST (${amount} ETB)`}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
