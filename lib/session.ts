export type SessionData = {
  userId: number
  role: string
  username: string
  fullName: string
  createdAt: number       // absolute expiry check
  lastSeenAt: number      // idle expiry check
  faceVerified: boolean   // true after face-id confirmed at login
}

declare global {
  // eslint-disable-next-line no-var
  var __sessionStore: Map<string, SessionData> | undefined
}

const store: Map<string, SessionData> =
  globalThis.__sessionStore ?? (globalThis.__sessionStore = new Map())

const IDLE_MS     = 15 * 60 * 1000       // 15-minute idle timeout
const ABSOLUTE_MS = 8  * 60 * 60 * 1000  // 8-hour hard limit

// Purge expired sessions every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of store) {
    if (_isExpired(session, now)) store.delete(id)
  }
}, 10 * 60 * 1000)

function _isExpired(session: SessionData, now = Date.now()): boolean {
  if (now - session.lastSeenAt > IDLE_MS)     return true
  if (now - session.createdAt  > ABSOLUTE_MS) return true
  return false
}

export function createSession(data: Omit<SessionData, 'createdAt' | 'lastSeenAt' | 'faceVerified'>): string {
  const id = crypto.randomUUID()
  const now = Date.now()
  store.set(id, { ...data, createdAt: now, lastSeenAt: now, faceVerified: false })
  return id
}

export function getSession(id: string | null | undefined): SessionData | null {
  if (!id) return null
  const session = store.get(id)
  if (!session) return null
  if (_isExpired(session)) {
    store.delete(id)
    return null
  }
  // Slide the idle window on every successful access
  session.lastSeenAt = Date.now()
  return session
}

export function markFaceVerified(id: string): void {
  const session = store.get(id)
  if (session) session.faceVerified = true
}

export function updateSession(userId: number, patch: Partial<Pick<SessionData, 'fullName'>>): void {
  for (const session of store.values()) {
    if (session.userId === userId) Object.assign(session, patch)
  }
}

export function deleteSession(id: string | null | undefined): void {
  if (id) store.delete(id)
}

export function sessionCookie(id: string): string {
  return `session=${id}; Path=/; HttpOnly; SameSite=Strict`
}

export function clearSessionCookie(): string {
  return 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
}
