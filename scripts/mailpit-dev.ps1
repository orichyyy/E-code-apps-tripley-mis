<#
.SYNOPSIS
Starts or stops the disposable Mailpit instance used by SMTP compatibility tests.

.DESCRIPTION
The pinned Mailpit container exposes SMTP and its diagnostic web UI only on
127.0.0.1. It is optional, uses an isolated disposable volume, and is limited
to 128 MB. The normal development server and push CI do not require it.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mailpit-dev.ps1
  pnpm test:smtp-integration
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mailpit-dev.ps1 -Action Stop
#>
[CmdletBinding()]
param(
  [ValidateSet("Start", "Stop", "Status")]
  [string]$Action = "Start",
  [switch]$PreserveData
)

$ErrorActionPreference = "Stop"
$image = "axllent/mailpit:v1.30.0"
$container = "web-admin-base-mailpit"
$volume = "web-admin-base-mailpit-data"
$certificateDirectory = (Resolve-Path (Join-Path $PSScriptRoot "mailpit")).Path

function Assert-DockerReady {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running. Start it and run this script again."
  }
}

function Stop-Mailpit {
  $existingContainer = docker ps --all --quiet --filter "name=^/$container$"
  if ($existingContainer) { docker rm --force $container | Out-Null }
  if (-not $PreserveData) {
    $existingVolume = docker volume ls --quiet --filter "name=^$volume$"
    if ($existingVolume) { docker volume rm $volume | Out-Null }
  }
}

Assert-DockerReady
if ($Action -eq "Stop") {
  Stop-Mailpit
  Write-Host "Mailpit development container stopped."
  exit 0
}
if ($Action -eq "Status") {
  docker ps --all --filter "name=^/$container$"
  exit $LASTEXITCODE
}

Stop-Mailpit
docker volume create $volume | Out-Null
docker run --detach `
  --name $container `
  --memory 128m `
  --memory-swap 128m `
  --publish "127.0.0.1:1025:1025" `
  --publish "127.0.0.1:8025:8025" `
  --volume "${volume}:/data" `
  --volume "${certificateDirectory}:/certs:ro" `
  --env "MP_DATABASE=/data/mailpit.db" `
  --env "MP_MAX_MESSAGES=100" `
  --env "MP_SMTP_TLS_CERT=/certs/cert.pem" `
  --env "MP_SMTP_TLS_KEY=/certs/key.pem" `
  --env "MP_SMTP_REQUIRE_STARTTLS=true" `
  $image | Out-Null

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 1
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8025/livez" -TimeoutSec 2 -UseBasicParsing | Out-Null
    break
  } catch {
    if ((Get-Date) -ge $deadline) {
      docker logs $container
      throw "Mailpit did not become ready within 45 seconds."
    }
  }
} while ($true)

Write-Host "Mailpit SMTP is ready at 127.0.0.1:1025."
Write-Host "Mailpit inbox: http://127.0.0.1:8025"
Write-Host "Run: pnpm test:smtp-integration"
