import { captureConsole } from '../../shared/debugLog'
import type { DebugEntry } from '../../shared/debugLog'
import { recordEntry, logDebug, useDebugStore } from './store/debugStore'

const restore = captureConsole('app', recordEntry, () => useDebugStore.getState().recording)
const onError = (event: ErrorEvent) => logDebug('error', 'app', event.error ?? event.message)
const onRejection = (event: PromiseRejectionEvent) => logDebug('error', 'app', 'Unhandled promise rejection', event.reason)
window.addEventListener('error', onError)
window.addEventListener('unhandledrejection', onRejection)

// Use the existing, context-isolated Electron bridge; no Node access in the page.
const ipc = window.electron?.ipcRenderer
const unsubscribe = ipc?.on('debug:entry', (_event, entry: DebugEntry) => recordEntry(entry))
const syncRecording = (recording: boolean) => {
  ipc?.send('debug:recording', recording)
  if (!recording) return
  logDebug('info', 'app', 'Debug recording started')
  void ipc?.invoke('debug:history').then((entries: DebugEntry[]) => entries.forEach(recordEntry))
    .catch(() => logDebug('warn', 'main', 'Main-process history unavailable. Restart the app to enable it.'))
}
syncRecording(useDebugStore.getState().recording)
const unsubscribeRecording = useDebugStore.subscribe((state, previous) => {
  if (state.recording !== previous.recording) syncRecording(state.recording)
})

if (import.meta.hot) import.meta.hot.dispose(() => {
  restore()
  unsubscribe?.()
  unsubscribeRecording()
  window.removeEventListener('error', onError)
  window.removeEventListener('unhandledrejection', onRejection)
})
