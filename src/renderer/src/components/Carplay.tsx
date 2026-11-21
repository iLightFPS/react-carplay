import { adapterConfig } from '../../../shared/settings'
import { logDebug, recordEntry, useDebugStore } from '../store/debugStore'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import WaitingScreen from './WaitingScreen'
//import './App.css'
import {
  findDevice,
  requestDevice,
  CommandMapping,
} from 'node-carplay/web'
import { CarPlayWorker } from './worker/types'
import useCarplayAudio from './useCarplayAudio'
import { useCarplayTouch } from './useCarplayTouch'
import { useLocation, useNavigate } from "react-router-dom";
import { ExtraConfig} from "../../../main/Globals";
import { useCarplayStore, useStatusStore } from "../store/store";
import { InitEvent } from './worker/render/RenderEvents'





const videoChannel = new MessageChannel()

const RETRY_DELAY_MS = 15000



interface CarplayProps {
  receivingVideo: boolean
  setReceivingVideo: (receivingVideo: boolean) => void
  settings: ExtraConfig,
  command: string,
  commandCounter: number
}

function Carplay({ receivingVideo, setReceivingVideo, settings, command, commandCounter }: CarplayProps) {
  const setPlugged = useStatusStore(state => state.setPlugged)
  const [deviceFound, setDeviceFound] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  const sessionStarted = useRef(false)
  const checkingDevice = useRef(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null,
  )
  const mainElem = useRef<HTMLDivElement>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stream = useCarplayStore(state => state.stream)
  const config = useMemo(() => adapterConfig(settings), [settings])
  const previousConfig = useRef(config)
  useEffect(() => {
    if (JSON.stringify(previousConfig.current) !== JSON.stringify(config)) sessionStarted.current = false
    previousConfig.current = config
  }, [config])
  // const pathname = "/"
  console.log(pathname)

  const renderWorker = useMemo(() => {
    if (!canvasElement) return

    const worker = new Worker(
      new URL('./worker/render/Render.worker.ts', import.meta.url), {type: 'module'},
    )
    worker.addEventListener('error', event => logDebug('error', 'video', event.message))
    const canvas = canvasElement.transferControlToOffscreen()
    worker.postMessage(new InitEvent(canvas, videoChannel.port2), [
      canvas,
      videoChannel.port2,
    ])
    return worker
  }, [canvasElement])

  useLayoutEffect(() => {
    if (canvasRef.current) {
      setCanvasElement(canvasRef.current)
    }
  }, [])

  const carplayWorker = useMemo(() => {
    const worker = new Worker(
      new URL('./worker/CarPlay.worker.ts', import.meta.url),
      {type: 'module'}
    ) as CarPlayWorker
    worker.addEventListener('error', event => logDebug('error', 'carplay', event.message))
    const payload = {
      videoPort: videoChannel.port1,
    }
    worker.postMessage({ type: 'initialise', payload }, [
      videoChannel.port1,
    ])
    return worker
  }, [])

  const { processAudio, getAudioPlayer, startRecording, stopRecording } =
    useCarplayAudio(carplayWorker, settings)

  const stopRecordingRef = useRef(stopRecording)
  stopRecordingRef.current = stopRecording

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  // subscribe to worker messages
  useEffect(() => {
    carplayWorker.postMessage({ type: 'debugRecording', enabled: useDebugStore.getState().recording })
    return useDebugStore.subscribe((state, previous) => {
      if (state.recording !== previous.recording) carplayWorker.postMessage({ type: 'debugRecording', enabled: state.recording })
    })
  }, [carplayWorker])

  useEffect(() => {
    carplayWorker.onmessage = (ev) => {
      const { type } = ev.data
      switch (type) {
        case 'debugLog':
          recordEntry(ev.data.entry)
          break
        case 'plugged':
          logDebug('info', 'connection', 'Phone connected; waiting for video')
          if(settings.piMost && settings?.most?.stream) {
            console.log("setting most stream")
            stream(settings.most.stream)
          }
          break
        case 'videoStarted':
          logDebug('info', 'connection', 'CarPlay video stream started')
          clearRetryTimeout()
          setConnecting(false)
          setConnectionError(false)
          setDisconnected(false)
          setPlugged(true)
          setReceivingVideo(true)
          break
        case 'unplugged':
          logDebug('warn', 'connection', 'Phone disconnected')
          clearRetryTimeout()
          stopRecordingRef.current()
          setConnecting(false)
          setDisconnected(true)
          setReceivingVideo(false)
          setPlugged(false)
          break
        case 'getAudioPlayer':
        case 'requestBuffer':
          getAudioPlayer(ev.data.message)
          break
        case 'audio':
          processAudio(ev.data.message)
          break
        case 'media':
          logDebug('debug', 'media', 'Media message', ev.data.message)
          break
        case 'command':
          const {
            message: { value }
          } = ev.data
          switch (value) {
            case CommandMapping.startRecordAudio:
              startRecording()
              break
            case CommandMapping.stopRecordAudio:
              stopRecording()
              break
            case CommandMapping.requestHostUI:
              navigate('/settings')
          }
          break
        case 'failure':
          logDebug('error', 'connection', 'CarPlay session failed')
          clearRetryTimeout()
          setConnecting(false)
          setConnectionError(true)
          setReceivingVideo(false)
          setPlugged(false)
          break
      }
    }
  }, [carplayWorker, clearRetryTimeout, getAudioPlayer, processAudio, renderWorker, startRecording, stopRecording])

  useEffect(() => {
    const element = mainElem?.current
    if(!element) return;
    const observer = new ResizeObserver(() => {
      console.log("size change")
      carplayWorker.postMessage({type: 'frame'})
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, []);

  useEffect(() => {
    const keyCommand = (['left', 'right', 'selectDown', 'selectUp', 'back', 'down', 'home', 'play', 'pause', 'next', 'prev'] as const)
      .find(value => value === command)
    if (keyCommand) carplayWorker.postMessage({type: 'keyCommand', command: keyCommand})
  }, [commandCounter]);

  const checkDevice = useCallback(async (request = false) => {
    if (checkingDevice.current) return
    checkingDevice.current = true
    try {
      // Request permission directly from the button gesture; startup uses existing grants.
      const device = request ? await requestDevice() : await findDevice()
      if (!device) {
        logDebug(request ? 'warn' : 'debug', 'connection', request ? 'No adapter selected or available' : 'No previously authorised adapter found')
        setDeviceFound(false)
        if (request) setConnectionError(true)
        return
      }
      setDeviceFound(true)
      if (!request && sessionStarted.current) return
      logDebug('info', 'connection', request ? 'Reconnect requested' : 'Starting adapter session', { vendorId: device.vendorId, productId: device.productId })
      sessionStarted.current = true
      setConnecting(true)
      setConnectionError(false)
      setPlugged(false)
      setReceivingVideo(false)
      stopRecordingRef.current()
      clearRetryTimeout()
      carplayWorker.postMessage({ type: 'reconnect', payload: { config } })
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null
        logDebug('warn', 'connection', 'Timed out waiting for CarPlay video after 30 seconds')
        setConnecting(false)
        setConnectionError(true)
        setPlugged(false)
        setReceivingVideo(false)
      }, RETRY_DELAY_MS * 2)
    } catch (error) {
      console.error('CarPlay connection failed', error)
      setConnecting(false)
      setConnectionError(true)
    } finally {
      checkingDevice.current = false
    }
  }, [carplayWorker, config, clearRetryTimeout, setPlugged, setReceivingVideo])

  useEffect(() => {
    const onConnect = () => { void checkDevice() }
    const onDisconnect = async () => {
      if (await findDevice()) return
      logDebug('warn', 'connection', 'USB adapter disconnected')
      sessionStarted.current = false
      carplayWorker.postMessage({ type: 'stop' })
      clearRetryTimeout()
      stopRecordingRef.current()
      setDeviceFound(false)
      setPlugged(false)
      setReceivingVideo(false)
      setConnecting(false)
      setDisconnected(true)
    }
    navigator.usb.addEventListener('connect', onConnect)
    navigator.usb.addEventListener('disconnect', onDisconnect)
    void checkDevice()
    return () => {
      navigator.usb.removeEventListener('connect', onConnect)
      navigator.usb.removeEventListener('disconnect', onDisconnect)
    }
  }, [carplayWorker, checkDevice, clearRetryTimeout, setPlugged, setReceivingVideo])

  useEffect(() => () => clearRetryTimeout(), [clearRetryTimeout])

  const sendTouchEvent = useCarplayTouch(carplayWorker)


  return (
    <div
      style={pathname === '/' ? { height: '100%', touchAction: 'none' } : { height: '1px' }}
      id={'carplayHost'}
      className="App"
      ref={mainElem}
    >
      {!receivingVideo && pathname === '/' && (
        <WaitingScreen adapterFound={deviceFound} connecting={connecting}
          disconnected={disconnected} error={connectionError}
          onConnect={() => { void checkDevice(true) }} />
      )}
      <div
        id="videoContainer"
        onPointerDown={sendTouchEvent}
        onPointerMove={sendTouchEvent}
        onPointerUp={sendTouchEvent}
        onPointerCancel={sendTouchEvent}
        onPointerOut={sendTouchEvent}
        style={{
          height: '100%',
          width: '100%',
          padding: 0,
          margin: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          visibility: receivingVideo ? 'visible' : 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          id={'video'}
          style={receivingVideo ? { width: '100%', height: '100%', objectFit: 'contain' } : { height: '0%' }}
        />
      </div>
    </div>
  )
}

export default React.memo(Carplay)
