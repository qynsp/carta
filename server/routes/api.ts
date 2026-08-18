import express, { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/auth';
import { GameEngineService } from '../services/gameEngine';
import { WalletLedgerService } from '../services/walletLedger';
import { AuditService } from '../services/audit';
import { memDb, getPool } from '../db';
import { PlatformSettings, UserRole } from '../../src/types';

export const apiRouter = express.Router();

// Augment Request with authenticated user
export interface AuthRequest extends Request {
  user?: TokenPayload;
}

// Authentication Middleware
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const payload = AuthService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }

  req.user = payload;
  next();
}

// Role Authorization Middleware
export function requireRole(roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden: Insufficient permissions' });
    }
    next();
  };
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Telegram WebApp Authentication
apiRouter.post('/auth/telegram', async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      return res.status(400).json({ error: 'Missing initData' });
    }

    const { isValid, user: tgUser } = AuthService.validateTelegramInitData(initData);
    if (!isValid || !tgUser) {
      return res.status(401).json({ error: 'Telegram signature validation failed' });
    }

    const user = await AuthService.syncUser(
      String(tgUser.id),
      tgUser.username || `user_${tgUser.id}`,
      tgUser.first_name || 'Player',
      tgUser.last_name
    );

    const token = AuthService.generateToken(user);
    return res.json({ token, user });
  } catch (err: any) {
    console.error('Telegram auth error:', err);
    return res.status(500).json({ error: err.message || 'Authentication error' });
  }
});

