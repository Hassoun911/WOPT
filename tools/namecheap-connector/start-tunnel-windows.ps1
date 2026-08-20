$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Find-Cloudflared {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    (Join-Path $PSScriptRoot 'cloudflared.exe'),
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "$env:ProgramFiles\Cloudflare\cloudflared.exe",
    "$env:ProgramFiles\Cloudflare\Cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\Cloudflare\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe",
    "$env:LOCALAPPDATA\Programs\cloudflared\cloudflared.exe"
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
  $localExe = Join-Path $PSScriptRoot 'cloudflared.exe'
  $downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Write-Host 'cloudflared was not available in PATH. Downloading the official Cloudflare Windows binary...' -ForegroundColor Yellow
  Invoke-WebRequest -Uri $downloadUrl -OutFile $localExe -UseBasicParsing
  if (-not (Test-Path $localExe)) { throw 'Cloudflare Tunnel download failed.' }
  $cloudflared = $localExe
}

Write-Host "Using cloudflared: $cloudflared" -ForegroundColor Green
Write-Host 'Starting temporary HTTPS tunnel to the local Namecheap connector...'
Write-Host 'Keep this window open while testing.' -ForegroundColor Yellow
& $cloudflared tunnel --url http://127.0.0.1:8788
