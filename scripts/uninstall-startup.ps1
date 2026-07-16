# Remove DiscordRP from Startup and stop the process
$ErrorActionPreference = "SilentlyContinue"

$Startup = [Environment]::GetFolderPath("Startup")
$InstallDir = Join-Path $env:LOCALAPPDATA "DiscordRP"

Get-Process -Name "DiscordRP" -ErrorAction SilentlyContinue | Stop-Process -Force

Remove-Item -Path (Join-Path $Startup "DiscordRP.vbs") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $Startup "DiscordRP.exe") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $Startup "config.json") -Force -ErrorAction SilentlyContinue

Write-Host "Stopped DiscordRP and removed Startup launcher."
Write-Host "App files left in: $InstallDir (delete that folder manually if you want a full uninstall)."
