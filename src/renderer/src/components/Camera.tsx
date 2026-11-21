import { useEffect, useRef, useState } from 'react'
import type { ExtraConfig } from '../../../main/Globals'

export default function Camera({ settings, mode, onClose }: {
  settings: ExtraConfig | null; mode?: 'reverse' | 'front'; onClose?: () => void
}) {
  const [manualMode, setManualMode] = useState<'reverse' | 'front'>('reverse')
  const selectedMode = mode ?? manualMode
  const deviceId = selectedMode === 'front' ? settings?.frontCamera : settings?.camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('Opening camera…')

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | undefined
    const video = videoRef.current
    if (!deviceId) { setStatus(`Select a ${selectedMode === 'front' ? 'front' : 'reverse'} camera in Settings.`); return }
    setStatus('Opening camera…')
    void navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 800 }, deviceId: { exact: deviceId } } })
      .then(async media => {
        if (cancelled) { media.getTracks().forEach(track => track.stop()); return }
        stream = media
        if (video) { video.srcObject = media; await video.play(); if (!cancelled) setStatus('') }
      })
      .catch(error => { if (!cancelled) { console.error('Camera failed', selectedMode, error); setStatus('Camera unavailable. Check the device connection and saved selection.') } })
    return () => {
      cancelled = true
      stream?.getTracks().forEach(track => track.stop())
      if (video) video.srcObject = null
    }
  }, [deviceId, selectedMode])

  return <section aria-label={`${selectedMode === 'front' ? 'Front' : 'Reverse'} camera`} style={{ width: '100%', height: '100%', background: '#101719', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', gap: 16 }}>
      <span>{selectedMode === 'front' ? 'Front camera' : 'Reverse camera'}</span>
      <div style={{ display: 'flex', gap: 12 }}>
        {!mode && settings?.frontCamera && <button onClick={() => setManualMode(selectedMode === 'front' ? 'reverse' : 'front')}>Switch camera</button>}
        {onClose && <button onClick={onClose} style={{ minHeight: 44, padding: '8px 18px' }}>Close camera</button>}
      </div>
    </header>
    {status && <p role="status">{status}</p>}
    <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'contain' }} />
  </section>
}
