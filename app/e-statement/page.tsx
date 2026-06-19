'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/sidebar'

type Transaction = {
  id: number
  from_account: string
  to_account: string
  amount: string
  description: string
  status: string
  created_at: string
}

type Account = {
  account_number: string
  account_name: string
  balance: string
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function EStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [holderName, setHolderName] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return
        setAccounts(d.accounts)
        if (d.accounts[0]) {
          setSelectedAccount(d.accounts[0].account_number)
          setHolderName(d.accounts[0].account_name)
        }
      })
      .catch(() => {})
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.ok) setHolderName(d.user.fullName) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedAccount) return
    setLoading(true)
    fetch(`/api/transactions?account=${selectedAccount}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setTransactions(d.transactions) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedAccount])

  const currentAccount = accounts.find(a => a.account_number === selectedAccount)

  const totalDebits = transactions
    .filter(t => t.from_account === selectedAccount)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalCredits = transactions
    .filter(t => t.to_account === selectedAccount)
    .reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto' }}>
        <div className="nova-page-header" style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 className="nova-page-title">E-Statement</h1>
          <button
            onClick={() => window.print()}
            className="nova-btn nova-btn-primary"
            style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600 }}
          >
            Print / Save PDF
          </button>
        </div>

        {/* Account selector */}
        <div className="card-nova" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Account:</label>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="nova-input"
            style={{ flex: 1, maxWidth: 400 }}
          >
            {accounts.map(a => (
              <option key={a.account_number} value={a.account_number}>
                {a.account_name} — ••{a.account_number.slice(-4)}
              </option>
            ))}
          </select>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
          {[
            { label: 'Current Balance', value: currentAccount ? `Rs. ${fmt(currentAccount.balance)}` : '—', color: 'var(--primary)' },
            { label: 'Total Credits', value: `Rs. ${fmt(totalCredits)}`, color: 'var(--success)' },
            { label: 'Total Debits', value: `Rs. ${fmt(totalDebits)}`, color: 'var(--error)' },
            { label: 'Transactions', value: String(transactions.length), color: 'var(--gold)' },
          ].map(s => (
            <div key={s.label} className="card-nova" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Statement header (printable) */}
        <div ref={printRef} className="card-nova" style={{ padding: '2rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: '#fff',
            }}>N</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Nova Bank</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bank Statement — Colombo Main</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{holderName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedAccount}</div>
            </div>
          </div>

          {/* Transaction table */}
          {loading ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading…</p>
          ) : transactions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No transactions found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="nova-table" style={{ width: '100%', minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Ref ID</th>
                    <th style={{ textAlign: 'right', color: 'var(--error)' }}>Debit (Rs.)</th>
                    <th style={{ textAlign: 'right', color: 'var(--success)' }}>Credit (Rs.)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const isDebit = t.from_account === selectedAccount
                    return (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{shortDate(t.created_at)}</td>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description ?? '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>#{t.id}</td>
                        <td style={{ textAlign: 'right', color: 'var(--error)', fontWeight: 600 }}>{isDebit ? fmt(t.amount) : '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{!isDebit ? fmt(t.amount) : '—'}</td>
                        <td>
                          <span className={`nova-badge nova-badge-${t.status === 'completed' ? 'success' : 'warning'}`}>{t.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
