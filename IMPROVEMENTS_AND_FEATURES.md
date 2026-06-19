# Nova Bank — Security Improvements & Feature Roadmap

> Researched: 2026-06-20  
> Sources: OWASP API Security Top 10, FAPI 1.0, PCI DSS 4.0.1, Monzo / Revolut / Starling feature analysis, BioCatch behavioral biometrics research, UK Open Banking Standard v4.0  
> Scope: Where Nova Bank stands vs. real production banking apps — and where it should go next.

---

## Part 1 — Security Gap Analysis

> How Nova Bank compares to what real banking apps deploy in 2026.

---

### 1.1 Authentication

| Feature | Nova Bank Today | Real Banking Apps | Gap |
|---------|-----------------|-------------------|-----|
| Password hashing | ✅ Argon2id | Argon2id / bcrypt | None |
| Session cookie | ✅ HttpOnly + SameSite=Strict | HttpOnly + SameSite=Strict + Secure | Missing `Secure` flag |
| Session expiry | ❌ Sessions never expire | 15–30 min idle timeout + absolute 8h max | Critical |
| Multi-factor auth | ❌ None | TOTP / SMS OTP / hardware key | Critical |
| Biometric login | ❌ None | Face ID / fingerprint (WebAuthn) | High |
| Login rate limiting | ❌ None | Lockout after 5 attempts, exponential back-off | Critical |
| Device fingerprinting | ❌ None | Trusted device registry per user | High |
| Credential stuffing protection | ❌ None | Real-time breach list check (Have I Been Pwned API) | Medium |

---

### 1.2 Session Management

**Current state:** Sessions live in a `globalThis` in-memory Map with no expiry. If the server restarts, all sessions vanish. If it never restarts, sessions accumulate forever.

**What real banks do:**

```
Session lifecycle in production banking:
  Login          → 15-min idle timeout starts
  Every request  → sliding window resets to 15 min
  No activity    → session invalidated, user redirected to login
  Absolute max   → 8 hours regardless of activity (regulatory requirement)
  Logout         → session deleted server-side + cookie cleared
  New device     → flag for step-up auth
```

**Improvements needed:**

```ts
// Store creation timestamp and last-seen
type SessionData = {
  userId: number
  role: string
  createdAt: number     // absolute expiry: now + 8h
  lastSeenAt: number    // sliding expiry: now + 15min
  deviceId: string      // device fingerprint
}

// On every request: check both timeouts
const IDLE_MS    = 15 * 60 * 1000   // 15 minutes
const ABSOLUTE_MS = 8 * 60 * 60 * 1000  // 8 hours

function validateSession(session: SessionData): boolean {
  const now = Date.now()
  if (now - session.lastSeenAt > IDLE_MS) return false
  if (now - session.createdAt > ABSOLUTE_MS) return false
  session.lastSeenAt = now  // sliding window
  return true
}
```

---

### 1.3 Multi-Factor Authentication (MFA)

This is the single biggest security gap. In 2026, **100% of production banking apps** require at least one second factor for login. Nova Bank has none.

**Recommended implementation: TOTP (Time-Based One-Time Password)**

Why TOTP over SMS OTP:
- SMS OTP is vulnerable to SIM-swap attacks — a known fraud vector where an attacker convinces a carrier to transfer your number
- TOTP generates codes from a shared secret stored on the user's device (Google Authenticator, Authy, 1Password)
- No SMS infrastructure needed — works offline
- OWASP and FAPI both recommend TOTP or hardware keys over SMS

**Implementation plan:**

```
1. Add `totp_secret TEXT` column to users table (store encrypted)
2. On MFA setup: generate secret with `otplib`, show QR code
3. On login after password check:
   → if user has TOTP enabled: require 6-digit code
   → verify with otplib.authenticator.check(token, secret)
   → reject if code is > 30s old
4. Allow backup codes (8 single-use codes stored hashed)
```

---

### 1.4 Rate Limiting & Account Lockout

**Current state:** No limits. An attacker can try 1 million passwords per minute against any account.

**What real banks do:**
- **5 failed login attempts** → 15-minute lockout
- **10 failed attempts** → account frozen, requires identity verification to unlock
- **Transfer limits** → daily cap per account (e.g., Rs. 500,000 per day)
- **IP-based throttle** → max 10 login attempts per IP per minute

**Implementation with Valkey/Redis (fits Docker Compose):**

