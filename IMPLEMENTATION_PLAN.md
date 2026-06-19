# IMPLEMENTATION_PLAN.md — Nova Bank / Smart Spend

> Generated: 2026-06-19  
> Strategy: Hackathon — maximize demo score, minimize risk  
> Source: ARCHITECTURE.md + BUG_REPORT.md + ATTACK_PLAN.md + live verification

---

## Pre-Execution Verification (Confirmed Live — 2026-06-19)

| Route | Expected | Actual | Confirmed? |
|-------|----------|--------|-----------|
| `GET /` | 200 | **200** | YES |
| `GET /login` | 200 | **200** | YES |
| `GET /dashboard` | 200 | **200** | YES (hardcoded data) |
| `GET /smart-spend` | 200 | **500** | YES — empty page.tsx |
| `GET /bank-accounts` | 200 | **500** | YES — CSS Module :root |
| `GET /bank-transfer` | 200 | **500** | YES — CSS Module :root cascade |
| `GET /pay-bills` | 200 | **500** | YES — CSS Module :root cascade |
| `GET /e-statement` | 200 | **500** | YES — CSS Module :root cascade |
| `GET /api/health` | 200 | **500** | YES — DB credential mismatch confirmed |
| `GET /api/auth/login` | 401 | **500** | YES — DB down, but GET handler exists |
| `GET /api/admin/system` | 403 | **500** | YES — DB down, but endpoint is unprotected |

**Root cause confirmed live:**  
`DATABASE_URL=postgresql://postgres:...` but `POSTGRES_USER=postgresql` — the user `postgres` does not exist.  
Every API error currently leaks: `"databaseUrl":"postgresql://postgres:supersecurepassword@db:5432/htn26db"`

**Hackathon starting state:** 3 of 8 pages load. 0 of 9 API routes function. Login button does nothing.

---

## Priority Labels

| Label | Meaning |
|-------|---------|
| MUST DO | Demo breaks without this |
| SHOULD DO | Significantly improves score |
| NICE TO HAVE | Polish only — skip if time is short |

---

## Risk Labels

| Risk | Meaning |
|------|---------|
| NONE | Isolated, zero side effects |
| LOW | Single file, easy revert |
| MEDIUM | Touches shared code, test after |
| HIGH | Cross-cutting, sequence carefully |

---

---

# PHASE A — Foundation

> **Goal:** App boots. All pages load. No credentials leak. DB connected.  
> **Time:** ~45 minutes  
> **This phase is a strict pre-requisite for everything else. Execute in order.**

---

### A-01 — Fix DATABASE_URL username mismatch

| Field | Value |
|-------|-------|
| **ID** | A-01 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 2 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-004 |
| **Is CONFIRMED?** | YES — live response shows `"password authentication failed for user \"postgres\""` |
| **Is Reproducible?** | YES — every single API request fails |
| **Required for Demo?** | YES — nothing works without this |
| **High Impact?** | YES — unblocks the entire backend |
| **Low Risk?** | YES — single string change in .env.local |
| **Unlocks Other Features?** | YES — unlocks every API route |
| **Dependencies** | None |

**Root Cause:** `.env.local` sets `POSTGRES_USER=postgresql` but `DATABASE_URL` uses username `postgres`. PostgreSQL rejects the connection.

**Files Involved:**
- `.env.local` — line 4: `postgres:` → `postgresql:`

**Test Procedure:**
```bash
docker compose restart htn26-challenge-dev
curl http://localhost:3000/api/health
# Expect: {"ok":true,"time":"..."}
```

**Rollback Procedure:** Revert the one-character change in `.env.local` and restart.

---

### A-02 — Remove DB credentials from error responses

| Field | Value |
|-------|-------|
| **ID** | A-02 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 2 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-027 |
| **Is CONFIRMED?** | YES — live: `"databaseUrl":"postgresql://postgres:supersecurepassword@db:5432/htn26db"` in every 500 |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — cannot demo with live credential leak |
| **High Impact?** | YES — immediate credential exposure |
| **Low Risk?** | YES — delete one line |
| **Unlocks Other Features?** | No |
| **Dependencies** | None (do this before any external testing) |

**Files Involved:**
- `lib/platform-db.ts` — `serviceFailure()` function: remove `databaseUrl: connectionString` from the returned object

**Test Procedure:**
```bash
curl http://localhost:3000/api/health
# Response must NOT contain "databaseUrl" or any password
```

**Rollback Procedure:** Re-add the line (but never do this in a real context).

---

### A-03 — Fix CSS Module `:root` selector crashing 4 pages

| Field | Value |
|-------|-------|
| **ID** | A-03 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 10 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-001 |
| **Is CONFIRMED?** | YES — `/bank-accounts`, `/bank-transfer`, `/pay-bills`, `/e-statement` all return 500 |
| **Is Reproducible?** | YES — webpack cache propagates the error |
| **Required for Demo?** | YES — 4 of 6 banking pages are broken |
| **High Impact?** | YES — unblocks 4 pages |
| **Low Risk?** | YES — moving CSS, not logic |
| **Unlocks Other Features?** | YES — unlocks Pay Bills, Bank Transfer, E-Statement, Bank Accounts pages |
| **Dependencies** | A-01 (so pages can load after the fix) |

**Files Involved:**
- `app/bank-accounts/accounts.module.css` — extract the `:root { ... }` block (all CSS custom properties inside it)
- `app/globals.css` — merge those CSS variables into the existing `:root { }` block

**Test Procedure:**
```bash
curl -o /dev/null -w "%{http_code}" http://localhost:3000/bank-accounts
curl -o /dev/null -w "%{http_code}" http://localhost:3000/bank-transfer
curl -o /dev/null -w "%{http_code}" http://localhost:3000/pay-bills
curl -o /dev/null -w "%{http_code}" http://localhost:3000/e-statement
# All four must return 200
```

**Rollback Procedure:** Move the `:root` block back into `accounts.module.css` (reverts to the bug, but recoverable).

---

### A-04 — Fix empty smart-spend page

| Field | Value |
|-------|-------|
| **ID** | A-04 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 5 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-002 |
| **Is CONFIRMED?** | YES — `wc -c` returns 0 bytes, `/smart-spend` returns 500 |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — page crash is embarrassing; also needed for Phase E |
| **High Impact?** | YES — page goes from 500 → 200 |
| **Low Risk?** | YES — adding a new file |
| **Unlocks Other Features?** | YES — unlocks E-05 (Smart Spend analytics) |
| **Dependencies** | A-03 (CSS cascade may affect this page too) |

