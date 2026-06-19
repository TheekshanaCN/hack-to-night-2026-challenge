import { runStatement, logAudit } from '@/lib/platform-db'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1]
  const session = getSession(sessionId)

  if (!session) {
    await logAudit('UNAUTHORIZED_ACCESS', { path: '/api/admin/system', reason: 'no session' })
    return Response.json({ ok: false, message: 'Authentication required.' }, { status: 401 })
  }

  if (session.role !== 'admin') {
    await logAudit('UNAUTHORIZED_ACCESS', {
      path: '/api/admin/system',
      reason: 'insufficient role',
      userId: session.userId,
      role: session.role
    })
    return Response.json({ ok: false, message: 'Admin access required.' }, { status: 403 })
  }

  const [userCount, accountCount, txCount, recentAudit] = await Promise.all([
    runStatement('SELECT COUNT(*) AS count FROM users'),
    runStatement('SELECT COUNT(*) AS count FROM accounts'),
    runStatement('SELECT COUNT(*) AS count FROM transactions'),
    runStatement('SELECT event, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20')
  ])

  return Response.json({
    ok: true,
    system: {
      users: Number(userCount.rows[0].count),
      accounts: Number(accountCount.rows[0].count),
      transactions: Number(txCount.rows[0].count),
      recentAuditEvents: recentAudit.rows
    }
  })
}
