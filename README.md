# Nova Bank — Hack to Night 2026

> A fully working, banking-grade web app — built from a broken shell in one night.

---

## What We Were Given

A Next.js banking app skeleton with **46 bugs (13 critical)**:

- Every API route returned `500`
- Four of seven pages crashed on load
- Login button did nothing — no auth existed
- SQL injection in every database call
- Database credentials leaked on every failed request
- Sessions never expired

The UI shell existed. The routing structure was there. Almost nothing worked.

---

## What We Did

### 1. Identify

We audited the codebase against OWASP API Security Top 10, PCI DSS 4.0.1, and real banking app architectures (Monzo, Revolut, Starling). We produced a prioritised attack plan and triage list before touching a single line of code.

Key findings:
- No authentication whatsoever
- Raw string SQL queries (injection on every route)
- In-memory sessions with no expiry and no cleanup
- Credentials printed to HTTP response bodies
- No rate limiting, no input validation, no CSRF protection

### 2. ReDesign

We redesigned the security and feature architecture from the ground up while preserving the existing UI shell:

- **Auth layer** — session-based auth with Argon2id password hashing (via `Bun.password`), HttpOnly + SameSite=Strict cookies, 15-min idle timeout, 8-hour absolute expiry
- **DB layer** — all queries rewritten to parameterised SQL via `pg`, zero raw string interpolation
- **Route protection** — proxy-level auth guard (`proxy.ts`) covering every protected route
- **Rate limiting** — in-memory sliding window on login and transfer endpoints
- **Face ID flow** — enrolment on sign-up, verification gate on transfers and AI chat
- **AI assistant** — natural language banking via GLM-5.2 with a Face ID security gate before any sensitive action

### 3. Implementation

| Area | What Was Built |
|------|---------------|
| Auth | Register, login, logout — Argon2id + session cookies |
| Face ID | Enrolment (sign-up) → verification gate (transfer, AI) using `@vladmandic/face-api` TF.js |
| Dashboard | Live balance, recent transactions, account overview |
| Bank Accounts | View all accounts, edit account nicknames |
| Bank Transfer | Face-ID-gated transfers with real-time balance update |
| Pay Bills | Bill payment flow |
| Smart Spend | Spending analytics and category breakdown |
| E-Statement | Transaction history export view |
| Profile | Personal info edit + password change |
| Nova AI | Natural language banking chatbot — "pay electricity bill", "show my balance", "transfer 500 to savings" — all behind a Face ID gate |
| Legacy prompt | First-login Face ID enrolment prompt for existing users |
| Build fix | Fixed `NODE_ENV` conflict that broke production builds |

---

## Key Features

### Face ID — Real Biometric Auth in the Browser
No WebAuthn, no native SDK — pure browser Face ID using TensorFlow.js and `@vladmandic/face-api`. Enrol your face at sign-up. Every bank transfer and every AI command requires your face to match before it executes. 128-dimensional face descriptor stored per user in PostgreSQL.

### Nova AI — Talk to Your Bank
Type "transfer Rs. 2000 to my savings account" and it happens — after Face ID confirms it's you. Powered by GLM-5.2 via a compatible OpenAI API, the chatbot parses intent and calls the real transfer API. No hallucinated transactions — every action hits the actual database.

### Zero-Trust Route Guard
A single `proxy.ts` file sits in front of every route. No page, API, or asset loads without a valid session. Session expiry is enforced on every request — idle timeout (15 min) and absolute max (8h), matching regulatory banking requirements.

### Banking-Grade SQL — Zero ORM, Zero Injection
Every query is a parameterised statement via raw `pg`. No Prisma, no Drizzle, no query builder. Full control, full auditability, zero injection surface.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun 1 (Docker) |
| Framework | Next.js 16.2.9, React 19, TypeScript 5.9 |
| Database | PostgreSQL 17 (Docker volume) |
| DB client | `pg` 8.22 — raw parameterised SQL |
| Password hashing | Argon2id via `Bun.password` |
| Face recognition | `@vladmandic/face-api` 1.7.15 (TF.js) |
| AI model | GLM-5.2-free via zenmux.ai |
| Styling | Tailwind CSS 4 + CSS custom properties |

---

## Getting Started

**Prerequisites:** Docker (with [WSL2 backend](https://docs.docker.com/desktop/features/wsl) on Windows)

```bash
git clone https://github.com/fossnsbm/hack-to-night-2026-challenge.git
cd hack-to-night-2026-challenge
cp .env.example .env.local
# fill in your values in .env.local
docker compose up --build --watch
```

App runs at `http://localhost:3000`.

### Production Build

```bash
docker compose -f compose.yml run --rm -e NODE_ENV=production htn26-challenge-dev bun run build
```
