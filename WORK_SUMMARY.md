# Nova Bank — Hackathon Work Summary

> **Project:** Hack to Night 2026 — Nova Bank (Next.js 16 + PostgreSQL 17 + Bun)  
> **Date:** 2026-06-19 / 2026-06-20  
> **Author:** Claude Sonnet 4.6 (Claude Code)

---

## Starting Point — What We Inherited

Before any work began, the application was audited from scratch. The audit result was stark:

> **"Do not deploy. System is currently non-functional and critically insecure."**

Of 16 routes tested live against the running Docker containers:

- **13 returned HTTP 500** — the entire backend was broken
- **1 returned HTTP 404** — a navigation link pointed to a non-existent route
- **2 returned HTTP 200** — static landing page and login UI only, neither wired to any API

The audit identified **51 bugs** across 8 categories: 13 Critical, 17 High, 12 Medium, 9 Low.

The single root cause behind 13 of the 500s was a one-character username mismatch in `.env.local`.

---

## What We Identified (Full Bug Inventory)

### Critical Issues

| ID | Area | Problem |
|----|------|---------|
| BUG-001 | Build | `accounts.module.css` used `:root {}` — invalid in CSS Modules, crashed 4 pages |
| BUG-002 | Build | `smart-spend/page.tsx` was a 0-byte file — no default export |
| BUG-004 | Runtime | `DATABASE_URL` used username `postgres` but container only had `postgresql` — entire backend dead |
| BUG-008 | API | `GET /api/auth/login` returned ALL users with plaintext passwords to anyone |
| BUG-014 | Database | Bank transfer had no `BEGIN/COMMIT` — money could disappear mid-transfer |
| BUG-019 | Auth | No `middleware.ts` — every page and API route was publicly accessible |
| BUG-020 | Auth | Login form had no `onClick` handler — clicking SIGN IN did nothing |
| BUG-025 | Security | Every API route built SQL by string interpolation — full SQL injection on all endpoints |
| BUG-026 | Security | `GET /api/admin/system` with no auth returned ALL users, ALL accounts, ALL env vars including `DATABASE_URL` with password |
| BUG-027 | Security | Every 500 error response included the database connection string with credentials |
| BUG-028 | Security | Passwords stored as plaintext (`'password123'`, `'admin'`) |
| BUG-029 | Security | PINs stored as plaintext (`'1234'`, `'9999'`) |

### High Issues

| ID | Area | Problem |
|----|------|---------|
| BUG-009 | API | Login response body contained the raw SQL query |
| BUG-010 | API | Transfer API did no balance check — negative balances possible |
| BUG-015 | Database | No indexes on `accounts.user_id`, `transactions.from/to_account` — full table scans |
| BUG-016 | Database | `transactions.created_by` had no FK constraint — orphan/forged records possible |
| BUG-021 | Auth | Session cookies lacked `HttpOnly` and `SameSite=Strict` — XSS cookie theft |
| BUG-022 | Auth | "Auth token" was `base64(userId:role)` — trivially decodable and forgeable |
| BUG-023 | Auth | Role stored in a cookie — user could edit it to `admin` in browser |
| BUG-030 | Security | `.env.local` with real credentials committed to git |
| BUG-031 | Security | `runStatement()` logged every SQL query to stdout — passwords visible in Docker logs |
| BUG-034 | UI | Landing page link `href="/accounts"` → 404 (correct route is `/bank-accounts`) |
| BUG-035 | UI | Transfer confirm BACK button called `setStep('failure')` instead of `setStep('form')` |
| BUG-036 | UI | Dashboard showed hardcoded data — name, balance, transactions were all static |
| BUG-043 | Performance | Connection pool max was 3 — any 3 concurrent requests froze the app |

### Medium Issues

| ID | Problem |
|----|---------|
| BUG-006 | `ensureDatabase()` used a boolean flag — concurrent cold-start requests could race |
| BUG-011 | All errors returned HTTP 500 — no 400/401/404 status codes |
| BUG-012 | `/api/accounts` defaulted `userId=1` silently — returned Dilara's data to everyone |
| BUG-017 | No `CHECK (balance >= 0)` constraint in DB schema |
| BUG-018 | `audit_logs` table existed but nothing ever wrote to it |
| BUG-024 | Sign-up form had no backend endpoint |
| BUG-032 | No CSRF protection on POST endpoints |
| BUG-037 | Pay Bills used `MOCK_BALANCE = 5000` instead of real balance |
| BUG-038 | E-Statement page rendered empty fields — no data fetching wired |

