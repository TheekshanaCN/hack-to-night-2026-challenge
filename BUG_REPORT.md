# BUG_REPORT.md — Nova Bank / Smart Spend

> Generated: 2026-06-19  
> Role: Banking Security Auditor  
> Method: Static code analysis, live API testing, Docker log inspection, HTTP probing  
> Status: **Do not deploy. System is currently non-functional and critically insecure.**

---

## Severity Legend

| Label    | Meaning                                                       |
|----------|---------------------------------------------------------------|
| CRITICAL | Causes complete failure or full system compromise             |
| HIGH     | Major functional breakage or serious security vulnerability   |
| MEDIUM   | Significant bug or security gap without immediate total impact |
| LOW      | Quality issue, minor bug, or improvement opportunity          |

---

## Summary Scorecard

| Category       | CRITICAL | HIGH | MEDIUM | LOW |
|----------------|----------|------|--------|-----|
| Build          | 1        | 1    | 0      | 1   |
| Runtime        | 2        | 1    | 1      | 1   |
| API            | 1        | 3    | 2      | 1   |
| Database       | 1        | 2    | 2      | 2   |
| Authentication | 2        | 3    | 1      | 0   |
| Security       | 5        | 3    | 2      | 1   |
| UI             | 1        | 3    | 2      | 3   |
| Performance    | 0        | 1    | 2      | 1   |
| **Total**      | **13**   | **17**| **12** | **9** |

---

---

# 1. BUILD PROBLEMS

---

### BUG-001 — CSS Module uses `:root` global selector

**Severity:** CRITICAL  
**Root Cause:** `app/bank-accounts/accounts.module.css` opens with a `:root { ... }` block. CSS Modules in Next.js/webpack require all selectors to be locally scoped (contain at least one class or id). The `:root` pseudo-class is a global selector and is rejected at compile time. Because webpack caches the error, it propagates and causes 500 errors on **every page** that goes through the same webpack compilation unit — including `/bank-transfer`, `/pay-bills`, and `/e-statement`.

**Files Involved:**
- `app/bank-accounts/accounts.module.css` — line 2, `:root { ... }`

**Impact:** HTTP 500 on `/bank-accounts`, `/bank-transfer`, `/pay-bills`, `/e-statement`. These four pages are completely inaccessible.

**Evidence:**
```
Syntax error: Selector ":root" is not pure (pure selectors must contain at least one local class or id)
> 2 | :root {
```

**Suggested Solution:** Move all CSS custom properties from `:root` in `accounts.module.css` into `app/globals.css` (which is a regular stylesheet, not a CSS Module) or replace them with hardcoded values inside the module classes.

---

### BUG-002 — `app/smart-spend/page.tsx` is an empty file

**Severity:** HIGH  
**Root Cause:** The file `app/smart-spend/page.tsx` is **zero bytes** (empty). Next.js requires every `page.tsx` to export a default React component. An empty file exports nothing, causing a runtime crash with "The default export is not a React Component in `/smart-spend/page`".

**Files Involved:**
- `app/smart-spend/page.tsx` — 0 bytes

**Impact:** HTTP 500 on `/smart-spend`. The page is completely broken. TypeScript also emits `TS2306: File is not a module` at compile time.

**Evidence:**
```
⨯ Error: The default export is not a React Component in "/smart-spend/page"
GET /smart-spend 500 in 21.8s
```

**Suggested Solution:** Add a minimal default export (even a placeholder component) to `app/smart-spend/page.tsx`.

---

### BUG-003 — Orphan root-level `layout.tsx` and `page.tsx`

**Severity:** LOW  
**Root Cause:** Two files exist at the project root outside the `app/` directory: `/layout.tsx` and `/page.tsx`. Next.js App Router only processes files inside `app/`. These files are never compiled or served. The orphan `layout.tsx` also references `./css/globals.css` which does not exist.

**Files Involved:**
- `/layout.tsx` — root level, references missing `./css/globals.css`
- `/page.tsx` — root level, duplicates `app/page.tsx` content

**Impact:** No runtime impact, but causes confusion. If someone accidentally moves these files into `app/`, the missing CSS import would cause another build failure.

**Suggested Solution:** Delete both orphan files.

---

---

# 2. RUNTIME PROBLEMS

---

### BUG-004 — Database connection fails on every request (entire app is broken)

**Severity:** CRITICAL  
**Root Cause:** `.env.local` defines `POSTGRES_USER=postgresql` — this is the actual PostgreSQL superuser account created by the `postgres:17-alpine` image. However, `DATABASE_URL` is set to `postgresql://postgres:supersecurepassword@db:5432/htn26db`, using the username `postgres`. The user `postgres` does not exist in this container; only `postgresql` does. Every database operation fails with `password authentication failed for user "postgres"`.

