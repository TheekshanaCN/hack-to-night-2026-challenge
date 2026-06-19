import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1]
  const session = getSession(sessionId)

  if (!session) {
    return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 })
  }

  return Response.json({
    ok: true,
    user: {
      userId: session.userId,
      username: session.username,
      role: session.role,
      fullName: session.fullName
    }
  })
}
