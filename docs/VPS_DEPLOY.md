# Deploying Lucky Lanka to the DigitalOcean VPS (159.65.143.11)

This runbook was written by Claude Code but **cannot be executed from that
session** — the remote sandbox's egress proxy blocks raw SSH/TCP entirely and
blocks `app.notify.lk` / `api.expo.dev` by policy. Run every command below
yourself, from a machine with normal internet access (your laptop, or Claude
Code CLI running locally). Paste output back if something fails.

Hostname used throughout: **`159.65.143.11.sslip.io`** — sslip.io resolves
that subdomain to the embedded IP automatically, no DNS setup needed, and
works fine with Certbot's HTTP-01 challenge.

---

## 0. Before you start

- Have the real production secrets ready: `DATABASE_URL`, `AUTH_SECRET`,
  admin credentials, **Notify.lk keys with an approved (non-`NotifyDEMO`)
  sender ID**, `CRON_SECRET`.
- This runbook assumes Postgres runs locally on the same VPS. If you're using
  a managed Postgres instead, skip section 2 and just use its connection
  string for `DATABASE_URL`.
- **Payments are a demo sandbox right now** — buying a ticket debits the
  user's in-app wallet directly, no real gateway. If `DEMO_MODE=false` and
  nobody credits wallets manually (admin dashboard → user → wallet
  adjustment), users will have Rs 0 and can't buy anything. Either keep
  `DEMO_MODE=true` for now, or plan to credit test wallets by hand, until a
  real payment gateway is wired back in.

## 1. SSH in and install base packages

```bash
ssh root@159.65.143.11

apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs postgresql postgresql-contrib nginx git ufw
npm install -g pm2

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER luckylanka WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE luckylanka OWNER luckylanka;
SQL
```

`DATABASE_URL` will be:
`postgresql://luckylanka:CHANGE_ME_STRONG_PASSWORD@localhost:5432/luckylanka?schema=public`

## 3. Clone and configure the app

```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/praveendealmeida/number-slot-game.git
cd number-slot-game
git checkout claude/lucky-lanka-production-46jptd   # or main, once merged

npm install
```

Create `/var/www/number-slot-game/.env` with **every** var below filled in
with real values (never commit this file — it's already gitignored):

```bash
# Database
DATABASE_URL="postgresql://luckylanka:CHANGE_ME_STRONG_PASSWORD@localhost:5432/luckylanka?schema=public"

# Auth.js — generate with: npx auth secret
AUTH_SECRET="<random 32-byte secret>"

# Admin web login (/admin/login)
ADMIN_USERNAME="<your admin username>"
ADMIN_PASSWORD="<strong password — not the .env.example default>"
ADMIN_EMAIL="admin@luckylanka.lk"

# Mobile OTP — PRODUCTION VALUES
DEMO_MODE=false
OTP_MODE=notify
NOTIFY_LK_USER_ID="<your Notify.lk user id>"
NOTIFY_LK_API_KEY="<your Notify.lk api key>"
NOTIFY_LK_SENDER_ID="<your APPROVED sender id — NOT NotifyDEMO>"

# Public URL — used as Auth.js's base URL
AUTH_URL="https://159.65.143.11.sslip.io"

# Payments: demo sandbox only — buying a ticket debits the user's in-app
# wallet directly, no external gateway involved (see .env.example). Wallets
# are funded via DEMO_MODE's Rs 5,000 top-up or manual admin credit until a
# real payment gateway is wired in.

# Cron auth — generate with: openssl rand -hex 24
CRON_SECRET="<random string>"
```

`OTP_TEST_CODE` is intentionally omitted — it's dead in `OTP_MODE=notify`
(see `src/services/otp.ts` — `isSandbox()` gates it off), no need to set it.

```bash
npx prisma generate
npx prisma db push
npm run build
```

## 4. PM2 — run persistently, single instance (fork mode)

The app's rate limiter (`src/lib/rate-limit.ts`) is in-process memory.
**Do not run PM2 in cluster mode** — multiple instances would each keep
independent rate-limit counters, multiplying the effective OTP/login rate
limits and defeating the brute-force protection.

```bash
cd /var/www/number-slot-game
pm2 start npm --name "lucky-lanka" -- start
pm2 save
pm2 startup   # run the printed command it outputs, as root
```

Any time you edit `.env`, run `pm2 restart lucky-lanka` — several values
(`DEMO_MODE` in particular) are read once at module load, not per-request.

## 5. Nginx reverse proxy

```bash
cat > /etc/nginx/sites-available/lucky-lanka <<'NGINX'
server {
    listen 80;
    server_name 159.65.143.11.sslip.io;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -s /etc/nginx/sites-available/lucky-lanka /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 6. HTTPS via Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 159.65.143.11.sslip.io --redirect -m you@example.com --agree-tos -n
```

Certbot edits the Nginx config in place to add the TLS listener + redirect,
and installs a systemd timer for auto-renewal.

## 7. Verify from outside the VPS

Run this **from your own machine**, not the VPS:

```bash
curl -I https://159.65.143.11.sslip.io/
```

Paste the raw output back — expecting a `200`/`308` from Next.js with a
valid `Server` header and no TLS warnings from curl.

---

## 8. Cron jobs (replacing Vercel Cron)

`vercel.json` in the repo actually schedules (this is the source of truth —
the README text describing `rotate-games` at `0 0 * * *` is stale/wrong):

| Job | Schedule (UTC) | Endpoint |
|---|---|---|
| `seed-games` | `0 0 * * *` (midnight) | `GET /api/cron/seed-games` |
| `rotate-games` | `0 14 * * *` (14:00) | `GET /api/cron/rotate-games` |

Both now require `Authorization: Bearer <CRON_SECRET>` (the `seed-games`
route was missing/broken auth before this branch — fixed in this same
change, see the code diff).

```bash
crontab -e
```

Add, substituting your real `CRON_SECRET`:

```cron
0 0 * * * curl -s -o /dev/null -w "\%{http_code}" -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" https://159.65.143.11.sslip.io/api/cron/seed-games
0 14 * * * curl -s -o /dev/null -w "\%{http_code}" -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" https://159.65.143.11.sslip.io/api/cron/rotate-games
```

(root's crontab, since that's who owns PM2/the app — adjust if you deploy
under a non-root user).

---

## 9. Live OTP test (run locally, not from the VPS or the sandbox)

```bash
curl -sS -G "https://app.notify.lk/api/v1/send" \
  --data-urlencode "user_id=YOUR_NOTIFY_LK_USER_ID" \
  --data-urlencode "api_key=YOUR_NOTIFY_LK_API_KEY" \
  --data-urlencode "sender_id=YOUR_APPROVED_SENDER_ID" \
  --data-urlencode "to=94788015227" \
  --data-urlencode "message=Please use the code 123456 to verify your Lucky Lanka account."
```

Paste the raw JSON response back. Once that works with a real sender ID,
also exercise the actual app flow end-to-end:

```bash
curl -sS -X POST https://159.65.143.11.sslip.io/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+94788015227"}'
```

## 10. Production APK build

```bash
cd mobile-app
export EXPO_TOKEN=YOUR_EXPO_TOKEN
eas build --platform android --profile production
```

`eas.json`'s `production` profile now sets
`EXPO_PUBLIC_API_URL=https://159.65.143.11.sslip.io/` (already committed on
this branch). Paste back the build link EAS prints.
