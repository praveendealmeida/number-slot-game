# Number Slot Game

A mobile-first 100-slot number game built with **Next.js (App Router)**, **Prisma 7** (driver-adapter on PostgreSQL), **React 19**, **Tailwind CSS v4**, and **Auth.js v5** (Google sign-in).

Each game session has 100 slots (numbers `00`–`99`). Players sign in with Google and buy slots; once all 100 sell (or an admin closes the game), an admin draws a winning number. The holder of the winning slot takes a configurable share of the pot; the platform keeps the rest. Purchases are concurrency-safe — they run inside a `Serializable` transaction with a `SELECT … FOR UPDATE` row lock on the game, plus a unique `(gameId, slotNumber)` constraint as a final guard.

## Stack

| Concern   | Choice                                                                 |
| --------- | --------------------------------------------------------------------- |
| Framework | Next.js App Router (route handlers + client pages)                    |
| DB / ORM  | PostgreSQL via Prisma 7 `prisma-client` generator + `@prisma/adapter-pg` |
| Auth      | Google OAuth via Auth.js v5 (`next-auth`) with the Prisma adapter      |
| UI        | Tailwind CSS v4, Geist font                                           |
| Payments  | Placeholder — `src/lib/payment.ts` always succeeds (swap in a real gateway) |

## Payout model

Each game has a `payoutPercent` (default **80**). When the drawn number has a holder, that winner receives `floor(pool × payoutPercent / 100)` and the platform keeps the rest. When the drawn number is unsold, there is no winner and **the whole pool stays with the platform** (no refunds). Admins set the percentage per game on creation.

## Getting started

### 1. Install

```bash
npm install
```

`postinstall` runs `prisma generate`, regenerating `src/generated/prisma`.

### 2. Configure environment

```bash
cp .env.example .env
```

Then fill in `.env`:

- **`DATABASE_URL`** — a PostgreSQL connection string. Prisma 7 reads this through `prisma.config.ts` for CLI commands; the app connects through the driver adapter in `src/lib/db.ts`.
- **`AUTH_SECRET`** — generate one with `npx auth secret` (or `openssl rand -base64 32`).
- **`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`** — from a Google OAuth client (next step).
- **`ADMIN_EMAIL`** — the first user who signs in with this email is auto-promoted to `ADMIN`.

### 3. Create a Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → **Create OAuth client ID** → **Web application**. Add authorized redirect URIs:

- Dev: `http://localhost:3000/api/auth/callback/google`
- Prod: `https://YOUR-DOMAIN/api/auth/callback/google`

Copy the client ID and secret into `.env`.

### 4. Create the schema and seed sample games

```bash
npm run db:push     # pushes schema.prisma to the database
npm run db:seed     # creates 3 sample games (no users — those come from sign-in)
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000, click **Sign in with Google**. Sign in with your `ADMIN_EMAIL` account to get the Admin tab.

## How to use it

- **Lobby (`/`)** — games grouped by price tier. Sign-in lives in the bar at the top.
- **Game board (`/games/[gameId]`)** — the 10×10 slot grid; tap free numbers, then buy. The board shows the winner's payout share and polls every 4s so you see other buyers in near-real-time.
- **Profile (`/profile`)** — your tickets and win/loss history (requires sign-in).
- **Admin (`/admin`)** — visible only to `ADMIN` users. Create games (set ticket price + payout %), close them, enter the winning number, and view per-game finances. Games auto-close when all 100 slots sell.

## Project layout

```
prisma/
  schema.prisma        # source of truth for the DB (incl. Auth.js tables)
  seed.ts              # sample games (npm run db:seed)
prisma.config.ts       # Prisma 7 CLI config (datasource URL + seed)
src/
  auth.ts              # Auth.js config (Google provider, Prisma adapter, role)
  app/                 # pages + API route handlers (incl. /api/auth/[...nextauth])
  components/          # UI (SlotGrid, GameCard, UserBar, …)
  context/             # useUser() over Auth.js session
  lib/                 # db, auth guards, draw, finance, payment, slots
  generated/prisma/    # generated Prisma client (committed; regenerated on install)
types/next-auth.d.ts   # session/user type augmentation (adds id + role)
```

## How auth works

`src/auth.ts` wires the Google provider to the Prisma adapter with **database sessions**. On sign-in the adapter creates `User`/`Account`/`Session` rows; the `session` callback exposes `user.id` and `user.role` to the app. API guards (`src/lib/auth.ts`) call `auth()` and check the role server-side, so the admin endpoints are protected regardless of the client UI. New users default to `USER`; the `events.createUser` hook promotes the `ADMIN_EMAIL` account on its first sign-in.

## Production notes

- **Payments are still a placeholder.** `src/lib/payment.ts` always returns success. Wire in a real provider and only mark tickets `COMPLETED` after the provider confirms.
- **On Vercel:** set all `.env` values as project env vars, use a *pooled* `DATABASE_URL` for the app runtime, and run `prisma db push`/`migrate` against the *direct* (non-pooled) connection. Set `AUTH_URL` to your production URL if Auth.js doesn't infer it.
- A paid 100-slot number-draw game is a regulated activity in many jurisdictions — make sure the operating model is licensed/compliant before taking real money.
"# number-slot-game" 