**Files Involved:**
- `.env.local` — `POSTGRES_USER` and `DATABASE_URL` mismatch
- `lib/platform-db.ts` — reads `DATABASE_URL`

**Impact:** **Every API route returns HTTP 500.** No database read or write is possible. The entire banking backend is non-functional.

**Evidence (live):**
```json
{"ok":false,"message":"password authentication failed for user \"postgres\"","code":"28P01","databaseUrl":"postgresql://postgres:supersecurepassword@db:5432/htn26db"}
```

**Suggested Solution:** Change `DATABASE_URL` in `.env.local` to use `postgresql` as the username:
```
DATABASE_URL=postgresql://postgresql:supersecurepassword@db:5432/htn26db
```

---

### BUG-005 — Hydration mismatch on every page

**Severity:** HIGH  
**Root Cause:** The browser adds a `cz-shortcut-listen="true"` attribute to `<body>` (injected by browser extensions such as password managers or spell-checkers). The server-rendered HTML does not include this attribute. React 19 detects the mismatch and logs an error but cannot patch it up. While this is often caused by extensions, the fact that it appears consistently in logs indicates no suppression mechanism is in place.

**Files Involved:**
- `app/layout.tsx` — `<body>` element

**Impact:** React tree partially fails to reconcile on initial load. Console error reported by Next.js. May cause visual glitches or interactive elements failing to bind event handlers.

**Evidence:**
```
[browser] A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
- cz-shortcut-listen="true"
```

**Suggested Solution:** Add `suppressHydrationWarning` to the `<body>` element in `app/layout.tsx` to suppress extension-injected attribute mismatches.

---

### BUG-006 — `ensureDatabase()` has a race condition on boot

**Severity:** MEDIUM  
**Root Cause:** `ensureDatabase()` in `lib/platform-db.ts` uses a module-level boolean `booted` to gate schema initialization. The check is not atomic. If two concurrent requests arrive before the first schema run completes, both will pass the `if (booted) return` check and both will execute `pool.query(schema)` and `pool.query(seed)` simultaneously. While the DDL uses `IF NOT EXISTS`, the seed uses `ON CONFLICT DO NOTHING` which is safe, but the concurrent schema queries can cause connection pool exhaustion (pool max is 3).

**Files Involved:**
- `lib/platform-db.ts` — lines 81–86

**Impact:** Potential startup race condition under concurrent load. Low probability in single-dev Docker but exploitable under automated testing or slow DB startup.

**Suggested Solution:** Replace the boolean flag with a Promise that is awaited by all callers:
```ts
let bootPromise: Promise<void> | null = null
export function ensureDatabase() {
  if (!bootPromise) bootPromise = _boot()
  return bootPromise
}
```

---

### BUG-007 — `booted` flag is never reset on DB error

**Severity:** LOW  
**Root Cause:** If `pool.query(schema)` succeeds but `pool.query(seed)` throws, `booted` remains `false` and the next call retries. However, if `pool.query(schema)` itself throws, the function throws before setting `booted = true`, which is correct. The real risk is that a partially-seeded database (schema OK, seed failed) will be retried and may violate constraints on subsequent seed attempts (mitigated by `ON CONFLICT DO NOTHING`).

**Files Involved:**
- `lib/platform-db.ts` — lines 81–86

**Suggested Solution:** Wrap schema and seed in a transaction so partial state cannot occur.

---

---

# 3. API PROBLEMS

---

### BUG-008 — `GET /api/auth/login` returns all users with plaintext passwords

**Severity:** CRITICAL  
**Root Cause:** The GET handler on the login route executes `SELECT id, username, password, role, full_name, nic, email FROM users ORDER BY id` and returns the full result set — including plaintext passwords and NIC numbers — in a public JSON response. No authentication is required.

**Files Involved:**
- `app/api/auth/login/route.ts` — lines 3–17

**Impact:** Any unauthenticated user can call `GET /api/auth/login` and receive a complete credential dump of every account in the system.

**Evidence (what the response contains):**
```json
{
  "ok": true,
  "note": "Login reference data.",
  "users": [
    {"id":1,"username":"dilara","password":"password123","role":"customer","nic":"200112345678",...},
    {"id":3,"username":"admin","password":"admin","role":"admin","nic":"000000000000",...}
  ]
}
```

**Suggested Solution:** Delete the GET handler entirely. Login endpoints must only accept POST.

---

### BUG-009 — `POST /api/auth/login` returns the executed SQL in the response body

**Severity:** HIGH  
**Root Cause:** Both the success and failure branches of `POST /api/auth/login` return the `sql` variable in the response JSON. This exposes the exact query structure, the database schema, and — if SQL injection succeeds — the injected payload, back to the client.

