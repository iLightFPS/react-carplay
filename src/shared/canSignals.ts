export interface CanMapping { canId: number; byte: number; mask: number }
export interface CanFrame { id: number; data: Uint8Array; rtr?: boolean }

export function validMapping(mapping: CanMapping | undefined): mapping is CanMapping {
  return !!mapping && Number.isInteger(mapping.canId) && mapping.canId >= 0 && mapping.canId <= 0x1fffffff
    && Number.isInteger(mapping.byte) && mapping.byte >= 0 && mapping.byte < 8
    && Number.isInteger(mapping.mask) && mapping.mask > 0 && mapping.mask <= 255
}

// null means the frame is unrelated or too short, rather than a false signal.
export function decodeCanSignal(frame: CanFrame, mapping: CanMapping | undefined): boolean | null {
  if (!validMapping(mapping) || frame.rtr || frame.id !== mapping.canId || frame.data.length <= mapping.byte) return null
  return (frame.data[mapping.byte] & mapping.mask) !== 0
}

export function cameraMode(reverse: boolean, frontCamera: boolean): 'reverse' | 'front' | null {
  return reverse ? 'reverse' : frontCamera ? 'front' : null
}
