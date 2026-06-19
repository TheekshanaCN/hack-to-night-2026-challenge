# Session Summary — Nova Bank
**Date:** 2026-06-19 → 2026-06-20  
**Branch:** `feat/security-face-id` (merged into `main` via PR #10)

---

## 1. Bugs & Errors Identified

### 🔴 CRITICAL

| # | Bug | Location | Root Cause |
|---|-----|----------|------------|
| 1 | **"Username already taken" on every registration** | `POST /api/auth/register` | PostgreSQL `SERIAL` sequences start at 1. Seed data inserts users with explicit IDs (1, 2, 3) via `ON CONFLICT DO NOTHING` — but never resets the sequences. First real registration tried `id=1`, hit the primary key unique constraint (error code `23505`), and the catch block returned "Username already taken" for *any* 23505, including pkey collisions. |
| 2 | **`face_descriptor` column does not exist** | `POST /api/auth/register`, `POST /api/auth/face-verify` | The `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor JSONB` was embedded in the same multi-statement string as `CREATE TABLE IF NOT EXISTS`. On a DB where the table already existed, the `CREATE TABLE` was a no-op and the `ALTER TABLE` never reliably fired. |
| 3 | **All AI messages returned "I didn't understand"** | `POST /api/ai/chat` | `GLM-5.2-free` is a chain-of-thought reasoning model. It spends ~450 tokens on internal reasoning in a `reasoning` field before writing output to `content`. With `max_tokens: 100`, all tokens were consumed by reasoning — `content` came back empty, every JSON parse failed. |

**How solved:**
1. Added `SELECT setval(pg_get_serial_sequence(...), MAX(id))` at the end of the seed SQL for all three tables. Applied immediately to the live DB via `docker compose exec db psql`. Also made error handler check `err.constraint` to distinguish pkey vs username conflicts.
2. Moved `ALTER TABLE` out of the schema string into a separate `migrations[]` array that `ensureDatabase()` runs with individual `pool.query()` calls after the main schema. Applied the column directly to the running container.
3. Raised `max_tokens` from `100` to `600` to give the model room to finish reasoning and produce the JSON output. Added a fallback: if `content` is still empty, scan `message.reasoning` for the last `{` and attempt to parse from there.

---

### 🟠 HIGH

| # | Bug | Location | Root Cause |
|---|-----|----------|------------|
| 4 | **`Cannot read properties of undefined (reading 'nets')`** | `FaceCapture.tsx` | `@vladmandic/face-api` ships named exports (`nets`, `detectSingleFace`, etc.) at the module root, not a default export. `(await import(...)).default` returned `undefined`. |
| 5 | **Wrong face shows no visual feedback** | `FaceCapture.tsx`, login, bank-transfer | When the server rejected a face, `onDescriptor` had already fired and the component was in `done` state. The only feedback was a small red text paragraph above the camera — no visual inside the camera view, no camera reset. |

**How solved:**
4. Changed to `const fa = mod.default ?? mod` — resolves correctly for both ESM (default export) and CJS/webpack (named exports at root). Also added a module-level `faceapiCache` so models are only downloaded from CDN once per page session.
5. Added a new `rejected` internal status and a `verifyError?: string` prop to `FaceCapture`. When the parent sets `verifyError` after a failed server check: a red semi-transparent overlay appears inside the camera with a `✕`, "Wrong Face" text, and "Retrying in a moment…". The camera box plays a `fa-shake` keyframe animation. After 2.5 seconds, scanning resumes automatically.

---

### 🟡 MEDIUM

| # | Bug | Location | Root Cause |
|---|-----|----------|------------|
| 6 | **Account number collisions on registration** | `generateAccountNumber()` | Used `Date.now().toString().slice(-4)` — only 4 digits, changes every ~10 seconds. Any two registrations within the same window could collide on the `accounts.account_number` UNIQUE constraint, triggering another misleading "Username already taken" error. |
| 7 | **Legacy users had no Face ID path** | `POST /api/auth/login` | Seed users (dilara, kasun, admin) have `face_descriptor = NULL`. The login API only returned `requireFaceId: Boolean(face_descriptor)` — so `null` meant `false`, and legacy users went straight to dashboard, bypassing Face ID entirely. |

**How solved:**
6. Replaced `Date.now().slice(-4)` with 8 fully random digits. The `userId` prefix (unique by SERIAL) already guarantees cross-user uniqueness, so collisions are essentially impossible.
7. Login API now returns two flags: `requireFaceId` (has face → verify) and `requireFaceSetup` (no face → enrol). New `POST /api/auth/face-setup` endpoint stores the descriptor. Login page gained a `setup-face` step with a one-time enrolment UI.

---

## 2. Security Features Added

### Session Management
| Feature | Detail | Why |
|---------|--------|-----|
| **Session expiry** | 15-min idle timeout + 8-hour absolute cap | Prevents session hijacking from unattended browsers; aligns with banking security standards |
| **Sliding idle window** | `lastSeenAt` updated on every `getSession()` call | Active users stay logged in; inactive sessions expire automatically |
| **Background cleanup** | `setInterval` purges expired sessions every 10 min | Prevents unbounded memory growth in the in-memory session store |
| **HttpOnly cookie** | `session=<uuid>; HttpOnly; SameSite=Strict` | Blocks JavaScript from reading the session token — eliminates XSS-based session theft |

### Rate Limiting
| Feature | Detail | Why |
|---------|--------|-----|
| **Sliding window limiter** | Per-username, in-memory `globalThis` store | Prevents brute-force password attacks without a Redis dependency |
| **Tiered lockout** | 5 failures → 15-min lockout; 10 failures → 1-hour lockout | Escalating penalty slows automated credential stuffing |
| **Auto-clear on success** | `clearAttempts()` called on valid login | Legitimate users who mistype don't stay locked out forever |
| **Registration rate limiting** | Per-IP on `POST /api/auth/register` | Prevents bulk account creation abuse |

### Face ID (Biometric Authentication)
| Feature | Detail | Why |
|---------|--------|-----|
| **Registration gate** | Face descriptor required to complete sign-up | Every account has biometric identity from day one |
| **Login verification** | Face scanned automatically after credentials | Two-factor: something you know (password) + something you are (face) |
| **Transaction gate** | Face verified before every bank transfer | Prevents authorised-but-stolen-session attacks from executing transfers |
| **Euclidean distance matching** | Threshold 0.50 (stricter than default 0.6) | Lower threshold = fewer false positives; important for financial operations |
| **Descriptor stored as JSONB** | 128-float array in PostgreSQL | Server-side matching — descriptor never compared client-side |
| **Legacy user enrolment** | First login after feature launch prompts setup | Ensures all accounts eventually have Face ID, not just new ones |
| **Overwrite protection** | `POST /api/auth/face-setup` returns 409 if descriptor already exists | Prevents silent face replacement; update requires a dedicated flow |
| **Audit logging** | `FACE_VERIFY_SUCCESS`, `FACE_VERIFY_FAILED`, `FACE_SETUP_COMPLETE` with distance score | Forensic trail for every biometric event |

### Database Hardening
| Feature | Detail | Why |
|---------|--------|-----|
| **Parameterized queries** | All SQL uses `$1, $2` placeholders | Eliminates SQL injection — the #1 OWASP risk |
| **`CHECK (balance >= 0)`** | Constraint on `accounts.balance` | Database-level guard; balance can never go negative even if application logic fails |
| **FK on `transactions.created_by`** | `REFERENCES users(id)` | Referential integrity — no orphaned transaction records |
| **5 indexes** | `idx_accounts_user_id`, `idx_transactions_from`, `idx_transactions_to`, `idx_transactions_created_at DESC`, `idx_audit_logs_event` | Prevents full table scans on the most frequently queried columns |
| **Atomic transfers** | `BEGIN → SELECT FOR UPDATE → UPDATE × 2 → INSERT → COMMIT` with `ROLLBACK` on error | Prevents race conditions and partial transfers (money disappearing or doubling) |

### Password Security
| Feature | Detail | Why |
|---------|--------|-----|
| **Argon2id hashing** | `Bun.password.hash(password, { algorithm: 'argon2id' })` | Memory-hard algorithm — GPU cracking attacks are ~1000× slower than bcrypt |
| **Current password verification** | Password change requires current password first | Prevents account takeover if session is compromised |

### RBAC & Admin
| Feature | Detail | Why |
|---------|--------|-----|
| **Admin endpoint RBAC** | `GET /api/admin/system` checks `session.role === 'admin'` | Non-admin users get 403; was previously open to anyone |
| **No sensitive data in responses** | `serviceFailure()` no longer leaks `connectionString` or env vars | Was previously returning `DATABASE_URL` in 500 errors |

---

## 3. New Features Added

### Sign-Up with Face ID (3-step flow)
**What:** Users can create accounts via `/sign-up`. Flow: Details form → Face capture → Auto-login → Dashboard.  
**Why:** The original app had no working sign-up. Users existed only via DB seed.  
**Advantages:**
- Self-service onboarding — no admin needed to create accounts
- Face ID captured at registration ensures every new account has biometric identity
- Auto-login after registration removes friction
- Default savings account (Rs. 50,000) created atomically with the user

---

### Profile Editing (`/profile`)
**What:** Accessible via the ⚙️ Settings icon in the sidebar. Two tabs: Personal Info (Full Name, Email, NIC) and Change Password.  
**Why:** Users had no way to update their own information. The name shown on the dashboard was locked to whatever was seeded.  
**Advantages:**
- Full Name change reflects immediately in session (no logout required) via `updateSession()`
- Password change requires current password — prevents takeover from active sessions
- Username is locked (shown greyed-out) — prevents account identity confusion
- Clean field-level feedback: green ✓ on success, red ✕ with message on failure

---

### Nova AI Chatbot
**What:** Floating 🤖 button (bottom-right on dashboard). Natural language banking commands processed by `GLM-5.2-free` via zenmux.ai.  
**Supported commands:**
- `"Send 500 to Kasun"` → transfer with Face ID gate
- `"Pay electricity 1500"` → bill payment with Face ID gate
- `"My balance"` → shows all account balances
- `"Last 3 transactions"` → shows recent transaction list

**Why:** Traditional banking UX requires navigating multiple pages to execute a transfer. Conversational UI reduces this to one natural sentence.  

**Security architecture:**
- API key is server-side only — never sent to client
- AI receives ONLY the user's plain text message; no account numbers, balances, or names
- All account resolution (DB lookup, number masking) happens server-side after parsing AI intent
- Client receives only masked account numbers (last 4 digits)
- Face ID required before any financial action executes
- All AI intents logged to `audit_logs`

**Visual feedback:**
- 5 animated purple scan lines sweep across the chat area while AI thinks
- Three bouncing dots in the header during thinking/executing
- Dark gradient ActionCard: From ↔ To, Rs. amount, Face ID notice
- Inline camera in chat panel for Face ID — no page navigation
- Green/red result bubbles after execution

**Advantages:**
- Faster than traditional multi-page transfer flow
- Accessible to users who prefer conversational interfaces
- Zero sensitive data exposure to the AI model
- Token-efficient: system prompt under 30 lines, `temperature: 0` for deterministic JSON output

---

### Legacy User Face ID Enrolment
**What:** Users who registered before Face ID was introduced (dilara, kasun, admin) are prompted to set up Face ID on their first post-update login. One-time setup, then normal verify flow on subsequent logins.  
**Why:** Security features are only effective if all users are covered, not just new sign-ups.  
**Advantages:**
- Seamless migration — existing users aren't locked out, just redirected
- Clear UX with amber "One-time security setup" badge and numbered steps
- Server-side guard prevents the setup endpoint from overwriting an existing face without proper re-authentication

---

### Visual Face Rejection Feedback
**What:** When Face ID verification fails (wrong person), a red overlay appears inside the camera viewport showing `✕ Wrong Face / Retrying in a moment…`. The camera box plays a horizontal shake animation. After 2.5 seconds the overlay clears and scanning resumes.  
**Why:** The original failure state was just a small red text paragraph above the camera — users didn't know what failed or what to do.  
**Advantages:**
- Immediate, unmissable visual feedback inside the camera itself
- Shake animation provides tactile-feeling feedback on screen
- Auto-resume means users don't need to click anything to retry
- On login, the pending session is silently logged out during the 2.5s window — user doesn't notice the logout and the UX stays clean

---

## 4. What Was Already There (Pre-Session State)

For reference, these were the critical issues in the original codebase before this session:

| Issue | Status |
|-------|--------|
| SQL injection everywhere | ✅ Fixed (parameterized queries) |
| Plaintext passwords in DB | ✅ Fixed (Argon2id) |
| No authentication middleware | ✅ Fixed (`proxy.ts` route protection) |
| All API routes unauthenticated | ✅ Fixed (session checks) |
| Admin endpoint leaked `process.env` | ✅ Fixed (RBAC + no env in response) |
| `serviceFailure()` leaked DB credentials | ✅ Fixed |
| No sessions (cookies trivially decodable) | ✅ Fixed (HttpOnly UUID sessions) |
| Non-atomic transfers (no BEGIN/COMMIT) | ✅ Fixed |
| No balance constraint | ✅ Fixed (`CHECK balance >= 0`) |
| No sign-up functionality | ✅ Fixed |
| Hardcoded dashboard data | ✅ Fixed (live DB) |
| Hardcoded bank accounts page | ✅ Fixed (live DB) |

---

## 5. Dependency Added

| Package | Version | Purpose |
|---------|---------|---------|
| `@vladmandic/face-api` | `^1.7.15` | Face detection and recognition (TinyFaceDetector + FaceLandmark68Net + FaceRecognitionNet). Models loaded from jsDelivr CDN at runtime — no binary files committed. |
