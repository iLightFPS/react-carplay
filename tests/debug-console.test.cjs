const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function core() {
  const calls = []
  const fakeConsole = Object.fromEntries(['log', 'info', 'debug', 'warn', 'error'].map(method => [method, (...args) => calls.push({ method, args })]))
  const source = fs.readFileSync(path.join(__dirname, '../src/shared/debugLog.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const context = vm.createContext({ exports: {}, console: fakeConsole, Error, ArrayBuffer, SharedArrayBuffer, Uint8Array })
  vm.runInContext(code, context)
  return { ...context.exports, console: fakeConsole, calls }
}
test('formats circular objects and errors without losing the error message', () => {
  const c = core(), circular = { name: 'navigation' }; circular.self = circular
  assert.match(c.describe(circular), /Circular/)
  assert.match(c.describe(new Error('USB disconnected')), /USB disconnected/)
})
test('large binary packets are summarised instead of retained as full payloads', () => {
  const c = core(), data = new Uint8Array(1024 * 1024)
  const result = JSON.parse(c.describe(data))
  assert.equal(result.bytes, data.byteLength)
  assert.equal(result.preview.length, 24)
  assert.ok(c.describe(data).length < 250)
  assert.ok(c.describe('x'.repeat(20000)).length < 4050)
})
test('buffer keeps the newest entries, sorts history and suppresses duplicate delivery', () => {
  const c = core()
  const entry = n => ({ id: `id-${n}`, timestamp: new Date(n * 1000).toISOString(), level: 'info', source: 'navigation', message: String(n) })
  const result = c.appendEntries([entry(2)], [entry(1), entry(2), entry(4), entry(3)], 3)
  assert.equal(result.map(item => item.id).join(','), 'id-2,id-3,id-4')
})
test('capture preserves console output, severity and source and can be restored', () => {
  const c = core(), captured = []
  const original = c.console.error
  const restore = c.captureConsole('carplay', entry => captured.push(entry))
  c.console.error('Device failed', new Error('claim failed'))
  assert.equal(c.calls.length, 1)
  assert.equal(captured[0].level, 'error')
  assert.equal(captured[0].source, 'carplay')
  assert.match(captured[0].message, /claim failed/)
  restore()
  assert.equal(c.console.error, original)
})
test('a failed logging sink never interrupts the application', () => {
  const c = core()
  c.captureConsole('app', () => { throw Error('Logger unavailable') })
  assert.doesNotThrow(() => c.console.warn('Keep running'))
  assert.equal(c.calls.length, 1)
})
test('disabled recording bypasses formatting and capture while keeping ordinary console output', () => {
  const c = core(), entries = []
  let recording = false, formatted = false
  const data = { get expensive() { formatted = true; return 'formatted' } }
  c.captureConsole('app', entry => entries.push(entry), () => recording)
  c.console.info(data)
  assert.equal(entries.length, 0)
  assert.equal(formatted, false)
  assert.equal(c.calls.length, 1)
  recording = true
  c.console.info('Now enabled')
  assert.equal(entries.length, 1)
  recording = false
  c.console.info('Disabled again')
  assert.equal(entries.length, 1)
})