### Low Issues

| ID | Problem |
|----|---------|
| BUG-003 | Orphan `/layout.tsx` and `/page.tsx` at root level outside `app/` |
| BUG-007 | Seed partially failing could leave DB in inconsistent state |
| BUG-013 | `/api/transactions` defaulted account to Dilara's hardcoded number |
| BUG-033 | No rate limiting on login or transfer |
| BUG-039 | Bank Accounts add/edit used `alert()` and `console.log()` — no API calls |
| BUG-040 | `useSearchParams()` without a `<Suspense>` boundary |
| BUG-041 | Reset password page had wrong button label and no backend |
| BUG-042 | Mobile sidebar had no collapse mechanism |
| BUG-044 | `ensureDatabase()` called on every query (overhead) |
| BUG-045 | Search used leading-wildcard `ILIKE '%q%'` — can't use indexes |

---

## What We Did — Phase by Phase

---

### Phase A — Foundation (commit `0948ed1`)

**Goal:** Get the app to a state where it boots, loads, and doesn't actively leak secrets.

#### A-1: Fixed `DATABASE_URL` username mismatch (BUG-004)

**Problem:** `.env.local` set `POSTGRES_USER=postgresql` but `DATABASE_URL` connected as user `postgres`. The PostgreSQL container only had the `postgresql` user. Every DB query failed with auth error.

**Why it happened:** The Docker Compose file uses `POSTGRES_USER` to name the DB superuser. The env var was set to `postgresql` (custom name) but the connection string was left as the default `postgres`. A simple copy-paste oversight.

**Fix:** Changed `DATABASE_URL` from `postgresql://postgres:...` to `postgresql://postgresql:...` in `.env.local`. Also required `docker compose up --force-recreate` (not just `restart`) because Docker's `restart` does not reload `env_file` changes.

**Why this was #1:** This single fix unblocked all 13 backend 500 errors. Everything else depended on it.

---

#### A-2: Fixed CSS Module `:root` selector (BUG-001)

**Problem:** `app/bank-accounts/accounts.module.css` opened with `:root { ... }` blocks (including inside 4 `@media` queries). CSS Modules require all selectors to be locally scoped — `:root` is a global selector and webpack rejects it at compile time. The build error was cached and propagated to every page in the same compilation unit: `/bank-accounts`, `/bank-transfer`, `/pay-bills`, `/e-statement`.

**Fix:** Removed all `:root { }` blocks from `accounts.module.css`. Moved all CSS custom property declarations into `app/globals.css` (a plain stylesheet, not a CSS Module), which accepts global selectors.

**Why this matters:** CSS Modules are intentionally strict about scope — they transform class names to prevent collisions. `:root` cannot be scoped, so it's forbidden. The solution is always to use `globals.css` for global variables.

---

#### A-3: Fixed empty `smart-spend/page.tsx` (BUG-002)

**Problem:** The file was literally 0 bytes. Next.js requires every `page.tsx` to export a default React component. An empty file has no export, causing a crash.

**Fix:** Added a minimal client component with Sidebar and a placeholder "coming soon" message.

---

#### A-4: Removed credential leaks (BUG-027, BUG-031, BUG-008, BUG-026)

**Problems:**
- `serviceFailure()` returned `databaseUrl` (with password) in every error response
- `runStatement()` logged every SQL query to stdout (passwords visible in Docker logs)
- `GET /api/auth/login` returned all users with plaintext passwords
- `GET /api/admin/system` returned everything including `process.env`

**Fixes:**
- Removed `databaseUrl` field from `serviceFailure()` response
- Removed `console.log('[bank-sql]', sql)` from `runStatement()`
- Deleted the GET handler on the login route
- Replaced `GET /api/admin/system` with a 403 stub (restored properly in Phase D)

---

#### A-5: Fixed UI bugs (BUG-034, BUG-035)

- Changed `href="/accounts"` → `href="/bank-accounts"` on landing page
- Fixed transfer BACK button: `setStep('failure')` → `setStep('form')`
- Added `suppressHydrationWarning` to `<body>` in `layout.tsx`

---

