import { pool, runStatement, serviceFailure, logAudit } from '@/lib/platform-db'
import { createSession, sessionCookie } from '@/lib/session'
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit'

function generateAccountNumber(userId: number): string {
  // userId prefix guarantees no collision across users; 8 random digits handle
  // the rare case of multiple accounts per user
  const prefix = String(userId).padStart(4, '0')
  const rand   = String(Math.floor(10000000 + Math.random() * 90000000)) // 8 digits
  return `${prefix}${rand}`
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const limit = checkRateLimit(`register:${ip}`)
  if (!limit.allowed) {
    return Response.json({ ok: false, message: limit.message }, { status: 429 })
  }

  const client = await pool.connect()
  try {
    const body = await request.json().catch(() => ({}))
    const username     = String(body.username ?? '').trim().toLowerCase()
    const fullName     = String(body.fullName ?? '').trim()
    const nic          = String(body.nic ?? '').trim()
    const email        = String(body.email ?? '').trim().toLowerCase()
    const password     = String(body.password ?? '')
    const descriptor   = body.faceDescriptor as number[] | null | undefined

    // --- Validation ---
    if (!username || username.length < 3) {
      return Response.json({ ok: false, message: 'Username must be at least 3 characters.' }, { status: 400 })
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return Response.json({ ok: false, message: 'Username may only contain letters, numbers, and underscores.' }, { status: 400 })
    }
    if (!fullName || fullName.length < 2) {
      return Response.json({ ok: false, message: 'Full name is required.' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, message: 'A valid email is required.' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return Response.json({ ok: false, message: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (!descriptor || descriptor.length !== 128) {
      return Response.json({ ok: false, message: 'Face ID is required. Please complete the face capture step.' }, { status: 400 })
    }

    const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })

    await client.query('BEGIN')

    // Insert user
    const userRes = await client.query(
      `INSERT INTO users (username, password, role, full_name, nic, email, face_descriptor)
       VALUES ($1, $2, 'customer', $3, $4, $5, $6)
       RETURNING id, username, role, full_name`,
      [username, passwordHash, fullName, nic, email, JSON.stringify(descriptor)]
    )
    const user = userRes.rows[0]

    // Create default savings account
    const accountNumber = generateAccountNumber(user.id)
    await client.query(
      `INSERT INTO accounts (user_id, account_number, account_name, balance, pin)
       VALUES ($1, $2, $3, 50000.00, '0000')`,
      [user.id, accountNumber, `${fullName.split(' ')[0]} Savings`]
    )

    await client.query('COMMIT')

    await logAudit('REGISTER_SUCCESS', { userId: user.id, username: user.username })

    // Auto-login after registration
    const sessionId = createSession({
      userId: user.id,
      role: user.role,
      username: user.username,
      fullName: user.full_name
    })

    const headers = new Headers()
    headers.append('set-cookie', sessionCookie(sessionId))

    return Response.json(
      { ok: true, message: 'Account created.', user: { id: user.id, username: user.username, fullName: user.full_name } },
      { headers }
    )
  } catch (reason: unknown) {
    await client.query('ROLLBACK').catch(() => {})
    const err = reason as { code?: string; constraint?: string }
    if (err?.code === '23505') {
      recordFailedAttempt(`register:${ip}`)
      const msg = err.constraint === 'users_username_key'
        ? 'Username already taken. Please choose another.'
        : 'Registration failed due to a conflict. Please try again.'
      return Response.json({ ok: false, message: msg }, { status: 409 })
    }
    return serviceFailure(reason)
  } finally {
    client.release()
  }
}
