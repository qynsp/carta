import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, Clock, AlertCircle, ArrowLeft, RefreshCw, Play, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { GamePublicState, GamePrivateState } from '../types';
import { CardHand } from './CardHand';
import { PoolBall } from './PoolBall';

interface PublicGameViewProps {
  gameId: string;
  onBack: () => void;
  onOpenOperator?: () => void;
}

export const PublicGameView: React.FC<PublicGameViewProps> = ({
  gameId,
  onBack,
  onOpenOperator,
}) => {
  const { user, token } = useAuth();
  const { subscribeToGame, unsubscribeFromGame, activeGame, privateState } = useSocket();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localGame, setLocalGame] = useState<GamePublicState | null>(null);
  const [localPrivate, setLocalPrivate] = useState<GamePrivateState | null>(null);
  const [joining, setJoining] = useState<boolean>(false);

  // Subscribe to real-time updates for this game
  useEffect(() => {
    subscribeToGame(gameId);
    fetchGameData();

    return () => {
      unsubscribeFromGame();
    };
  }, [gameId]);

  // Sync with WebSocket stream
  useEffect(() => {
    if (activeGame && activeGame.id === gameId) {
      setLocalGame(activeGame);
      setLoading(false);
    }
  }, [activeGame, gameId]);

  useEffect(() => {
    if (privateState && privateState.game.id === gameId) {
      setLocalPrivate(privateState);
    }
  }, [privateState, gameId]);

  const fetchGameData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch public state
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) throw new Error('Failed to load game');
      const data = await res.json();
      setLocalGame(data.game);

      // If authenticated, fetch private state
      if (token) {
        const privRes = await fetch(`/api/games/${gameId}/private-state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (privRes.ok) {
          const privData = await privRes.json();
          setLocalPrivate(privData);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Could not load match details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join game');

      await fetchGameData();
    } catch (err: any) {
      setError(err.message || 'Error joining match');
    } finally {
      setJoining(false);
    }
  };

  const game = localGame || activeGame;
  const isPlayerInGame = game?.players.some((p) => p.userId === user?.id);
  const myCards = localPrivate?.myCards || [];
  const isMyTurn = Boolean(user && game?.currentTurnUserId === user.id);
  const isWinner = Boolean(user && game?.winnerUserId === user.id);
  const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';

  if (loading && !game) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-sm text-zinc-400">Connecting to pool table...</span>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="p-6 rounded-3xl bg-rose-950/40 border border-rose-800 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <div className="text-rose-200 font-semibold">{error}</div>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer"
        >
          Return to Games
        </button>
      </div>
    );
  }

  if (!game) return null;

  return (
    <div className="space-y-4">
      {/* Top Bento Nav Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2 rounded-2xl transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>MATCH LOBBY</span>
        </button>

        <div className="flex items-center gap-2">
          {isOperatorOrAdmin && onOpenOperator && (
            <button
              onClick={onOpenOperator}
              className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>OPERATOR KEYPAD</span>
            </button>
          )}
          <span className="px-3.5 py-1.5 rounded-2xl text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
            {game.tableNumber || 'Table 1'}
          </span>
        </div>
      </div>

      {/* Main Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Bento Section 1: Current Turn & Roster (col-span-5) */}
        <section className="md:col-span-5 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Current Turn</p>
                <h2 className="text-2xl sm:text-3xl font-black text-emerald-400 uppercase tracking-tight">
                  {game.currentTurnUsername || (game.status === 'WAITING' ? 'Waiting Lobby' : 'Completed')}
                </h2>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  game.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : game.status === 'COMPLETED'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}
              >
                {game.status}
              </div>
            </div>

            {/* Players List in Bento Card */}
            <div className="space-y-2.5">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                Table Lineup ({game.players.length}/{game.maxPlayers})
              </p>
              {game.players.map((p, idx) => {
                const isTurn = game.currentTurnUserId === p.userId && game.status === 'ACTIVE';
                const isMe = p.userId === user?.id;

                return (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      isTurn
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'bg-zinc-800/40 border border-zinc-700/40'
                    }`}
                  >
                    <div
                      className={`h-3 w-3 rounded-full shrink-0 ${
                        isTurn ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                      }`}
                    />
                    <div className="flex-1 truncate">
                      <span className={`font-bold text-sm ${isTurn ? 'text-white' : 'text-zinc-300'}`}>
                        {p.firstName || p.username} {isMe ? '(You)' : ''}
                      </span>
                    </div>
                    {p.isWinner && (
                      <span className="text-xs font-black text-amber-400">🏆 WINNER</span>
                    )}
                    {isTurn && (
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                        Shooting
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Join Button for Waiting Match */}
            {game.status === 'WAITING' && !isPlayerInGame && (
              <div className="pt-4">
                <button
                  onClick={handleJoinGame}
                  disabled={joining}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs tracking-wider uppercase shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>JOIN MATCH ({game.entryFee} ETB)</span>
                </button>
              </div>
            )}
          </div>

          {/* Bottom Card Footer: Game ID & Prize Pool */}
          <div className="pt-4 border-t border-zinc-800 flex justify-between items-end">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Match ID</p>
              <p className="font-mono text-xs text-zinc-300 font-bold">#{game.id.slice(0, 8)}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Prize Pool</p>
              <p className="text-xl font-mono font-black text-white">{game.winnerPayout} ETB</p>
            </div>
          </div>
        </section>

        {/* Bento Section 2: My Private Cards Tray (col-span-7) */}
        <section className="md:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
          {isPlayerInGame && game.status === 'ACTIVE' ? (
            <CardHand
              cards={myCards}
              isMyTurn={isMyTurn}
              isGameOver={game.status === 'COMPLETED'}
              isWinner={isWinner}
            />
          ) : game.status === 'COMPLETED' ? (
            <div className="p-8 text-center space-y-3 my-auto">
              <div className="text-5xl animate-bounce">🏆</div>
              <h3 className="text-xl font-black text-amber-400 uppercase">Match Concluded</h3>
              <p className="text-zinc-400 text-xs max-w-sm mx-auto">
                {game.winnerName} won this pool match and collected the {game.winnerPayout} ETB pot!
              </p>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3 my-auto">
              <div className="text-4xl">🎱</div>
              <h3 className="text-base font-bold text-white">Match In Preparation</h3>
              <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                {game.status === 'WAITING'
                  ? `Waiting for players to join (${game.players.length}/${game.maxPlayers}). Cards will be dealt once the table fills.`
                  : 'Cards are active on the physical table.'}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800 flex justify-between items-center text-[11px] text-zinc-500">
            <span>Entry: {game.entryFee} ETB</span>
            <span>Fee: {game.platformFeePercent}%</span>
            <span>Pot: {game.totalPot} ETB</span>
          </div>
        </section>

        {/* Bento Section 3: Live Event Log (col-span-6) */}
        <section className="md:col-span-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-emerald-500 font-bold">●</span>
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">Live Event Feed</p>
          </div>

          <div className="space-y-3">
            {game.lastEvent ? (
              <div className="flex items-center gap-3 p-3 bg-zinc-950/60 border border-zinc-800 rounded-2xl">
                <div className="text-xl">🎱</div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">{game.lastEvent.message}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(game.lastEvent.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                {game.lastEvent.ballNumber && (
                  <PoolBall number={game.lastEvent.ballNumber} size="sm" />
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No events recorded yet on this table.</p>
            )}
          </div>
        </section>

        {/* Bento Section 4: Table Balls Status (col-span-6) */}
        <section className="md:col-span-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">
                Table Balls (1–15)
              </p>
              <span className="text-[10px] text-zinc-500">14 & 15 are neutral</span>
            </div>

            {/* Balls Display Grid */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((ballNum) => {
                const isSunk = game.sunkBalls.includes(ballNum);
                return (
                  <div
                    key={ballNum}
                    className={`transition-opacity ${isSunk ? 'opacity-25 grayscale' : 'opacity-100'}`}
                  >
                    <PoolBall number={ballNum} size="sm" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
            <span className="text-zinc-500">Balls Pocketed: {game.sunkBalls.length}/15</span>
            {isOperatorOrAdmin && onOpenOperator && (
              <button
                onClick={onOpenOperator}
                className="text-emerald-400 hover:underline font-bold text-xs cursor-pointer"
              >
                Open Table Keypad →
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
