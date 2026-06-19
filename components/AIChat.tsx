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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtLKR(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2 })
}

// ── Thinking animation — scan lines ───────────────────────────────────────────

function ThinkingLines() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: 'absolute',
          left: '-100%',
          height: 2,
          width: '60%',
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? '#9333ea' : '#6366f1'}, transparent)`,
          opacity: 0.35,
          top: `${15 + i * 18}%`,
          animation: `ai-scan ${1.6 + i * 0.25}s ease-in-out ${i * 0.3}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes ai-scan {
          0%   { left: -60%; opacity: 0; }
          20%  { opacity: 0.35; }
          80%  { opacity: 0.35; }
          100% { left: 110%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Action summary card ────────────────────────────────────────────────────────

function ActionCard({ action, onConfirm, onCancel }: {
  action: Action
  onConfirm: () => void
  onCancel:  () => void
}) {
  const label = action.type === 'PAY_BILL' ? 'Bill Payment' : 'Transfer'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a0028 0%, #2d0045 100%)',
      borderRadius: 16,
      padding: '16px 18px',
      margin: '4px 0',
      color: '#fff',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700, fontSize: 14 }}>
        <span style={{ fontSize: 18 }}>{action.type === 'PAY_BILL' ? '🧾' : '💸'}</span>
        {label} Summary
      </div>

      {/* From / To */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>From</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{action.from.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{action.from.masked}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>→</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>To</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{action.to.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{action.to.masked}</div>
        </div>
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#a3e635', letterSpacing: -0.5 }}>Rs. {fmtLKR(action.amount)}</div>
        {action.note && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>Note: {action.note}</div>
        )}
      </div>

      {/* Face ID notice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(147,51,234,0.25)', borderRadius: 8, padding: '6px 10px', marginBottom: 12, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
        <span>🔒</span> Face ID verification required before sending
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '8px 0', borderRadius: 40, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ flex: 2, padding: '8px 0', borderRadius: 40, border: 'none', background: 'linear-gradient(90deg, #7c3aed, #9333ea)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}
        >
          Confirm & Verify Face →
        </button>
      </div>
    </div>
  )
}

// ── Main AIChat component ──────────────────────────────────────────────────────

export default function AIChat() {
  const [open, setOpen]             = useState(false)
  const [messages, setMessages]     = useState<Message[]>([
    { role: 'assistant', text: 'Hi! I\'m Nova AI 👋\nTry: "Send 500 to Kasun" or "Pay electricity 1500"' }
  ])
  const [input, setInput]           = useState('')
  const [thinking, setThinking]     = useState(false)
  const [panelState, setPanelState] = useState<PanelState>('chat')
  const [pendingAction, setPending] = useState<Action | null>(null)
  const [faceVerifyErr, setFaceErr] = useState('')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, panelState])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  // ── Send message to AI ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setThinking(true)

    try {
      const res  = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
      })
      const data = await res.json()

      if (!data.ok) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.message ?? 'Something went wrong.' }])
        return
      }

      if (data.action) {
        // Structured action — show summary card
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

  // ── Confirm action → go to face step ────────────────────────────────────────
  function handleConfirm(action: Action) {
    setPending(action)
    setFaceErr('')
    setPanelState('face')
  }

  // ── Cancel action ────────────────────────────────────────────────────────────
  function handleCancel() {
    setMessages(prev => [...prev, { role: 'assistant', text: 'Action cancelled. Anything else I can help with?' }])
    setPending(null)
  }

  // ── Face verified → execute action ──────────────────────────────────────────
  const handleFaceDescriptor = useCallback(async (descriptor: number[]) => {
    if (!pendingAction) return

    // Verify face with server
    setFaceErr('')
    const verRes = await fetch('/api/auth/face-verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ descriptor, context: 'transaction' }),
    })
    const verData = await verRes.json()

    if (!verData.ok) {
      setFaceErr(verData.message ?? 'Face not recognised. Try again.')
      return
    }

    // Execute the action
    setPanelState('executing')
    try {
      const res = await fetch('/api/transfer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fromAccount: pendingAction.from.account_number,
          toAccount:   pendingAction.to.account_number,
          amount:      pendingAction.amount,
          description: pendingAction.note || pendingAction.type,
        }),
      })
      const data = await res.json()

      if (data.ok) {
        setMessages(prev => [...prev,
          { role: 'result', ok: true,  text: `✅ Done! Rs. ${fmtLKR(pendingAction.amount)} sent to ${pendingAction.to.name}. Transaction #${data.transaction?.id ?? '—'}` }
        ])
      } else {
        setMessages(prev => [...prev,
          { role: 'result', ok: false, text: `❌ Failed: ${data.message ?? 'Transfer could not be completed.'}` }
        ])
      }
    } catch {
      setMessages(prev => [...prev,
        { role: 'result', ok: false, text: '❌ Network error during transfer.' }
      ])
    } finally {
      setPending(null)
      setPanelState('chat')
    }
  }, [pendingAction])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Nova AI"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9000,
          width: 58, height: 58, borderRadius: '50%',
          background: 'linear-gradient(135deg, #450043, #7c3aed)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(69,0,67,0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          fontSize: 24,
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 100, right: 28, zIndex: 8999,
          width: 360, maxWidth: 'calc(100vw - 40px)',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '80vh',
          animation: 'ai-slidein 0.25s ease',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #450043, #7c3aed)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🤖</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Nova AI</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
                {thinking ? 'Thinking…' : panelState === 'face' ? 'Face ID required' : panelState === 'executing' ? 'Executing…' : 'Online'}
              </div>
            </div>
            {(thinking || panelState === 'executing') && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', animation: `ai-bounce 0.8s ${i*0.15}s ease-in-out infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* ── Chat messages ── */}
          {panelState === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', minHeight: 200 }}>
                {thinking && <ThinkingLines />}

                {messages.map((msg, i) => {
                  if (msg.role === 'user') return (
                    <div key={i} style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg, #450043, #7c3aed)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 14px', maxWidth: '78%', fontSize: 13, zIndex: 1, wordBreak: 'break-word' }}>
                      {msg.text}
                    </div>
                  )
                  if (msg.role === 'assistant') return (
                    <div key={i} style={{ alignSelf: 'flex-start', background: '#f3f4f6', color: '#111', borderRadius: '16px 16px 16px 4px', padding: '9px 14px', maxWidth: '84%', fontSize: 13, zIndex: 1, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                      {msg.text}
                    </div>
                  )
                  if (msg.role === 'action') return (
                    <div key={i} style={{ zIndex: 1 }}>
                      <ActionCard
                        action={msg.action}
                        onConfirm={() => handleConfirm(msg.action)}
                        onCancel={handleCancel}
                      />
                    </div>
                  )
                  if (msg.role === 'result') return (
                    <div key={i} style={{ alignSelf: 'flex-start', background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b', borderRadius: '16px 16px 16px 4px', padding: '9px 14px', maxWidth: '84%', fontSize: 13, zIndex: 1, fontWeight: 500 }}>
                      {msg.text}
                    </div>
                  )
                  return null
                })}

                {thinking && (
                  <div style={{ alignSelf: 'flex-start', background: '#f3f4f6', borderRadius: '16px 16px 16px 4px', padding: '9px 14px', fontSize: 13, color: '#9ca3af', display: 'flex', gap: 4, zIndex: 1 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', animation: `ai-bounce 0.8s ${i*0.15}s ease-in-out infinite` }} />
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, background: '#fff' }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder='Try "Send 500 to Kasun"…'
                  disabled={thinking}
                  style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 40, padding: '9px 16px', fontSize: 13, outline: 'none', background: thinking ? '#f9fafb' : '#fff', color: '#111' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={thinking || !input.trim()}
                  style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: thinking || !input.trim() ? '#e5e7eb' : 'linear-gradient(135deg, #450043, #7c3aed)', color: thinking || !input.trim() ? '#9ca3af' : '#fff', cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}
                >
                  ↑
                </button>
              </div>
            </>
          )}

          {/* ── Face ID step ── */}
          {panelState === 'face' && pendingAction && (
            <div style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              {/* Mini summary reminder */}
              <div style={{ width: '100%', background: '#f3f4f6', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#374151' }}>
                <span style={{ fontWeight: 700 }}>Confirming:</span> Rs. {fmtLKR(pendingAction.amount)} → <span style={{ fontWeight: 700 }}>{pendingAction.to.name}</span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Face ID Required</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Look at the camera to authorise this transaction</div>
              </div>

              <Suspense fallback={
                <div style={{ width: 240, height: 180, borderRadius: 14, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Loading camera…
                </div>
              }>
                <FaceCapture
                  mode="verify"
                  onDescriptor={handleFaceDescriptor}
                  onError={msg => { setFaceErr(msg); setPanelState('chat') }}
                  verifyError={faceVerifyErr}
                  prompt="Hold still — scanning…"
                />
              </Suspense>

              <button
                onClick={() => { setPanelState('chat'); setPending(null); setFaceErr('') }}
                style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Cancel
              </button>
            </div>
          )}

          {/* ── Executing step ── */}
          {panelState === 'executing' && (
            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, border: '4px solid #ede9fe', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
              <div style={{ fontWeight: 600, color: '#450043', fontSize: 14 }}>Processing transaction…</div>
              <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Please don't close this window</div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes ai-slidein {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ai-bounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes ai-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
