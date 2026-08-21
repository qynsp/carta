import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  User,
  CardValue,
  GameStatus,
  VerificationStatus,
  EndGameVote,
  TransactionType,
  TransactionStatus,
  DepositStatus,
  WithdrawalStatus,
  PlatformSettings,
  AdminAuditLog,
  GameEventType,
} from '../../src/types';

const { Pool } = pg;

// Check for DATABASE_URL (Neon PostgreSQL)
const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Utility to extract clean, standard UUID (36 chars) if string contains prefix (e.g., game-uuid, u-uuid, dep-uuid)
 */
export function toCleanUuid(id?: string | null): string {
  if (!id) return '';
  const str = String(id).trim();
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = str.match(uuidRegex);
  if (match) {
    return match[0];
  }
  return str;
}

export interface DBUser extends User {
  updatedAt?: string;
}

export interface DBPlayerCard {
  id: string;
  gameId: string;
  userId: string;
  cardValue: CardValue;
  isRemoved: boolean;
  isScratchCard: boolean;
  addedAt: string;
  removedAt?: string;
}

export interface DBGame {
  id: string;
  name: string;
  status: GameStatus;
  maxPlayers: number;
  entryFee: number;
  platformFeePercent: number;
  totalPot: number;
  winnerPayout: number;
  createdBy: string;
  currentTurnUserId?: string;
  currentTurnIndex: number;
  winnerUserId?: string;
  tableNumber?: string;
  verificationStatus?: VerificationStatus;
  payoutStatus?: 'PENDING' | 'PAID' | 'REFUNDED';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DBGamePlayer {
  id: string;
  gameId: string;
  userId: string;
  turnOrder: number;
  isWinner: boolean;
  isReady: boolean;
  votedDisband?: boolean;
  endGameVote?: EndGameVote | null;
  endGameVotedAt?: string;
  joinedAt: string;
}

export interface DBGameEvent {
  id: string;
  gameId: string;
  type: GameEventType;
  userId?: string;
  ballNumber?: number;
  message: string;
  createdAt: string;
}

export interface DBWallet {
  id: string;
  userId: string;
  availableBalance: number;
  lockedBalance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBWalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference: string;
  gameId?: string;
  adminId?: string;
  description: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface DBDeposit {
  id: string;
  userId: string;
  amount: number;
  reference: string;
  paymentMethod: string;
  notes?: string;
  status: DepositStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface DBWithdrawal {
  id: string;
  userId: string;
  amount: number;
  telebirrPhone: string;
  accountName?: string;
  status: WithdrawalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// In-Memory Data Store (Active when DATABASE_URL is not provided)
class MemoryDatabase {
  users: Map<string, DBUser> = new Map();
  wallets: Map<string, DBWallet> = new Map();
  walletTransactions: DBWalletTransaction[] = [];
  games: Map<string, DBGame> = new Map();
  gamePlayers: DBGamePlayer[] = [];
  playerCards: DBPlayerCard[] = [];
  gameEvents: DBGameEvent[] = [];
  deposits: Map<string, DBDeposit> = new Map();
  withdrawals: Map<string, DBWithdrawal> = new Map();
  platformSettings: PlatformSettings = {
    id: 1,
    platformFeePercent: 5.0,
    minDeposit: 10.0,
    maxDeposit: 50000.0,
    minWithdrawal: 50.0,
    maxWithdrawal: 20000.0,
    minGameEntry: 10.0,
    maxGameEntry: 5000.0,
    telebirrReceiverNumber: '0911223344',
    telebirrReceiverName: 'Pool Cards Addis',
    realMoneyEnabled: false,
    maintenanceMode: false,
    currency: 'ETB',
    updatedAt: new Date().toISOString(),
  };
  auditLogs: AdminAuditLog[] = [];

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    // Seed initial users for demo / development
    const defaultUsers = [
      { id: 'u-dawit-101', telegramId: '10001', username: 'dawit_pool', firstName: 'Dawit', role: 'PLAYER' as const, balance: 500 },
      { id: 'u-abel-102', telegramId: '10002', username: 'abel_t', firstName: 'Abel', role: 'PLAYER' as const, balance: 350 },
      { id: 'u-sami-103', telegramId: '10003', username: 'sami_k', firstName: 'Sami', role: 'PLAYER' as const, balance: 600 },
      { id: 'u-yonas-104', telegramId: '10004', username: 'yonas_g', firstName: 'Yonas', role: 'PLAYER' as const, balance: 450 },
      { id: 'u-operator-201', telegramId: '20001', username: 'table_op_1', firstName: 'Table Operator (Main)', role: 'OPERATOR' as const, balance: 0 },
      { id: 'u-admin-999', telegramId: '90001', username: 'admin_root', firstName: 'System Admin', role: 'ADMIN' as const, balance: 10000 },
    ];

    for (const u of defaultUsers) {
      const now = new Date().toISOString();
      const user: DBUser = {
        id: u.id,
        telegramId: u.telegramId,
        username: u.username,
        firstName: u.firstName,
        role: u.role,
        isFrozen: false,
        createdAt: now,
      };
      this.users.set(u.id, user);

      const wallet: DBWallet = {
        id: `w-${u.id}`,
        userId: u.id,
        availableBalance: u.balance,
        lockedBalance: 0,
        currency: 'ETB',
        createdAt: now,
        updatedAt: now,
      };
      this.wallets.set(u.id, wallet);

      if (u.balance > 0) {
        this.walletTransactions.push({
          id: `tx-init-${u.id}`,
          userId: u.id,
          amount: u.balance,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          reference: 'INIT_DEMO_CREDIT',
          description: 'Initial balance for demo and testing',
          createdAt: now,
        });
      }
    }
  }
}

export const memDb = new MemoryDatabase();

let pool: pg.Pool | null = null;

export async function initDatabase() {
  if (DATABASE_URL) {
    try {
      console.log('[DB] Connecting to Neon PostgreSQL...');
      pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
        max: 10,
        idleTimeoutMillis: 30000,
      });

      // Test connection
      const client = await pool.connect();
      console.log('[DB] Connected to PostgreSQL successfully!');

      // Run schema migration
      const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('[DB] PostgreSQL schema initialized/verified.');
      }

      // Explicit incremental migrations for existing tables and settings
      await client.query(`
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS is_ready BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS voted_disband BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS end_game_vote VARCHAR(20);
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS end_game_voted_at TIMESTAMP WITH TIME ZONE;

        ALTER TABLE games ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'PENDING';
        ALTER TABLE games ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'PENDING';

        CREATE TABLE IF NOT EXISTS platform_settings (
          id INT PRIMARY KEY DEFAULT 1,
          platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
          min_deposit NUMERIC(14, 2) NOT NULL DEFAULT 10.00,
          max_deposit NUMERIC(14, 2) NOT NULL DEFAULT 50000.00,
          min_withdrawal NUMERIC(14, 2) NOT NULL DEFAULT 50.00,
          max_withdrawal NUMERIC(14, 2) NOT NULL DEFAULT 20000.00,
          min_game_entry NUMERIC(14, 2) NOT NULL DEFAULT 10.00,
          max_game_entry NUMERIC(14, 2) NOT NULL DEFAULT 5000.00,
          telebirr_receiver_number VARCHAR(32) NOT NULL DEFAULT '0911223344',
          telebirr_receiver_name VARCHAR(128) NOT NULL DEFAULT 'Pool Cards Addis',
          real_money_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS min_deposit NUMERIC(14, 2) NOT NULL DEFAULT 10.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_deposit NUMERIC(14, 2) NOT NULL DEFAULT 50000.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS min_withdrawal NUMERIC(14, 2) NOT NULL DEFAULT 50.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_withdrawal NUMERIC(14, 2) NOT NULL DEFAULT 20000.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS min_game_entry NUMERIC(14, 2) NOT NULL DEFAULT 10.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_game_entry NUMERIC(14, 2) NOT NULL DEFAULT 5000.00;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS telebirr_receiver_number VARCHAR(32) NOT NULL DEFAULT '0911223344';
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS telebirr_receiver_name VARCHAR(128) NOT NULL DEFAULT 'Pool Cards Addis';
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS real_money_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'ETB';
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

        INSERT INTO platform_settings (
          id, platform_fee_percent, min_deposit, max_deposit, min_withdrawal, max_withdrawal,
          min_game_entry, max_game_entry, telebirr_receiver_number, telebirr_receiver_name,
          real_money_enabled, currency, updated_at
        ) VALUES (
          1, 5.00, 10.00, 50000.00, 50.00, 20000.00, 10.00, 5000.00,
          '0911223344', 'Pool Cards Addis', FALSE, 'ETB', NOW()
        ) ON CONFLICT (id) DO NOTHING;
      `);
      console.log('[DB] Platform settings table and columns verified.');
      client.release();
    } catch (err) {
      console.error('[DB] PostgreSQL connection error, falling back to in-memory store:', err);
      pool = null;
    }
  } else {
    console.log('[DB] No DATABASE_URL provided. Running on fast embedded memory store (Neon-ready).');
  }
}

export function getPool(): pg.Pool | null {
  return pool;
}
