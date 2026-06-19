# ATTACK_PLAN.md — Nova Bank / Smart Spend

> Generated: 2026-06-19  
> Context: Hackathon (Hack to Night 2026)  
> Mindset: Banking CTO with limited time  
> Source: ARCHITECTURE.md + BUG_REPORT.md (46 bugs, 13 CRITICAL)

---

## Situation Assessment

The app is **100% non-functional in production**. Every API route returns 500. Four of seven pages crash on load. The login button does nothing. No authentication exists. SQL injection is present in every route. Database credentials are leaked on every failed request.

**The good news:** the UI shell is largely built. The DB schema is sensible. The routing structure is correct. Almost every problem is fixable with small, targeted changes.

**Hackathon strategy:** Fix the foundation fast, wire up the core demo flow, then layer security and polish. Every phase is ordered so that each fix *compounds* on the previous one — fixing the DB unblocks everything, fixing SQL injection makes the auth flow safe to wire up, wiring auth enables the protected pages, etc.

---

## Time Budget Estimate

| Phase | Time Estimate | Goal                              |
|-------|--------------|-----------------------------------|
| 1     | ~45 minutes  | App boots, pages load, no credential leaks |
| 2     | ~2.5 hours   | Login works, transfers work, dashboard shows real data |
| 3     | ~1.5 hours   | Banking-grade security posture    |
| 4     | ~1.5 hours   | All features functional, polished |
| 5     | ~2 hours     | Differentiating wow features      |
| **Total** | **~8 hours** | Full working banking demo |

---

## Risk Rating Key

| Risk   | Meaning |
|--------|---------|
| NONE   | Cannot break anything; isolated change |
| LOW    | Isolated file change; easy to revert |
| MEDIUM | Touches shared code; test after each change |
| HIGH   | Cross-cutting change; requires careful sequencing |

---

---

# PHASE 1 — Immediate Critical Fixes

> **Goal:** Make the app boot, pages load, and stop leaking credentials.  
> **Time:** ~45 minutes  
> **All fixes are isolated. Do them in order — each one unblocks the next.**

---

### P1-01 — Fix DATABASE_URL username mismatch

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #1 — MUST DO FIRST |
| **Bug Ref**    | BUG-004 |
| **Difficulty** | Trivial (1 character change) |
| **Risk**       | NONE |
| **Time**       | 2 minutes |

**Root Cause:** `.env.local` sets `POSTGRES_USER=postgresql` but `DATABASE_URL` uses `postgres`. PostgreSQL rejects every connection.

**Files:**
- `.env.local` — line 4: change `postgresql://postgres:` → `postgresql://postgresql:`

**Dependencies:** None. This is the root cause of all 500 errors.

**Expected Impact:**
- All API routes go from 500 → functional
- `GET /api/health` returns 200 with DB timestamp
- Entire backend is unblocked

**After this fix, run:** `docker compose restart htn26-challenge-dev` and verify `curl http://localhost:3000/api/health` returns 200.

---

### P1-02 — Fix CSS Module `:root` selector crashing 4 pages

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #2 |
| **Bug Ref**    | BUG-001 |
| **Difficulty** | Easy (move CSS block) |
| **Risk**       | LOW |
| **Time**       | 10 minutes |

**Root Cause:** `app/bank-accounts/accounts.module.css` opens with `:root { ... }` — a global selector that webpack CSS Modules rejects at compile time. The error is cached and causes cascade failures on `/bank-accounts`, `/bank-transfer`, `/pay-bills`, `/e-statement`.

**Files:**
- `app/bank-accounts/accounts.module.css` — remove lines 1–80 (the entire `:root { ... }` block)
- `app/globals.css` — paste those CSS variables here under a `:root { }` block

**Dependencies:** P1-01 (so pages can actually load after fixing)

**Expected Impact:**
- `/bank-accounts`, `/bank-transfer`, `/pay-bills`, `/e-statement` all stop crashing
- 4 pages go from 500 → 200

