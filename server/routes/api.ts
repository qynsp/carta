import express, { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/auth';
import { GameEngineService } from '../services/gameEngine';
import { WalletLedgerService } from '../services/walletLedger';
import { AuditService } from '../services/audit';
import { memDb, getPool, toCleanUuid } from '../db';
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

// Standalone Web / Guest Session (for browser players outside Telegram)
apiRouter.post('/auth/guest', async (req: Request, res: Response) => {
  try {
    const { username, firstName } = req.body;
    const guestTgId = `web_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const user = await AuthService.syncUser(
      guestTgId,
      username || `player_${guestTgId.slice(-4)}`,
      firstName || 'Player'
    );

    const token = AuthService.generateToken(user);
    return res.json({ token, user });
  } catch (err: any) {
    console.error('Guest session creation error:', err);
    return res.status(500).json({ error: err.message || 'Guest session error' });
  }
});

// Administrator Login Endpoint
apiRouter.post('/auth/admin/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const adminUser = await AuthService.adminLogin(username, password);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const token = AuthService.generateToken(adminUser);

    await AuditService.log(
      adminUser.id,
      adminUser.username,
      'ADMIN_LOGIN',
      'USER',
      adminUser.id,
      `Administrator ${adminUser.username} authenticated successfully`
    );

    return res.json({ token, user: adminUser });
  } catch (err: any) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: err.message || 'Admin authentication error' });
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

// Update current user profile name
const handleUpdateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, username } = req.body;
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'Player name is required' });
    }
    const user = await AuthService.updateProfile(req.user!.userId, firstName, username);
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
};

apiRouter.put('/auth/profile', requireAuth, handleUpdateProfile);
apiRouter.post('/auth/profile', requireAuth, handleUpdateProfile);

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
    if (!name || entryFee === undefined) {
      return res.status(400).json({ error: 'Missing required game fields' });
    }

    const gameId = await GameEngineService.createGame(
      req.user!.userId,
      req.user!.username,
      name,
      maxPlayers ? parseInt(maxPlayers, 10) : 8,
      parseFloat(entryFee),
      tableNumber
    );

    const game = await GameEngineService.getPublicGameState(gameId);
    return res.status(201).json({ game });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Start a game (when 2+ players are joined and ready)
apiRouter.post('/games/:id/start', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await GameEngineService.startGame(req.params.id, req.user!.userId);
    const game = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ success: true, game });
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

// Toggle player ready status in waiting lobby
apiRouter.post('/games/:id/ready', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { isReady } = req.body;
    const result = await GameEngineService.togglePlayerReady(
      req.params.id,
      req.user!.userId,
      isReady !== undefined ? Boolean(isReady) : undefined
    );
    const game = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ success: true, ...result, game });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Vote to disband and refund match (ይፍረስ)
apiRouter.post('/games/:id/disband-vote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { vote } = req.body;
    const result = await GameEngineService.toggleDisbandVote(
      req.params.id,
      req.user!.userId,
      vote !== undefined ? Boolean(vote) : undefined
    );
    const game = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ success: true, ...result, game });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// End Game Verification Vote (50% player confirmation & Anti-Manipulation Protection)
apiRouter.post('/games/:id/verify-vote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { vote } = req.body;
    if (vote !== 'CONFIRMED' && vote !== 'MANIPULATED') {
      return res.status(400).json({ error: "Vote must be either 'CONFIRMED' or 'MANIPULATED'" });
    }

    const result = await GameEngineService.voteEndGameVerification(
      req.params.id,
      req.user!.userId,
      vote
    );
    const game = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ success: true, ...result, game });
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

// Process Shot (for Active Shooter, Host, or Operator)
apiRouter.post('/games/:id/shot', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { ballNumber, isScratch, isMiss } = req.body;

    if (!isScratch && !isMiss && (ballNumber === undefined || ballNumber < 1 || ballNumber > 15)) {
      return res.status(400).json({ error: 'Please specify a valid ball number (1-15), mark as scratch, or pass/miss' });
    }

    const result = await GameEngineService.processShot(
      req.params.id,
      req.user!.userId,
      ballNumber ? parseInt(ballNumber, 10) : undefined,
      Boolean(isScratch),
      Boolean(isMiss)
    );

    const updatedGame = await GameEngineService.getPublicGameState(req.params.id);
    return res.json({ result, game: updatedGame });
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
      const { ballNumber, isScratch, isMiss } = req.body;

      if (!isScratch && !isMiss && (ballNumber === undefined || ballNumber < 1 || ballNumber > 15)) {
        return res.status(400).json({ error: 'Please specify a valid ball number (1-15), mark as scratch, or pass/miss' });
      }

      const result = await GameEngineService.processShot(
        req.params.id,
        req.user!.userId,
        ballNumber ? parseInt(ballNumber, 10) : undefined,
        Boolean(isScratch),
        Boolean(isMiss)
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

// Dedicated transaction history route
apiRouter.get('/wallet/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await WalletLedgerService.getWallet(req.user!.userId);
    const transactions = await WalletLedgerService.getTransactions(req.user!.userId);
    return res.json({ wallet, transactions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Submit manual deposit request (supports both /wallet/deposit and /wallet/deposits)
const handleDepositRequest = async (req: AuthRequest, res: Response) => {
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
};

apiRouter.post('/wallet/deposits', requireAuth, handleDepositRequest);
apiRouter.post('/wallet/deposit', requireAuth, handleDepositRequest);

// Get user's deposit requests
const handleGetDeposits = async (req: AuthRequest, res: Response) => {
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
};

apiRouter.get('/wallet/deposits', requireAuth, handleGetDeposits);
apiRouter.get('/wallet/deposit', requireAuth, handleGetDeposits);

// Submit manual withdrawal request (supports both /wallet/withdraw and /wallet/withdrawals)
const handleWithdrawalRequest = async (req: AuthRequest, res: Response) => {
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
};

apiRouter.post('/wallet/withdrawals', requireAuth, handleWithdrawalRequest);
apiRouter.post('/wallet/withdraw', requireAuth, handleWithdrawalRequest);

// Get user's withdrawal requests
const handleGetWithdrawals = async (req: AuthRequest, res: Response) => {
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
};

apiRouter.get('/wallet/withdrawals', requireAuth, handleGetWithdrawals);
apiRouter.get('/wallet/withdraw', requireAuth, handleGetWithdrawals);

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

// Admin Update User Profile (Name, Username, Role)
apiRouter.post('/admin/users/:id/update-profile', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, username, role } = req.body;
    const cleanUserId = req.params.id;
    const pool = getPool();

    if (pool) {
      const cleanDbId = toCleanUuid(cleanUserId);
      await pool.query(
        `UPDATE users SET 
           first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           username = COALESCE($3, username),
           role = COALESCE($4, role),
           updated_at = NOW()
         WHERE id = $5`,
        [firstName?.trim() || null, lastName?.trim() || null, username?.trim() || null, role || null, cleanDbId]
      );
    } else {
      const u = memDb.users.get(cleanUserId);
      if (u) {
        if (firstName !== undefined) u.firstName = firstName.trim();
        if (lastName !== undefined) u.lastName = lastName.trim();
        if (username !== undefined) u.username = username.trim();
        if (role !== undefined) u.role = role;
        u.updatedAt = new Date().toISOString();
      }
    }

    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'UPDATE_USER_PROFILE',
      'USER',
      cleanUserId,
      `Updated user profile: Name=${firstName} ${lastName || ''}, Username=@${username}`
    );

    return res.json({ success: true, message: 'User profile updated successfully' });
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

// Admin Adjust User Balance (Credit, Debit, or Set)
apiRouter.post('/admin/users/:id/adjust-balance', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { actionType, amount, reason } = req.body;
    if (!actionType || amount === undefined || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Please provide a valid actionType (CREDIT, DEBIT, or SET) and numeric amount' });
    }

    const result = await WalletLedgerService.adjustUserBalance(
      req.params.id,
      req.user!.userId,
      actionType,
      parseFloat(amount),
      reason || 'Admin balance adjustment'
    );

    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'ADJUST_BALANCE',
      'USER',
      req.params.id,
      `Adjusted user #${req.params.id} balance via ${actionType} (${amount} ETB). Diff: ${result.diff} ETB. New Balance: ${result.newBalance} ETB. Reason: ${reason || 'N/A'}`
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
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

// Public Platform Settings (for DepositModal and game limits)
apiRouter.get('/settings/public', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query(`
        SELECT 
          platform_fee_percent as "platformFeePercent",
          min_deposit as "minDeposit",
          max_deposit as "maxDeposit",
          min_withdrawal as "minWithdrawal",
          max_withdrawal as "maxWithdrawal",
          min_game_entry as "minGameEntry",
          max_game_entry as "maxGameEntry",
          telebirr_receiver_number as "telebirrReceiverNumber",
          telebirr_receiver_name as "telebirrReceiverName",
          real_money_enabled as "realMoneyEnabled",
          currency
        FROM platform_settings WHERE id = 1
      `);
      if (r.rows.length > 0) return res.json({ settings: r.rows[0] });
    }
    return res.json({
      settings: {
        platformFeePercent: memDb.platformSettings.platformFeePercent,
        minDeposit: memDb.platformSettings.minDeposit,
        maxDeposit: memDb.platformSettings.maxDeposit,
        minWithdrawal: memDb.platformSettings.minWithdrawal,
        maxWithdrawal: memDb.platformSettings.maxWithdrawal,
        minGameEntry: memDb.platformSettings.minGameEntry,
        maxGameEntry: memDb.platformSettings.maxGameEntry,
        telebirrReceiverNumber: memDb.platformSettings.telebirrReceiverNumber || '0911223344',
        telebirrReceiverName: memDb.platformSettings.telebirrReceiverName || 'Pool Cards Addis',
        realMoneyEnabled: memDb.platformSettings.realMoneyEnabled || false,
        currency: memDb.platformSettings.currency || 'ETB',
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Platform Settings
apiRouter.get('/admin/settings', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query(`
        SELECT 
          id,
          platform_fee_percent as "platformFeePercent",
          min_deposit as "minDeposit",
          max_deposit as "maxDeposit",
          min_withdrawal as "minWithdrawal",
          max_withdrawal as "maxWithdrawal",
          min_game_entry as "minGameEntry",
          max_game_entry as "maxGameEntry",
          telebirr_receiver_number as "telebirrReceiverNumber",
          telebirr_receiver_name as "telebirrReceiverName",
          real_money_enabled as "realMoneyEnabled",
          currency,
          updated_at as "updatedAt"
        FROM platform_settings WHERE id = 1
      `);
      if (r.rows.length > 0) return res.json({ settings: r.rows[0] });
    }
    return res.json({ settings: memDb.platformSettings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Platform Settings
const handleUpdateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const {
      platformFeePercent,
      minDeposit,
      maxDeposit,
      minWithdrawal,
      maxWithdrawal,
      minGameEntry,
      maxGameEntry,
      telebirrReceiverNumber,
      telebirrReceiverName,
      realMoneyEnabled
    } = req.body;

    const cleanTelebirrNum = telebirrReceiverNumber ? String(telebirrReceiverNumber).trim() : '0911223344';
    const cleanTelebirrName = telebirrReceiverName ? String(telebirrReceiverName).trim() : 'Pool Cards Addis';

    const pool = getPool();
    let updatedSettings: any = null;

    if (pool) {
      const upsertRes = await pool.query(
        `INSERT INTO platform_settings (
           id, platform_fee_percent, min_deposit, max_deposit,
           min_withdrawal, max_withdrawal, min_game_entry, max_game_entry,
           telebirr_receiver_number, telebirr_receiver_name,
           real_money_enabled, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (id) DO UPDATE SET
           platform_fee_percent = EXCLUDED.platform_fee_percent,
           min_deposit = EXCLUDED.min_deposit,
           max_deposit = EXCLUDED.max_deposit,
           min_withdrawal = EXCLUDED.min_withdrawal,
           max_withdrawal = EXCLUDED.max_withdrawal,
           min_game_entry = EXCLUDED.min_game_entry,
           max_game_entry = EXCLUDED.max_game_entry,
           telebirr_receiver_number = EXCLUDED.telebirr_receiver_number,
           telebirr_receiver_name = EXCLUDED.telebirr_receiver_name,
           real_money_enabled = EXCLUDED.real_money_enabled,
           updated_at = NOW()
         RETURNING 
           id,
           platform_fee_percent as "platformFeePercent",
           min_deposit as "minDeposit",
           max_deposit as "maxDeposit",
           min_withdrawal as "minWithdrawal",
           max_withdrawal as "maxWithdrawal",
           min_game_entry as "minGameEntry",
           max_game_entry as "maxGameEntry",
           telebirr_receiver_number as "telebirrReceiverNumber",
           telebirr_receiver_name as "telebirrReceiverName",
           real_money_enabled as "realMoneyEnabled",
           currency,
           updated_at as "updatedAt"
        `,
        [
          1,
          platformFeePercent !== undefined ? parseFloat(platformFeePercent) : 5.0,
          minDeposit !== undefined ? parseFloat(minDeposit) : 10.0,
          maxDeposit !== undefined ? parseFloat(maxDeposit) : 50000.0,
          minWithdrawal !== undefined ? parseFloat(minWithdrawal) : 50.0,
          maxWithdrawal !== undefined ? parseFloat(maxWithdrawal) : 20000.0,
          minGameEntry !== undefined ? parseFloat(minGameEntry) : 10.0,
          maxGameEntry !== undefined ? parseFloat(maxGameEntry) : 5000.0,
          cleanTelebirrNum,
          cleanTelebirrName,
          Boolean(realMoneyEnabled),
        ]
      );
      updatedSettings = upsertRes.rows[0];
    } else {
      memDb.platformSettings = {
        ...memDb.platformSettings,
        platformFeePercent: platformFeePercent !== undefined ? parseFloat(platformFeePercent) : memDb.platformSettings.platformFeePercent,
        minDeposit: minDeposit !== undefined ? parseFloat(minDeposit) : memDb.platformSettings.minDeposit,
        maxDeposit: maxDeposit !== undefined ? parseFloat(maxDeposit) : memDb.platformSettings.maxDeposit,
        minWithdrawal: minWithdrawal !== undefined ? parseFloat(minWithdrawal) : memDb.platformSettings.minWithdrawal,
        maxWithdrawal: maxWithdrawal !== undefined ? parseFloat(maxWithdrawal) : memDb.platformSettings.maxWithdrawal,
        minGameEntry: minGameEntry !== undefined ? parseFloat(minGameEntry) : memDb.platformSettings.minGameEntry,
        maxGameEntry: maxGameEntry !== undefined ? parseFloat(maxGameEntry) : memDb.platformSettings.maxGameEntry,
        telebirrReceiverNumber: cleanTelebirrNum,
        telebirrReceiverName: cleanTelebirrName,
        realMoneyEnabled: Boolean(realMoneyEnabled),
        updatedAt: new Date().toISOString(),
      };
      updatedSettings = memDb.platformSettings;
    }

    await AuditService.log(
      req.user!.userId,
      req.user!.username,
      'UPDATE_SETTINGS',
      'SETTINGS',
      '1',
      `Updated settings. Telebirr: ${cleanTelebirrNum} (${cleanTelebirrName}), fee: ${platformFeePercent}%, realMoney: ${realMoneyEnabled}`
    );

    return res.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

apiRouter.put('/admin/settings', requireAuth, requireRole(['ADMIN']), handleUpdateSettings);
apiRouter.post('/admin/settings', requireAuth, requireRole(['ADMIN']), handleUpdateSettings);

// Admin Audit Logs
apiRouter.get('/admin/audit-logs', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await AuditService.getLogs();
    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
