import { asText, runStatement, serviceFailure, logAudit } from '@/lib/platform-db'
import { createSession, sessionCookie } from '@/lib/session'
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const username = asText(body.username).toLowerCase().trim()
    const password = asText(body.password)

    if (!username || !password) {
      return Response.json({ ok: false, message: 'Username and password are required.' }, { status: 400 })
    }

    // Rate limit per username
    const limit = checkRateLimit(`login:${username}`)
    if (!limit.allowed) {
      await logAudit('LOGIN_RATE_LIMITED', { username })
      return Response.json({ ok: false, message: limit.message }, { status: 429 })
    }

    const result = await runStatement(
      `SELECT id, username, role, full_name, password AS password_hash, face_descriptor
       FROM users WHERE username = $1 LIMIT 1`,
      [username]
    )

    const user = result.rows[0]
    if (!user) {
      recordFailedAttempt(`login:${username}`)
      await logAudit('LOGIN_FAILED', { username, reason: 'user not found' })
      // Generic message prevents username enumeration
      return Response.json({ ok: false, message: 'Invalid username or password.' }, { status: 401 })
    }

    const valid = await Bun.password.verify(password, user.password_hash)
    if (!valid) {
      recordFailedAttempt(`login:${username}`)
      await logAudit('LOGIN_FAILED', { username, userId: user.id, reason: 'wrong password' })
      return Response.json({ ok: false, message: 'Invalid username or password.' }, { status: 401 })
    }

    // Credentials valid — clear failed attempts
    clearAttempts(`login:${username}`)

    const sessionId = createSession({
      userId: user.id,
      role: user.role,
      username: user.username,
      fullName: user.full_name
    })

    await logAudit('LOGIN_SUCCESS', { userId: user.id, username: user.username })

    const headers = new Headers()
    headers.append('set-cookie', sessionCookie(sessionId))

    // Tell the client whether face verification is needed
    const hasFaceId = Boolean(user.face_descriptor)

    return Response.json(
      {
        ok: true,
        requireFaceId: hasFaceId,
        user: { id: user.id, username: user.username, role: user.role, fullName: user.full_name }
      },
      { headers }
    )
  } catch (reason) {
    return serviceFailure(reason)
  }
}