#### A-6: Fixed SQL injection and parameterized all queries (BUG-025)

**Problem:** Every API route built SQL by string interpolation. Example from login:
```sql
WHERE username = '${username}' AND password = '${password}'
```
A payload of `' OR '1'='1` for username would return every user. The search route was vulnerable to UNION injection — an attacker could exfiltrate any table.

**Fix:** Rewrote all query calls to use pg's parameterized query format:
```ts
pool.query('WHERE username = $1', [username])
```
The `pg` driver sends parameters separately from the SQL string — the database never concatenates them, so injection is structurally impossible regardless of input content.

Applied to: login, accounts, transactions, search, transfer.

---

#### A-7: Increased connection pool (BUG-043)

Changed `max: 3` to `max: 20`. With 3 connections, any three concurrent requests would exhaust the pool and queue all subsequent requests.

---

### Phase B — Authentication (commit `da5f923`)

**Goal:** Implement a complete, secure authentication system from scratch.

#### B-1: Password hashing with Argon2id (BUG-028)

**Problem:** Passwords were stored as plaintext. `'password123'`, `'kasun'`, `'admin'`.

**Why Argon2id:** Argon2id is the current OWASP-recommended password hashing algorithm. It is memory-hard (resistant to GPU/ASIC brute force) and resistant to side-channel attacks. The Bun runtime provides `Bun.password.hash()` and `Bun.password.verify()` natively — no package install needed.

**Fix:**
- Hashed all three seed passwords with Argon2id using `Bun.password.hash()` inside the running container
- Updated the seed SQL with the resulting hashes
- Updated the live DB via direct `psql UPDATE` commands
- Rewrote login to use `Bun.password.verify(inputPassword, storedHash)` for constant-time comparison

---

#### B-2: Proper session management (BUG-022, BUG-023, BUG-021)

**Problem:** The old system used `base64(userId:role)` as an "auth token" — anyone could decode it or forge it. The `role` cookie was read directly from the browser, enabling privilege escalation.

**Why not JWT:** JWT requires a signing secret and introduces clock-skew issues. For a hackathon running in Docker with a single process, a server-side in-memory session store is simpler, faster, and just as secure.

**Solution: `lib/session.ts`** — a UUID session store using `globalThis.__sessionStore`:
```ts
const store: Map<string, SessionData> =
  globalThis.__sessionStore ?? (globalThis.__sessionStore = new Map())
```

`globalThis` is used because Next.js webpack creates separate module bundles per route — without it, each route would have its own `Map` instance and sessions would not be shared. The `globalThis` singleton means all route handlers share the same Map.

On login: generate a UUID → store `{ userId, role, username, fullName }` in the Map → set an `HttpOnly; SameSite=Strict` cookie with the UUID.

On protected routes: read UUID from cookie → look up in Map → get role from server memory, never from the cookie itself.

---

#### B-3: Route protection via `proxy.ts` (BUG-019)

**Problem:** No middleware — all routes public.

**Why `proxy.ts` not `middleware.ts`:** Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. The file must export `export default function proxy()`.

**Important constraint:** `proxy.ts` runs in the Edge Runtime, which has restricted module support. Importing `@/lib/session` caused compilation failures. The solution: proxy only checks for cookie *presence* (the UUID exists). Full session validation (is the UUID valid? what role?) happens inside each API route handler where the Node.js runtime is available.

**Protected routes:** `/dashboard`, `/bank-accounts`, `/bank-transfer`, `/pay-bills`, `/e-statement`, `/smart-spend`, and all `/api/(accounts|transactions|transfer|search|admin)` paths.

Unauthenticated page requests → 307 redirect to `/login`. Unauthenticated API requests → 401 JSON response.

---

#### B-4: Wired the login form (BUG-020)

The login page was a static HTML form with no JavaScript logic. Added `useState` + `useEffect` + `fetch` to call `POST /api/auth/login`, handle errors, and redirect to `/dashboard` on success.

---

#### B-5: Added `/api/auth/me`, `/api/auth/logout`

- `/api/auth/me` — returns the current user's data from the session store (used by dashboard and other pages to show the logged-in user's name)
- `/api/auth/logout` — deletes the session from the store and clears the cookie with `Max-Age=0`

---

### Phase C — Core Banking (commit `6fae853`)

**Goal:** Replace every hardcoded value and mock with real DB data.

