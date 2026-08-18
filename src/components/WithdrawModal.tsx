import React, { useState } from 'react';
import { X, ArrowUpRight, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [amount, setAmount] = useState<number>(100);
  const [telebirrPhone, setTelebirrPhone] = useState<string>('09');
  const [accountName, setAccountName] = useState<string>(user?.firstName || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableBalance = user?.wallet?.availableBalance || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (amount <= 0) {
      setError('Please enter a valid withdrawal amount');
      return;
    }

    if (amount > availableBalance) {
      setError(`Requested amount (${amount} ETB) exceeds your available balance (${availableBalance} ETB)`);
      return;
    }

    if (telebirrPhone.length < 9) {
      setError('Please enter a valid Telebirr phone number');
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit withdrawal request');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Withdrawal submission error');
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
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">Withdraw Payout</h3>
              <p className="text-xs text-zinc-400">Direct to Telebirr Account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">Available for Payout</span>
          <span className="font-mono text-base font-black text-emerald-400">{availableBalance} ETB</span>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Withdrawal Amount (ETB)</label>
            <input
              type="number"
              min="50"
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Recipient Telebirr Phone Number</label>
            <input
              type="tel"
              placeholder="09XXXXXXXX"
              value={telebirrPhone}
              onChange={(e) => setTelebirrPhone(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Account Holder Full Name</label>
            <input
              type="text"
              placeholder="e.g. Dawit G."
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || availableBalance < 50}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] font-black text-xs uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'REQUESTING...' : `REQUEST PAYOUT (${amount} ETB)`}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
