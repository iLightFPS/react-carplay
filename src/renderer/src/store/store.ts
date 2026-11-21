import { create } from 'zustand'
import { ExtraConfig } from "../../../main/Globals";
import { io } from 'socket.io-client'
import type { Stream } from '../../../main/Globals'

interface CarplayStore {
  settings: null | ExtraConfig,
  saving: boolean,
  saveError: string | null,
  saveSettings: (settings: ExtraConfig) => void
  getSettings: () => void
  stream: (stream: Stream) => void
}

interface StatusStore {
  reverse: boolean,
  frontCamera: boolean,
  isPlugged: boolean,
  setPlugged: (plugged: boolean) => void,
  setReverse: (reverse: boolean) => void
}

export const useCarplayStore = create<CarplayStore>()((set) =>({
  settings: null,
  saving: false,
  saveError: null,
  saveSettings: (settings) => {
    set({ saving: true, saveError: null })
    socket.timeout(5000).emit('saveSettings', settings, (error: Error | null, result?: { ok: boolean; error?: string }) => {
      set({ saving: false, saveError: error ? 'Saving timed out. Check the app connection and try again.' : result?.ok ? null : result?.error ?? 'Unable to save settings' })
    })
  },
  getSettings: () => {
    socket.emit('getSettings')
  },
  stream: (stream) => {
    socket.emit('stream', stream)
  }
}))

export const useStatusStore = create<StatusStore>()((set) => ({
  reverse: false,
  frontCamera: false,
  isPlugged: false,
  setPlugged: (plugged) => {
    set(() => ({isPlugged: plugged}))
  },
  setReverse: (reverse) => {
    set(() => ({reverse: reverse}))
  }
}))

const URL = 'http://localhost:4000'
const socket = io(URL)

socket.on('settings', (settings: ExtraConfig) => {
  console.log("received settings", settings)
  useCarplayStore.setState(() => ({settings: settings}))
})

socket.on('frontCamera', (frontCamera: boolean) => {
  useStatusStore.setState({ frontCamera })
})
socket.on('disconnect', () => useStatusStore.setState({ reverse: false, frontCamera: false }))

socket.on('reverse', (reverse) => {
  console.log("reverse data", reverse)
  useStatusStore.setState(() => ({reverse: reverse}))
})





socket.on('settingsError', (saveError: string) => useCarplayStore.setState({ saving: false, saveError }))