---

### P1-03 — Fix empty `smart-spend/page.tsx`

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #3 |
| **Bug Ref**    | BUG-002 |
| **Difficulty** | Trivial (add 5 lines) |
| **Risk**       | NONE |
| **Time**       | 3 minutes |

**Root Cause:** `app/smart-spend/page.tsx` is a zero-byte file. Next.js requires a default export.

**Files:**
- `app/smart-spend/page.tsx` — add a minimal placeholder component with Sidebar layout

**Dependencies:** P1-02 (so the page doesn't fail due to CSS cascade)

**Expected Impact:**
- `/smart-spend` goes from 500 → 200
- TypeScript error `TS2306` resolved
- All 7 pages now load

---

### P1-04 — Remove DB credentials from error responses

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #4 |
| **Bug Ref**    | BUG-027 |
| **Difficulty** | Trivial (delete 1 line) |
| **Risk**       | NONE |
| **Time**       | 2 minutes |

**Root Cause:** `serviceFailure()` returns `databaseUrl: connectionString` in every 500 response. Currently observable live at every endpoint.

**Files:**
- `lib/platform-db.ts` — line 108: delete `databaseUrl: connectionString`

**Dependencies:** None (but do this before any demo or shared testing)

**Expected Impact:**
- DB credentials no longer exposed in HTTP responses
- Stops the most immediately dangerous live leak

---

### P1-05 — Delete the `GET /api/auth/login` user dump

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #5 |
| **Bug Ref**    | BUG-008 |
| **Difficulty** | Trivial (delete 14 lines) |
| **Risk**       | NONE |
| **Time**       | 2 minutes |

**Root Cause:** The GET handler on the login route returns all users, usernames, passwords, NIC numbers, and emails with no authentication.

**Files:**
- `app/api/auth/login/route.ts` — delete the entire `export async function GET()` block (lines 3–17)

**Dependencies:** None

**Expected Impact:**
- Credential dump endpoint eliminated
- `GET /api/auth/login` returns 405 Method Not Allowed

---

### P1-06 — Neuter the admin system endpoint

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #6 |
| **Bug Ref**    | BUG-026 |
| **Difficulty** | Easy |
| **Risk**       | NONE |
| **Time**       | 5 minutes |

**Root Cause:** `GET /api/admin/system` returns `process.env` (all secrets), every user account with passwords, every bank account with PINs, and the cookie header — with no authentication.

**Files:**
- `app/api/admin/system/route.ts` — strip `process.env`, `users`, and `accounts` from the response; return only a `{ ok: true, status: "protected" }` placeholder until auth middleware is implemented in Phase 3

**Dependencies:** None

**Expected Impact:**
- Eliminates the single most catastrophic endpoint in the system
- process.env secrets no longer accessible via HTTP

---

### P1-07 — Fix broken `/accounts` link on landing page

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #7 |
| **Bug Ref**    | BUG-034 |
| **Difficulty** | Trivial (1 line) |
| **Risk**       | NONE |
| **Time**       | 1 minute |

**Files:**
- `app/page.tsx` — change `href="/accounts"` → `href="/bank-accounts"`

**Expected Impact:** Landing page nav link no longer returns 404.

---

### P1-08 — Fix BACK button logic in bank transfer confirm screen

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #8 |
| **Bug Ref**    | BUG-035 |
| **Difficulty** | Trivial (1 word) |
| **Risk**       | NONE |
| **Time**       | 1 minute |

**Root Cause:** BACK button on the confirm screen calls `setStep('failure')` — shows the failure screen. Should call `setStep('form')`.

**Files:**
- `app/bank-transfer/page.tsx` — line 197: `setStep('failure')` → `setStep('form')`

**Expected Impact:** Transfer confirmation flow becomes navigable.

---

### P1-09 — Remove SQL query logging (password leak in logs)

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #9 |
| **Bug Ref**    | BUG-031 |
| **Difficulty** | Trivial (delete 1 line) |
| **Risk**       | NONE |
| **Time**       | 1 minute |

**Files:**
- `lib/platform-db.ts` — line 77: delete `console.log('[bank-sql]', sql)`

**Expected Impact:** Plaintext passwords no longer appear in Docker logs.

---

### P1-10 — Add `.env.local` to `.gitignore`

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #10 |
| **Bug Ref**    | BUG-030 |
| **Difficulty** | Trivial |
| **Risk**       | NONE |
| **Time**       | 1 minute |

**Files:**
- `.gitignore` — add `.env.local` entry

**Expected Impact:** Future credentials are not committed to the repository.

---

**Phase 1 Checkpoint:**
After Phase 1, the expected state is:
- All 7 pages return 200 ✓
- All API routes connect to the database ✓
- No credentials leaked in HTTP responses ✓
- No credential dump endpoint ✓
- Process.env protected ✓
- Logs clean ✓

---

---

# PHASE 2 — Core Functional Fixes

> **Goal:** Login works, transfers work, dashboard shows real data. A working banking demo.  
> **Time:** ~2.5 hours  
> **These must be done in the order listed — each fix depends on the previous.**

---

### P2-01 — Replace all SQL string interpolation with parameterized queries

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #1 in Phase 2 — MUST DO BEFORE WIRING AUTH |
| **Bug Ref**    | BUG-025 |
| **Difficulty** | Medium (5 files, ~40 query changes) |
| **Risk**       | MEDIUM — test each route after |
| **Time**       | 45 minutes |

**Root Cause:** Every API route builds SQL via string interpolation. SQL injection is exploitable in all of them.

**Why do this before wiring auth:** Once the login form is connected to the API, real user credentials will flow through these routes. If SQL injection is live when real auth is wired, the auth system is still broken.

**Files (in order):**
1. `lib/platform-db.ts` — update `runStatement(sql)` to accept `runStatement(sql, params)` and pass params to `pool.query(sql, params)`
2. `app/api/auth/login/route.ts` — parameterize username/password
3. `app/api/accounts/route.ts` — parameterize userId
4. `app/api/transactions/route.ts` — parameterize account
5. `app/api/transfer/route.ts` — parameterize all 5 interpolated values
6. `app/api/search/route.ts` — parameterize the search query `q`

**Pattern to apply everywhere:**
```
Before: `WHERE username = '${username}'`
After:  `WHERE username = $1` with params `[username]`
```

**Dependencies:** P1-01 (DB must be connected)

**Expected Impact:**
- SQL injection eliminated across the entire API surface
- Parameterized queries also escape special characters, fixing edge cases with apostrophes in names

---

### P2-02 — Hash passwords using Bun's built-in Argon2id

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #2 in Phase 2 |
| **Bug Ref**    | BUG-028, BUG-029 |
| **Difficulty** | Medium |
| **Risk**       | MEDIUM — seed data must be updated |
| **Time**       | 20 minutes |

**Root Cause:** Passwords and PINs are stored and compared as plaintext strings.

**Key insight:** Bun has a native `password` module (Argon2id) — **no package installation needed**.
```ts
import { password } from 'bun'
const hash = await password.hash('plaintext')
const valid = await password.verify('plaintext', hash)
```

**Files:**
1. `lib/platform-db.ts` — update seed data: pre-hash the seed passwords (use hardcoded known hashes for speed, or hash them programmatically in the seed function)
2. `app/api/auth/login/route.ts` — fetch user by username only, then call `password.verify()` on the result

**Note on PINs:** For hackathon scope, hash PINs in the seed and add a PIN verification step. Full PIN management (change PIN, verify before transfer) can be Phase 4.

**Dependencies:** P2-01 (parameterized queries must be in place first so the login route is safe to extend)

**Expected Impact:**
- Passwords and PINs are no longer readable in any database dump
- Meets basic banking security requirement

---

### P2-03 — Wire the login form to the API

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #3 in Phase 2 |
| **Bug Ref**    | BUG-020 |
| **Difficulty** | Medium |
| **Risk**       | LOW |
| **Time**       | 30 minutes |

**Root Cause:** Login page has no JavaScript connecting the form to `POST /api/auth/login`.

**Files:**
1. `app/(accounts)/login/page.tsx` — add `'use client'`, `useState` for username/password, `onClick` on AuthButton that calls `POST /api/auth/login`, handles success (redirect to `/dashboard`) and error (show message)
2. `app/api/auth/login/route.ts` — fix response: remove `sql` field from response (BUG-009), improve cookie security (see P2-04)

**Dependencies:** P2-01 (no SQL injection), P2-02 (passwords must be hashed before login comparison works)

**Expected Impact:**
- Login flow works end-to-end for the first time
- Users can authenticate with Dilara's or Kasun's credentials

---

### P2-04 — Secure session cookies (HttpOnly, Secure, SameSite=Strict)

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #4 in Phase 2 |
| **Bug Ref**    | BUG-021, BUG-022, BUG-023 |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 15 minutes |

**Root Cause:** Cookies lack `HttpOnly` and `Secure` flags. The "token" is base64(userId:role) — trivially forgeable. Role is stored in a client-readable cookie.

**Strategy for hackathon:** Use a simple opaque session ID approach (no JWT library needed):
1. Generate a `crypto.randomUUID()` as the session ID
2. Store `sessionId → { userId, role }` in a server-side `Map` (in-memory, sufficient for demo)
3. Set one `HttpOnly; Secure; SameSite=Strict` cookie: `session=<uuid>`
4. Middleware reads this cookie and looks up the session

**Files:**
1. `lib/session.ts` — new file: in-memory session store + `createSession()` / `getSession()` helpers
2. `app/api/auth/login/route.ts` — replace token+role cookies with single session cookie
3. Later: `middleware.ts` (P2-05) reads this cookie

**Dependencies:** P2-03 (login must work before securing sessions)

**Expected Impact:**
- Session cookies are not readable by JavaScript (XSS mitigation)
- Role cannot be forged by editing a cookie
- Proper session-based auth foundation

---

### P2-05 — Add `middleware.ts` to protect all routes

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #5 in Phase 2 |
| **Bug Ref**    | BUG-019 |
| **Difficulty** | Medium |
| **Risk**       | MEDIUM — wrong matcher config locks everyone out |
| **Time**       | 20 minutes |

**Root Cause:** No `middleware.ts` exists. Every page and API is public.

**Files:**
- `middleware.ts` — new file at project root

**Implementation:**
```
Protected paths: /dashboard, /bank-accounts, /bank-transfer, /pay-bills, /e-statement, /smart-spend
Protected API paths: /api/accounts, /api/transactions, /api/transfer, /api/search, /api/admin
Public paths: /, /login, /sign-up, /reset-password, /api/auth/login, /api/health, /api/setup
```

Logic: Read `session` cookie → look up in session store → if not found, redirect to `/login` (for pages) or return 401 (for API routes).

**Dependencies:** P2-04 (session store must exist before middleware can check it)

**Critical:** Test with both logged-in and logged-out states immediately after implementing.

**Expected Impact:**
- Unauthenticated users are redirected to login
- API routes return 401 for unauthenticated callers
- Admin endpoint requires `role === 'admin'`

---

### P2-06 — Wire bank transfer to the real API + add transaction safety

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #6 in Phase 2 |
| **Bug Ref**    | BUG-014, BUG-010, BUG-036 (partial) |
| **Difficulty** | Medium |
| **Risk**       | MEDIUM — money movement logic |
| **Time**       | 35 minutes |

**Root Cause:** The bank transfer UI simulates success client-side. The `POST /api/transfer` API exists but is never called. The API also has no balance check and no database transaction.

**Two-part fix:**

**Part A — Fix the API** (`app/api/transfer/route.ts`):
1. Use a dedicated connection from pool: `const client = await pool.connect()`
2. Wrap in `BEGIN`/`COMMIT`/`ROLLBACK`
3. Add balance pre-check: `SELECT balance FROM accounts WHERE account_number = $1 FOR UPDATE`
4. Return 400 if balance < amount
5. Release client in `finally`

**Part B — Wire the UI** (`app/bank-transfer/page.tsx`):
1. Replace the local `handleTransfer()` simulation with a real `fetch('POST /api/transfer', { body: { fromAccount, toAccount, amount, description } })`
2. Read `fromAccount` from the session's default account (fetch from API on mount)
3. Handle API error → show failure step
4. Handle API success → show success step with real transaction ID

**Dependencies:** P2-01 (parameterized queries), P2-05 (middleware for auth), session to know who is transferring

**Expected Impact:**
- Real money movement recorded in the database
- Transfer is atomic — no partial states
- Balance cannot go negative
- The most impressive demo feature works end-to-end

---

### P2-07 — Wire the dashboard to real data

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #7 in Phase 2 |
| **Bug Ref**    | BUG-036 |
| **Difficulty** | Medium |
| **Risk**       | LOW |
| **Time**       | 30 minutes |

**Root Cause:** Dashboard shows "Welcome back, Dilara!" and hardcoded transactions regardless of who is logged in.

**Files:**
- `app/dashboard/page.tsx` — add `useEffect` to fetch from `GET /api/accounts?userId=<session.userId>` and `GET /api/transactions?account=<primaryAccount>`. Display real name, real balance, real recent transactions.

**Dependencies:** P2-05 (middleware so we know who is logged in), P2-01 (safe API)

**Expected Impact:**
- Dashboard shows the logged-in user's name, balance, and real transactions
- Most visible feature for the demo — the first thing a judge sees after login

---

**Phase 2 Checkpoint:**
After Phase 2, the expected demo flow is:
1. User visits `/login` → enters credentials → clicks Sign In ✓
2. Redirected to `/dashboard` → sees real name, balance, transactions ✓
3. Navigates to `/bank-transfer` → enters recipient + amount → transfers real money ✓
4. Balance updates in the database ✓
5. All unauthenticated routes redirect to login ✓
6. SQL injection is eliminated ✓
7. Passwords are hashed ✓

---

---

# PHASE 3 — Security Hardening

> **Goal:** Banking-grade security posture. Impress any security-focused judge.  
> **Time:** ~1.5 hours  
> **These can be done in any order within the phase.**

---

### P3-01 — Restore and protect `/api/admin/system` with role check

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #1 in Phase 3 |
| **Bug Ref**    | BUG-026 (partial — P1-06 gutted it, now restore safely) |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 15 minutes |

**Files:**
- `app/api/admin/system/route.ts` — restore the useful data (users, accounts, audit logs) but: (1) require `role === 'admin'` from session, (2) never include `process.env`, (3) never include passwords or PINs in the response

**Expected Impact:** Admins get a useful dashboard. Non-admins get 403.

---

### P3-02 — Add database constraints for financial integrity

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #2 in Phase 3 |
| **Bug Ref**    | BUG-017, BUG-016 |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 10 minutes |

**Files:**
- `lib/platform-db.ts` — add to schema:
  - `balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0)`
  - `created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`

**Note:** Schema changes require dropping and recreating tables OR running ALTER TABLE. In Docker dev, restart the DB container to re-run the schema (idempotent with `CREATE TABLE IF NOT EXISTS` won't pick up constraint additions — use `ALTER TABLE` statements or reset the volume).

**Expected Impact:** Database enforces financial rules independently of application code. Belt-and-suspenders defense against bugs in transfer logic.

---

### P3-03 — Add database indexes for query performance

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #3 in Phase 3 |
| **Bug Ref**    | BUG-015 |
| **Difficulty** | Trivial |
| **Risk**       | NONE |
| **Time**       | 5 minutes |

**Files:**
- `lib/platform-db.ts` — add to schema:
```sql
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
```

**Expected Impact:** Account and transaction queries become O(log n) instead of O(n). Critical for demo stability under any load.

---

### P3-04 — Write real audit logs for security events

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #4 in Phase 3 |
| **Bug Ref**    | BUG-018 |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 20 minutes |

**Root Cause:** `audit_logs` table exists but nothing writes to it.

**Files:**
- `lib/platform-db.ts` — add `logAudit(event: string, payload: object)` helper
- `app/api/auth/login/route.ts` — log `LOGIN_SUCCESS` and `LOGIN_FAILURE` events
- `app/api/transfer/route.ts` — log `TRANSFER_INITIATED` and `TRANSFER_COMPLETED`
- `middleware.ts` — log `UNAUTHORIZED_ACCESS` attempts

**Hackathon demo value:** The admin can see a live audit trail. This is a compelling security feature to show judges.

**Expected Impact:** Real audit trail exists. Admin dashboard shows meaningful security events.

---

### P3-05 — Fix booted flag race condition with Promise guard

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #5 in Phase 3 |
| **Bug Ref**    | BUG-006 |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 10 minutes |

**Files:**
- `lib/platform-db.ts` — replace `let booted = false` with `let bootPromise: Promise<void> | null = null`

**Expected Impact:** Concurrent startup requests cannot double-initialize the database.

---

### P3-06 — Increase connection pool size

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #6 in Phase 3 |
| **Bug Ref**    | BUG-043 |
| **Difficulty** | Trivial |
| **Risk**       | NONE |
| **Time**       | 1 minute |

**Files:**
- `lib/platform-db.ts` — change `max: 3` → `max: 20`

**Expected Impact:** Application does not hang under concurrent requests.

---

### P3-07 — Remove SQL execution logging from stdout

> Already covered in P1-09. Listed here for completeness if skipped in Phase 1.

---

### P3-08 — Remove `sql` field from login API responses

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #7 in Phase 3 |
| **Bug Ref**    | BUG-009 |
| **Difficulty** | Trivial |
| **Risk**       | NONE |
| **Time**       | 2 minutes |

**Files:**
- `app/api/auth/login/route.ts` — remove `sql` from both success and failure response objects

---

---

# PHASE 4 — UX and Performance

> **Goal:** All features functional. App feels like a real banking product.  
> **Time:** ~1.5 hours

---

### P4-01 — Wire Pay Bills to real account balance

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #1 in Phase 4 |
| **Bug Ref**    | BUG-037 |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 20 minutes |

**Root Cause:** `MOCK_BALANCE = 5000` hardcoded. Bill payment never touches the database.

**Files:**
- `app/pay-bills/page.tsx` — on mount, fetch real balance from `GET /api/accounts`. On successful payment, call a `POST /api/transfer` to the biller's account number (create a system account for billers or use a placeholder account).

**Expected Impact:** Pay Bills becomes a real financial feature, not a simulation.

---

### P4-02 — Wire E-Statement to real transaction data

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #2 in Phase 4 |
| **Bug Ref**    | BUG-038 |
| **Difficulty** | Medium |
| **Risk**       | LOW |
| **Time**       | 30 minutes |

**Files:**
- `app/e-statement/page.tsx` — on account number input blur/submit, call `GET /api/transactions?account=<number>` and populate the statement table with real data. Calculate opening balance, total credits, total debits, and closing balance from transaction history.

**Expected Impact:** E-Statement becomes fully functional and shows real financial history.

---

### P4-03 — Wire Bank Accounts to API

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #3 in Phase 4 |
| **Bug Ref**    | BUG-039 |
| **Difficulty** | Medium |
| **Risk**       | LOW |
| **Time**       | 25 minutes |

**Root Cause:** Add/Edit account calls `alert()` and `console.log()`. No accounts API endpoint accepts POST.

**Files:**
- `app/api/accounts/route.ts` — add `POST` handler to create a new account record
- `app/bank-accounts/page.tsx` — wire `handleAddAccount` to `POST /api/accounts`

---

### P4-04 — Fix Suspense boundary for `useSearchParams`

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #4 in Phase 4 |
| **Bug Ref**    | BUG-040 |
| **Difficulty** | Trivial |
| **Risk**       | NONE |
| **Time**       | 5 minutes |

**Files:**
- `app/bank-accounts/page.tsx` — wrap the component or extract the `useSearchParams` usage into a child component wrapped in `<Suspense fallback={<div>Loading...</div>}>`

---

### P4-05 — Fix Reset Password page

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #5 in Phase 4 |
| **Bug Ref**    | BUG-041 |
| **Difficulty** | Medium |
| **Risk**       | LOW |
| **Time**       | 20 minutes |

**Files:**
- `app/(accounts)/reset-password/page.tsx` — fix button label from "SIGN IN" → "RESET PASSWORD"
- For hackathon: implement a simple mock OTP (generate a 6-digit number, display it on the page since there is no email service, allow the user to enter it back to "verify")
- `app/api/auth/reset-password/route.ts` — new endpoint to update password hash

---

### P4-06 — Delete orphan root-level files

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #6 in Phase 4 |
| **Bug Ref**    | BUG-003 |
| **Difficulty** | Trivial |
| **Risk**       | NONE |
| **Time**       | 1 minute |

**Files:**
- `/layout.tsx` — delete
- `/page.tsx` — delete

---

### P4-07 — Move `ensureDatabase()` to app startup

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #7 in Phase 4 |
| **Bug Ref**    | BUG-044 |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 10 minutes |

**Files:**
- `app/api/health/route.ts` OR a Next.js `instrumentation.ts` file — call `ensureDatabase()` once at app start rather than inside every `runStatement()` call

---

---

# PHASE 5 — Wow Features

> **Goal:** Differentiating features that make Nova Bank memorable for hackathon judges.  
> **Time:** ~2 hours  
> **Do these only after Phases 1–4 are complete.**

---

### P5-01 — Smart Spend analytics dashboard

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #1 in Phase 5 |
| **Demo Value** | Very High |
| **Difficulty** | Medium |
| **Risk**       | LOW |
| **Time**       | 45 minutes |

**What to build:** The Smart Spend page (`/smart-spend`) is currently empty. Transform it into a spending analytics view:
- Categorize transactions by description keyword (e.g., "lunch" → Food, "fee" → Charges, "refund" → Credits)
- Show a breakdown: spending by category, top spending periods
- Display a simple bar or donut chart (pure CSS or SVG — no chart library needed)
- Show "Spend vs. Income" comparison

**Files:**
- `app/smart-spend/page.tsx` — full implementation
- `app/api/transactions/route.ts` — extend to support aggregated category data

**Expected Impact:** This is the feature that justifies the app name "Smart Spend." Highly differentiating for judges.

---

### P5-02 — Working global search

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #2 in Phase 5 |
| **Demo Value** | High |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 20 minutes |

**Root Cause:** The search icon exists in every page header but is not wired to anything.

**Files:**
- Add a search modal or dropdown component
- Wire the search icon's click to open the modal
- On input (debounced 300ms), call `GET /api/search?q=<query>`
- Display results grouped by type (users, accounts, transactions)
- Navigate to the relevant page on result click

**Expected Impact:** Instant, live search across the entire banking system. Very impressive in a demo.

---

### P5-03 — Real-time balance refresh

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #3 in Phase 5 |
| **Demo Value** | High |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 15 minutes |

**What to build:** After a successful transfer, the dashboard balance updates automatically without a page reload. Use a `setInterval` (every 30s) or invalidate balance state after the transfer completes.

**Files:**
- `app/dashboard/page.tsx` — add balance refresh mechanism
- `app/bank-transfer/page.tsx` — trigger parent state refresh on success

**Expected Impact:** The balance visibly updates after a transfer in the demo — instant "wow" moment.

---

### P5-04 — Transaction receipt / confirmation animation

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #4 in Phase 5 |
| **Demo Value** | Medium |
| **Difficulty** | Easy |
| **Risk**       | NONE |
| **Time**       | 20 minutes |

**What to build:** On transfer success, show a styled receipt card with:
- Transaction ID (real ID from DB)
- From account, to account, amount
- Timestamp
- "Download Receipt" button (use `window.print()` for a printable receipt)

**Files:**
- `app/bank-transfer/page.tsx` — enhance the success screen

---

### P5-05 — Logout endpoint and button

| Attribute      | Value |
|----------------|-------|
| **Priority**   | #5 in Phase 5 |
| **Demo Value** | Medium |
| **Difficulty** | Easy |
| **Risk**       | LOW |
| **Time**       | 15 minutes |

**Root Cause:** There is no logout mechanism.

**Files:**
- `app/api/auth/logout/route.ts` — new: delete session from store, clear cookie
- `components/sidebar.tsx` — add logout button at the bottom of the sidebar footer

---

---

## Dependency Graph

```
P1-01 (DB fix)
  └── P2-01 (parameterized SQL)
        └── P2-02 (password hashing)
              └── P2-03 (wire login)
                    └── P2-04 (secure cookies + session store)
                          └── P2-05 (middleware)
                                ├── P2-06 (wire transfer)
                                ├── P2-07 (wire dashboard)
                                └── P3-01 (restore admin endpoint)

P1-02 (CSS fix)
  └── P1-03 (smart-spend placeholder)
        └── P5-01 (smart-spend feature)

P2-06 (wire transfer) ──► P4-01 (pay bills)
P2-07 (wire dashboard) ──► P5-03 (real-time balance)
```

---

## Recommended Implementation Order (Collapsed)

```
PHASE 1:  P1-01 → P1-02 → P1-03 → P1-04 → P1-05 → P1-06 → P1-07 → P1-08 → P1-09 → P1-10
PHASE 2:  P2-01 → P2-02 → P2-03 → P2-04 → P2-05 → P2-06 → P2-07
PHASE 3:  P3-01 → P3-02 → P3-03 → P3-04 → P3-05 → P3-06 → P3-08
PHASE 4:  P4-01 → P4-02 → P4-03 → P4-04 → P4-05 → P4-06 → P4-07
PHASE 5:  P5-01 → P5-02 → P5-03 → P5-04 → P5-05
```

---

## Hackathon Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Middleware locks out everyone | Medium | Test login → dashboard flow immediately after P2-05 |
| Password hashing breaks existing login | Medium | Pre-generate known hashes for seed data |
| DB volume reset wipes data | Low | Use `ON CONFLICT DO NOTHING` in seed — safe to re-run |
| Transfer transaction deadlock | Low | Always lock accounts in consistent order (lower account number first) |
| CSS module change breaks styles | Low | Verify bank-accounts page visually after P1-02 |
| Empty smart-spend causes tsc error | Low | Add placeholder before running any type checks |

---

## What NOT to Do in a Hackathon

- **Do not install new auth libraries** (NextAuth, Lucia, Clerk) — setup time kills momentum; use Bun's built-ins + native crypto
- **Do not add an ORM** (Prisma, Drizzle) — migration overhead; the `pg` pool is fine with parameterized queries
- **Do not rewrite the UI** — the CSS-in-JS pages look good; fix the data layer, not the presentation layer
- **Do not try to fix all 46 bugs** — Phases 1–3 cover the 30 that matter most; the rest are polish
- **Do not add a Redis session store** — an in-memory Map is fine for a hackathon demo
- **Do not start Phase 5 before Phase 2 is working** — a broken demo with smart features is worse than a working demo without them
