#!/usr/bin/env bash
# Runix Terminal CLI Installer
set -e
echo "[runix] Installing Runix Terminal CLI v1.0.0..."
if command -v npm >/dev/null 2>&1; then
  echo "[runix] Detected npm. Installing @runix/terminal globally..."
  npm install -g @runix/terminal
elif command -v curl >/dev/null 2>&1; then
  INSTALL_DIR="${HOME}/.runix/bin"
  mkdir -p "${INSTALL_DIR}"
  curl -fsSL "https://console.runix.in/releases/cli/runix-cli-1.0.0.tar.gz" -o "/tmp/runix-cli.tar.gz"
  tar -xzf "/tmp/runix-cli.tar.gz" -C "${INSTALL_DIR}"
  echo "export PATH=\"\$PATH:${INSTALL_DIR}\"" >> "${HOME}/.bashrc"
  echo "[runix] Successfully installed to ${INSTALL_DIR}/runix"
fi
echo "[runix] Run 'runix login' to authenticate your terminal session."