**Files Involved:**
- `app/smart-spend/page.tsx` — add a default export with Sidebar layout and a `'use client'` directive, matching the pattern of other banking pages (placeholder content)

**Test Procedure:**
```bash
curl -o /dev/null -w "%{http_code}" http://localhost:3000/smart-spend
# Must return 200
```

**Rollback Procedure:** Delete the file content (reverts to empty — breaks again, but nothing else is affected).

---

### A-05 — Delete GET /api/auth/login credential dump

| Field | Value |
|-------|-------|
| **ID** | A-05 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 3 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-008 |
| **Is CONFIRMED?** | YES — GET handler exists in `app/api/auth/login/route.ts` lines 3–17; currently returns 500 only because DB is down |
| **Is Reproducible?** | YES — will return all user passwords once DB is fixed (A-01) |
| **Required for Demo?** | YES — cannot leave a credential dump endpoint live |
| **High Impact?** | YES — removes the most dangerous endpoint |
| **Low Risk?** | YES — delete only, no other code depends on GET handler |
| **Unlocks Other Features?** | No |
| **Dependencies** | None |

**Files Involved:**
- `app/api/auth/login/route.ts` — delete the entire `export async function GET()` block (lines 3–17)

**Test Procedure:**
```bash
curl -X GET http://localhost:3000/api/auth/login
# Must return 405 Method Not Allowed
```

**Rollback Procedure:** Restore the GET handler (reintroduces the vulnerability — do not do this).

---

### A-06 — Neuter /api/admin/system (remove process.env + unauth data dump)

| Field | Value |
|-------|-------|
| **ID** | A-06 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 5 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-026 |
| **Is CONFIRMED?** | YES — endpoint exists with no auth, dumps process.env; currently 500 only because DB is down |
| **Is Reproducible?** | YES — will expose all secrets once DB is fixed |
| **Required for Demo?** | YES — cannot leave live |
| **High Impact?** | YES — removes single worst endpoint |
| **Low Risk?** | YES — temporarily replace with stub; restore safely in Phase D |
| **Unlocks Other Features?** | YES — can properly restore with auth in Phase D |
| **Dependencies** | None |

**Files Involved:**
- `app/api/admin/system/route.ts` — replace the response body with `{ ok: true, status: "admin endpoint — auth required" }` (stub placeholder until Phase D wires real admin auth)

**Test Procedure:**
```bash
curl http://localhost:3000/api/admin/system
# Must NOT contain "password", "env", "DATABASE_URL", or any credential
```

**Rollback Procedure:** Restore original file (reintroduces the vulnerability).

---

### A-07 — Remove SQL query logging (password leak in Docker logs)

| Field | Value |
|-------|-------|
| **ID** | A-07 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 2 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-031 |
| **Is CONFIRMED?** | YES — `console.log('[bank-sql]', sql)` at `lib/platform-db.ts:77` |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — Docker logs will show plaintext passwords once login is wired |
| **High Impact?** | YES — eliminates credential logging |
| **Low Risk?** | YES — delete one line |
| **Unlocks Other Features?** | No |
| **Dependencies** | None |

**Files Involved:**
- `lib/platform-db.ts` — line 77: delete `console.log('[bank-sql]', sql)`

**Test Procedure:**
```bash
docker compose logs htn26-challenge-dev --follow
# Make a login request — no SQL containing passwords should appear in logs
```

**Rollback Procedure:** Re-add the console.log.

---

### A-08 — Fix broken /accounts link on landing page

| Field | Value |
|-------|-------|
| **ID** | A-08 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 1 minute |
| **Risk** | NONE |
| **Bug Ref** | BUG-034 |
| **Is CONFIRMED?** | YES — `app/page.tsx` has `href="/accounts"`, no such route exists |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — first thing a judge might click |
| **High Impact?** | Low on its own, but a 404 on the landing page is a bad first impression |
| **Low Risk?** | YES — single line change |
| **Unlocks Other Features?** | No |
| **Dependencies** | None |

**Files Involved:**
- `app/page.tsx` — change `href="/accounts"` → `href="/bank-accounts"`

**Test Procedure:**
```bash
curl -o /dev/null -w "%{http_code}" http://localhost:3000/accounts
# Still 404 (no route) — but clicking from landing page now goes to /bank-accounts which is 200
```

**Rollback Procedure:** Revert the href.

---

### A-09 — Fix BACK button on transfer confirm screen

| Field | Value |
|-------|-------|
| **ID** | A-09 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 1 minute |
| **Risk** | NONE |
| **Bug Ref** | BUG-035 |
| **Is CONFIRMED?** | YES — `app/bank-transfer/page.tsx` line 197: `setStep('failure')` on BACK button |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — the transfer flow is the core demo |
| **High Impact?** | YES — fixes transfer UX without any risk |
| **Low Risk?** | YES — one word change |
| **Unlocks Other Features?** | Yes — enables smooth Phase C transfer demo |
| **Dependencies** | A-03 (page must load) |

**Files Involved:**
- `app/bank-transfer/page.tsx` — line ~197: change `setStep('failure')` → `setStep('form')` on the confirm screen's BACK button

**Test Procedure:** Navigate to `/bank-transfer`, enter a transfer, click Confirm, click BACK — must return to form, not show failure screen.

**Rollback Procedure:** Revert the one word.

---

### A-10 — Add suppression for hydration warning on body element

| Field | Value |
|-------|-------|
| **ID** | A-10 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 1 minute |
| **Risk** | NONE |
| **Bug Ref** | BUG-005 |
| **Is CONFIRMED?** | YES — browser extensions inject `cz-shortcut-listen` attribute |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but console errors during demo look bad |
| **High Impact?** | LOW |
| **Low Risk?** | YES |
| **Unlocks Other Features?** | No |
| **Dependencies** | None |

**Files Involved:**
- `app/layout.tsx` — add `suppressHydrationWarning` prop to the `<body>` element

**Test Procedure:** Open browser devtools during demo — no hydration warning should appear.

**Rollback Procedure:** Remove the prop.

---

**Phase A Checkpoint:**

After Phase A, the expected state:
- `GET /api/health` → 200 with DB timestamp ✓
- All 8 pages return 200 ✓
- No credentials in any HTTP response ✓
- No credential dump GET endpoint ✓
- `process.env` not accessible via HTTP ✓
- SQL not logged to Docker stdout ✓
- Landing page nav works ✓
- Transfer BACK button works ✓

