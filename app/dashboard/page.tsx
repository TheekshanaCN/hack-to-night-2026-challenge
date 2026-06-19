'use client'

import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import Sidebar from '../../components/sidebar'
import { Bell, Search } from '../../components/Icons'
import Link from 'next/link'

const AIChat        = lazy(() => import('@/components/AIChat'))
const AIChatEmbedded = lazy(() => import('@/components/AIChat').then(m => ({ default: m.AIChatEmbedded })))

type Account = {
  id: number
  account_number: string
  account_name: string
  balance: string
}

type Transaction = {
  id: number
  from_account: string
  to_account: string
  amount: string
  description: string
  status: string
  created_at: string
}

type User = {
  userId: number
  username: string
  fullName: string
  role: string
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: string; id: string; label: string; detail: string }[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setSearchResults(d.results) })
      .catch(() => {})
      .finally(() => setSearching(false))
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(searchQuery), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery, runSearch])

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me')
        if (!meRes.ok) return
        const meData = await meRes.json()
        setUser(meData.user)

        const accRes = await fetch('/api/accounts')
        const accData = await accRes.json()
        if (!accData.ok || !accData.accounts?.length) return
        setAccounts(accData.accounts)

        const primary = accData.accounts[0].account_number
        const txRes = await fetch(`/api/transactions?account=${primary}`)
        const txData = await txRes.json()
        if (txData.ok) setTransactions(txData.transactions.slice(0, 5))
      } finally {
        setLoading(false)
      }
    }
    load()

    const interval = setInterval(async () => {
      const accRes = await fetch('/api/accounts')
      const accData = await accRes.json()
      if (accData.ok) setAccounts(accData.accounts)
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const primaryAccount = accounts[0]
  const displayName = user?.fullName ?? user?.username ?? '…'
  const balance = primaryAccount ? fmt(primaryAccount.balance) : '…'

  const quickActions = [
    { label: 'Transfer', href: '/bank-transfer', icon: '↗' },
    { label: 'Pay Bills', href: '/pay-bills', icon: '⚡' },
    { label: 'Accounts', href: '/bank-accounts', icon: '💳' },
    { label: 'Statement', href: '/e-statement', icon: '📄' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      {/* ── Centre content + right AI panel ── */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>

      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto', minWidth: 0 }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Welcome back, <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{displayName.split(' ')[0]}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSearchOpen(true)}
              style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <Search size={16} />
            </button>
            <button style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Bell size={16} />
            </button>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff',
            }}>
              {displayName[0]?.toUpperCase() ?? 'U'}
            </div>
          </div>
        </header>

        {/* Balance + quick actions */}
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {/* Primary balance card */}
          <div style={{
            flex: '1 1 320px', minWidth: 280,
            background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #6d28d9 100%)',
            borderRadius: 20, padding: '1.75rem 2rem',
            boxShadow: '0 0 40px rgba(124,58,237,0.3)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: -40, right: 40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Primary Balance</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '10px 0 4px', letterSpacing: '-0.02em' }}>
              {loading ? '…' : `Rs. ${balance}`}
            </p>
            {primaryAccount && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                •• {primaryAccount.account_number.slice(-4)} · {primaryAccount.account_name}
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: '0 0 auto' }}>
            {quickActions.map(a => (
              <Link key={a.href} href={a.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '14px 20px',
                background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 14,
                textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                transition: 'all 0.2s', cursor: 'pointer', minWidth: 90,
              }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Accounts row */}
        {accounts.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>My Accounts</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {accounts.map(acc => (
                <div key={acc.id} className="card-nova" style={{ padding: '1rem 1.25rem', minWidth: 200, flex: '1 1 180px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {acc.account_name}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Rs. {fmt(acc.balance)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>•• {acc.account_number.slice(-4)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recent Transactions</h2>
          <div className="card-nova" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <p style={{ color: 'var(--text-muted)', padding: '1.25rem' }}>Loading…</p>
            ) : transactions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '1.25rem' }}>No transactions yet.</p>
            ) : (
              <table className="nova-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const isDebit = primaryAccount && t.from_account === primaryAccount.account_number
                    return (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{shortDate(t.created_at)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                          {isDebit ? `→ ••${t.to_account.slice(-4)}` : `← ••${t.from_account.slice(-4)}`}
                        </td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description || '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isDebit ? 'var(--error)' : 'var(--success)', whiteSpace: 'nowrap' }}>
                          {isDebit ? '-' : '+'}Rs. {fmt(t.amount)}
                        </td>
                        <td>
                          <span className={`nova-badge nova-badge-${t.status === 'completed' ? 'success' : 'warning'}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)' }}>
              <Link href="/e-statement" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                View all transactions →
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Right: Nova AI panel — always visible ── */}
      <aside style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, overflow: 'hidden' }}>
        <Suspense fallback={
          <div style={{ flex: 1, background: 'var(--surface-1)', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
          </div>
        }>
          <AIChatEmbedded />
        </Suspense>
      </aside>

      </div>{/* end centre+right wrapper */}

      {/* Global search modal */}
      {searchOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQuery(''); setSearchResults([]) } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', backdropFilter: 'blur(4px)' }}
        >
          <div className="card-nova" style={{ width: '90%', maxWidth: 560, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Search size={16} />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search accounts, transactions…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)', background: 'transparent' }}
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {searching && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Searching…</p>}
              {!searching && searchQuery && searchResults.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No results for &quot;{searchQuery}&quot;</p>}
              {searchResults.map((r, i) => (
                <div key={i} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, background: r.type === 'account' ? 'rgba(124,58,237,0.2)' : 'rgba(16,185,129,0.15)', color: r.type === 'account' ? 'var(--primary)' : 'var(--success)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{r.type}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{r.label}</p>
                    {r.detail && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{r.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