```ts
// Sliding window counter in Redis/Valkey
async function checkLoginRateLimit(identifier: string): Promise<boolean> {
  const key = `login:attempts:${identifier}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, 900)  // 15 min window
  return count <= 5
}

// Add to docker-compose.yml:
// valkey:
//   image: valkey/valkey:8-alpine
```

---

### 1.5 Behavioral Biometrics (Passive Fraud Detection)

Real banks in 2026 use **behavioral biometrics** — they silently monitor how you interact with the app. No extra step for the user, extremely hard to fake.

What gets monitored:
- **Typing rhythm** — how fast you type, pauses between keystrokes
- **Scroll speed** — how quickly you move through pages
- **Mouse movement curves** — humans move in arcs, bots move in straight lines
- **Touch pressure & angle** — on mobile, how you hold the phone
- **Navigation patterns** — which pages you visit and in what order

If a session starts behaving very differently from the user's established pattern (e.g., extremely fast, mechanical form-filling), the system triggers step-up authentication silently.

**Lightweight version for Nova Bank:**

```ts
// Collect on the client side
type BehaviorSnapshot = {
  avgKeystrokeInterval: number   // ms between keystrokes
  formFillDuration: number       // ms from first keystroke to submit
  mouseMovementCount: number     // events before click
  sessionId: string
}

// POST to /api/security/behavior on each sensitive action
// Server flags sessions where formFillDuration < 800ms (bot-like)
```

---

### 1.6 Transaction Anomaly Detection

**Current state:** Any transfer of any amount is accepted as long as funds are available.

**What real banks do:** Every transaction is scored in real-time against the user's history.

Red flags that should trigger a hold or step-up auth:
- Transfer amount > 3× the user's average transaction
- Transfer to an account number never seen before + amount > Rs. 50,000
- Login from a new device or country → require TOTP before allowing transfers
- 3+ transfers in under 60 seconds (automation pattern)
- Transfer initiated within 60 seconds of login (no browsing time)
- Login time outside the user's normal hours

**Simple implementation:**

```ts
async function scoreTransfer(userId: number, amount: number, toAccount: string): Promise<'allow' | 'hold' | 'block'> {
  const [avg, history] = await Promise.all([
    getAvgTransferAmount(userId),
    getRecentTransfers(userId, '1 hour')
  ])

  if (history.length >= 3) return 'block'             // too many in 1h
  if (amount > avg * 5 && !isKnownPayee(userId, toAccount)) return 'hold'
  if (amount > 100000) return 'hold'                   // large transfer flag
  return 'allow'
}
```

---

### 1.7 Security Headers

**Current state:** No HTTP security headers set.

**Required headers** (add to `next.config.ts`):

```ts
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },                  // No iframes (clickjacking)
  { key: 'X-Content-Type-Options', value: 'nosniff' },        // No MIME sniffing
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // tighten when inline scripts removed
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  }
]
```

Why each one matters:
- **X-Frame-Options: DENY** — prevents your login page being embedded in an attacker's iframe (clickjacking steals credentials)
- **HSTS** — forces HTTPS even if user types `http://`, preventing SSL stripping
- **CSP** — if an XSS bug exists, CSP blocks the injected script from calling external attacker servers
- **Permissions-Policy** — blocks malicious scripts from activating camera/mic/location

---

### 1.8 Sensitive Data Encryption at Field Level

**Current state:** NIC numbers and emails stored in plaintext in PostgreSQL.

**What real banks do:** Sensitive PII is encrypted at the field level — even if an attacker gets a DB dump, they can't read it without the encryption key.

```sql
-- Store AES-256-GCM encrypted
ALTER TABLE users ADD COLUMN nic_encrypted BYTEA;
ALTER TABLE users ADD COLUMN email_encrypted BYTEA;
```

```ts
// Encrypt before insert, decrypt on read
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
const KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'hex')  // 32 bytes

function encryptField(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}
```

---

### 1.9 Immutable Audit Log

**Current state:** Audit logs are rows in a regular PostgreSQL table — anyone with DB access can `DELETE` or `UPDATE` them.

**What real banks do:** Audit logs are append-only and cryptographically chained — each entry contains a hash of the previous entry. Modifying history breaks the chain.

