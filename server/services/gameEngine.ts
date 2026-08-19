import crypto from 'crypto';
import { memDb, getPool, DBGame, DBGamePlayer, DBPlayerCard, DBGameEvent, toCleanUuid } from '../db';
import { CardValue, GameStatus, GamePublicState, GamePrivateState, GameEventPublic, GamePlayerSummary } from '../../src/types';
import { WalletLedgerService } from './walletLedger';

export type BroadcastCallback = (gameId: string, eventType: string, payload?: any) => void;

let broadcastFn: BroadcastCallback | null = null;

export function registerBroadcastCallback(fn: BroadcastCallback) {
  broadcastFn = fn;
}

export class GameEngineService {
  /**
   * Cryptographically secure card value generator (1 to 13)
   */
  static generateRandomCard(): CardValue {
    // crypto.randomInt(min, max) -> max is exclusive
    return crypto.randomInt(1, 14) as CardValue;
  }

  /**
   * Create a new Game (Host creates open table, players join dynamically)
   */
  static async createGame(
    creatorId: string,
    creatorName: string,
    name: string,
    maxPlayers = 8,
    entryFee = 50,
    tableNumber?: string
  ): Promise<string> {
    if (entryFee < 0) {
      throw new Error('Entry fee cannot be negative');
    }

    const pool = getPool();
    let feePercent = 5.0;

    // Get current platform fee setting
    if (pool) {
      const setRes = await pool.query('SELECT platform_fee_percent FROM platform_settings WHERE id = 1');
      if (setRes.rows.length > 0) feePercent = parseFloat(setRes.rows[0].platform_fee_percent);
    } else {
      feePercent = memDb.platformSettings.platformFeePercent;
    }

    const cleanCreatorId = toCleanUuid(creatorId);
    const gameId = crypto.randomUUID();
    // Initial pot starts with 1 player (the host) and increases as more players join
    const totalPot = entryFee * 1;
    const feeAmount = (totalPot * feePercent) / 100;
    const winnerPayout = totalPot - feeAmount;

    // 1. Deduct entry fee for creator
    if (entryFee > 0) {
      await WalletLedgerService.deductGameEntry(cleanCreatorId, gameId, entryFee, name);
    }

    const now = new Date().toISOString();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO games 
           (id, name, status, max_players, entry_fee, platform_fee_percent, total_pot, winner_payout, created_by, table_number, created_at)
           VALUES ($1, $2, 'WAITING', $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [gameId, name, maxPlayers, entryFee, feePercent, totalPot, winnerPayout, cleanCreatorId, tableNumber || 'Table 1']
        );

        // Add creator as player 0
        await client.query(
          `INSERT INTO game_players (game_id, user_id, turn_order, is_winner, joined_at)
           VALUES ($1, $2, 0, FALSE, NOW())`,
          [gameId, cleanCreatorId]
        );

        // Public event
        await client.query(
          `INSERT INTO game_events (game_id, type, user_id, message, created_at)
           VALUES ($1, 'GAME_CREATED', $2, $3, NOW())`,
          [gameId, cleanCreatorId, `${creatorName} created the open table "${name}" (${entryFee} ETB entry)`]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // In-memory
      const newGame: DBGame = {
        id: gameId,
        name,
        status: 'WAITING',
        maxPlayers,
        entryFee,
        platformFeePercent: feePercent,
        totalPot,
        winnerPayout,
        createdBy: cleanCreatorId,
        currentTurnIndex: 0,
        tableNumber: tableNumber || 'Table 1',
        createdAt: now,
      };
      memDb.games.set(gameId, newGame);

      memDb.gamePlayers.push({
        id: `gp-${crypto.randomUUID()}`,
        gameId,
        userId: cleanCreatorId,
        turnOrder: 0,
        isWinner: false,
        joinedAt: now,
      });

      memDb.gameEvents.push({
        id: `ge-${crypto.randomUUID()}`,
        gameId,
        type: 'GAME_CREATED',
        userId: cleanCreatorId,
        message: `${creatorName} created the open table "${name}" (${entryFee} ETB entry)`,
        createdAt: now,
      });
    }

    if (broadcastFn) broadcastFn(gameId, 'GAME_UPDATED');
    return gameId;
  }

  /**
   * Join an open Game (Dynamically increases player count and pot)
   */
  static async joinGame(userId: string, username: string, gameId: string): Promise<boolean> {
    const pool = getPool();
    const cleanGameId = toCleanUuid(gameId);
    const cleanUserId = toCleanUuid(userId);

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameRes = await client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [cleanGameId]);
        if (gameRes.rows.length === 0) throw new Error('Game not found');
        const game = gameRes.rows[0];

