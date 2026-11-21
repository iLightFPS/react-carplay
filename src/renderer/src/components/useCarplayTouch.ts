import { useRef, useCallback } from 'react'
import { TouchAction } from 'node-carplay/web'
import type { PointerEventHandler } from 'react'
import type { CarPlayWorker } from './worker/types'
import { videoTouchPosition } from '../../../shared/videoTouch'

export const useCarplayTouch = (worker: CarPlayWorker) => {
  const pointer = useRef<number | null>(null)
  const sendTouchEvent: PointerEventHandler<HTMLDivElement> = useCallback(event => {
    const canvas = event.currentTarget.querySelector('canvas')
    if (!canvas) return
    const position = videoTouchPosition(canvas.getBoundingClientRect(), canvas.width, canvas.height, event.clientX, event.clientY)
    if (!position) return
    let action: TouchAction
    if (event.type === 'pointerdown') {
      if (!position.inside || pointer.current !== null) return
      pointer.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      action = TouchAction.Down
    } else {
      if (pointer.current !== event.pointerId) return
      if (event.type === 'pointermove') action = TouchAction.Move
      else {
        pointer.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        action = TouchAction.Up
      }
    }
    worker.postMessage({ type: 'touch', payload: { x: position.x, y: position.y, action } })
  }, [worker])
  return sendTouchEvent
}
