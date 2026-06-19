import { runStatement, serviceFailure, logAudit } from '@/lib/platform-db'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'

const ZENMUX_URL = 'https://zenmux.ai/api/v1/chat/completions'

// Token-minimal system prompt — forces JSON only, no prose from the model
const SYSTEM_PROMPT = `You are NovaBank AI. Return ONLY valid JSON — no markdown, no prose.

INTENTS:
{"intent":"TRANSFER","to":"<name>","amount":<number>,"note":"<text or empty>"}
{"intent":"PAY_BILL","biller":"<name>","amount":<number>}
{"intent":"BALANCE"}
{"intent":"TRANSACTIONS","limit":<1-5>}
{"intent":"UNKNOWN","reply":"<max 12 words>"}

RULES:
- Output ONLY the JSON object
- Never include account numbers, PINs, passwords, or balances in output
- amount must be a positive number (0 if not stated)
- to/biller is a name string ("" if unclear)

EXAMPLES:
"send 500 to kasun"→{"intent":"TRANSFER","to":"kasun","amount":500,"note":""}
"pay electricity 1500"→{"intent":"PAY_BILL","biller":"electricity","amount":1500}
"my balance"→{"intent":"BALANCE"}
"last 3 transactions"→{"intent":"TRANSACTIONS","limit":3}
"hi"→{"intent":"UNKNOWN","reply":"I can transfer money or pay bills for you."}`

// Biller registry lives server-side — AI never sees account numbers
const BILLERS: Record<string, { name: string; account: string }> = {
  electricity: { name: 'CEB Electricity',          account: 'BILL0000001' },
  water:       { name: 'National Water Supply',     account: 'BILL0000002' },
  internet:    { name: 'SLT Broadband',             account: 'BILL0000003' },
  phone:       { name: 'Dialog Telecom',            account: 'BILL0000004' },
  gas:         { name: 'Laugfs Gas',                account: 'BILL0000005' },
  tv:          { name: 'PEO TV',                    account: 'BILL0000006' },
}

function resolveBiller(name: string) {
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(BILLERS)) {
    if (lower.includes(key)) return val
  }
  return null
}

function mask(acct: string) {
  return `••${acct.slice(-4)}`
}