```ts
async function logAudit(event: string, payload: object) {
  const prev = await pool.query(
    'SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1'
  )
  const prevHash = prev.rows[0]?.hash ?? '0'.repeat(64)
  const entry = JSON.stringify({ event, payload, prevHash, ts: Date.now() })
  const hash = createHash('sha256').update(entry).digest('hex')

  await pool.query(
    'INSERT INTO audit_logs (event, payload, hash) VALUES ($1, $2, $3)',
    [event, payload, hash]
  )
}
```

Verifying integrity: walk from entry #1 to latest and check each `hash = sha256(event + payload + prevHash + ts)`.

---

### 1.10 PIN Hashing

**Current state:** Account PINs are stored as plaintext `'1234'`, `'9999'`.

**Fix:** Hash PINs with Argon2id exactly like passwords.

```ts
// On account creation / PIN change
const pinHash = await Bun.password.hash(pin, { algorithm: 'argon2id' })

// On PIN verify (e.g., before large transfer)
const valid = await Bun.password.verify(inputPin, storedPinHash)
```

---

## Part 2 — Creative Feature Ideas

> Ranked by impact vs. implementation effort. Inspired by Monzo, Revolut, Starling, and 2026 fintech trends.

---

### 🔴 High Impact / Low Effort

---

#### Feature 1 — Real-Time Push Notifications

**What it is:** Instant push notification the moment a debit or credit hits any account.

**Why it matters:** Users catch fraud within seconds. Monzo's "instant notifications" are literally their most praised feature — users describe it as feeling "in control of their money."

**Implementation:**
- Server-Sent Events (SSE) or WebSocket endpoint `/api/events/stream`
- On every INSERT into `transactions`: publish to the SSE channel for the account owner
- Client subscribes on dashboard load and shows a toast notification

```ts
// app/api/events/stream/route.ts
export async function GET(request: Request) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Subscribe to DB NOTIFY channel
  pool.on('notification', async (msg) => {
    await writer.write(encoder.encode(`data: ${msg.payload}\n\n`))
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

```sql
-- In transfer route, after COMMIT:
SELECT pg_notify('tx_' || $1, json_build_object('amount', $2, 'from', $3)::text)
```

---

#### Feature 2 — Savings Pots (Monzo-style)

**What it is:** Named virtual sub-accounts within the same bank account. Example: "Holiday Fund", "Emergency Fund", "New Laptop". Money in pots is visually separated from spending balance.

**Why it matters:** Users who use savings pots save 3× more than those who don't (Monzo internal data, 2024). The goal-based framing changes psychology — people don't spend money that has a name.

**DB change:**
```sql
CREATE TABLE savings_pots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2),
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  emoji TEXT DEFAULT '🏦',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**UI:** Cards on dashboard below main balance. Tap to move money in/out. Progress bar to goal.

---

#### Feature 3 — Round-Up Savings

**What it is:** Every time you spend money, the transaction is rounded up to the nearest Rs. 100, and the difference goes to a savings pot.

**Example:**
- Spend Rs. 347 → Round up to Rs. 400 → Rs. 53 moved to savings pot
- Spend Rs. 1,200 → Already round → no round-up (or round to Rs. 1,500)

**Why it matters:** "Save by stealth" — users don't feel the loss of small amounts but accumulate meaningful savings over time. Zero friction.

**Implementation:** Hook into the transfer INSERT trigger. After each debit transaction, calculate round-up and insert a secondary micro-transfer to the savings pot in the same DB transaction.

---

#### Feature 4 — Scheduled / Recurring Transfers

**What it is:** Set a transfer to happen automatically on a schedule (daily, weekly, monthly, or specific date).

**Real-world use cases:** Rent on the 1st of every month, weekly pocket money for kids, monthly savings deposit.

**Implementation:**
```sql
CREATE TABLE scheduled_transfers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL,  -- 'once' | 'daily' | 'weekly' | 'monthly'
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);
```

A worker polls `WHERE next_run_at <= NOW() AND active = true` every minute (using `setInterval` in a Next.js route or a Docker cron job) and executes the transfer via the same atomic transfer function.

---

#### Feature 5 — Instant Card Lock / Freeze

**What it is:** One tap in the app to freeze/unfreeze your debit card. No call to the bank. No waiting.

**Why it matters:** If you lose your card or see a suspicious transaction, you can freeze in 2 seconds instead of calling a hotline and waiting 10 minutes.

**DB change:**
```sql
ALTER TABLE accounts ADD COLUMN card_frozen BOOLEAN NOT NULL DEFAULT false;
```

