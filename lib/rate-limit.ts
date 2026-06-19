// In-memory rate limiter (globalThis singleton — shared across Next.js route bundles)
type AttemptRecord = {
  count: number
  firstAttemptAt: number
  lockedUntil: number | null
}

declare global {
  var __rateLimitStore: Map<string, AttemptRecord> | undefined
}

const store: Map<string, AttemptRecord> =
  globalThis.__rateLimitStore ?? (globalThis.__rateLimitStore = new Map())

const WINDOW_MS     = 15 * 60 * 1000   // 15-min sliding window
const MAX_ATTEMPTS  = 5                  // lock after 5 fails
const LOCKOUT_MS    = 15 * 60 * 1000   // first lockout: 15 min
const HARD_LOCK_MS  = 60 * 60 * 1000   // after 10 fails: 1 hour

// Purge stale records every 30 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, rec] of store) {
    const expired = rec.lockedUntil
      ? now > rec.lockedUntil + WINDOW_MS
      : now - rec.firstAttemptAt > WINDOW_MS
    if (expired) store.delete(key)
  }
}, 30 * 60 * 1000)

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; message: string }

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now()
  const rec = store.get(identifier)

  // No record → first attempt
  if (!rec) {
    store.set(identifier, { count: 0, firstAttemptAt: now, lockedUntil: null })
    return { allowed: true }
  }

  // Locked?
  if (rec.lockedUntil && now < rec.lockedUntil) {
    const retryAfterMs = rec.lockedUntil - now
    const mins = Math.ceil(retryAfterMs / 60000)
    return {
      allowed: false,
      retryAfterMs,
      message: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`
    }
  }

  // Lockout expired — reset
  if (rec.lockedUntil && now >= rec.lockedUntil) {
    store.set(identifier, { count: 0, firstAttemptAt: now, lockedUntil: null })
    return { allowed: true }
  }

  // Window expired without lockout — reset
  if (now - rec.firstAttemptAt > WINDOW_MS) {
    store.set(identifier, { count: 0, firstAttemptAt: now, lockedUntil: null })
    return { allowed: true }
  }

  return { allowed: true }
}

export function recordFailedAttempt(identifier: string): void {
  const now = Date.now()
  const rec = store.get(identifier) ?? { count: 0, firstAttemptAt: now, lockedUntil: null }
  rec.count += 1

  if (rec.count >= 10) {
    rec.lockedUntil = now + HARD_LOCK_MS
  } else if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS
  }

  store.set(identifier, rec)
}

export function clearAttempts(identifier: string): void {
  store.delete(identifier)
}
