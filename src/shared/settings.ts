import type { ExtraConfig } from '../main/Globals'
import type { DongleConfig } from 'node-carplay/web'

export function normaliseSettings(defaults: ExtraConfig, saved: Partial<ExtraConfig>): ExtraConfig {
  const result = { ...defaults, ...saved, bindings: { ...defaults.bindings, ...saved.bindings },
    canConfig: { ...saved.canConfig }, frontCamera: saved.frontCamera ?? defaults.frontCamera ?? '' }
  // Earlier versions called the front-camera trigger "lights".
  if (!result.canConfig.frontCamera && result.canConfig.lights) result.canConfig.frontCamera = result.canConfig.lights
  return result
}

export function adapterConfig(settings: ExtraConfig): DongleConfig {
  return {
    width: settings.width, height: settings.height, fps: settings.fps, dpi: settings.dpi,
    format: settings.format, iBoxVersion: settings.iBoxVersion, packetMax: settings.packetMax,
    phoneWorkMode: settings.phoneWorkMode, nightMode: settings.nightMode, boxName: settings.boxName,
    hand: settings.hand, mediaDelay: settings.mediaDelay, audioTransferMode: settings.audioTransferMode,
    wifiType: settings.wifiType, micType: settings.micType, phoneConfig: settings.phoneConfig,
    androidWorkMode: settings.androidWorkMode
  }
}

export function validateSettings(settings: ExtraConfig): void {
  const minimums = { width: 1, height: 1, fps: 1, dpi: 1, packetMax: 1, format: 0, iBoxVersion: 0, phoneWorkMode: 0, mediaDelay: 0 }
  for (const key of Object.keys(minimums) as (keyof typeof minimums)[]) {
    if (!Number.isSafeInteger(settings[key]) || settings[key] < minimums[key]) throw Error(`Invalid ${key}: expected a whole number of ${minimums[key]} or higher`)
  }
  if (!['2.4ghz', '5ghz'].includes(settings.wifiType)) throw Error('Invalid Wi-Fi band')
  if (!['os', 'box'].includes(settings.micType)) throw Error('Invalid microphone source')
}
