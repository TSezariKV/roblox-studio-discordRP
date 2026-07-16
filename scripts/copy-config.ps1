# Copy config.json next to the built exe
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ConfigSrc = Join-Path $ProjectRoot "config.json"
$DistDir = Join-Path $ProjectRoot "dist"

if (-not (Test-Path $ConfigSrc)) {
    Write-Host "config.json not found - create it before building." -ForegroundColor Yellow
    exit 0
}

New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
Copy-Item -Path $ConfigSrc -Destination (Join-Path $DistDir "config.json") -Force
Write-Host 'Copied config.json to dist\'