**API:** `POST /api/accounts/[id]/freeze` and `/unfreeze` — flip the flag. Transfer API checks this flag and returns 403 "Card is frozen" if `card_frozen = true`.

**UI:** Toggle switch on the Accounts page with a padlock icon. Immediate visual feedback.

---

### 🟡 High Impact / Medium Effort

---

#### Feature 6 — Transaction Receipt & Dispute

**What it is:** After every transfer, generate a downloadable PDF receipt. A "dispute" button appears on any transaction to flag it for investigation.

**Why it matters:** Regulatory requirement in most jurisdictions. Users need proof of payment for rent, business expenses, or disputes.

**Implementation:**
- Use the browser `window.print()` approach on a receipt page styled with `@media print` CSS (no library needed)
- Dispute: `INSERT INTO disputes (transaction_id, user_id, reason, status)` + `UNAUTHORIZED_ACCESS` audit event + email notification

---

#### Feature 7 — Bill Split

**What it is:** Select a transaction and split it across multiple users. Each person gets a payment request link. When they pay, the amounts are automatically reconciled.

**Real-world use:** Split restaurant bill, split rent, split grocery run.

**How it works:**
1. User selects a debit transaction (e.g., Rs. 4,800 dinner)
2. Enters contacts (other Nova Bank usernames)
3. App creates a "split request" record
4. Each contact sees a pending request on their dashboard
5. They tap "Pay" → executes a real transfer → split request marked settled

```sql
CREATE TABLE split_requests (
  id SERIAL PRIMARY KEY,
  initiator_id INTEGER NOT NULL REFERENCES users(id),
  transaction_id INTEGER REFERENCES transactions(id),
  total_amount NUMERIC(14,2) NOT NULL,
  per_person NUMERIC(14,2) NOT NULL,
  settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE split_participants (
  id SERIAL PRIMARY KEY,
  split_id INTEGER NOT NULL REFERENCES split_requests(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ
);
```

---

#### Feature 8 — Spending Budget & Alerts

**What it is:** Set monthly budgets per spending category (Food, Bills, Entertainment, etc.). Get an in-app alert when you hit 80% of a budget. Red banner when exceeded.

**Why it matters:** Smart Spend shows you what you spent. Budgets tell you what you *should* spend. Together they close the loop on financial awareness.

**DB change:**
```sql
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  monthly_limit NUMERIC(14,2) NOT NULL,
  month TEXT NOT NULL,  -- 'YYYY-MM'
  UNIQUE (user_id, category, month)
);
```

**Alert trigger:** After each categorized transaction, check current month's spend vs. budget limit. If > 80% → create a notification. If > 100% → show red warning badge on Smart Spend nav item.

---

#### Feature 9 — Virtual Cards

**What it is:** Generate a one-time-use or limited-use virtual card number (16 digits, CVV, expiry) for online shopping. The virtual card draws from your real account but has its own limit and can be deleted without affecting your main card.

**Why it matters:** You never expose your real card number to online merchants. If a merchant is breached, the leaked virtual card number is already burnt.

**DB change:**
```sql
CREATE TABLE virtual_cards (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  card_number TEXT UNIQUE NOT NULL,
  cvv_hash TEXT NOT NULL,
  expiry TEXT NOT NULL,
  spending_limit NUMERIC(14,2),
  single_use BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### Feature 10 — Transaction Search & Smart Filter

**What it is:** Full-text search across transaction history with filters for date range, amount range, and category. Export results as CSV.

**Why it matters:** Users need to find "that Rs. 2,500 payment I made to Dialog in March" for expense claims, disputes, or tax.

**Enhancement to existing `/api/search`:**

```ts
// Add to search query
const result = await runStatement(`
  SELECT * FROM transactions
  WHERE (from_account = $1 OR to_account = $1)
    AND ($2::text IS NULL OR description ILIKE '%' || $2 || '%')
    AND ($3::numeric IS NULL OR amount >= $3)
    AND ($4::numeric IS NULL OR amount <= $4)
    AND ($5::date IS NULL OR created_at >= $5)
    AND ($6::date IS NULL OR created_at <= $6)
  ORDER BY created_at DESC
  LIMIT 100
`, [account, query, minAmount, maxAmount, fromDate, toDate])
```

CSV export: `GET /api/transactions/export?format=csv` — build CSV string server-side, return with `Content-Disposition: attachment; filename=statement.csv`.

---

#### Feature 11 — QR Code Payments

**What it is:** Generate a QR code containing your account number and a pre-filled amount. Someone scans it with the Nova Bank app → transfer screen auto-populates.

**Why it matters:** Eliminates the risk of typing the wrong account number. Standard in most Asian markets (UPI in India, PromptPay in Thailand, JomPAY in Malaysia).

**Implementation:**
- Generate QR client-side using `qrcode` library: `QRCode.toDataURL('novabank://pay?account=1000003423&amount=500&name=Dilara')`
- Parse the deep-link URL on the receiving app's transfer page
- Show a "Pay to Dilara" confirmation screen with pre-filled amount

---

### 🟢 Medium Impact / High Innovation

---

#### Feature 12 — AI Financial Assistant (Chat)

**What it is:** A chat interface where users can ask natural language questions about their finances.

**Example queries:**
- "How much did I spend on food last month?"
- "Can I afford a Rs. 50,000 purchase if I have bills due this week?"
- "What's my biggest expense category?"
- "Show me all transfers to Dialog"

**Implementation with Claude API:**

```ts
// Fetch user's transaction summary
const context = await buildFinancialContext(userId)
// context = { totalBalance, monthlySpend, topCategories, recentTransactions }

