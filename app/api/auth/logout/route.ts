import { deleteSession, clearSessionCookie } from '@/lib/session'

export async function POST(request: Request) {
  const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1]
  deleteSession(sessionId)

  const headers = new Headers()
  headers.append('set-cookie', clearSessionCookie())

  return Response.json({ ok: true }, { headers })
}