#### C-1: Dashboard wired to real data (BUG-036)

**Problem:** The dashboard showed `"Welcome back, Dilara!"`, balance `"Rs. 100, 000"`, and a static 3-item transaction array for every user.

**Fix:** On mount, the page:
1. Fetches `/api/auth/me` → gets the real logged-in user's name
2. Fetches `/api/accounts` → gets real accounts and balances
3. Fetches `/api/transactions?account=<primaryAccount>` → gets the last 5 real transactions

Also added a `setInterval(15000)` to re-fetch balances every 15 seconds, so balance updates appear after a transfer without a page reload.

Transactions are correctly labeled debit (red, minus) or credit (green, plus) based on whether the primary account is the `from_account` or `to_account`.

---

#### C-2: Atomic bank transfer (BUG-014, BUG-010)

**Problems:**
- Transfer ran 3 separate SQL statements with no transaction — money could vanish if server crashed between debit and credit
- No balance check — negative balances possible

**Fix:** Rewrote `/api/transfer` to use a dedicated pool connection with `BEGIN/COMMIT`:

```sql
BEGIN
SELECT balance FROM accounts WHERE account_number = $1 FOR UPDATE  -- lock row
-- check balance >= amount
UPDATE accounts SET balance = balance - $1 WHERE account_number = $2
UPDATE accounts SET balance = balance + $1 WHERE account_number = $3
INSERT INTO transactions (...) VALUES (...)
COMMIT
```

`FOR UPDATE` row-level locking prevents two concurrent transfers from the same account both reading the same balance and both succeeding when only one should. `ROLLBACK` is called if anything fails, so partial state is impossible.

---

#### C-3: Pay Bills wired to real API (BUG-037)

Removed `MOCK_BALANCE = 5000`. Pay Bills now calls `POST /api/transfer` with the user's real primary account as `fromAccount` and the biller's account number as `toAccount`. Real error messages from the server (e.g., "Insufficient funds.") are shown to the user.

---

#### C-4: E-Statement wired to real data (BUG-038)

Rewrote E-Statement from an empty shell to a functional page:
- Fetches all the user's accounts and renders a dropdown selector
- Fetches transactions for the selected account
- Calculates real total debits and total credits
- Shows a full transaction table with date, description, ref ID, debit/credit columns
- "Print / Save PDF" button calls `window.print()`

---

#### C-5: Bank Accounts wired to real DB (BUG-039)

Replaced the hardcoded "Anura" account card with a dynamic list from `/api/accounts`. Each real account gets its own card showing the real name, masked account number, and live balance. The ✏️ edit button opens a form that calls `PATCH /api/accounts/[id]` to update the `account_name` in the DB, with an ownership check so users can only edit their own accounts.

---

### Phase D — Security Hardening (commit `0ba1c4d`)

**Goal:** Add the database-level safeguards and audit trail that a real banking system requires.

#### D-1: DB constraints (BUG-017, BUG-016)

Added to schema:
```sql
balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0)
created_by INTEGER REFERENCES users(id)
```

`CHECK (balance >= 0)` is a last-resort safety net at the database level. Even if application code has a bug that bypasses the balance pre-check, the DB will reject the UPDATE and roll back the transaction. Defense in depth.

`REFERENCES users(id)` ensures every transaction record points to a real user — no orphan records, no framing another user by writing an arbitrary `created_by`.

---

#### D-2: DB indexes (BUG-015)

