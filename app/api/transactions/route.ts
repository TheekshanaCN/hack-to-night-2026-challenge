import { runStatement, serviceFailure } from '@/lib/platform-db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const account = searchParams.get('account')

    if (!account) {
      return Response.json({ ok: false, message: 'account param required.' }, { status: 400 })
    }

    const result = await runStatement(
      `SELECT * FROM transactions
       WHERE from_account = $1 OR to_account = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [account]
    )

    return Response.json({ ok: true, account, transactions: result.rows })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
