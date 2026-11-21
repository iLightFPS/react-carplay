import { useEffect, useState } from 'react'
import './ConnectionScreen.css'

interface WaitingScreenProps {
  adapterFound: boolean
  connecting: boolean
  disconnected: boolean
  error: boolean
  onConnect: () => void
}

export default function WaitingScreen({ adapterFound, connecting, disconnected, error, onConnect }: WaitingScreenProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const status = connecting ? 'Connecting to your phone' : !adapterFound ? 'Waiting for your adapter' : disconnected ? 'Phone disconnected' : 'Ready for CarPlay'

  return (
    <section className="connectionScreen" aria-label="CarPlay connection">
      <div className="connectionHeader">
        <span className="connectionBrand">CARPLAY</span>
        {connecting && <span className="connectionBadge isConnecting">
          <span className="connectionDot" />CONNECTING
        </span>}
      </div>
      <div className="connectionClock">
        <time className="connectionTime" dateTime={now.toISOString()}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </time>
        <div className="connectionDate">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>
      <div className="connectionFooter">
        <div className="connectionCopy" role="status" aria-live="polite">
          <div className="connectionEyebrow">{status}</div>
          <p>{error ? 'Connection did not finish. Tap below to retry.' : !adapterFound ? 'Connect the Carlinkit adapter to get started.' : 'Keep Wi-Fi and Bluetooth enabled on your phone.'}</p>
        </div>
        <button className="connectionButton" onClick={onConnect} disabled={connecting}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.7-1L20 9M4 15l2.2 3A7 7 0 0 0 18 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {connecting ? 'Connecting…' : adapterFound || disconnected ? 'Reconnect phone' : 'Connect CarPlay'}
        </button>
      </div>
    </section>
  )
}
