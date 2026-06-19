'use client'

import { useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const FaceCapture = lazy(() => import('@/components/FaceCapture'))

type Step = 'credentials' | 'setup-face' | 'face'

const CAMERA_FALLBACK = (
  <div style={{ width: 280, height: 210, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
    Loading camera…
  </div>
)

function NovaLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        boxShadow: '0 0 24px rgba(124,58,237,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#fff',
      }}>N</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Nova Bank</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Secure Banking</div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()

  const [step, setStep]         = useState<Step>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [faceLoading, setFaceLoading] = useState(false)

  async function handleLogin() {
    setError('')
    if (!username || !password) { setError('Please enter your username and password.'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.message ?? 'Login failed. Please try again.'); return }

      if (data.requireFaceSetup) {
        setStep('setup-face')
      } else if (data.requireFaceId) {
        setStep('face')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFaceSetup(descriptor: number[]) {
    setFaceLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/face-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
      })
      const data = await res.json()
      if (data.ok) {
        router.push('/dashboard')
      } else {
        setError(data.message ?? 'Could not save Face ID. Try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setFaceLoading(false)
    }
  }

  async function handleFaceVerify(descriptor: number[]) {
    setFaceLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/face-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor, context: 'login' }),
      })
      const data = await res.json()
      if (data.ok) {
        router.push('/dashboard')
      } else {
        setError(data.message ?? 'Face not recognised. Try again.')
        await fetch('/api/auth/logout', { method: 'POST' })
        setTimeout(() => { setStep('credentials'); setError('') }, 2800)
      }
    } catch {
      setError('Network error during face verification.')
      setStep('credentials')
    } finally {
      setFaceLoading(false)
    }
  }

  async function cancelAndGoBack() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setStep('credentials')
    setError('')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <NovaLogo />

        {/* ── Step 1: Credentials ── */}
        {step === 'credentials' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Welcome back</h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Sign in to your account</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="nova-field">
                <label className="nova-label" htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  className="nova-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  autoComplete="username"
                />
              </div>

              <div className="nova-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label className="nova-label" htmlFor="login-password">Password</label>
                  <Link href="/reset-password" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  className="nova-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="nova-alert nova-alert-error" style={{ marginTop: 16 }}>{error}</div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="nova-btn nova-btn-primary"
              style={{ width: '100%', marginTop: 24, height: 48, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}
            >
              {loading ? 'SIGNING IN…' : 'SIGN IN'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
              Don&apos;t have an account?{' '}
              <Link href="/sign-up" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                SIGN UP
              </Link>
            </p>
          </>
        )}

        {/* ── Step 2a: Face ID setup (legacy users) ── */}
        {step === 'setup-face' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 40, padding: '5px 14px' }}>
                <span style={{ fontSize: 14 }}>🔐</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>One-time security setup</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Set Up Face ID</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                Nova Bank now requires Face ID for all accounts.<br/>
                This is a one-time setup — your face is stored securely.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
              {['Position face', 'Click Capture', 'Done ✓'].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  {s}
                </div>
              ))}
            </div>

            {error && <div className="nova-alert nova-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Suspense fallback={CAMERA_FALLBACK}>
                <FaceCapture
                  mode="register"
                  onDescriptor={handleFaceSetup}
                  onError={msg => setError(msg)}
                  prompt="Position your face in the oval, then click Capture"
                />
              </Suspense>
            </div>

            {faceLoading && <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Saving Face ID…</p>}

            <button onClick={cancelAndGoBack} style={{ display: 'block', margin: '16px auto 0', fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              ← Use different account
            </button>
          </>
        )}

        {/* ── Step 2b: Face ID verification ── */}
        {step === 'face' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Face ID</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                Look directly at the camera to verify your identity.
              </p>
            </div>

            {error && <div className="nova-alert nova-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Suspense fallback={CAMERA_FALLBACK}>
                <FaceCapture
                  mode="verify"
                  onDescriptor={handleFaceVerify}
                  onError={msg => { setError(msg); setStep('credentials') }}
                  verifyError={error}
                  prompt={faceLoading ? 'Verifying…' : 'Hold still — scanning your face…'}
                />
              </Suspense>
            </div>

            {faceLoading && <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Verifying…</p>}

            <button onClick={cancelAndGoBack} style={{ display: 'block', margin: '16px auto 0', fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              ← Use different account
            </button>
          </>
        )}
      </div>
    </div>
  )
}
