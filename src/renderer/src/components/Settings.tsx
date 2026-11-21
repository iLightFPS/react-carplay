import { useEffect, useState } from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from '@mui/material'
import { ExtraConfig } from '../../../main/Globals'
import { KeyBindings } from './KeyBindings'
import { Canbus } from './Canbus'
import { useCarplayStore } from '../store/store'
import './Settings.css'

const sections = [
  { id: 'display', title: 'Display', description: 'Picture & appearance', icon: '▣' },
  { id: 'audio', title: 'Audio', description: 'Sound & microphone', icon: '♫' },
  { id: 'connection', title: 'Connection', description: 'Wireless & camera', icon: '⌁' },
  { id: 'advanced', title: 'Advanced', description: 'Controls & adapter', icon: '⚙' }
] as const
type Section = typeof sections[number]['id']
const numericFields = {
  width: { label: 'Width', unit: 'px', min: 1 },
  height: { label: 'Height', unit: 'px', min: 1 },
  dpi: { label: 'Interface density', unit: 'DPI', min: 1 },
  fps: { label: 'Frame rate', unit: 'fps', min: 1 },
  mediaDelay: { label: 'Audio delay', unit: 'ms', min: 0 },
  format: { label: 'Video format', unit: '', min: 0 },
  iBoxVersion: { label: 'iBox version', unit: '', min: 0 },
  phoneWorkMode: { label: 'Phone work mode', unit: '', min: 0 }
} as const
type NumericKey = keyof typeof numericFields
const toNumbers = (settings: ExtraConfig) => Object.fromEntries(
  Object.keys(numericFields).map(key => [key, String(settings[key])])
) as Record<NumericKey, string>

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (checked: boolean) => void
}) {
  return <label className="settingsToggleRow">
    <span><strong>{label}</strong><small>{description}</small></span>
    <span className="settingsSwitch"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span /></span>
  </label>
}

