import { CanConfig, CanMessage, ExtraConfig } from "../../../main/Globals";
import { Button, TextField, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import React, { useEffect, useState } from "react";

interface KeyBindingsProps {
  settings: ExtraConfig,
  setOpenCan: React.Dispatch<React.SetStateAction<boolean>>,
  setSettings: (key: any, value: any) => void
}


export function Canbus({ settings, setOpenCan, setSettings }: KeyBindingsProps) {
  const [reverse, setReverse] = useState<CanMessage>({canId: 0x00, mask: 0x00, byte: 0})
  const [frontCamera, setFrontCamera] = useState<CanMessage>({canId: 0x00, mask: 0x00, byte: 0})

  const handleSave = () => {
    const canConfig: CanConfig = {
      reverse,
      frontCamera
    }
    setSettings('canbus', true)
    setSettings('canConfig', canConfig)
    setOpenCan(false)
  }

  useEffect(() => {
    console.log(settings.canConfig)
    if(settings.canConfig?.reverse) {
      setReverse(settings.canConfig.reverse)
    }
    const front = settings.canConfig?.frontCamera ?? settings.canConfig?.lights
    if(front) setFrontCamera(front)
  }, [settings]);

  return (
    <Grid container spacing={2}>
        <Grid xs={12}>
          <Typography>REVERSE</Typography>
        </Grid>
      <Grid xs={4}>
        <TextField
          id="outlined-controlled"
          label="CAN ID"
          value={reverse.canId}
          type={'number'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setReverse({...reverse, canId: parseInt(event.target.value)})
          }}
        />
      </Grid>
      <Grid xs={4}>
        <TextField
          id="outlined-controlled"
          label="MASK"
          value={reverse.mask}
          type={'number'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setReverse({...reverse, mask: parseInt(event.target.value)})
          }}
        />
      </Grid>
      <Grid xs={4}>
        <TextField
          id="outlined-controlled"
          label="BYTE"
          value={reverse.byte}
          type={'number'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setReverse({...reverse, byte: parseInt(event.target.value)})
          }}
        />
      </Grid>
      <Grid xs={12}>
        <Typography>FRONT CAMERA</Typography>
      </Grid>
      <Grid xs={4}>
        <TextField
          id="outlined-controlled"
          label="CAN ID"
          value={frontCamera.canId}
          type={'number'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setFrontCamera({...frontCamera, canId: parseInt(event.target.value)})
          }}
        />
      </Grid>
      <Grid xs={4}>
        <TextField
          id="outlined-controlled"
          label="MASK"
          value={frontCamera.mask}
          type={'number'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setFrontCamera({...frontCamera, mask: parseInt(event.target.value)})
          }}
        />
      </Grid>
      <Grid xs={4}>
        <TextField
          id="outlined-controlled"
          label="BYTE"
          value={frontCamera.byte}
          type={'number'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setFrontCamera({...frontCamera, byte: parseInt(event.target.value)})
          }}
        />
      </Grid>
      <Button onClick={() => handleSave()}>SAVE</Button>
    </Grid>
  )
}
