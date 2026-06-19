'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Sidebar from '@/components/sidebar'
import { Search, Bell } from '@/components/Icons'
import styles from './accounts.module.css'

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

  // Edit state
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

  const Header = () => (
    <header className={styles.contentHeader}>
      <h1 className={styles.pageTitle}>Accounts</h1>
      <div className={styles.headerActions}>
        <Search size={22} />
        <Bell size={22} />
        <div className={styles.avatarPlaceholder}>
          <Image src="/person-logo.png" alt="Profile" width={40} height={40} style={{ objectFit: 'cover', borderRadius: '50%' }} />
        </div>
      </div>
    </header>
  )

  return (
    <main className={styles.accountsPage}>
      <Sidebar />
      <section className={styles.content}>

        {/* ===== LIST ===== */}
        {screen === 'list' && (
          <>
            <Header />
            <div className={styles.cardsContainer}>
              {loading ? (
                <p style={{ color: '#6b7280', padding: '1rem' }}>Loading…</p>
              ) : accounts.length === 0 ? (
                <p style={{ color: '#6b7280', padding: '1rem' }}>No accounts found.</p>
              ) : (
                accounts.map(account => (
                  <div key={account.id} className={styles.accountCard}>
                    <div className={styles.iconEdit} onClick={() => openEdit(account)} title="Edit name">✏️</div>
                    <div className={styles.accountCardContent}>
                      <h2 className={styles.accountName}>{account.account_name}</h2>
                      <div className={styles.accountAvatar}>
                        <Image src="/account-logo.png" alt="account" width={100} height={100} style={{ objectFit: 'cover', borderRadius: '50%' }} />
                      </div>
                      <p className={styles.accountDetails}>
                        ••{account.account_number.slice(-4)}<br />
                        Balance: Rs. {fmt(account.balance)}<br />
                        Nova Bank
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ===== EDIT NICKNAME ===== */}
        {screen === 'edit' && editingAccount && (
          <>
            <Header />
            <div className={styles.formContainer}>
              <div className={styles.formCard}>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>Edit Account Name</h2>
                </div>

                <form onSubmit={handleSaveNickname} className={styles.formFields}>
                  <div className={styles.formGroup}>
                    <label>Account Number</label>
                    <input
                      type="text"
                      value={editingAccount.account_number}
                      disabled
                      className={styles.inputDisabled}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Current Balance</label>
                    <input
                      type="text"
                      value={`Rs. ${fmt(editingAccount.balance)}`}
                      disabled
                      className={styles.inputDisabled}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="nickname">Account Name / Nickname</label>
                    <input
                      id="nickname"
                      type="text"
                      value={nickname}
                      onChange={e => { setNickname(e.target.value); setNicknameError('') }}
                      placeholder="Enter account name"
                      className={nicknameError ? styles.inputError : ''}
                    />
                    {nicknameError && <span className={styles.fieldError}>{nicknameError}</span>}
                  </div>

                  <div className={styles.formActionsBottom}>
                    <button type="button" className={styles.btnCancel} onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className={styles.btnUpdate} disabled={saving}>
                      {saving ? 'Saving…' : 'UPDATE'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

      </section>
    </main>
  )
}
