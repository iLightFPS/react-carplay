import { captureConsole } from '../../../../shared/debugLog'
import CarplayWeb, {
  CarplayMessage,
  DongleConfig,
  SendAudio,
  SendCommand,
  SendTouch,
  findDevice,
} from 'node-carplay/web'
import { AudioPlayerKey, Command, KeyCommand } from "./types";
import { RenderEvent } from './render/RenderEvents'
import { RingBuffer } from 'ringbuf.js'
import { createAudioPlayerKey } from './utils'

let debugRecording = false
captureConsole('carplay', entry => postMessage({ type: 'debugLog', entry }), () => debugRecording)

let carplayWeb: CarplayWeb | null = null
let videoPort: MessagePort | null = null
let microphonePort: MessagePort | null = null
let config: Partial<DongleConfig> | null = null
let videoStarted = false
const audioBuffers: Record<AudioPlayerKey, RingBuffer<Int16Array>> = {}
const pendingAudio: Record<AudioPlayerKey, Int16Array[]> = {}

const handleMessage = (message: CarplayMessage) => {
  const { type, message: payload } = message
  if (type === 'video' && videoPort) {
    if (!videoStarted) {
      videoStarted = true
      postMessage({ type: 'videoStarted' })
    }
    videoPort.postMessage(new RenderEvent(payload.data), [payload.data.buffer])
  } else if (type === 'audio' && payload.data) {
    const { decodeType, audioType } = payload
    const audioKey = createAudioPlayerKey(decodeType, audioType)
    if (audioBuffers[audioKey]) {
      audioBuffers[audioKey].push(payload.data)
    } else {
      if (!pendingAudio[audioKey]) {
        pendingAudio[audioKey] = []
      }
      pendingAudio[audioKey].push(payload.data)
      payload.data = undefined

      const getPlayerMessage = {
        type: 'getAudioPlayer',
        message: {
          ...payload,
        },
      }
      postMessage(getPlayerMessage)
    }
  } else {
    if (type === 'unplugged') videoStarted = false
    postMessage(message)
  }
}

// Serialize session changes so stop/start cannot claim the USB interface concurrently.
let commands = Promise.resolve()
onmessage = (event: MessageEvent<Command>) => {
  if (event.data.type === 'debugRecording') {
    debugRecording = event.data.enabled
    return
  }
  commands = commands.then(() => handleCommand(event)).catch(error => {
    console.error('CarPlay worker command failed', error)
    postMessage({ type: 'failure' })
  })
}

function setMicrophonePort(port: MessagePort) {
  microphonePort?.close?.()
  microphonePort = port
  microphonePort.onmessage = event => {
    if (carplayWeb) void carplayWeb.dongleDriver.send(new SendAudio(event.data))
  }
}

const handleCommand = async (event: MessageEvent<Command>) => {
  switch (event.data.type) {
    case 'initialise':
      if (carplayWeb) return
      videoPort = event.data.payload.videoPort
      if (event.data.payload.microphonePort) setMicrophonePort(event.data.payload.microphonePort)
      break
    case 'microphonePort':
      setMicrophonePort(event.data.payload)
      break
    case 'audioPlayer':
      const { sab, decodeType, audioType } = event.data.payload
      const audioKey = createAudioPlayerKey(decodeType, audioType)
      audioBuffers[audioKey] = new RingBuffer(sab, Int16Array)
      if (pendingAudio[audioKey]) {
        pendingAudio[audioKey].forEach(buf => {
          audioBuffers[audioKey].push(buf)
        })
        pendingAudio[audioKey] = []
      }
      break
    case 'reconnect':
    case 'start':
      if (carplayWeb && event.data.type === 'start') return
      videoStarted = false
      if (carplayWeb) {
        const previousSession = carplayWeb
        previousSession.onmessage = null
        carplayWeb = null
        await previousSession.stop()
      }
      Object.keys(pendingAudio).forEach(key => { delete pendingAudio[key as AudioPlayerKey] })
      config = event.data.payload.config
      const device = await findDevice()
      if (device) {
        carplayWeb = new CarplayWeb(config)
        carplayWeb.onmessage = handleMessage
        try {
          await carplayWeb.start(device)
        } catch (error) {
          carplayWeb.onmessage = null
          await carplayWeb.stop()
          carplayWeb = null
          throw error
        }
      } else {
        postMessage({ type: 'failure' })
      }
      break
    case 'touch':
      if (config && carplayWeb) {
        const { x, y, action } = event.data.payload
        const data = new SendTouch(x, y, action)
        carplayWeb.dongleDriver.send(data)
      } else {
      }
      break
    case 'stop':
      videoStarted = false
      const stopped = carplayWeb
      carplayWeb = null
      if (stopped) { stopped.onmessage = null; await stopped.stop() }
      break
    case 'frame':
      if (carplayWeb) {
        const data = new SendCommand('frame')
        carplayWeb.dongleDriver.send(data)
      }
      break
    case 'keyCommand':
      const command: KeyCommand = event.data.command
      const data = new SendCommand(command)
      if (carplayWeb) {
        carplayWeb.dongleDriver.send(data)
      }
  }
}

export {}