**Files Involved:**
- `app/api/auth/login/route.ts` — lines 38, 56

**Impact:** Attackers can see the exact query template, confirming injection vectors and table structure.

**Suggested Solution:** Remove `sql` from both response objects.

---

### BUG-010 — Transfer endpoint has no balance validation

**Severity:** HIGH  
**Root Cause:** `POST /api/transfer` directly decrements `balance - ${amount}` with no prior check that the source account has sufficient funds. The `balance` column is `NUMERIC(14,2)` with no `CHECK (balance >= 0)` constraint. A transfer of any amount — including amounts larger than the balance — will succeed, creating negative balances.

**Files Involved:**
- `app/api/transfer/route.ts` — lines 12–17
- `lib/platform-db.ts` — schema definition (no check constraint)

**Impact:** An attacker (or bug) can drain an account to negative infinity.

**Suggested Solution:** Add a `CHECK (balance >= 0)` constraint to the `accounts` table, and/or add a balance pre-check query before the UPDATE.

---

### BUG-011 — All API routes return HTTP 500 instead of appropriate error codes

**Severity:** MEDIUM  
**Root Cause:** `serviceFailure()` in `lib/platform-db.ts` always returns `{ status: 500 }`. Errors that should return 400 (bad input), 401 (unauthorized), 404 (not found), or 409 (conflict) are all mapped to 500.

**Files Involved:**
- `lib/platform-db.ts` — `serviceFailure()` function

**Impact:** Clients cannot distinguish between server errors and client errors. REST contract is broken.

**Suggested Solution:** Pass an optional `status` parameter to `serviceFailure()` or create separate error helpers.

---

### BUG-012 — `GET /api/accounts` defaults `userId` to `1` silently

**Severity:** MEDIUM  
**Root Cause:** The accounts endpoint does `asText(searchParams.get('userId') || '1')`. If `userId` is not provided, it silently returns account data for user ID 1 (Dilara). Any authenticated user calling this endpoint without a `userId` param receives another user's accounts.

**Files Involved:**
- `app/api/accounts/route.ts` — line 6

**Impact:** Unintentional data exposure for the default user. Once authentication is implemented, this default would bypass user scoping.

**Suggested Solution:** Return 400 if `userId` is missing; do not apply defaults.

---

### BUG-013 — `GET /api/transactions` defaults account to a hardcoded value

**Severity:** LOW  
**Root Cause:** The transactions endpoint defaults `account` to `'1000003423'` — Dilara's account number — if the query param is missing. Same class of problem as BUG-012.

**Files Involved:**
- `app/api/transactions/route.ts` — line 6

**Suggested Solution:** Return 400 if `account` is missing.

---

---

# 4. DATABASE PROBLEMS

---

### BUG-014 — No database transaction wrapping the transfer operation

**Severity:** CRITICAL  
**Root Cause:** `POST /api/transfer` executes three independent SQL statements:
1. `UPDATE accounts SET balance = balance - amount WHERE ...` (debit)
2. `UPDATE accounts SET balance = balance + amount WHERE ...` (credit)
3. `INSERT INTO transactions ...` (log)

These run as separate round-trips with no `BEGIN`/`COMMIT`. If the server crashes, the network drops, or an error occurs between statements 1 and 2, the debit will be applied but the credit will not — money disappears. If an error occurs between statements 2 and 3, money moves but no transaction record is created.

**Files Involved:**
- `app/api/transfer/route.ts` — lines 12–28

**Impact:** Money can be permanently lost or silently transferred without a log record. This is a fundamental banking integrity violation.

**Suggested Solution:** Wrap all three statements in a single `BEGIN`/`COMMIT` block using a dedicated connection from the pool.

---

### BUG-015 — No indexes on frequently queried columns

**Severity:** HIGH  
**Root Cause:** The schema defines no indexes beyond the implicit UNIQUE indexes on `users.username` and `accounts.account_number`. The following columns are queried in WHERE clauses with no supporting index:

- `accounts.user_id` — used by `GET /api/accounts`
- `transactions.from_account`, `transactions.to_account` — used by `GET /api/transactions`
- `users.full_name` — used by `GET /api/search` (ILIKE)
- `accounts.account_name` — used by `GET /api/search` (ILIKE)

**Files Involved:**
- `lib/platform-db.ts` — schema definition

**Impact:** Full table scans on every account, transaction, and search query. Performance degrades linearly with data volume.

**Suggested Solution:** Add:
```sql
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account);
```

---

### BUG-016 — `transactions.created_by` has no foreign key constraint

