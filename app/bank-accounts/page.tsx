'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { CreditCard, Lock } from 'lucide-react'

type Account = {
  id: number
  account_number: string
  account_name: string
  balance: string
  username: string
  full_name: string
}

type Screen = 'list' | 'edit'

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })
}

export default function AccountsPage() {
  const router = useRouter()

  const [screen, setScreen] = useState<Screen>('list')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => { if (d.ok) setAccounts(d.accounts) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function openEdit(account: Account) {
    setEditingAccount(account)
    setNickname(account.account_name)
    setNicknameError('')
    setScreen('edit')
  }

  function cancelEdit() {
    setEditingAccount(null)
    setNickname('')
    setNicknameError('')
    setScreen('list')
  }

  async function handleSaveNickname(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || nickname.trim().length < 2) {
      setNicknameError('Name must be at least 2 characters')
      return
    }
    if (!editingAccount) return
    setSaving(true)
    try {
      const res = await fetch(`/api/accounts/${editingAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: nickname.trim() })
      })
      const data = await res.json()
      if (data.ok) {
        setAccounts(prev =>
          prev.map(a => a.id === editingAccount.id ? { ...a, account_name: data.account.account_name } : a)
        )
        cancelEdit()
      } else {
        setNicknameError(data.message ?? 'Failed to update.')
      }
    } catch {
      setNicknameError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto' }}>
        <div className="nova-page-header" style={{ marginBottom: '1.75rem' }}>
          {screen === 'edit' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>←</button>
              <h1 className="nova-page-title">Edit Account</h1>
            </div>
          ) : (
            <h1 className="nova-page-title">Accounts</h1>
          )}
        </div>

        {/* ── LIST ── */}
        {screen === 'list' && (
          <>
            {loading ? (
              <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Loading…</p>
            ) : accounts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No accounts found.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {accounts.map(account => (
                  <div key={account.id} className="card-nova" style={{ padding: '1.5rem', position: 'relative' }}>
                    <button
                      onClick={() => openEdit(account)}
                      title="Edit name"
                      style={{
                        position: 'absolute', top: 14, right: 14,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 8, width: 32, height: 32,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14,
                      }}
                    >✏️</button>

                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                    }}>
                      <CreditCard size={22} color="#fff" />
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {account.account_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'monospace' }}>
                      •••• •••• {account.account_number.slice(-4)}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Balance</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Rs. {fmt(account.balance)}</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Nova Bank</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── EDIT NICKNAME ── */}
        {screen === 'edit' && editingAccount && (
          <div style={{ maxWidth: 480 }}>
            <form onSubmit={handleSaveNickname} className="card-nova" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="nova-field">
                <label className="nova-label">Account Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={editingAccount.account_number}
                    disabled
                    className="nova-input"
                    style={{ paddingRight: 40, opacity: 0.5, cursor: 'not-allowed' }}
                  />
                  <Lock size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="nova-field">
                <label className="nova-label">Current Balance</label>
                <input
                  value={`Rs. ${fmt(editingAccount.balance)}`}
                  disabled
                  className="nova-input"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                />
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="acc-nickname">Account Name / Nickname</label>
                <input
                  id="acc-nickname"
                  value={nickname}
                  onChange={e => { setNickname(e.target.value); setNicknameError('') }}
                  placeholder="Enter account name"
                  className="nova-input"
                  style={{ borderColor: nicknameError ? 'var(--error)' : undefined }}
                />
                {nicknameError && (
                  <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4, paddingLeft: 4 }}>{nicknameError}</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={cancelEdit} disabled={saving} className="nova-btn nova-btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="nova-btn nova-btn-primary" style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700 }}>
                  {saving ? 'Saving…' : 'UPDATE'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
