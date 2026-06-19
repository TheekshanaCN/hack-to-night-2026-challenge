'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Lock } from 'lucide-react'

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

  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [nic, setNic]           = useState('')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoMsg, setInfoMsg]   = useState<{ ok: boolean; text: string } | null>(null)

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 780, overflowY: 'auto' }}>
        <div className="nova-page-header" style={{ marginBottom: '1.75rem' }}>
          <h1 className="nova-page-title">My Profile</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Manage your personal information and security settings
          </p>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '2rem 0' }}>Loading…</div>
        ) : (
          <>
            {/* Avatar card */}
            <div className="card-nova" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: '1.75rem', padding: '1.5rem' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: '0 0 20px rgba(124,58,237,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, color: '#fff', fontWeight: 700,
              }}>
                {(profile?.full_name ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{profile?.full_name}</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 40,
                    background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)',
                    fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                  }}>
                    @{profile?.username}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Member since {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                    : '—'}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
              {(['info', 'password'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setInfoMsg(null); setPwdMsg(null) }}
                  className={`nova-btn ${tab === t ? 'nova-btn-primary' : 'nova-btn-ghost'}`}
                  style={{ padding: '8px 20px', fontSize: 13 }}
                >
                  {t === 'info' ? 'Personal Info' : 'Change Password'}
                </button>
              ))}
            </div>

            {/* ── Personal Info tab ── */}
            {tab === 'info' && (
              <form onSubmit={saveInfo} className="card-nova" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="nova-field">
                  <label className="nova-label">Username <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(cannot be changed)</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={profile?.username ?? ''}
                      disabled
                      className="nova-input"
                      style={{ paddingRight: 40, opacity: 0.5, cursor: 'not-allowed' }}
                    />
                    <Lock size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div className="nova-field">
                  <label className="nova-label" htmlFor="prof-fullname">Full Name</label>
                  <input
                    id="prof-fullname"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required minLength={2}
                    className="nova-input"
                  />
                </div>

                <div className="nova-field">
                  <label className="nova-label" htmlFor="prof-email">Email</label>
                  <input
                    id="prof-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="nova-input"
                  />
                </div>

                <div className="nova-field">
                  <label className="nova-label" htmlFor="prof-nic">NIC Number</label>
                  <input
                    id="prof-nic"
                    value={nic}
                    onChange={e => setNic(e.target.value)}
                    placeholder="200112345678"
                    className="nova-input"
                  />
                </div>

                {infoMsg && (
                  <div className={`nova-alert ${infoMsg.ok ? 'nova-alert-success' : 'nova-alert-error'}`}>
                    {infoMsg.ok ? '✓ ' : '✕ '}{infoMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={infoSaving}
                    className="nova-btn nova-btn-primary"
                    style={{ padding: '10px 28px', fontSize: 13, fontWeight: 700 }}
                  >
                    {infoSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Change Password tab ── */}
            {tab === 'password' && (
              <form onSubmit={savePassword} className="card-nova" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="nova-field">
                  <label className="nova-label" htmlFor="cur-pwd">Current Password</label>
                  <input
                    id="cur-pwd"
                    type="password"
                    value={curPwd}
                    onChange={e => setCurPwd(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="nova-input"
                  />
                </div>

                <div className="nova-field">
                  <label className="nova-label" htmlFor="new-pwd">New Password <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(min 8 chars)</span></label>
                  <input
                    id="new-pwd"
                    type="password"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="New password"
                    required minLength={8}
                    className="nova-input"
                  />
                </div>

                <div className="nova-field">
                  <label className="nova-label" htmlFor="con-pwd">Confirm New Password</label>
                  <input
                    id="con-pwd"
                    type="password"
                    value={conPwd}
                    onChange={e => setConPwd(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="nova-input"
                    style={{ borderColor: conPwd && newPwd !== conPwd ? 'var(--error)' : undefined }}
                  />
                  {conPwd && newPwd !== conPwd && (
                    <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4, paddingLeft: 4 }}>Passwords do not match</p>
                  )}
                </div>

                {pwdMsg && (
                  <div className={`nova-alert ${pwdMsg.ok ? 'nova-alert-success' : 'nova-alert-error'}`}>
                    {pwdMsg.ok ? '✓ ' : '✕ '}{pwdMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={pwdSaving}
                    className="nova-btn nova-btn-primary"
                    style={{ padding: '10px 28px', fontSize: 13, fontWeight: 700 }}
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