**Validation command:**
```bash
for path in / /login /dashboard /smart-spend /bank-accounts /bank-transfer /pay-bills /e-statement; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$path)
  echo "$code $path"
done
```
All must return 200.

---

---

# PHASE B — Authentication

> **Goal:** Login works. Session exists. Protected routes redirect unauthenticated users.  
> **Time:** ~2.5 hours  
> **Execute in strict order — each task depends on the previous.**

---

### B-01 — Replace all SQL string interpolation with parameterized queries

| Field | Value |
|-------|-------|
| **ID** | B-01 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 45 minutes |
| **Risk** | MEDIUM — 5 files, ~40 query changes; test each route after |
| **Bug Ref** | BUG-025 |
| **Is CONFIRMED?** | YES — static analysis confirms string interpolation in all 5 API routes |
| **Is Reproducible?** | YES — exploit confirmed in ATTACK_PLAN |
| **Required for Demo?** | YES — must not wire login to a SQL-injectable backend |
| **High Impact?** | YES — eliminates complete system compromise vector |
| **Low Risk?** | NO — medium risk; each file must be tested |
| **Unlocks Other Features?** | YES — makes it safe to wire login, transfer, search |
| **Dependencies** | A-01 (DB must be connected to test) |

**Files Involved:**
1. `lib/platform-db.ts` — update `runStatement(sql)` → `runStatement(sql, params?: unknown[])`, pass params to `pool.query(sql, params)`
2. `app/api/auth/login/route.ts` — `WHERE username = $1` with `[username]`; fetch user first, verify password separately
3. `app/api/accounts/route.ts` — `WHERE a.user_id = $1` with `[userId]`
4. `app/api/transactions/route.ts` — `WHERE from_account = $1 OR to_account = $1` with `[account]`
5. `app/api/transfer/route.ts` — parameterize all 5 interpolated values (fromAccount, toAccount, amount x2, description)
6. `app/api/search/route.ts` — `WHERE username ILIKE $1` with `['%' + q + '%']`

**Pattern:**
```
Before: `WHERE username = '${username}'`
After:  `WHERE username = $1`, params: [username]
```

**Test Procedure:** After each file:
```bash
curl "http://localhost:3000/api/accounts?userId=1%27%20OR%20%271%27%3D%271"
# Must NOT return data for all users — injection must be neutralized
curl "http://localhost:3000/api/health"
# Must still return 200 (verifies no regression)
```

**Rollback Procedure:** Each file can be reverted independently. Start with `lib/platform-db.ts` and roll back if tests fail.

---

### B-02 — Hash passwords with Bun's native Argon2id

| Field | Value |
|-------|-------|
| **ID** | B-02 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 20 minutes |
| **Risk** | MEDIUM — seed data must be updated; existing plaintext passwords will no longer match |
| **Bug Ref** | BUG-028, BUG-029 |
| **Is CONFIRMED?** | YES — DB schema seed has `'password123'`, `'kasun'`, `'admin'` as literal strings |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — plaintext passwords are a disqualifying finding |
| **High Impact?** | YES — eliminates the most visible security failure |
| **Low Risk?** | NO — medium risk; seed must be updated or login breaks |
| **Unlocks Other Features?** | YES — safe to wire login after this |
| **Dependencies** | B-01 (parameterized queries must be in place first) |

**Implementation Strategy (no package install needed — Bun built-in):**
```ts
import { password } from 'bun'
// Hash: await password.hash('plaintext', { algorithm: 'argon2id' })
// Verify: await password.verify('plaintext', hash)
```

**Files Involved:**
1. `lib/platform-db.ts` — seed data: replace plaintext strings with pre-computed Argon2id hashes (or hash them programmatically in the seed function using `await password.hash(...)`)
2. `app/api/auth/login/route.ts` — change login logic: `SELECT ... WHERE username = $1` (no password in query), then `await password.verify(inputPassword, user.password_hash)`

**Pre-compute seed hashes** (run once to get stable values):
```ts
import { password } from 'bun'
console.log(await password.hash('password123'))  // For dilara
console.log(await password.hash('kasun'))        // For kasun
console.log(await password.hash('admin'))        // For admin
```

**Test Procedure:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dilara","password":"password123"}'
# Must return 200 with session cookie set
```

**Rollback Procedure:** Revert seed data and login route to plaintext comparison (re-introduces the vulnerability).

---

### B-03 — Wire login form to POST /api/auth/login

| Field | Value |
|-------|-------|
| **ID** | B-03 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 30 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-020 |
| **Is CONFIRMED?** | YES — `app/(accounts)/login/page.tsx` has no fetch, no onClick on AuthButton |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — login is the entry point to the entire demo |
| **High Impact?** | YES — the login button finally works |
| **Low Risk?** | YES — adding client-side JS to an existing UI |
| **Unlocks Other Features?** | YES — enables the full authenticated flow |
| **Dependencies** | B-01 (safe SQL), B-02 (passwords hashed) |

**Files Involved:**
1. `app/(accounts)/login/page.tsx` — add `'use client'` (already likely present or needed), `useState` for username/password/error/loading, `handleLogin` async function that calls `fetch('POST /api/auth/login', { body: JSON.stringify({username, password}) })`, on success redirect to `/dashboard` via `router.push`, on failure display error message
2. `app/api/auth/login/route.ts` — remove `sql` field from both success and failure response bodies (BUG-009), also fix: remove the executed SQL from the response

**Test Procedure:**
1. Navigate to `http://localhost:3000/login`
2. Enter `dilara` / `password123` → must redirect to `/dashboard`
3. Enter wrong credentials → must show error message
4. Check response does NOT include `sql` field

**Rollback Procedure:** Remove the onClick handler and fetch from the login page (returns to non-functional UI).

---

### B-04 — Implement secure server-side session store + HttpOnly cookie

| Field | Value |
|-------|-------|
| **ID** | B-04 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 20 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-021, BUG-022, BUG-023 |
| **Is CONFIRMED?** | YES — current cookies: `user_id=1; Path=/; SameSite=Lax` (no HttpOnly, no Secure) |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — trivially forgeable cookies are a scoring killer |
| **High Impact?** | YES — closes session hijacking and role-forgery vectors |
| **Low Risk?** | YES — new file + update one route |
| **Unlocks Other Features?** | YES — middleware (B-05) reads from this session store |
| **Dependencies** | B-03 (login must work before securing the session) |

