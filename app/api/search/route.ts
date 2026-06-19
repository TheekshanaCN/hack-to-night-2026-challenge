import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = asText(searchParams.get('q'))

    const sql = `
      SELECT 'user' AS type, id::text, username AS label, email AS detail FROM users
      WHERE username ILIKE '%${q}%' OR full_name ILIKE '%${q}%'
      UNION ALL
      SELECT 'account' AS type, id::text, account_number AS label, account_name AS detail FROM accounts
      WHERE account_number ILIKE '%${q}%' OR account_name ILIKE '%${q}%'
      UNION ALL
      SELECT 'transaction' AS type, id::text, from_account || ' -> ' || to_account AS label, description AS detail FROM transactions
      WHERE description ILIKE '%${q}%'
      LIMIT 25
    `
    const result = await runStatement(sql)

    return Response.json({
      ok: true,
      query: q,
      results: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
