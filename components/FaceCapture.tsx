'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

export type FaceCaptureProps = {
  onDescriptor: (descriptor: number[]) => void
  onError: (msg: string) => void
  mode?: 'register' | 'verify'
  prompt?: string
  /** Set to a non-empty string when the server rejects the face — shows red
   *  overlay inside the camera, then auto-resumes scanning after 2.5 s. */
  verifyError?: string
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapiCache: any = null

async function getFaceApi() {
  if (faceapiCache) return faceapiCache
  const mod = await import('@vladmandic/face-api')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fa = (mod as any).default ?? mod
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  faceapiCache = fa
  return fa
}

type InternalStatus = 'loading' | 'ready' | 'scanning' | 'done' | 'rejected' | 'error'

export default function FaceCapture({
  onDescriptor,
  onError,
  mode = 'register',
  prompt,
  verifyError,
}: FaceCaptureProps) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faRef     = useRef<any>(null)

  const [status, setStatus]       = useState<InternalStatus>('loading')
  const [statusMsg, setStatusMsg] = useState('Loading Face AI models…')
  const [shake, setShake]         = useState(false)

  // ── Init: load models + start camera ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        setStatusMsg('Loading Face AI models…')
        const fa = await getFaceApi()
        if (cancelled) return
        faRef.current = fa

        setStatusMsg('Starting camera…')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setStatus('ready')
        setStatusMsg(prompt ?? (mode === 'verify' ? 'Look at the camera…' : 'Position your face and click Capture'))

        if (mode === 'verify') startAutoScan()
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setStatus('error')
        setStatusMsg(msg)
        onError(msg)
      }
    }

    init()

    return () => {
      cancelled = true
      stopScan()
      if (retryRef.current) clearTimeout(retryRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── React to parent signalling a failed verification ───────────────────────
  useEffect(() => {
    if (!verifyError) return
    // Stop any ongoing scan first
    stopScan()
    setStatus('rejected')
    setStatusMsg(verifyError)
    // Shake animation
    setShake(true)
    setTimeout(() => setShake(false), 600)
    // Auto-resume scanning after 2.5 s
    retryRef.current = setTimeout(() => {
      setStatus('ready')
      setStatusMsg(prompt ?? 'Look at the camera…')
      if (mode === 'verify') startAutoScan()
    }, 2500)

    return () => { if (retryRef.current) clearTimeout(retryRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyError])

  function stopScan() {
    if (scanRef.current) { clearInterval(scanRef.current); scanRef.current = null }
  }

  function startAutoScan() {
    stopScan()
    scanRef.current = setInterval(autoScan, 800)
  }

  async function autoScan() {
    const fa = faRef.current
    if (!fa || !videoRef.current) return
    const detection = await fa
      .detectSingleFace(videoRef.current, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection) return
    stopScan()
    setStatus('done')
    setStatusMsg('Face captured ✓')
    onDescriptor(Array.from(detection.descriptor as Float32Array))
  }

  const captureNow = useCallback(async () => {
    if (!videoRef.current || !faRef.current) return
    const fa = faRef.current
    setStatus('scanning')
    setStatusMsg('Scanning…')
    const detection = await fa
      .detectSingleFace(videoRef.current, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection) {
      setStatus('ready')
      setStatusMsg('No face detected — look directly at the camera and try again.')
      return
    }
    setStatus('done')
    setStatusMsg('Face captured ✓')
    onDescriptor(Array.from(detection.descriptor as Float32Array))
  }, [onDescriptor])

  // ── Derived colours ────────────────────────────────────────────────────────
  const isRejected = status === 'rejected'
  const isError    = status === 'error'
  const isDone     = status === 'done'

  const borderColor = isRejected || isError ? '#ef4444' : isDone ? '#22c55e' : '#450043'
  const msgColor    = isRejected || isError ? '#ef4444' : isDone ? '#22c55e' : '#450043'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Camera viewport */}
      <div style={{
        position: 'relative', width: 280, height: 210,
        borderRadius: 16, overflow: 'hidden',
        border: `3px solid ${borderColor}`,
        background: '#111',
        transition: 'border-color 0.3s',
        animation: shake ? 'fa-shake 0.55s ease' : 'none',
      }}>
        <video
          ref={videoRef}
          width={280} height={210}
          muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />

        {/* Oval guide */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{
            width: 140, height: 180, borderRadius: '50%',
            border: `2px dashed ${isRejected ? '#ef4444' : isDone ? '#22c55e' : 'rgba(255,255,255,0.55)'}`,
            transition: 'border-color 0.3s',
          }} />
        </div>

        {/* Loading overlay */}
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'fa-spin 0.8s linear infinite' }} />
            <span style={{ color: '#fff', fontSize: 11 }}>Loading AI…</span>
          </div>
        )}

        {/* Scanning spinner */}
        {status === 'scanning' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(69,0,67,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #fff', borderTopColor: '#450043', borderRadius: '50%', animation: 'fa-spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Success overlay */}
        {isDone && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 52, lineHeight: 1, color: '#16a34a' }}>✓</span>
            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>Face Matched</span>
          </div>
        )}

        {/* ── Rejection overlay ── */}
        {isRejected && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(239,68,68,0.82)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 48, lineHeight: 1 }}>✕</span>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, textAlign: 'center', padding: '0 16px' }}>
              Wrong Face
            </span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, textAlign: 'center' }}>
              Retrying in a moment…
            </span>
          </div>
        )}
      </div>

      {/* Status message below camera */}
      <p style={{ fontSize: 13, color: msgColor, fontWeight: 600, textAlign: 'center', maxWidth: 280, minHeight: 18, transition: 'color 0.3s' }}>
        {statusMsg}
      </p>

      {/* Capture button — register mode only */}
      {mode === 'register' && status === 'ready' && (
        <button
          onClick={captureNow}
          style={{ background: '#450043', color: 'white', border: 'none', borderRadius: 40, padding: '10px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 1 }}
        >
          CAPTURE FACE
        </button>
      )}
      {mode === 'register' && status === 'scanning' && (
        <button disabled style={{ background: '#9ca3af', color: 'white', border: 'none', borderRadius: 40, padding: '10px 32px', fontWeight: 700, fontSize: 14 }}>
          SCANNING…
        </button>
      )}

      <style>{`
        @keyframes fa-spin  { to { transform: rotate(360deg); } }
        @keyframes fa-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-8px); }
          30%     { transform: translateX(8px); }
          45%     { transform: translateX(-6px); }
          60%     { transform: translateX(6px); }
          75%     { transform: translateX(-3px); }
          90%     { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}
