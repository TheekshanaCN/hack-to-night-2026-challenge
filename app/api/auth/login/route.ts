import { asText, runStatement, serviceFailure, logAudit } from '@/lib/platform-db'
import { createSession, sessionCookie } from '@/lib/session'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const username = asText(body.username)
    const password = asText(body.password)

    if (!username || !password) {
      return Response.json(
        { ok: false, message: 'Username and password are required.' },
        { status: 400 }
      )
    }

    const result = await runStatement(
      `SELECT id, username, role, full_name, password AS password_hash
       FROM users WHERE username = $1 LIMIT 1`,
      [username]
    )

    const user = result.rows[0]
    if (!user) {
      await logAudit('LOGIN_FAILED', { username })
      return Response.json(
        { ok: false, message: 'Invalid username or password.' },
        { status: 401 }
      )
    }

    const valid = await Bun.password.verify(password, user.password_hash)
    if (!valid) {
      await logAudit('LOGIN_FAILED', { username, userId: user.id })
      return Response.json(
        { ok: false, message: 'Invalid username or password.' },
        { status: 401 }
      )
    }

    await logAudit('LOGIN_SUCCESS', { userId: user.id, username: user.username })

    const sessionId = createSession({
      userId: user.id,
      role: user.role,
      username: user.username,
      fullName: user.full_name
    })

    const headers = new Headers()
    headers.append('set-cookie', sessionCookie(sessionId))

    return Response.json(
      {
        ok: true,
        user: { id: user.id, username: user.username, role: user.role, fullName: user.full_name }
      },
      { headers }
    )
  } catch (reason) {
    return serviceFailure(reason)
  }
}