**Files Involved:**
1. `lib/session.ts` — **NEW FILE**: in-memory `Map<string, {userId: number, role: string, username: string}>` session store with `createSession(data)` → returns UUID, `getSession(id)` → returns data or null, `deleteSession(id)` for logout
2. `app/api/auth/login/route.ts` — on success: call `createSession({userId, role, username})`, set ONE cookie: `session=<uuid>; Path=/; HttpOnly; SameSite=Strict` (add `Secure` in production). Remove the old `user_id` and `role` cookies and the base64 token

**Test Procedure:**
```bash
curl -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dilara","password":"password123"}'
# Response headers must show:
# set-cookie: session=<uuid>; Path=/; HttpOnly; SameSite=Strict
# Must NOT have user_id or role cookies
# Must NOT have readable user data in cookie value
```

**Rollback Procedure:** Revert `app/api/auth/login/route.ts` to the old cookie approach (reintroduces BUG-021/022/023).

---

### B-05 — Add middleware.ts to protect all routes

| Field | Value |
|-------|-------|
| **ID** | B-05 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 25 minutes |
| **Risk** | MEDIUM — wrong matcher locks out everyone; test both states immediately |
| **Bug Ref** | BUG-019 |
| **Is CONFIRMED?** | YES — no `middleware.ts` exists anywhere in the project |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — unauthenticated access to dashboard/transfer is a hard fail |
| **High Impact?** | YES — closes the most critical access control gap |
| **Low Risk?** | NO — medium risk; wrong matcher = lockout |
| **Unlocks Other Features?** | YES — all Phase C features need authenticated context |
| **Dependencies** | B-04 (session store must exist for middleware to check) |

**Files Involved:**
- `middleware.ts` — **NEW FILE** at project root

**Implementation:**
```
Protected pages: /dashboard, /bank-accounts, /bank-transfer, /pay-bills, /e-statement, /smart-spend
Protected API: /api/accounts, /api/transactions, /api/transfer, /api/search, /api/admin
Public paths: /, /login, /sign-up, /reset-password, /api/auth/login, /api/auth/logout, /api/health, /api/setup

Logic:
  1. Read `session` cookie
  2. Look up in session store via getSession()
  3. If null and path is protected page → redirect to /login
  4. If null and path is protected API → return JSON 401
  5. If role !== 'admin' and path is /api/admin/* → return JSON 403
```

**Test Procedure:**
```bash
# Logged-out tests:
curl -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
# Must return 307 (redirect to /login)
curl -o /dev/null -w "%{http_code}" http://localhost:3000/api/accounts
# Must return 401

# Logged-in tests:
SESSION=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dilara","password":"password123"}' \
  -c /tmp/cookies.txt)
curl -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard \
  -b /tmp/cookies.txt
# Must return 200
```

**Rollback Procedure:** Delete `middleware.ts` (reverts to fully public — safe to roll back but re-introduces the vulnerability).

---

**Phase B Checkpoint:**

After Phase B, the expected state:
- Login with valid credentials → redirected to dashboard ✓
- Login with invalid credentials → error message shown ✓
- Unauthenticated visit to /dashboard → redirected to /login ✓
- `/api/accounts` without session → 401 ✓
- `/api/admin/system` as non-admin → 403 ✓
- Cookies are HttpOnly (not readable by JS) ✓
- No SQL injection possible in any route ✓
- Passwords stored as Argon2id hashes ✓

---

---

# PHASE C — Core Banking

> **Goal:** Dashboard shows real data. Transfer is real. Pay Bills works. E-Statement works.  
> **Time:** ~1.5 hours  
> **The core demo flow. Every task here is MUST DO.**

---

### C-01 — Wire dashboard to real user data

| Field | Value |
|-------|-------|
| **ID** | C-01 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 30 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-036 |
| **Is CONFIRMED?** | YES — dashboard shows "Welcome back, Dilara!" and a hardcoded transaction array regardless of who logs in |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — first thing a judge sees after login |
| **High Impact?** | YES — highest visibility feature |
| **Low Risk?** | YES — adding data fetching to existing component |
| **Unlocks Other Features?** | YES — unlocks E-03 (real-time balance) |
| **Dependencies** | B-05 (middleware must exist so we know who is logged in) |

**Files Involved:**
- `app/dashboard/page.tsx` — add `'use client'`, `useEffect` to:
  1. Fetch `/api/session` (or read from a `/api/auth/me` endpoint) to get current user info
  2. Fetch `GET /api/accounts?userId=<session.userId>` for balance + account number
  3. Fetch `GET /api/transactions?account=<primaryAccountNumber>` for recent transactions
  4. Replace hardcoded "Dilara" with `session.username` / `session.full_name`
  5. Replace hardcoded balance with real balance
  6. Replace hardcoded transactions array with real data

**Note:** Need a `/api/auth/me` route to expose session data to the client, OR pass userId via the session cookie (currently the session is opaque).

**Additional file:**
- `app/api/auth/me/route.ts` — **NEW**: read session cookie, call `getSession()`, return `{userId, username, role}`

**Test Procedure:**
1. Log in as `dilara` → dashboard must show Dilara's name and real balance
2. Log in as `kasun` → dashboard must show Kasun's name and his balance
3. Make a transfer → balance on dashboard must reflect the new amount (after refresh)

**Rollback Procedure:** Revert `app/dashboard/page.tsx` to the hardcoded array version.

---

### C-02 — Wire bank transfer to real API with atomic transaction

| Field | Value |
|-------|-------|
| **ID** | C-02 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 40 minutes |
| **Risk** | MEDIUM — money movement; transaction atomicity is critical |
| **Bug Ref** | BUG-014, BUG-010 |
| **Is CONFIRMED?** | YES — `handleTransfer()` in bank-transfer/page.tsx uses Math.random() and never calls the API |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — the most impressive feature must work |
| **High Impact?** | YES — the centrepiece of the banking demo |
| **Low Risk?** | NO — medium risk; fix API first, then wire UI |
| **Unlocks Other Features?** | YES — unlocks C-03 (Pay Bills), E-03 (balance refresh) |
| **Dependencies** | B-01 (parameterized SQL), B-05 (auth middleware) |

**Two-part fix:**

**Part A — Fix POST /api/transfer** (`app/api/transfer/route.ts`):
1. Use `const client = await pool.connect()` for a dedicated connection
2. Wrap the three SQL statements in `BEGIN` / `COMMIT` / `ROLLBACK`
3. Add balance pre-check: `SELECT balance FROM accounts WHERE account_number = $1 FOR UPDATE`
4. Return HTTP 400 if balance < amount (or account not found)
5. `finally { client.release() }`

