export function videoTouchPosition(rect: { left: number; top: number; width: number; height: number }, frameWidth: number, frameHeight: number, clientX: number, clientY: number) {
  if (rect.width <= 0 || rect.height <= 0 || frameWidth <= 0 || frameHeight <= 0) return null
  const scale = Math.min(rect.width / frameWidth, rect.height / frameHeight)
  const width = frameWidth * scale, height = frameHeight * scale
  const left = rect.left + (rect.width - width) / 2, top = rect.top + (rect.height - height) / 2
  const x = (clientX - left) / width, y = (clientY - top) / height
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 }
}