function SettingsEditor({ settings }: { settings: ExtraConfig }) {
  const [section, setSection] = useState<Section>('display')
  const [draft, setDraft] = useState(settings)
  const [numbers, setNumbers] = useState(() => toNumbers(settings))
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceError, setDeviceError] = useState(false)
  const [dialog, setDialog] = useState<'bindings' | 'canbus' | null>(null)
  const saveSettings = useCarplayStore(state => state.saveSettings)
  const saving = useCarplayStore(state => state.saving)
  const saveError = useCarplayStore(state => state.saveError)
  const current = sections.find(item => item.id === section)!
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings) || JSON.stringify(numbers) !== JSON.stringify(toNumbers(settings))
  const invalid = Object.keys(numericFields).some(key => {
    const k = key as NumericKey
    return !numbers[k].trim() || !Number.isSafeInteger(Number(numbers[k])) || Number(numbers[k]) < numericFields[k].min
  })
  const update = (key: string, value: unknown) => setDraft(previous => ({ ...previous, [key]: value }))

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const available = await navigator.mediaDevices.enumerateDevices()
        if (active) { setDevices(available); setDeviceError(false) }
      } catch { if (active) setDeviceError(true) }
    }
    void refresh()
    navigator.mediaDevices?.addEventListener('devicechange', refresh)
    return () => { active = false; navigator.mediaDevices?.removeEventListener('devicechange', refresh) }
  }, [])

  const save = () => {
    if (invalid) return
    const next = { ...draft }
    for (const key of Object.keys(numericFields)) next[key] = Number(numbers[key as NumericKey])
    saveSettings(next)
    setDraft(next)
    setNumbers(toNumbers(next))
  }
  const discard = () => { setDraft(settings); setNumbers(toNumbers(settings)) }
  const number = (key: NumericKey) => {
    const field = numericFields[key]
    const error = !numbers[key].trim() || !Number.isSafeInteger(Number(numbers[key])) || Number(numbers[key]) < field.min
    return <label className="settingsField" key={key}>
      <span>{field.label}</span>
      <span className={`settingsInputWrap${error ? ' hasError' : ''}`}>
        <input type="number" min={field.min} step="1" value={numbers[key]} aria-invalid={error}
          onChange={e => setNumbers(previous => ({ ...previous, [key]: e.target.value }))} />
        {field.unit && <span>{field.unit}</span>}
      </span>
      {error && <small className="settingsFieldError">Enter a whole number of {field.min} or higher.</small>}
    </label>
  }
  const deviceSelect = (kind: 'audioinput' | 'videoinput', key: 'microphone' | 'camera' | 'frontCamera', label: string) => {
    const available = devices.filter(device => device.kind === kind)
    return <label className="settingsField"><span>{label}</span>
      <select value={draft[key] || ''} onChange={e => update(key, e.target.value)}>
        <option value="">{key === 'microphone' ? 'System default' : 'No camera'}</option>
        {draft[key] && !available.some(device => device.deviceId === draft[key]) && <option value={draft[key]}>Saved device · unavailable</option>}
        {available.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}
      </select>
    </label>
  }

  return <section className="settingsPage" aria-label="Settings">
    <header className="settingsHeader"><div><span className="settingsEyebrow">CARPLAY</span><h1>Settings</h1></div>
      <span className={`settingsSaveStatus${dirty ? ' isDirty' : ''}`} role="status">{dirty ? 'Unsaved changes' : 'Up to date'}</span>
    </header>
    <div className="settingsLayout">
      <nav className="settingsSidebar" aria-label="Settings categories">{sections.map(item =>
        <button key={item.id} className={section === item.id ? 'isActive' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
          <span className="settingsCategoryIcon" aria-hidden="true">{item.icon}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="settingsChevron" aria-hidden="true">›</span>
        </button>
      )}</nav>
      <div className="settingsPanel">
        <div className="settingsPanelHeading"><h2>{current.title}</h2><p>{section === 'advanced' ? 'Fine-tune your adapter and vehicle controls.' : section === 'display' ? 'Make CarPlay fit your screen.' : section === 'audio' ? 'Choose how you listen and speak.' : 'Manage your wireless connection and camera.'}</p></div>
        {section === 'display' && <>
          <div className="settingsCard"><h3>Appearance</h3>
            <Toggle label="Dark CarPlay interface" description="Use the night appearance inside CarPlay." checked={!!draft.nightMode} onChange={value => update('nightMode', value)} />
            <Toggle label="Fullscreen" description="Use kiosk mode. Applies as soon as settings are saved." checked={!!draft.kiosk} onChange={value => update('kiosk', value)} />
          </div>
          <div className="settingsCard"><h3>Picture</h3><div className="settingsFieldGrid">{number('width')}{number('height')}{number('fps')}{number('dpi')}</div></div>
        </>}
        {section === 'audio' && <>
          <div className="settingsCard"><h3>Microphone</h3><div className="settingsFieldGrid">
            <label className="settingsField"><span>Microphone source</span><select value={draft.micType} onChange={e => update('micType', e.target.value)}><option value="os">Computer / Raspberry Pi</option><option value="box">Carlinkit adapter</option></select></label>
            {deviceSelect('audioinput', 'microphone', 'Microphone device')}
          </div></div>
          <div className="settingsCard"><h3>Playback</h3><p className="settingsHint">Adjust the delay if audio and video feel out of sync.</p><div className="settingsFieldGrid">{number('mediaDelay')}</div></div>
        </>}
        {section === 'connection' && <>
          <div className="settingsCard"><h3>Wireless</h3><label className="settingsField"><span>Wi-Fi band</span><select value={draft.wifiType} onChange={e => update('wifiType', e.target.value)}><option value="5ghz">5 GHz</option><option value="2.4ghz">2.4 GHz</option></select></label></div>
          <div className="settingsCard"><h3>Camera</h3><div className="settingsFieldGrid">{deviceSelect('videoinput', 'camera', 'Reverse camera')}{deviceSelect('videoinput', 'frontCamera', 'Front camera')}</div></div>
        </>}
        {section === 'advanced' && <>
          <div className="settingsCard"><h3>Controls</h3>
            <button className="settingsActionRow" onClick={() => setDialog('bindings')}><span><strong>Key bindings</strong><small>Assign keyboard and steering-control shortcuts.</small></span><span aria-hidden="true">↗</span></button>
            <Toggle label="CAN bus integration" description="Use vehicle signals for reverse and front camera controls." checked={!!draft.canbus} onChange={value => update('canbus', value)} />
            <button className="settingsActionRow" onClick={() => setDialog('canbus')}><span><strong>Configure CAN signals</strong><small>Reverse and front camera message mappings.</small></span><span aria-hidden="true">↗</span></button>
            <div className="settingsUnavailable"><span>PiMost audio</span><span>Unavailable in this build</span></div>
          </div>
          <div className="settingsCard"><h3>Adapter configuration</h3><p className="settingsHint">Keep your working values unless your adapter requires a change.</p><div className="settingsFieldGrid">{number('format')}{number('iBoxVersion')}{number('phoneWorkMode')}</div></div>
        </>}
        {deviceError && (section === 'audio' || section === 'connection') && <p className="settingsHint" role="status">Device discovery is unavailable. Your saved selection is preserved.</p>}
      </div>
    </div>
    <footer className="settingsFooter"><p role="status">{saveError ?? (invalid ? 'Check the highlighted number fields before saving.' : 'Adapter changes reconnect CarPlay automatically when saved.')}</p><div>
      <button className="settingsDiscard" disabled={!dirty || saving} onClick={discard}>Discard changes</button>
      <button className="settingsSave" disabled={!dirty || invalid || saving} onClick={save}>{saving ? 'Saving…' : 'Save settings'}</button>
    </div></footer>
    <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="md" PaperProps={{ className: 'settingsDialog', sx: { background: '#182426', borderRadius: '20px', border: '1px solid #344445' } }}>
      <DialogTitle>{dialog === 'bindings' ? 'Key bindings' : 'CAN bus signals'}</DialogTitle>
      <DialogContent>{dialog === 'bindings' ? <KeyBindings settings={draft} updateKey={update} /> : dialog === 'canbus' ? <Canbus settings={draft} setSettings={update} setOpenCan={() => setDialog(null)} /> : null}</DialogContent>
      <DialogActions><Button onClick={() => setDialog(null)} sx={{ color: '#acebd4' }}>Done</Button></DialogActions>
    </Dialog>
  </section>
}

export default function Settings({ settings }: { settings: ExtraConfig | null }) {
  return settings ? <SettingsEditor settings={settings} /> : <section className="settingsPage"><p role="status">Loading settings…</p></section>
}
