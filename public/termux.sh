#!/usr/bin/env bash
# Runix Android / Termux Installer
set -e
echo "[runix] Installing Runix Terminal for Android / Termux..."
pkg update -y && pkg install -y nodejs curl
npm install -g @runix/terminal
echo "[runix] Ready! Type 'runix' to launch."
