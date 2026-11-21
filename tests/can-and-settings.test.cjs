const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, globals = {}, mocks = {}) {
  const full = path.join(root, file)
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const local = createRequire(full)
  const context = vm.createContext({ exports: {}, console: { info() {}, error() {} }, setInterval, clearInterval, Date, Error, ...globals,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(full), name + '.ts')), globals, mocks) : local(name) })
  vm.runInContext(code, context)
  return context.exports
}
const { decodeCanSignal, cameraMode } = load('src/shared/canSignals.ts')
const { normaliseSettings, adapterConfig, validateSettings } = load('src/shared/settings.ts')
const { videoTouchPosition } = load('src/shared/videoTouch.ts')
const defaults = { width: 800, height: 480, fps: 30, dpi: 160, format: 5, iBoxVersion: 2, packetMax: 49152, phoneWorkMode: 2,
  nightMode: false, boxName: 'nodePlay', hand: 0, mediaDelay: 300, audioTransferMode: false, wifiType: '5ghz', micType: 'os',
  phoneConfig: { 3: { frameInterval: 5000 } }, kiosk: false, camera: 'rear-device', frontCamera: '', canbus: false, piMost: false,
  bindings: { home: 'KeyH', left: 'ArrowLeft' }, canConfig: {} }

test('reverse mapping uses D2 at zero-based index 1 and ignores unrelated or malformed frames', () => {
  const mapping = { canId: 0x160, byte: 1, mask: 0x10 }
  assert.equal(decodeCanSignal({ id: 0x160, data: Uint8Array.from([0x3e, 0x7f]) }, mapping), true)
  assert.equal(decodeCanSignal({ id: 0x160, data: Uint8Array.from([0x3e, 0x6f]) }, mapping), false)
  assert.equal(decodeCanSignal({ id: 0x161, data: Uint8Array.from([0, 0xff]) }, mapping), null)
  assert.equal(decodeCanSignal({ id: 0x160, data: Uint8Array.from([0]) }, mapping), null)
  assert.equal(decodeCanSignal({ id: 0x160, data: Uint8Array.from([0, 0xff]), rtr: true }, mapping), null)
})
test('front camera uses its own mapping even when both signals share a CAN ID', () => {
  const events = [], ticks = []
  let now = 100
  class Clock extends Date { static now() { return now } }
  const { Canbus } = load('src/main/Canbus.ts', { Date: Clock, setInterval: fn => { ticks.push(fn); return { unref() {} } }, clearInterval() {} },
    { socketcan: { get createRawChannel() { throw Error('Native module must not load during this test') } } })
  class Channel extends EventEmitter { setRxFilters(filters) { this.filters = filters } start() {} stop() { this.stopped = true } }
  const channel = new Channel()
  const can = new Canbus('can0', { sendReverse: active => events.push(['reverse', active]), sendFrontCamera: active => events.push(['front', active]) },
    { reverse: { canId: 352, byte: 1, mask: 16 }, frontCamera: { canId: 352, byte: 3, mask: 2 } }, () => channel)
  channel.emit('onMessage', { id: 352, data: Uint8Array.from([0, 16, 0, 2]) })
  channel.emit('onMessage', { id: 352, data: Uint8Array.from([0, 0, 0, 2]) })
  assert.deepEqual(events, [['reverse', true], ['front', true], ['reverse', false]])
  assert.equal(channel.filters[0].mask, 0x7ff)
  now = 1700; ticks[0]()
  assert.deepEqual(events.at(-1), ['front', false])
  can.stop()
  assert.equal(channel.stopped, true)
})
test('legacy lights mapping is migrated without overwriting a new front-camera mapping', () => {
  const legacy = { canId: 123, byte: 2, mask: 4 }
  const migrated = normaliseSettings(defaults, { canConfig: { lights: legacy }, bindings: { home: 'KeyB' } })
  assert.equal(migrated.canConfig.frontCamera.canId, 123)
  assert.equal(migrated.bindings.home, 'KeyB')
  assert.equal(migrated.bindings.left, 'ArrowLeft')
  const existing = normaliseSettings(defaults, { canConfig: { lights: legacy, frontCamera: { canId: 456, byte: 1, mask: 2 } } })
  assert.equal(existing.canConfig.frontCamera.canId, 456)
})
test('reverse camera has priority and front camera resumes after reverse clears', () => {
  assert.equal(cameraMode(true, true), 'reverse')
  assert.equal(cameraMode(false, true), 'front')
  assert.equal(cameraMode(false, false), null)
})
test('all adapter settings are forwarded and local UI settings stay out of the dongle config', () => {
  const settings = { ...defaults, wifiType: '2.4ghz', micType: 'box', width: 1024, height: 600, dpi: 200, nightMode: true }
  const config = adapterConfig(settings)
  for (const key of ['width','height','fps','dpi','format','iBoxVersion','packetMax','phoneWorkMode','nightMode','boxName','hand','mediaDelay','audioTransferMode','wifiType','micType','phoneConfig']) assert.equal(config[key], settings[key], key)
  for (const key of ['camera', 'frontCamera', 'bindings', 'canConfig', 'kiosk']) assert.equal(Object.hasOwn(config, key), false, key)
})
test('settings validation rejects invalid payloads before saving', () => {
  assert.doesNotThrow(() => validateSettings(defaults))
  assert.throws(() => validateSettings({ ...defaults, fps: NaN }), /fps/)
  assert.throws(() => validateSettings({ ...defaults, width: 0 }), /width/)
  assert.throws(() => validateSettings({ ...defaults, wifiType: 'invalid' }), /Wi-Fi/)
})
test('touch coordinates follow the actual video area after a resolution change', () => {
  const rect = { left: 100, top: 50, width: 1600, height: 900 }
  // A 4:3 video is centred inside a 16:9 view, leaving 200px bars on each side.
  const centre = videoTouchPosition(rect, 800, 600, 900, 500)
  assert.equal(centre.x, 0.5); assert.equal(centre.y, 0.5)
  assert.equal(videoTouchPosition(rect, 800, 600, 300, 50).x, 0)
  assert.equal(videoTouchPosition(rect, 800, 600, 1500, 950).x, 1)
  assert.equal(videoTouchPosition(rect, 800, 600, 150, 500).inside, false)
  assert.equal(videoTouchPosition(rect, 0, 0, 150, 500), null)
})
test('socket settings saves acknowledge errors and late clients receive current camera states', () => {
  let server, connection
  class IO {
    constructor() { server = this; this.sent = [] }
    on(name, handler) { if (name === 'connection') connection = handler }
    emit(...data) { this.sent.push(data) }
  }
  let saves = 0
  const { Socket } = load('src/main/Socket.ts', {}, { 'socket.io': { Server: IO }, http: { createServer: () => ({ listen() {} }) } })
  const socket = new Socket(defaults, () => { saves++; throw Error('Disk write denied') })
  socket.sendReverse(true); socket.sendFrontCamera(true)
  const handlers = {}, received = []
  connection({ on: (name, handler) => { handlers[name] = handler }, emit: (...data) => received.push(data) })
  assert.deepEqual(received, [['reverse', true], ['frontCamera', true]])
  let result
  handlers.saveSettings(defaults, reply => { result = reply })
  assert.equal(saves, 1)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'Disk write denied')
  assert.ok(server.sent.some(event => event[0] === 'settings'))
})
