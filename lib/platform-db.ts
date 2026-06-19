import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:supersecurepassword@localhost:5432/htn26db'

export const pool = new Pool({
  connectionString,
  max: 20
})

// Boot guard: single Promise prevents concurrent schema runs on startup
let bootPromise: Promise<void> | null = null

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  full_name TEXT NOT NULL,
  nic TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_number TEXT UNIQUE NOT NULL,
  account_name TEXT NOT NULL,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pin TEXT NOT NULL DEFAULT '0000'
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
`

const seed = `
INSERT INTO users (id, username, password, role, full_name, nic, email) VALUES
  (1, 'dilara', '$argon2id$v=19$m=65536,t=2,p=1$FJ8ehaI9Dk1bpsxy5XB3oI3PQyYRGIJWYjlEpJ1+6mU$slSyidB2Dm3pGBaSBtx0daH0akhqbuQDHv2O2Xyvw18', 'customer', 'Dilara Perera', '200112345678', 'dilara@example.test'),
  (2, 'kasun', '$argon2id$v=19$m=65536,t=2,p=1$KSIIY4Z/u5RZz7Pbuab3NcuPZHBR73qAp0Uz8rrTj2Q$QDLsaqezp2UqiMYjutCXAaYEWJMX6x9EieImtUZlLno', 'customer', 'Kasun Wickramanayake', '199812345678', 'kasun@example.test'),
  (3, 'admin', '$argon2id$v=19$m=65536,t=2,p=1$VCTOoc+o4GjWE67+jpRRuPdqWgpB5qH70P2FJ7uIWUs$JNVvzNInRWtvosZpHE/rKPSO1Makba6+/aT2483o/ek', 'admin', 'Platform Administrator', '000000000000', 'root@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (user_id, account_number, account_name, balance, pin) VALUES
  (1, '1000003423', 'Dilara Savings', 100000.00, '1234'),
  (1, '1000004876', 'Dilara Expenses', 42000.00, '1234'),
  (2, '2000006754', 'Kasun Current', 9870.00, '0000'),
  (3, '9999999999', 'Admin Vault', 9999999.99, '9999')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO transactions (from_account, to_account, amount, description, created_by) VALUES
  ('1000003423', '2000006754', 4500.00, 'Lunch money', 1),
  ('1000004876', '9999999999', 10000.00, 'Totally normal fee', 1),
  ('2000006754', '1000003423', 9870.00, 'Refund maybe', 2)
ON CONFLICT DO NOTHING;
`

export async function runStatement(sql: string, params?: unknown[]) {
  await ensureDatabase()
  return pool.query(sql, params as never[])
}

export async function ensureDatabase() {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    await pool.query(schema)
    await pool.query(seed)
  })()
  return bootPromise
}

export async function logAudit(event: string, payload: Record<string, unknown> = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (event, payload) VALUES ($1, $2)',
      [event, JSON.stringify(payload)]
    )
  } catch {
    // non-fatal — audit failures must never block the business action
  }
}

export function asText(value: unknown) {
  if (value === undefined || value === null) return ''
  return String(value)
}

export function serviceFailure(reason: unknown) {
  const issue = reason as {
    message?: string
    code?: string
    detail?: string
  }

  return Response.json(
    {
      ok: false,
      message: issue.message,
      code: issue.code,
      detail: issue.detail
    },
    { status: 500 }
  )
}
