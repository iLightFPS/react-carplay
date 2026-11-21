import { createServer } from 'http'
import { ExtraConfig } from "./Globals";
import { Server } from 'socket.io'
import { EventEmitter } from 'events'
import type { Stream } from './Globals'

export enum MessageNames {
  Connection = 'connection',
  GetSettings = 'getSettings',
  SaveSettings = 'saveSettings',
  Stream = 'stream'
}

export class Socket extends EventEmitter {
  private reverse = false
  private frontCamera = false
  config: ExtraConfig
  io: Server
  saveSettings: (settings: ExtraConfig) => void
  constructor(config: ExtraConfig, saveSettings: (settings: ExtraConfig) => void) {
    super()
    this.config = config
    this.saveSettings = saveSettings
    const http = createServer()
    this.io = new Server(http, {
      cors: {
        origin: '*'
      }
    })

    this.io.on(MessageNames.Connection, (socket) => {
      this.sendSettings()
      socket.emit('reverse', this.reverse)
      socket.emit('frontCamera', this.frontCamera)

      socket.on(MessageNames.GetSettings, () => {
        this.sendSettings()
      })

      socket.on(MessageNames.SaveSettings, (settings: ExtraConfig, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
        try { this.saveSettings(settings); acknowledge?.({ ok: true }) } catch (error) {
          console.error('Settings save failed', error)
          const message = error instanceof Error ? error.message : 'Unable to save settings'
          socket.emit('settingsError', message)
          acknowledge?.({ ok: false, error: message })
        }
      })

      socket.on(MessageNames.Stream, (stream: Stream) => {
        this.emit(MessageNames.Stream, stream)
      })
    })

    http.listen(4000, '127.0.0.1')
  }

  sendSettings() {
    this.io.emit('settings', this.config)
  }

  sendReverse(reverse: boolean) {
    this.reverse = reverse
    this.io.emit('reverse', reverse)
  }

  sendFrontCamera(active: boolean) {
    this.frontCamera = active
    this.io.emit('frontCamera', active)
  }
}
