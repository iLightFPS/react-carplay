const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const project = process.env.CARPLAY_PROJECT || path.resolve(__dirname, '..')
const ts = require(require.resolve('typescript', { paths: [project] }))
const source = fs.readFileSync(path.join(project, 'src/renderer/src/components/worker/CarPlay.worker.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const tick = () => new Promise(resolve => setImmediate(resolve))
function harness() {
  const events = [], calls = []
  let available = true, failStart = false, releaseStop, session, captureGate
  class Session {
    constructor() { session = this }
    async start() { calls.push('start'); if (failStart) throw Error('USB open failed') }
    async stop() { calls.push('stop'); if (releaseStop) await releaseStop; this.onmessage?.({ type: 'failure' }) }
  }
  const context = vm.createContext({ exports: {}, console: { error() {} }, onmessage: null,
    postMessage: message => events.push(message),
    require: name => name === 'node-carplay/web' ? {
      __esModule: true, default: Session, findDevice: async () => available ? {} : null
    } : name.includes('debugLog') ? { captureConsole(_source, _sink, enabled) { captureGate = enabled } } : name.includes('RenderEvents') ? { RenderEvent: class { constructor(data) { this.data = data } } } : {} })
  vm.runInContext(code, context)
  return { calls, events, send: (type, payload = { config: {} }) => context.onmessage({ data: { type, payload } }),
    feed: message => session.onmessage(message),
    recording: enabled => context.onmessage({ data: { type: 'debugRecording', enabled } }),
    isRecording: () => captureGate(),
    missing: () => { available = false }, fail: value => { failStart = value },
    holdStop: promise => { releaseStop = promise } }
}
test('reconnect waits for the old USB session to close before opening another', async () => {
  const h = harness()
  h.send('start'); await tick()
  let release
  h.holdStop(new Promise(resolve => { release = resolve }))
  h.send('reconnect'); await tick()
  assert.deepEqual(h.calls, ['start', 'stop'])
  release(); await tick()
  assert.deepEqual(h.calls, ['start', 'stop', 'start'])
})
test('failed open is cleaned up and a later reconnect can succeed', async () => {
  const h = harness()
  h.fail(true); h.send('reconnect'); await tick()
  assert.deepEqual(h.calls, ['start', 'stop'])
  assert.equal(h.events[0].type, 'failure')
  h.fail(false); h.send('reconnect'); await tick()
  assert.deepEqual(h.calls, ['start', 'stop', 'start'])
})
test('missing adapter reports failure instead of silently leaving a pending start', async () => {
  const h = harness()
  h.missing(); h.send('reconnect'); await tick()
  assert.equal(h.events[0].type, 'failure')
  assert.deepEqual(h.calls, [])
})
test('video readiness is reported once per phone connection, only after a frame arrives', async () => {
  const h = harness(), frames = []
  h.send('initialise', { videoPort: { postMessage: message => frames.push(message) }, microphonePort: {} })
  h.send('start'); await tick()
  h.feed({ type: 'plugged' })
  assert.equal(h.events.filter(e => e.type === 'videoStarted').length, 0)
  const frame = () => ({ type: 'video', message: { data: new Uint8Array([1, 2]) } })
  h.feed(frame()); h.feed(frame())
  assert.equal(h.events.filter(e => e.type === 'videoStarted').length, 1)
  h.feed({ type: 'unplugged' }); h.feed(frame())
  assert.equal(h.events.filter(e => e.type === 'videoStarted').length, 2)
  assert.equal(frames.length, 3)
})
test('worker logging starts disabled and can be stopped even while USB shutdown is pending', async () => {
  const h = harness()
  assert.equal(h.isRecording(), false)
  h.send('start'); await tick()
  let release
  h.holdStop(new Promise(resolve => { release = resolve }))
  h.send('reconnect'); await tick()
  h.recording(true)
  assert.equal(h.isRecording(), true)
  h.recording(false)
  assert.equal(h.isRecording(), false)
  release(); await tick()
})

test('closing an old session cannot inject a failure into the replacement session', async () => {
  const h = harness()
  h.send('start'); await tick()
  h.send('reconnect'); await tick()
  assert.equal(h.events.filter(event => event.type === 'failure').length, 0)
})