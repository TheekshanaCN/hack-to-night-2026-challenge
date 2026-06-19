# ARCHITECTURE.md — Nova Bank


## 1. Overview

**Nova Bank** is a full-stack banking web application built with **Next.js 16 (App Router)**, **PostgreSQL 17**, and **Bun 1** — running entirely inside Docker Compose. There is no external auth library, no ORM, and no third-party identity provider.

```
Browser
  │
  ├─► Next.js App (port 3000, Bun runtime)
  │     ├─ proxy.ts         — route-level auth guard (replaces middleware.ts)
  │     ├─ lib/session.ts   — in-memory session store (globalThis Map)
  │     ├─ lib/rate-limit.ts— in-memory rate limiter (globalThis Map)
  │     ├─ lib/platform-db.ts — pg Pool + schema boot + migrations + seed
  │     └─ app/api/**       — REST API routes (server components / route handlers)
  │
  ├─► PostgreSQL 17 (port 5432, Docker volume)
  │
  └─► zenmux.ai (HTTPS, AI chatbot only)
        └─ GLM-5.2-free — natural language intent parsing
```

---

## 2. Technology Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Runtime        | Bun 1 (inside Docker)                       |
| Framework      | Next.js 16.2.9, React 19, TypeScript 5.9   |
| Styling        | Tailwind CSS 4, inline `style jsx`          |
| Database       | PostgreSQL 17 (Docker volume)               |
| DB client      | `pg` 8.22 — raw parameterized SQL, no ORM  |
| Password hash  | Argon2id via `Bun.password` (built-in)      |
| Face recognition | `@vladmandic/face-api` 1.7.15 (TF.js)    |
| AI model       | GLM-5.2-free via zenmux.ai (OpenAI-compat) |
| Linter         | Biome 2.4                                   |
| Git hooks      | Lefthook                                    |

---

## 3. Docker Setup

**`compose.yml`** defines two services:

### `htn26-challenge-dev` (Next.js / Bun)
- Built from `Dockerfile` (base: `oven/bun:1`)
- Hot-reloads via `docker compose watch` (file sync + rebuild on `package.json`/`bun.lock` changes)
- Reads secrets from `.env.local` (`env_file`)
- Port `3000:3000`
- Depends on `db` with `service_healthy` condition

