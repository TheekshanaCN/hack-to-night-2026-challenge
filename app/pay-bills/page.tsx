'use client'

import { useState, useEffect } from 'react'
import Sidebar from '../../components/sidebar'
import { CheckCircle2, AlertTriangle, ChevronLeft } from '../../components/Icons'

type Biller = {
  id: string
  name: string
  emoji: string
}

const billers: Biller[] = [
  { id: 'water',      name: 'Water Board',       emoji: '💧' },
  { id: 'cable',      name: 'Cable TV',           emoji: '📺' },
  { id: 'ceb',        name: 'CEB Electricity',    emoji: '⚡' },
  { id: 'airtel',     name: 'Airtel',             emoji: '📶' },
  { id: 'dialog',     name: 'Dialog',             emoji: '📱' },
  { id: 'slt',        name: 'Sri Lanka Telecom',  emoji: '🌐' },
  { id: 'peotv',      name: 'PEO TV',             emoji: '📡' },
  { id: 'hutch',      name: 'Hutch',              emoji: '📡' },
  { id: 'aia',        name: 'AIA Insurance',      emoji: '🛡️' },
  { id: 'lolc',       name: 'LOLC Finance',       emoji: '🏦' },
  { id: 'insurance2', name: 'Insurance',          emoji: '🛡️' },
  { id: 'hsbc',       name: 'HSBC',               emoji: '🏛️' },
]

type Screen = 'select' | 'form' | 'success' | 'failed'

type FormErrors = {
  accountNumber?: string
  billId?: string
  dueAmount?: string
}

export default function PayBillsPage() {
  const [screen, setScreen] = useState<Screen>('select')
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [billId, setBillId] = useState('')
  const [dueAmount, setDueAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [confirmationNumber, setConfirmationNumber] = useState('')
  const [failReason, setFailReason] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [fromAccount, setFromAccount] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => { if (d.ok && d.accounts?.[0]) setFromAccount(d.accounts[0].account_number) })
      .catch(() => {})
  }, [])

  function handleSelectBiller(biller: Biller) {
    setSelectedBiller(biller)
    setErrors({})
    setScreen('form')
  }

  function validateForm(): boolean {
    const newErrors: FormErrors = {}
    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required'
    } else if (!/^[0-9]{6,16}$/.test(accountNumber.trim())) {
      newErrors.accountNumber = 'Enter a valid account number (6–16 digits)'
    }
    if (!billId.trim()) {
      newErrors.billId = 'Bill ID is required'
    } else if (billId.trim().length < 3) {
      newErrors.billId = 'Bill ID looks too short'
    }
    if (!dueAmount.trim()) {
      newErrors.dueAmount = 'Due amount is required'
    } else {
      const amount = Number(dueAmount)
      if (Number.isNaN(amount) || amount <= 0) {
        newErrors.dueAmount = 'Enter a valid amount greater than 0'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handlePayNow() {
    if (!validateForm()) return
    setPaying(true)
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccount,
          toAccount: accountNumber,
          amount: Number(dueAmount),
          description: `Bill payment: ${selectedBiller?.name ?? 'Unknown'} | Ref: ${billId}${remarks ? ' | ' + remarks : ''}`
        })
      })
      const data = await res.json()
      if (data.ok) {
        setConfirmationNumber(String(data.transaction?.id ?? '—'))
        setScreen('success')
      } else {
        setFailReason(data.message ?? 'Payment failed.')
        setScreen('failed')
      }
    } catch {
      setFailReason('Network error. Please try again.')
      setScreen('failed')
    } finally {
      setPaying(false)
    }
  }

  function resetToHome() {
    setScreen('select')
    setSelectedBiller(null)
    setAccountNumber('')
    setBillId('')
    setDueAmount('')
    setRemarks('')
    setErrors({})
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto' }}>
        <div className="nova-page-header" style={{ marginBottom: '1.75rem' }}>
          {screen === 'form' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setScreen('select')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>←</button>
              <h1 className="nova-page-title">Pay Bills</h1>
            </div>
          ) : (
            <h1 className="nova-page-title">Pay Bills</h1>
          )}
        </div>

        <div style={{ maxWidth: 680 }}>

          {/* ── Select biller ── */}
          {screen === 'select' && (
            <div className="card-nova" style={{ padding: '2rem' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Select a biller to get started</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                {billers.map(biller => (
                  <button
                    key={biller.id}
                    onClick={() => handleSelectBiller(biller)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14,
                      padding: '1.25rem 0.75rem', cursor: 'pointer',
                      transition: 'all 0.2s', color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  >
                    <span style={{ fontSize: 28 }}>{biller.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.25 }}>{biller.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Bill form ── */}
          {screen === 'form' && selectedBiller && (
            <div className="card-nova" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 28 }}>{selectedBiller.emoji}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedBiller.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fill in your bill details below</div>
                </div>
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="bill-accno">Account Number</label>
                <input
                  id="bill-accno"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="nova-input"
                  style={{ borderColor: errors.accountNumber ? 'var(--error)' : undefined }}
                />
                {errors.accountNumber && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.accountNumber}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="bill-id">Bill ID</label>
                <input
                  id="bill-id"
                  value={billId}
                  onChange={e => setBillId(e.target.value)}
                  placeholder="Enter bill ID / reference"
                  className="nova-input"
                  style={{ borderColor: errors.billId ? 'var(--error)' : undefined }}
                />
                {errors.billId && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.billId}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="bill-amount">Due Amount (Rs.)</label>
                <input
                  id="bill-amount"
                  type="number"
                  value={dueAmount}
                  onChange={e => setDueAmount(e.target.value)}
                  placeholder="0.00"
                  className="nova-input"
                  style={{ borderColor: errors.dueAmount ? 'var(--error)' : undefined }}
                />
                {errors.dueAmount && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.dueAmount}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="bill-remarks">Remarks (optional)</label>
                <input
                  id="bill-remarks"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Optional note"
                  className="nova-input"
                />
              </div>

              <button
                onClick={handlePayNow}
                disabled={paying}
                className="nova-btn nova-btn-primary"
                style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', marginTop: 4 }}
              >
                {paying ? 'PROCESSING…' : 'PAY NOW'}
              </button>
            </div>
          )}

          {/* ── Success ── */}
          {screen === 'success' && (
            <div className="card-nova" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--success), #34d399)',
                boxShadow: '0 0 24px rgba(16,185,129,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: '#fff',
              }}>✓</div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Payment Successful!</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Confirmation: #{confirmationNumber}</p>
              </div>
              <button onClick={resetToHome} className="nova-btn nova-btn-primary" style={{ padding: '12px 32px', fontWeight: 700 }}>
                ← BACK TO HOME
              </button>
            </div>
          )}

          {/* ── Failed ── */}
          {screen === 'failed' && (
            <div className="card-nova" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(244,63,94,0.15)', border: '2px solid var(--error)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: 'var(--error)',
              }}>✕</div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Payment Failed!</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{failReason}</p>
              </div>
              <button onClick={resetToHome} className="nova-btn nova-btn-ghost" style={{ padding: '12px 32px', fontWeight: 700 }}>
                ← BACK TO HOME
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
