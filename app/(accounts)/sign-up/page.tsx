'use client'

import { useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthButton from '@/components/authButton'

// Lazy-load FaceCapture to avoid SSR issues (it uses browser APIs)
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
  const [faceDescriptor, setFaceDesc] = useState<number[] | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [apiError, setApiError]       = useState('')

  // ── Form validation ──────────────────────────────────────────────────────────
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

  // ── Face captured ─────────────────────────────────────────────────────────
  async function handleFaceCaptured(descriptor: number[]) {
    setFaceDesc(descriptor)
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

  // ── Shared input style ────────────────────────────────────────────────────
  const inputCls = 'h-[58px] w-full rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-base text-black outline-none transition-shadow placeholder:text-black/45 focus:shadow-[0_4px_4px_0_rgba(0,0,0,0.20)]'

  return (
    <section className="mx-auto min-h-[700px] w-full max-w-[1100px] rounded-[58px] bg-white px-8 py-9 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:px-14">
      <div className="relative mx-auto w-full max-w-[860px]">
        <img src="/loginlogo.png" alt="Nova Bank" className="absolute left-0 top-0 hidden w-[100px] md:block" />

        <h1 className="mb-8 text-center text-[2.2rem] font-bold text-black">SIGN UP</h1>

        {/* Step indicator */}
        <div className="mb-8 flex justify-center gap-4">
          {(['form', 'face', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
                background: step === s ? '#450043' : (i < ['form','face','done'].indexOf(step) ? '#22c55e' : '#d9d9d9'),
                color: step === s || i < ['form','face','done'].indexOf(step) ? 'white' : '#666',
                transition: 'all 0.3s'
              }}>
                {i < ['form','face','done'].indexOf(step) ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, color: step === s ? '#450043' : '#666', fontWeight: step === s ? 700 : 400 }}>
                {s === 'form' ? 'Details' : s === 'face' ? 'Face ID' : 'Done'}
              </span>
              {i < 2 && <div style={{ width: 32, height: 2, background: i < ['form','face','done'].indexOf(step) ? '#22c55e' : '#d9d9d9', transition: 'all 0.3s' }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Form ────────────────────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={handleNext} className="space-y-4">
            {apiError && (
              <p className="rounded-2xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-600">{apiError}</p>
            )}

            {[
              { label: 'Username', id: 'username', value: username, set: setUsername, type: 'text', placeholder: 'e.g. dilara_2026' },
              { label: 'Full Name', id: 'fullName', value: fullName, set: setFullName, type: 'text', placeholder: 'Dilara Perera' },
              { label: 'NIC Number', id: 'nic', value: nic, set: setNic, type: 'text', placeholder: '200112345678' },
              { label: 'Email', id: 'email', value: email, set: setEmail, type: 'email', placeholder: 'dilara@email.com' },
              { label: 'Password', id: 'password', value: password, set: setPassword, type: 'password', placeholder: 'Min 8 characters' },
              { label: 'Confirm Password', id: 'confirm', value: confirmPassword, set: setConfirm, type: 'password', placeholder: 'Repeat password' },
            ].map(f => (
              <div key={f.id} className="grid items-start gap-2 md:grid-cols-[180px_1fr]">
                <label className="pt-3 text-base font-semibold text-black" htmlFor={f.id}>{f.label}:</label>
                <div>
                  <input
                    id={f.id}
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className={inputCls}
                  />
                  {errors[f.id as keyof FormErrors] && (
                    <p className="mt-1 pl-4 text-xs font-semibold text-red-500">{errors[f.id as keyof FormErrors]}</p>
                  )}
                </div>
              </div>
            ))}

            <div className="mt-6 flex justify-center">
              <AuthButton type="submit">NEXT — SET UP FACE ID →</AuthButton>
            </div>

            <p className="mt-4 text-center text-sm font-bold text-black">
              Already have an account?{' '}
              <Link href="/login" className="text-[#450043] underline">LOGIN</Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Face capture ─────────────────────────────────────────── */}
        {step === 'face' && (
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-black">Set Up Face ID</h2>
              <p className="mt-1 text-sm text-gray-500">
                Your face will be used to verify your identity at login and before transactions.
                Ensure good lighting and look directly at the camera.
              </p>
            </div>

            <Suspense fallback={<div style={{ width: 280, height: 210, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading camera…</div>}>
              <FaceCapture
                mode="register"
                onDescriptor={handleFaceCaptured}
                onError={(msg) => { setApiError(msg); setStep('form') }}
                prompt="Position your face in the oval, then click Capture"
              />
            </Suspense>

            {submitting && (
              <p className="text-sm font-semibold text-[#450043]">Creating your account…</p>
            )}

            <button
              onClick={() => setStep('form')}
              disabled={submitting}
              className="text-sm text-gray-400 underline"
            >
              ← Back to details
            </button>
          </div>
        )}

        {/* ── Step 3: Done ─────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
              ✓
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-black">Account Created!</h2>
              <p className="mt-2 text-sm text-gray-500">Redirecting to your dashboard…</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
