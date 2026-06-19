import { runStatement, serviceFailure } from '@/lib/platform-db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    if (!q.trim()) {
      return Response.json({ ok: true, query: q, results: [] })
    }

    const like = `%${q}%`
    const result = await runStatement(
      `SELECT 'account' AS type, id::text, account_number AS label, account_name AS detail
       FROM accounts
       WHERE account_number ILIKE $1 OR account_name ILIKE $1
       UNION ALL
       SELECT 'transaction' AS type, id::text,
              from_account || ' → ' || to_account AS label,
              description AS detail
       FROM transactions
       WHERE description ILIKE $1
       LIMIT 25`,
      [like]
    )

    return Response.json({ ok: true, query: q, results: result.rows })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
