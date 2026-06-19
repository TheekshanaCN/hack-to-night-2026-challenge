# ARCHITECTURE.md — Nova Bank / Smart Spend

> Generated: 2026-06-19  
> Status: Investigative snapshot — do not use as a deployment guide.

---

## 1. Overview

This is a **Next.js 16 (App Router) + PostgreSQL 17** banking web application called **Nova Bank / Smart Spend**. It runs entirely inside Docker Compose. There is no external cloud dependency, no auth library, and no ORM.

```
Browser → Next.js App (port 3000) → pg Pool → PostgreSQL (port 5432)
```

The stack:

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Runtime      | Bun 1 (inside Docker)               |
| Framework    | Next.js 16, React 19, TypeScript 5  |
| Styling      | Tailwind CSS 4, CSS-in-JS (`style jsx`) |
| Database     | PostgreSQL 17 (Docker volume)       |
| DB client    | `pg` (node-postgres), raw SQL       |
| Linter       | Biome 2                             |
| Git hooks    | Lefthook                            |

---

## 2. Docker Setup

**compose.yml** defines two services:

### `htn26-challenge-dev` (Next.js app)
- Built from `Dockerfile` (base image: `oven/bun:1`)
- Hot-reloads via `docker compose watch` (file sync + rebuild on `package.json`/`bun.lock` changes)
- `volumes`: `.:/app`, `/app/node_modules`, `/app/.next` — live code sync into container
- Port `3000:3000` exposed to host
- Depends on `db` with `service_healthy` condition

### `db` (PostgreSQL 17)
- Image: `postgres:17-alpine`
- Port `5432:5432` exposed to host (accessible directly from host)
- Persistent volume: `postgres_data`
- Health check: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`

**Environment** (`.env.local`):
```
POSTGRES_USER=postgresql
POSTGRES_PASSWORD=supersecurepassword
POSTGRES_DB=htn26db
DATABASE_URL=postgresql://postgres:supersecurepassword@db:5432/htn26db
```

> Note: `DATABASE_URL` uses username `postgres` but `POSTGRES_USER` is `postgresql` — these are inconsistent. The app connects via `DATABASE_URL`.

---

## 3. Folder Structure

```
/
├── app/                         # Next.js App Router root
│   ├── layout.tsx               # Root layout (fonts: Geist, Bai Jamjuree)
│   ├── page.tsx                 # Landing page — nav links only
│   ├── globals.css              # Global Tailwind + CSS vars
│   ├── (accounts)/              # Route group — login / sign-up / reset
│   │   ├── layout.tsx           # Background image wrapper
│   │   ├── login/page.tsx       # Login form (UI only, no wired API call)
│   │   ├── sign-up/page.tsx     # Sign-up form (UI only, static fields)
│   │   └── reset-password/page.tsx  # Reset password (UI only, no OTP logic)
│   ├── dashboard/page.tsx       # Dashboard — hardcoded mock data
│   ├── bank-accounts/           # Accounts management (client component)
│   │   ├── page.tsx             # Add/Edit/List accounts — UI only
│   │   └── accounts.module.css
│   ├── bank-transfer/           # Transfer flow (client component)
│   │   ├── page.tsx             # Simulated transfer — does NOT call /api/transfer
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── pay-bills/page.tsx       # Bill payment (client component, mock balance)
│   ├── e-statement/page.tsx     # Statement view (empty — no data fetching)
│   ├── smart-spend/page.tsx     # Smart Spend (1-line empty page)
│   └── api/                     # API routes
│       ├── auth/login/route.ts  # POST login, GET user dump
│       ├── accounts/route.ts    # GET accounts by userId
│       ├── transactions/route.ts # GET transactions by account
│       ├── transfer/route.ts    # POST transfer (updates balances)
│       ├── search/route.ts      # GET global search
│       ├── admin/system/route.ts # GET full system dump
│       ├── setup/route.ts       # GET DB init
│       └── health/route.ts      # GET health check
├── components/
│   ├── sidebar.tsx              # Navigation sidebar (client, uses usePathname)
│   ├── authButton.tsx           # Styled button for auth pages
│   └── Icons.tsx                # Inline SVG icon library
├── lib/
│   └── platform-db.ts           # DB connection pool + schema boot + seed
├── agents/                      # Agent role definitions (markdown prompts)
│   ├── architect.md
│   ├── database.md
│   ├── debugger.md
│   ├── reviewer.md
│   └── security.md
├── public/                      # Static assets (logos, billers, avatars)
├── Dockerfile
├── compose.yml
├── .env.local                   # Secrets (committed to repo)
├── package.json
├── tsconfig.json
└── .biome.json
```

---

## 4. Database Schema

Defined inline in `lib/platform-db.ts` — auto-applied on first request via `ensureDatabase()`.

```sql
users (
  id           SERIAL PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,          -- PLAINTEXT
  role         TEXT NOT NULL DEFAULT 'customer',
  full_name    TEXT NOT NULL,
  nic          TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
)

