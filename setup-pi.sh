#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo "Run this installer on the Raspberry Pi / Linux target." >&2
  exit 1
fi
if [[ "$EUID" -eq 0 ]]; then
  echo "Run as your normal desktop user; sudo will be requested for USB permissions." >&2
  exit 1
fi
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: ./setup-pi.sh /absolute/path/to/your-fork.AppImage" >&2
  echo "Build your fork first. This script never downloads a stock upstream release." >&2
  exit 1
fi

source_image="$(realpath -- "$1")"
target_dir="$HOME/.local/bin"
target_image="$target_dir/Carplay.AppImage"
autostart_dir="$HOME/.config/autostart"
mkdir -p -- "$target_dir" "$autostart_dir"
if [[ "$source_image" != "$target_image" ]]; then
  install -m 755 -- "$source_image" "$target_image"
else
  chmod +x -- "$target_image"
fi

if ! getent group plugdev >/dev/null; then sudo groupadd --system plugdev; fi
sudo usermod -aG plugdev "$(id -un)"
printf '%s\n' 'SUBSYSTEM=="usb", ATTR{idVendor}=="1314", ATTR{idProduct}=="152*", MODE="0660", GROUP="plugdev"' |
  sudo tee /etc/udev/rules.d/52-nodecarplay.rules >/dev/null
sudo udevadm control --reload-rules

cat > "$autostart_dir/carplay.desktop" <<EOF
[Desktop Entry]
Name=CarPlay
Type=Application
Exec="$target_image"
Terminal=false
EOF

echo "Installed your AppImage to $target_image"
echo "Reconnect the adapter. Sign out/in if plugdev membership was newly added."
echo "Install the distribution's AppImage/FUSE dependency if the AppImage needs it."