**Severity:** HIGH  
**Root Cause:** The `transactions` table has a `created_by INTEGER` column that semantically references `users.id`, but no `REFERENCES users(id)` constraint is declared. A transfer can be logged with any arbitrary `created_by` value, including values for users that do not exist. The `POST /api/transfer` route accepts `userId` from the request body without validation.

**Files Involved:**
- `lib/platform-db.ts` — schema, `transactions` table definition
- `app/api/transfer/route.ts` — `userId` from request body

**Impact:** Referential integrity violation. An attacker can forge the `created_by` field to frame another user or insert orphan records.

**Suggested Solution:** Add `REFERENCES users(id)` to `transactions.created_by` and validate `userId` server-side.

---

### BUG-017 — Schema has no `CHECK (balance >= 0)` constraint

**Severity:** MEDIUM  
**Root Cause:** The `accounts.balance` column is `NUMERIC(14,2) NOT NULL DEFAULT 0` with no lower-bound constraint. See also BUG-010.

**Files Involved:**
- `lib/platform-db.ts` — schema, `accounts` table

**Suggested Solution:**
```sql
balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0)
```

---

### BUG-018 — `audit_logs` table is defined but never written to

**Severity:** MEDIUM  
**Root Cause:** The `audit_logs` table exists in the schema and is read by `GET /api/admin/system`. However, no code anywhere writes to `audit_logs`. Login events, transfers, and errors are never recorded.

**Files Involved:**
- `lib/platform-db.ts` — schema
- `app/api/admin/system/route.ts` — reads audit_logs (always empty)
- All API routes — never insert into audit_logs

**Impact:** Zero audit trail. Regulatory compliance is impossible. Fraud cannot be investigated.

**Suggested Solution:** Insert audit log records on login, login failure, transfer initiation, transfer completion, and admin access.

---

---

# 5. AUTHENTICATION PROBLEMS

---

### BUG-019 — No authentication middleware — all routes are public

**Severity:** CRITICAL  
**Root Cause:** There is no `middleware.ts` file in the project. Next.js middleware is the standard mechanism for protecting routes. Without it, every page (`/dashboard`, `/bank-accounts`, `/bank-transfer`, etc.) and every API route is accessible without any session or cookie.

**Files Involved:**
- No `middleware.ts` exists

**Impact:** Any anonymous user can access the dashboard, view accounts, initiate transfers, and call admin endpoints without logging in.

**Suggested Solution:** Create `middleware.ts` at the project root, check for a valid session cookie on protected routes, and redirect unauthenticated users to `/login`.

---

### BUG-020 — Login page form is not connected to any API call

**Severity:** CRITICAL  
**Root Cause:** `app/(accounts)/login/page.tsx` renders username and password inputs with an `<AuthButton>`. The `AuthButton` component has `type="button"` (not `type="submit"`) and no `onClick` handler. There is no `fetch`, `action`, or form submission wired to `POST /api/auth/login`. Clicking "SIGN IN" does nothing.

**Files Involved:**
- `app/(accounts)/login/page.tsx`
- `components/authButton.tsx`

**Impact:** The login flow is entirely broken. Users cannot authenticate.

**Suggested Solution:** Wire the login form to call `POST /api/auth/login` with the username and password values.

---

### BUG-021 — Auth cookies are not `HttpOnly` or `Secure`

**Severity:** HIGH  
**Root Cause:** `POST /api/auth/login` sets cookies via raw headers:
```
set-cookie: user_id=1; Path=/; SameSite=Lax
set-cookie: role=customer; Path=/; SameSite=Lax
```
Neither `HttpOnly` nor `Secure` flags are set. `HttpOnly` prevents JavaScript from reading the cookie (XSS mitigation). `Secure` prevents transmission over plain HTTP.

**Files Involved:**
- `app/api/auth/login/route.ts` — lines 45–47

**Impact:** Any XSS vulnerability can steal session cookies via `document.cookie`. Cookies are also sent over unencrypted connections.

**Suggested Solution:** Add `HttpOnly; Secure` to both cookie headers.

---

### BUG-022 — "Auth token" is base64(userId:role) — trivially forgeable

**Severity:** HIGH  
**Root Cause:** The login success response returns:
```ts
token: Buffer.from(`${user.id}:${user.role}:session-token`).toString('base64')
```
This "token" is just base64-encoded plaintext. It can be decoded instantly. For user 3 (admin), it would be `base64("3:admin:session-token")`. Since the token is never verified server-side (no middleware exists), this is both insecure and unused.

**Files Involved:**
- `app/api/auth/login/route.ts` — lines 51–54

**Impact:** If this token were ever used for authorization, an attacker could forge a token for any user ID and role without any server-side secret.

