import { EventEmitter } from 'events'
import type { CanConfig } from './Globals'
import { decodeCanSignal, validMapping, type CanFrame } from '../shared/canSignals'

interface Channel extends EventEmitter {
  setRxFilters(filters: { id: number; mask: number; invert: boolean }[]): void
  start(): void
  stop(): void
}
interface CameraSignals { sendReverse: (active: boolean) => void; sendFrontCamera: (active: boolean) => void }
type ChannelFactory = (name: string) => Channel

export class Canbus {
  private channel: Channel
  private timer: ReturnType<typeof setInterval>
  private states = { reverse: false, frontCamera: false }
  private seen = { reverse: 0, frontCamera: 0 }

  constructor(name: string, private socket: CameraSignals, subscriptions: CanConfig = {}, factory?: ChannelFactory) {
    // socketcan is optional on Windows. Do not resolve it until a Linux CAN session is requested.
    const createChannel: ChannelFactory = factory ?? require('socketcan').createRawChannel
    this.channel = createChannel(name)
    const mappings = { reverse: subscriptions.reverse, frontCamera: subscriptions.frontCamera ?? subscriptions.lights }
    const filters = Object.values(mappings).filter(validMapping).map(mapping => ({
      id: mapping.canId, mask: mapping.canId > 0x7ff ? 0x1fffffff : 0x7ff, invert: false
    }))
    this.channel.setRxFilters(filters)
    this.channel.on('onMessage', (frame: CanFrame) => {
      for (const key of ['reverse', 'frontCamera'] as const) {
        const active = decodeCanSignal(frame, mappings[key])
        if (active !== null) { this.seen[key] = Date.now(); this.update(key, active) }
      }
    })
    this.channel.on('error', error => { console.error('CAN channel error', error); this.reset() })
    try { this.channel.start() }
    catch (error) { this.channel.removeAllListeners(); try { this.channel.stop() } catch {} throw error }
    // Drop stale camera triggers if the bus/adapter stops delivering the mapped signal.
    this.timer = setInterval(() => {
      for (const key of ['reverse', 'frontCamera'] as const) {
        if (this.states[key] && Date.now() - this.seen[key] > 1500) this.update(key, false)
      }
    }, 250)
    this.timer.unref?.()
  }

  private update(key: 'reverse' | 'frontCamera', active: boolean) {
    if (this.states[key] === active) return
    this.states[key] = active
    if (key === 'reverse') this.socket.sendReverse(active)
    else this.socket.sendFrontCamera(active)
    console.info('CAN camera trigger', key, active)
  }
  private reset() { this.update('reverse', false); this.update('frontCamera', false) }
  stop() {
    clearInterval(this.timer)
    this.channel.removeAllListeners()
    try { this.channel.stop() } finally { this.reset() }
  }
}
