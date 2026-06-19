import { ensureDatabase, pool, serviceFailure } from '@/lib/platform-db'

export async function GET() {
  try {
    await ensureDatabase()
    const result = await pool.query(
      'SELECT NOW() AS now, current_database() AS database'
    )

    return Response.json({
      ok: true,
      service: 'bank-api',
      database: result.rows[0],
      env: process.env.NODE_ENV
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