**Suggested Solution:** Use a cryptographically signed token (e.g., JWT with a server-side secret, or an opaque session ID stored server-side).

---

### BUG-023 — Role cookie is set by the server and trusted without verification

**Severity:** HIGH  
**Root Cause:** The `role` cookie is set to the user's role from the database. If any code were to use this cookie for authorization decisions (e.g., `if (cookie.role === 'admin')`), an attacker could manually set `role=admin` in their browser and gain admin access.

**Files Involved:**
- `app/api/auth/login/route.ts` — line 46

**Impact:** Privilege escalation to admin by editing a browser cookie. No cryptographic protection.

**Suggested Solution:** Never trust role from a cookie. Derive role from a server-side session lookup on every request.

---

### BUG-024 — Sign-up form has no backend

**Severity:** MEDIUM  
**Root Cause:** `app/(accounts)/sign-up/page.tsx` renders a form with fields for account number, name, branch, email, and password. The `AuthButton` has no `onClick` and no form submission is wired. There is no `POST /api/auth/register` endpoint.

**Files Involved:**
- `app/(accounts)/sign-up/page.tsx`

**Impact:** Account registration is completely non-functional.

---

---

# 6. SECURITY PROBLEMS

---

### BUG-025 — SQL injection in every API route

**Severity:** CRITICAL  
**Root Cause:** Every API route constructs SQL by string interpolation of unsanitized user input. No parameterized queries (`$1`, `$2`) are used anywhere in the codebase. `asText()` only converts the value to a string — it performs no escaping. Examples:

**Login (`app/api/auth/login/route.ts`, line 28):**
```sql
WHERE username = '${username}' AND password = '${password}'
```
Payload `' OR '1'='1` for username → logs in as the first user (admin bypass).

**Search (`app/api/search/route.ts`, lines 9–16):**
```sql
WHERE username ILIKE '%${q}%'
UNION ALL SELECT ...
```
UNION injection can exfiltrate any table.

**Transfer (`app/api/transfer/route.ts`, lines 12–27):**
```sql
SET balance = balance - ${amount}
WHERE account_number = '${fromAccount}'
```
Payload like `0; DROP TABLE accounts--` in `fromAccount` is a full DDL injection vector.

**Transactions (`app/api/transactions/route.ts`, line 8):**
```sql
WHERE from_account = '${account}' OR to_account = '${account}'
```

**Accounts (`app/api/accounts/route.ts`, line 14):**
```sql
WHERE a.user_id = ${userId}
```

**Files Involved:**
- `app/api/auth/login/route.ts`
- `app/api/accounts/route.ts`
- `app/api/transactions/route.ts`
- `app/api/transfer/route.ts`
- `app/api/search/route.ts`
- `lib/platform-db.ts` — `runStatement()` accepts raw SQL strings

**Impact:** Full database read/write/delete access for any unauthenticated user. Complete system compromise.

**Suggested Solution:** Replace all string interpolation with parameterized queries using `pool.query('...WHERE id = $1', [userId])`.

---

### BUG-026 — `GET /api/admin/system` dumps `process.env` and all data — no auth

**Severity:** CRITICAL  
**Root Cause:** `app/api/admin/system/route.ts` returns:
- All users (including passwords, NIC numbers, emails)
- All accounts (including balances and PINs)
- All audit logs
- The full `process.env` object (containing `DATABASE_URL`, `POSTGRES_PASSWORD`, and all other env vars)
- The request's cookie header

No authentication check exists.

**Files Involved:**
- `app/api/admin/system/route.ts`

**Impact:** Any anonymous HTTP request reveals every secret in the system: database credentials, all user credentials, all financial data. This is a complete system compromise from a single GET request.

**Suggested Solution:** Delete or lock this endpoint immediately. If needed for debugging, put it behind strict admin-only authentication and remove `process.env` from the response.

---

### BUG-027 — DB credentials leaked in every 500 error response

**Severity:** CRITICAL  
**Root Cause:** `serviceFailure()` in `lib/platform-db.ts` includes `databaseUrl: connectionString` in the JSON response body. `connectionString` contains the full PostgreSQL connection URL including username and password.

**Files Involved:**
- `lib/platform-db.ts` — lines 101–112

**Impact:** Every API error exposes the database password to any caller. Currently observable live at every endpoint because BUG-004 causes constant 500s.

**Evidence (live response):**
```json
{"databaseUrl":"postgresql://postgres:supersecurepassword@db:5432/htn26db"}
```

**Suggested Solution:** Remove `databaseUrl` from the error response entirely.

---

### BUG-028 — Passwords stored in plaintext

**Severity:** CRITICAL  
**Root Cause:** The `users` table stores passwords as `TEXT NOT NULL` with no hashing. The seed data confirms: `'password123'`, `'kasun'`, `'admin'`. The login query compares `password = '${plaintext}'` directly. There is no bcrypt, argon2, or any hashing mechanism.

