'use client'

import { useState, useRef, useEffect, lazy, Suspense, useCallback } from 'react'

const FaceCapture = lazy(() => import('@/components/FaceCapture'))

// ── Types ──────────────────────────────────────────────────────────────────────
type Action = {
  type: 'TRANSFER' | 'PAY_BILL'
  from: { name: string; masked: string; account_number: string }
  to:   { name: string; masked: string; account_number: string }
  amount: number
  note: string
}
type Message =
  | { role: 'user';      text: string }
  | { role: 'assistant'; text: string }
  | { role: 'action';    action: Action }
  | { role: 'result';    ok: boolean; text: string }
type PanelState = 'chat' | 'face' | 'executing'

function fmtLKR(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2 })
}

// ── Thinking scan-lines ────────────────────────────────────────────────────────
function ThinkingLines() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          position: 'absolute', left: '-100%', height: 2, width: '60%', borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? '#9333ea' : '#6366f1'}, transparent)`,
          opacity: 0.35, top: `${15 + i * 18}%`,
          animation: `ai-scan ${1.6 + i * 0.25}s ease-in-out ${i * 0.3}s infinite`,
        }} />
      ))}
      <style>{`@keyframes ai-scan{0%{left:-60%;opacity:0}20%{opacity:.35}80%{opacity:.35}100%{left:110%;opacity:0}}`}</style>
    </div>
  )
}

// ── Action summary card ────────────────────────────────────────────────────────
function ActionCard({ action, onConfirm, onCancel }: { action: Action; onConfirm:()=>void; onCancel:()=>void }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#1a0028 0%,#2d0045 100%)', borderRadius: 14, padding: '14px 16px', margin: '4px 0', color: '#fff', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, fontSize: 14 }}>
        <span style={{ fontSize: 18 }}>{action.type === 'PAY_BILL' ? '🧾' : '💸'}</span>
        {action.type === 'PAY_BILL' ? 'Bill Payment' : 'Transfer'} Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>From</div>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{action.from.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{action.from.masked}</div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>→</div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>To</div>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{action.to.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{action.to.masked}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#a3e635', letterSpacing: -0.5 }}>Rs. {fmtLKR(action.amount)}</div>
        {action.note && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Note: {action.note}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(147,51,234,0.2)', borderRadius: 8, padding: '5px 10px', marginBottom: 10, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
        <span>🔒</span> Face ID required before sending
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '8px 0', borderRadius: 40, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{ flex: 2, padding: '8px 0', borderRadius: 40, border: 'none', background: 'linear-gradient(90deg,#7c3aed,#9333ea)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.4 }}>
          Confirm &amp; Verify Face →
        </button>
      </div>
    </div>
  )
}

// ── Suggestion chips ───────────────────────────────────────────────────────────
const SUGGESTIONS = ['Check balance', 'Last transactions', 'Send money', 'Pay bills']

// ── Core chat logic — shared between embedded and float modes ──────────────────
function AIChatCore({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages]     = useState<Message[]>([
    { role: 'assistant', text: 'Hi! I\'m Nova AI 👋\nTry: "Send 500 to Kasun" or "Pay electricity 1500"' }
  ])
  const [input, setInput]           = useState('')
  const [thinking, setThinking]     = useState(false)
  const [panelState, setPanelState] = useState<PanelState>('chat')
  const [pendingAction, setPending] = useState<Action | null>(null)
  const [faceVerifyErr, setFaceErr] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, panelState])
  useEffect(() => { if (embedded) setTimeout(() => inputRef.current?.focus(), 300) }, [embedded])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setThinking(true)
    try {
      const res  = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })
      const data = await res.json()
      if (!data.ok) { setMessages(prev => [...prev, { role: 'assistant', text: data.message ?? 'Something went wrong.' }]); return }
      if (data.action) {
        setMessages(prev => [...prev, { role: 'action', action: data.action }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: data.reply ?? '…' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Network error. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }, [input, thinking])

  function handleConfirm(action: Action) { setPending(action); setFaceErr(''); setPanelState('face') }
  function handleCancel() { setMessages(prev => [...prev, { role: 'assistant', text: 'Action cancelled. Anything else?' }]); setPending(null) }

  const handleFaceDescriptor = useCallback(async (descriptor: number[]) => {
    if (!pendingAction) return
    setFaceErr('')
    const verRes  = await fetch('/api/auth/face-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descriptor, context: 'transaction' }) })
    const verData = await verRes.json()
    if (!verData.ok) { setFaceErr(verData.message ?? 'Face not recognised.'); return }
    setPanelState('executing')
    try {
      const res  = await fetch('/api/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromAccount: pendingAction.from.account_number, toAccount: pendingAction.to.account_number, amount: pendingAction.amount, description: pendingAction.note || pendingAction.type }) })
      const data = await res.json()
      if (data.ok) {
        setMessages(prev => [...prev, { role: 'result', ok: true, text: `✅ Done! Rs. ${fmtLKR(pendingAction.amount)} sent to ${pendingAction.to.name}. Tx #${data.transaction?.id ?? '—'}` }])
      } else {
        setMessages(prev => [...prev, { role: 'result', ok: false, text: `❌ Failed: ${data.message ?? 'Transfer could not be completed.'}` }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'result', ok: false, text: '❌ Network error during transfer.' }])
    } finally {
      setPending(null); setPanelState('chat')
    }
  }, [pendingAction])

  const chatPanelStyle: React.CSSProperties = embedded
    ? { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }

  return (
    <div style={chatPanelStyle}>
      {/* ── Chat messages ── */}
      {panelState === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', minHeight: 0 }}>
            {thinking && <ThinkingLines />}
            {messages.map((msg, i) => {
              if (msg.role === 'user') return (
                <div key={i} style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg,#5b21b6,#7c3aed)', color: '#fff', borderRadius: '14px 14px 4px 14px', padding: '8px 12px', maxWidth: '82%', fontSize: 13, zIndex: 1, wordBreak: 'break-word' }}>
                  {msg.text}
                </div>
              )
              if (msg.role === 'assistant') return (
                <div key={i} style={{ alignSelf: 'flex-start', background: 'var(--surface-2)', color: 'var(--text-primary)', borderRadius: '14px 14px 14px 4px', padding: '8px 12px', maxWidth: '86%', fontSize: 13, zIndex: 1, whiteSpace: 'pre-line', wordBreak: 'break-word', border: '1px solid var(--border)' }}>
                  {msg.text}
                </div>
              )
              if (msg.role === 'action') return (
                <div key={i} style={{ zIndex: 1 }}>
                  <ActionCard action={msg.action} onConfirm={() => handleConfirm(msg.action)} onCancel={handleCancel} />
                </div>
              )
              if (msg.role === 'result') return (
                <div key={i} style={{ alignSelf: 'flex-start', background: msg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: msg.ok ? '#10b981' : '#f43f5e', border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`, borderRadius: '14px 14px 14px 4px', padding: '8px 12px', maxWidth: '86%', fontSize: 13, zIndex: 1, fontWeight: 500 }}>
                  {msg.text}
                </div>
              )
              return null
            })}
            {thinking && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--surface-2)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', fontSize: 13, display: 'flex', gap: 5, zIndex: 1, border: '1px solid var(--border)' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', animation: `ai-bounce 0.8s ${i*0.15}s ease-in-out infinite` }} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips — only when no conversation yet */}
          {messages.length <= 1 && (
            <div style={{ padding: '8px 12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.1)', color: '#c4b5fd', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background='rgba(124,58,237,0.2)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background='rgba(124,58,237,0.1)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 7, background: 'var(--surface-1)', flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder='Try "Send 500 to Kasun"…'
              disabled={thinking}
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 40, padding: '8px 14px', fontSize: 13, outline: 'none', background: 'var(--surface-2)', color: 'var(--text-primary)', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
              onFocus={e => { e.target.style.borderColor='var(--primary)' }}
              onBlur={e => { e.target.style.borderColor='var(--border)' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={thinking || !input.trim()}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0, alignSelf: 'center', background: (thinking || !input.trim()) ? 'var(--surface-3)' : 'linear-gradient(135deg,#7c3aed,#9333ea)', color: (thinking || !input.trim()) ? 'var(--text-muted)' : '#fff', cursor: (thinking || !input.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
            >
              ↑
            </button>
          </div>
        </>
      )}

      {/* ── Face ID step ── */}
      {panelState === 'face' && pendingAction && (
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, overflowY: 'auto' }}>
          <div style={{ width: '100%', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>
            <span style={{ fontWeight: 700 }}>Confirming:</span> Rs. {fmtLKR(pendingAction.amount)} → <span style={{ fontWeight: 700 }}>{pendingAction.to.name}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>Face ID Required</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Look at the camera to authorise</div>
          </div>
          <Suspense fallback={<div style={{ width: 240, height: 180, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading camera…</div>}>
            <FaceCapture mode="verify" onDescriptor={handleFaceDescriptor} onError={msg => { setFaceErr(msg); setPanelState('chat') }} verifyError={faceVerifyErr} prompt="Hold still — scanning…" />
          </Suspense>
          <button onClick={() => { setPanelState('chat'); setPending(null); setFaceErr('') }} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>← Cancel</button>
        </div>
      )}

      {/* ── Executing step ── */}
      {panelState === 'executing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(124,58,237,0.2)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Processing transaction…</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Please don't close this window</div>
        </div>
      )}
    </div>
  )
}

// ── Embedded panel (used in dashboard right column) ────────────────────────────
export function AIChatEmbedded() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-1)', borderLeft: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg,#3b0764 0%,#5b21b6 50%,#7c3aed 100%)', padding: '1.25rem 1rem 1rem', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 20, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>✨</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>Nova AI</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500 }}>Your banking assistant</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>ONLINE</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Send money, check balance, pay bills — just ask in plain English.
          </p>
        </div>
      </div>

      {/* Chat core */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AIChatCore embedded={true} />
      </div>
    </div>
  )
}

// ── Floating button (used on all other pages) ──────────────────────────────────
export default function AIChat() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Nova AI"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9000,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg,#5b21b6,#7c3aed)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124,58,237,0.5), 0 0 0 0 rgba(124,58,237,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          fontSize: 22,
          animation: open ? 'none' : 'fab-pulse 2s ease-in-out infinite',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? '✕' : '✨'}
      </button>

      {/* Float panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 8999,
          width: 360, maxWidth: 'calc(100vw - 40px)',
          height: 520,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'ai-slidein 0.25s ease',
        }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(160deg,#3b0764 0%,#5b21b6 50%,#7c3aed 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✨</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Nova AI</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Your banking assistant</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>ONLINE</span>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <AIChatCore />
          </div>
        </div>
      )}

      <style>{`
        @keyframes ai-slidein { from{opacity:0;transform:translateY(16px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ai-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes ai-spin    { to{transform:rotate(360deg)} }
        @keyframes fab-pulse  { 0%,100%{box-shadow:0 4px 20px rgba(124,58,237,.5),0 0 0 0 rgba(124,58,237,.35)} 50%{box-shadow:0 4px 20px rgba(124,58,237,.5),0 0 0 10px rgba(124,58,237,0)} }
      `}</style>
    </>
  )
}
