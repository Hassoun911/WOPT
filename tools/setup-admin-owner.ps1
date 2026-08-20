$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$pushServer = Join-Path $repoRoot 'push-server'
$workerUrl = 'https://wopt-prayer-push.wopt-windsor.workers.dev'

function SecureToPlain([Security.SecureString]$secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function New-RandomSecret([int]$bytes = 32) {
  $buffer = New-Object byte[] $bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+','-').Replace('/','_')
}

Write-Host ''
Write-Host 'Hassoun Admin Owner Setup' -ForegroundColor Cyan
Write-Host 'This creates the first owner account securely.' -ForegroundColor Gray
Write-Host ''

if (-not (Test-Path $pushServer)) { throw "push-server folder not found: $pushServer" }
Set-Location $pushServer

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is required.' }

if (-not (Test-Path (Join-Path $pushServer 'node_modules'))) {
  Write-Host 'Installing Worker tools...' -ForegroundColor Yellow
  npm.cmd ci --ignore-scripts --no-audit --no-fund
}

Write-Host 'Checking Cloudflare login...' -ForegroundColor Yellow
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$whoami = (& npx.cmd wrangler whoami 2>&1 | Out-String)
$whoamiExit = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction

if ($whoamiExit -ne 0 -or $whoami -match 'not authenticated|not logged in|login required') {
  Write-Host 'A Cloudflare browser login will open. Approve it, then return here.' -ForegroundColor Yellow
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & npx.cmd wrangler login
  $loginExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorAction
  if ($loginExit -ne 0) { throw 'Cloudflare login failed.' }
} else {
  Write-Host 'Cloudflare login is active.' -ForegroundColor Green
}

$username = Read-Host 'Owner username [hassoun911]'
if ([string]::IsNullOrWhiteSpace($username)) { $username = 'hassoun911' }
$email = Read-Host 'Owner email [windsor.hassoun@gmail.com]'
if ([string]::IsNullOrWhiteSpace($email)) { $email = 'windsor.hassoun@gmail.com' }
$displayName = Read-Host 'Display name [Sam Hassoun]'
if ([string]::IsNullOrWhiteSpace($displayName)) { $displayName = 'Sam Hassoun' }

$passwordSecure = Read-Host 'Owner password (input hidden)' -AsSecureString
$confirmSecure = Read-Host 'Confirm owner password (input hidden)' -AsSecureString
$password = SecureToPlain $passwordSecure
$confirm = SecureToPlain $confirmSecure
if ($password -ne $confirm) { throw 'Passwords do not match.' }
if ($password.Length -lt 10) { throw 'Password must be at least 10 characters.' }

$bootstrapKey = New-RandomSecret 40
Write-Host 'Installing one-time bootstrap secret in the Worker...' -ForegroundColor Yellow
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$bootstrapKey | & npx.cmd wrangler secret put ADMIN_BOOTSTRAP_KEY
$secretExit = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
if ($secretExit -ne 0) { throw 'Unable to install ADMIN_BOOTSTRAP_KEY.' }

$body = @{
  username = $username.Trim().ToLowerInvariant()
  email = $email.Trim().ToLowerInvariant()
  displayName = $displayName.Trim()
  password = $password
} | ConvertTo-Json -Compress

Write-Host 'Creating first owner account...' -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "$workerUrl/admin/bootstrap" -Method Post -Headers @{ 'X-Admin-Bootstrap-Key' = $bootstrapKey } -ContentType 'application/json' -Body $body
} catch {
  $message = $_.Exception.Message
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $message = $_.ErrorDetails.Message }
  throw "Owner creation failed: $message"
} finally {
  $password = $null
  $confirm = $null
  $body = $null
}

if (-not $result.ok) { throw 'Worker did not confirm owner creation.' }

Write-Host ''
Write-Host 'OWNER CREATED SUCCESSFULLY' -ForegroundColor Green
Write-Host "Login: $email" -ForegroundColor Green
Write-Host 'Role: owner' -ForegroundColor Green
Write-Host 'CRM: https://admin.hassoun.app' -ForegroundColor Green
Write-Host ''
Write-Host 'The bootstrap endpoint automatically refuses another first-owner creation once an admin exists.' -ForegroundColor Gray