accounts (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id),
  account_number TEXT UNIQUE NOT NULL,
  account_name   TEXT NOT NULL,
  balance        NUMERIC(14,2) DEFAULT 0,
  pin            TEXT NOT NULL DEFAULT '0000'  -- PLAINTEXT
)

transactions (
  id           SERIAL PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account   TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'SUCCESS',
  created_by   INTEGER,               -- no FK constraint
  created_at   TIMESTAMPTZ DEFAULT NOW()
)

audit_logs (
  id         SERIAL PRIMARY KEY,
  event      TEXT NOT NULL,
  payload    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Seeded test users:**

| username | password      | role     |
|----------|---------------|----------|
| dilara   | password123   | customer |
| kasun    | kasun         | customer |
| admin    | admin         | admin    |

**No migrations** — schema is applied idempotently with `CREATE TABLE IF NOT EXISTS`. No rollback mechanism.

**No indexes** beyond the implicit UNIQUE constraint on `users.username` and `accounts.account_number`.

---

## 5. Database Interaction

All DB access goes through `lib/platform-db.ts`:

- `pool` — `pg.Pool` with `max: 3` connections
- `ensureDatabase()` — runs schema + seed SQL once per process boot (guarded by `booted` flag)
- `runStatement(sql)` — calls `ensureDatabase()` then executes raw SQL; logs every query to stdout
- `asText(value)` — coerces any value to string (used before interpolating into SQL)
- `serviceFailure(reason)` — returns 500 JSON including `connectionString` (credential leak)

**All queries use string interpolation — no parameterized queries anywhere.**

---

## 6. API Routes

| Route                     | Method | Auth? | Description                                              |
|---------------------------|--------|-------|----------------------------------------------------------|
| `GET /api/health`         | GET    | No    | DB timestamp + NODE_ENV                                 |
| `GET /api/setup`          | GET    | No    | Initializes DB, returns table list                      |
| `GET /api/auth/login`     | GET    | No    | **Dumps all users with plaintext passwords**            |
| `POST /api/auth/login`    | POST   | No    | Login — SQL injection vulnerable, sets unprotected cookies |
| `GET /api/accounts`       | GET    | No    | Returns accounts for a userId (defaults to 1)           |
| `GET /api/transactions`   | GET    | No    | Returns transactions for an account number              |
| `POST /api/transfer`      | POST   | No    | Executes balance transfer — no auth, no PIN, no transaction |
| `GET /api/search`         | GET    | No    | Global search across users/accounts/transactions         |
| `GET /api/admin/system`   | GET    | No    | **Dumps all users, accounts, audit logs, and `process.env`** |

**No route is protected by authentication or authorization.**

---

## 7. Authentication Flow (Current State)

There is no functioning authentication system.

```
Login Page (UI) → [no fetch call wired] → No session set
```

The login page (`app/(accounts)/login/page.tsx`) renders a form with username/password inputs and an `<AuthButton>` but **no `onClick` or form `action`** is wired to the API.

`POST /api/auth/login` does:
1. Interpolates username + password directly into SQL (`WHERE username = '...' AND password = '...'`)
2. On success: sets two `SameSite=Lax` cookies (`user_id`, `role`) — **no `HttpOnly`, no `Secure`**
3. Returns a "token" that is `base64(userId:role:session-token)` — trivially decodable, not verified anywhere
4. Returns the executed SQL in the response body

**There is no middleware.** No `middleware.ts` file exists. Any user can access any page or API route without logging in.

---

## 8. Component Hierarchy

```
RootLayout (app/layout.tsx)
├── AccountsLayout (app/(accounts)/layout.tsx)
│   ├── LoginPage
│   ├── SignUpPage
│   └── ResetPasswordPage
│       └── AuthButton
└── [Authenticated pages — no auth gate]
    ├── Home (app/page.tsx)
    ├── Dashboard (app/dashboard/page.tsx)
    │   └── Sidebar + Icons
    ├── AccountsPage (app/bank-accounts/page.tsx)
    │   └── Sidebar + Icons
    ├── BankTransferPage (app/bank-transfer/page.tsx)
    │   └── Sidebar
    ├── PayBillsPage (app/pay-bills/page.tsx)
    │   └── Sidebar + Icons
    ├── EStatementPage (app/e-statement/page.tsx)
    │   └── Sidebar
    └── SmartSpendPage (app/smart-spend/page.tsx)
        └── (empty)
```

**Sidebar** — client component, reads `usePathname()` to highlight active nav item. Nav links: Dashboard, Accounts, Bank Transfer, Pay Bills, Smart Spend, E-Statement.

---

## 9. Request Flow — Example: Bank Transfer

The UI transfer flow is **entirely simulated client-side** — it does NOT call `POST /api/transfer`:

```
User fills form → validate() → setStep('confirm') → handleTransfer()
→ Math.random() confirmation number → setStep('success')
```

The actual `POST /api/transfer` API route exists and does execute real DB writes (balance updates + insert into transactions), but nothing in the UI calls it.

---

## 10. Page Completion Status

| Page           | UI       | API wired | Real data |
|----------------|----------|-----------|-----------|
| Login          | Complete | No        | No        |
| Sign-up        | Partial  | No        | No        |
| Reset password | Partial  | No        | No        |
| Dashboard      | Complete | No        | Hardcoded |
| Bank Accounts  | Complete | No        | Hardcoded |
| Bank Transfer  | Complete | No        | Simulated |
| Pay Bills      | Complete | No        | Simulated |
| E-Statement    | Shell    | No        | None      |
| Smart Spend    | Empty    | No        | None      |

---

## 11. Dependencies

### Runtime
- `next` 16.2.9
- `react` / `react-dom` 19.2.4
- `pg` 8.22.0

### Dev
- `typescript` 5.9.3
- `tailwindcss` 4.3.1 + `@tailwindcss/postcss`
- `@biomejs/biome` 2.4.16
- `lefthook` 2.1.9

No auth library (NextAuth, Lucia, Clerk, etc.). No ORM. No validation library. No test framework.

---

## 12. Security Risk Summary (Observation Only)

The following were observed during investigation. This section is descriptive, not prescriptive.

| # | Finding                                    | Location                              |
|---|-------------------------------------------|---------------------------------------|
| 1 | SQL injection — all routes                | All API routes (string interpolation) |
| 2 | Plaintext passwords in DB                 | `lib/platform-db.ts` seed + schema   |
| 3 | GET route dumps all users + passwords     | `GET /api/auth/login`                 |
| 4 | Admin endpoint dumps `process.env` + all data | `GET /api/admin/system`           |
| 5 | DB credentials leaked in 500 responses   | `serviceFailure()` in platform-db.ts  |
| 6 | No authentication middleware              | No `middleware.ts` exists             |
| 7 | Cookies not `HttpOnly` or `Secure`        | `POST /api/auth/login` response       |
| 8 | Auth "token" is base64(userId:role)       | `POST /api/auth/login` response       |
| 9 | `.env.local` committed to repo            | Root `.env.local`                     |
| 10| No CSRF protection                        | Transfer/payment routes               |
| 11| Transfer has no balance check or atomicity| `POST /api/transfer`                  |
| 12| PIN stored in plaintext                   | `accounts.pin` column                 |

---

## 13. External Services

None. The application is fully self-contained within Docker. No third-party APIs, payment gateways, email services, or cloud storage are used.

---

## 14. Known Structural Issues

- **No `middleware.ts`** — all pages and API routes are publicly accessible.
- **Schema-as-code** — the DB schema lives in `lib/platform-db.ts` and is applied on boot with no versioning or migration tooling.
- **`booted` flag is in-memory** — in a multi-worker or multi-process deployment, `ensureDatabase()` could run concurrently.
- **`DATABASE_URL` credential mismatch** — URL uses `postgres` user but `.env.local` declares `POSTGRES_USER=postgresql`.
- **Root-level `layout.tsx` and `page.tsx`** — duplicate files exist at the project root that appear to be orphans from a previous structure. They are not used by Next.js App Router (which only reads from `app/`).
- **`app/bank-transfer/globals.css`** — a second globals.css lives inside the bank-transfer route; unclear if it is imported.
