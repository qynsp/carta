import { GameEventPublic, GameEventType } from '../types';
import { Language } from '../context/LanguageContext';

/**
 * Translates and formats authoritative game events into either English or Amharic
 * with rich formatting, icons, and contextual terminology.
 */
export function translateGameEvent(
  event: GameEventPublic | undefined | null,
  language: Language
): string {
  if (!event || !event.message) {
    return language === 'am' ? 'እስካሁን ምንም ክስተት አልተመዘገበም' : 'No game events recorded yet.';
  }

  if (language === 'en') {
    return event.message;
  }

  const rawMsg = event.message;
  const type = event.type;
  const ball = event.ballNumber;

  // 1. Ready Status Events
  // Format: "🟢 {PlayerName} is READY! ({X}/{Y} ready)"
  const readyMatch = rawMsg.match(/(?:🟢\s*)?(.+?)\s+is\s+READY!?(?:\s*\(([0-9]+)\/([0-9]+)\s*ready\))?/i);
  if (type === 'PLAYER_READY' || (readyMatch && !rawMsg.includes('NOT ready'))) {
    if (readyMatch) {
      const name = readyMatch[1].trim();
      const readyNum = readyMatch[2];
      const totalNum = readyMatch[3];
      if (readyNum && totalNum) {
        return `🟢 ${name} ዝግጁ ነው! (${readyNum}/${totalNum} ተዘጋጅተዋል)`;
      }
      return `🟢 ${name} ዝግጁ ነው!`;
    }
    return `🟢 ተጫዋች ዝግጁ መሆኑን አረጋግጧል!`;
  }

  // Format: "⏳ {PlayerName} is NOT ready ({X}/{Y} ready)"
  const notReadyMatch = rawMsg.match(/(?:⏳\s*)?(.+?)\s+is\s+NOT\s+ready(?:\s*\(([0-9]+)\/([0-9]+)\s*ready\))?/i);
  if (type === 'PLAYER_NOT_READY' || notReadyMatch) {
    if (notReadyMatch) {
      const name = notReadyMatch[1].trim();
      const readyNum = notReadyMatch[2];
      const totalNum = notReadyMatch[3];
      if (readyNum && totalNum) {
        return `⏳ ${name} አልተዘጋጀም (${readyNum}/${totalNum} ተዘጋጅተዋል)`;
      }
      return `⏳ ${name} ገና አልተዘጋጀም`;
    }
    return `⏳ ተጫዋች ገና አልተዘጋጀም`;
  }

  // 2. Game Started
  // Format: "Game started with X players! 5 cards dealt to each. PlayerName's turn to shoot."
  const startMatch = rawMsg.match(/Game started with (\d+) players! 5 cards dealt to each\.\s*(.+?)'s turn to shoot\./i);
  if (type === 'GAME_STARTED' || startMatch) {
    if (startMatch) {
      const count = startMatch[1];
      const shooter = startMatch[2].trim();
      return `⚡ ጨዋታው በ ${count} ተጫዋቾች ተጀምሯል! ለእያንዳንዱ 5 ካርዶች ተሰጥተዋል። የ ${shooter} የመምታት ተራ ነው።`;
    }
    return `⚡ ጨዋታው ተጀምሯል! ለእያንዳንዱ ተጫዋች 5 ካርዶች ተሰጥተዋል።`;
  }

  // 3. Scratch / Foul
  // Format: "⚠️ PlayerName scratched. Turn passes to NextPlayer."
  const scratchMatch = rawMsg.match(/(?:⚠️\s*)?(.+?)\s+scratched\.\s*Turn passes to\s+(.+?)\./i);
  if (type === 'SCRATCH' || scratchMatch) {
    if (scratchMatch) {
      const shooter = scratchMatch[1].trim();
      const nextShooter = scratchMatch[2].trim();
      return `⚠️ ${shooter} ፎል/ስክራች ሰርቷል (+1 ቅጣት ካርድ)። ተራ ወደ ${nextShooter} አለፈ።`;
    }
    return `⚠️ ፎል/ስክራች ተሰርቷል (+1 ቅጣት ካርድ)። ተራ አለፈ።`;
  }

  // 4. Missed Shot / Pass Turn
  // Format: "🎯 PlayerName missed their shot. Turn passes to NextPlayer."
  const missMatch = rawMsg.match(/(?:🎯\s*)?(.+?)\s+missed their shot\.\s*Turn passes to\s+(.+?)\./i);
  if (type === 'TURN_PASSED' || missMatch) {
    if (missMatch) {
      const shooter = missMatch[1].trim();
      const nextShooter = missMatch[2].trim();
      return `🎯 ${shooter} ምት አምልጦታል (ተራ አለፈ)። ተራ ወደ ${nextShooter} አለፈ።`;
    }
    return `🎯 ምት አምልጧል (ተራ አለፈ)።`;
  }

  // 5. Game Won
  // Format: "🏆 PlayerName sank the X-ball and won the game!"
  const wonMatch = rawMsg.match(/(?:🏆\s*)?(.+?)\s+sank the (\d+)-ball and won the game!/i);
  if (type === 'GAME_WON' || wonMatch) {
    if (wonMatch) {
      const winner = wonMatch[1].trim();
      const ballNum = wonMatch[2];
      return `🏆 ${winner} ኳስ #${ballNum} አስገብቶ ሁሉንም ካርዶች በመጨረስ አሸንፏል!`;
    }
    return `🏆 ጨዋታው ተጠናቋል! አሸናፊው ሁሉንም ካርዶች ጨርሷል!`;
  }

  // 6. Neutral Ball Sunk (14 or 15)
  // Format: "🎱 PlayerName sank neutral X-ball! Turn continues."
  const neutralMatch = rawMsg.match(/(?:🎱\s*)?(.+?)\s+sank neutral (\d+)-ball! Turn continues\./i);
  if (neutralMatch) {
    const shooter = neutralMatch[1].trim();
    const ballNum = neutralMatch[2];
    return `🎱 ${shooter} ገለልተኛውን ኳስ #${ballNum} አስገብቷል! ተራው ይቀጥላል።`;
  }

  // 7. Matching Ball Sunk (Keep turn)
  // Format: "🎱 PlayerName sank the X-ball! Turn continues."
  const matchSunk = rawMsg.match(/(?:🎱\s*)?(.+?)\s+sank the (\d+)-ball! Turn continues\./i);
  if (matchSunk) {
    const shooter = matchSunk[1].trim();
    const ballNum = matchSunk[2];
    return `🎱 ${shooter} የካርዱን ኳስ #${ballNum} አስገብቷል! ተራው ይቀጥላል።`;
  }

  // 8. Non-matching Ball Sunk (Turn passes)
  // Format: "🎱 PlayerName sank the X-ball (no card match). Turn passes to NextPlayer."
  const nonMatchSunk = rawMsg.match(/(?:🎱\s*)?(.+?)\s+sank the (\d+)-ball\s*\(no card match\)\.\s*Turn passes to\s+(.+?)\./i);
  if (nonMatchSunk) {
    const shooter = nonMatchSunk[1].trim();
    const ballNum = nonMatchSunk[2];
    const nextShooter = nonMatchSunk[3].trim();
    return `🎱 ${shooter} ኳስ #${ballNum} አስገብቷል (ካርድ የለም)። ተራ ወደ ${nextShooter} አለፈ።`;
  }

  // 9. Player Joined
  // Format: "PlayerName joined the game" / "PlayerName joined the match"
  const joinMatch = rawMsg.match(/(?:👋\s*)?(.+?)\s+joined(?: the (?:game|match|table))?/i);
  if (type === 'PLAYER_JOINED' || joinMatch) {
    if (joinMatch) {
      const name = joinMatch[1].trim();
      return `👋 ${name} ጨዋታውን ተቀላቅሏል።`;
    }
    return `👋 አዲስ ተጫዋች ጨዋታውን ተቀላቅሏል።`;
  }

  // 10. Disband / Refund Votes (ይፍረስ)
  // Format: "⚠️ PlayerName voted to disband & refund the game (ይፍረስ) [X/Y votes]."
  const disbandVoteMatch = rawMsg.match(/(?:⚠️\s*)?(.+?)\s+voted to disband & refund the game \(ይፍረስ\)\s*\[(\d+)\/(\d+)\s*votes\]/i);
  if (disbandVoteMatch) {
    const name = disbandVoteMatch[1].trim();
    const votes = disbandVoteMatch[2];
    const total = disbandVoteMatch[3];
    return `⚠️ ${name} ጨዋታው እንዲፈርስ እና ብር ተመላሽ እንዲሆን ድምጽ ሰጥቷል (ይፍረስ) [${votes}/${total} ድምጽ]`;
  }

  // Format: "ℹ️ PlayerName cancelled their disband vote [X/Y votes]."
  const cancelDisbandVoteMatch = rawMsg.match(/(?:ℹ️\s*)?(.+?)\s+cancelled their disband vote\s*\[(\d+)\/(\d+)\s*votes\]/i);
  if (cancelDisbandVoteMatch) {
    const name = cancelDisbandVoteMatch[1].trim();
    const votes = cancelDisbandVoteMatch[2];
    const total = cancelDisbandVoteMatch[3];
    return `ℹ️ ${name} የይፍረስ ድምፁን አንስቷል [${votes}/${total} ድምጽ]`;
  }

  // 11. Game Disbanded / Cancelled (Unanimous / Admin)
  // Format: "❌ Game disbanded by unanimous agreement of all players (ይፍረስ). All X player(s) received a full refund of Y ETB."
  const unanimousDisbandMatch = rawMsg.match(/Game disbanded by unanimous agreement of all players \(ይፍረስ\)\.\s*All (\d+) player\(s\) received a full refund of ([\d.]+) ETB\./i);
  if (unanimousDisbandMatch) {
    const count = unanimousDisbandMatch[1];
    const fee = unanimousDisbandMatch[2];
    return `❌ ሁሉም ${count} ተጫዋቾች 'ይፍረስ' ብለው በመስማማታቸው ጨዋታው ተሰርዟል፤ ለእያንዳንዱ ተጫዋች ${fee} ብር ሙሉ ተመላሽ ተደርጓል።`;
  }

  if (type === 'GAME_CANCELLED' || type === 'GAME_DISBANDED') {
    if (rawMsg.includes('ይፍረስ')) {
      return '❌ ጨዋታው በሁሉም ተጫዋቾች ስምምነት ፈርሷል (ይፍረስ)፤ ክፍያው ሙሉ በሙሉ ተመላሽ ተደርጓል።';
    }
    return '❌ ጨዋታው ተሰርዞ የመግቢያ ክፍያው ተመላሽ ተደርጓል።';
  }

  // 12. Game Created
  if (type === 'GAME_CREATED') {
    return '🎮 አዲስ የፑል ጠረጴዛ ተፈጥሯል። ተጫዋቾች እየተጠበቁ ነው።';
  }

  // 13. End Game Verification & Anti-Manipulation Events
  if (type === 'END_GAME_VOTE') {
    if (rawMsg.includes('confirmed the match as fair')) {
      const match = rawMsg.match(/(?:✅\s*)?(.+?)\s+confirmed the match as fair\s*\[(\d+)\/(\d+)\s*confirmed\]/i);
      if (match) {
        return `✅ ${match[1].trim()} ጨዋታው ትክክለኛ መሆኑን አረጋግጧል [${match[2]}/${match[3]} አረጋግጠዋል]`;
      }
      return `✅ ተጫዋች ጨዋታው ትክክለኛ መሆኑን አረጋግጧል።`;
    }
    if (rawMsg.includes('reported the match as manipulated')) {
      const match = rawMsg.match(/(?:🚨\s*)?(.+?)\s+reported the match as manipulated\s*\[(\d+)\/(\d+)\s*reports\]/i);
      if (match) {
        return `🚨 ${match[1].trim()} ጨዋታው ተጭበርብሯል ብሎ ሪፖርት አድርጓል [${match[2]}/${match[3]} ሪፖርት አድርገዋል]`;
      }
      return `🚨 ተጫዋች ጨዋታው ተጭበርብሯል ብሎ ሪፖርት አድርጓል።`;
    }
  }

  if (type === 'GAME_VERIFIED') {
    return '✅ ጨዋታው በ 50%+ ተጫዋቾች ስምምነት ትክክለኛ መሆኑ ተረጋግጦ ጸድቋል፤ የሽልማት ገንዘቡ ለአሸናፊው ተከፍሏል!';
  }

  if (type === 'GAME_MANIPULATED_REFUND') {
    return '🚨 ጨዋታው በማጭበርበር ምክንያት በአብዛኛው ተጫዋች ድምጽ ተሰርዟል፤ የሁሉም ተጫዋቾች የመግቢያ ክፍያ 100% ተመላሽ ተደርጓል!';
  }

  // Fallback direct keyword translations
  let translated = rawMsg;
  translated = translated.replace(/Turn passes to/gi, 'ተራ ወደ');
  translated = translated.replace(/Turn continues/gi, 'ተራው ይቀጥላል');
  translated = translated.replace(/sank the/gi, 'አስገብቷል ኳስ');
  translated = translated.replace(/sank neutral/gi, 'ገለልተኛ አስገብቷል');
  translated = translated.replace(/scratched/gi, 'ስክራች/ፎል ሰርቷል');
  translated = translated.replace(/missed their shot/gi, 'ምት አምልጦታል');
  translated = translated.replace(/won the game/gi, 'ጨዋታውን አሸንፏል');
  translated = translated.replace(/is READY/gi, 'ዝግጁ ነው');
  translated = translated.replace(/is NOT ready/gi, 'ገና አልተዘጋጀም');

  return translated;
}

/**
 * Returns a styling theme or icon for each game event type
 */
export function getGameEventStyle(type: GameEventType | undefined) {
  switch (type) {
    case 'GAME_WON':
      return {
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-500/50',
        badgeText: 'text-amber-300',
        icon: '🏆',
        glow: 'shadow-amber-500/20',
      };
    case 'SCRATCH':
      return {
        badgeBg: 'bg-rose-500/20',
        badgeBorder: 'border-rose-500/50',
        badgeText: 'text-rose-300',
        icon: '⚠️',
        glow: 'shadow-rose-500/20',
      };
    case 'TURN_PASSED':
      return {
        badgeBg: 'bg-blue-500/20',
        badgeBorder: 'border-blue-500/50',
        badgeText: 'text-blue-300',
        icon: '🎯',
        glow: '',
      };
    case 'PLAYER_READY':
      return {
        badgeBg: 'bg-emerald-500/20',
        badgeBorder: 'border-emerald-500/50',
        badgeText: 'text-emerald-300',
        icon: '🟢',
        glow: 'shadow-emerald-500/20',
      };
    case 'PLAYER_NOT_READY':
      return {
        badgeBg: 'bg-zinc-800/80',
        badgeBorder: 'border-zinc-700',
        badgeText: 'text-zinc-400',
        icon: '⏳',
        glow: '',
      };
    case 'GAME_STARTED':
      return {
        badgeBg: 'bg-emerald-500/20',
        badgeBorder: 'border-emerald-500/50',
        badgeText: 'text-emerald-300',
        icon: '⚡',
        glow: 'shadow-emerald-500/20',
      };
    case 'DISBAND_VOTE':
      return {
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-500/50',
        badgeText: 'text-amber-300',
        icon: '⚠️',
        glow: 'shadow-amber-500/20',
      };
    case 'GAME_CANCELLED':
    case 'GAME_DISBANDED':
      return {
        badgeBg: 'bg-rose-500/20',
        badgeBorder: 'border-rose-500/50',
        badgeText: 'text-rose-300',
        icon: '❌',
        glow: 'shadow-rose-500/20',
      };
    case 'END_GAME_VOTE':
      return {
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-500/50',
        badgeText: 'text-amber-300',
        icon: '🗳️',
        glow: 'shadow-amber-500/20',
      };
    case 'GAME_VERIFIED':
      return {
        badgeBg: 'bg-emerald-500/20',
        badgeBorder: 'border-emerald-500/50',
        badgeText: 'text-emerald-300',
        icon: '✅',
        glow: 'shadow-emerald-500/20',
      };
    case 'GAME_MANIPULATED_REFUND':
      return {
        badgeBg: 'bg-rose-500/20',
        badgeBorder: 'border-rose-500/50',
        badgeText: 'text-rose-300',
        icon: '🚨',
        glow: 'shadow-rose-500/20',
      };
    case 'BALL_SUNK':
    default:
      return {
        badgeBg: 'bg-emerald-500/10',
        badgeBorder: 'border-emerald-500/30',
        badgeText: 'text-emerald-400',
        icon: '🎱',
        glow: '',
      };
  }
}
