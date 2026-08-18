import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { memDb, getPool, DBUser } from '../db';
import { User, UserRole } from '../../src/types';
import { WalletLedgerService } from './walletLedger';

const JWT_SECRET = process.env.JWT_SECRET || 'pool-cards-jwt-secret-key-prod-change-me';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export interface TokenPayload {
  userId: string;
  telegramId: string;
  role: UserRole;
  username: string;
}

export class AuthService {
  /**
   * Validate Telegram Web App initData using HMAC-SHA256
   */
  static validateTelegramInitData(initData: string, botToken = BOT_TOKEN): { isValid: boolean; user?: any } {
    if (!botToken) {
      console.warn('[AUTH] TELEGRAM_BOT_TOKEN not configured. Checking payload format.');
      // For local development without token, allow parse if valid format
      try {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (userStr) {
          return { isValid: true, user: JSON.parse(userStr) };
        }
      } catch (e) {
        return { isValid: false };
      }
      return { isValid: false };
    }

    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      if (!hash) return { isValid: false };

      urlParams.delete('hash');

      // Sort keys alphabetically
      const keys = Array.from(urlParams.keys()).sort();
      const dataCheckString = keys.map((key) => `${key}=${urlParams.get(key)}`).join('\n');

      // Secret key = HMAC_SHA256('WebAppData', botToken)
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

      // Calculated hash = HMAC_SHA256(secretKey, dataCheckString)
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (calculatedHash === hash) {
        const userStr = urlParams.get('user');
        const user = userStr ? JSON.parse(userStr) : undefined;
        return { isValid: true, user };
      }

      return { isValid: false };
    } catch (err) {
      console.error('[AUTH] Telegram initData validation error:', err);
      return { isValid: false };
    }
  }

  /**
   * Get or create user record from Telegram profile
   */
  static async syncUser(telegramId: string, username: string, firstName: string, lastName?: string): Promise<User> {
    const pool = getPool();
    const now = new Date().toISOString();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const res = await client.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);

        let userRecord: any;
        if (res.rows.length === 0) {
          const newId = crypto.randomUUID();
          const insertRes = await client.query(
            `INSERT INTO users (id, telegram_id, username, first_name, last_name, role, is_frozen, created_at)
             VALUES ($1, $2, $3, $4, $5, 'PLAYER', FALSE, NOW())
             RETURNING *`,
            [newId, telegramId, username || `user_${telegramId}`, firstName || 'Player', lastName || null]
          );
          userRecord = insertRes.rows[0];

          // Initialize wallet
          await client.query(
            `INSERT INTO wallets (user_id, available_balance, locked_balance, currency, created_at)
             VALUES ($1, 0.00, 0.00, 'ETB', NOW())`,
            [newId]
          );
        } else {
          userRecord = res.rows[0];
          // Update names if changed
          await client.query(
            `UPDATE users SET username = $1, first_name = $2, last_name = $3, updated_at = NOW() WHERE id = $4`,
            [username || userRecord.username, firstName || userRecord.first_name, lastName || userRecord.last_name, userRecord.id]
          );
        }

        await client.query('COMMIT');
        const wallet = await WalletLedgerService.getWallet(userRecord.id);

        return {
          id: userRecord.id,
          telegramId: userRecord.telegram_id,
          username: userRecord.username,
          firstName: userRecord.first_name,
          lastName: userRecord.last_name,
          role: userRecord.role as UserRole,
          isFrozen: userRecord.is_frozen,
          createdAt: userRecord.created_at,
          wallet,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory sync
    let user = Array.from(memDb.users.values()).find((u) => u.telegramId === telegramId);
    if (!user) {
      const newId = `u-${crypto.randomUUID()}`;
      user = {
        id: newId,
        telegramId,
        username: username || `user_${telegramId}`,
        firstName: firstName || 'Player',
        lastName,
        role: 'PLAYER',
        isFrozen: false,
        createdAt: now,
      };
      memDb.users.set(newId, user);

      // Create initial wallet with 100 ETB starter demo balance
      const newWallet = {
        id: `w-${newId}`,
        userId: newId,
        availableBalance: 100,
        lockedBalance: 0,
        currency: 'ETB',
        createdAt: now,
        updatedAt: now,
      };
      memDb.wallets.set(newId, newWallet);

      memDb.walletTransactions.push({
        id: `tx-welcome-${newId}`,
        userId: newId,
        amount: 100,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        reference: 'WELCOME_BONUS',
        description: 'Starter test balance for newly registered player',
        createdAt: now,
      });
    }

    const wallet = await WalletLedgerService.getWallet(user.id);
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isFrozen: user.isFrozen,
      createdAt: user.createdAt,
      wallet,
    };
  }

  /**
   * Issue JWT token
   */
  static generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      telegramId: user.telegramId,
      role: user.role,
      username: user.username,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get User by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (res.rows.length === 0) return null;
      const u = res.rows[0];
      const wallet = await WalletLedgerService.getWallet(u.id);
      return {
        id: u.id,
        telegramId: u.telegram_id,
        username: u.username,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role as UserRole,
        isFrozen: u.is_frozen,
        createdAt: u.created_at,
        wallet,
      };
    }

    const u = memDb.users.get(userId);
    if (!u) return null;
    const wallet = await WalletLedgerService.getWallet(u.id);
    return {
      id: u.id,
      telegramId: u.telegramId,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isFrozen: u.isFrozen,
      createdAt: u.createdAt,
      wallet,
    };
  }
}
