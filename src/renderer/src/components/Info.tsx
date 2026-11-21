import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebugStore } from '../store/debugStore'
import type { DebugEntry, DebugLevel } from '../../../shared/debugLog'
import './DebugConsole.css'

export default function Info() {
  const { entries, clear, recording, setRecording } = useDebugStore()
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<DebugLevel | ''>('')
  const [source, setSource] = useState('')
  const [frozen, setFrozen] = useState<DebugEntry[] | null>(null)
  const [follow, setFollow] = useState(true)
  const viewport = useRef<HTMLDivElement>(null)
  const displayed = frozen ?? entries
  const sources = Array.from(new Set(['app', 'main', 'carplay', 'connection', 'media', 'navigation', 'video', ...entries.map(entry => entry.source), ...displayed.map(entry => entry.source)])).sort()
  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return displayed.filter(entry => (!level || entry.level === level) && (!source || entry.source === source)
      && (!query || `${entry.timestamp} ${entry.source} ${entry.message}`.toLowerCase().includes(query)))
  }, [displayed, search, level, source])
  useEffect(() => {
    if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
  }, [filtered, follow])

  const exportLogs = () => {
    const blob = new Blob([filtered.map(entry => JSON.stringify(entry)).join('\n') + '\n'], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `carplay-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return <section className="debugPage" aria-label="Debug console">
    <header className="debugHeader"><div><span className="debugEyebrow">CARPLAY / DIAGNOSTICS</span><h1>Debug console</h1></div>
      <div className="debugHeaderActions"><span className={`debugCapture${!recording ? ' isStopped' : frozen ? ' isPaused' : ''}`} role="status">{!recording ? 'RECORDING OFF' : frozen ? 'VIEW PAUSED · CAPTURING' : 'LIVE CAPTURE'}</span>
        <button className="debugRecordButton" onClick={() => setRecording(!recording)}>{recording ? 'Stop recording' : 'Start recording'}</button>
        <button onClick={exportLogs} disabled={!filtered.length}>Export JSONL <span aria-hidden="true">↗</span></button></div>
    </header>
    <div className="debugToolbar">
      <label className="debugSearch"><span aria-hidden="true">⌕</span><input aria-label="Search logs" placeholder="Search messages, packets, errors…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="debugFilter"><span>Level</span><select aria-label="Log level" value={level} onChange={event => setLevel(event.target.value as DebugLevel | '')}><option value="">All levels</option><option value="debug">Debug</option><option value="info">Info</option><option value="warn">Warning</option><option value="error">Error</option></select></label>
      <label className="debugFilter"><span>Source</span><select aria-label="Log source" value={source} onChange={event => setSource(event.target.value)}><option value="">All sources</option>{sources.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="debugTools"><button onClick={() => setFrozen(frozen ? null : entries.slice())}>{frozen ? 'Resume view' : 'Pause view'}</button><button onClick={() => { clear(); setFrozen(null) }}>Clear</button></div>
    </div>
    <div className="debugTableHeader" aria-hidden="true"><span>TIME</span><span>LEVEL</span><span>SOURCE</span><span>MESSAGE</span></div>
    <div className="debugEntries" ref={viewport} role="region" aria-label="Log entries" tabIndex={0} onScroll={() => {
      const element = viewport.current
      if (element && element.scrollHeight - element.scrollTop - element.clientHeight > 40) setFollow(false)
    }}>
      {!filtered.length ? <div className="debugEmpty"><span aria-hidden="true">&gt;_</span><h2>{entries.length ? 'No matching entries' : recording ? 'Ready to capture' : 'Recording is off'}</h2><p>{entries.length ? 'Try another source, level, or search.' : recording ? 'Connection events, app messages, and errors will appear here.' : 'Start recording before reproducing a problem. Nothing is captured until you do.'}</p></div>
        : filtered.map(entry => <div className={`debugRow debug-${entry.level}`} key={entry.id}>
          <time dateTime={entry.timestamp} title={entry.timestamp}>{new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}.{entry.timestamp.slice(20, 23)}</time>
          <span className="debugLevel">{entry.level === 'warn' ? 'WARN' : entry.level.toUpperCase()}</span>
          <span className="debugSource">{entry.source}</span><pre>{entry.message}</pre>
        </div>)}
    </div>
    <footer className="debugFooter"><span>{filtered.length.toLocaleString()} shown <span className="debugSeparator">/</span> {entries.length.toLocaleString()} captured <span className="debugSeparator">·</span> Latest 1,500 entries kept in memory</span>
      <label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} /> Follow latest</label>
    </footer>
  </section>
}
