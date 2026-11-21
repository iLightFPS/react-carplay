export type DebugLevel = 'debug' | 'info' | 'warn' | 'error'
export interface DebugEntry {
  id: string
  timestamp: string
  level: DebugLevel
  source: string
  message: string
}

const session = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
let sequence = 0
const MAX_TEXT = 4000

// Keep packets useful for diagnosis without retaining entire audio/video buffers.
export function describe(value: unknown): string {
  const seen = new WeakSet<object>()
  const normalise = (item: unknown, depth: number): unknown => {
    if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack?.slice(0, MAX_TEXT) }
    if (item === null || typeof item !== 'object') return typeof item === 'bigint' ? String(item) : typeof item === 'string' ? item.slice(0, MAX_TEXT) : item
    if (ArrayBuffer.isView(item)) {
      const bytes = new Uint8Array(item.buffer, item.byteOffset, Math.min(item.byteLength, 24))
      return { type: item.constructor.name, bytes: item.byteLength, preview: Array.from(bytes) }
    }
    if (item instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && item instanceof SharedArrayBuffer)) return { type: item.constructor.name, bytes: item.byteLength }
    if (seen.has(item)) return '[Circular]'
    if (depth > 4) return '[Nested object]'
    seen.add(item)
    if (Array.isArray(item)) return item.slice(0, 30).map(child => normalise(child, depth + 1))
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(item).slice(0, 30)) {
      try { result[key] = normalise((item as Record<string, unknown>)[key], depth + 1) }
      catch { result[key] = '[Unreadable]' }
    }
    return result
  }
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(normalise(value, 0)) ?? String(value)
    return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + '… [truncated]' : text
  } catch { return '[Unable to format value]' }
}

export function makeEntry(level: DebugLevel, source: string, args: unknown[]): DebugEntry {
  return { id: `${source}-${session}-${++sequence}`, timestamp: new Date().toISOString(), level, source,
    message: args.slice(0, 20).map(describe).join(' ').slice(0, MAX_TEXT) }
}

export function captureConsole(source: string, sink: (entry: DebugEntry) => void, enabled: () => boolean = () => true): () => void {
  type Method = 'log' | 'info' | 'debug' | 'warn' | 'error'
  const originals = new Map<Method, (...args: unknown[]) => void>()
  const wrappers = new Map<Method, (...args: unknown[]) => void>()
  let publishing = false
  for (const method of ['log', 'info', 'debug', 'warn', 'error'] as const) {
    const original = console[method]
    originals.set(method, original)
    const wrapper = (...args: unknown[]) => {
      original.apply(console, args)
      if (publishing || !enabled()) return
      publishing = true
      try { sink(makeEntry(method === 'log' ? 'info' : method, source, args)) } catch { /* Logging must never interrupt the app. */ }
      finally { publishing = false }
    }
    wrappers.set(method, wrapper)
    console[method] = wrapper
  }
  return () => {
    originals.forEach((original, method) => {
      if (console[method] === wrappers.get(method)) console[method] = original
    })
  }
}

export function appendEntries(current: DebugEntry[], incoming: DebugEntry[], limit = 1500): DebugEntry[] {
  const ids = new Set(current.map(entry => entry.id))
  const unique = incoming.filter(entry => { if (ids.has(entry.id)) return false; ids.add(entry.id); return true })
  return [...current, ...unique].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-limit)
}