// Pass to Claude with system prompt
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',  // Fast, cheap for chat
  system: `You are a financial assistant for Nova Bank.
    User financial data: ${JSON.stringify(context)}
    Answer questions about their finances concisely.
    Never reveal other users' data.`,
  messages: [{ role: 'user', content: userQuestion }]
})
```

Why Claude Haiku: sub-second latency, costs ~$0.0003 per query, perfect for chat UI.

---

#### Feature 13 — Spend Forecast

**What it is:** Based on the last 3 months of spending patterns, predict what the user will spend this month in each category and whether they're on track.

**Example:** "Based on your history, you typically spend Rs. 15,000 on food in June. You've spent Rs. 8,200 so far (day 12 of 30). You're on track."

**Implementation:**

```ts
function forecastMonthlySpend(transactions: Transaction[], category: string): number {
  const last90Days = transactions.filter(t =>
    t.created_at > daysAgo(90) && categorize(t.description).label === category
  )
  const dailyAvg = last90Days.reduce((s, t) => s + Number(t.amount), 0) / 90
  return dailyAvg * 30  // projected monthly
}

const daysElapsed = new Date().getDate()
const projectedTotal = (currentMonthSpend / daysElapsed) * 30
```

Visualize as a "runway" bar: current spend vs. forecast vs. budget limit.

---

#### Feature 14 — Green Banking / Carbon Tracker

**What it is:** Estimate the carbon footprint of purchases based on merchant category. Show a monthly CO₂ score. Let users "offset" by donating to a verified green fund.

**Why it matters:** 73% of Gen Z say sustainability influences their financial decisions (Deloitte 2025). Revolut launched Carbon Footprint Tracker in 2023 and saw strong engagement.

**Implementation:**
- Map merchant categories to CO₂ coefficients (kg CO₂ per Rs. spent)
  - Fuel / Transport: 0.89 kg/100 Rs.
  - Food & Dining: 0.23 kg/100 Rs.
  - Shopping: 0.31 kg/100 Rs.
- Aggregate monthly CO₂ score
- "Offset" button → transfer Rs. X to a green fund account

---

#### Feature 15 — Family Banking / Sub-Accounts

**What it is:** A primary account holder can create sub-accounts for family members (children, spouse). Each sub-account has its own card and spending limits set by the primary holder.

**DB change:**
```sql
ALTER TABLE accounts ADD COLUMN parent_account_id INTEGER REFERENCES accounts(id);
ALTER TABLE accounts ADD COLUMN daily_limit NUMERIC(14,2);
ALTER TABLE accounts ADD COLUMN monthly_limit NUMERIC(14,2);
```

**Use case:** Parent creates a child's account with Rs. 5,000/month limit. Child can see their balance and transactions. Parent gets a notification on every child spend.

---

#### Feature 16 — Loyalty Points & Cashback

**What it is:** Earn points on transactions with partner merchants. Redeem points for cashback, vouchers, or donations.

**DB change:**
```sql
CREATE TABLE loyalty_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  transaction_id INTEGER REFERENCES transactions(id),
  points INTEGER NOT NULL,
  action TEXT NOT NULL,  -- 'earn' | 'redeem'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rule engine:** 1 point per Rs. 100 spent. 100 points = Rs. 10 cashback. Partner merchants earn 5× points.

