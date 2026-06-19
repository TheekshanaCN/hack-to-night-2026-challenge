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
  { label: 'Food & Dining',    keywords: ['food', 'lunch', 'dinner', 'restaurant', 'cafe', 'meal', 'snack'],                             color: '#f59e0b' },
  { label: 'Bills & Utilities',keywords: ['bill', 'water', 'electricity', 'ceb', 'slt', 'cable', 'dialog', 'airtel', 'hutch', 'peotv'], color: '#6366f1' },
  { label: 'Transfers',        keywords: ['transfer', 'refund', 'fee', 'payment', 'send'],                                               color: '#10b981' },
  { label: 'Shopping',         keywords: ['shop', 'buy', 'purchase', 'amazon', 'store'],                                                 color: '#ec4899' },
  { label: 'Other',            keywords: [],                                                                                              color: '#94a3b8' }
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

  let gradient = ''
  let acc = 0
  for (const e of categoryEntries) {
    gradient += `${e.color} ${acc.toFixed(1)}% ${(acc + e.pct).toFixed(1)}%,`
    acc += e.pct
  }
  gradient = gradient.slice(0, -1) || 'var(--surface-3) 0% 100%'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto' }}>
        <div className="nova-page-header" style={{ marginBottom: '1.75rem' }}>
          <h1 className="nova-page-title">Smart Spend</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Analyse your spending patterns</p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : debits.length === 0 ? (
          <div className="card-nova" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No spending data yet. Make some transactions to see your analysis.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>

            {/* Donut chart */}
            <div className="card-nova" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 240, flex: '0 0 auto' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 20 }}>Spending Breakdown</p>
              <div style={{
                width: 180, height: 180, borderRadius: '50%',
                background: `conic-gradient(${gradient})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(124,58,237,0.2)',
              }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>Total Spent</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0' }}>Rs.{fmt(grandTotal)}</p>
                </div>
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {categoryEntries.map(e => (
                  <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{e.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{e.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category cards */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, alignContent: 'start' }}>
              {categoryEntries.map(e => (
                <div key={e.label} className="card-nova" style={{ padding: '1.25rem', borderLeft: `3px solid ${e.color}` }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{e.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Rs. {fmt(e.amount)}</p>
                  <div style={{ marginTop: 10, height: 4, background: 'var(--surface-3)', borderRadius: 2 }}>
                    <div style={{ height: 4, borderRadius: 2, background: e.color, width: `${e.pct}%`, transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{e.pct.toFixed(1)}% of total</p>
                </div>
              ))}
            </div>

            {/* Recent spending table */}
            <div className="card-nova" style={{ width: '100%', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>Recent Outgoing Transactions</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="nova-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debits.slice(0, 15).map(t => {
                      const cat = categorize(t.description)
                      return (
                        <tr key={t.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description ?? '—'}</td>
                          <td>
                            <span style={{ background: cat.color + '22', color: cat.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {cat.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--error)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            -Rs. {fmt(Number(t.amount))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
