$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function SecureString-ToPlain([Security.SecureString]$secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ''
Write-Host 'Hassoun Namecheap Connector - One Click Setup' -ForegroundColor Cyan
Write-Host 'Your API key stays only on this PC in tools/namecheap-connector/.env.' -ForegroundColor DarkGray
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host 'Installing Node.js 22 LTS...'
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Write-Host 'Node.js was installed. Close this PowerShell window and run setup-all-windows.ps1 again.' -ForegroundColor Yellow
    exit 0
  }
  throw 'Node.js is required and winget is unavailable.'
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing connector packages...'
  npm install
}

if (-not (Test-Path '.env')) {
  $username = Read-Host 'Namecheap username'
  if ([string]::IsNullOrWhiteSpace($username)) { throw 'Namecheap username is required.' }

  $secureKey = Read-Host 'Namecheap API key (input is hidden)' -AsSecureString
  $apiKey = SecureString-ToPlain $secureKey
  if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'Namecheap API key is required.' }

  $bearerBytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($bearerBytes)
  $bearer = [Convert]::ToBase64String($bearerBytes).Replace('+','-').Replace('/','_').TrimEnd('=')

  $publicIp = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=text' -TimeoutSec 15).Trim()
  if ($publicIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw 'Unable to detect a valid public IPv4.' }

  @"
NAMECHEAP_API_USER=$username
NAMECHEAP_API_KEY=$apiKey
NAMECHEAP_USERNAME=$username
NAMECHEAP_CLIENT_IP=$publicIp
NAMECHEAP_ALLOWED_DOMAINS=hassoun.app
NAMECHEAP_USE_SANDBOX=false
CONNECTOR_BEARER_TOKEN=$bearer
PORT=8788
"@ | Set-Content -Encoding UTF8 '.env'

  Clear-Variable apiKey -ErrorAction SilentlyContinue
  Set-Clipboard -Value $publicIp
  Write-Host ''
  Write-Host "Namecheap whitelist IPv4: $publicIp" -ForegroundColor Green
  Write-Host 'The IP was copied to your clipboard.' -ForegroundColor Green
  Write-Host 'In Namecheap: Profile -> Tools -> API Access -> Whitelisted IPs -> add/paste this IP.' -ForegroundColor Yellow
  Write-Host ''
  Read-Host 'After you add the IP in Namecheap, press Enter here to continue'
} else {
  $envLines = Get-Content '.env'
  $ipLine = $envLines | Where-Object { $_ -like 'NAMECHEAP_CLIENT_IP=*' } | Select-Object -First 1
  if ($ipLine) {
    $publicIp = $ipLine.Substring('NAMECHEAP_CLIENT_IP='.Length)
    Set-Clipboard -Value $publicIp
    Write-Host "Configured Namecheap whitelist IPv4: $publicIp (copied to clipboard)" -ForegroundColor Green
  }
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host 'Installing Cloudflare Tunnel client...'
    winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
  } else {
    throw 'cloudflared is required and winget is unavailable.'
  }
}

Write-Host 'Starting Namecheap connector in a new PowerShell window...'
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'start-windows.ps1')
Start-Sleep -Seconds 4

Write-Host 'Starting secure Cloudflare tunnel in a second PowerShell window...'
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'start-tunnel-windows.ps1')

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Keep the connector and tunnel windows open while using the Namecheap connector.' -ForegroundColor Yellow
Write-Host 'When the tunnel window shows an https://...trycloudflare.com URL, copy that URL.' -ForegroundColor Cyan
