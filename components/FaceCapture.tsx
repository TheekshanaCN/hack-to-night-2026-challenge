'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

export type FaceCaptureProps = {
  onDescriptor: (descriptor: number[]) => void
  onError: (msg: string) => void
  /** 'register' shows a "Capture" button. 'verify' auto-scans every 800ms. */
  mode?: 'register' | 'verify'
  prompt?: string
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model'

export default function FaceCapture({
  onDescriptor,
  onError,
  mode = 'register',
  prompt
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'done' | 'error'>('loading')
  const [statusMsg, setStatusMsg] = useState('Loading Face AI models…')
  const streamRef = useRef<MediaStream | null>(null)
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load face-api models and start camera
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const faceapi = (await import('@vladmandic/face-api')).default

        setStatusMsg('Loading recognition models…')
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        if (cancelled) return

        setStatusMsg('Starting camera…')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setStatus('ready')
        setStatusMsg(prompt ?? (mode === 'verify' ? 'Look at the camera…' : 'Position your face and click Capture'))

        // Auto-scan mode: try every 800ms
        if (mode === 'verify') {
          scanInterval.current = setInterval(() => scanFace(faceapi), 800)
        }
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera error'
        setStatus('error')
        setStatusMsg(msg)
        onError(msg)
      }
    }

    async function scanFace(faceapi: Awaited<typeof import('@vladmandic/face-api')>['default']) {
      if (!videoRef.current || status === 'done') return
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!detection) return
      clearScan()
      setStatus('done')
      setStatusMsg('Face captured ✓')
      onDescriptor(Array.from(detection.descriptor))
    }

    init()
    return () => {
      cancelled = true
      clearScan()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function clearScan() {
    if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null }
  }

  const captureNow = useCallback(async () => {
    if (!videoRef.current) return
    setStatus('scanning')
    setStatusMsg('Scanning…')
    const faceapi = (await import('@vladmandic/face-api')).default
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      setStatus('ready')
      setStatusMsg('No face detected. Look directly at the camera.')
      return
    }
    setStatus('done')
    setStatusMsg('Face captured ✓')
    onDescriptor(Array.from(detection.descriptor))
  }, [onDescriptor])

  const statusColor =
    status === 'error' ? '#ef4444'
    : status === 'done' ? '#22c55e'
    : '#450043'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        position: 'relative',
        width: 280,
        height: 210,
        borderRadius: 16,
        overflow: 'hidden',
        border: `3px solid ${statusColor}`,
        background: '#111',
        transition: 'border-color 0.3s'
      }}>
        <video
          ref={videoRef}
          width={280}
          height={210}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        {/* Face outline guide */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            width: 140,
            height: 180,
            borderRadius: '50%',
            border: `2px dashed ${status === 'done' ? '#22c55e' : 'rgba(255,255,255,0.5)'}`,
            transition: 'border-color 0.3s'
          }} />
        </div>

        {/* Scanning animation */}
        {status === 'scanning' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(69,0,67,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 48,
              height: 48,
              border: '4px solid #450043',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          </div>
        )}

        {/* Done checkmark */}
        {status === 'done' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(34,197,94,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: 48 }}>✓</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: 13, color: statusColor, fontWeight: 500, textAlign: 'center', maxWidth: 280 }}>
        {statusMsg}
      </p>

      {mode === 'register' && status === 'ready' && (
        <button
          onClick={captureNow}
          style={{
            background: '#450043',
            color: 'white',
            border: 'none',
            borderRadius: 40,
            padding: '10px 32px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            letterSpacing: 1
          }}
        >
          CAPTURE FACE
        </button>
      )}

      {mode === 'register' && status === 'scanning' && (
        <button disabled style={{ background: '#9ca3af', color: 'white', border: 'none', borderRadius: 40, padding: '10px 32px', fontWeight: 700, fontSize: 14 }}>
          SCANNING…
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
