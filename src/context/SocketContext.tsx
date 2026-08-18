import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { GamePublicState, GamePrivateState } from '../types';

interface SocketContextType {
  isConnected: boolean;
  activeGame: GamePublicState | null;
  privateState: GamePrivateState | null;
  subscribeToGame: (gameId: string) => void;
  unsubscribeFromGame: () => void;
  lastEventNotice: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, refreshProfile } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeGame, setActiveGame] = useState<GamePublicState | null>(null);
  const [privateState, setPrivateState] = useState<GamePrivateState | null>(null);
  const [lastEventNotice, setLastEventNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (token) {
          ws.send(JSON.stringify({ type: 'AUTH', token }));
        }
        if (currentGameIdRef.current) {
          ws.send(JSON.stringify({ type: 'SUBSCRIBE_GAME', gameId: currentGameIdRef.current, token }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'GAME_STATE') {
            setActiveGame(msg.game);
            if (msg.game?.lastEvent?.message) {
              setLastEventNotice(msg.game.lastEvent.message);
            }
            // Trigger balance refresh if game finished or changed
            refreshProfile();
          } else if (msg.type === 'PRIVATE_STATE') {
            setPrivateState(msg.privateState);
          }
        } catch (err) {
          console.error('WS Parse Error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  const subscribeToGame = (gameId: string) => {
    currentGameIdRef.current = gameId;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE_GAME', gameId, token }));
    }
  };

  const unsubscribeFromGame = () => {
    currentGameIdRef.current = null;
    setActiveGame(null);
    setPrivateState(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_GAME' }));
    }
  };

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        activeGame,
        privateState,
        subscribeToGame,
        unsubscribeFromGame,
        lastEventNotice,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