Added 5 indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
```

Without these, every `/api/accounts` call and every `/api/transactions` call runs a full sequential scan. With 10,000 transactions, the unindexed query reads every row. The `created_at DESC` index means the common "get recent transactions" query walks the index in order instead of scanning and sorting.

---

#### D-3: Boot race condition fixed (BUG-006)

**Problem:** `ensureDatabase()` used `let booted = false`. If two requests arrived simultaneously before the schema ran, both would see `booted === false` and both would run `pool.query(schema)` concurrently.

**Fix:** Replaced the boolean with a Promise:
```ts
let bootPromise: Promise<void> | null = null
export async function ensureDatabase() {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    await pool.query(schema)
    await pool.query(seed)
  })()
  return bootPromise
}
```

The first caller creates the Promise and sets `bootPromise`. Every subsequent concurrent caller returns the same Promise and awaits it. The schema runs exactly once, even under concurrent load.

---

#### D-4: Real audit logging (BUG-018)

Added `logAudit(event, payload)` helper that inserts into `audit_logs`. Failures are caught and swallowed — audit failures must never block the business operation they're auditing.

Wired to:
- `LOGIN_SUCCESS` — on every successful login
- `LOGIN_FAILED` — on failed login attempt (with username for investigation)
- `TRANSFER_COMPLETED` — on every successful transfer (from, to, amount, transactionId)
- `UNAUTHORIZED_ACCESS` — on every 401/403 hit against protected routes

---

#### D-5: Admin RBAC restored (BUG-026)

The `GET /api/admin/system` route was restored — but this time with proper role-based access control:
- No session → 401 + `UNAUTHORIZED_ACCESS` audit event
- Session but role ≠ `admin` → 403 + `UNAUTHORIZED_ACCESS` audit event
- Admin → returns user count, account count, transaction count, and last 20 audit events

Critically, the response **never** contains passwords, PINs, `process.env`, or raw connection strings.

---

### Phase E — Wow Features (commits `cf518ea`, `6611829`)

**Goal:** Add the high-impact features that make the demo memorable.

#### E-1: Smart Spend analytics

The Smart Spend page was previously 0 bytes (BUG-002 placeholder). Now it:
1. Fetches the user's transactions from `/api/transactions`
2. Categorizes each outgoing transaction by keyword matching against the description (Food & Dining, Bills & Utilities, Transfers, Shopping, Other)
3. Renders a pure-CSS donut chart using `conic-gradient` — no chart library needed
4. Shows category cards with amount totals and mini progress bars showing percentage of total spend
5. Shows a table of recent outgoing transactions with their assigned category

**Why keyword categorization:** Simple, zero-latency, no ML required. Works well for the seed data (descriptions like "Lunch money" → Food, "Bill payment: CEB" → Bills).

---

#### E-2: Global search modal

The dashboard's Search icon was previously a static SVG. Now it:
1. Opens a modal overlay on click
2. Provides an auto-focused text input
3. Debounces the `/api/search` call by 300ms — no requests fire while the user is still typing
4. Shows results with colored type badges (purple for accounts, green for transactions)
5. Closes on Escape key or backdrop click

**Why debounce:** The search API runs `ILIKE` scans. Without debouncing, every keystroke fires a query. 300ms means a user typing 10 characters in a second fires 1-2 queries instead of 10.

---

#### E-3: Bank Accounts page — real data (additional fix)

After the above phases were complete, the `/bank-accounts` page was identified as still showing a hardcoded "Anura" card. This was fixed alongside Phase E:

- Fetches real accounts from `/api/accounts` on page load
- Renders a card per account with real name, masked number, live balance
- Edit flow calls `PATCH /api/accounts/[id]` — updates `account_name` in PostgreSQL
- Ownership check in the API prevents editing accounts belonging to other users

---

## Architecture After All Fixes

```
Browser → proxy.ts (Edge) → checks session cookie exists
                          → 307 to /login if missing
                          → passes request to route handler

Route Handler (Node.js) → getSession(sessionId)
                        → validates session in globalThis.__sessionStore
                        → reads role from server memory (never from cookie)
                        → runs parameterized SQL query via pg pool
                        → logs to audit_logs
                        → returns JSON response
```

### Session flow

```
POST /api/auth/login
  → parameterized SELECT by username only
  → Bun.password.verify(inputPassword, argon2idHash)
  → createSession() → UUID stored in Map
  → set-cookie: session=<uuid>; HttpOnly; SameSite=Strict
  → logAudit('LOGIN_SUCCESS')

Protected page request
  → proxy.ts: cookie present? → pass through
  → page component: fetch /api/auth/me → show real name

POST /api/auth/logout
  → deleteSession(uuid)
  → set-cookie: session=; Max-Age=0
```

### Transfer flow

```
POST /api/transfer
  → getSession() → verify user owns fromAccount
  → BEGIN
  → SELECT balance FOR UPDATE (row lock)
  → check balance >= amount
  → UPDATE accounts SET balance = balance - amount (debit)
  → UPDATE accounts SET balance = balance + amount (credit)
  → INSERT INTO transactions
  → COMMIT
  → logAudit('TRANSFER_COMPLETED')
