'use client'

import { useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const FaceCapture = lazy(() => import('@/components/FaceCapture'))

type Step = 'form' | 'face' | 'done'

type FormErrors = Partial<{
  username: string
  fullName: string
  nic: string
  email: string
  password: string
  confirmPassword: string
}>

function NovaLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        boxShadow: '0 0 24px rgba(124,58,237,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 800, color: '#fff',
      }}>N</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Nova Bank</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Secure Banking</div>
      </div>
    </div>
  )
}

const STEPS: Step[] = ['form', 'face', 'done']
const STEP_LABELS = { form: 'Details', face: 'Face ID', done: 'Done' }

export default function SignUpPage() {
  const router = useRouter()

  const [step, setStep]               = useState<Step>('form')
  const [username, setUsername]       = useState('')
  const [fullName, setFullName]       = useState('')
  const [nic, setNic]                 = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [errors, setErrors]           = useState<FormErrors>({})
  const [submitting, setSubmitting]   = useState(false)
  const [apiError, setApiError]       = useState('')

  function validate(): boolean {
    const e: FormErrors = {}
    if (!username.trim() || username.trim().length < 3)
      e.username = 'At least 3 characters.'
    if (!/^[a-z0-9_]+$/.test(username.trim()))
      e.username = 'Only lowercase letters, numbers, underscores.'
    if (!fullName.trim() || fullName.trim().length < 2)
      e.fullName = 'Full name is required.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'Valid email required.'
    if (!password || password.length < 8)
      e.password = 'At least 8 characters.'
    if (password !== confirmPassword)
      e.confirmPassword = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) setStep('face')
  }

  async function handleFaceCaptured(descriptor: number[]) {
    setApiError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          fullName: fullName.trim(),
          nic: nic.trim(),
          email: email.trim().toLowerCase(),
          password,
          faceDescriptor: descriptor
        })
      })
      const data = await res.json()
      if (data.ok) {
        setStep('done')
        setTimeout(() => router.push('/dashboard'), 1800)
      } else {
        setApiError(data.message ?? 'Registration failed.')
        setStep('form')
      }
    } catch {
      setApiError('Network error. Please try again.')
      setStep('form')
    } finally {
      setSubmitting(false)
    }
  }

  const currentIdx = STEPS.indexOf(step)

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 520, padding: '2.5rem 2rem' }}>
        <NovaLogo />

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
          {STEPS.map((s, i) => {
            const done    = i < currentIdx
            const current = i === currentIdx
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12,
                    background: done ? 'var(--success)' : current ? 'var(--primary)' : 'var(--surface-3)',
                    color: done || current ? '#fff' : 'var(--text-muted)',
                    boxShadow: current ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
                    transition: 'all 0.3s',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 10, color: current ? 'var(--primary)' : 'var(--text-muted)', fontWeight: current ? 700 : 400 }}>
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 60, height: 1, background: i < currentIdx ? 'var(--success)' : 'var(--border)', margin: '0 6px', marginBottom: 18, transition: 'all 0.3s' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Step 1: Form ── */}
        {step === 'form' && (
          <form onSubmit={handleNext}>
            {apiError && (
              <div className="nova-alert nova-alert-error" style={{ marginBottom: 20 }}>{apiError}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              {[
                { label: 'Username',         id: 'username',        value: username,         set: setUsername,  type: 'text',     placeholder: 'e.g. dilara_2026' },
                { label: 'Full Name',         id: 'fullName',        value: fullName,         set: setFullName,  type: 'text',     placeholder: 'Dilara Perera' },
                { label: 'NIC Number',        id: 'nic',             value: nic,              set: setNic,       type: 'text',     placeholder: '200112345678' },
                { label: 'Email',             id: 'email',           value: email,            set: setEmail,     type: 'email',    placeholder: 'dilara@email.com' },
                { label: 'Password',          id: 'password',        value: password,         set: setPassword,  type: 'password', placeholder: 'Min 8 characters' },
                { label: 'Confirm Password',  id: 'confirmPassword', value: confirmPassword,  set: setConfirm,   type: 'password', placeholder: 'Repeat password' },
              ].map(f => (
                <div key={f.id} className="nova-field">
                  <label className="nova-label" htmlFor={f.id}>{f.label}</label>
                  <input
                    id={f.id}
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="nova-input"
                    style={{ height: 44 }}
                  />
                  {errors[f.id as keyof FormErrors] && (
                    <p style={{ margin: '4px 0 0 4px', fontSize: 11, color: 'var(--error)', fontWeight: 600 }}>
                      {errors[f.id as keyof FormErrors]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="nova-btn nova-btn-primary"
              style={{ width: '100%', marginTop: 24, height: 48, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}
            >
              NEXT — SET UP FACE ID →
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>LOGIN</Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Face capture ── */}
        {step === 'face' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Set Up Face ID</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                Your face will be used to verify your identity at login and before transactions.<br/>
                Ensure good lighting and look directly at the camera.
              </p>
            </div>

            <Suspense fallback={
              <div style={{ width: 280, height: 210, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Loading camera…
              </div>
            }>
              <FaceCapture
                mode="register"
                onDescriptor={handleFaceCaptured}
                onError={(msg) => { setApiError(msg); setStep('form') }}
                prompt="Position your face in the oval, then click Capture"
              />
            </Suspense>

            {submitting && (
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Creating your account…</p>
            )}

            <button
              onClick={() => setStep('form')}
              disabled={submitting}
              style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              ← Back to details
            </button>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--success), #34d399)',
              boxShadow: '0 0 24px rgba(16,185,129,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, color: '#fff',
            }}>✓</div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Account Created!</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Redirecting to your dashboard…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