**Part B — Wire the UI** (`app/bank-transfer/page.tsx`):
1. On mount, fetch the user's accounts from `/api/accounts` (via session userId) to get `fromAccount`
2. Replace local `handleTransfer()` simulation with real `fetch('POST /api/transfer', { body: JSON.stringify({fromAccount, toAccount, amount, description}) })`
3. On API 200 → `setStep('success')` with real transaction ID from response
4. On API 400 (insufficient funds) → `setStep('failure')`
5. On API error → show error message

**Test Procedure:**
```bash
# Valid transfer:
curl -X POST http://localhost:3000/api/transfer \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"fromAccount":"1000003423","toAccount":"1000005678","amount":100,"description":"test"}'
# Must return 200 with transaction ID

# Overdraft test:
curl -X POST http://localhost:3000/api/transfer \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"fromAccount":"1000003423","toAccount":"1000005678","amount":99999999}'
# Must return 400 "Insufficient funds"

# Balance check:
curl "http://localhost:3000/api/accounts?userId=1" -b /tmp/cookies.txt
# Balance must be reduced by the transferred amount
```

**Rollback Procedure:** Revert `app/api/transfer/route.ts` to non-atomic version (re-introduces BUG-014). Revert `app/bank-transfer/page.tsx` to simulation.

---

### C-03 — Wire Pay Bills to real balance and transfer API

| Field | Value |
|-------|-------|
| **ID** | C-03 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 25 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-037 |
| **Is CONFIRMED?** | YES — `MOCK_BALANCE = 5000` at line 37 of pay-bills/page.tsx |
| **Is Reproducible?** | YES |
| **Required for Demo?** | SHOULD — Pay Bills is a named feature in the nav |
| **High Impact?** | YES — turns a simulation into a real feature |
| **Low Risk?** | YES — same pattern as C-02 Part B |
| **Unlocks Other Features?** | No |
| **Dependencies** | C-02 (transfer API must be fixed first), B-05 (auth) |

**Files Involved:**
- `app/pay-bills/page.tsx` — on mount, fetch real balance; replace `MOCK_BALANCE = 5000` with fetched balance; on payment confirm, call `POST /api/transfer` with biller's account (create system account numbers for billers in seed data: e.g., `9000000001` for CEB, `9000000002` for SLT)

**Test Procedure:**
1. Log in, navigate to Pay Bills
2. Balance shown must match the actual account balance
3. Pay a bill → balance must decrease by the bill amount
4. Overpaying (amount > balance) → must show "Insufficient funds"

**Rollback Procedure:** Revert `pay-bills/page.tsx` to `MOCK_BALANCE = 5000`.

---

### C-04 — Wire E-Statement to real transaction data

| Field | Value |
|-------|-------|
| **ID** | C-04 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 30 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-038 |
| **Is CONFIRMED?** | YES — E-Statement page is a non-interactive shell with empty `<dd>` elements |
| **Is Reproducible?** | YES |
| **Required for Demo?** | SHOULD — named feature in nav |
| **High Impact?** | YES — turns empty shell into functional feature |
| **Low Risk?** | YES — read-only data fetching |
| **Unlocks Other Features?** | No |
| **Dependencies** | B-05 (auth), C-02 (so transactions exist in the DB) |

**Files Involved:**
- `app/e-statement/page.tsx` — on mount, auto-fetch the logged-in user's primary account transactions; populate statement table with real data; calculate opening balance, total credits, total debits, closing balance from transaction history; add date range filter (UI already has the form structure)

**Test Procedure:**
1. Log in, navigate to E-Statement
2. Must show real transactions (especially the ones made during C-02 testing)
3. Totals must be mathematically correct
4. Filtering by date range must narrow the results

**Rollback Procedure:** Revert to empty shell (non-functional but not broken).

---

### C-05 — Add logout endpoint and button

| Field | Value |
|-------|-------|
| **ID** | C-05 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 15 minutes |
| **Risk** | LOW |
| **Bug Ref** | N/A (new feature) |
| **Is CONFIRMED?** | YES — no logout exists anywhere; sidebar has no logout button |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — judges will expect to log out and log in as a different user |
| **High Impact?** | YES — necessary for multi-user demo |
| **Low Risk?** | YES — new endpoint + button |
| **Unlocks Other Features?** | No |
| **Dependencies** | B-04 (session store must exist to delete from) |

**Files Involved:**
1. `app/api/auth/logout/route.ts` — **NEW**: read session cookie, call `deleteSession(sessionId)`, clear cookie with `Max-Age=0`, return 200
2. `components/sidebar.tsx` — add a Logout button/link at the bottom of the sidebar that calls `POST /api/auth/logout` then redirects to `/login`

**Test Procedure:**
1. Log in as dilara
2. Click Logout in sidebar
3. Must redirect to /login
4. Trying to navigate to /dashboard without session → must redirect to /login again (session is gone)

**Rollback Procedure:** Delete the route and remove the sidebar button.

---

**Phase C Checkpoint:**

After Phase C, the expected demo flow:
1. Visit `/login` → enter credentials → click Sign In ✓
2. Redirect to `/dashboard` → see real name, balance, recent transactions ✓
3. Navigate to `/bank-transfer` → transfer money → see real transaction ID ✓
4. Dashboard balance updates on refresh ✓
5. Navigate to `/pay-bills` → pay a bill → balance decreases ✓
6. Navigate to `/e-statement` → see real transaction history ✓
7. Click Logout → redirected to `/login` ✓

---

---

# PHASE D — Security

> **Goal:** Banking-grade security posture. Audit trail. Financial constraints. High security score.  
> **Time:** ~1 hour  
> **These can be done in any order within the phase.**

---

### D-01 — Wrap transfer in database transaction (atomic money movement)

> Already included in C-02 (Part A). Mark as complete if C-02 is done.

---

### D-02 — Add CHECK (balance >= 0) constraint and FK on transactions.created_by

| Field | Value |
|-------|-------|
| **ID** | D-02 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 10 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-017, BUG-016 |
| **Is CONFIRMED?** | YES — schema in lib/platform-db.ts has no CHECK or FK on these columns |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but measurable by judges who inspect the schema |
| **High Impact?** | YES — database-level financial safety net |
| **Low Risk?** | LOW — schema changes require DB restart but data is re-seeded |
| **Unlocks Other Features?** | No |
| **Dependencies** | C-02 must be complete (so balance pre-check in app code also catches it) |