// Dev / Demo User Switcher (For local development & preview testing)
apiRouter.post('/auth/dev-switch', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    let targetUser = await AuthService.getUserById(userId);

    if (!targetUser) {
      // Find in memDb or default list
      const pool = getPool();
      if (!pool) {
        const found = memDb.users.get(userId);
        if (found) {
          targetUser = await AuthService.getUserById(found.id);
        }
      }
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const token = AuthService.generateToken(targetUser);
    return res.json({ token, user: targetUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get current user profile & wallet
apiRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await AuthService.getUserById(req.user!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// List all dev personas (for persona switcher bar in preview)
apiRouter.get('/auth/dev-personas', async (req: Request, res: Response) => {
  const pool = getPool();
  if (pool) {
    const r = await pool.query('SELECT id, telegram_id as "telegramId", username, first_name as "firstName", role FROM users ORDER BY created_at ASC LIMIT 10');
    return res.json({ personas: r.rows });
  }

  const personas = Array.from(memDb.users.values()).map((u) => ({
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    role: u.role,
  }));
  return res.json({ personas });
});

// ==========================================
// 2. GAME ROUTES
// ==========================================

// List games
apiRouter.get('/games', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const games = await GameEngineService.listGames(status);
    return res.json({ games });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create a new game
apiRouter.post('/games', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, maxPlayers, entryFee, tableNumber } = req.body;
    if (!name || !maxPlayers || entryFee === undefined) {
      return res.status(400).json({ error: 'Missing required game fields' });
    }

    const gameId = await GameEngineService.createGame(
      req.user!.userId,
      req.user!.username,
      name,
      parseInt(maxPlayers, 10),
      parseFloat(entryFee),
      tableNumber
    );

    const game = await GameEngineService.getPublicGameState(gameId);
    return res.status(201).json({ game });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get Public Game State (Scores, players, events - NO PRIVATE CARDS)
apiRouter.get('/games/:id', async (req: Request, res: Response) => {
  try {
    const game = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ game });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// Join a game
apiRouter.post('/games/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await GameEngineService.joinGame(req.user!.userId, req.user!.username, req.params.id);
    const game = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ success: true, game });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get PRIVATE Game State (Public state + ONLY calling user's unremoved cards)
apiRouter.get('/games/:id/private-state', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const privateState = await GameEngineService.getPrivateState(req.params.id, req.user!.userId);
    return res.json(privateState);
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// Cancel a game (Refunds all players)
apiRouter.post('/games/:id/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    await GameEngineService.cancelGame(req.params.id, req.user!.userId, reason || 'Game cancelled by user');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. TABLE OPERATOR ROUTES
// ==========================================

// Process Physical Shot Event
apiRouter.post(
  '/operator/games/:id/shot',
  requireAuth,
  requireRole(['OPERATOR', 'ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ballNumber, isScratch } = req.body;

      if (!isScratch && (ballNumber === undefined || ballNumber < 1 || ballNumber > 15)) {
        return res.status(400).json({ error: 'Please specify a valid ball number (1-15) or mark as scratch' });
      }

      const result = await GameEngineService.processShot(
        req.params.id,
        req.user!.userId,
        ballNumber ? parseInt(ballNumber, 10) : undefined,
        Boolean(isScratch)
      );

      const updatedGame = await GameEngineService.getPublicGameState(req.params.id);
      return res.json({ result, game: updatedGame });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
);

// ==========================================
// 4. WALLET & MANUAL TRANSACTION ROUTES
// ==========================================

// Get user wallet & transaction history
apiRouter.get('/wallet', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await WalletLedgerService.getWallet(req.user!.userId);
    const transactions = await WalletLedgerService.getTransactions(req.user!.userId);
    return res.json({ wallet, transactions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Submit manual deposit request
apiRouter.post('/wallet/deposits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, reference, paymentMethod, notes } = req.body;
    if (!amount || !reference) {
      return res.status(400).json({ error: 'Amount and reference code are required' });
    }

    const depositId = await WalletLedgerService.requestDeposit(
      req.user!.userId,
      req.user!.username,
      parseFloat(amount),
      reference,
      paymentMethod || 'Telebirr',
      notes
    );

    return res.status(201).json({ depositId, message: 'Deposit submitted for manual verification' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get user's deposit requests
apiRouter.get('/wallet/deposits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query('SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC', [req.user!.userId]);
      return res.json({ deposits: r.rows });
    }

    const deposits = Array.from(memDb.deposits.values())
      .filter((d) => d.userId === req.user!.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ deposits });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Submit manual withdrawal request
apiRouter.post('/wallet/withdrawals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, telebirrPhone, accountName } = req.body;
    if (!amount || !telebirrPhone) {
      return res.status(400).json({ error: 'Amount and Telebirr phone number are required' });
    }

    const withdrawalId = await WalletLedgerService.requestWithdrawal(
      req.user!.userId,
      req.user!.username,
      parseFloat(amount),
      telebirrPhone,
      accountName
    );

    return res.status(201).json({ withdrawalId, message: 'Withdrawal requested and funds locked for review' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get user's withdrawal requests
apiRouter.get('/wallet/withdrawals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [req.user!.userId]);
      return res.json({ withdrawals: r.rows });
    }

    const withdrawals = Array.from(memDb.withdrawals.values())
      .filter((w) => w.userId === req.user!.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ withdrawals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ADMIN DASHBOARD ROUTES
// ==========================================

// Dashboard Metrics
apiRouter.get('/admin/metrics', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const userCountRes = await pool.query('SELECT COUNT(*) FROM users');
      const activeGamesRes = await pool.query(`SELECT COUNT(*) FROM games WHERE status = 'ACTIVE'`);
      const completedGamesRes = await pool.query(`SELECT COUNT(*) FROM games WHERE status = 'COMPLETED'`);
      const pendingDepRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'PENDING'`);
      const pendingWdrRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'PENDING'`);
      const balanceRes = await pool.query('SELECT COALESCE(SUM(available_balance + locked_balance), 0) as total FROM wallets');
      const feeRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE type = 'PLATFORM_FEE'`);

      return res.json({
        metrics: {
          totalUsers: parseInt(userCountRes.rows[0].count, 10),
          activeGames: parseInt(activeGamesRes.rows[0].count, 10),
          completedGames: parseInt(completedGamesRes.rows[0].count, 10),
          pendingDepositsCount: parseInt(pendingDepRes.rows[0].count, 10),
          pendingDepositsAmount: parseFloat(pendingDepRes.rows[0].total),
          pendingWithdrawalsCount: parseInt(pendingWdrRes.rows[0].count, 10),
          pendingWithdrawalsAmount: parseFloat(pendingWdrRes.rows[0].total),
          totalSystemBalance: parseFloat(balanceRes.rows[0].total),
          platformRevenue: parseFloat(feeRes.rows[0].total),
        },
      });
    }

    const allUsers = Array.from(memDb.users.values());
    const allGames = Array.from(memDb.games.values());
    const pendingDeposits = Array.from(memDb.deposits.values()).filter((d) => d.status === 'PENDING');
    const pendingWithdrawals = Array.from(memDb.withdrawals.values()).filter((w) => w.status === 'PENDING');
    const allWallets = Array.from(memDb.wallets.values());
    const feeTxs = memDb.walletTransactions.filter((tx) => tx.type === 'PLATFORM_FEE');

    const totalSystemBalance = allWallets.reduce((acc, w) => acc + w.availableBalance + w.lockedBalance, 0);
    const platformRevenue = feeTxs.reduce((acc, tx) => acc + tx.amount, 0);

    return res.json({
      metrics: {
        totalUsers: allUsers.length,
        activeGames: allGames.filter((g) => g.status === 'ACTIVE').length,
        completedGames: allGames.filter((g) => g.status === 'COMPLETED').length,
        pendingDepositsCount: pendingDeposits.length,
        pendingDepositsAmount: pendingDeposits.reduce((acc, d) => acc + d.amount, 0),
        pendingWithdrawalsCount: pendingWithdrawals.length,
        pendingWithdrawalsAmount: pendingWithdrawals.reduce((acc, w) => acc + w.amount, 0),
        totalSystemBalance,
        platformRevenue,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Users List
apiRouter.get('/admin/users', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const resUsers = await pool.query(
        `SELECT u.id, u.telegram_id as "telegramId", u.username, u.first_name as "firstName", u.last_name as "lastName",
                u.role, u.is_frozen as "isFrozen", u.created_at as "createdAt",
                w.available_balance as "availableBalance", w.locked_balance as "lockedBalance"
         FROM users u
         LEFT JOIN wallets w ON u.id = w.user_id
         ORDER BY u.created_at DESC`
      );
      return res.json({ users: resUsers.rows });
    }

    const users = Array.from(memDb.users.values()).map((u) => {
      const w = memDb.wallets.get(u.id);
      return {
        ...u,
        availableBalance: w?.availableBalance || 0,
        lockedBalance: w?.lockedBalance || 0,
      };
    });
    return res.json({ users });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Freeze/Unfreeze user
apiRouter.post('/admin/users/:id/freeze', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { isFrozen } = req.body;
    const pool = getPool();
    if (pool) {
      await pool.query('UPDATE users SET is_frozen = $1 WHERE id = $2', [Boolean(isFrozen), req.params.id]);
    } else {
      const u = memDb.users.get(req.params.id);
      if (u) u.isFrozen = Boolean(isFrozen);
    }

    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      isFrozen ? 'FREEZE_USER' : 'UNFREEZE_USER',
      'USER',
      req.params.id,
      `User ${isFrozen ? 'frozen' : 'unfrozen'}`
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Deposits Management
apiRouter.get('/admin/deposits', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const resDep = await pool.query(
        `SELECT d.*, u.username, u.first_name as "firstName" 
         FROM deposits d
         JOIN users u ON d.user_id = u.id
         ORDER BY d.created_at DESC`
      );
      return res.json({ deposits: resDep.rows });
    }

    const deposits = Array.from(memDb.deposits.values()).map((d) => {
      const u = memDb.users.get(d.userId);
      return {
        ...d,
        username: u?.username || 'user',
        firstName: u?.firstName || 'Player',
      };
    });
    return res.json({ deposits });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Approve Deposit
apiRouter.post('/admin/deposits/:id/approve', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    await WalletLedgerService.approveDeposit(req.params.id, req.user!.userId);
    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'APPROVE_DEPOSIT',
      'DEPOSIT',
      req.params.id,
      `Approved deposit #${req.params.id}`
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Reject Deposit
apiRouter.post('/admin/deposits/:id/reject', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    await WalletLedgerService.rejectDeposit(req.params.id, req.user!.userId, reason || 'Invalid reference or unconfirmed transfer');
    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'REJECT_DEPOSIT',
      'DEPOSIT',
      req.params.id,
      `Rejected deposit #${req.params.id}. Reason: ${reason || 'Unconfirmed'}`
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Withdrawals Management
apiRouter.get('/admin/withdrawals', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const resWdr = await pool.query(
        `SELECT w.*, u.username, u.first_name as "firstName" 
         FROM withdrawals w
         JOIN users u ON w.user_id = u.id
         ORDER BY w.created_at DESC`
      );
      return res.json({ withdrawals: resWdr.rows });
    }

    const withdrawals = Array.from(memDb.withdrawals.values()).map((w) => {
      const u = memDb.users.get(w.userId);
      return {
        ...w,
        username: u?.username || 'user',
        firstName: u?.firstName || 'Player',
      };
    });
    return res.json({ withdrawals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Mark Withdrawal as Paid
apiRouter.post('/admin/withdrawals/:id/approve', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    await WalletLedgerService.finalizeWithdrawalPaid(req.params.id, req.user!.userId);
    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'FINALIZE_WITHDRAWAL',
      'WITHDRAWAL',
      req.params.id,
      `Confirmed Telebirr payout for withdrawal #${req.params.id}`
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Reject Withdrawal
apiRouter.post('/admin/withdrawals/:id/reject', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    await WalletLedgerService.rejectWithdrawal(req.params.id, req.user!.userId, reason || 'Incorrect account information or player request');
    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'REJECT_WITHDRAWAL',
      'WITHDRAWAL',
      req.params.id,
      `Rejected withdrawal #${req.params.id} and refunded balance. Reason: ${reason}`
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Platform Settings
apiRouter.get('/admin/settings', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query('SELECT * FROM platform_settings WHERE id = 1');
      if (r.rows.length > 0) return res.json({ settings: r.rows[0] });
    }
    return res.json({ settings: memDb.platformSettings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Platform Settings
apiRouter.put('/admin/settings', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { platformFeePercent, minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, minGameEntry, maxGameEntry, realMoneyEnabled } = req.body;

    const pool = getPool();
    if (pool) {
      await pool.query(
        `UPDATE platform_settings SET 
           platform_fee_percent = $1, min_deposit = $2, max_deposit = $3,
           min_withdrawal = $4, max_withdrawal = $5, min_game_entry = $6, max_game_entry = $7,
           real_money_enabled = $8, updated_at = NOW()
         WHERE id = 1`,
        [platformFeePercent, minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, minGameEntry, maxGameEntry, Boolean(realMoneyEnabled)]
      );
    } else {
      memDb.platformSettings = {
        ...memDb.platformSettings,
        platformFeePercent: parseFloat(platformFeePercent),
        minDeposit: parseFloat(minDeposit),
        maxDeposit: parseFloat(maxDeposit),
        minWithdrawal: parseFloat(minWithdrawal),
        maxWithdrawal: parseFloat(maxWithdrawal),
        minGameEntry: parseFloat(minGameEntry),
        maxGameEntry: parseFloat(maxGameEntry),
        realMoneyEnabled: Boolean(realMoneyEnabled),
        updatedAt: new Date().toISOString(),
      };
    }

    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'UPDATE_SETTINGS',
      'SETTINGS',
      '1',
      `Updated platform fee to ${platformFeePercent}%, realMoney: ${realMoneyEnabled}`
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Audit Logs
apiRouter.get('/admin/audit-logs', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await AuditService.getLogs();
    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Dev utility: Add test demo funds for preview testing
apiRouter.post('/dev/add-demo-funds', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { amount = 200 } = req.body;
    const wallet = await WalletLedgerService.getWallet(req.user!.userId);
    wallet.availableBalance += parseFloat(amount);

    memDb.walletTransactions.push({
      id: `tx-dev-${Date.now()}`,
      userId: req.user!.userId,
      amount: parseFloat(amount),
      type: 'DEPOSIT',
      status: 'COMPLETED',
      reference: 'DEV_TEST_CREDIT',
      description: `Dev test demo credit of ${amount} ETB`,
      createdAt: new Date().toISOString(),
    });

    return res.json({ success: true, newBalance: wallet.availableBalance });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
