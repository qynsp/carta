import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'am';

interface Translations {
  [key: string]: {
    en: string;
    am: string;
  };
}

export const DICTIONARY: Translations = {
  // Navigation & Header
  appTitle: { en: 'POOL CARDS', am: 'ፑል ካርድ' },
  wallet: { en: 'Money', am: 'ገንዘብ' },
  games: { en: 'Games', am: 'ጨዋታዎች' },
  leaderboard: { en: 'Ranks', am: 'ደረጃዎች' },
  profile: { en: 'Profile', am: 'ፕሮፋይል' },
  operator: { en: 'Keypad', am: 'ጠረጴዛ መቆጣጠሪያ' },
  admin: { en: 'Admin', am: 'አስተዳዳሪ' },
  rules: { en: 'Rules', am: 'ህግጋት' },
  soundOn: { en: 'Sound On', am: 'ድምፅ በርቷል' },
  soundOff: { en: 'Sound Muted', am: 'ድምፅ ጠፍቷል' },
  xpProgress: { en: 'XP PROGRESS', am: 'የልምድ ነጥብ (XP)' },
  winStreak: { en: 'STREAK', am: 'የተከታታይ ድል' },

  // Level Titles
  levelRookie: { en: 'Rookie', am: 'ጀማሪ ተጫዋች' },
  levelClubPlayer: { en: 'Club Player', am: 'የክለብ ተጫዋች 🎱' },
  levelHustler: { en: 'Hustler 🎱', am: 'ብልህ አጥቂ 🎱' },
  levelCueShark: { en: 'Cue Shark 🦈', am: 'የፑል ሻርክ 🦈' },
  levelGrandmaster: { en: 'Grandmaster 👑', am: 'የጠረጴዛው ንጉሥ 👑' },

  // Game Lobby & Actions
  activeGames: { en: 'Pool Tables', am: 'የፑል ጠረጴዛዎች' },
  activeGamesDesc: { en: 'Tap a table to view match or join', am: 'ለመጫወት ወይም ለማየት ጠረጴዛ ይምረጡ' },
  createMatch: { en: '+ Create Game', am: '+ አዲስ ጨዋታ ፍጠር' },
  joinGame: { en: 'Play Now', am: 'አሁን ተጫወት' },
  spectate: { en: 'Watch Match', am: 'ተመልከት' },
  entryFee: { en: 'Entry', am: 'መግቢያ' },
  prizePot: { en: 'Winner Gets', am: 'የአሸናፊ ሽልማት' },
  players: { en: 'Players', am: 'ተጫዋቾች' },
  table: { en: 'Table', am: 'ጠረጴዛ' },
  openTables: { en: 'Open Tables', am: 'ክፍት ጠረጴዛዎች' },
  noActiveTables: { en: 'No active tables at the moment', am: 'በአሁኑ ሰዓት ክፍት ጠረጴዛ የለም' },
  createFirstTable: { en: 'Create First Table', am: 'የመጀመሪያውን ጠረጴዛ ክፈት' },

  // In-Game
  yourTurn: { en: '🟢 YOUR TURN! SHOOT NOW!', am: '🟢 ተራህ ነው! አሁን ምታ!' },
  otherTurn: { en: 'is shooting...', am: 'እየመታ(ች) ነው...' },
  waitingLobby: { en: 'Waiting for players to join...', am: 'ተጫዋቾች እስኪገቡ እየተጠበቀ ነው...' },
  startMatchNow: { en: '⚡ START MATCH NOW', am: '⚡ አሁን ጨዋታውን ጀምር' },
  minPlayersNotice: { en: 'Waiting for players... (Needs 2+ players to start)', am: 'ተጫዋቾች እየተጠበቁ ነው... (ለመጀመር ቢያንስ 2 ተጫዋች ያስፈልጋል)' },
  openTableInfo: { en: 'Open Table: Players can join freely. Pot grows with each player!', am: 'ክፍት ጠረጴዛ፡ ተጫዋቾች በፈለጉት መጠን መግባት ይችላሉ። የሽልማት መጠኑ በተጫዋቾች ቁጥር ይጨምራል!' },
  potGrows: { en: 'Prize increases with every joined player!', am: 'ተጫዋቾች በተቀላቀሉ ቁጥር የሽልማት መጠኑ ይጨምራል!' },
  matchEnded: { en: 'Match Finished!', am: 'ጨዋታው ተጠናቋል!' },
  youWon: { en: '🏆 YOU WON THE MATCH!', am: '🏆 አሸንፈሃል! እንኳን ደስ አለህ!' },
  winnerWas: { en: 'Winner:', am: 'አሸናፊ፡' },
  secretCards: { en: 'YOUR CARDS', am: 'የእጅህ ካርዶች' },
  sinkBallToClear: { en: 'Sink this ball on table to clear card:', am: 'ይህቺን ኳስ አስገብተህ ካርድህን ጨርስ፡' },
  duplicateBonus: { en: 'Duplicate cards: Sinking this ball clears ALL copies at once!', am: 'ተመሳሳይ ካርዶች አሉህ፡ ኳሷ ከገባች ሁሉም በአንድ ጊዜ ይጠፋሉ!' },
  remainingCards: { en: 'cards left', am: 'የቀሩ ካርዶች' },
  backToLobby: { en: '← Back to Tables', am: '← ወደ ጠረጴዛዎች ተመለስ' },
  ballsOnTable: { en: 'Balls on Table', am: 'በጠረጴዛው ላይ ያሉ ኳሶች' },
  liveFeed: { en: 'Live Game Events', am: 'የጨዋታው ክስተቶች (Live Feed)' },
  eventHistory: { en: 'Event History', am: 'ያለፉ ክስተቶች ታሪክ' },
  latestEvent: { en: 'Latest Event', am: 'የመጨረሻው ክስተት' },
  viewAllEvents: { en: 'View Event History', am: 'ያለፉትን ክስተቶች ይመልከቱ' },
  hideAllEvents: { en: 'Hide History', am: 'ታሪክን ደብቅ' },
  noEventsYet: { en: 'No shots recorded yet on this table.', am: 'እስካሁን ምንም ኳስ አልተመታም' },

  // Card Draw & Dealing
  dealingCards: { en: 'Dealing your secret cards...', am: 'ሚስጥር ካርዶችህ እየታደሉ ነው...' },
  cardsReady: { en: 'All cards dealt! Ready to shoot.', am: 'ሁሉም ካርዶች ተዘጋጅተዋል! ኳሶችን ምታ።' },
  replayDeal: { en: 'Replay Deal', am: 'አደላደሉን ድገም' },
  penaltyCardDrawn: { en: '⚠️ Foul Penalty! +1 card drawn.', am: '⚠️ ፎል! +1 ካርድ ተጨምሯል።' },

  // Disband / ይፍረስ Feature
  disbandTitle: { en: 'Disband Table / Refund (ይፍረስ)', am: 'ጨዋታው ይፍረስ / ተመላሽ (ይፍረስ)' },
  disbandPrompt: {
    en: 'If ALL joined players agree to disband (ይፍረስ), the match cancels immediately and 100% of entry fees are refunded back to your wallet.',
    am: 'ሁሉም ተጫዋቾች "ይፍረስ" ብለው ድምጽ ከሰጡ ጨዋታው ወዲያውኑ ይሰረዛል፤ የሁላችሁም የመግቢያ ክፍያ 100% ወደ ዋሌታችሁ ተመላሽ ይሆናል።',
  },
  voteDisband: { en: 'Vote to Disband / Refund (ይፍረስ)', am: 'ጨዋታው እንዲፈርስ ምረጥ (ይፍረስ)' },
  cancelDisbandVote: { en: 'Cancel Disband Vote', am: 'የይፍረስ ምርጫህን አንሳ' },
  votedDisbandBadge: { en: 'Voted Disband (ይፍረስ)', am: 'ይፍረስ ብሏል' },
  disbandProgress: { en: 'Disband Agreement', am: 'የይፍረስ ስምምነት' },
  disbandSuccessToast: { en: 'Game Disbanded! All entry fees have been fully refunded.', am: 'ጨዋታው ፈርሷል! የመግቢያ ክፍያው ለሁሉም ተጫዋቾች ተመላሽ ተደርጓል።' },

  // Match Verification & Anti-Manipulation Protection
  matchVerification: { en: 'Match Audit & Verification', am: 'የጨዋታው ማረጋገጫና ኦዲት' },
  antiManipulationNotice: {
    en: 'Anti-Manipulation Protection: At least 50% of joined players must confirm the match was played fairly. If majority reports manipulation, all players receive an immediate 100% refund!',
    am: 'ማጭበርበርን ለመከላከል፡ ቢያንስ 50% ተጫዋቾች ጨዋታው ትክክለኛ መሆኑን ማረጋገጥ አለባቸው። አብዛኛው ተጫዋች "ተጭበርብሯል" ካለ የሁሉም ተጫዋቾች ገንዘብ 100% ወዲያውኑ ይመለሳል!',
  },
  sunkBallsChronological: { en: 'Sank Balls Chronological Audit', am: 'በጨዋታው የገቡ ኳሶች ቅደም ተከተል' },
  winnerHandAudit: { en: "Winner's Secret Cards Verification", am: 'የአሸናፊው ሚስጥር ካርዶች ማረጋገጫ' },
  confirmFairGame: { en: '✅ Confirm Fair Game', am: '✅ ትክክለኛ ጨዋታ ነው አረጋግጥ' },
  reportManipulated: { en: '🚨 Report Manipulated & Refund', am: '🚨 ተጭበርብሯል (ይፍረስና ይመለስ)' },
  verifiedBadge: { en: 'Official Fair Match Verified', am: 'በስምምነት ጸድቋል - ገንዘቡ ተከፍሏል' },
  manipulatedBadge: { en: 'Manipulated Match - Full Refund Disbursed', am: 'በማጭበርበር የተሰረዘ - 100% ተመላሽ ተደርጓል' },
  yourVoteRecorded: { en: 'Your vote has been submitted', am: 'ምርጫዎ ተመዝግቧል' },
  waitingForVotes: { en: 'Awaiting player verification (50% needed)', am: 'የተጫዋቾች ማረጋገጫ በመጠበቅ ላይ (50% ያስፈልጋል)' },
  confirmedVotesLabel: { en: 'Confirmed Fair', am: 'ትክክለኛ ነው ያሉት' },
  manipulatedVotesLabel: { en: 'Reported Manipulated', am: 'ተጭበርብሯል ያሉት' },

  // Wallet
  addMoney: { en: '+ Add Money (Deposit)', am: '+ ብር አስገባ (Deposit)' },
  withdrawMoney: { en: '↑ Get Money (Withdraw)', am: '↑ ብር አውጣ (Withdraw)' },
  availableMoney: { en: 'Your Balance', am: 'ያለዎት ቀሪ ገንዘብ' },
  quickAmount: { en: 'Quick Amount', am: 'ፈጣን ምርጫ' },
  telebirrNumber: { en: 'Send Telebirr to this Number', am: 'በዚህ የቴሌብር ቁጥር ይላኩ' },
  telebirrPhonePrompt: { en: 'Your Telebirr Phone Number', am: 'የእርስዎ ቴሌብር ስልክ ቁጥር' },
  transactionCode: { en: 'Telebirr SMS Code / Transaction ID', am: 'የደረሰዎት የቴሌብር ሚስጥር ቁጥር (SMS Code)' },
  copy: { en: 'Copy Number', am: 'ቁጥሩን ኮፒ አድርግ' },
  copied: { en: 'Copied!', am: 'ኮፒ ተደርጓል!' },
  submitDeposit: { en: 'Confirm Deposit', am: 'ገንዘብ ማስገባቱን አረጋግጥ' },
  submitWithdraw: { en: 'Send Money to My Telebirr', am: 'ገንዘቡን ወደ ቴሌብሬ ላክ' },
  depositNote: { en: 'Send money to Telebirr, then type the SMS code here. Admin will credit your account instantly.', am: 'ቴሌብር ላይ ብር ይላኩና የደረሰዎትን ኮድ እዚህ ይፃፉ። ፈጥኖ ወደ አካውንትዎ ይገባል።' },
  recentTransactions: { en: 'Recent Transactions', am: 'የቅርብ ጊዜ የገንዘብ ዝውውሮች' },
  noTransactions: { en: 'No transactions yet', am: 'ምንም የገንዘብ ዝውውር የለም' },

  // Profile & Stats
  myStats: { en: 'My Stats', am: 'የእኔ ውጤቶች' },
  totalGames: { en: 'Total Games', am: 'የተጫወቱት ጨዋታ' },
  gamesWon: { en: 'Games Won', am: 'ያሸነፉት ጨዋታ' },
  winRate: { en: 'Win Rate', am: 'የማሸነፍ መጠን' },
  totalEarned: { en: 'Total Earned', am: 'ያገኙት ጠቅላላ ገቢ' },
  editProfile: { en: 'Edit Profile', am: 'ፕሮፋይል አስተካክል' },
  saveProfile: { en: 'Save Name', am: 'ስምህን መዝግብ' },
  fullName: { en: 'Full Name / Nickname', am: 'ሙሉ ስም / ቅጽል ስም' },
  username: { en: 'Telegram Username', am: 'ቴሌግራም ዩዘርኔም' },

  // Leaderboard
  rank: { en: 'Rank', am: 'ደረጃ' },
  player: { en: 'Player', am: 'ተጫዋች' },
  wins: { en: 'Wins', am: 'ድሎች' },
  earnings: { en: 'Winnings', am: 'ያሸነፈው' },
  topPlayers: { en: 'Top Champions', am: 'የሳምንቱ ምርጥ ተጫዋቾች' },

  // Rules
  howToPlay: { en: 'How to Play (Very Easy!)', am: 'አጨዋወት (በጣም ቀላል!)' },
  rule1: { en: '1. You receive 5 secret cards on your phone.', am: '1. ስልክህ ላይ 5 ካርዶች ይታዩሃል።' },
  rule2: { en: '2. Look at the ball numbers on your cards and sink them on the real pool table.', am: '2. ካርዶችህ ላይ የተጻፉትን የኳስ ቁጥሮች ጠረጴዛው ላይ ምታና አስገባ።' },
  rule3: { en: '3. If you sink your ball, that card disappears and you shoot again!', am: '3. ኳሷ ከገባች ካርድህ ይጠፋል፡ ድጋሚ የመምታት እድል ታገኛለህ!' },
  rule4: { en: '4. First player to clear all 5 cards wins the entire money pot!', am: '4. ሁሉንም 5 ካርዶች ቀድሞ የጨረሰ ተጫዋች ሙሉውን ገንዘብ ያሸንፋል!' },
  ruleGotIt: { en: 'Got it, Let\'s Play!', am: 'ገባኝ፣ እንጫወት!' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'am',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('pool_lang');
    return (saved === 'am' || saved === 'en') ? saved : 'am';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('pool_lang', lang);
  };

  const t = (key: string): string => {
    if (DICTIONARY[key]) {
      return DICTIONARY[key][language] || DICTIONARY[key].am || DICTIONARY[key].en;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
