export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type GameStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type VerificationStatus = 'PENDING' | 'CONFIRMED' | 'MANIPULATED';

export type EndGameVote = 'CONFIRMED' | 'MANIPULATED';

export type UserRole = 'PLAYER' | 'OPERATOR' | 'ADMIN';

export type TransactionType =
  | 'DEPOSIT'
  | 'GAME_ENTRY'
  | 'GAME_REFUND'
  | 'WIN'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_REFUND'
  | 'PLATFORM_FEE'
  | 'ADMIN_ADJUSTMENT';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'REJECTED';

export interface User {
  id: string;
  telegramId: string;
  username: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  isFrozen: boolean;
  createdAt: string;
  wallet?: {
    availableBalance: number;
    lockedBalance: number;
    currency: string;
  };
}

export interface PlayerCard {
  id: string;
  gameId: string;
  userId: string;
  cardValue: CardValue;
  isRemoved: boolean;
  removedAt?: string;
  addedAt: string; // To track if added via scratch
  isScratchCard?: boolean;
}

export interface GamePlayerSummary {
  userId: string;
  username: string;
  firstName: string;
  turnOrder: number;
  joinedAt: string;
  isWinner: boolean;
  isReady?: boolean;
  votedDisband?: boolean;
  endGameVote?: EndGameVote;
  endGameVotedAt?: string;
  // NOTE: Opponent card count or specific cards are NEVER exposed in public summary!
}

export interface SunkBallAuditItem {
  ballNumber: number;
  sunkByUserId?: string;
  sunkByName?: string;
  createdAt: string;
  isWinnerCardMatch?: boolean;
}

export interface RevealedWinnerCard {
  cardValue: CardValue;
  isRemoved: boolean;
  removedAt?: string;
  isScratchCard?: boolean;
}

export interface GamePublicState {
  id: string;
  name: string;
  status: GameStatus;
  maxPlayers: number;
  currentPlayersCount: number;
  entryFee: number;
  totalPot: number;
  platformFeePercent: number;
  winnerPayout: number;
  createdBy: string;
  creatorName: string;
  currentTurnUserId?: string;
  currentTurnUsername?: string;
  currentTurnNumber: number;
  winnerUserId?: string;
  winnerName?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  players: GamePlayerSummary[];
  sunkBalls: number[];
  sunkBallsAudit?: SunkBallAuditItem[];
  winnerCardsRevealed?: RevealedWinnerCard[];
  verificationStatus?: VerificationStatus;
  payoutStatus?: 'PENDING' | 'PAID' | 'REFUNDED';
  confirmedVotesCount?: number;
  manipulatedVotesCount?: number;
  requiredConfirmations?: number;
  lastEvent?: GameEventPublic;
  recentEvents?: GameEventPublic[];
  tableNumber?: string;
}

export interface GamePrivateState {
  game: GamePublicState;
  myCards: CardValue[]; // Only the calling player's remaining unremoved cards
  myHistory: {
    initialCardsCount: number;
    scratchesCount: number;
  };
}

export type GameEventType =
  | 'GAME_CREATED'
  | 'PLAYER_JOINED'
  | 'PLAYER_READY'
  | 'PLAYER_NOT_READY'
  | 'GAME_STARTED'
  | 'TURN_STARTED'
  | 'BALL_SUNK'
  | 'SCRATCH'
  | 'CARD_ADDED'
  | 'CARDS_REMOVED'
  | 'TURN_CHANGED'
  | 'TURN_PASSED'
  | 'GAME_WON'
  | 'GAME_CANCELLED'
  | 'DISBAND_VOTE'
  | 'GAME_DISBANDED'
  | 'END_GAME_VOTE'
  | 'GAME_VERIFIED'
  | 'GAME_MANIPULATED_REFUND';

export interface GameEventPublic {
  id: string;
  gameId: string;
  type: GameEventType;
  userId?: string;
  userName?: string;
  ballNumber?: number;
  message: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference: string;
  gameId?: string;
  adminId?: string;
  description: string;
  createdAt: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  reference: string;
  paymentMethod: string;
  notes?: string;
  status: DepositStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export type Deposit = DepositRequest;

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  telebirrPhone: string;
  accountName?: string;
  status: WithdrawalStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export type Withdrawal = WithdrawalRequest;

export interface PlatformSettings {
  id: number;
  platformFeePercent: number;
  minDepositAmount?: number;
  maxDepositAmount?: number;
  minWithdrawalAmount?: number;
  maxWithdrawalAmount?: number;
  minDeposit?: number;
  maxDeposit?: number;
  minWithdrawal?: number;
  maxWithdrawal?: number;
  telebirrReceiverNumber?: string;
  telebirrReceiverName?: string;
  realMoneyMode?: boolean;
  maintenanceMode: boolean;
  minGameEntry?: number;
  maxGameEntry?: number;
  realMoneyEnabled?: boolean;
  currency?: string;
  updatedAt?: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: 'USER' | 'GAME' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTINGS';
  targetId?: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  activeGames: number;
  completedGames: number;
  pendingDepositsCount: number;
  pendingDepositsAmount: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmount: number;
  totalSystemBalance: number;
  platformRevenue: number;
}