**Files Involved:**
- `lib/platform-db.ts` — schema: add `CHECK (balance >= 0)` to `accounts.balance`, add `REFERENCES users(id) ON DELETE SET NULL` to `transactions.created_by`

**Note:** Since schema uses `CREATE TABLE IF NOT EXISTS`, the constraint will only apply to a fresh DB. Add `ALTER TABLE` statements after the CREATE blocks to apply to existing data:
```sql
ALTER TABLE accounts ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);
ALTER TABLE transactions ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
```

**Test Procedure:**
```bash
# Direct DB test:
docker compose exec db psql -U postgresql -d htn26db \
  -c "UPDATE accounts SET balance = -1 WHERE id = 1;"
# Must fail with: ERROR: new row violates check constraint "chk_balance_non_negative"
```

**Rollback Procedure:** Drop the constraints with `ALTER TABLE ... DROP CONSTRAINT`.

---

### D-03 — Add database indexes for query performance

| Field | Value |
|-------|-------|
| **ID** | D-03 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 5 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-015 |
| **Is CONFIRMED?** | YES — schema defines no indexes beyond implicit UNIQUE |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but noticeably affects performance under any load |
| **High Impact?** | YES under data volume; LOW in hackathon seed data |
| **Low Risk?** | YES — `CREATE INDEX IF NOT EXISTS` is fully safe |
| **Unlocks Other Features?** | YES — enables fast search (Phase E) |
| **Dependencies** | A-01 (DB must be connected) |

**Files Involved:**
- `lib/platform-db.ts` — add to schema initialization:
```sql
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
```

**Test Procedure:**
```bash
docker compose exec db psql -U postgresql -d htn26db \
  -c "\d accounts"
# Must show: idx_accounts_user_id in the index list
```

**Rollback Procedure:** `DROP INDEX IF EXISTS idx_accounts_user_id;` etc.

---

### D-04 — Write real audit logs for login and transfer events

| Field | Value |
|-------|-------|
| **ID** | D-04 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 20 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-018 |
| **Is CONFIRMED?** | YES — audit_logs table exists but nothing writes to it (confirmed via admin endpoint) |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but a live audit trail is a compelling security demo |
| **High Impact?** | YES for demo wow factor |
| **Low Risk?** | YES — fire-and-forget INSERT, never blocks main request |
| **Unlocks Other Features?** | YES — D-05 (admin dashboard) becomes meaningful |
| **Dependencies** | B-03 (login must work), C-02 (transfer must work) |

**Files Involved:**
1. `lib/platform-db.ts` — add `logAudit(event: string, payload: object): Promise<void>` helper that does a non-blocking `INSERT INTO audit_logs(event, payload) VALUES ($1, $2)`
2. `app/api/auth/login/route.ts` — call `logAudit('LOGIN_SUCCESS', {userId, username})` and `logAudit('LOGIN_FAILURE', {username})`
3. `app/api/transfer/route.ts` — call `logAudit('TRANSFER_COMPLETED', {fromAccount, toAccount, amount, txId})`
4. `middleware.ts` — call `logAudit('UNAUTHORIZED_ACCESS', {path, method})` on rejected requests

**Test Procedure:**
```bash
docker compose exec db psql -U postgresql -d htn26db \
  -c "SELECT event, payload, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
# After login + transfer, must show LOGIN_SUCCESS and TRANSFER_COMPLETED events
```

**Rollback Procedure:** Remove `logAudit()` calls — audit table remains but stays empty again.

---

### D-05 — Restore /api/admin/system with proper role-based auth

| Field | Value |
|-------|-------|
| **ID** | D-05 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 15 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-026 (safe restoration) |
| **Is CONFIRMED?** | YES — endpoint was gutted in A-06; now restore it safely |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but useful for showing admin capabilities |
| **High Impact?** | YES for admin demo |
| **Low Risk?** | YES — middleware in B-05 already protects it with role check |
| **Unlocks Other Features?** | No |
| **Dependencies** | B-05 (middleware with role enforcement), D-04 (audit logs to show) |

**Files Involved:**
- `app/api/admin/system/route.ts` — restore useful data (users list without passwords, accounts without PINs, recent audit_logs) but NEVER include `process.env`, passwords, or PINs

**Test Procedure:**
```bash
# As non-admin:
curl http://localhost:3000/api/admin/system -b /tmp/dilara_cookies.txt
# Must return 403

# As admin:
curl http://localhost:3000/api/admin/system -b /tmp/admin_cookies.txt
# Must return user list (no passwords), account list (no PINs), audit logs
# Must NOT contain "password", "pin", "DATABASE_URL", or any env var
```

**Rollback Procedure:** Revert to stub from A-06.

---

### D-06 — Fix booted flag race condition with Promise guard

| Field | Value |
|-------|-------|
| **ID** | D-06 |
| **Priority Label** | **NICE TO HAVE** |
| **Estimated Time** | 10 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-006 |
| **Is CONFIRMED?** | YES — static analysis; `let booted = false` is not atomic |
| **Is Reproducible?** | Low probability in single-dev Docker |
| **Required for Demo?** | NO |
| **High Impact?** | LOW in single-dev context |
| **Low Risk?** | YES |
| **Unlocks Other Features?** | No |
| **Dependencies** | A-01 |

**Files Involved:**
- `lib/platform-db.ts` — replace `let booted = false` / `booted = true` pattern with `let bootPromise: Promise<void> | null = null`

**Rollback Procedure:** Revert the flag approach.

---

### D-07 — Increase connection pool from 3 to 20

| Field | Value |
|-------|-------|
| **ID** | D-07 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 1 minute |
| **Risk** | NONE |
| **Bug Ref** | BUG-043 |
| **Is CONFIRMED?** | YES — `max: 3` in lib/platform-db.ts line 9 |
| **Is Reproducible?** | YES under concurrent load |
| **Required for Demo?** | YES — app hangs with 3+ concurrent requests (judge viewing + Playwright testing) |
| **High Impact?** | YES — prevents demo hang |
| **Low Risk?** | YES |
| **Unlocks Other Features?** | No |
| **Dependencies** | A-01 |

**Files Involved:**
- `lib/platform-db.ts` — change `max: 3` → `max: 20`

**Test Procedure:**
```bash
# Parallel requests:
for i in {1..10}; do curl -s http://localhost:3000/api/health & done; wait
# All 10 must return 200 without hanging
```

**Rollback Procedure:** Change back to 3.

---

