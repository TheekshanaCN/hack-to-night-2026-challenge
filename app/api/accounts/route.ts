import { runStatement, serviceFailure } from '@/lib/platform-db'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const { searchParams, } = new URL(request.url)
    const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1]
    const session = getSession(sessionId)

    const rawUserId = searchParams.get('userId')
    const userId = rawUserId ? Number(rawUserId) : session?.userId

    if (!userId) {
      return Response.json({ ok: false, message: 'userId required.' }, { status: 400 })
    }

    const result = await runStatement(
      `SELECT a.id, a.user_id, a.account_number, a.account_name, a.balance,
              u.username, u.full_name
       FROM accounts a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = $1
       ORDER BY a.id`,
      [userId]
    )

    return Response.json({ ok: true, accounts: result.rows })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
