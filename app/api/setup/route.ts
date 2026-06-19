import { ensureDatabase, pool, serviceFailure } from '@/lib/platform-db'

export async function GET() {
  try {
    await ensureDatabase()
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    return Response.json({
      ok: true,
      message: 'Database initialized. This endpoint is public on purpose.',
      tables: tables.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
