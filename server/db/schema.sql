-- =========================================================
-- Telegram Pool Cards Game - PostgreSQL Database Schema
-- Compatible with Neon PostgreSQL and Standard PostgreSQL 14+
-- =========================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id VARCHAR(64) UNIQUE NOT NULL,
    username VARCHAR(64) NOT NULL,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128),
    role VARCHAR(20) NOT NULL DEFAULT 'PLAYER', -- 'PLAYER', 'OPERATOR', 'ADMIN'
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Wallets Table (cached balances with ledger reconciliation)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    locked_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Wallet Transactions Table (Immutable Ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'DEPOSIT', 'GAME_ENTRY', 'GAME_REFUND', 'WIN', 'WITHDRAWAL', 'WITHDRAWAL_REFUND', 'PLATFORM_FEE', 'ADMIN_ADJUSTMENT'
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED', -- 'PENDING', 'COMPLETED', 'FAILED', 'REVERSED'
    reference VARCHAR(128) NOT NULL,
    game_id UUID,
    admin_id UUID REFERENCES users(id),
    description TEXT NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_idempotency ON wallet_transactions(idempotency_key);

-- Games Table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED'
    max_players INT NOT NULL CHECK (max_players >= 2 AND max_players <= 8),
    entry_fee NUMERIC(14, 2) NOT NULL CHECK (entry_fee >= 0),
    platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    total_pot NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    winner_payout NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_by UUID NOT NULL REFERENCES users(id),
    current_turn_user_id UUID REFERENCES users(id),
    current_turn_index INT NOT NULL DEFAULT 0,
    winner_user_id UUID REFERENCES users(id),
    table_number VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);

-- Game Players Table
CREATE TABLE IF NOT EXISTS game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    turn_order INT NOT NULL,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    is_ready BOOLEAN NOT NULL DEFAULT FALSE,
    voted_disband BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, user_id),
    UNIQUE(game_id, turn_order)
);

ALTER TABLE game_players ADD COLUMN IF NOT EXISTS is_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS voted_disband BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);

-- Player Cards Table (Authoritative & STRICTLY Private Server Storage)
CREATE TABLE IF NOT EXISTS player_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_value INT NOT NULL CHECK (card_value >= 1 AND card_value <= 13),
    is_removed BOOLEAN NOT NULL DEFAULT FALSE,
    is_scratch_card BOOLEAN NOT NULL DEFAULT FALSE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    removed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_player_cards_game_user ON player_cards(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_player_cards_unremoved ON player_cards(game_id, user_id, is_removed);

-- Game Events Table (Public Event History, never contains opponent cards)
CREATE TABLE IF NOT EXISTS game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    user_id UUID REFERENCES users(id),
    ball_number INT,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at);

-- Deposits Table (Manual Verification)
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    reference VARCHAR(128) NOT NULL,
    payment_method VARCHAR(64) NOT NULL DEFAULT 'Telebirr',
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- Withdrawals Table (Manual Verification)
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    telebirr_phone VARCHAR(32) NOT NULL,
    account_name VARCHAR(128),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'REJECTED'
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Platform Settings Table
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

-- Ensure columns exist even if table was created in an earlier schema version
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

-- Seed default settings row if missing
INSERT INTO platform_settings (
    id, platform_fee_percent, min_deposit, max_deposit, min_withdrawal, max_withdrawal,
    min_game_entry, max_game_entry, telebirr_receiver_number, telebirr_receiver_name,
    real_money_enabled, currency, updated_at
) VALUES (
    1, 5.00, 10.00, 50000.00, 50.00, 20000.00, 10.00, 5000.00,
    '0911223344', 'Pool Cards Addis', FALSE, 'ETB', NOW()
) ON CONFLICT (id) DO NOTHING;

-- Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128),
    details TEXT NOT NULL,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at);
