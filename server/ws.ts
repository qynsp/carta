import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { registerBroadcastCallback, GameEngineService } from './services/gameEngine';
import { AuthService } from './services/auth';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  gameId?: string;
  isAlive: boolean;
}

const clients = new Set<ClientConnection>();

export function setupWebSocket(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Heartbeat ping interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const client = Array.from(clients).find((c) => c.ws === ws);
      if (!client) return;
      if (!client.isAlive) return ws.terminate();
      client.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', (ws: WebSocket) => {
    const client: ClientConnection = {
      ws,
      isAlive: true,
    };
    clients.add(client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'AUTH') {
          if (msg.token) {
            const payload = AuthService.verifyToken(msg.token);
            if (payload) {
              client.userId = payload.userId;
            }
          }
        } else if (msg.type === 'SUBSCRIBE_GAME') {
          client.gameId = msg.gameId;
          if (msg.token) {
            const payload = AuthService.verifyToken(msg.token);
            if (payload) client.userId = payload.userId;
          }

          // Send current state immediately
          try {
            const publicState = await GameEngineService.getPublicGameState(msg.gameId);
            ws.send(
              JSON.stringify({
                type: 'GAME_STATE',
                game: publicState,
              })
            );

            if (client.userId) {
              const privateState = await GameEngineService.getPrivateState(msg.gameId, client.userId);
              ws.send(
                JSON.stringify({
                  type: 'PRIVATE_STATE',
                  privateState,
                })
              );
            }
          } catch (e) {
            // Game might not exist yet
          }
        } else if (msg.type === 'UNSUBSCRIBE_GAME') {
          client.gameId = undefined;
        }
      } catch (err) {
        console.error('[WS] Message handling error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(client);
    });
  });

  // Register GameEngine broadcast hook
  registerBroadcastCallback(async (gameId: string, eventType: string, payload?: any) => {
    try {
      const publicState = await GameEngineService.getPublicGameState(gameId);

      // Broadcast to all subscribed clients
      for (const client of clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Lobby or matching game room
          if (!client.gameId || client.gameId === gameId) {
            client.ws.send(
              JSON.stringify({
                type: 'GAME_STATE',
                game: publicState,
                event: eventType,
                payload,
              })
            );
          }

          // Send user's own updated private cards if in this game
          if (client.gameId === gameId && client.userId) {
            try {
              const privateState = await GameEngineService.getPrivateState(gameId, client.userId);
              client.ws.send(
                JSON.stringify({
                  type: 'PRIVATE_STATE',
                  privateState,
                })
              );
            } catch (e) {
              // Ignore if user not part of game
            }
          }
        }
      }
    } catch (err) {
      console.error('[WS] Broadcast error:', err);
    }
  });

  console.log('[WS] WebSocket server initialized on path /ws');
}
