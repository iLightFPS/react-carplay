import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import CameraIcon from '@mui/icons-material/Camera';
import { Link, useLocation } from "react-router-dom";
import ExitToApp from '@mui/icons-material/ExitToApp';
import { useStatusStore } from "../store/store";
import type { ExtraConfig } from '../../../main/Globals'

function CarPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#53c86c" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="white" strokeWidth="1.8" />
      <path d="M5.2 10.5h13.6M12 13v6M6.2 11l4.3 2h3l4.3-2" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export default function Nav({ settings }: { settings: ExtraConfig | null; receivingVideo?: boolean }) {
  const [isPlugged] = useStatusStore(state => [state.isPlugged])
  const { pathname } = useLocation()
  const value = pathname === '/settings' ? 1 : pathname === '/info' ? 2 : pathname === '/camera' ? 3 : 0

  const quit = () => {
    window.api.quit()
  }

  return (
    <Tabs value={value} aria-label="App navigation" centered sx={pathname === '/' && isPlugged ? {minHeight: '0px', height: '0px'} : {}}>
      <Tab icon={<CarPlayIcon />} aria-label="CarPlay" title="CarPlay" to={'/'} component={Link}/>
      <Tab icon={<SettingsIcon />} to={'/settings'}  component={Link}/>
      <Tab icon={<TerminalIcon />} aria-label="Debug console" title="Debug console" to={'/info'} component={Link}/>
      {(settings?.camera || settings?.frontCamera) ? <Tab icon={<CameraIcon />} to={'/camera'} component={Link}/> : null}
      <Tab icon={<ExitToApp />} onClick={() => quit()} />
    </Tabs>
  );
}
