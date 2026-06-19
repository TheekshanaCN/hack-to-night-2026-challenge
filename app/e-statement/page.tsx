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

  function handlePrint() {
    window.print()
  }

  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex-1 p-8 text-black overflow-y-auto">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">E-Statement</h2>
            <button
              onClick={handlePrint}
              style={{ background: '#450043', color: 'white', border: 'none', borderRadius: 8, padding: '0.5rem 1.5rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Print / Save PDF
            </button>
          </div>

          <div className="mb-4 rounded-2xl bg-white px-8 py-5 shadow-md">
            <label className="flex items-center gap-4 text-base font-medium">
              <span>Account:</span>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                style={{ border: 'none', borderBottom: '1px solid #333', background: 'transparent', fontSize: 16, outline: 'none', padding: '0 8px 4px' }}
              >
                {accounts.map(a => (
                  <option key={a.account_number} value={a.account_number}>
                    {a.account_name} — ••{a.account_number.slice(-4)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div ref={printRef} style={{ background: '#e7e7e7', padding: '2rem', minHeight: 560 }}>
            <img src="/loginlogo.png" alt="Nova Bank" style={{ width: 86, height: 86, borderRadius: '50%', objectFit: 'cover' }} />

            <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>
              <h2 style={{ fontWeight: 700 }}>Bank Statement</h2>
              <p><strong>Account Holder:</strong> {holderName}</p>
              <p><strong>Account Number:</strong> {selectedAccount}</p>
              <p><strong>Statement Period:</strong> All transactions</p>
              <p><strong>Branch:</strong> Colombo Main</p>
            </div>

            <div style={{ marginTop: 24, fontSize: 14 }}>
              <h3 style={{ fontWeight: 700 }}>Account Summary</h3>
              <table style={{ marginTop: 16, width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ fontWeight: 400, paddingRight: 16 }}>Current Balance</th>
                    <th style={{ fontWeight: 400, paddingRight: 16 }}>Total Credits (In)</th>
                    <th style={{ fontWeight: 400, paddingRight: 16 }}>Total Debits (Out)</th>
                    <th style={{ fontWeight: 400 }}>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ paddingTop: 8 }}>Rs. {currentAccount ? fmt(currentAccount.balance) : '—'}</td>
                    <td style={{ paddingTop: 8, color: '#16a34a' }}>Rs. {fmt(totalCredits)}</td>
                    <td style={{ paddingTop: 8, color: '#dc2626' }}>Rs. {fmt(totalDebits)}</td>
                    <td style={{ paddingTop: 8 }}>{transactions.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 32, borderTop: '1px solid #333', paddingTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Transaction Details</h3>
              {loading ? (
                <p style={{ marginTop: 16, color: '#666' }}>Loading…</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                  <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333' }}>
                        <th style={{ paddingBottom: 8, fontWeight: 400, width: '13%' }}>Date</th>
                        <th style={{ paddingBottom: 8, fontWeight: 400, width: '28%' }}>Description</th>
                        <th style={{ paddingBottom: 8, fontWeight: 400, width: '18%' }}>Ref ID</th>
                        <th style={{ paddingBottom: 8, fontWeight: 400, width: '15%' }}>Debit (Rs.)</th>
                        <th style={{ paddingBottom: 8, fontWeight: 400, width: '15%' }}>Credit (Rs.)</th>
                        <th style={{ paddingBottom: 8, fontWeight: 400, width: '11%' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan={6} style={{ paddingTop: 24, color: '#666' }}>No transactions found.</td></tr>
                      ) : (
                        transactions.map(t => {
                          const isDebit = t.from_account === selectedAccount
                          return (
                            <tr key={t.id} style={{ borderBottom: '1px solid #ccc' }}>
                              <td style={{ padding: '8px 0' }}>{shortDate(t.created_at)}</td>
                              <td style={{ padding: '8px 0' }}>{t.description ?? '—'}</td>
                              <td style={{ padding: '8px 0' }}>#{t.id}</td>
                              <td style={{ padding: '8px 0', color: '#dc2626' }}>{isDebit ? fmt(t.amount) : '—'}</td>
                              <td style={{ padding: '8px 0', color: '#16a34a' }}>{!isDebit ? fmt(t.amount) : '—'}</td>
                              <td style={{ padding: '8px 0' }}>{t.status}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
