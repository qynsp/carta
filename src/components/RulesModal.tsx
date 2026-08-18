import React from 'react';
import { X, BookOpen, CheckCircle, AlertTriangle, Trophy } from 'lucide-react';
import { PoolBall } from './PoolBall';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">Pool Cards Official Rules</h3>
              <p className="text-xs text-zinc-400">Card-To-Ball Mapping & Mechanics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-zinc-300">
          {/* Section 1 */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>🃏</span>
              <span>1. Secret Dealing (5 Cards)</span>
            </div>
            <p className="text-zinc-400">
              Every player starts with <strong>5 secret cards</strong>. Cards are only visible on your own device.
              Card values correspond to pool balls 1 to 13:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">A = Ball 1</span>
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">2–10 = Balls 2–10</span>
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">J = Ball 11</span>
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">Q = Ball 12</span>
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">K = Ball 13</span>
            </div>
          </div>

          {/* Section 2 */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>✨</span>
              <span>2. Duplicate Cards Advantage</span>
            </div>
            <p className="text-zinc-400">
              You may receive duplicate cards (e.g. two 4s or two Queens). If you or another player sinks that ball on the table,
              <strong> ALL duplicate copies of that card in your hand are removed at once</strong>!
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>🎱</span>
              <span>3. Shooting & Turns</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>
                <strong>Sinking a matching card ball:</strong> Card(s) removed, and you <strong>keep your turn</strong>!
              </li>
              <li>
                <strong>Sinking another ball / neutral 14 or 15:</strong> Sunk ball recorded, turn passes to next physical shooter.
              </li>
              <li>
                <strong>Scratch penalty (Cue ball sunk or foul):</strong> Adds <strong>1 secret penalty card</strong> to shooter's hand and passes the turn.
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>🏆</span>
              <span>4. Winning the Match</span>
            </div>
            <p className="text-zinc-400">
              The first player to have <strong>all cards cleared from their hand</strong> wins the entire match immediately!
              The total pot (minus 5% platform hosting fee) is credited directly to the winner's wallet.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-zinc-700"
        >
          Got It, Back to Game
        </button>
      </div>
    </div>
  );
};
