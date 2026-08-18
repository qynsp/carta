import React from 'react';
import { UserCheck, Sparkles, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DevSimulatorBar: React.FC = () => {
  const { user, devPersonas, switchDevUser, refreshProfile, token } = useAuth();

  const handleAddTestFunds = async () => {
    if (!user || !token) return;
    try {
      const depRes = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 500,
          reference: `DEV_ADD_${Date.now()}`,
          paymentMethod: 'Test Simulation',
          notes: 'Dev 1-click test funds',
        }),
      });
      const data = await depRes.json();
      if (depRes.ok && data.depositId) {
        await fetch(`/api/admin/deposits/${data.depositId}/approve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        refreshProfile();
      }
    } catch (e) {
      console.error('Error adding test funds:', e);
    }
  };

  return (
    <div className="w-full bg-zinc-950/90 border-b border-zinc-800 px-4 py-2 text-xs text-zinc-300 flex flex-wrap items-center justify-between gap-2 z-40 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Simulate Player:</span>
      </div>

      {/* Personas Button Pill Group */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {devPersonas.map((p) => {
          const isSelected = user?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => switchDevUser(p.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500 text-zinc-950 font-black shadow-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              {p.firstName || p.username} ({p.role.slice(0, 3)})
            </button>
          );
        })}
      </div>

      <button
        onClick={handleAddTestFunds}
        className="px-3 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer"
      >
        <PlusCircle className="w-3.5 h-3.5" />
        <span>+500 ETB Test</span>
      </button>
    </div>
  );
};