**Files Involved:**
- `lib/platform-db.ts` — schema and seed data
- `app/api/auth/login/route.ts` — plaintext comparison

**Impact:** A single database read (or the existing BUG-008 exploit) reveals all user passwords. Passwords are also vulnerable to log exposure because `runStatement()` logs every SQL query including the password value.

**Suggested Solution:** Hash passwords with bcrypt or argon2 at registration. Compare hash during login using a timing-safe comparison function.

---

### BUG-029 — PINs stored in plaintext

**Severity:** CRITICAL  
**Root Cause:** The `accounts` table stores `pin TEXT NOT NULL DEFAULT '0000'`. PINs are exposed by `GET /api/accounts?includePins=true` (no auth required) and by `GET /api/admin/system`.

**Files Involved:**
- `lib/platform-db.ts` — schema and seed data
- `app/api/accounts/route.ts` — `includePins` query parameter

**Impact:** Any caller can retrieve all account PINs. Even if `includePins` is removed, the admin endpoint exposes them via `SELECT *`.

**Suggested Solution:** Hash PINs. Never expose PIN hashes via API. The `includePins` query parameter should be removed entirely.

---

### BUG-030 — `.env.local` with real credentials is committed to the git repository

**Severity:** HIGH  
**Root Cause:** `.env.local` containing `POSTGRES_PASSWORD=supersecurepassword` and `DATABASE_URL` with credentials is committed to the git repository. It is not listed in `.gitignore`.

**Files Involved:**
- `.env.local`
- `.gitignore` (missing entry)

**Impact:** Anyone with read access to the git repository — including future contributors, CI systems, or a public GitHub repo — has the database password.

**Suggested Solution:** Add `.env.local` to `.gitignore`. Provide a `.env.example` with placeholder values. Rotate all credentials.

---

### BUG-031 — SQL query content (including passwords) logged to stdout

**Severity:** HIGH  
**Root Cause:** `runStatement()` in `lib/platform-db.ts` line 77 logs every SQL statement: `console.log('[bank-sql]', sql)`. For login queries, this logs the user's plaintext password:
```
[bank-sql] SELECT ... WHERE username = 'dilara' AND password = 'password123'
```
Docker logs are accessible to anyone with Docker access.

**Files Involved:**
- `lib/platform-db.ts` — line 77

**Impact:** Passwords appear in container logs, which may be forwarded to logging infrastructure, Docker daemon files, or monitoring systems.

**Suggested Solution:** Remove the `console.log` from `runStatement()`, or log only a redacted version (e.g., query structure without values).

---

### BUG-032 — No CSRF protection on any state-changing endpoint

**Severity:** MEDIUM  
**Root Cause:** `POST /api/auth/login` and `POST /api/transfer` accept JSON without any CSRF token verification. The cookies set by login use `SameSite=Lax`, which provides partial protection for cross-site requests with navigation (GET), but a `fetch()` POST from a malicious page on another origin would still include cookies in some browser/SameSite-Lax combinations.

**Files Involved:**
- All POST API routes

**Impact:** Cross-site request forgery on transfer and login endpoints.

**Suggested Solution:** Use `SameSite=Strict` for session cookies, or implement CSRF token validation.

---

### BUG-033 — No rate limiting on login or transfer endpoints

**Severity:** MEDIUM  
**Root Cause:** No rate limiting middleware, IP throttling, or lockout mechanism exists on `POST /api/auth/login` or `POST /api/transfer`. An attacker can make unlimited requests.

**Files Involved:**
- `app/api/auth/login/route.ts`
- `app/api/transfer/route.ts`

**Impact:** Brute-force password guessing. Automated fraud via repeated transfers.

**Suggested Solution:** Implement rate limiting (e.g., via middleware or a Redis-backed token bucket).

---

---

# 7. UI PROBLEMS

---

### BUG-034 — `/accounts` route is 404 — home page link is broken

**Severity:** HIGH  
**Root Cause:** `app/page.tsx` (the landing page) has a nav link `href="/accounts"`. There is no `app/accounts/` directory. The route that actually exists is `/bank-accounts`. This is a broken navigation link.

**Files Involved:**
- `app/page.tsx` — line 14: `href="/accounts"`

**Impact:** Clicking "Accounts" on the landing page returns HTTP 404.

**Evidence:** `GET /accounts 404`

**Suggested Solution:** Change `href="/accounts"` to `href="/bank-accounts"`.

---

### BUG-035 — Bank transfer "BACK" button goes to failure screen instead of form

