# Install DiscordRP to Windows Startup (hidden, no console window)
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistExe = Join-Path $ProjectRoot "dist\DiscordRP.exe"
$ConfigSrc = Join-Path $ProjectRoot "config.json"
$Startup = [Environment]::GetFolderPath("Startup")

$InstallDir = Join-Path $env:LOCALAPPDATA "DiscordRP"
$InstalledExe = Join-Path $InstallDir "DiscordRP.exe"
$InstalledConfig = Join-Path $InstallDir "config.json"
$LogFile = Join-Path $InstallDir "discordrp.log"
$VbsPath = Join-Path $Startup "DiscordRP.vbs"

if (-not (Test-Path $DistExe)) {
    Write-Host "dist\DiscordRP.exe not found. Run: npm run build" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ConfigSrc)) {
    Write-Host "config.json missing. Add your Discord Application ID first." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# Stop any existing instance so we can overwrite
Get-Process -Name "DiscordRP" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Copy-Item -Path $DistExe -Destination $InstalledExe -Force
Copy-Item -Path $ConfigSrc -Destination $InstalledConfig -Force
Copy-Item -Path $ConfigSrc -Destination (Join-Path $ProjectRoot "dist\config.json") -Force

# Remove old Startup exe copies (console window was easy to close / kill the process)
Remove-Item -Path (Join-Path $Startup "DiscordRP.exe") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $Startup "config.json") -Force -ErrorAction SilentlyContinue

# Hidden launcher — WindowStyle 0 = hide console
$vbs = @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$InstallDir"
sh.Run """$InstalledExe""", 0, False
"@
Set-Content -Path $VbsPath -Value $vbs -Encoding ASCII

Write-Host "Installed:" -ForegroundColor Green
Write-Host "  App:     $InstalledExe"
Write-Host "  Config:  $InstalledConfig"
Write-Host "  Startup: $VbsPath"
Write-Host "  Logs:    $LogFile"
Write-Host ""
Write-Host "Starting hidden in the background..."

Start-Process -FilePath "wscript.exe" -ArgumentList "`"$VbsPath`""

Start-Sleep -Seconds 2
try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:3847/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "Helper is up: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "Helper did not respond yet. Check $LogFile if presence never appears." -ForegroundColor Yellow
}

Write-Host "Done. It will also start hidden on each login."
