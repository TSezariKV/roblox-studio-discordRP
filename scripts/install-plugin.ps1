# Copy the Studio plugin into Roblox's Plugins folder
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PluginSrc = Join-Path $ProjectRoot "plugin\StudioDiscordPresence.lua"
$PluginsDir = Join-Path $env:LOCALAPPDATA "Roblox\Plugins"
$PluginDest = Join-Path $PluginsDir "StudioDiscordPresence.lua"

if (-not (Test-Path $PluginSrc)) {
    Write-Host "Plugin source not found: $PluginSrc" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $PluginsDir -Force | Out-Null
Copy-Item -Path $PluginSrc -Destination $PluginDest -Force

Write-Host "Installed Studio plugin to:" -ForegroundColor Green
Write-Host "  $PluginDest"
Write-Host "Restart Roblox Studio if it is already open."
