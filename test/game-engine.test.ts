import { GameEngineService } from '../server/services/gameEngine';
import { WalletLedgerService } from '../server/services/walletLedger';
import { memDb } from '../server/db';
import { CardValue } from '../src/types';

// Simple test runner for node / tsx
async function runTests() {
  console.log('--- RUNNING POOL CARDS GAME ENGINE & WALLET TESTS ---');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}\n  Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Test Card Generation
  await test('Random Card Generator produces values between 1 and 13 (A-K)', async () => {
    for (let i = 0; i < 100; i++) {
      const card = GameEngineService.generateRandomCard();
      if (card < 1 || card > 13) {
        throw new Error(`Generated invalid card value: ${card}`);
      }
    }
  });

  // 2. Test Game Creation & Join & Auto-start with 5 cards
  let gameId = '';
  await test('Create 2-player game and join: starts game and deals exactly 5 cards each', async () => {
    const creatorId = 'u-dawit-101';
    const player2Id = 'u-abel-102';

    const creatorWalletBefore = await WalletLedgerService.getWallet(creatorId);
    const initialBal = creatorWalletBefore.availableBalance;

    gameId = await GameEngineService.createGame(creatorId, 'Dawit', 'Championship Match', 2, 50, 'Table 1');
    const gamePublic1 = await GameEngineService.getPublicGameState(gameId);

    if (gamePublic1.status !== 'WAITING') throw new Error('Game should be WAITING for players');
    if (gamePublic1.currentPlayersCount !== 1) throw new Error('Game should have 1 player');

    // Player 2 joins -> should auto start!
    await GameEngineService.joinGame(player2Id, 'Abel', gameId);

    const gamePublic2 = await GameEngineService.getPublicGameState(gameId);
    if (gamePublic2.status !== 'ACTIVE') throw new Error('Game should be ACTIVE after 2nd player joins');

    // Check private states
    const dawitPrivate = await GameEngineService.getPrivateState(gameId, creatorId);
    const abelPrivate = await GameEngineService.getPrivateState(gameId, player2Id);

    if (dawitPrivate.myCards.length !== 5) {
      throw new Error(`Dawit should have 5 cards, got ${dawitPrivate.myCards.length}`);
    }
    if (abelPrivate.myCards.length !== 5) {
      throw new Error(`Abel should have 5 cards, got ${abelPrivate.myCards.length}`);
    }

    // Public state must NOT expose cards or remaining counts
    if ((gamePublic2.players[0] as any).cards || (gamePublic2.players[0] as any).remainingCards) {
      throw new Error('Privacy breach: Public state exposed cards!');
    }
  });

  // 3. Test Authoritative Sinking matching ball & ALL duplicate removal
  await test('Sinking matching ball removes ALL duplicate copies and keeps turn', async () => {
    // Inject deterministic cards for testing
    // Remove current cards for dawit in this game
    const unremoved = memDb.playerCards.filter((c) => c.gameId === gameId && c.userId === 'u-dawit-101');
    for (const c of unremoved) c.isRemoved = true;

    // Give Dawit [4, 4, 8, 11, 13] -> Note duplicate 4s
    const now = new Date().toISOString();
    const testCards: CardValue[] = [4, 4, 8, 11, 13];
    for (const val of testCards) {
      memDb.playerCards.push({
        id: `test-c-${Math.random()}`,
        gameId,
        userId: 'u-dawit-101',
        cardValue: val,
        isRemoved: false,
        isScratchCard: false,
        addedAt: now,
      });
    }

    const state = await GameEngineService.getPublicGameState(gameId);
    if (state.currentTurnUserId !== 'u-dawit-101') {
      throw new Error('Should be Dawit turn');
    }

    // Dawit sinks ball 4
    const shotResult = await GameEngineService.processShot(gameId, 'u-operator-201', 4, false);
    if (shotResult.outcome !== 'MATCH_SUNK') {
      throw new Error(`Expected MATCH_SUNK, got ${shotResult.outcome}`);
    }

    // Check remaining cards for Dawit: should have 3 cards [8, 11, 13] (both 4s removed!)
    const dawitPrivate = await GameEngineService.getPrivateState(gameId, 'u-dawit-101');
    if (dawitPrivate.myCards.length !== 3) {
      throw new Error(`Expected 3 remaining cards, got ${dawitPrivate.myCards.length}: ${JSON.stringify(dawitPrivate.myCards)}`);
    }
    if (dawitPrivate.myCards.includes(4)) {
      throw new Error('All copies of 4 should have been removed!');
    }

    // Turn must stay with Dawit!
    const stateAfter = await GameEngineService.getPublicGameState(gameId);
    if (stateAfter.currentTurnUserId !== 'u-dawit-101') {
      throw new Error('Turn should remain with Dawit after sinking matching ball');
    }
  });

  // 4. Test Sinking non-matching ball changes turn
  await test('Sinking non-matching ball does not remove cards and advances turn to Abel', async () => {
    // Dawit sinks 6 (which is NOT in [8, 11, 13])
    const shotResult = await GameEngineService.processShot(gameId, 'u-operator-201', 6, false);
    if (shotResult.outcome !== 'NON_MATCH_SUNK') {
      throw new Error(`Expected NON_MATCH_SUNK, got ${shotResult.outcome}`);
    }

    // Check Dawit still has 3 cards
    const dawitPrivate = await GameEngineService.getPrivateState(gameId, 'u-dawit-101');
    if (dawitPrivate.myCards.length !== 3) {
      throw new Error('No cards should be removed on non-match');
    }

    // Turn must have passed to Abel!
    const stateAfter = await GameEngineService.getPublicGameState(gameId);
    if (stateAfter.currentTurnUserId !== 'u-abel-102') {
      throw new Error(`Turn should pass to Abel, but is ${stateAfter.currentTurnUserId}`);
    }
  });

  // 5. Test Ball 14 or 15 (normal pool balls)
  await test('Sinking ball 14 or 15 does not remove cards and advances turn', async () => {
    // Abel sinks ball 15
    const abelCardsBefore = (await GameEngineService.getPrivateState(gameId, 'u-abel-102')).myCards.length;
    await GameEngineService.processShot(gameId, 'u-operator-201', 15, false);

    const abelCardsAfter = (await GameEngineService.getPrivateState(gameId, 'u-abel-102')).myCards.length;
    if (abelCardsBefore !== abelCardsAfter) {
      throw new Error('Ball 15 must never remove cards');
    }

    // Turn should pass back to Dawit
    const stateAfter = await GameEngineService.getPublicGameState(gameId);
    if (stateAfter.currentTurnUserId !== 'u-dawit-101') {
      throw new Error('Turn should pass to Dawit');
    }
  });

  // 6. Test Scratch Rule
  await test('Scratch generates 1 random card, adds to private hand, and passes turn', async () => {
    const dawitCardsBefore = (await GameEngineService.getPrivateState(gameId, 'u-dawit-101')).myCards.length;

    // Dawit scratches
    const result = await GameEngineService.processShot(gameId, 'u-operator-201', undefined, true);
    if (result.outcome !== 'SCRATCH') {
      throw new Error(`Expected SCRATCH outcome, got ${result.outcome}`);
    }

    const dawitCardsAfter = (await GameEngineService.getPrivateState(gameId, 'u-dawit-101')).myCards.length;
    if (dawitCardsAfter !== dawitCardsBefore + 1) {
      throw new Error(`Expected ${dawitCardsBefore + 1} cards after scratch, got ${dawitCardsAfter}`);
    }

    // Turn passes to Abel
    const stateAfter = await GameEngineService.getPublicGameState(gameId);
    if (stateAfter.currentTurnUserId !== 'u-abel-102') {
      throw new Error('Turn should pass to Abel on scratch');
    }
  });

  // 7. Test Game Win & Payout on Empty Hand
  await test('Emptying hand immediately wins game and credits winner payout', async () => {
    // Abel sinks his remaining cards until empty
    // Force Abel's hand to have only card [7]
    const unremoved = memDb.playerCards.filter((c) => c.gameId === gameId && c.userId === 'u-abel-102');
    for (const c of unremoved) c.isRemoved = true;

    memDb.playerCards.push({
      id: `test-win-${Math.random()}`,
      gameId,
      userId: 'u-abel-102',
      cardValue: 7,
      isRemoved: false,
      isScratchCard: false,
      addedAt: new Date().toISOString(),
    });

    const abelWalletBefore = await WalletLedgerService.getWallet('u-abel-102');
    const balanceBefore = abelWalletBefore.availableBalance;

    // Abel sinks 7-ball
    const winShot = await GameEngineService.processShot(gameId, 'u-operator-201', 7, false);
    if (winShot.outcome !== 'GAME_WON' || winShot.winnerId !== 'u-abel-102') {
      throw new Error(`Expected GAME_WON with winner Abel, got ${JSON.stringify(winShot)}`);
    }

    const gameFinal = await GameEngineService.getPublicGameState(gameId);
    if (gameFinal.status !== 'COMPLETED') throw new Error('Game should be COMPLETED');
    if (gameFinal.winnerUserId !== 'u-abel-102') throw new Error('Winner should be Abel');

    // Abel should have received payout
    const abelWalletAfter = await WalletLedgerService.getWallet('u-abel-102');
    if (abelWalletAfter.availableBalance <= balanceBefore) {
      throw new Error('Winner wallet was not credited payout');
    }
  });

  // 8. Test Manual Deposit & Withdrawal Ledger
  await test('Manual deposit request and approval updates available balance and ledger', async () => {
    const userId = 'u-yonas-104';
    const initialWallet = await WalletLedgerService.getWallet(userId);
    const initialBal = initialWallet.availableBalance;

    const depId = await WalletLedgerService.requestDeposit(userId, 'Yonas', 250, 'TEL12345678', 'Telebirr');
    const pendingDep = memDb.deposits.get(depId);
    if (!pendingDep || pendingDep.status !== 'PENDING') throw new Error('Deposit should be PENDING');

    // Admin approves
    await WalletLedgerService.approveDeposit(depId, 'u-admin-999');

    const updatedWallet = await WalletLedgerService.getWallet(userId);
    if (updatedWallet.availableBalance !== initialBal + 250) {
      throw new Error(`Expected balance ${initialBal + 250}, got ${updatedWallet.availableBalance}`);
    }
  });

  // 9. Test Manual Withdrawal Lock & Release
  await test('Manual withdrawal locks funds and finalizes on approval', async () => {
    const userId = 'u-yonas-104';
    const walletBefore = await WalletLedgerService.getWallet(userId);
    const availBefore = walletBefore.availableBalance;

    const wdrId = await WalletLedgerService.requestWithdrawal(userId, 'Yonas', 100, '0911223344', 'Yonas G');

    const walletLocked = await WalletLedgerService.getWallet(userId);
    if (walletLocked.availableBalance !== availBefore - 100) {
      throw new Error('Available balance should be reduced by 100');
    }
    if (walletLocked.lockedBalance < 100) {
      throw new Error('Locked balance should have at least 100');
    }

    // Admin confirms paid
    await WalletLedgerService.finalizeWithdrawalPaid(wdrId, 'u-admin-999');

    const walletFinal = await WalletLedgerService.getWallet(userId);
    if (walletFinal.availableBalance !== availBefore - 100) {
      throw new Error('Available balance should remain without locked amount');
    }
    if (walletFinal.lockedBalance !== walletBefore.lockedBalance) {
      throw new Error('Locked balance should be cleared');
    }
  });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
