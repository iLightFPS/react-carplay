import { cameraMode } from '../../shared/canSignals'
import { useEffect, useState } from "react";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import Settings from "./components/Settings";
import './App.css'
import Info from "./components/Info";
import Home from "./components/Home";
import Nav from "./components/Nav";
import Carplay from './components/Carplay'
import Camera from './components/Camera'
import { Box, Modal } from '@mui/material'
import { useCarplayStore, useStatusStore } from "./store/store";
import { ThemeProvider, createTheme } from '@mui/material/styles';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  height: '95%',
  width: '95%',
  boxShadow: 24,
  display: "flex"
};

function App() {
  const [receivingVideo, setReceivingVideo] = useState(false)
  const [commandCounter, setCommandCounter] = useState(0)
  const [keyCommand, setKeyCommand] = useState('')
  const reverse = useStatusStore(state => state.reverse)
  const frontCamera = useStatusStore(state => state.frontCamera)
  const cameraView = cameraMode(reverse, frontCamera)
  const [dismissedCamera, setDismissedCamera] = useState<string | null>(null)
  useEffect(() => setDismissedCamera(null), [cameraView])
  const settings = useCarplayStore((state) => state.settings)

  const theme = createTheme({
    palette: {
      mode: 'dark',
      background: {
        default: '#333333',
        paper: '#333333',
      },
    }
  });

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [settings]);

  const onKeyDown = (event: KeyboardEvent) => {
    if(settings && Object.values(settings.bindings).includes(event.code)) {
      let action = Object.keys(settings!.bindings).find(key =>
        settings!.bindings[key] === event.code
      )
      console.log(action)
      if(action !== undefined) {
        setKeyCommand(action)
        setCommandCounter(prev => prev +1)
        if(action === 'selectDown') {
          console.log('select down')
          setTimeout(() => {
            setKeyCommand('selectUp')
            setCommandCounter(prev => prev +1)
          }, 200)
        }
      }
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <div
          style={{ height: '100%', touchAction: 'none' }}
          id={'main'}
          className="App"
        >
          <Nav receivingVideo={receivingVideo} settings={settings}/>
          {settings ? <Carplay receivingVideo={receivingVideo} setReceivingVideo={setReceivingVideo} settings={settings} command={keyCommand} commandCounter={commandCounter}/> : null}
          <Routes>
            <Route path={"/"} element={<Home />} />
            <Route path={"/settings"} element={<Settings settings={settings!}/>} />
            <Route path={"/info"} element={<Info />} />
            <Route path={"/camera"} element={<Camera settings={settings!}/>} />
          </Routes>
          <Modal
            open={!!settings && cameraView !== null && dismissedCamera !== cameraView}
            onClose={() => setDismissedCamera(cameraView)}
          >
            <Box sx={style}>
              <Camera settings={settings} mode={cameraView ?? 'reverse'} onClose={() => setDismissedCamera(cameraView)}/>
            </Box>
          </Modal>
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App
