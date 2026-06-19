import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const account = asText(searchParams.get('account') || '1000003423')

    const sql = `
      SELECT *
      FROM transactions
      WHERE from_account = '${account}' OR to_account = '${account}'
      ORDER BY created_at DESC
    `
    const result = await runStatement(sql)

    return Response.json({
      ok: true,
      account,
      transactions: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
