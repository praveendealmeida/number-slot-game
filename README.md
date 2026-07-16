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
| Payments  | Chain2Pay hosted card-to-crypto checkout (`src/lib/payment.ts`) with reserve → checkout → webhook/poll settlement |

## Payout model

The split is a fixed platform policy, not configurable per game: the winner always receives **70%** of the pool (`WINNER_PAYOUT_PERCENT` in `src/lib/payout.ts`), and the platform keeps a flat **30%**. When the drawn number has a holder, they receive `floor(pool × 70 / 100)`. When the drawn number is unsold, there is no winner and **the whole pool stays with the platform** (no refunds). This is enforced server-side in `src/lib/draw.ts` and `src/app/api/games/route.ts` — there is no admin control to change it, by design.

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

## Payments (Chain2Pay)

Buying slots is a hosted-checkout flow (Chain2Pay, https://docs.chain2pay.is):

1. The buyer selects slots and hits Buy. The server reserves those slots as `PENDING` tickets (held for `CHAIN2PAY_RESERVATION_MINUTES`), creates a Chain2Pay payment, and returns a `checkout_url`.
2. The buyer completes payment on Chain2Pay's hosted page (card/Apple Pay/etc → USDC).
3. Chain2Pay calls the webhook at `/api/payments/chain2pay`, and the game page also polls `/api/payments/status`. Either path re-fetches the authoritative payment status from the gateway and, when `paid`, flips the reserved tickets to `COMPLETED`. Expired payments release the slots.

The gateway status is always treated as the source of truth — the webhook payload alone is never trusted.

### Required env

| Var | Purpose |
| --- | --- |
| `CHAIN2PAY_API_KEY` | `c2p_sandbox_...` for testing, `c2p_live_...` in production |
| `CHAIN2PAY_WEBHOOK_SECRET` | Optional; set in dashboard → Webhooks to verify HMAC signatures |
| `CHAIN2PAY_CURRENCY` | Settlement currency: `USD`, `EUR`, `GBP`, or `CAD` (no LKR) |
| `CHAIN2PAY_FIAT_PER_LKR` | Rate to convert LKR ticket prices to the charge currency (~`0.0033` = USD) |
| `CHAIN2PAY_MIN_AMOUNT` | Per-payment floor the providers enforce (~`6` USD for multihosted) |
| `CHAIN2PAY_RESERVATION_MINUTES` | How long a slot stays reserved during checkout |
| `APP_URL` | Public base URL used to build the webhook callback (your Vercel domain in prod) |

### Important constraint

Chain2Pay settles only in USD/EUR/GBP/CAD and has a **per-payment minimum of roughly $3–6**. Rs. 100–1000 tickets convert to well under that, so a single-slot purchase is rejected with a clear minimum message — buyers must select enough slots to clear the floor, or you raise ticket prices.

### Sandbox testing

Use a `c2p_sandbox_*` key. Create a purchase, then confirm it from the Chain2Pay dashboard (Transactions → the order → "Send Test Callback") or via `POST /api/v2/payments/:id/sandbox-confirm`. The status poll will pick up the `paid` state and lock in the slots. Because the webhook needs a public URL, on `localhost` rely on the dashboard confirm + the polling reconciliation (no public webhook required).

## Daily game rotation

The 5 fixed price tiers — Rs. 50, 100, 200, 500, 1000 — run themselves:

- **Auto-close + auto-draw.** Any `OPEN` game older than 24 hours is automatically closed and drawn with a fair, cryptographically random winning number (`node:crypto`'s `randomInt`), using the exact same payout logic as a manual admin draw. Games that sell out early are untouched by this — those still wait for an admin's manual draw, same as before.
- **Tier refill.** Right after that, any price tier left with zero `OPEN` games gets a fresh one created automatically, so the lobby always has all 5 tiers active.
- **Lobby visibility.** The home page only ever shows `OPEN` games. Once a game is closed/drawn, it disappears from the lobby on its own — no manual cleanup needed. Players can still see the outcome of every game they personally played in their Profile ticket history, drawn or not.

This all lives in `src/lib/rotate.ts` and runs two ways:

1. **Vercel Cron** — `vercel.json` schedules `GET /api/cron/rotate-games` once a day (`0 0 * * *`, UTC). That route requires an `Authorization: Bearer <CRON_SECRET>` header, so set `CRON_SECRET` as an env var in both `.env` and your Vercel project — Vercel automatically sends it as that header on every cron invocation.
2. **Manual trigger** — the Admin dashboard has a "Run Now" button under Daily Rotation, which calls `POST /api/admin/rotate` (protected by normal admin login, not `CRON_SECRET`). Useful because Vercel's **Hobby plan only guarantees one cron run per day, and it can land anywhere within the scheduled hour** — the manual button is your on-demand override if you don't want to wait.

Admins can still create extra games manually at any of the 5 tiers (or a custom title) from the Create Game form — automation only fills gaps, it never removes that ability.

## Production notes

- **Payments use Chain2Pay.** Set the env vars below. Slots are reserved as `PENDING` and only marked `COMPLETED` after the gateway confirms (via webhook or the reconciling status poll), so an abandoned checkout auto-releases its slots after `CHAIN2PAY_RESERVATION_MINUTES`.
- **On Vercel:** set all `.env` values as project env vars, use a *pooled* `DATABASE_URL` for the app runtime, and run `prisma db push`/`migrate` against the *direct* (non-pooled) connection. Set `AUTH_URL` to your production URL if Auth.js doesn't infer it.
- A paid 100-slot number-draw game is a regulated activity in many jurisdictions — make sure the operating model is licensed/compliant before taking real money.