---

#### Feature 17 — Travel Mode / Multi-Currency Wallet

**What it is:** Enable "Travel Mode" before a trip. The app stops flagging foreign transactions as suspicious, shows balances in the local currency, and displays real-time exchange rates.

**Enhancement:** Add a wallet with multiple currency pockets (LKR, USD, EUR, GBP). Exchange between pockets at real-time rates before traveling.

**API:** Integrate with ExchangeRate-API (free tier: 1,500 requests/month) for live rates.

---

#### Feature 18 — Dark Mode

**What it is:** A dark color theme for the entire app, respecting the OS-level `prefers-color-scheme` preference.

**Why it matters:** ~82% of smartphone users prefer dark mode (Android Authority, 2024). Banking apps are used at night (checking balances before bed, paying bills late). Dark mode reduces eye strain.

**Implementation:**
```css
/* globals.css */
:root { --bg: #f1f1f1; --surface: #ffffff; --text: #111111; }

@media (prefers-color-scheme: dark) {
  :root { --bg: #0f0f0f; --surface: #1a1a1a; --text: #f5f5f5; }
}
```

Then replace all hardcoded colors in JSX `style={{}}` props with CSS variables.

---

#### Feature 19 — Offline Balance Cache

**What it is:** Cache the last-known balance in `localStorage` so it's visible even when there's no internet connection. Show a "Last updated 2 min ago" badge.

**Why it matters:** Checking your balance is the #1 use case in a banking app. It should work on a plane, in a tunnel, or when the server is down.

**Implementation:**
```ts
// On every successful /api/accounts fetch:
localStorage.setItem('cached_balance', JSON.stringify({
  balance: accounts[0].balance,
  updatedAt: Date.now()
}))

// On mount, before fetch resolves:
const cached = localStorage.getItem('cached_balance')
if (cached) setBalance(JSON.parse(cached))
// Then fetch replaces with live data
```

---

#### Feature 20 — Developer API / Webhooks (Open Banking)

**What it is:** Let users generate API keys to share their transaction data with third-party apps (budgeting tools, accountants, tax software). Webhooks push real-time events when transactions occur.

**Why it matters:** This is the UK Open Banking model (mandatory since 2018). It transforms the bank from a walled garden into a platform.

