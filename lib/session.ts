type SessionData = {
  userId: number
  role: string
  username: string
  fullName: string
}

declare global {
  // eslint-disable-next-line no-var
  var __sessionStore: Map<string, SessionData> | undefined
}

const store: Map<string, SessionData> =
  globalThis.__sessionStore ?? (globalThis.__sessionStore = new Map())

export function createSession(data: SessionData): string {
  const id = crypto.randomUUID()
  store.set(id, data)
  return id
}

export function getSession(id: string | null | undefined): SessionData | null {
  if (!id) return null
  return store.get(id) ?? null
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
