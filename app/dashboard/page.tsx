'use client'

import { useEffect, useState } from 'react'
import Sidebar from '../../components/sidebar'
import { Bell, ChevronRight, Search } from '../../components/Icons'

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

    // Refresh balance every 15s
    const interval = setInterval(async () => {
      const accRes = await fetch('/api/accounts')
      const accData = await accRes.json()
      if (accData.ok) setAccounts(accData.accounts)
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const primaryAccount = accounts[0]
  const displayName = user?.fullName ?? user?.username ?? '…'
  const balance = primaryAccount ? `Rs. ${fmt(primaryAccount.balance)}` : 'Rs. …'

  return (
    <main className="dashboard">
      <Sidebar />

      <section className="content">
        <header className="content-header">
          <h1 className="page-title">Dashboard</h1>
          <div className="header-actions">
            <Search size={24} />
            <Bell size={24} />
            <img src="/person-logo.png" alt="profile" className="avatar" />
          </div>
        </header>

        <div className="top-section">
          <div className="welcome-card">
            <h2 className="welcome-title">Welcome back, {displayName.split(' ')[0]}!</h2>
            <div className="balance-card">
              <p className="balance-label">Current Balance</p>
              <p className="balance-amount">{loading ? 'Loading…' : balance}</p>
              <ChevronRight className="balance-chevron" size={30} />
            </div>
            <div className="carousel-dots">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <img src="/dashboard-logo.png" alt="woman" className="welcome-image" />
          </div>

          <div className="payees-card">
            <h3 className="payees-title">My Accounts</h3>
            <div className="payees-list">
              {accounts.map((acc) => (
                <div key={acc.id} className="payee-item">
                  <img src="/person-logo.png" alt="user" className="avatar" />
                  <div className="payee-info">
                    <p>{acc.account_name}</p>
                    <p>••{acc.account_number.slice(-4)} — Rs. {fmt(acc.balance)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="transactions-section">
          <h2 className="transactions-title">Recent Transactions</h2>
          <div className="transactions-card">
            {loading ? (
              <p style={{ color: '#6b7280', padding: '1rem' }}>Loading…</p>
            ) : transactions.length === 0 ? (
              <p style={{ color: '#6b7280', padding: '1rem' }}>No transactions yet.</p>
            ) : (
              transactions.map((t) => {
                const isDebit = primaryAccount && t.from_account === primaryAccount.account_number
                return (
                  <div key={t.id} className="transaction-item">
                    <img src="/person-logo.png" alt="user" className="avatar" />
                    <span className="transaction-date">{shortDate(t.created_at)}</span>
                    <span className="transaction-account">
                      {isDebit ? `→ ••${t.to_account.slice(-4)}` : `← ••${t.from_account.slice(-4)}`}
                    </span>
                    <span className="transaction-amount" style={{ color: isDebit ? '#ef4444' : '#22c55e' }}>
                      {isDebit ? '-' : '+'}Rs. {fmt(t.amount)}
                    </span>
                    <span className="transaction-status">{t.status}</span>
                  </div>
                )
              })
            )}
            <div className="view-all">View all <ChevronRight size={15} /></div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .dashboard {
          width: 100vw;
          min-height: 100vh;
          background: #f1f1f1;
          display: flex;
          gap: 1.5rem;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .content { flex: 1; padding: 1.5rem 1.25rem; overflow-y: auto; min-width: 0; }
        .content-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 28px; font-weight: 700; color: black; }
        .header-actions { display: flex; align-items: center; gap: 1.5rem; }
        .avatar { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; }
        .top-section { margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 1.5rem; }
        .welcome-card { width: 640px; max-width: 100%; height: 230px; background: #e7e1e8; border-radius: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); position: relative; overflow: hidden; flex-shrink: 0; }
        .welcome-title { font-size: 18px; padding: 0.75rem 1rem 0; color: black; }
        .balance-card { position: absolute; left: 5rem; top: 60px; width: 380px; max-width: calc(100% - 2rem); height: 120px; background: black; border-radius: 14px; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0 1rem; }
        .balance-label { font-size: 21px; }
        .balance-amount { color: #a7d93a; font-size: 20px; margin-top: 0.25rem; }
        .balance-chevron { position: absolute; right: 1rem; }
        .carousel-dots { position: absolute; bottom: 1.25rem; left: 160px; display: flex; gap: 0.5rem; }
        .dot { width: 6px; height: 3px; background: #9ca3af; border-radius: 2px; }
        .dot.active { width: 50px; background: #6060d5; }
        .welcome-image { position: absolute; right: 0; bottom: 0; height: 250px; object-fit: cover; }
        .payees-card { width: 270px; height: 230px; background: white; border-radius: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 1rem; color: black; flex: 1; min-width: 200px; overflow-y: auto; }
        .payees-title { font-weight: 600; text-align: center; font-size: 1rem; }
        .payees-list { margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem; }
        .payee-item { display: flex; align-items: center; gap: 0.75rem; }
        .payee-info { font-size: 12px; line-height: 1.4; }
        .payee-info p:first-child { font-weight: 600; }
        .payee-info p:last-child { color: #4b5563; }
        .view-all { text-align: right; margin-top: 1rem; font-size: 13px; display: flex; justify-content: flex-end; align-items: center; gap: 0.25rem; cursor: default; }
        .transactions-section { margin-top: 0.75rem; color: black; }
        .transactions-title { font-size: 18px; font-weight: 700; margin-bottom: 0.75rem; }
        .transactions-card { background: white; border-radius: 22px; box-shadow: 18px 18px 12px rgba(0,0,0,0.15); padding: 1.25rem; width: 1000px; max-width: 100%; overflow-x: auto; min-height: 80px; }
        .transaction-item { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: 0.75rem; flex-wrap: wrap; }
        .transaction-date, .transaction-account, .transaction-amount { font-size: 0.95rem; }
        .transaction-status { background: #d5f1cb; padding: 0.25rem 1.5rem; border-radius: 4px; color: black; font-size: 0.9rem; white-space: nowrap; }
        @media (max-width: 1024px) { .welcome-card { width: 100%; } .transactions-card { width: 100%; } }
        @media (max-width: 768px) { .dashboard { flex-direction: column; gap: 0; } .content { padding: 1rem; } .page-title { font-size: 22px; } .top-section { flex-direction: column; align-items: stretch; } .welcome-card { height: 220px; } .balance-card { width: calc(100% - 2rem); left: 1rem; top: 50px; height: 100px; } .balance-label { font-size: 18px; } .balance-amount { font-size: 18px; } .welcome-image { height: 160px; } .carousel-dots { left: 1.5rem; bottom: 0.75rem; } .payees-card { width: 100%; height: auto; min-height: 120px; } .transactions-card { padding: 1rem; } }
        @media (max-width: 480px) { .header-actions { gap: 0.75rem; } .avatar { width: 35px; height: 35px; } .page-title { font-size: 20px; } .balance-label { font-size: 16px; } .balance-amount { font-size: 16px; } .welcome-card { height: 200px; } .welcome-image { height: 130px; } .transaction-date, .transaction-account, .transaction-amount { font-size: 0.8rem; } }
      `}</style>
    </main>
  )
}
