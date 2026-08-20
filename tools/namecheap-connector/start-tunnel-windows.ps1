$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host 'Installing Cloudflare Tunnel client...'
    winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
  } else {
    Write-Host 'cloudflared is not installed and winget was not found.' -ForegroundColor Red
    Write-Host 'Install cloudflared from Cloudflare, then run this file again.' -ForegroundColor Yellow
    exit 1
  }
}

Write-Host 'Starting temporary HTTPS tunnel to the local Namecheap connector...'
Write-Host 'Keep this window open while testing.' -ForegroundColor Yellow
cloudflared tunnel --url http://127.0.0.1:8788
