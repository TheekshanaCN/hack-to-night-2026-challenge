'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/sidebar'

type Transaction = {
  id: number
  from_account: string
  to_account: string
  amount: string
  description: string
  created_at: string
}

type Category = {
  label: string
  keywords: string[]
  color: string
}

const CATEGORIES: Category[] = [
  { label: 'Food & Dining', keywords: ['food', 'lunch', 'dinner', 'restaurant', 'cafe', 'meal', 'snack'], color: '#f59e0b' },
  { label: 'Bills & Utilities', keywords: ['bill', 'water', 'electricity', 'ceb', 'slt', 'cable', 'dialog', 'airtel', 'hutch', 'peotv'], color: '#6366f1' },
  { label: 'Transfers', keywords: ['transfer', 'refund', 'fee', 'payment', 'send'], color: '#10b981' },
  { label: 'Shopping', keywords: ['shop', 'buy', 'purchase', 'amazon', 'store'], color: '#ec4899' },
  { label: 'Other', keywords: [], color: '#94a3b8' }
]

function categorize(desc: string | null): Category {
  const d = (desc ?? '').toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => d.includes(k))) return cat
  }
  return CATEGORIES[CATEGORIES.length - 1]
}

function fmt(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2 })
}

export default function SmartSpendPage() {
  const [fromAccount, setFromAccount] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(async d => {
        if (!d.ok || !d.accounts?.[0]) return
        const acn = d.accounts[0].account_number
        setFromAccount(acn)
        const tx = await fetch(`/api/transactions?account=${acn}`).then(r => r.json())
        if (tx.ok) setTransactions(tx.transactions)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Only outgoing (debits) for spending analysis
  const debits = transactions.filter(t => t.from_account === fromAccount)

  const totals: Record<string, number> = {}
  for (const tx of debits) {
    const cat = categorize(tx.description)
    totals[cat.label] = (totals[cat.label] ?? 0) + Number(tx.amount)
  }

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)

  const categoryEntries = CATEGORIES.filter(c => totals[c.label] > 0).map(c => ({
    ...c,
    amount: totals[c.label],
    pct: grandTotal > 0 ? (totals[c.label] / grandTotal) * 100 : 0
  }))

  // Build a simple CSS donut chart via conic-gradient
  let gradient = ''
  let acc = 0
  for (const e of categoryEntries) {
    gradient += `${e.color} ${acc.toFixed(1)}% ${(acc + e.pct).toFixed(1)}%,`
    acc += e.pct
  }
  gradient = gradient.slice(0, -1) || '#e5e7eb 0% 100%'

  return (
    <div style={{ minHeight: '100vh', background: '#f1f1f1', display: 'flex' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', color: '#111' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Smart Spend</h2>

        {loading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : debits.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: '#9ca3af' }}>
            <p>No spending data yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {/* Donut chart */}
            <div style={{ background: 'white', borderRadius: 24, padding: '2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 260 }}>
              <p style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Spending Breakdown</p>
              <div style={{
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: `conic-gradient(${gradient})`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 11, color: '#6b7280' }}>Total Spent</p>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Rs.{fmt(grandTotal)}</p>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {categoryEntries.map(e => (
                  <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{e.label}</span>
                    <span style={{ fontWeight: 600 }}>{e.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category cards */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, alignContent: 'start' }}>
              {categoryEntries.map(e => (
                <div key={e.label} style={{ background: 'white', borderRadius: 18, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${e.color}` }}>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{e.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 700 }}>Rs. {fmt(e.amount)}</p>
                  <div style={{ marginTop: 8, height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ height: 6, borderRadius: 3, background: e.color, width: `${e.pct}%` }} />
                  </div>
                  <p style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>{e.pct.toFixed(1)}% of total</p>
                </div>
              ))}
            </div>

            {/* Recent spending transactions */}
            <div style={{ width: '100%', background: 'white', borderRadius: 22, padding: '1.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Recent Outgoing Transactions</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500, paddingBottom: 8, color: '#6b7280' }}>Date</th>
                    <th style={{ textAlign: 'left', fontWeight: 500, paddingBottom: 8, color: '#6b7280' }}>Description</th>
                    <th style={{ textAlign: 'left', fontWeight: 500, paddingBottom: 8, color: '#6b7280' }}>Category</th>
                    <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 8, color: '#6b7280' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {debits.slice(0, 15).map(t => {
                    const cat = categorize(t.description)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0', color: '#374151' }}>{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                        <td style={{ padding: '8px 0', color: '#111' }}>{t.description ?? '—'}</td>
                        <td style={{ padding: '8px 0' }}>
                          <span style={{ background: cat.color + '22', color: cat.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{cat.label}</span>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>-Rs. {fmt(t.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
