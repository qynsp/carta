import crypto from 'crypto';
import { memDb, getPool, DBWalletTransaction } from '../db';
import { TransactionType, TransactionStatus, DepositStatus, WithdrawalStatus } from '../../src/types';

export class WalletLedgerService {
  /**
   * Get user wallet with available and locked balance
   */
  static async getWallet(userId: string) {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(
        'SELECT id, user_id as "userId", available_balance as "availableBalance", locked_balance as "lockedBalance", currency FROM wallets WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        return {
          id: res.rows[0].id,
          userId: res.rows[0].userId,
          availableBalance: parseFloat(res.rows[0].availableBalance),
          lockedBalance: parseFloat(res.rows[0].lockedBalance),
          currency: res.rows[0].currency,
        };
      }
    }

    // In-memory fallback
    let wallet = memDb.wallets.get(userId);
    if (!wallet) {
      wallet = {
        id: `w-${userId}`,
        userId,
        availableBalance: 0,
        lockedBalance: 0,
        currency: 'ETB',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memDb.wallets.set(userId, wallet);
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
      currency: wallet.currency,
    };
  }

  /**
   * Internal helper to update in-memory wallet directly
   */
  private static updateMemWallet(userId: string, updateFn: (w: { availableBalance: number; lockedBalance: number; updatedAt: string }) => void) {
    let wallet = memDb.wallets.get(userId);
    if (!wallet) {
      wallet = {
        id: `w-${userId}`,
        userId,
        availableBalance: 0,
        lockedBalance: 0,
        currency: 'ETB',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memDb.wallets.set(userId, wallet);
    }
    updateFn(wallet);
    wallet.updatedAt = new Date().toISOString();
  }

  /**
   * Get transaction history for user
   */
  static async getTransactions(userId: string, limit = 50) {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(
        'SELECT id, user_id as "userId", amount, type, status, reference, game_id as "gameId", admin_id as "adminId", description, created_at as "createdAt" FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return res.rows.map((row) => ({
        ...row,
        amount: parseFloat(row.amount),
      }));
    }

    return memDb.walletTransactions
      .filter((tx) => tx.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Atomic deduction for Game Entry with idempotent ledger record
   */
  static async deductGameEntry(userId: string, gameId: string, amount: number, gameName: string) {
    const pool = getPool();
    const idempotencyKey = `game-entry-${gameId}-${userId}`;

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if already processed (Idempotent)
        const checkTx = await client.query('SELECT id FROM wallet_transactions WHERE idempotency_key = $1', [idempotencyKey]);
        if (checkTx.rows.length > 0) {
          await client.query('COMMIT');
          return true;
        }

        // Lock wallet row FOR UPDATE
        const walletRes = await client.query(
          'SELECT available_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (walletRes.rows.length === 0) {
          throw new Error('Wallet not found');
        }

        const currentBalance = parseFloat(walletRes.rows[0].available_balance);
        if (currentBalance < amount) {
          throw new Error(`Insufficient balance: Available ${currentBalance} ETB, required ${amount} ETB`);
        }

        // Deduct
        await client.query(
          'UPDATE wallets SET available_balance = available_balance - $1, updated_at = NOW() WHERE user_id = $2',
          [amount, userId]
        );

        // Record immutable ledger entry
        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, game_id, description, idempotency_key)
           VALUES ($1, $2, 'GAME_ENTRY', 'COMPLETED', $3, $4, $5, $6)`,
          [userId, -amount, `GAME_${gameId.slice(0, 8)}`, gameId, `Entry fee for game "${gameName}"`, idempotencyKey]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Memory Store Implementation
    const existing = memDb.walletTransactions.find((tx) => tx.idempotencyKey === idempotencyKey);
    if (existing) return true;

    const wallet = await this.getWallet(userId);
    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient balance: Available ${wallet.availableBalance} ETB, required ${amount} ETB`);
    }

    this.updateMemWallet(userId, (w) => {
      w.availableBalance -= amount;
    });

    const now = new Date().toISOString();
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId,
      amount: -amount,
      type: 'GAME_ENTRY',
      status: 'COMPLETED',
      reference: `GAME_${gameId.slice(0, 8)}`,
      gameId,
      description: `Entry fee for game "${gameName}"`,
      idempotencyKey,
      createdAt: now,
    });

    return true;
  }

  /**
   * Refund Game Entry if game is cancelled
   */
  static async refundGameEntry(userId: string, gameId: string, amount: number, reason: string) {
    const idempotencyKey = `game-refund-${gameId}-${userId}`;
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const checkTx = await client.query('SELECT id FROM wallet_transactions WHERE idempotency_key = $1', [idempotencyKey]);
        if (checkTx.rows.length > 0) {
          await client.query('COMMIT');
          return true;
        }

        await client.query(
          'UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE user_id = $2',
          [amount, userId]
        );

        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, game_id, description, idempotency_key)
           VALUES ($1, $2, 'GAME_REFUND', 'COMPLETED', $3, $4, $5, $6)`,
          [userId, amount, `REFUND_${gameId.slice(0, 8)}`, gameId, `Refund for cancelled game: ${reason}`, idempotencyKey]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const existing = memDb.walletTransactions.find((tx) => tx.idempotencyKey === idempotencyKey);
    if (existing) return true;

    this.updateMemWallet(userId, (w) => {
      w.availableBalance += amount;
    });

    const now = new Date().toISOString();
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId,
      amount,
      type: 'GAME_REFUND',
      status: 'COMPLETED',
      reference: `REFUND_${gameId.slice(0, 8)}`,
      gameId,
      description: `Refund for cancelled game: ${reason}`,
      idempotencyKey,
      createdAt: now,
    });
    return true;
  }

  /**
   * Credit Winnings to Winner & Record Platform Fee
   */
  static async creditWinnerPayout(winnerId: string, gameId: string, payoutAmount: number, platformFeeAmount: number, gameName: string) {
    const idempotencyKey = `game-win-${gameId}-${winnerId}`;
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const checkTx = await client.query('SELECT id FROM wallet_transactions WHERE idempotency_key = $1', [idempotencyKey]);
        if (checkTx.rows.length > 0) {
          await client.query('COMMIT');
          return true;
        }

        // Credit Winner
        await client.query(
          'UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE user_id = $2',
          [payoutAmount, winnerId]
        );

        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, game_id, description, idempotency_key)
           VALUES ($1, $2, 'WIN', 'COMPLETED', $3, $4, $5, $6)`,
          [winnerId, payoutAmount, `WIN_${gameId.slice(0, 8)}`, gameId, `Winner payout for game "${gameName}"`, idempotencyKey]
        );

        // Platform fee record
        if (platformFeeAmount > 0) {
          await client.query(
            `INSERT INTO wallet_transactions 
             (user_id, amount, type, status, reference, game_id, description, idempotency_key)
             VALUES ($1, $2, 'PLATFORM_FEE', 'COMPLETED', $3, $4, $5, $6)`,
            [winnerId, platformFeeAmount, `FEE_${gameId.slice(0, 8)}`, gameId, `Platform fee collected for game "${gameName}"`, `fee-${gameId}`]
          );
        }

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const existing = memDb.walletTransactions.find((tx) => tx.idempotencyKey === idempotencyKey);
    if (existing) return true;

    this.updateMemWallet(winnerId, (w) => {
      w.availableBalance += payoutAmount;
    });

    const now = new Date().toISOString();
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId: winnerId,
      amount: payoutAmount,
      type: 'WIN',
      status: 'COMPLETED',
      reference: `WIN_${gameId.slice(0, 8)}`,
      gameId,
      description: `Winner payout for game "${gameName}"`,
      idempotencyKey,
      createdAt: now,
    });

    if (platformFeeAmount > 0) {
      memDb.walletTransactions.push({
        id: `tx-${crypto.randomUUID()}`,
        userId: winnerId,
        amount: platformFeeAmount,
        type: 'PLATFORM_FEE',
        status: 'COMPLETED',
        reference: `FEE_${gameId.slice(0, 8)}`,
        gameId,
        description: `Platform fee collected for game "${gameName}"`,
        idempotencyKey: `fee-${gameId}`,
        createdAt: now,
      });
    }

    return true;
  }

  /**
   * Create a manual deposit request (PENDING_DEPOSIT)
   */
  static async requestDeposit(userId: string, username: string, amount: number, reference: string, paymentMethod = 'Telebirr', notes?: string) {
    if (amount <= 0) throw new Error('Deposit amount must be positive');

    const depositId = `dep-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const pool = getPool();
    if (pool) {
      await pool.query(
        `INSERT INTO deposits (id, user_id, amount, reference, payment_method, notes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())`,
        [depositId, userId, amount, reference, paymentMethod, notes || null]
      );
    } else {
      memDb.deposits.set(depositId, {
        id: depositId,
        userId,
        amount,
        reference,
        paymentMethod,
        notes,
        status: 'PENDING',
        createdAt: now,
      });
    }

    return depositId;
  }

  /**
   * Admin approves manual deposit -> Credits user wallet & creates immutable ledger record
   */
  static async approveDeposit(depositId: string, adminId: string) {
    const idempotencyKey = `approve-dep-${depositId}`;
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const depRes = await client.query('SELECT * FROM deposits WHERE id = $1 FOR UPDATE', [depositId]);
        if (depRes.rows.length === 0) throw new Error('Deposit not found');
        const dep = depRes.rows[0];

        if (dep.status !== 'PENDING') {
          throw new Error(`Deposit has already been ${dep.status.toLowerCase()}`);
        }

        const amount = parseFloat(dep.amount);

        // Mark deposit APPROVED
        await client.query(
          'UPDATE deposits SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
          ['APPROVED', adminId, depositId]
        );

        // Credit Wallet
        await client.query(
          'UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE user_id = $2',
          [amount, dep.user_id]
        );

        // Create immutable ledger transaction
        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, admin_id, description, idempotency_key)
           VALUES ($1, $2, 'DEPOSIT', 'COMPLETED', $3, $4, $5, $6)`,
          [dep.user_id, amount, dep.reference, adminId, `Manual deposit approved (${dep.payment_method})`, idempotencyKey]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const dep = memDb.deposits.get(depositId);
    if (!dep) throw new Error('Deposit not found');
    if (dep.status !== 'PENDING') throw new Error(`Deposit has already been ${dep.status.toLowerCase()}`);

    dep.status = 'APPROVED';
    dep.reviewedBy = adminId;
    dep.reviewedAt = new Date().toISOString();

    this.updateMemWallet(dep.userId, (w) => {
      w.availableBalance += dep.amount;
    });

    const now = new Date().toISOString();
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId: dep.userId,
      amount: dep.amount,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      reference: dep.reference,
      adminId,
      description: `Manual deposit approved (${dep.paymentMethod})`,
      idempotencyKey,
      createdAt: now,
    });

    return true;
  }

  /**
   * Admin rejects manual deposit
   */
  static async rejectDeposit(depositId: string, adminId: string, reason: string) {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(
        `UPDATE deposits SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3 AND status = 'PENDING'`,
        [adminId, reason, depositId]
      );
      if (res.rowCount === 0) throw new Error('Deposit not found or already reviewed');
      return true;
    }

    const dep = memDb.deposits.get(depositId);
    if (!dep) throw new Error('Deposit not found');
    if (dep.status !== 'PENDING') throw new Error(`Deposit has already been ${dep.status.toLowerCase()}`);

    dep.status = 'REJECTED';
    dep.reviewedBy = adminId;
    dep.reviewedAt = new Date().toISOString();
    dep.rejectionReason = reason;
    return true;
  }

  /**
   * Request withdrawal: locks available balance into locked balance
   */
  static async requestWithdrawal(userId: string, username: string, amount: number, telebirrPhone: string, accountName?: string) {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');

    const withdrawalId = `wdr-${crypto.randomUUID()}`;
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const walletRes = await client.query('SELECT available_balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        if (walletRes.rows.length === 0) throw new Error('Wallet not found');

        const available = parseFloat(walletRes.rows[0].available_balance);
        if (available < amount) {
          throw new Error(`Insufficient available balance: ${available} ETB, requested ${amount} ETB`);
        }

        // Lock balance
        await client.query(
          'UPDATE wallets SET available_balance = available_balance - $1, locked_balance = locked_balance + $1, updated_at = NOW() WHERE user_id = $2',
          [amount, userId]
        );

        // Record withdrawal request
        await client.query(
          `INSERT INTO withdrawals (id, user_id, amount, telebirr_phone, account_name, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())`,
          [withdrawalId, userId, amount, telebirrPhone, accountName || null]
        );

        await client.query('COMMIT');
        return withdrawalId;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const wallet = await this.getWallet(userId);
    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient available balance: ${wallet.availableBalance} ETB, requested ${amount} ETB`);
    }

    this.updateMemWallet(userId, (w) => {
      w.availableBalance -= amount;
      w.lockedBalance += amount;
    });

    const now = new Date().toISOString();
    memDb.withdrawals.set(withdrawalId, {
      id: withdrawalId,
      userId,
      amount,
      telebirrPhone,
      accountName,
      status: 'PENDING',
      createdAt: now,
    });

    return withdrawalId;
  }

  /**
   * Admin approves & confirms manual withdrawal payout (removes locked balance and writes WITHDRAWAL ledger)
   */
  static async finalizeWithdrawalPaid(withdrawalId: string, adminId: string) {
    const idempotencyKey = `paid-wdr-${withdrawalId}`;
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const wdrRes = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [withdrawalId]);
        if (wdrRes.rows.length === 0) throw new Error('Withdrawal request not found');
        const wdr = wdrRes.rows[0];

        if (wdr.status !== 'PENDING') throw new Error(`Withdrawal has already been ${wdr.status.toLowerCase()}`);
        const amount = parseFloat(wdr.amount);

        // Mark PAID
        await client.query(
          `UPDATE withdrawals SET status = 'PAID', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
          [adminId, withdrawalId]
        );

        // Remove from locked balance
        await client.query(
          'UPDATE wallets SET locked_balance = locked_balance - $1, updated_at = NOW() WHERE user_id = $2',
          [amount, wdr.user_id]
        );

        // Record finalized transaction
        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, admin_id, description, idempotency_key)
           VALUES ($1, $2, 'WITHDRAWAL', 'COMPLETED', $3, $4, $5, $6)`,
          [wdr.user_id, -amount, `WDR_${wdr.telebirr_phone}`, adminId, `Withdrawal to Telebirr ${wdr.telebirr_phone}`, idempotencyKey]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const wdr = memDb.withdrawals.get(withdrawalId);
    if (!wdr) throw new Error('Withdrawal request not found');
    if (wdr.status !== 'PENDING') throw new Error(`Withdrawal has already been ${wdr.status.toLowerCase()}`);

    wdr.status = 'PAID';
    wdr.reviewedBy = adminId;
    wdr.reviewedAt = new Date().toISOString();

    this.updateMemWallet(wdr.userId, (w) => {
      w.lockedBalance = Math.max(0, w.lockedBalance - wdr.amount);
    });

    const now = new Date().toISOString();
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId: wdr.userId,
      amount: -wdr.amount,
      type: 'WITHDRAWAL',
      status: 'COMPLETED',
      reference: `WDR_${wdr.telebirrPhone}`,
      adminId,
      description: `Withdrawal to Telebirr ${wdr.telebirrPhone}`,
      idempotencyKey,
      createdAt: now,
    });

    return true;
  }

  /**
   * Admin rejects withdrawal -> restores locked funds back to available balance
   */
  static async rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
    const idempotencyKey = `reject-wdr-${withdrawalId}`;
    const pool = getPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const wdrRes = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [withdrawalId]);
        if (wdrRes.rows.length === 0) throw new Error('Withdrawal request not found');
        const wdr = wdrRes.rows[0];

        if (wdr.status !== 'PENDING') throw new Error(`Withdrawal has already been ${wdr.status.toLowerCase()}`);
        const amount = parseFloat(wdr.amount);

        // Mark REJECTED
        await client.query(
          `UPDATE withdrawals SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3`,
          [adminId, reason, withdrawalId]
        );

        // Unlock funds back to available balance
        await client.query(
          'UPDATE wallets SET locked_balance = locked_balance - $1, available_balance = available_balance + $1, updated_at = NOW() WHERE user_id = $2',
          [amount, wdr.user_id]
        );

        // Transaction refund record
        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, admin_id, description, idempotency_key)
           VALUES ($1, $2, 'WITHDRAWAL_REFUND', 'COMPLETED', $3, $4, $5, $6)`,
          [wdr.user_id, amount, `REJECT_${withdrawalId.slice(0, 8)}`, adminId, `Withdrawal rejected: ${reason}`, idempotencyKey]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const wdr = memDb.withdrawals.get(withdrawalId);
    if (!wdr) throw new Error('Withdrawal request not found');
    if (wdr.status !== 'PENDING') throw new Error(`Withdrawal has already been ${wdr.status.toLowerCase()}`);

    wdr.status = 'REJECTED';
    wdr.reviewedBy = adminId;
    wdr.reviewedAt = new Date().toISOString();
    wdr.rejectionReason = reason;

    this.updateMemWallet(wdr.userId, (w) => {
      w.lockedBalance = Math.max(0, w.lockedBalance - wdr.amount);
      w.availableBalance += wdr.amount;
    });

    const now = new Date().toISOString();
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId: wdr.userId,
      amount: wdr.amount,
      type: 'WITHDRAWAL_REFUND',
      status: 'COMPLETED',
      reference: `REJECT_${withdrawalId.slice(0, 8)}`,
      adminId,
      description: `Withdrawal rejected: ${reason}`,
      idempotencyKey,
      createdAt: now,
    });

    return true;
  }

  /**
   * Admin Adjusts User Wallet Balance (Credit, Debit, or Set)
   */
  static async adjustUserBalance(
    userId: string,
    adminId: string,
    actionType: 'CREDIT' | 'DEBIT' | 'SET',
    amount: number,
    reason: string
  ): Promise<{ success: boolean; newBalance: number; diff: number; previousBalance: number }> {
    if (isNaN(amount) || (actionType !== 'SET' && amount <= 0) || (actionType === 'SET' && amount < 0)) {
      throw new Error('Invalid adjustment amount');
    }

    const pool = getPool();
    const now = new Date().toISOString();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if wallet exists or initialize
        let walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        if (walletRes.rows.length === 0) {
          await client.query(
            `INSERT INTO wallets (user_id, available_balance, locked_balance, currency, created_at)
             VALUES ($1, 0.00, 0.00, 'ETB', NOW())
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
          );
          walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        }

        const currentBalance = parseFloat(walletRes.rows[0].available_balance);
        let newBalance = currentBalance;
        let diff = 0;

        if (actionType === 'CREDIT') {
          diff = amount;
          newBalance = Math.round((currentBalance + amount) * 100) / 100;
        } else if (actionType === 'DEBIT') {
          if (currentBalance < amount) {
            throw new Error(`Cannot debit ${amount} ETB: User only has ${currentBalance} ETB available`);
          }
          diff = -amount;
          newBalance = Math.round((currentBalance - amount) * 100) / 100;
        } else if (actionType === 'SET') {
          diff = Math.round((amount - currentBalance) * 100) / 100;
          newBalance = amount;
        }

        // Update wallet
        await client.query(
          'UPDATE wallets SET available_balance = $1, updated_at = NOW() WHERE user_id = $2',
          [newBalance, userId]
        );

        // Record audit transaction in immutable ledger
        const reference = `ADJ_${Date.now().toString().slice(-6)}`;
        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, amount, type, status, reference, admin_id, description)
           VALUES ($1, $2, 'ADMIN_ADJUSTMENT', 'COMPLETED', $3, $4, $5)`,
          [userId, diff, reference, adminId, reason || `Admin balance adjustment (${actionType})`]
        );

        await client.query('COMMIT');
        return { success: true, newBalance, diff, previousBalance: currentBalance };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory update
    const wallet = await this.getWallet(userId);
    const currentBalance = wallet.availableBalance;
    let newBalance = currentBalance;
    let diff = 0;

    if (actionType === 'CREDIT') {
      diff = amount;
      newBalance = Math.round((currentBalance + amount) * 100) / 100;
    } else if (actionType === 'DEBIT') {
      if (currentBalance < amount) {
        throw new Error(`Cannot debit ${amount} ETB: User only has ${currentBalance} ETB available`);
      }
      diff = -amount;
      newBalance = Math.round((currentBalance - amount) * 100) / 100;
    } else if (actionType === 'SET') {
      diff = Math.round((amount - currentBalance) * 100) / 100;
      newBalance = amount;
    }

    this.updateMemWallet(userId, (w) => {
      w.availableBalance = newBalance;
    });

    const reference = `ADJ_${Date.now().toString().slice(-6)}`;
    memDb.walletTransactions.push({
      id: `tx-${crypto.randomUUID()}`,
      userId,
      amount: diff,
      type: 'ADMIN_ADJUSTMENT',
      status: 'COMPLETED',
      reference,
      adminId,
      description: reason || `Admin balance adjustment (${actionType})`,
      createdAt: now,
    });

    return { success: true, newBalance, diff, previousBalance: currentBalance };
  }
}
