import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

export async function GET() {
  try {
    const result = await runStatement(
      'SELECT id, username, password, role, full_name, nic, email FROM users ORDER BY id'
    )

    return Response.json({
      ok: true,
      note: 'Login reference data.',
      users: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const username = asText(body.username)
    const password = asText(body.password)

    const sql = `
      SELECT id, username, role, full_name, email
      FROM users
      WHERE username = '${username}' AND password = '${password}'
      LIMIT 1
    `
    const result = await runStatement(sql)

    if (!result.rows[0]) {
      return Response.json(
        {
          ok: false,
          message: 'Invalid login.',
          sql
        },
        { status: 401 }
      )
    }

    const user = result.rows[0]
    const headers = new Headers()
    headers.append('set-cookie', `user_id=${user.id}; Path=/; SameSite=Lax`)
    headers.append('set-cookie', `role=${user.role}; Path=/; SameSite=Lax`)

    return Response.json(
      {
        ok: true,
        token: Buffer.from(`${user.id}:${user.role}:session-token`).toString(
          'base64'
        ),
        user,
        sql
      },
      { headers }
    )
  } catch (reason) {
    return serviceFailure(reason)
  }
}