**Phase D Checkpoint:**

After Phase D:
- Balance cannot go negative in DB even if app code has a bug ✓
- Audit trail shows login and transfer events ✓
- Admin dashboard is functional but requires admin role ✓
- App handles concurrent requests without hanging ✓
- DB queries use indexes ✓

---

---

# PHASE E — Wow Features

> **Goal:** Differentiating features that win the hackathon. Do these only after Phases A–D are stable.  
> **Time:** ~2 hours

---

### E-01 — Smart Spend analytics dashboard

| Field | Value |
|-------|-------|
| **ID** | E-01 |
| **Priority Label** | **MUST DO** |
| **Estimated Time** | 50 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-002 (page is placeholder after A-04) |
| **Is CONFIRMED?** | YES — `/smart-spend` is a placeholder |
| **Is Reproducible?** | YES |
| **Required for Demo?** | YES — the app is literally named "Smart Spend" |
| **High Impact?** | YES — the differentiating feature |
| **Low Risk?** | YES — standalone page, no shared code |
| **Unlocks Other Features?** | No |
| **Dependencies** | A-04 (placeholder), C-02 (transactions must exist), B-05 (auth) |

**What to build:**
- Fetch all transactions for the logged-in user's accounts
- Categorize by description keyword (e.g., "electricity" / "CEB" → Utilities, "transfer" → Transfers, "lunch" / "food" → Food, "fee" → Bank Charges, default → Other)
- Display: spending breakdown as a pure-CSS or SVG bar chart (no library needed), top categories, spend vs. income comparison, monthly totals
- Use the existing design language (dark theme, card components, purple/blue palette)

**Files Involved:**
- `app/smart-spend/page.tsx` — full implementation
- `app/api/transactions/route.ts` — extend to support `?userId=<id>` (all accounts) in addition to single-account queries

**Test Procedure:**
1. Make several transfers with descriptive descriptions
2. Navigate to Smart Spend
3. Categories must be visually correct
4. Chart must render without errors

**Rollback Procedure:** Revert to the placeholder from A-04.

---

### E-02 — Working global search

| Field | Value |
|-------|-------|
| **ID** | E-02 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 25 minutes |
| **Risk** | LOW |
| **Bug Ref** | N/A (search API exists but UI not wired) |
| **Is CONFIRMED?** | YES — search icon exists in all pages but is not wired |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but impressive live demo feature |
| **High Impact?** | YES — instant live search across the bank is a "wow" moment |
| **Low Risk?** | YES — new component, doesn't touch existing pages |
| **Unlocks Other Features?** | No |
| **Dependencies** | B-01 (safe search API), B-05 (auth middleware) |

**Files Involved:**
- `components/search-modal.tsx` — **NEW**: search input with 300ms debounce, calls `GET /api/search?q=<query>` (with session cookie), shows results grouped by type, navigate on click
- `components/sidebar.tsx` or page headers — wire search icon click to open modal

**Test Procedure:**
1. Click search icon in any page
2. Type "dilara" → must show user result
3. Type an account number → must show account result
4. Type a transaction description → must show transaction result
5. Click a result → must navigate to the correct page

**Rollback Procedure:** Delete `search-modal.tsx` and remove the click handler.

---

### E-03 — Real-time balance refresh after transfer

| Field | Value |
|-------|-------|
| **ID** | E-03 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 15 minutes |
| **Risk** | NONE |
| **Bug Ref** | N/A |
| **Is CONFIRMED?** | YES — dashboard balance does not update until page reload |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but makes the demo feel live |
| **High Impact?** | YES — visible balance drop after transfer is the "wow" moment |
| **Low Risk?** | YES — polling only |
| **Unlocks Other Features?** | No |
| **Dependencies** | C-01 (dashboard wired), C-02 (transfer wired) |

**Files Involved:**
- `app/dashboard/page.tsx` — add `setInterval` (every 15s) to re-fetch balance, OR emit a custom event after successful transfer that the dashboard listens to

**Test Procedure:**
1. Open dashboard in one tab, bank-transfer in another
2. Complete a transfer
3. Switch to dashboard tab — balance must update within 15 seconds without a page reload

**Rollback Procedure:** Remove the interval.

---

### E-04 — Transaction receipt with download

| Field | Value |
|-------|-------|
| **ID** | E-04 |
| **Priority Label** | **SHOULD DO** |
| **Estimated Time** | 20 minutes |
| **Risk** | NONE |
| **Bug Ref** | N/A |
| **Is CONFIRMED?** | YES — success screen shows a generic "Math.random() confirmation" number |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — but makes the transfer feel complete |
| **High Impact?** | YES — professional touch for demo |
| **Low Risk?** | YES — UI only |
| **Unlocks Other Features?** | No |
| **Dependencies** | C-02 (transfer API returns real transaction ID) |

**Files Involved:**
- `app/bank-transfer/page.tsx` — enhance the success step: show a styled receipt card with real transaction ID, from/to accounts, amount, timestamp; add "Print Receipt" button (`window.print()`)

**Test Procedure:**
1. Complete a transfer
2. Success screen must show a real transaction ID (not Math.random())
3. Click "Print Receipt" → browser print dialog must open

**Rollback Procedure:** Revert to the old success screen.

---

### E-05 — Wire Bank Accounts page to API (NICE TO HAVE)

| Field | Value |
|-------|-------|
| **ID** | E-05 |
| **Priority Label** | **NICE TO HAVE** |
| **Estimated Time** | 30 minutes |
| **Risk** | LOW |
| **Bug Ref** | BUG-039 |
| **Is CONFIRMED?** | YES — handleAddAccount calls alert() |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO — bank accounts list is secondary to the transfer demo |
| **High Impact?** | LOW |
| **Low Risk?** | YES |
| **Unlocks Other Features?** | No |
| **Dependencies** | B-05 (auth) |

**Files Involved:**
- `app/api/accounts/route.ts` — add `POST` handler to insert a new account
- `app/bank-accounts/page.tsx` — wire `handleAddAccount` to `POST /api/accounts`

**Rollback Procedure:** Remove the POST handler and revert the onClick.

---

### E-06 — Fix Suspense boundary for useSearchParams (NICE TO HAVE)

| Field | Value |
|-------|-------|
| **ID** | E-06 |
| **Priority Label** | **NICE TO HAVE** |
| **Estimated Time** | 5 minutes |
| **Risk** | NONE |
| **Bug Ref** | BUG-040 |
| **Is CONFIRMED?** | YES — static analysis |
| **Is Reproducible?** | YES |
| **Required for Demo?** | NO |
| **High Impact?** | LOW |
| **Low Risk?** | YES |
| **Unlocks Other Features?** | No |
| **Dependencies** | None |

