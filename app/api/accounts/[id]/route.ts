import { runStatement, serviceFailure } from '@/lib/platform-db'
import { getSession } from '@/lib/session'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1]
    const session = getSession(sessionId)

    if (!session) {
      return Response.json({ ok: false, message: 'Authentication required.' }, { status: 401 })
    }

    const { id } = await params
    const accountId = Number(id)
    if (!accountId) {
      return Response.json({ ok: false, message: 'Invalid account id.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const accountName = String(body.accountName ?? '').trim()

    if (!accountName || accountName.length < 2) {
      return Response.json({ ok: false, message: 'Account name must be at least 2 characters.' }, { status: 400 })
    }

    // Ensure the account belongs to the authenticated user
    const check = await runStatement(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, session.userId]
    )
    if (!check.rows[0]) {
      return Response.json({ ok: false, message: 'Account not found.' }, { status: 404 })
    }

    const result = await runStatement(
      'UPDATE accounts SET account_name = $1 WHERE id = $2 RETURNING id, account_number, account_name, balance',
      [accountName, accountId]
    )

    return Response.json({ ok: true, account: result.rows[0] })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
