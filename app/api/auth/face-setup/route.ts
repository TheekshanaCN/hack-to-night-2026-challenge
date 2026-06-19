import { runStatement, serviceFailure, logAudit } from '@/lib/platform-db'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const jar       = await cookies()
    const sessionId = jar.get('session')?.value
    const session   = sessionId ? getSession(sessionId) : null
    if (!session) {
      return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 })
    }

    const body       = await request.json().catch(() => ({}))
    const descriptor = body.descriptor as number[] | null | undefined

    if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every(n => typeof n === 'number')) {
      return Response.json({ ok: false, message: 'Invalid face descriptor.' }, { status: 400 })
    }

    // Only allow setup if face_descriptor is not already set — prevents overwrite without re-auth
    const existing = await runStatement(
      'SELECT face_descriptor FROM users WHERE id = $1',
      [session.userId]
    )
    if (existing.rows[0]?.face_descriptor) {
      return Response.json({ ok: false, message: 'Face ID already configured. Use profile settings to update.' }, { status: 409 })
    }

    await runStatement(
      'UPDATE users SET face_descriptor = $1 WHERE id = $2',
      [JSON.stringify(descriptor), session.userId]
    )

    await logAudit('FACE_SETUP_COMPLETE', { userId: session.userId, username: session.username })

    return Response.json({ ok: true, message: 'Face ID saved successfully.' })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