        if (game.status !== 'WAITING') throw new Error('Game is not open for joining');

        const playersRes = await client.query('SELECT * FROM game_players WHERE game_id = $1 ORDER BY turn_order ASC', [cleanGameId]);
        if (playersRes.rows.some((p: any) => p.user_id === cleanUserId)) {
          throw new Error('You have already joined this game');
        }

        if (playersRes.rows.length >= game.max_players) {
          throw new Error('Game is already at maximum capacity (8 players)');
        }

        const entryFee = parseFloat(game.entry_fee);
        const feePercent = parseFloat(game.platform_fee_percent);

        // Deduct entry fee
        if (entryFee > 0) {
          await WalletLedgerService.deductGameEntry(cleanUserId, cleanGameId, entryFee, game.name);
        }

        const turnOrder = playersRes.rows.length;
        const newPlayerCount = playersRes.rows.length + 1;
        const newTotalPot = entryFee * newPlayerCount;
        const newWinnerPayout = newTotalPot - (newTotalPot * feePercent) / 100;

        await client.query(
          `INSERT INTO game_players (game_id, user_id, turn_order, is_winner, joined_at)
           VALUES ($1, $2, $3, FALSE, NOW())`,
          [cleanGameId, cleanUserId, turnOrder]
        );

        // Update pot dynamically
        await client.query(
          `UPDATE games SET total_pot = $1, winner_payout = $2 WHERE id = $3`,
          [newTotalPot, newWinnerPayout, cleanGameId]
        );

        await client.query(
          `INSERT INTO game_events (game_id, type, user_id, message, created_at)
           VALUES ($1, 'PLAYER_JOINED', $2, $3, NOW())`,
          [cleanGameId, cleanUserId, `${username} joined the game (Pot is now ${newWinnerPayout.toFixed(0)} ETB)`]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // In-memory
      const game = memDb.games.get(cleanGameId) || memDb.games.get(gameId);
      if (!game) throw new Error('Game not found');
      if (game.status !== 'WAITING') throw new Error('Game is not open for joining');

      const existingPlayers = memDb.gamePlayers.filter((p) => p.gameId === cleanGameId || p.gameId === gameId);
      if (existingPlayers.some((p) => p.userId === cleanUserId || p.userId === userId)) {
        throw new Error('You have already joined this game');
      }
      if (existingPlayers.length >= game.maxPlayers) {
        throw new Error('Game is already at maximum capacity (8 players)');
      }

      if (game.entryFee > 0) {
        await WalletLedgerService.deductGameEntry(cleanUserId, game.id, game.entryFee, game.name);
      }

      const turnOrder = existingPlayers.length;
      const newPlayerCount = existingPlayers.length + 1;
      const newTotalPot = game.entryFee * newPlayerCount;
      const newWinnerPayout = newTotalPot - (newTotalPot * game.platformFeePercent) / 100;

      game.totalPot = newTotalPot;
      game.winnerPayout = newWinnerPayout;

      const now = new Date().toISOString();

      memDb.gamePlayers.push({
        id: `gp-${crypto.randomUUID()}`,
        gameId: game.id,
        userId: cleanUserId,
        turnOrder,
        isWinner: false,
        joinedAt: now,
      });

      memDb.gameEvents.push({
        id: `ge-${crypto.randomUUID()}`,
        gameId: game.id,
        type: 'PLAYER_JOINED',
        userId: cleanUserId,
        message: `${username} joined the game (Pot is now ${newWinnerPayout.toFixed(0)} ETB)`,
        createdAt: now,
      });
    }

