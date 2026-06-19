'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Sidebar from '@/components/sidebar'

const FaceCapture = lazy(() => import('@/components/FaceCapture'))

type Errors = Partial<{
  amount: string
  accountNumber: string
  accountName: string
  bank: string
}>

export default function BankTransferPage() {
  const [amount, setAmount] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [bank, setBank] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [step, setStep] = useState<'form' | 'face' | 'confirm' | 'success' | 'failure'>('form')
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [failureMessage, setFailureMessage] = useState('Insufficient funds.')
  const [fromAccount, setFromAccount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [faceError, setFaceError] = useState('')

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => { if (d.ok && d.accounts?.[0]) setFromAccount(d.accounts[0].account_number) })
      .catch(() => {})
  }, [])

  function validate() {
    const e: Errors = {}
    if (!amount) e.amount = 'Amount is required'
    else if (Number(amount) <= 0 || isNaN(Number(amount)))
      e.amount = 'Enter a valid positive amount'
    if (!accountNumber) e.accountNumber = 'Account number is required'
    else if (!/^\d{6,}$/.test(accountNumber))
      e.accountNumber = 'Enter a valid account number'
    if (!accountName) e.accountName = 'Account name is required'
    if (!bank) e.bank = 'Select a bank'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) { setFaceError(''); setStep('face') }
  }

  async function handleFaceVerified(descriptor: number[]) {
    setFaceError('')
    try {
      const res = await fetch('/api/auth/face-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor, context: 'transaction' })
      })
      const data = await res.json()
      if (data.ok) {
        setStep('confirm')
      } else {
        setFaceError(data.message ?? 'Face not recognised. Transfer blocked.')
      }
    } catch {
      setFaceError('Network error during face check.')
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setTransferring(true)
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccount, toAccount: accountNumber, amount: Number(amount), description })
      })
      const data = await res.json()
      if (data.ok) {
        setConfirmation(String(data.transaction?.id ?? '—'))
        setStep('success')
      } else {
        setFailureMessage(data.message ?? 'Transfer failed.')
        setStep('failure')
      }
    } catch {
      setFailureMessage('Network error. Please try again.')
      setStep('failure')
    } finally {
      setTransferring(false)
    }
  }

  function resetForm() {
    setAmount(''); setAccountNumber(''); setAccountName(''); setBank(''); setDescription('')
    setErrors({}); setConfirmation(null); setFaceError(''); setStep('form')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto' }}>
        <div className="nova-page-header" style={{ marginBottom: '1.75rem' }}>
          <h1 className="nova-page-title">Bank Transfer</h1>
        </div>

        <div style={{ maxWidth: 600 }}>

          {/* ── Step: Form ── */}
          {step === 'form' && (
            <form onSubmit={handleNext} className="card-nova" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="nova-field">
                <label className="nova-label" htmlFor="tf-amount">Amount (Rs.)</label>
                <input
                  id="tf-amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="nova-input"
                  style={{ borderColor: errors.amount ? 'var(--error)' : undefined }}
                />
                {errors.amount && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.amount}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="tf-accno">Account Number</label>
                <input
                  id="tf-accno"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="Enter recipient account number"
                  className="nova-input"
                  style={{ borderColor: errors.accountNumber ? 'var(--error)' : undefined }}
                />
                {errors.accountNumber && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.accountNumber}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="tf-accname">Account Name</label>
                <input
                  id="tf-accname"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder="Recipient full name"
                  className="nova-input"
                  style={{ borderColor: errors.accountName ? 'var(--error)' : undefined }}
                />
                {errors.accountName && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.accountName}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="tf-bank">Select Bank</label>
                <select
                  id="tf-bank"
                  value={bank}
                  onChange={e => setBank(e.target.value)}
                  className="nova-input"
                  style={{ borderColor: errors.bank ? 'var(--error)' : undefined }}
                >
                  <option value="">Choose bank</option>
                  <option>Nova Bank</option>
                  <option>First National</option>
                  <option>Global Trust</option>
                  <option>Union Bank</option>
                </select>
                {errors.bank && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{errors.bank}</p>}
              </div>

              <div className="nova-field">
                <label className="nova-label" htmlFor="tf-desc">Description (optional)</label>
                <textarea
                  id="tf-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What's this transfer for?"
                  className="nova-input"
                  style={{ height: 'auto', resize: 'vertical' }}
                />
              </div>

              <button type="submit" className="nova-btn nova-btn-primary" style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', marginTop: 4 }}>
                NEXT →
              </button>
            </form>
          )}

          {/* ── Step: Face ID ── */}
          {step === 'face' && (
            <div className="card-nova" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Face ID Required</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Verify your identity before this transfer is processed.
                </p>
              </div>

              {faceError && <div className="nova-alert nova-alert-error" style={{ width: '100%' }}>{faceError}</div>}

              <Suspense fallback={
                <div style={{ width: 280, height: 210, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Loading camera…
                </div>
              }>
                <FaceCapture
                  mode="verify"
                  onDescriptor={handleFaceVerified}
                  onError={(msg) => setFaceError(msg)}
                  verifyError={faceError}
                  prompt="Look at the camera to authorise this transfer"
                />
              </Suspense>

              <button onClick={() => { setStep('form'); setFaceError('') }} style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                ← Cancel transfer
              </button>
            </div>
          )}

          {/* ── Step: Confirm ── */}
          {step === 'confirm' && (
            <div className="card-nova" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>Confirm Transfer</h3>

              <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Amount', value: `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}` },
                  { label: 'To Account', value: accountNumber },
                  { label: 'Account Name', value: accountName },
                  { label: 'Bank', value: bank },
                  { label: 'Description', value: description || '—' },
                  { label: 'Fee', value: 'Rs. 50.00' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('form')} disabled={transferring} className="nova-btn nova-btn-ghost" style={{ flex: 1, height: 48, fontWeight: 700 }}>
                  BACK
                </button>
                <button onClick={handleTransfer} disabled={transferring} className="nova-btn nova-btn-primary" style={{ flex: 2, height: 48, fontWeight: 700 }}>
                  {transferring ? 'SENDING…' : 'CONFIRM TRANSFER'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Success ── */}
          {step === 'success' && (
            <div className="card-nova" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--success), #34d399)',
                boxShadow: '0 0 24px rgba(16,185,129,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: '#fff',
              }}>✓</div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Transfer Successful!</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Transaction ID: #{confirmation}</p>
              </div>
              <button onClick={resetForm} className="nova-btn nova-btn-primary" style={{ padding: '12px 32px', fontWeight: 700 }}>
                ← BACK TO HOME
              </button>
            </div>
          )}

          {/* ── Step: Failure ── */}
          {step === 'failure' && (
            <div className="card-nova" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(244,63,94,0.15)', border: '2px solid var(--error)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: 'var(--error)',
              }}>✕</div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Transaction Failed!</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{failureMessage}</p>
              </div>
              <button onClick={resetForm} className="nova-btn nova-btn-ghost" style={{ padding: '12px 32px', fontWeight: 700 }}>
                ← TRY AGAIN
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