**DB change:**
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  key_hash TEXT UNIQUE NOT NULL,  -- never store plaintext
  label TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',  -- ['read:transactions', 'read:balance']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,  -- ['transaction.created', 'balance.updated']
  active BOOLEAN DEFAULT true
);
```

**Security:** API keys are shown once at creation (like GitHub tokens). Stored as bcrypt hash. Each key has scopes (read-only vs. write). Every use is logged to `audit_logs`.

---

## Part 3 — Implementation Priority Matrix

| # | Feature | Impact | Effort | Do When |
|---|---------|--------|--------|---------|
| 1 | Session expiry (idle + absolute) | 🔴 Critical | Low | Now |
| 2 | Login rate limiting + lockout | 🔴 Critical | Low | Now |
| 3 | Security headers in next.config.ts | 🔴 Critical | Very Low | Now |
| 4 | PIN hashing | 🔴 Critical | Very Low | Now |
| 5 | TOTP / MFA | 🔴 Critical | Medium | Sprint 1 |
| 6 | Real-time push notifications (SSE) | 🟡 High | Low | Sprint 1 |
| 7 | Savings Pots | 🟡 High | Medium | Sprint 1 |
| 8 | Card freeze / unfreeze | 🟡 High | Low | Sprint 1 |
| 9 | Round-up savings | 🟡 High | Low | Sprint 2 |
| 10 | Transaction search + filters + CSV export | 🟡 High | Medium | Sprint 2 |
| 11 | Spending budgets + alerts | 🟡 High | Medium | Sprint 2 |
| 12 | Scheduled / recurring transfers | 🟡 High | Medium | Sprint 2 |
| 13 | Transaction receipt PDF | 🟢 Medium | Low | Sprint 2 |
| 14 | Dark mode | 🟢 Medium | Low | Sprint 3 |
| 15 | QR code payments | 🟢 Medium | Low | Sprint 3 |
| 16 | Offline balance cache | 🟢 Medium | Very Low | Sprint 3 |
| 17 | Bill split | 🟢 Medium | High | Sprint 3 |
| 18 | AI Financial Assistant | 🟢 Medium | Medium | Sprint 4 |
| 19 | Spend forecast | 🟢 Medium | Low | Sprint 4 |
| 20 | Behavioral biometrics | 🟢 Medium | High | Sprint 4 |
| 21 | Transaction anomaly detection | 🔴 Critical | High | Sprint 4 |
| 22 | Virtual cards | 🟢 Medium | High | Sprint 5 |
| 23 | Family banking | 🟢 Medium | High | Sprint 5 |
| 24 | Green / carbon tracker | 🟢 Low | Medium | Sprint 5 |
| 25 | Developer API + webhooks | 🟢 Low | Very High | Sprint 6 |

---

## Part 4 — Technology Recommendations

| Need | Recommended Tool | Why |
|------|-----------------|-----|
| MFA / TOTP | `otplib` (npm) | Industry standard, 0 dependencies, works in Bun |
| Rate limiting | Valkey (Redis-compatible) | Fits Docker Compose, atomic counters, no license cost |
| Push notifications | Native SSE + `pg_notify` | No extra infra — PostgreSQL already running |
| PDF receipts | `window.print()` + CSS | Zero dependencies, works in any browser |
| QR codes | `qrcode` (npm) | Tiny, client-side, no server round-trip |
| AI chat | Claude Haiku 4.5 | Fastest, cheapest Claude model — perfect for real-time chat |
| Exchange rates | ExchangeRate-API (free) | 1,500 free requests/month, simple REST API |
| Field encryption | Node `crypto` (built-in) | AES-256-GCM, no extra package |
| Behavioral biometrics | Custom (see above) | BioCatch costs $$$; a basic version is buildable in-house |
| CSV export | Custom string builder | No library needed for simple CSV |

---

## Part 5 — Security Standards to Align With

| Standard | What It Requires for Banking | Nova Bank Gap |
|----------|------------------------------|---------------|
| **OWASP API Top 10 (2023)** | Parameterized queries, auth on all routes, no sensitive data in errors | Mostly fixed in Phase A–D; need security headers |
| **PCI DSS 4.0.1** | TLS 1.2+, no PAN in logs, strong auth, key management | Need HTTPS enforcement, field encryption |
| **FAPI 1.0 Advanced** | OAuth 2.0 + PKCE, mTLS, signed JWTs for payments | Not implemented; roadmap for open banking |
| **GDPR / PDPA** | Right to erasure, data minimization, breach notification | No delete-account flow; no breach alert system |
| **ISO 27001** | Risk management, access control, audit trail | Audit trail started in Phase D; formal risk assessment needed |

---

*Sources used in this document:*
- [Banks With the Best Security Features in 2026 — Chime](https://www.chime.com/blog/best-bank-with-security-features/)
- [Why MFA Is Crucial for Online Banking Security in 2026 — OmniDefend](https://www.omnidefend.com/why-mfa-is-crucial-for-online-banking-security/)
- [How Biometrics in Banking Strengthen Fraud Security in 2026 — Infisign](https://www.infisign.ai/blog/biometrics-in-banking)
- [Open Banking API Security: The Complete Guide in 2026 — Astra](https://www.getastra.com/blog/api-security/open-banking/)
- [Open Banking API Standards 2025: Global Frameworks — Geneo](https://geneo.app/query-reports/open-banking-api-standards-2025)
- [Stop Fraud Before It Happens: AI & Behavioral Biometrics — Alkami](https://www.alkami.com/blog/stop-fraud-before-it-happens-ai-behavioral-biometrics-in-action/)
- [Real-Time AI Fraud Detection for Banks — Appwrk](https://appwrk.com/insights/banking-use-cases-of-ai-in-fraud-detection)
- [Trends and innovations in secure banking for 2025 — BAI](https://www.bai.org/banking-strategies/trends-and-innovations-in-secure-banking-for-2025/)
- [Best Mobile Banking App Features 2025 — SDK.finance](https://sdk.finance/blog/best-mobile-banking-app-features/)
- [Top Innovative Fintech Startup Ideas 2026 — Orbix Studio](https://www.orbix.studio/blogs/innovative-fintech-startup-ideas)
- [Revolut vs Monzo 2025 Comparison — Businassist](https://businassist.com/blog/revolut-vs-monzo/)
- [Behavioral Biometrics: How It Stops Digital Fraud — Focal AI](https://www.getfocal.ai/blog/behavioral-biometrics)
- [FAPI Working Group — OpenID Foundation](https://openid.net/wg/fapi/)