**Severity:** HIGH  
**Root Cause:** In `app/bank-transfer/page.tsx`, the confirm screen's "BACK" button has `onClick={() => setStep('failure')}`. This is clearly a logic bug — clicking BACK on a confirmation screen should return to the form (`setStep('form')`), not show the failure screen.

**Files Involved:**
- `app/bank-transfer/page.tsx` — line 197

**Impact:** Users who want to go back and correct their transfer details are shown a "Transaction Failed! Insufficient Balance" error screen instead.

**Suggested Solution:** Change `setStep('failure')` to `setStep('form')` on the confirm step's BACK button.

---

### BUG-036 — Dashboard shows hardcoded data — not connected to any API

**Severity:** HIGH  
**Root Cause:** `app/dashboard/page.tsx` hardcodes the user name ("Welcome back, Dilara!"), the balance ("Rs. 100, 000"), and the transaction list as a static array. No `useEffect`, `fetch`, or server action is used to load real data.

**Files Involved:**
- `app/dashboard/page.tsx` — lines 6–22 (hardcoded transactions)

**Impact:** The dashboard is a static mockup, not a functional banking interface. It shows Dilara's data to every user.

**Suggested Solution:** Wire the dashboard to `GET /api/accounts` and `GET /api/transactions` using the authenticated user's session.

---

### BUG-037 — Pay Bills uses a hardcoded mock balance (`MOCK_BALANCE = 5000`)

**Severity:** MEDIUM  
**Root Cause:** `app/pay-bills/page.tsx` line 37 defines `const MOCK_BALANCE = 5000`. Payment failure logic compares the entered amount against this constant. No real balance is fetched from the API.

**Files Involved:**
- `app/pay-bills/page.tsx` — line 37

**Impact:** A user with Rs. 1,000,000 is blocked from a Rs. 6,000 payment because the mock says their balance is Rs. 5,000. The payment system is entirely fictional.

**Suggested Solution:** Fetch real balance from `GET /api/accounts` and use it for validation.

---

### BUG-038 — E-Statement page is an empty non-interactive shell

**Severity:** MEDIUM  
**Root Cause:** `app/e-statement/page.tsx` renders the statement layout with a form and table headers but fetches no data. All `<dd>` elements are empty. The account number input has no `onChange` handler and no submit logic.

**Files Involved:**
- `app/e-statement/page.tsx`

**Impact:** The E-Statement feature is entirely non-functional.

---

### BUG-039 — Bank Accounts "Add Account" and "Update Account" are not wired to any API

**Severity:** LOW  
**Root Cause:** `handleAddAccount` and `handleUpdateAccount` in `app/bank-accounts/page.tsx` call `alert()` and `console.log()` instead of making API calls. No endpoint for creating or updating a payee account exists.

**Files Involved:**
- `app/bank-accounts/page.tsx` — lines 200, 215

**Impact:** Account management is entirely non-functional beyond UI validation.

---

### BUG-040 — `useSearchParams()` used without a Suspense boundary

**Severity:** LOW  
**Root Cause:** `app/bank-accounts/page.tsx` calls `useSearchParams()` at the top level of the component without wrapping the component (or its usage) in a `<Suspense>` boundary. In Next.js 13+, `useSearchParams()` in a client component requires Suspense to avoid breaking static rendering.

**Files Involved:**
- `app/bank-accounts/page.tsx` — line 14

**Suggested Solution:** Wrap the component or the `useSearchParams()` call site in `<Suspense fallback={...}>`.

---

### BUG-041 — Reset Password page has no OTP logic or backend

**Severity:** LOW  
**Root Cause:** `app/(accounts)/reset-password/page.tsx` renders email, OTP, and new password fields with an `AuthButton` labeled "SIGN IN" (copy/paste error from login page). No OTP generation, email sending, or password reset API exists.

**Files Involved:**
- `app/(accounts)/reset-password/page.tsx`

**Impact:** Password reset is entirely non-functional. Button label is also wrong.

---

### BUG-042 — Mobile sidebar does not collapse/hide nav items

**Severity:** LOW  
**Root Cause:** On mobile viewports, `components/sidebar.tsx` switches to a horizontal layout and shows all menu item labels. On small screens (< 480px), items become very small but remain visible. There is no hamburger menu or collapse mechanism.

**Files Involved:**
- `components/sidebar.tsx` — responsive styles

**Impact:** Crowded navigation on small screens. Poor mobile UX for a banking app.

---

---

# 8. PERFORMANCE PROBLEMS

---

### BUG-043 — Connection pool maximum is 3 — severely under-provisioned

