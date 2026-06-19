'use client'

import { useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthButton from '@/components/authButton'

const FaceCapture = lazy(() => import('@/components/FaceCapture'))

type Step = 'credentials' | 'face'

export default function LoginPage() {
  const router   = useRouter()
  const [step, setStep]         = useState<Step>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [faceLoading, setFaceLoading] = useState(false)

  // ── Step 1: credentials ───────────────────────────────────────────────────
  async function handleLogin() {
    setError('')
    if (!username || !password) {
      setError('Please enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.message ?? 'Login failed. Please try again.')
        return
      }
      if (data.requireFaceId) {
        // Session cookie is now set; proceed to face verification
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

  // ── Step 2: face ID ───────────────────────────────────────────────────────
  async function handleFaceVerify(descriptor: number[]) {
    setFaceLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/face-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor, context: 'login' })
      })
      const data = await res.json()
      if (data.ok) {
        router.push('/dashboard')
      } else {
        setError(data.message ?? 'Face not recognised.')
        setStep('credentials')
        // Logout the pending session so it doesn't hang
        await fetch('/api/auth/logout', { method: 'POST' })
      }
    } catch {
      setError('Network error during face verification.')
      setStep('credentials')
    } finally {
      setFaceLoading(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[480px] w-full max-w-[1060px] overflow-hidden rounded-[56px] bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:min-h-[660px]">
      {/* Left panel */}
      <aside
        aria-label="Nova Bank shell artwork"
        className="relative hidden w-[46.2%] shrink-0 overflow-hidden bg-[#1d0730] md:block"
      >
        <img src="/loginshellbg.png" alt="" className="size-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/loginlogo.png" alt="Nova Bank" className="w-[38%] max-w-[276px]" />
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-10">
        <div className="w-full max-w-[450px] text-center">

          {/* ── Credentials step ─────────────────────────────────────────── */}
          {step === 'credentials' && (
            <>
              <h1 className="mb-11 text-[2.45rem] font-bold text-black">LOGIN</h1>

              <div className="space-y-5">
                <div className="relative">
                  <label className="sr-only" htmlFor="login-account">Username</label>
                  <img src="/person.png" alt="" aria-hidden="true" className="-translate-y-1/2 absolute left-8 top-1/2 size-6" />
                  <input
                    id="login-account"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="h-[64px] w-full rounded-[40px] border-0 bg-[#d9d9d9] px-8 pl-20 text-lg text-black shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] outline-none transition-shadow placeholder:text-black/45 focus:shadow-[0_4px_4px_0_rgba(0,0,0,0.30)]"
                  />
                </div>

                <div className="relative">
                  <label className="sr-only" htmlFor="login-password">Password</label>
                  <img src="/password.png" alt="" aria-hidden="true" className="-translate-y-1/2 absolute left-8 top-1/2 size-6" />
                  <input
                    id="login-password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="h-[64px] w-full rounded-[40px] border-0 bg-[#d9d9d9] px-8 pl-20 text-lg text-black shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] outline-none transition-shadow placeholder:text-black/45 focus:shadow-[0_4px_4px_0_rgba(0,0,0,0.30)]"
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

              <div className="mt-3 text-right">
                <Link href="/reset-password" className="text-sm font-bold text-black">Forgot password?</Link>
              </div>

              <AuthButton className="mt-8" onClick={handleLogin} disabled={loading}>
                {loading ? 'SIGNING IN…' : 'SIGN IN'}
              </AuthButton>

              <p className="mt-6 text-sm font-bold text-black">Don't have an account?</p>
              <Link href="/sign-up" className="text-2xl font-bold text-black">SIGN UP</Link>
            </>
          )}

          {/* ── Face ID step ─────────────────────────────────────────────── */}
          {step === 'face' && (
            <>
              <h1 className="mb-2 text-[1.8rem] font-bold text-black">Face ID Verification</h1>
              <p className="mb-6 text-sm text-gray-500">
                Look directly at the camera to verify your identity.
              </p>

              {error && <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>}

              <div className="flex justify-center">
                <Suspense fallback={
                  <div style={{ width: 280, height: 210, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
                    Loading camera…
                  </div>
                }>
                  <FaceCapture
                    mode="verify"
                    onDescriptor={handleFaceVerify}
                    onError={(msg) => { setError(msg); setStep('credentials') }}
                    prompt={faceLoading ? 'Verifying…' : 'Hold still — scanning your face…'}
                  />
                </Suspense>
              </div>

              {faceLoading && (
                <p className="mt-4 text-sm font-semibold text-[#450043]">Verifying…</p>
              )}

              <button
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' })
                  setStep('credentials')
                  setError('')
                }}
                className="mt-4 text-sm text-gray-400 underline"
              >
                ← Use different account
              </button>
            </>
          )}

        </div>
      </div>
    </section>
  )
}