    if (broadcastFn) broadcastFn(cleanGameId, 'GAME_UPDATED');
    return true;
  }

  /**
   * Start an open match (when 2+ players are ready at the table)
   */
  static async startGame(gameId: string, initiatorUserId: string): Promise<boolean> {
    const pool = getPool();
    const cleanGameId = toCleanUuid(gameId);
    const cleanInitiatorId = toCleanUuid(initiatorUserId);
    const now = new Date().toISOString();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameRes = await client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [cleanGameId]);
        if (gameRes.rows.length === 0) throw new Error('Game not found');
        const game = gameRes.rows[0];

        if (game.status !== 'WAITING') throw new Error('Game is already active or finished');

        const playersRes = await client.query('SELECT * FROM game_players WHERE game_id = $1 ORDER BY turn_order ASC', [cleanGameId]);
        const players = playersRes.rows;

        if (players.length < 2) {
          throw new Error('At least 2 players are needed to start the pool match');
        }

        // START GAME & DEAL 5 CARDS TO EACH PLAYER
        await client.query(
          `UPDATE games SET status = 'ACTIVE', started_at = NOW(), current_turn_user_id = $1, current_turn_index = 0 WHERE id = $2`,
          [players[0].user_id, cleanGameId]
        );

        for (const p of players) {
          for (let c = 0; c < 5; c++) {
            const cardValue = this.generateRandomCard();
            await client.query(
              `INSERT INTO player_cards (game_id, user_id, card_value, is_removed, is_scratch_card, added_at)
               VALUES ($1, $2, $3, FALSE, FALSE, NOW())`,
              [cleanGameId, p.user_id, cardValue]
            );
          }
        }

        const firstUserRes = await client.query('SELECT first_name, username FROM users WHERE id = $1', [players[0].user_id]);
        const firstName = firstUserRes.rows[0]?.first_name || firstUserRes.rows[0]?.username || 'Player 1';

        await client.query(
          `INSERT INTO game_events (game_id, type, message, created_at)
           VALUES ($1, 'GAME_STARTED', $2, NOW())`,
          [cleanGameId, `Game started with ${players.length} players! 5 cards dealt to each. ${firstName}'s turn to shoot.`]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // In-memory
      const game = memDb.games.get(cleanGameId) || memDb.games.get(gameId);
      if (!game) throw new Error('Game not found');
      if (game.status !== 'WAITING') throw new Error('Game is already active or finished');

      const players = memDb.gamePlayers.filter((p) => p.gameId === game.id).sort((a, b) => a.turnOrder - b.turnOrder);
      if (players.length < 2) {
        throw new Error('At least 2 players are needed to start the pool match');
      }

      game.status = 'ACTIVE';
      game.startedAt = now;
      game.currentTurnUserId = players[0].userId;
      game.currentTurnIndex = 0;

      // Deal 5 random cards to each player
      for (const p of players) {
        for (let c = 0; c < 5; c++) {
          const cardVal = this.generateRandomCard();
          memDb.playerCards.push({
            id: `pc-${crypto.randomUUID()}`,
            gameId: game.id,
            userId: p.userId,
            cardValue: cardVal,
            isRemoved: false,
            isScratchCard: false,
            addedAt: now,
          });
        }
      }

      const firstUser = memDb.users.get(players[0].userId);
      const firstName = firstUser?.firstName || firstUser?.username || 'Player 1';

      memDb.gameEvents.push({
        id: `ge-${crypto.randomUUID()}`,
        gameId: game.id,
        type: 'GAME_STARTED',
        message: `Game started with ${players.length} players! 5 cards dealt to each. ${firstName}'s turn to shoot.`,
        createdAt: now,
      });
    }

    if (broadcastFn) broadcastFn(cleanGameId, 'GAME_UPDATED');
    return true;
  }

  /**
   * AUTHORITATIVE SHOT PROCESSING (Reported by physical table operator)
   * The server, NOT the operator, determines what happens to the cards and turns.
   */
  static async processShot(
    gameId: string,
    operatorId: string,
    ballNumber?: number, // 1 to 15
    isScratch = false
  ): Promise<{
    outcome: 'MATCH_SUNK' | 'NON_MATCH_SUNK' | 'SCRATCH' | 'GAME_WON';
    winnerId?: string;
    message: string;
  }> {
    const pool = getPool();
    const cleanGameId = toCleanUuid(gameId);

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameRes = await client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [cleanGameId]);
        if (gameRes.rows.length === 0) throw new Error('Game not found');
        const game = gameRes.rows[0];

        if (game.status !== 'ACTIVE') {
          throw new Error('Game is not currently active');
        }

        const currentTurnUserId = game.current_turn_user_id;
        if (!currentTurnUserId) throw new Error('No active turn for this game');

        const currentTurnUserRes = await client.query('SELECT first_name, username FROM users WHERE id = $1', [currentTurnUserId]);
        const playerName = currentTurnUserRes.rows[0]?.first_name || currentTurnUserRes.rows[0]?.username || 'Current player';

        const playersRes = await client.query('SELECT * FROM game_players WHERE game_id = $1 ORDER BY turn_order ASC', [cleanGameId]);
        const players = playersRes.rows;
        const currentTurnIndex = game.current_turn_index;
        const nextTurnIndex = (currentTurnIndex + 1) % players.length;
        const nextTurnUserId = players[nextTurnIndex].user_id;

        const nextTurnUserRes = await client.query('SELECT first_name, username FROM users WHERE id = $1', [nextTurnUserId]);
        const nextPlayerName = nextTurnUserRes.rows[0]?.first_name || nextTurnUserRes.rows[0]?.username || 'Next player';

        let outcome: 'MATCH_SUNK' | 'NON_MATCH_SUNK' | 'SCRATCH' | 'GAME_WON' = 'NON_MATCH_SUNK';
        let message = '';

        if (isScratch) {
          // CASE C: SCRATCH
          // 1. Generate one random card 1-13
          const newCard = this.generateRandomCard();
          // 2. Add to player's private hand
          await client.query(
            `INSERT INTO player_cards (game_id, user_id, card_value, is_removed, is_scratch_card, added_at)
             VALUES ($1, $2, $3, FALSE, TRUE, NOW())`,
            [cleanGameId, currentTurnUserId, newCard]
          );

          // 3. Player loses turn -> advance turn
          await client.query(
            `UPDATE games SET current_turn_user_id = $1, current_turn_index = $2 WHERE id = $3`,
            [nextTurnUserId, nextTurnIndex, cleanGameId]
          );

          // 4. Public event (NEVER reveals what card was added)
          message = `⚠️ ${playerName} scratched. Turn passes to ${nextPlayerName}.`;
          await client.query(
            `INSERT INTO game_events (game_id, type, user_id, message, created_at)
             VALUES ($1, 'SCRATCH', $2, $3, NOW())`,
            [cleanGameId, currentTurnUserId, message]
          );

          outcome = 'SCRATCH';
        } else if (ballNumber !== undefined && ballNumber >= 1 && ballNumber <= 15) {
          // Ball sank (1–15)
          if (ballNumber >= 1 && ballNumber <= 13) {
            // Check if player has this card
            const matchCardsRes = await client.query(
              `SELECT id FROM player_cards WHERE game_id = $1 AND user_id = $2 AND card_value = $3 AND is_removed = FALSE`,
              [cleanGameId, currentTurnUserId, ballNumber]
            );

            if (matchCardsRes.rows.length > 0) {
              // CASE A: Player sank matching ball!
              // 1. Remove ALL copies of this card value
              await client.query(
                `UPDATE player_cards SET is_removed = TRUE, removed_at = NOW() 
                 WHERE game_id = $1 AND user_id = $2 AND card_value = $3 AND is_removed = FALSE`,
                [cleanGameId, currentTurnUserId, ballNumber]
              );

              // Check if player has any remaining unremoved cards
              const remainingRes = await client.query(
                `SELECT COUNT(*) as count FROM player_cards WHERE game_id = $1 AND user_id = $2 AND is_removed = FALSE`,
                [cleanGameId, currentTurnUserId]
              );
              const remainingCount = parseInt(remainingRes.rows[0].count, 10);

              if (remainingCount === 0) {
                // CASE D: EMPTY HAND -> GAME WON!
                outcome = 'GAME_WON';
                await client.query(
                  `UPDATE games SET status = 'COMPLETED', completed_at = NOW(), winner_user_id = $1 WHERE id = $2`,
                  [currentTurnUserId, cleanGameId]
                );

                await client.query(
                  `UPDATE game_players SET is_winner = TRUE WHERE game_id = $1 AND user_id = $2`,
                  [cleanGameId, currentTurnUserId]
                );

                message = `🏆 ${playerName} sank the ${ballNumber}-ball and won the game!`;
                await client.query(
                  `INSERT INTO game_events (game_id, type, user_id, ball_number, message, created_at)
                   VALUES ($1, 'GAME_WON', $2, $3, $4, NOW())`,
                  [cleanGameId, currentTurnUserId, ballNumber, message]
                );

                // Credit Winner Payout
                const payout = parseFloat(game.winner_payout);
                const pot = parseFloat(game.total_pot);
                const fee = pot - payout;
                await WalletLedgerService.creditWinnerPayout(currentTurnUserId, cleanGameId, payout, fee, game.name);
              } else {
                // Keep turn!
                outcome = 'MATCH_SUNK';
                message = `🎱 ${playerName} sank the ${ballNumber}-ball! Turn continues.`;
                await client.query(
                  `INSERT INTO game_events (game_id, type, user_id, ball_number, message, created_at)
                   VALUES ($1, 'BALL_SUNK', $2, $3, $4, NOW())`,
                  [cleanGameId, currentTurnUserId, ballNumber, message]
                );
              }
            } else {
              // CASE B: Player sank ball NOT in their cards
              outcome = 'NON_MATCH_SUNK';
              await client.query(
                `UPDATE games SET current_turn_user_id = $1, current_turn_index = $2 WHERE id = $3`,
                [nextTurnUserId, nextTurnIndex, cleanGameId]
              );

              message = `🎱 ${playerName} sank the ${ballNumber}-ball (no card match). Turn passes to ${nextPlayerName}.`;
              await client.query(
                `INSERT INTO game_events (game_id, type, user_id, ball_number, message, created_at)
                 VALUES ($1, 'BALL_SUNK', $2, $3, $4, NOW())`,
                [cleanGameId, currentTurnUserId, ballNumber, message]
              );
            }
          } else {
            // Ball 14 or 15 (Normal balls, no card match)
            outcome = 'NON_MATCH_SUNK';
            await client.query(
              `UPDATE games SET current_turn_user_id = $1, current_turn_index = $2 WHERE id = $3`,
              [nextTurnUserId, nextTurnIndex, cleanGameId]
            );

            message = `🎱 ${playerName} sank the ${ballNumber}-ball. Turn passes to ${nextPlayerName}.`;
            await client.query(
              `INSERT INTO game_events (game_id, type, user_id, ball_number, message, created_at)
               VALUES ($1, 'BALL_SUNK', $2, $3, $4, NOW())`,
              [cleanGameId, currentTurnUserId, ballNumber, message]
            );
          }
        }

        await client.query('COMMIT');
        if (broadcastFn) broadcastFn(cleanGameId, 'GAME_UPDATED');

        return {
          outcome,
          winnerId: outcome === 'GAME_WON' ? currentTurnUserId : undefined,
          message,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-Memory Implementation
    const game = memDb.games.get(cleanGameId) || memDb.games.get(gameId);
    if (!game) throw new Error('Game not found');
    if (game.status !== 'ACTIVE') throw new Error('Game is not currently active');

    const currentTurnUserId = game.currentTurnUserId;
    if (!currentTurnUserId) throw new Error('No active turn for this game');

    const currentUser = memDb.users.get(currentTurnUserId);
    const playerName = currentUser?.firstName || currentUser?.username || 'Current player';

    const players = memDb.gamePlayers.filter((p) => p.gameId === game.id).sort((a, b) => a.turnOrder - b.turnOrder);
    const currentTurnIndex = game.currentTurnIndex;
    const nextTurnIndex = (currentTurnIndex + 1) % players.length;
    const nextTurnUserId = players[nextTurnIndex].userId;

    const nextUser = memDb.users.get(nextTurnUserId);
    const nextPlayerName = nextUser?.firstName || nextUser?.username || 'Next player';

    let outcome: 'MATCH_SUNK' | 'NON_MATCH_SUNK' | 'SCRATCH' | 'GAME_WON' = 'NON_MATCH_SUNK';
    let message = '';
    const now = new Date().toISOString();

    if (isScratch) {
      // 1. Generate 1 random card
      const newCard = this.generateRandomCard();
      memDb.playerCards.push({
        id: `pc-${crypto.randomUUID()}`,
        gameId: game.id,
        userId: currentTurnUserId,
        cardValue: newCard,
        isRemoved: false,
        isScratchCard: true,
        addedAt: now,
      });

      // 2. Turn passes
      game.currentTurnUserId = nextTurnUserId;
      game.currentTurnIndex = nextTurnIndex;

      // 3. Public event (no card reveal)
      message = `⚠️ ${playerName} scratched. Turn passes to ${nextPlayerName}.`;
      memDb.gameEvents.push({
        id: `ge-${crypto.randomUUID()}`,
        gameId: game.id,
        type: 'SCRATCH',
        userId: currentTurnUserId,
        message,
        createdAt: now,
      });

      outcome = 'SCRATCH';
    } else if (ballNumber !== undefined && ballNumber >= 1 && ballNumber <= 15) {
      if (ballNumber >= 1 && ballNumber <= 13) {
        // Find matching unremoved cards for this player
        const playerUnremoved = memDb.playerCards.filter(
          (c) => c.gameId === game.id && c.userId === currentTurnUserId && !c.isRemoved
        );

        const hasMatch = playerUnremoved.some((c) => c.cardValue === ballNumber);

        if (hasMatch) {
          // Remove ALL copies
          for (const card of playerUnremoved) {
            if (card.cardValue === ballNumber) {
              card.isRemoved = true;
              card.removedAt = now;
            }
          }

          const remainingCards = memDb.playerCards.filter(
            (c) => c.gameId === game.id && c.userId === currentTurnUserId && !c.isRemoved
          );

          if (remainingCards.length === 0) {
            // Player won!
            outcome = 'GAME_WON';
            game.status = 'COMPLETED';
            game.completedAt = now;
            game.winnerUserId = currentTurnUserId;

            const gp = players.find((p) => p.userId === currentTurnUserId);
            if (gp) gp.isWinner = true;

            message = `🏆 ${playerName} sank the ${ballNumber}-ball and won the game!`;
            memDb.gameEvents.push({
              id: `ge-${crypto.randomUUID()}`,
              gameId: game.id,
              type: 'GAME_WON',
              userId: currentTurnUserId,
              ballNumber,
              message,
              createdAt: now,
            });

            // Credit Winner
            const fee = game.totalPot - game.winnerPayout;
            await WalletLedgerService.creditWinnerPayout(currentTurnUserId, game.id, game.winnerPayout, fee, game.name);
          } else {
            // Keep turn
            outcome = 'MATCH_SUNK';
            message = `🎱 ${playerName} sank the ${ballNumber}-ball! Turn continues.`;
            memDb.gameEvents.push({
              id: `ge-${crypto.randomUUID()}`,
              gameId: game.id,
              type: 'BALL_SUNK',
              userId: currentTurnUserId,
              ballNumber,
              message,
              createdAt: now,
            });
          }
        } else {
          // No match, turn passes
          outcome = 'NON_MATCH_SUNK';
          game.currentTurnUserId = nextTurnUserId;
          game.currentTurnIndex = nextTurnIndex;

          message = `🎱 ${playerName} sank the ${ballNumber}-ball (no card match). Turn passes to ${nextPlayerName}.`;
          memDb.gameEvents.push({
            id: `ge-${crypto.randomUUID()}`,
            gameId: game.id,
            type: 'BALL_SUNK',
            userId: currentTurnUserId,
            ballNumber,
            message,
            createdAt: now,
          });
        }
      } else {
        // Ball 14 or 15 (normal pool balls, no card value)
        outcome = 'NON_MATCH_SUNK';
        game.currentTurnUserId = nextTurnUserId;
        game.currentTurnIndex = nextTurnIndex;

        message = `🎱 ${playerName} sank the ${ballNumber}-ball. Turn passes to ${nextPlayerName}.`;
        memDb.gameEvents.push({
          id: `ge-${crypto.randomUUID()}`,
          gameId: game.id,
          type: 'BALL_SUNK',
          userId: currentTurnUserId,
          ballNumber,
          message,
          createdAt: now,
        });
      }
    }

    if (broadcastFn) broadcastFn(cleanGameId, 'GAME_UPDATED');
    return {
      outcome,
      winnerId: outcome === 'GAME_WON' ? currentTurnUserId : undefined,
      message,
    };
  }

  /**
   * Cancel Game & Refund All Players Idempotently
   */
  static async cancelGame(gameId: string, adminOrOperatorId: string, reason: string): Promise<boolean> {
    const pool = getPool();
    const cleanGameId = toCleanUuid(gameId);

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameRes = await client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [cleanGameId]);
        if (gameRes.rows.length === 0) throw new Error('Game not found');
        const game = gameRes.rows[0];

        if (game.status === 'COMPLETED' || game.status === 'CANCELLED') {
          throw new Error(`Game cannot be cancelled (status: ${game.status})`);
        }

        const entryFee = parseFloat(game.entry_fee);
        const playersRes = await client.query('SELECT user_id FROM game_players WHERE game_id = $1', [cleanGameId]);

        // Refund all players
        if (entryFee > 0) {
          for (const p of playersRes.rows) {
            await WalletLedgerService.refundGameEntry(p.user_id, cleanGameId, entryFee, reason);
          }
        }

        await client.query(`UPDATE games SET status = 'CANCELLED', completed_at = NOW() WHERE id = $1`, [cleanGameId]);

        await client.query(
          `INSERT INTO game_events (game_id, type, message, created_at)
           VALUES ($1, 'GAME_CANCELLED', $2, NOW())`,
          [cleanGameId, `Game cancelled: ${reason}. All entry fees refunded.`]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const game = memDb.games.get(cleanGameId) || memDb.games.get(gameId);
      if (!game) throw new Error('Game not found');
      if (game.status === 'COMPLETED' || game.status === 'CANCELLED') {
        throw new Error(`Game cannot be cancelled (status: ${game.status})`);
      }

      const players = memDb.gamePlayers.filter((p) => p.gameId === game.id);
      if (game.entryFee > 0) {
        for (const p of players) {
          await WalletLedgerService.refundGameEntry(p.userId, game.id, game.entryFee, reason);
        }
      }

      game.status = 'CANCELLED';
      game.completedAt = new Date().toISOString();

      memDb.gameEvents.push({
        id: `ge-${crypto.randomUUID()}`,
        gameId: game.id,
        type: 'GAME_CANCELLED',
        message: `Game cancelled: ${reason}. All entry fees refunded.`,
        createdAt: new Date().toISOString(),
      });
    }

    if (broadcastFn) broadcastFn(cleanGameId, 'GAME_UPDATED');
    return true;
  }

  /**
   * Get PUBLIC Game State (Never leaks cards or opponents' remaining card counts)
   */
  static async getPublicGameState(gameId: string): Promise<GamePublicState> {
    const pool = getPool();
    const cleanGameId = toCleanUuid(gameId);

    if (pool) {
      const gameRes = await pool.query('SELECT * FROM games WHERE id = $1', [cleanGameId]);
      if (gameRes.rows.length === 0) throw new Error('Game not found');
      const g = gameRes.rows[0];

      const playersRes = await pool.query(
        `SELECT gp.user_id as "userId", gp.turn_order as "turnOrder", gp.joined_at as "joinedAt", gp.is_winner as "isWinner",
                u.username, u.first_name as "firstName"
         FROM game_players gp
         JOIN users u ON gp.user_id = u.id
         WHERE gp.game_id = $1
         ORDER BY gp.turn_order ASC`,
        [cleanGameId]
      );

      const creatorRes = await pool.query('SELECT first_name, username FROM users WHERE id = $1', [g.created_by]);
      const creatorName = creatorRes.rows[0]?.first_name || creatorRes.rows[0]?.username || 'Unknown';

      let currentTurnUsername: string | undefined;
      if (g.current_turn_user_id) {
        const turnUserRes = await pool.query('SELECT first_name, username FROM users WHERE id = $1', [g.current_turn_user_id]);
        currentTurnUsername = turnUserRes.rows[0]?.first_name || turnUserRes.rows[0]?.username;
      }

      let winnerName: string | undefined;
      if (g.winner_user_id) {
        const winUserRes = await pool.query('SELECT first_name, username FROM users WHERE id = $1', [g.winner_user_id]);
        winnerName = winUserRes.rows[0]?.first_name || winUserRes.rows[0]?.username;
      }

      const lastEventRes = await pool.query(
        `SELECT id, game_id as "gameId", type, user_id as "userId", ball_number as "ballNumber", message, created_at as "createdAt"
         FROM game_events WHERE game_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [cleanGameId]
      );

      return {
        id: g.id,
        name: g.name,
        status: g.status,
        maxPlayers: g.max_players,
        currentPlayersCount: playersRes.rows.length,
        entryFee: parseFloat(g.entry_fee),
        totalPot: parseFloat(g.total_pot),
        platformFeePercent: parseFloat(g.platform_fee_percent),
        winnerPayout: parseFloat(g.winner_payout),
        createdBy: g.created_by,
        creatorName,
        currentTurnUserId: g.current_turn_user_id,
        currentTurnUsername,
        currentTurnNumber: g.current_turn_index + 1,
        winnerUserId: g.winner_user_id,
        winnerName,
        createdAt: g.created_at,
        startedAt: g.started_at,
        completedAt: g.completed_at,
        players: playersRes.rows,
        lastEvent: lastEventRes.rows[0],
        tableNumber: g.table_number,
      };
    }

    // In-memory
    const g = memDb.games.get(cleanGameId) || memDb.games.get(gameId);
    if (!g) throw new Error('Game not found');

    const gpList = memDb.gamePlayers
      .filter((p) => p.gameId === g.id)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    const players: GamePlayerSummary[] = gpList.map((p) => {
      const u = memDb.users.get(p.userId);
      return {
        userId: p.userId,
        username: u?.username || 'user',
        firstName: u?.firstName || 'Player',
        turnOrder: p.turnOrder,
        joinedAt: p.joinedAt,
        isWinner: p.isWinner,
      };
    });

    const creator = memDb.users.get(g.createdBy);
    const currentTurnUser = g.currentTurnUserId ? memDb.users.get(g.currentTurnUserId) : undefined;
    const winnerUser = g.winnerUserId ? memDb.users.get(g.winnerUserId) : undefined;

    const events = memDb.gameEvents
      .filter((e) => e.gameId === g.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const lastEvent = events[0]
      ? {
          id: events[0].id,
          gameId: events[0].gameId,
          type: events[0].type,
          userId: events[0].userId,
          ballNumber: events[0].ballNumber,
          message: events[0].message,
          createdAt: events[0].createdAt,
        }
      : undefined;

    return {
      id: g.id,
      name: g.name,
      status: g.status,
      maxPlayers: g.maxPlayers,
      currentPlayersCount: players.length,
      entryFee: g.entryFee,
      totalPot: g.totalPot,
      platformFeePercent: g.platformFeePercent,
      winnerPayout: g.winnerPayout,
      createdBy: g.createdBy,
      creatorName: creator?.firstName || creator?.username || 'Creator',
      currentTurnUserId: g.currentTurnUserId,
      currentTurnUsername: currentTurnUser?.firstName || currentTurnUser?.username,
      currentTurnNumber: g.currentTurnIndex + 1,
      winnerUserId: g.winnerUserId,
      winnerName: winnerUser?.firstName || winnerUser?.username,
      createdAt: g.createdAt,
      startedAt: g.startedAt,
      completedAt: g.completedAt,
      players,
      lastEvent,
      tableNumber: g.tableNumber,
    };
  }

  /**
   * Get PRIVATE Game State for an authenticated player
   * ONLY reveals calling player's unremoved cards.
   */
  static async getPrivateState(gameId: string, userId: string): Promise<GamePrivateState> {
    const cleanGameId = toCleanUuid(gameId);
    const cleanUserId = toCleanUuid(userId);
    const publicState = await this.getPublicGameState(cleanGameId);
    const pool = getPool();

    if (pool) {
      const cardsRes = await pool.query(
        `SELECT card_value, is_scratch_card FROM player_cards 
         WHERE game_id = $1 AND user_id = $2 AND is_removed = FALSE 
         ORDER BY added_at ASC`,
        [cleanGameId, cleanUserId]
      );

      const allCardsRes = await pool.query(
        `SELECT is_scratch_card FROM player_cards WHERE game_id = $1 AND user_id = $2`,
        [cleanGameId, cleanUserId]
      );

      const scratchesCount = allCardsRes.rows.filter((c: any) => c.is_scratch_card).length;
      const initialCardsCount = allCardsRes.rows.length - scratchesCount;

      return {
        game: publicState,
        myCards: cardsRes.rows.map((r: any) => r.card_value as CardValue),
        myHistory: {
          initialCardsCount,
          scratchesCount,
        },
      };
    }

    // In-memory
    const unremovedCards = memDb.playerCards.filter(
      (c) => (c.gameId === cleanGameId || c.gameId === gameId) && (c.userId === cleanUserId || c.userId === userId) && !c.isRemoved
    );

    const allPlayerCards = memDb.playerCards.filter(
      (c) => (c.gameId === cleanGameId || c.gameId === gameId) && (c.userId === cleanUserId || c.userId === userId)
    );

    const scratchesCount = allPlayerCards.filter((c) => c.isScratchCard).length;
    const initialCardsCount = allPlayerCards.length - scratchesCount;

    return {
      game: publicState,
      myCards: unremovedCards.map((c) => c.cardValue),
      myHistory: {
        initialCardsCount,
        scratchesCount,
      },
    };
  }

  /**
   * List open or recent games
   */
  static async listGames(status?: string, limit = 30): Promise<GamePublicState[]> {
    const pool = getPool();
    if (pool) {
      let query = 'SELECT id FROM games ';
      const params: any[] = [];
      if (status) {
        query += 'WHERE status = $1 ';
        params.push(status);
      }
      query += 'ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const res = await pool.query(query, params);
      const list: GamePublicState[] = [];
      for (const row of res.rows) {
        list.push(await this.getPublicGameState(row.id));
      }
      return list;
    }

    const allGames = Array.from(memDb.games.values())
      .filter((g) => (status ? g.status === status : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const result: GamePublicState[] = [];
    for (const g of allGames) {
      result.push(await this.getPublicGameState(g.id));
    }
    return result;
  }
}
