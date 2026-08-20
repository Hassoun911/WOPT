$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$pushServer = Join-Path $repoRoot 'push-server'
$email = 'windsor.hassoun@gmail.com'
$iterations = 100000

function SecureToPlain([Security.SecureString]$secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function To-Base64Url([byte[]]$bytes) {
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

if (-not (Test-Path $pushServer)) { throw "push-server folder not found: $pushServer" }
Set-Location $pushServer

Write-Host ''
Write-Host 'Hassoun Owner Password Reset' -ForegroundColor Cyan
Write-Host "Account: $email" -ForegroundColor Gray
Write-Host ''

$first = Read-Host 'New password (hidden)' -AsSecureString
$second = Read-Host 'Confirm new password (hidden)' -AsSecureString
$password = SecureToPlain $first
$confirm = SecureToPlain $second

if ($password -ne $confirm) { throw 'Passwords do not match.' }
if ($password.Length -lt 10) { throw 'Password must be at least 10 characters.' }
if ($password.Length -gt 200) { throw 'Password must be 200 characters or fewer.' }

$saltBytes = New-Object byte[] 24
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($saltBytes) } finally { $rng.Dispose() }
$salt = To-Base64Url $saltBytes

$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes(
  $password,
  [Text.Encoding]::UTF8.GetBytes($salt),
  $iterations,
  [Security.Cryptography.HashAlgorithmName]::SHA256
)
try { $digestBytes = $kdf.GetBytes(32) } finally { $kdf.Dispose() }
$digest = To-Base64Url $digestBytes

# Values here are generated from restricted alphabets; email is fixed by this script.
$sql = "UPDATE admin_users SET password_hash='$digest', password_salt='$salt', password_iterations=$iterations, must_change_password=0, updated_at=CURRENT_TIMESTAMP WHERE email='$email' COLLATE NOCASE; UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_user_id=(SELECT id FROM admin_users WHERE email='$email' COLLATE NOCASE) AND revoked_at IS NULL; SELECT email, role, status, password_iterations FROM admin_users WHERE email='$email' COLLATE NOCASE;"

Write-Host 'Updating owner password in Cloudflare D1...' -ForegroundColor Yellow
& npx.cmd wrangler d1 execute wopt-prayer-push --remote --command $sql
if ($LASTEXITCODE -ne 0) { throw 'D1 password reset failed.' }

$password = $null
$confirm = $null
$sql = $null

Write-Host ''
Write-Host 'PASSWORD RESET COMPLETE' -ForegroundColor Green
Write-Host 'Sign in at: https://admin.hassoun.app' -ForegroundColor Green
Write-Host "Login: $email" -ForegroundColor Green
