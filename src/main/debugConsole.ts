import { BrowserWindow, ipcMain } from 'electron'
import { captureConsole, makeEntry, type DebugEntry } from '../shared/debugLog'

const history: DebugEntry[] = []
let recording = false
function publish(entry: DebugEntry) {
  history.push(entry)
  if (history.length > 500) history.shift()
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send('debug:entry', entry)
  }
}
captureConsole('main', publish, () => recording)
ipcMain.handle('debug:history', () => history.slice())
ipcMain.on('debug:recording', (_event, enabled: unknown) => {
  if (typeof enabled !== 'boolean' || enabled === recording) return
  recording = enabled
  if (recording) publish(makeEntry('info', 'main', ['Main-process recording started']))
})
