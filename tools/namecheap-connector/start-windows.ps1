$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Install Node.js 22 LTS, then run this file again.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host ''
  Write-Host 'Created .env. Open it and add your Namecheap username/API key and a long CONNECTOR_BEARER_TOKEN.' -ForegroundColor Yellow
  Write-Host 'Do not share the API key in chat and do not commit .env.' -ForegroundColor Yellow
  notepad '.env'
  exit 0
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing connector packages...'
  npm install
}

Write-Host 'Starting Hassoun Namecheap connector...'
npm run dev