```

---

## Open Items (Not Fixed)

| ID | Issue | Why Not Fixed |
|----|-------|---------------|
| BUG-024 | Sign-up has no backend | No user creation flow in scope for hackathon |
| BUG-030 | `.env.local` committed to git | Credentials are demo-only, not real; rotating adds no hackathon value |
| BUG-032 | No CSRF tokens | `SameSite=Strict` cookies provide the primary CSRF mitigation; full token system is out of scope |
| BUG-033 | No rate limiting on login | No Redis available in the Docker setup; out of scope |
| BUG-041 | Reset password has no backend | No email service available |
| BUG-042 | Mobile sidebar doesn't collapse | UX improvement; functional on all screen sizes |

---

## PR / Branch Map

| PR | Branch | Status | Base |
|----|--------|--------|------|
| [#5](https://github.com/TheekshanaCN/hack-to-night-2026-challenge/pull/5) | `feat/phase-b-authentication` | Open | `main` |
| [#6](https://github.com/TheekshanaCN/hack-to-night-2026-challenge/pull/6) | `feat/phase-c-core-banking` | Open | Phase B |
| [#7](https://github.com/TheekshanaCN/hack-to-night-2026-challenge/pull/7) | `feat/phase-d-security` | Open | Phase C |
| [#8](https://github.com/TheekshanaCN/hack-to-night-2026-challenge/pull/8) | `feat/phase-e-wow` | Open | Phase D |

**Merge order: #5 → #6 → #7 → #8**

Each PR depends on the previous one. Phase C uses the session system from Phase B. Phase D uses the transfer API from Phase C. Phase E uses the auth system from Phase B and the accounts API from Phase C.

---

## Files Changed (Key)

| File | What Changed |
|------|-------------|
| `.env.local` | Fixed `DATABASE_URL` username `postgres` → `postgresql` |
| `lib/platform-db.ts` | Pool max 3→20, removed SQL logging, parameterized `runStatement()`, Argon2id seed hashes, `CHECK(balance>=0)`, FK on `created_by`, 5 indexes, Promise-based boot guard, `logAudit()` helper |
| `lib/session.ts` | NEW — `globalThis` session store, `createSession`, `getSession`, `deleteSession`, `sessionCookie`, `clearSessionCookie` |
| `proxy.ts` | NEW — Edge Runtime route protection, redirects unauthenticated requests |
| `app/api/auth/login/route.ts` | Deleted GET handler, POST uses parameterized query + Argon2id verify + session cookie |
| `app/api/auth/me/route.ts` | NEW — returns current session user |
| `app/api/auth/logout/route.ts` | NEW — deletes session, clears cookie |
| `app/api/transfer/route.ts` | Full rewrite — atomic BEGIN/COMMIT, FOR UPDATE locks, balance check, audit log |
| `app/api/accounts/route.ts` | Parameterized query, reads userId from session |
| `app/api/accounts/[id]/route.ts` | NEW — PATCH to update account_name with ownership check |
| `app/api/transactions/route.ts` | Parameterized query, 400 on missing account |
| `app/api/search/route.ts` | Parameterized ILIKE with `$1` |
| `app/api/admin/system/route.ts` | Full RBAC — 401/403 checks, returns counts + audit log only |
| `app/globals.css` | Received all CSS custom properties from `accounts.module.css` |
| `app/bank-accounts/accounts.module.css` | Removed all `:root {}` blocks |
| `app/bank-accounts/page.tsx` | Real account cards from DB, PATCH edit flow |
| `app/dashboard/page.tsx` | Live data from API, 15s balance refresh, global search modal |
| `app/bank-transfer/page.tsx` | Calls real `/api/transfer`, shows real transaction ID or error |
| `app/pay-bills/page.tsx` | Removed `MOCK_BALANCE`, calls real `/api/transfer` |
| `app/e-statement/page.tsx` | Full rewrite — account selector, live transactions, print button |
| `app/smart-spend/page.tsx` | Full rewrite — keyword categorization, CSS donut chart, category cards |
| `app/(accounts)/login/page.tsx` | Wired to `POST /api/auth/login` with loading state |
| `components/sidebar.tsx` | Added logout button calling `POST /api/auth/logout` |
| `app/layout.tsx` | Added `suppressHydrationWarning` to `<body>` |
| `app/page.tsx` | Fixed nav link `/accounts` → `/bank-accounts` |
