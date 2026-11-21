# React CarPlay fork

Based on [Rhys Morgan's React CarPlay](https://github.com/rhysmorgan134/react-carplay) and [node-CarPlay](https://github.com/rhysmorgan134/node-CarPlay).

This fork adds a clock/connection screen, a reconnect action, grouped settings, and an opt-in debug console. Reverse and front cameras have independent device selections and CAN triggers. Reverse takes priority if both triggers are active.

## Develop and verify

Use Node.js 22 or 24 and Git. From your own fork's checkout:

```sh
npm ci
npm test
npm run build
npm run dev
```

UI changes update in development. Changes to Electron's main process require restarting the app. Do not copy `node_modules` between Windows and the Pi; install dependencies on each target.

`npm run build` runs both TypeScript checks before bundling. GitHub CI performs a clean installation, tests, and this full build on Windows and Linux. Packaging commands are listed in `package.json`; build Pi binaries on the matching Linux/ARM environment.

## Raspberry Pi / Linux

The adapter uses USB; CAN integration separately requires a working SocketCAN `can0` interface on the vehicle's correct bus and bitrate. The app does not configure or transmit vehicle CAN frames. Enable CAN under Advanced, then configure the trigger's CAN ID, mask, and zero-based payload byte. A mask of zero leaves that trigger unused. The app releases camera triggers after 1.5 seconds without fresh matching frames.

Select the reverse and front camera devices under Connection. Earlier `lights` mappings migrate to the front-camera trigger. Saving settings updates the app without relaunching it; adapter setting changes restart the CarPlay session. PiMost remains unavailable in this build.

After building your fork's AppImage, use:

```sh
bash setup-pi.sh /absolute/path/to/your-fork.AppImage
```

The script installs the supplied file and creates per-user autostart and USB permissions. It does not download the upstream release. Install your distribution's AppImage/FUSE dependencies if required. Reconnect the adapter after applying USB permissions; a new group membership may require signing out and back in.

## Windows

Windows supports UI development without SocketCAN. Actual Carlinkit USB access requires a compatible driver and a device that Windows can start. WinUSB installation alone does not resolve Device Manager Code 10/43. This setup's CPC200-CCPA connection remains unverified on Windows.

## Debug console

Recording is off by default and resets to off when the renderer restarts. Start recording before reproducing a problem, then stop and export the filtered entries as JSONL. Recording continues across tabs until stopped; Pause view freezes only the display. At most 1,500 entries are retained, updates are batched, and binary payloads are summarised rather than copied in full.

Sources include app, main process, CarPlay worker, connection, media, and video errors. Future decoded navigation events can use:

```ts
import { logDebug } from './store/debugStore' // adjust relative path as needed
logDebug('info', 'navigation', 'Route update', decodedNavigation)
```

Navigation packet decoding is not implemented by this UI change. Log exports contain captured settings/messages and are saved locally when requested.

## Vendored audio dependency

`vendor/pcm-ringbuf-player-0.0.5-local.2.tgz` is required by the lockfile and must be committed. Its corresponding source and original MIT license are in `vendor/pcm-ringbuf-player`. It is based on upstream commit `0dd11df4cfb207979fea9111259f87b1118347d7`, with an explicit ring-buffer type and a public `getRawBuffer()` accessor. Rebuild using the source package's build script and `npm pack`; do not silently change the tarball referenced by a published lockfile.

## Validation status

Local Windows typechecks, bundle builds and mocked CAN/reconnect/debug regression tests are automated. These do not establish hardware confirmation. Before declaring a working Pi release, verify USB/phone pairing, leaving and returning with the phone, audio/microphone, each camera trigger, simultaneous-trigger priority, and trigger release after CAN/USB loss on the actual Pi/car.

Generated bundles, dependencies, local backups, and log exports are excluded by `.gitignore`. No GitHub remote for a personal fork is configured automatically, and nothing is published by the local setup.
