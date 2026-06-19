import { runStatement, serviceFailure } from '@/lib/platform-db'
import { getSession, updateSession } from '@/lib/session'
import { cookies } from 'next/headers'

async function getAuth() {
  const jar = await cookies()
  const sid = jar.get('session')?.value
  return sid ? getSession(sid) : null
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getAuth()
    if (!session) return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 })

    const result = await runStatement(
      'SELECT username, full_name, email, nic, created_at FROM users WHERE id = $1',
      [session.userId]
    )
    const user = result.rows[0]
    if (!user) return Response.json({ ok: false, message: 'User not found.' }, { status: 404 })

    return Response.json({ ok: true, profile: user })
  } catch (reason) {
    return serviceFailure(reason)
  }
}

// ── PATCH /api/profile ────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const session = await getAuth()
    if (!session) return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))

    // ── Password change ───────────────────────────────────────────────────────
    if (body.currentPassword !== undefined) {
      const { currentPassword, newPassword } = body

      if (!currentPassword || !newPassword) {
        return Response.json({ ok: false, message: 'Both current and new password are required.' }, { status: 400 })
      }
      if (String(newPassword).length < 8) {
        return Response.json({ ok: false, message: 'New password must be at least 8 characters.' }, { status: 400 })
      }

      const hashRow = await runStatement('SELECT password FROM users WHERE id = $1', [session.userId])
      const valid   = await Bun.password.verify(String(currentPassword), hashRow.rows[0]?.password ?? '')
      if (!valid) {
        return Response.json({ ok: false, message: 'Current password is incorrect.' }, { status: 403 })
      }

      const newHash = await Bun.password.hash(String(newPassword), { algorithm: 'argon2id' })
      await runStatement('UPDATE users SET password = $1 WHERE id = $2', [newHash, session.userId])
      return Response.json({ ok: true, message: 'Password updated successfully.' })
    }

    // ── Profile fields update ─────────────────────────────────────────────────
    const fullName = String(body.fullName ?? '').trim()
    const email    = String(body.email    ?? '').trim().toLowerCase()
    const nic      = String(body.nic      ?? '').trim()

    if (!fullName || fullName.length < 2) {
      return Response.json({ ok: false, message: 'Full name must be at least 2 characters.' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, message: 'Invalid email address.' }, { status: 400 })
    }

    await runStatement(
      'UPDATE users SET full_name = $1, email = $2, nic = $3 WHERE id = $4',
      [fullName, email || null, nic || null, session.userId]
    )

    // Keep session in sync with the new name
    updateSession(session.userId, { fullName })

    return Response.json({ ok: true, message: 'Profile updated successfully.', fullName })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
