# Telegram Pool Cards Game Web App

A production-ready **Telegram Mini App** for the popular 5-card physical pool game with real-time table sync, authoritative game referee engine, double-entry wallet ledger, manual Telebirr payment verification, and dedicated Operator and Admin control panels.

---

## 🎱 Core Game Rules

1. **Dealing**: Every player is dealt **5 secret cards** (values $A=1, 2=2, \dots, 10=10, J=11, Q=12, K=13$).
2. **Balls on Physical Pool Table**:
   - Balls **1–13** match the card values ($1=A, 11=J, 12=Q, 13=K$).
   - Balls **14 and 15** are normal pool balls and do not correspond to cards.
3. **Duplicates Advantage**: A player may receive duplicate cards. When that card's ball is sunk on the table, **all duplicate copies** in that player's hand are removed at once.
4. **Authoritative Shot Processing**:
   - **Matching ball sunk**: Matching card(s) removed from current shooter's hand; **shooter keeps turn**.
   - **Non-matching ball or 14/15 sunk**: No cards removed; **turn passes to next player**.
   - **Scratch (Cue ball in pocket / foul)**: Shooter is dealt **1 random secret card** ($1–13$) and **turn passes to next player**.
5. **Win Condition**: The first player to remove all cards from their hand wins the match and receives the prize pot.

---

## 🛡️ Security & Privacy Architecture

- **Authoritative Server Referee**: The server validates all actions and manages game state transitions.
- **Card Privacy**: Private cards are only transmitted to the authenticated owner. Public table feeds never leak card values, card counts, or scratch card identities to opponents.
- **Atomic Double-Entry Ledger**: Financial operations use `BEGIN`/`COMMIT` transactions and row-level locking (`SELECT ... FOR UPDATE`) with idempotency keys.
- **Manual Payment Verification (v1)**: No external payment API is integrated in v1. Deposits and withdrawals are manually verified and approved by admins via Telebirr SMS transaction references.

---

## 🚀 Deployment to Render

### 1. Neon PostgreSQL Setup
1. Create a serverless PostgreSQL database on [Neon](https://neon.tech).
2. Copy your connection string:
   ```
   postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require
   ```
3. The database schema (`server/db/schema.sql`) automatically initializes tables, indexes, and constraints upon server boot.

### 2. Render Blueprint Deploy
1. Push this repository to GitHub or GitLab.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint** and select this repo (uses `render.yaml`).
3. Fill in the environment variables:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `JWT_SECRET`: Random 32+ character string.
   - `TELEGRAM_BOT_TOKEN`: Token obtained from [@BotFather](https://t.me/BotFather).
   - `TELEGRAM_WEBAPP_URL`: Your Render Web Service URL (e.g. `https://pool-cards-app.onrender.com`).

---

## 🤖 Telegram Bot Configuration

1. Open [@BotFather](https://t.me/BotFather) on Telegram and create a new bot (`/newbot`).
2. Set up the Web App button using `/newapp` or `/setmenubutton` and point it to your deployed Render URL.
3. Configure the commands in BotFather:
   ```
   start - Launch Pool Cards Game
   games - Browse live tables & matches
   wallet - Check balance & deposit funds
   help - Read pool cards rules
   ```

---

## 🧪 Automated Testing

Run the test suite to verify card dealing, duplicate elimination, scratch penalties, win logic, and wallet ledger operations:

```bash
npm run test
```
