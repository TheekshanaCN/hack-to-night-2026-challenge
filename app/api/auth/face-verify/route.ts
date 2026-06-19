import { runStatement, logAudit, serviceFailure } from '@/lib/platform-db'
import { getSession, markFaceVerified } from '@/lib/session'

// Euclidean distance between two 128-D face descriptors
function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < 128; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

// Stricter threshold than default (0.6) — banking context
const THRESHOLD = 0.50

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie')
    const sessionId = cookie?.match(/session=([^;]+)/)?.[1] ?? null
    const session = getSession(sessionId)

    if (!session || !sessionId) {
      return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const input = body.descriptor as number[] | undefined
    const context = String(body.context ?? 'login')  // 'login' | 'transaction'

    if (!input || input.length !== 128) {
      return Response.json({ ok: false, message: 'Invalid face descriptor.' }, { status: 400 })
    }

    // Fetch stored face descriptor
    const result = await runStatement(
      'SELECT face_descriptor FROM users WHERE id = $1',
      [session.userId]
    )
    const stored = result.rows[0]?.face_descriptor as number[] | null

    if (!stored || !Array.isArray(stored) || stored.length !== 128) {
      return Response.json({ ok: false, message: 'No face registered for this account.' }, { status: 404 })
    }

    const distance = euclidean(stored, input)
    const matched = distance < THRESHOLD

    await logAudit(matched ? 'FACE_VERIFY_SUCCESS' : 'FACE_VERIFY_FAILED', {
      userId: session.userId,
      context,
      distance: Number(distance.toFixed(4))
    })

    if (!matched) {
      return Response.json({
        ok: false,
        message: 'Face not recognised. Please try again in good lighting.',
        distance: Number(distance.toFixed(4))
      }, { status: 403 })
    }

    // Mark session face-verified (for login context)
    if (context === 'login') markFaceVerified(sessionId)

    return Response.json({ ok: true, message: 'Face verified.' })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
