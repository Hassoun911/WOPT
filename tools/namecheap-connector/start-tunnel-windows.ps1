$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Find-Cloudflared {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "$env:ProgramFiles\Cloudflare\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }

  $wingetPackages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $wingetPackages) {
    $found = Get-ChildItem -Path $wingetPackages -Filter cloudflared.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }

  return $null
}

$cloudflared = Find-Cloudflared
if (-not $cloudflared) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host 'Installing Cloudflare Tunnel client...'
    winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
    Start-Sleep -Seconds 2
    $cloudflared = Find-Cloudflared
  }
}

if (-not $cloudflared) {
  Write-Host 'cloudflared is installed or was requested, but Windows still cannot locate cloudflared.exe.' -ForegroundColor Red
  Write-Host 'Close all PowerShell windows, open a new PowerShell window, and run this script again.' -ForegroundColor Yellow
  exit 1
}

Write-Host "Using cloudflared: $cloudflared" -ForegroundColor Green
Write-Host 'Starting temporary HTTPS tunnel to the local Namecheap connector...'
Write-Host 'Keep this window open while testing.' -ForegroundColor Yellow
& $cloudflared tunnel --url http://127.0.0.1:8788
