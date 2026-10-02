# Runix Terminal Windows PowerShell Installer
Write-Host "[runix] Installing Runix Terminal CLI v1.0.0..." -ForegroundColor Cyan
if (Get-Command npm -ErrorAction SilentlyContinue) {
  Write-Host "[runix] Detected npm. Installing @runix/terminal globally..." -ForegroundColor Green
  npm install -g @runix/terminal
} else {
  $installDir = "$HOME\.runix\bin"
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  Invoke-WebRequest -Uri "https://console.runix.in/releases/windows/RunixTerminal-Setup-1.0.0.exe" -OutFile "$installDir\RunixTerminal-Setup-1.0.0.exe"
  Write-Host "[runix] Downloaded installer to $installDir\RunixTerminal-Setup-1.0.0.exe" -ForegroundColor Green
  Start-Process "$installDir\RunixTerminal-Setup-1.0.0.exe" -Wait
}
Write-Host "[runix] Installation complete! Run 'runix login' to connect your terminal." -ForegroundColor Green
