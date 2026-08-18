import React, { useState } from 'react';
import { X, Trophy, Users, Coins, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [name, setName] = useState<string>('Friday Night Match');
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [entryFee, setEntryFee] = useState<number>(50);
  const [tableNumber, setTableNumber] = useState<string>('Table 1');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalPot = entryFee * maxPlayers;
  const platformFee = (totalPot * 5) / 100;
  const estimatedPayout = totalPot - platformFee;

  const userBalance = user?.wallet?.availableBalance || 0;
  const hasEnoughFunds = userBalance >= entryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!hasEnoughFunds && entryFee > 0) {
      setError(`Insufficient wallet balance. You need at least ${entryFee} ETB.`);
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
          name: name.trim() || 'Pool Match',
          maxPlayers,
          entryFee,
          tableNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create game');

      onGameCreated(data.game.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Game creation failed');
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
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">Create Table Match</h3>
              <p className="text-xs text-zinc-400">Card Pool Table Host</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
            <label className="text-xs font-bold text-zinc-300">Match Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Championship"
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Players Count</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={2}>2 Players (1v1)</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
                <option value={5}>5 Players</option>
                <option value={6}>6 Players</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Table Identifier</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Table 1"
                required
                className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
              </input>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Entry Fee (ETB)</label>
            <div className="grid grid-cols-4 gap-2 mb-1.5">
              {[20, 50, 100, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setEntryFee(val)}
                  className={`py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                    entryFee === val
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
              min="0"
              value={entryFee}
              onChange={(e) => setEntryFee(Number(e.target.value))}
              required
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Bento Pot Projection */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Total Pot ({maxPlayers} × {entryFee} ETB)</span>
              <span className="font-mono text-white font-bold">{totalPot} ETB</span>
            </div>
            <div className="flex justify-between text-zinc-500 text-[11px]">
              <span>Platform Fee (5%)</span>
              <span className="font-mono">-{platformFee} ETB</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-bold pt-1.5 border-t border-zinc-800">
              <span className="uppercase tracking-wider text-[10px]">Projected Winner Payout</span>
              <span className="font-mono text-sm font-black">{estimatedPayout} ETB</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] font-black text-xs uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'CREATING MATCH...' : `CREATE & JOIN (${entryFee} ETB)`}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
