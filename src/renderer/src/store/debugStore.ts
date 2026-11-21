import { create } from 'zustand'
import { appendEntries, makeEntry, type DebugEntry, type DebugLevel } from '../../../shared/debugLog'

const pending: DebugEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined
export const useDebugStore = create<{ entries: DebugEntry[]; recording: boolean; setRecording: (recording: boolean) => void; clear: () => void }>(set => ({
  entries: [],
  recording: false,
  setRecording: recording => {
    if (!recording && flushTimer !== undefined) {
      clearTimeout(flushTimer)
      flushTimer = undefined
    }
    set(state => ({ recording, entries: recording ? state.entries : appendEntries(state.entries, pending.splice(0)) }))
  },
  clear: () => { pending.length = 0; set({ entries: [] }) }
}))

export function recordEntry(entry: DebugEntry) {
  if (!useDebugStore.getState().recording) return
  // Apply the bound before batching, too, so a noisy source cannot grow the queue.
  pending.push(entry)
  if (pending.length > 1500) pending.shift()
  if (flushTimer !== undefined) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    const batch = pending.splice(0)
    useDebugStore.setState(state => ({ entries: appendEntries(state.entries, batch) }))
  }, 150)
}

// Navigation decoders can use this same path once navigation packets are implemented.
export function logDebug(level: DebugLevel, source: string, ...data: unknown[]) {
  if (!useDebugStore.getState().recording) return
  recordEntry(makeEntry(level, source, data))
}
