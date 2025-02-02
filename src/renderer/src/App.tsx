import { useEffect, useRef, useState } from "react";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { ExtraConfig } from "../../main/Globals";
import Settings from "./components/Settings";
import Info from "./components/Info";
import Home from "./components/Home";
import Nav from "./components/Nav";
import Carplay from './components/Carplay'
import Camera from './components/Camera'
import { IpcRendererEvent } from "electron";
import { Box, Dialog, Modal } from '@mui/material'

// rm -rf node_modules/.vite; npm run dev


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
  const [settings, setSettings] = useState<ExtraConfig | null>(null)
  const intialized = useRef(false)
  const intialized2 = useRef(false)
  const [receivingVideo, setReceivingVideo] = useState(false)
  const [commandCounter, setCommandCounter] = useState(0)
  const [keyCommand, setKeyCommand] = useState('')
  const [reverse, setReverse] = useState(false)
  const [key, setKey] = useState('')



  console.log("rendering")

  useEffect(() => {
    if(!intialized.current) {
      intialized.current = true
      window.api.settings((_, value: ExtraConfig) => {
        console.log("setting settings")
        setSettings(value)
      })
    }

  }, [window.api]);

  useEffect(() => {
    window.api.reverse((_: IpcRendererEvent, value: boolean) => {
      console.log("reverse", value)
      value ? setReverse(true) : setReverse(false)
    })
  }, [window.api]);


  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [settings]);


  const onKeyDown = (event: KeyboardEvent) => {
    console.log(event.code)
    if(Object.values(settings.bindings).includes(event.code)) {
      let action = Object.keys(settings.bindings).find(key =>
        settings.bindings[key] === event.code
      )
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

  useEffect(() => {
    if(!intialized2.current) {
      window.api.getSettings()
    }
  }, [window.api]);

  return (
    <Router>
      <div
        style={{ height: '100%', touchAction: 'none' }}
        id={'main'}
        className="App"

      >
        <Nav receivingVideo={receivingVideo} settings={settings}/>
        {settings ? <Carplay  receivingVideo={receivingVideo} setReceivingVideo={setReceivingVideo} settings={settings} command={keyCommand} commandCounter={commandCounter}/> : null}
        <Routes>
          <Route path={"/"} element={<Home />} />
          <Route path={"/settings"} element={<Settings settings={settings!}/>} />
          <Route path={"/info"} element={<Info />} />
          <Route path={"/camera"} element={<Camera settings={settings!}/>} />
        </Routes>
        <Modal
          open={reverse}
          onClick={()=> setReverse(false)}
        >
          <Box sx={style}>
            <Camera settings={settings}/>
          </Box>
        </Modal>
      </div>
    </Router>

  )
}

export default App
