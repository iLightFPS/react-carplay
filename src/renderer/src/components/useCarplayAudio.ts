import type { ExtraConfig } from '../../../main/Globals'
import { useCallback, useEffect, useState } from 'react'
import {
  AudioCommand,
  AudioData,
  WebMicrophone,
  decodeTypeMap,
} from 'node-carplay/web'
import { PcmPlayer } from 'pcm-ringbuf-player'
import { AudioPlayerKey, CarPlayWorker } from './worker/types'
import { createAudioPlayerKey } from './worker/utils'

//TODO: allow to configure
const defaultAudioVolume = 1
const defaultNavVolume = 0.5

const useCarplayAudio = (
  worker: CarPlayWorker,
  settings: ExtraConfig,
) => {
  const [mic, setMic] = useState<WebMicrophone | null>(null)
  const [audioPlayers] = useState(new Map<AudioPlayerKey, PcmPlayer>())

  const getAudioPlayer = useCallback(
    (audio: AudioData): PcmPlayer => {
      const { decodeType, audioType } = audio
      const format = decodeTypeMap[decodeType]
      const audioKey = createAudioPlayerKey(decodeType, audioType)
      let player = audioPlayers.get(audioKey)
      if (player) return player
      player = new PcmPlayer(format.frequency, format.channel)
      audioPlayers.set(audioKey, player)
      player.volume(defaultAudioVolume)
      player.start()
      worker.postMessage({
        type: 'audioPlayer',
        payload: {
          sab: player.getRawBuffer(),
          decodeType,
          audioType,
        },
      })
      return player
    },
    [audioPlayers, worker],
  )

  const processAudio = useCallback(
    (audio: AudioData) => {
      if (audio.volumeDuration) {
        const { volume, volumeDuration } = audio
        const player = getAudioPlayer(audio)
        player.volume(volume, volumeDuration)
      } else if (audio.command) {
        switch (audio.command) {
          case AudioCommand.AudioNaviStart:
            const navPlayer = getAudioPlayer(audio)
            navPlayer.volume(defaultNavVolume)
            break
          case AudioCommand.AudioMediaStart:
          case AudioCommand.AudioOutputStart:
            const mediaPlayer = getAudioPlayer(audio)
            mediaPlayer.volume(defaultAudioVolume)
            break
        }
      }
    },
    [getAudioPlayer],
  )

  // A microphone transfers its port only once. Recreate the port pair when its source changes.
  useEffect(() => {
    if (settings.micType !== 'os') return
    let cancelled = false
    let stream: MediaStream | undefined
    let microphone: WebMicrophone | undefined
    const channel = new MessageChannel()
    const initMic = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: settings.microphone ? { deviceId: { exact: settings.microphone } } : true })
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
        worker.postMessage({ type: 'microphonePort', payload: channel.port1 }, [channel.port1])
        microphone = new WebMicrophone(stream, channel.port2)
        setMic(microphone)
      } catch (error) { console.error('Failed to init microphone', error) }
    }
    void initMic()
    return () => {
      cancelled = true
      microphone?.destroy()
      channel.port1.close()
      channel.port2.close()
      stream?.getTracks().forEach(track => track.stop())
      setMic(null)
    }
  }, [worker, settings.micType, settings.microphone])

  useEffect(() => () => { audioPlayers.forEach(player => { void player.stop() }) }, [audioPlayers])

  const startRecording = useCallback(() => {
    mic?.start()
  }, [mic])

  const stopRecording = useCallback(() => {
    mic?.stop()
  }, [mic])

  return { processAudio, getAudioPlayer, startRecording, stopRecording }
}

export default useCarplayAudio