**Files Involved:**
- `app/bank-accounts/page.tsx` — wrap component in `<Suspense fallback={<div>Loading...</div>}>`

---

---

## Dependency Graph

```
A-01 (DB fix)
  ├── A-02 (remove credential leak)
  ├── D-07 (pool size)
  ├── D-03 (indexes)
  └── B-01 (parameterized SQL)
        └── B-02 (password hashing)
              └── B-03 (wire login)
                    └── B-04 (secure session)
                          └── B-05 (middleware)
                                ├── C-01 (wire dashboard)
                                │     └── E-03 (real-time balance)
                                ├── C-02 (wire transfer)  ← also needs B-01
                                │     ├── C-03 (pay bills)
                                │     ├── C-04 (e-statement)
                                │     └── E-04 (receipt)
                                ├── C-05 (logout)
                                ├── D-04 (audit logs)    ← also needs B-03, C-02
                                │     └── D-05 (admin endpoint)
                                ├── E-01 (smart spend)   ← also needs C-02
                                └── E-02 (global search) ← also needs B-01

A-03 (CSS fix) → A-04 (smart-spend placeholder) → E-01
A-05 (delete GET /api/auth/login)
A-06 (neuter admin) → D-05 (restore safely)
A-07 (remove SQL logging)
A-08 (fix landing page link)
A-09 (fix BACK button) → C-02 (transfer flow)
```

---

## Master Task Summary

| ID | Task | Label | Time | Risk | Phase |
|----|------|-------|------|------|-------|
| A-01 | Fix DATABASE_URL username | **MUST DO** | 2m | NONE | A |
| A-02 | Remove credentials from errors | **MUST DO** | 2m | NONE | A |
| A-03 | Fix CSS Module :root crash | **MUST DO** | 10m | LOW | A |
| A-04 | Fix empty smart-spend page | **MUST DO** | 5m | NONE | A |
| A-05 | Delete GET /api/auth/login dump | **MUST DO** | 3m | NONE | A |
| A-06 | Neuter admin system endpoint | **MUST DO** | 5m | NONE | A |
| A-07 | Remove SQL from stdout logs | **MUST DO** | 2m | NONE | A |
| A-08 | Fix /accounts link on landing | **MUST DO** | 1m | NONE | A |
| A-09 | Fix BACK button on transfer | **MUST DO** | 1m | NONE | A |
| A-10 | Add suppressHydrationWarning | SHOULD DO | 1m | NONE | A |
| B-01 | Parameterized SQL (all routes) | **MUST DO** | 45m | MEDIUM | B |
| B-02 | Hash passwords with Bun Argon2 | **MUST DO** | 20m | MEDIUM | B |
| B-03 | Wire login form to API | **MUST DO** | 30m | LOW | B |
| B-04 | Secure session cookies | **MUST DO** | 20m | LOW | B |
| B-05 | Add middleware.ts protection | **MUST DO** | 25m | MEDIUM | B |
| C-01 | Wire dashboard to real data | **MUST DO** | 30m | LOW | C |
| C-02 | Wire transfer to real API | **MUST DO** | 40m | MEDIUM | C |
| C-03 | Wire Pay Bills to real balance | SHOULD DO | 25m | LOW | C |
| C-04 | Wire E-Statement to real data | SHOULD DO | 30m | LOW | C |
| C-05 | Add logout endpoint + button | **MUST DO** | 15m | LOW | C |
| D-02 | DB constraints (balance check, FK) | SHOULD DO | 10m | LOW | D |
| D-03 | DB indexes | SHOULD DO | 5m | NONE | D |
| D-04 | Write real audit logs | SHOULD DO | 20m | LOW | D |
| D-05 | Restore admin endpoint safely | SHOULD DO | 15m | LOW | D |
| D-06 | Fix boot race condition | NICE TO HAVE | 10m | LOW | D |
| D-07 | Increase pool to 20 | SHOULD DO | 1m | NONE | D |
| E-01 | Smart Spend analytics | **MUST DO** | 50m | LOW | E |
| E-02 | Global search UI | SHOULD DO | 25m | LOW | E |
| E-03 | Real-time balance refresh | SHOULD DO | 15m | NONE | E |
| E-04 | Transaction receipt + print | SHOULD DO | 20m | NONE | E |
| E-05 | Wire Bank Accounts to API | NICE TO HAVE | 30m | LOW | E |
| E-06 | Fix Suspense for useSearchParams | NICE TO HAVE | 5m | NONE | E |

**Total MUST DO time:** ~5h 20m  
**Total SHOULD DO time:** ~2h 30m  
**Total NICE TO HAVE time:** ~45m  
**Grand total (all tasks):** ~8.5 hours

---

## Hackathon Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Middleware locks out everyone | Medium | HIGH | Test immediately after B-05; keep `/login` in public matcher |
| Password hashing breaks login | Medium | HIGH | Pre-generate and hard-code Argon2 hashes for seed data |
| DB volume reset wipes data | Low | MEDIUM | Use `ON CONFLICT DO NOTHING` in seed — safe to re-run |
| Transfer deadlock | Low | MEDIUM | Always acquire account locks in consistent order (lower account_number first) |
| CSS module change breaks styles | Low | LOW | Visually verify /bank-accounts after A-03 |
| Connection pool exhausted during demo | Low | HIGH | D-07 mitigates — increase to 20 before demoing |
| Smart Spend shows no data | Low | MEDIUM | Make several transfers with varied descriptions before the demo |
| Admin session forged for demo | Low | HIGH | B-04 + B-05 close this; never expose role in client-readable cookie |

---

## What NOT to Do

- **Do not install auth libraries** (NextAuth, Clerk, Lucia) — setup time ≫ benefit; Bun's built-ins are sufficient
- **Do not install an ORM** (Prisma, Drizzle) — migration overhead; parameterized `pg` queries are sufficient
- **Do not rewrite the UI** — the existing design is good; fix the data layer only
- **Do not start Phase E before Phase B is verified working** — a broken demo with smart features scores worse than a working demo without them
- **Do not add Redis** — in-memory session Map is sufficient for a hackathon demo
- **Do not try to fix all 46 bugs** — the 31 tasks above cover all high-impact ones
- **Do not add `.env.local` to git** — add it to `.gitignore` (lower priority, do at the end)
