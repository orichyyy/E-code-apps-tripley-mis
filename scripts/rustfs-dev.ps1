<#
.SYNOPSIS
Starts or stops the disposable RustFS instance used by S3 compatibility tests.

.DESCRIPTION
This script intentionally exposes only the S3 API on 127.0.0.1. The management
console is disabled and no port for it is published. The pinned beta image is a
test backend only; it is not a production provider selection.

The default Stop action removes both the container and its isolated Docker
volume. Use -PreserveData only while diagnosing a compatibility failure.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1
  pnpm test:s3-integration
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1 -Action Stop
#>
[CmdletBinding()]
param(
  [ValidateSet("Start", "Stop", "Status")]
  [string]$Action = "Start",
  [switch]$PreserveData
)

$ErrorActionPreference = "Stop"
$image = "rustfs/rustfs:1.0.0-beta.8"
$container = "web-admin-base-rustfs"
$volume = "web-admin-base-rustfs-data"
$accessKey = "webadmin"
$secretKey = "webadmin-development-secret"
$endpoint = "http://127.0.0.1:9000"

function Assert-DockerReady {
  try {
    docker info *> $null
  } catch {
    # The explicit message below is more useful than Docker's named-pipe error.
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running. Start it and run this script again."
  }
}

function Stop-RustFS {
  $existingContainer = docker ps --all --quiet --filter "name=^/$container$"
  if ($existingContainer) {
    docker rm --force $container | Out-Null
  }
  if (-not $PreserveData) {
    $existingVolume = docker volume ls --quiet --filter "name=^$volume$"
    if ($existingVolume) {
      docker volume rm $volume | Out-Null
    }
  }
}

Assert-DockerReady

if ($Action -eq "Stop") {
  Stop-RustFS
  Write-Host "RustFS development container stopped."
  exit 0
}

if ($Action -eq "Status") {
  docker ps --all --filter "name=^/$container$"
  exit $LASTEXITCODE
}

# Recreate the disposable instance so every test run starts from known state.
Stop-RustFS
docker volume create $volume | Out-Null
docker run --detach `
  --name $container `
  --memory 256m `
  --memory-swap 256m `
  --publish "127.0.0.1:9000:9000" `
  --volume "${volume}:/data" `
  --env "RUSTFS_ACCESS_KEY=$accessKey" `
  --env "RUSTFS_SECRET_KEY=$secretKey" `
  --env "RUSTFS_CONSOLE_ENABLE=false" `
  --env "RUSTFS_OBS_LOGGER_LEVEL=warn" `
  $image | Out-Null

$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep -Seconds 1
  try {
    # An authenticated error is sufficient here: it proves the S3 listener is ready.
    Invoke-WebRequest -Uri $endpoint -Method Head -TimeoutSec 2 -UseBasicParsing | Out-Null
    break
  } catch {
    if ($null -ne $_.Exception.Response) {
      break
    }
    if ((Get-Date) -ge $deadline) {
      docker logs $container
      throw "RustFS did not become ready within 60 seconds."
    }
  }
} while ($true)

Write-Host "RustFS S3 API is ready at $endpoint (Console is disabled)."
Write-Host "Run: pnpm test:s3-integration"
Write-Host "Stop: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1 -Action Stop"
