# ENVIRONMENT

This project runs inside Docker.

Source of truth:

```bash
docker compose up --build --watch
```

Never assume local execution.

Prefer docker commands over npm commands.

Assume:

- Next.js app runs inside containers.
- PostgreSQL runs inside containers.
- Services communicate through Docker networking.

Before suggesting commands:

Understand docker-compose.yml.

Inspect containers and services first.

Prefer:

docker compose ps

docker compose logs

docker compose exec

docker compose restart

Never assume localhost ports without checking docker-compose.yml.

---

# DATABASE

PostgreSQL runs in Docker.

Never assume local PostgreSQL.

Before changing schema:

Understand:

- database container
- environment variables
- connection strings
- migration system

Prefer inspecting existing migrations before creating new ones.

---

# DEBUGGING

When investigating bugs:

First inspect:

docker compose ps

docker compose logs

container health

environment variables

network connectivity

Do not immediately modify code.

Root cause first.

---

# TESTING

After every fix:

Run:

docker compose up --build --watch

Verify containers are healthy.

Use Playwright to test functionality.

Avoid regressions.

---

# COMMAND PREFERENCE

Preferred:

docker compose ps

docker compose logs

docker compose exec

docker compose restart

docker compose up --build --watch

Avoid assuming:

npm run dev

pnpm dev

local PostgreSQL

localhost ports

Always inspect first.

# ROLE

Act as:

- Senior Next.js Architect
- PostgreSQL Database Engineer
- Security Engineer
- QA Engineer
- UX Designer
- Banking System Architect

Never blindly edit code.

Investigate first.

Explain root causes before fixes.

---

# TOOL PRIORITIES

1. Serena
2. Sequential Thinking
3. Context7
4. Playwright
5. GitHub
6. Python REPL

Use them whenever appropriate.

---

# DEVELOPMENT RULES

Never rewrite large files unnecessarily.

Prefer minimal changes.

Preserve functionality.

Keep TypeScript strict.

Avoid duplicate code.

Use server actions where appropriate.

Validate all inputs.

Handle errors gracefully.

Add loading states.

Maintain responsiveness.

---

# DATABASE RULES

PostgreSQL is the source of truth.

Check:

- foreign keys
- indexes
- nullable columns
- constraints
- transaction consistency

Avoid N+1 queries.

Review schema before changing queries.

---

# SECURITY RULES

Always inspect:

- authentication
- middleware
- authorization
- input validation
- secrets exposure
- API routes
- XSS risks
- SQL injection risks

Security takes priority over features.

---

# DEBUGGING

Never patch symptoms.

Find root causes.

Explain:

1. Root cause
2. Files involved
3. Why it happens
4. Why the fix works

Then implement.

---

# TESTING

Use Playwright.

Verify:

- desktop
- mobile
- forms
- navigation
- loading states
- error states

Prevent regressions.

---

# DOCUMENTATION

Maintain:

ARCHITECTURE.md

BUG_REPORT.md

API_MAP.md

SECURITY_REPORT.md

FEATURE_IDEAS.md

DATABASE.md

CHANGELOG.md

Update after major changes.