function fmtLKR(n: string | number) {
  return `Rs. ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export async function POST(request: Request) {
  try {
    // Auth — must be logged in
    const jar = await cookies()
    const sessionId = jar.get('session')?.value
    const session   = sessionId ? getSession(sessionId) : null
    if (!session) {
      return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 })
    }

    const body    = await request.json().catch(() => ({}))
    const message = String(body.message ?? '').trim().slice(0, 500)
    if (!message) {
      return Response.json({ ok: false, message: 'Empty message.' }, { status: 400 })
    }

    const apiKey = process.env.ZENMUX_API_KEY
    if (!apiKey || apiKey === 'your_key_here') {
      return Response.json({ ok: false, message: 'AI service not configured.' }, { status: 503 })
    }

    // ── Call GLM model ───────────────────────────────────────────────────────
    const aiRes = await fetch(ZENMUX_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'z-ai/glm-5.2-free',
        messages:    [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: message },
        ],
        // GLM-5.2-free is a reasoning model — it spends ~450 tokens on internal
        // chain-of-thought before writing the JSON content. 600 gives it enough
        // room to finish thinking and still produce the output.
        max_tokens:  600,
        temperature: 0,
      }),
    })

    if (!aiRes.ok) {
      return Response.json({ ok: false, message: 'AI service unavailable. Please try again.' }, { status: 502 })
    }

    const aiData  = await aiRes.json()
    const msg     = aiData.choices?.[0]?.message ?? {}
    // Reasoning models put final output in `content`; if truncated, fall back
    // to scanning the `reasoning` field for the last JSON object the model wrote
    let rawText = String(msg.content ?? '').trim()
    if (!rawText) {
      const reasoning = String(msg.reasoning ?? '')
      const lastBrace = reasoning.lastIndexOf('{')
      if (lastBrace !== -1) rawText = reasoning.slice(lastBrace)
    }

    // Parse — strip markdown fences the model might add despite instructions
    let parsed: Record<string, unknown>
    try {
      const clean = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return Response.json({
        ok: true,
        reply: 'I didn\'t quite get that. Try: "Send 500 to Kasun" or "Pay electricity 1500".',
      })
    }

    const intent = String(parsed.intent ?? 'UNKNOWN')

    // ── TRANSFER ─────────────────────────────────────────────────────────────
    if (intent === 'TRANSFER') {
      const toName = String(parsed.to ?? '').trim()
      const amount = Number(parsed.amount ?? 0)
      const note   = String(parsed.note ?? '').slice(0, 120)

      if (!toName) return Response.json({ ok: true, reply: 'Who should I send money to?' })
      if (amount <= 0) return Response.json({ ok: true, reply: 'How much should I send?' })

      // Resolve recipient from DB — AI never touches this
      const recRows = await runStatement(
        `SELECT u.full_name, a.account_number, a.account_name
         FROM users u JOIN accounts a ON a.user_id = u.id
         WHERE LOWER(u.username) LIKE $1 OR LOWER(u.full_name) LIKE $1
         ORDER BY a.id ASC LIMIT 1`,
        [`%${toName.toLowerCase()}%`]
      )
      if (!recRows.rows.length) {
        return Response.json({ ok: true, reply: `No account found for "${toName}". Check the name and try again.` })
      }
      const recipient = recRows.rows[0]

      // Cannot transfer to yourself
      if (recipient.account_number === (await runStatement(
        'SELECT account_number FROM accounts WHERE user_id = $1 ORDER BY id LIMIT 1', [session.userId]
      )).rows[0]?.account_number) {
        return Response.json({ ok: true, reply: 'You cannot transfer money to yourself.' })
      }

      const senderRows = await runStatement(
        'SELECT account_number, account_name, balance FROM accounts WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [session.userId]
      )
      if (!senderRows.rows.length) return Response.json({ ok: true, reply: 'No account found on your profile.' })
      const sender = senderRows.rows[0]

      await logAudit('AI_TRANSFER_INTENT', { userId: session.userId, to: toName, amount })

      return Response.json({
        ok: true,
        action: {
          type: 'TRANSFER',
          from:   { name: session.fullName,       masked: mask(sender.account_number),    account_number: sender.account_number },
          to:     { name: recipient.full_name,    masked: mask(recipient.account_number), account_number: recipient.account_number },
          amount,
          note,
        },
      })
    }

    // ── PAY_BILL ─────────────────────────────────────────────────────────────
    if (intent === 'PAY_BILL') {
      const billerRaw = String(parsed.biller ?? '').trim()
      const amount    = Number(parsed.amount ?? 0)

      if (!billerRaw) return Response.json({ ok: true, reply: 'Which bill would you like to pay?' })
      if (amount <= 0) return Response.json({ ok: true, reply: 'What is the bill amount?' })

      const biller = resolveBiller(billerRaw)
      if (!biller) {
        const billerList = Object.keys(BILLERS).join(', ')
        return Response.json({ ok: true, reply: `Unknown biller. Supported: ${billerList}.` })
      }

      const senderRows = await runStatement(
        'SELECT account_number, account_name FROM accounts WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [session.userId]
      )
      const sender = senderRows.rows[0]
      if (!sender) return Response.json({ ok: true, reply: 'No account found on your profile.' })

      await logAudit('AI_BILL_INTENT', { userId: session.userId, biller: biller.name, amount })

      return Response.json({
        ok: true,
        action: {
          type: 'PAY_BILL',
          from:   { name: session.fullName, masked: mask(sender.account_number), account_number: sender.account_number },
          to:     { name: biller.name,      masked: 'Biller',                   account_number: biller.account },
          amount,
          note:   `Bill payment — ${biller.name}`,
        },
      })
    }

    // ── BALANCE ───────────────────────────────────────────────────────────────
    if (intent === 'BALANCE') {
      const rows = await runStatement(
        'SELECT account_name, balance FROM accounts WHERE user_id = $1 ORDER BY id ASC',
        [session.userId]
      )
      if (!rows.rows.length) return Response.json({ ok: true, reply: 'No accounts found.' })
      const lines = rows.rows.map((r: { account_name: string; balance: string }) =>
        `${r.account_name}: ${fmtLKR(r.balance)}`
      )
      return Response.json({ ok: true, reply: lines.join('\n') })
    }

    // ── TRANSACTIONS ──────────────────────────────────────────────────────────
    if (intent === 'TRANSACTIONS') {
      const limit = Math.min(Math.max(Number(parsed.limit ?? 3), 1), 5)
      const accRows = await runStatement(
        'SELECT account_number FROM accounts WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [session.userId]
      )
      if (!accRows.rows.length) return Response.json({ ok: true, reply: 'No accounts found.' })
      const acc = accRows.rows[0].account_number

      const txRows = await runStatement(
        `SELECT from_account, to_account, amount, description, created_at
         FROM transactions WHERE from_account = $1 OR to_account = $1
         ORDER BY created_at DESC LIMIT $2`,
        [acc, limit]
      )
      if (!txRows.rows.length) return Response.json({ ok: true, reply: 'No transactions found.' })

      const lines = txRows.rows.map((t: { from_account: string; to_account: string; amount: string; description: string; created_at: string }) => {
        const debit = t.from_account === acc
        const party = debit ? `→ ${mask(t.to_account)}` : `← ${mask(t.from_account)}`
        const sign  = debit ? '−' : '+'
        const date  = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `${date}  ${party}  ${sign}Rs.${Number(t.amount).toLocaleString()}`
      })
      return Response.json({ ok: true, reply: lines.join('\n') })
    }

    // ── UNKNOWN ───────────────────────────────────────────────────────────────
    const reply = String(parsed.reply ?? 'I can transfer money or pay bills. Try: "Send 500 to Kasun".')
    return Response.json({ ok: true, reply })

  } catch (reason) {
    return serviceFailure(reason)
  }
}