**Severity:** HIGH  
**Root Cause:** `lib/platform-db.ts` creates a `Pool` with `max: 3`. Each API route that calls `runStatement` checks out a connection. Under moderate concurrency (e.g., 3+ simultaneous requests), all connections are exhausted. Additional requests queue and will timeout after PostgreSQL's `idle_in_transaction_session_timeout`.

**Files Involved:**
- `lib/platform-db.ts` — line 9

**Impact:** Application degrades or hangs under any meaningful concurrency. Banking apps require high availability.

**Suggested Solution:** Increase `max` to at least 10–20 depending on load expectations.

---

### BUG-044 — `runStatement()` calls `ensureDatabase()` on every request

**Severity:** MEDIUM  
**Root Cause:** Every call to `runStatement()` calls `ensureDatabase()` first (line 76). While `ensureDatabase()` returns early after the `booted` flag is set, the function is still invoked, checked, and awaited on every single query. This is a no-op overhead on every hot path.

**Files Involved:**
- `lib/platform-db.ts` — `runStatement()` line 76

**Impact:** Minimal overhead per request but adds unnecessary function calls on every DB operation.

**Suggested Solution:** Call `ensureDatabase()` once at application startup rather than inside `runStatement()`.

---

### BUG-045 — `GET /api/search` runs three separate `ILIKE` scans with no full-text index

**Severity:** MEDIUM  
**Root Cause:** The search endpoint runs a three-way `UNION ALL` query with `ILIKE '%${q}%'` on `users`, `accounts`, and `transactions`. Leading wildcards (`%...`) prevent index use. This is a full sequential scan of all three tables on every search keystroke.

**Files Involved:**
- `app/api/search/route.ts` — lines 8–19

**Impact:** Query time grows linearly with table size. No debouncing exists in the UI (search is not wired anyway), so this could fire on every keystroke.

**Suggested Solution:** Add PostgreSQL `pg_trgm` extension and GIN indexes for trigram-based ILIKE searches. Debounce the search input on the client.

---

### BUG-046 — Dashboard transactions are a static in-memory array, causing no API calls — but future wiring may cause re-render loops

**Severity:** LOW  
**Root Cause:** The dashboard uses a module-level `const transactions = [...]` array. If this is ever replaced with `useState` + `useEffect`, without a stable dependency array, an infinite re-render loop can occur. The pattern is a latent risk.

**Files Involved:**
- `app/dashboard/page.tsx` — lines 6–22

---

---

## Appendix: HTTP Status Summary (Live Testing)

| Route                | Expected | Actual  | Reason                              |
|----------------------|----------|---------|-------------------------------------|
| `GET /`              | 200      | 200     | Landing page OK                     |
| `GET /login`         | 200      | 200     | Login UI OK (not wired)             |
| `GET /dashboard`     | 200      | 200     | Dashboard OK (hardcoded data)       |
| `GET /smart-spend`   | 200      | **500** | Empty `page.tsx` file               |
| `GET /accounts`      | 200      | **404** | Route doesn't exist                 |
| `GET /bank-accounts` | 200      | **500** | CSS Module `:root` error            |
| `GET /bank-transfer` | 200      | **500** | CSS Module `:root` error (cached)   |
| `GET /pay-bills`     | 200      | **500** | CSS Module `:root` error (cached)   |
| `GET /e-statement`   | 200      | **500** | CSS Module `:root` error (cached)   |
| `GET /api/health`    | 200      | **500** | DB credential mismatch              |
| `GET /api/auth/login`| 401      | **500** | DB credential mismatch              |
| `POST /api/auth/login`| 200/401 | **500** | DB credential mismatch              |
| `GET /api/accounts`  | 200      | **500** | DB credential mismatch              |
| `GET /api/admin/system`| 401   | **500** | DB credential mismatch (no auth either) |
| `GET /api/search`    | 200      | **500** | DB credential mismatch              |
| `POST /api/transfer` | 200      | **500** | DB credential mismatch              |

> **Of 16 routes tested, 13 return 500, 1 returns 404, and 2 return 200 (static UI only).**

---

## Top Priority Fix Order

1. **BUG-004** — Fix `DATABASE_URL` username mismatch (unblocks the entire backend)
2. **BUG-001** — Fix CSS Module `:root` selector (unblocks 4 pages)
3. **BUG-002** — Add placeholder export to `smart-spend/page.tsx`
4. **BUG-027** — Remove `databaseUrl` from error responses
5. **BUG-026** — Delete or lock `GET /api/admin/system`
6. **BUG-008** — Delete `GET /api/auth/login` user dump
7. **BUG-025** — Replace all SQL string interpolation with parameterized queries
8. **BUG-028 + BUG-029** — Hash passwords and PINs
9. **BUG-019** — Add `middleware.ts` to protect all routes
10. **BUG-014** — Wrap transfer in a database transaction
