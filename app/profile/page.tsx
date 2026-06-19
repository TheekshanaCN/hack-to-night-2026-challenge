'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'

type Profile = {
  username: string
  full_name: string
  email: string
  nic: string
  created_at: string
}

type Tab = 'info' | 'password'

export default function ProfilePage() {
  const router = useRouter()

  const [tab, setTab]           = useState<Tab>('info')
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)

  // Info form
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [nic, setNic]           = useState('')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoMsg, setInfoMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // Password form
  const [curPwd, setCurPwd]     = useState('')
  const [newPwd, setNewPwd]     = useState('')
  const [conPwd, setConPwd]     = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { router.push('/login'); return }
        setProfile(d.profile)
        setFullName(d.profile.full_name)
        setEmail(d.profile.email   ?? '')
        setNic(d.profile.nic       ?? '')
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault()
    setInfoMsg(null)
    setInfoSaving(true)
    try {
      const res  = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, nic }),
      })
      const data = await res.json()
      setInfoMsg({ ok: data.ok, text: data.message ?? (data.ok ? 'Saved.' : 'Error.') })
      if (data.ok && profile) setProfile({ ...profile, full_name: fullName, email, nic })
    } catch {
      setInfoMsg({ ok: false, text: 'Network error.' })
    } finally {
      setInfoSaving(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd !== conPwd) { setPwdMsg({ ok: false, text: 'New passwords do not match.' }); return }
    if (newPwd.length < 8)  { setPwdMsg({ ok: false, text: 'New password must be at least 8 characters.' }); return }
    setPwdSaving(true)
    try {
      const res  = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      })
      const data = await res.json()
      setPwdMsg({ ok: data.ok, text: data.message ?? (data.ok ? 'Password changed.' : 'Error.') })
      if (data.ok) { setCurPwd(''); setNewPwd(''); setConPwd('') }
    } catch {
      setPwdMsg({ ok: false, text: 'Network error.' })
    } finally {
      setPwdSaving(false)
    }
  }

  const inputCls = `
    w-full rounded-2xl bg-[#f3f4f6] border border-transparent px-5 py-3 text-sm text-black
    outline-none transition focus:border-[#450043] focus:bg-white
    disabled:opacity-50 disabled:cursor-not-allowed
  `

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f1f1' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 760, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0 }}>My Profile</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Manage your personal information and security settings</p>
        </div>

        {loading ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* Avatar + username chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: '2rem', background: 'white', borderRadius: 20, padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #450043, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                {(profile?.full_name ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{profile?.full_name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>@{profile?.username}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
              {(['info', 'password'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setInfoMsg(null); setPwdMsg(null) }}
                  style={{
                    padding: '8px 22px', borderRadius: 40, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: tab === t ? '#450043' : '#e5e7eb',
                    color:      tab === t ? '#fff'    : '#374151',
                    transition: 'all 0.2s',
                  }}
                >
                  {t === 'info' ? 'Personal Info' : 'Change Password'}
                </button>
              ))}
            </div>

            {/* ── Personal Info tab ── */}
            {tab === 'info' && (
              <form onSubmit={saveInfo} style={{ background: 'white', borderRadius: 20, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <Field label="Username" hint="Cannot be changed">
                  <input value={profile?.username ?? ''} disabled className={inputCls} />
                </Field>

                <Field label="Full Name">
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required minLength={2}
                    className={inputCls}
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </Field>

                <Field label="NIC Number">
                  <input
                    value={nic}
                    onChange={e => setNic(e.target.value)}
                    placeholder="200112345678"
                    className={inputCls}
                  />
                </Field>

                {infoMsg && (
                  <div style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: infoMsg.ok ? '#dcfce7' : '#fee2e2', color: infoMsg.ok ? '#166534' : '#991b1b' }}>
                    {infoMsg.ok ? '✓ ' : '✕ '}{infoMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={infoSaving}
                    style={{ background: infoSaving ? '#9ca3af' : 'linear-gradient(135deg, #450043, #7c3aed)', color: '#fff', border: 'none', borderRadius: 40, padding: '10px 32px', fontWeight: 700, fontSize: 14, cursor: infoSaving ? 'not-allowed' : 'pointer' }}
                  >
                    {infoSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Change Password tab ── */}
            {tab === 'password' && (
              <form onSubmit={savePassword} style={{ background: 'white', borderRadius: 20, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <Field label="Current Password">
                  <input
                    type="password"
                    value={curPwd}
                    onChange={e => setCurPwd(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className={inputCls}
                  />
                </Field>

                <Field label="New Password" hint="Minimum 8 characters">
                  <input
                    type="password"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="New password"
                    required minLength={8}
                    className={inputCls}
                  />
                </Field>

                <Field label="Confirm New Password">
                  <input
                    type="password"
                    value={conPwd}
                    onChange={e => setConPwd(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className={inputCls}
                    style={{ borderColor: conPwd && newPwd !== conPwd ? '#ef4444' : undefined }}
                  />
                  {conPwd && newPwd !== conPwd && (
                    <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4, paddingLeft: 4 }}>Passwords do not match</p>
                  )}
                </Field>

                {pwdMsg && (
                  <div style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: pwdMsg.ok ? '#dcfce7' : '#fee2e2', color: pwdMsg.ok ? '#166534' : '#991b1b' }}>
                    {pwdMsg.ok ? '✓ ' : '✕ '}{pwdMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={pwdSaving}
                    style={{ background: pwdSaving ? '#9ca3af' : 'linear-gradient(135deg, #450043, #7c3aed)', color: '#fff', border: 'none', borderRadius: 40, padding: '10px 32px', fontWeight: 700, fontSize: 14, cursor: pwdSaving ? 'not-allowed' : 'pointer' }}
                  >
                    {pwdSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