### `db` (PostgreSQL 17-alpine)
- Port `5432:5432`
- Persistent volume: `postgres_data`
- Health check: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`

**`.env.local` variables:**
```
POSTGRES_USER=postgresql
POSTGRES_PASSWORD=supersecurepassword
POSTGRES_DB=htn26db
DATABASE_URL=postgresql://postgresql:supersecurepassword@db:5432/htn26db
ZENMUX_API_KEY=sk-ai-v1-...          # AI chatbot — server-side only
```

---

## 4. Folder Structure

```
/
├── app/
│   ├── layout.tsx                   # Root layout (Geist + Bai Jamjuree fonts)
│   ├── page.tsx                     # Landing page
│   ├── proxy.ts                     # Route auth guard (replaces middleware.ts)
│   ├── globals.css
│   │
│   ├── (accounts)/                  # Route group — no sidebar
│   │   ├── layout.tsx               # Background image wrapper
│   │   ├── login/page.tsx           # 3-step: credentials → face setup OR face verify
│   │   ├── sign-up/page.tsx         # 3-step: details → face capture → done
│   │   └── reset-password/page.tsx
│   │
│   ├── dashboard/page.tsx           # Live balance, accounts, transactions + AI chat
│   ├── bank-accounts/page.tsx       # Real accounts from DB, editable name
│   ├── bank-transfer/page.tsx       # form → face ID → confirm → execute
│   ├── pay-bills/page.tsx           # Bill payment flow
│   ├── e-statement/page.tsx         # Account selector + live transaction history
│   ├── smart-spend/page.tsx         # Category analytics + CSS donut chart
│   ├── profile/page.tsx             # Edit name/email/NIC + change password
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts       # POST — rate limited, Argon2id verify, session cookie
│       │   ├── logout/route.ts      # POST — delete session
│       │   ├── me/route.ts          # GET  — session info
│       │   ├── register/route.ts    # POST — sign-up with face descriptor
│       │   ├── face-verify/route.ts # POST — Euclidean distance check (threshold 0.50)
│       │   └── face-setup/route.ts  # POST — one-time enrol for legacy users
│       ├── accounts/
│       │   ├── route.ts             # GET — user's own accounts
│       │   └── [id]/route.ts        # PATCH — rename account (ownership checked)
│       ├── transactions/route.ts    # GET — by account number
│       ├── transfer/route.ts        # POST — atomic BEGIN/COMMIT transfer
│       ├── profile/route.ts         # GET/PATCH — user profile + password change
│       ├── ai/chat/route.ts         # POST — NL intent → account resolution → action
│       ├── search/route.ts          # GET — global search
│       ├── admin/system/route.ts    # GET — admin only (RBAC)
│       ├── health/route.ts          # GET — DB ping
│       └── setup/route.ts           # GET — DB init (dev utility)
│
├── components/
│   ├── sidebar.tsx                  # Nav sidebar — Settings links to /profile
│   ├── FaceCapture.tsx              # Camera + face-api.js (lazy, client-only)
│   ├── AIChat.tsx                   # Floating AI chatbot widget (lazy, client-only)
│   ├── authButton.tsx               # Styled auth button
│   └── Icons.tsx                    # Inline SVG icons
│
├── lib/
│   ├── platform-db.ts              # Pool, schema, migrations[], seed, ensureDatabase()
│   ├── session.ts                  # In-memory session store with expiry + face flag
│   └── rate-limit.ts               # In-memory sliding-window rate limiter
│
├── agents/                         # Agent role definitions (markdown)
├── public/                         # Static assets
├── Dockerfile
├── compose.yml
└── .env.local                      # Secrets (gitignored)
```

---

## 5. Database Schema

Managed in `lib/platform-db.ts`. Applied idempotently on boot via `ensureDatabase()`.

```sql
users (
  id              SERIAL PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  password        TEXT NOT NULL,            -- Argon2id hash
  role            TEXT NOT NULL DEFAULT 'customer',
  full_name       TEXT NOT NULL,
  nic             TEXT,
  email           TEXT,
  face_descriptor JSONB DEFAULT NULL,       -- 128-float array, NULL = not enrolled
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

accounts (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  account_number TEXT UNIQUE NOT NULL,
  account_name   TEXT NOT NULL,
  balance        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pin            TEXT NOT NULL DEFAULT '0000'
)

transactions (
  id           SERIAL PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account   TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'SUCCESS',
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

audit_logs (
  id         SERIAL PRIMARY KEY,
  event      TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

**Indexes:**
```sql
idx_accounts_user_id          ON accounts(user_id)
idx_transactions_from         ON transactions(from_account)
idx_transactions_to           ON transactions(to_account)
idx_transactions_created_at   ON transactions(created_at DESC)
idx_audit_logs_event          ON audit_logs(event)
```

**Migrations (run separately after schema):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor JSONB DEFAULT NULL;
```

**Sequence reset (end of seed):**
```sql
SELECT setval(pg_get_serial_sequence('users','id'),        MAX(id)) FROM users;
SELECT setval(pg_get_serial_sequence('accounts','id'),     MAX(id)) FROM accounts;
SELECT setval(pg_get_serial_sequence('transactions','id'), MAX(id)) FROM transactions;
```

**Seeded users (password is Argon2id hash):**

| username | plain password | role     | face_descriptor |
|----------|---------------|----------|-----------------|
| dilara   | password123   | customer | NULL (enrol on next login) |
| kasun    | kasun         | customer | NULL (enrol on next login) |
| admin    | admin         | admin    | NULL (enrol on next login) |

---

## 6. Authentication & Session Flow

```
POST /api/auth/login
  │
  ├─ Rate limit check (5 attempts → 15min lockout, 10 → 1hr lockout)
  ├─ SELECT user + face_descriptor FROM users WHERE username = $1
  ├─ Bun.password.verify(password, hash)           — Argon2id
  ├─ createSession({ userId, role, username, fullName })
  │     → UUID stored in globalThis.__sessionStore Map
  │     → createdAt + lastSeenAt timestamps set
  ├─ Set-Cookie: session=<uuid>; HttpOnly; SameSite=Strict
  │
  └─ Response:
       requireFaceId: true    → client goes to face verify step
       requireFaceSetup: true → client goes to face enrol step (legacy user)
       neither                → redirect to /dashboard

getSession(id)
  ├─ Checks lastSeenAt + IDLE_MS  (15 min idle timeout)
  ├─ Checks createdAt  + ABSOLUTE_MS (8 hr hard limit)
  ├─ Slides lastSeenAt on every valid access
  └─ Returns null if expired (triggers 401 → redirect to login)
```

**`proxy.ts` (route guard):**
- Runs before every page and API route
- Public routes: `/login`, `/sign-up`, `/reset-password`, `/api/auth/*`, `/api/health`
- All other routes require a valid session cookie; missing/expired → redirect to `/login`

---

## 7. Face ID Flow

### Enrolment (sign-up or first login for legacy users)
```
Browser camera → FaceCapture (mode=register)
  └─ @vladmandic/face-api: TinyFaceDetector + FaceLandmark68Net + FaceRecognitionNet
     → Float32Array[128] descriptor
     → POST /api/auth/register  (sign-up)
     → POST /api/auth/face-setup (legacy enrolment)
         └─ UPDATE users SET face_descriptor = $1 WHERE id = $2
```

### Verification (login + every bank transfer)
```
Browser camera → FaceCapture (mode=verify, auto-scan every 800ms)
  └─ Float32Array[128] descriptor
     → POST /api/auth/face-verify { descriptor, context: 'login'|'transaction' }
         └─ SELECT face_descriptor FROM users WHERE id = $1
            Euclidean distance = sqrt(Σ(a[i]-b[i])²)
            threshold 0.50 — reject if distance ≥ 0.50
            context=login → markFaceVerified(sessionId)
```

**Rejection UX:** Red overlay (`rgba(239,68,68,0.82)`) inside camera viewport with `✕ Wrong Face` + horizontal shake animation. Auto-resumes scanning after 2.5 seconds.

---

## 8. AI Chatbot Architecture

```
User types: "Send 500 to Kasun"
  │
  POST /api/ai/chat  { message: "Send 500 to Kasun" }
  │
  ├─ Auth check (session required)
  ├─ POST https://zenmux.ai/api/v1/chat/completions
  │     model: z-ai/glm-5.2-free
  │     system: token-minimal JSON-forcing prompt
  │     max_tokens: 600  (model needs ~450 for chain-of-thought reasoning)
  │     temperature: 0
  │
  ├─ Parse JSON from response.choices[0].message.content
  │     fallback: scan .reasoning field if content is empty
  │
  ├─ Intent: TRANSFER → resolve recipient from DB (server-side only)
  │     SELECT u.full_name, a.account_number FROM users u JOIN accounts a ...
  │     WHERE LOWER(u.username) LIKE '%kasun%'
  │
  └─ Return to client:
       { action: { type:'TRANSFER', from:{name,masked,account_number},
                   to:{name,masked,account_number}, amount, note } }
         ↑ account_number included for transfer execution
         ↑ AI never saw account numbers, balances, or names
```

**Supported intents:** `TRANSFER`, `PAY_BILL`, `BALANCE`, `TRANSACTIONS`, `UNKNOWN`

**Biller registry** (server-side only, never from AI):
`electricity`, `water`, `internet`, `phone`, `gas`, `tv`

---

## 9. API Route Map

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/health` | GET | No | DB ping |
| `/api/auth/login` | POST | No | Rate-limited login, returns session cookie |
| `/api/auth/logout` | POST | No | Deletes session |
| `/api/auth/me` | GET | Yes | Returns session user info |
| `/api/auth/register` | POST | No | Sign-up with face descriptor |
| `/api/auth/face-verify` | POST | Yes | Verify face against stored descriptor |
| `/api/auth/face-setup` | POST | Yes | One-time face enrolment for legacy users |
| `/api/accounts` | GET | Yes | User's own accounts |
| `/api/accounts/[id]` | PATCH | Yes | Rename account (ownership checked) |
| `/api/transactions` | GET | Yes | Transactions by account number |
| `/api/transfer` | POST | Yes | Atomic balance transfer |
| `/api/profile` | GET | Yes | User profile fields |
| `/api/profile` | PATCH | Yes | Update name/email/NIC or change password |
| `/api/ai/chat` | POST | Yes | AI intent parser + account resolver |
| `/api/search` | GET | Yes | Global search across accounts + transactions |
| `/api/admin/system` | GET | Yes + admin role | System stats + audit log (RBAC) |

---

## 10. Component Hierarchy

```
RootLayout (app/layout.tsx)
│
├── AccountsLayout (app/(accounts)/layout.tsx)  — no sidebar
│   ├── LoginPage      — steps: credentials → setup-face | face
│   ├── SignUpPage     — steps: form → face → done
│   └── ResetPasswordPage
│
└── [Authenticated pages — all guarded by proxy.ts]
    ├── Dashboard
    │   ├── Sidebar
    │   ├── [live accounts, balance, transactions]
    │   └── AIChat (lazy, Suspense)
    │       └── FaceCapture (lazy, Suspense — inside chat panel)
    │
    ├── BankAccountsPage
    │   └── Sidebar
    │
    ├── BankTransferPage   — steps: form → face → confirm → success|failure
    │   ├── Sidebar
    │   └── FaceCapture (lazy, Suspense)
    │
    ├── PayBillsPage
    │   └── Sidebar
    │
    ├── EStatementPage
    │   └── Sidebar
    │
    ├── SmartSpendPage     — keyword categorisation + CSS conic-gradient donut
    │   └── Sidebar
    │
    └── ProfilePage        — tabs: Personal Info | Change Password
        └── Sidebar
```

---

## 11. FaceCapture Component

`components/FaceCapture.tsx` — client-only, lazy-loaded everywhere via `lazy()` + `<Suspense>`.

```
Props:
  mode:         'register' | 'verify'
  onDescriptor: (descriptor: number[]) => void
  onError:      (msg: string) => void
  verifyError?: string   — set by parent after server rejects; triggers red overlay
  prompt?:      string

Internal states: loading | ready | scanning | done | rejected | error

Model loading:
  Module-level faceapiCache — models loaded from CDN once per page session
  CDN: https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model

Import resolution:
  const fa = (await import('@vladmandic/face-api')).default ?? mod
  (handles both ESM default export and CJS named-exports-at-root layouts)

Verify mode: setInterval every 800ms → detectSingleFace → onDescriptor
Register mode: manual Capture button → single detection → onDescriptor
```

---

## 12. Security Summary (Current State)

| Control | Implementation | Status |
|---------|---------------|--------|
| SQL injection prevention | Parameterized queries (`$1, $2`) everywhere | ✅ |
| Password storage | Argon2id via `Bun.password` | ✅ |
| Session management | HttpOnly cookie, UUID, 15min idle / 8hr absolute | ✅ |
| Brute force protection | Sliding-window rate limiter, tiered lockouts | ✅ |
| Biometric auth | Face ID at login + every transfer (threshold 0.50) | ✅ |
| Balance integrity | `CHECK (balance >= 0)` + atomic `BEGIN/COMMIT` | ✅ |
| Route protection | `proxy.ts` — all pages/APIs except public paths | ✅ |
| Admin RBAC | `/api/admin/system` checks `role === 'admin'` | ✅ |
| Audit logging | `logAudit()` on login, transfer, face events | ✅ |
| AI data isolation | API key server-side only; AI never sees account data | ✅ |
| Error responses | No DB credentials or env vars in 500 responses | ✅ |
| PIN storage | Stored plaintext — **not yet hashed** | ⚠️ |
| HTTPS | Not configured (Docker dev only, no TLS termination) | ⚠️ |
| CSRF | SameSite=Strict on session cookie (partial mitigation) | ⚠️ |

---

## 13. Page Completion Status

| Page | UI | API Wired | Real Data | Notes |
|------|----|-----------|-----------|-------|
| Login | ✅ | ✅ | ✅ | 3 steps: creds → setup/verify face |
| Sign-up | ✅ | ✅ | ✅ | 3 steps: form → face → done |
| Reset password | Partial | ❌ | ❌ | UI only |
| Dashboard | ✅ | ✅ | ✅ | Live balance + transactions + AI chat |
| Bank Accounts | ✅ | ✅ | ✅ | Real accounts, editable name |
| Bank Transfer | ✅ | ✅ | ✅ | Atomic, face-gated |
| Pay Bills | ✅ | Partial | — | UI complete, no live biller API |
| E-Statement | ✅ | ✅ | ✅ | Account selector + live transactions |
| Smart Spend | ✅ | ✅ | ✅ | Keyword categorisation, donut chart |
| Profile | ✅ | ✅ | ✅ | Edit name/email/NIC + password change |
| AI Chatbot | ✅ | ✅ | ✅ | Transfer, bills, balance, transactions |

---

## 14. External Services

| Service | Purpose | Auth |
|---------|---------|------|
| `zenmux.ai` | GLM-5.2-free AI model (OpenAI-compatible API) | `ZENMUX_API_KEY` — server-side only |
| `cdn.jsdelivr.net` | `@vladmandic/face-api` model files (TinyFaceDetector etc.) | None — public CDN |

All other functionality is self-contained within Docker.
