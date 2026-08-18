/**
 * Telegram Bot for Pool Cards Game
 * Provides /start, /games, /wallet, /help commands and Mini App launch button.
 */

import https from 'https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || 'https://ais-dev-n33cvim2rlnumgt4tz23wb-129409915034.europe-west2.run.app';

if (!BOT_TOKEN) {
  console.log('[BOT] TELEGRAM_BOT_TOKEN is not set. Bot polling will not start automatically.');
  console.log(`[BOT] Configure TELEGRAM_BOT_TOKEN and TELEGRAM_WEBAPP_URL (${WEBAPP_URL}) to enable Telegram bot.`);
} else {
  console.log(`[BOT] Telegram bot initializing with WebApp URL: ${WEBAPP_URL}`);
  startPolling();
}

async function sendTelegramRequest(method: string, payload: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ ok: false, error: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

let offset = 0;
async function startPolling() {
  console.log('[BOT] Polling for Telegram updates started...');
  while (true) {
    try {
      const response = await sendTelegramRequest('getUpdates', {
        offset,
        timeout: 30,
      });

      if (response && response.ok && Array.isArray(response.result)) {
        for (const update of response.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      }
    } catch (err) {
      console.error('[BOT] Polling error:', err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function handleUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name || 'Player';

  if (text.startsWith('/start')) {
    await sendTelegramRequest('sendMessage', {
      chat_id: chatId,
      text: `🎱 *Welcome to Telegram Pool Cards Game, ${firstName}!* \n\nPlay the authentic 5-card pool game with your friends directly on physical pool tables.\n\n• Ball 1–13 sinks match cards (A–K)\n• Duplicate cards are cleared in one shot\n• Scratch adds 1 private penalty card\n• First to clear all cards wins the pot!`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎱 Open Pool Cards Game',
              web_app: { url: WEBAPP_URL },
            },
          ],
          [
            {
              text: '💳 My Wallet',
              callback_data: 'cmd_wallet',
            },
            {
              text: '📜 Game Rules',
              callback_data: 'cmd_help',
            },
          ],
        ],
      },
    });
  } else if (text.startsWith('/games')) {
    await sendTelegramRequest('sendMessage', {
      chat_id: chatId,
      text: '🎱 *Live Pool Tables*\n\nTap below to browse active tables or host a new match with custom entry fees.',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎱 Browse & Join Games',
              web_app: { url: `${WEBAPP_URL}?tab=games` },
            },
          ],
        ],
      },
    });
  } else if (text.startsWith('/wallet')) {
    await sendTelegramRequest('sendMessage', {
      chat_id: chatId,
      text: '💳 *Pool Cards Wallet*\n\nDeposit funds via Telebirr or check your transaction history.',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '💳 Open Wallet',
              web_app: { url: `${WEBAPP_URL}?tab=wallet` },
            },
          ],
        ],
      },
    });
  } else if (text.startsWith('/help')) {
    await sendTelegramRequest('sendMessage', {
      chat_id: chatId,
      text: `📖 *Pool Cards Rules & Quick Guide*\n\n1. Every player receives 5 secret cards (A to K).\n2. Pool balls 1–13 match the card values (1=A, 11=J, 12=Q, 13=K).\n3. When you sink a ball that matches your card, ALL duplicate copies of that card are removed at once, and you keep your turn!\n4. If you scratch, you receive 1 random penalty card and your turn ends.\n5. The first player to empty their hand wins the entire pot!`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎱 Play Now',
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      },
    });
  }
}
