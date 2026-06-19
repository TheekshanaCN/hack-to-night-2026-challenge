import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

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
      `SELECT id, username, role, full_name, email
       FROM users
       WHERE username = $1 AND password = $2
       LIMIT 1`,
      [username, password]
    )

    if (!result.rows[0]) {
      return Response.json(
        { ok: false, message: 'Invalid username or password.' },
        { status: 401 }
      )
    }

    const user = result.rows[0]
    const headers = new Headers()
    headers.append(
      'set-cookie',
      `user_id=${user.id}; Path=/; HttpOnly; SameSite=Strict`
    )
    headers.append(
      'set-cookie',
      `role=${user.role}; Path=/; HttpOnly; SameSite=Strict`
    )

    return Response.json({ ok: true, user }, { headers })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
