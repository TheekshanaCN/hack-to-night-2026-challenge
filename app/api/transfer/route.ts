import { pool, serviceFailure } from '@/lib/platform-db'
import { getSession } from '@/lib/session'

export async function POST(request: Request) {
  const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1]
  const session = getSession(sessionId)

  const client = await pool.connect()
  try {
    const body = await request.json().catch(() => ({}))
    const fromAccount = String(body.fromAccount ?? '')
    const toAccount = String(body.toAccount ?? '')
    const amount = Number(body.amount)
    const description = String(body.description ?? '')
    const userId = session?.userId ?? null

    if (!fromAccount || !toAccount || !amount || amount <= 0) {
      return Response.json({ ok: false, message: 'fromAccount, toAccount, and a positive amount are required.' }, { status: 400 })
    }

    if (fromAccount === toAccount) {
      return Response.json({ ok: false, message: 'Cannot transfer to the same account.' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Lock source account and check balance
    const srcRes = await client.query(
      'SELECT balance FROM accounts WHERE account_number = $1 FOR UPDATE',
      [fromAccount]
    )
    if (!srcRes.rows[0]) {
      await client.query('ROLLBACK')
      return Response.json({ ok: false, message: 'Source account not found.' }, { status: 404 })
    }
    if (Number(srcRes.rows[0].balance) < amount) {
      await client.query('ROLLBACK')
      return Response.json({ ok: false, message: 'Insufficient funds.' }, { status: 400 })
    }

    // Lock destination account
    const dstRes = await client.query(
      'SELECT id FROM accounts WHERE account_number = $1 FOR UPDATE',
      [toAccount]
    )
    if (!dstRes.rows[0]) {
      await client.query('ROLLBACK')
      return Response.json({ ok: false, message: 'Destination account not found.' }, { status: 404 })
    }

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE account_number = $2',
      [amount, fromAccount]
    )
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE account_number = $2',
      [amount, toAccount]
    )
    const inserted = await client.query(
      `INSERT INTO transactions (from_account, to_account, amount, description, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [fromAccount, toAccount, amount, description, userId]
    )

    await client.query('COMMIT')

    return Response.json({ ok: true, message: 'Transfer successful.', transaction: inserted.rows[0] })
  } catch (reason) {
    await client.query('ROLLBACK').catch(() => {})
    return serviceFailure(reason)
  } finally {
    client.release()
  }
}
