<#
.SYNOPSIS
Starts the Web Admin Base System locally with SQLite.

.DESCRIPTION
This script is the easiest way to run the base system for manual UI acceptance.
It configures environment variables for the current PowerShell process, applies
SQLite migrations, seeds the default administrator, and starts API, Web, and
Worker development processes through the existing `pnpm dev` script.

The script does not enable optional integrations such as Redis, RabbitMQ,
S3-compatible storage, SMS, or real outbound webhook delivery.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-dev.ps1

.EXAMPLE
.\scripts\start-local-dev.ps1 -AdminPassword "ChangeMe1234" -WebPort 5174

.NOTES
Open the printed Web URL in your browser after the dev servers are ready.
Press Ctrl+C in this terminal to stop all local processes.
#>
[CmdletBinding()]
param(
  # Seeded administrator password used when initializing a fresh local database.
  [string]$AdminPassword = "change-me-local-1",

  # SQLite database URL. Keep this relative path when running from the repo root.
  [string]$DatabaseUrl = "file:./data/web-admin-base.sqlite",

  # Local file-storage root for uploads, previews, exports, and cleanup tasks.
  [string]$FileStorageRoot = "./data/files",

  # API port used by apps/api and the Vite /api proxy.
  [int]$ApiPort = 3000,

  # Web port used by the Vite development server.
  [int]$WebPort = 5173,

  # Positive value enables continuous worker polling for queue/scheduler tasks.
  [int]$WorkerPollIntervalMs = 1000,

  # Skip dependency installation check. Useful after dependencies are already installed.
  [switch]$SkipInstall,

  # Skip seed initialization. Useful when reusing an existing local database.
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Pnpm {
  param(
    [string]$Label,
    [string[]]$Arguments
  )

  Write-Section $Label
  & pnpm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm was not found on PATH. Install pnpm first, then rerun this script."
}

# These variables are scoped to this PowerShell process and child processes.
# They do not modify your machine-level environment.
$env:BACKEND_CORE_STORE = "database"
$env:DATABASE_DIALECT = "sqlite"
$env:DATABASE_URL = $DatabaseUrl
$env:FILE_STORAGE_ROOT = $FileStorageRoot
$env:FILE_MAX_SIZE_BYTES = "52428800"
$env:API_PORT = "$ApiPort"
$env:WEB_PORT = "$WebPort"
$env:VITE_API_PROXY_TARGET = "http://localhost:$ApiPort"
$env:WORKER_POLL_INTERVAL_MS = "$WorkerPollIntervalMs"
$env:WEB_ADMIN_SEED_ADMIN_PASSWORD = $AdminPassword

Write-Section "Local startup configuration"
Write-Host "Repository:       $repoRoot"
Write-Host "Database:         $env:DATABASE_URL"
Write-Host "File storage:     $env:FILE_STORAGE_ROOT"
Write-Host "API URL:          http://localhost:$ApiPort"
Write-Host "Web URL:          http://localhost:$WebPort/login"
Write-Host "OpenAPI URL:      http://localhost:$ApiPort/api/openapi.json"
Write-Host "Admin username:   admin"
Write-Host "Admin password:   $AdminPassword"
Write-Host "Worker polling:   $WorkerPollIntervalMs ms"

if (-not $SkipInstall) {
  if (Test-Path (Join-Path $repoRoot "node_modules")) {
    Write-Section "Dependencies"
    Write-Host "node_modules already exists; skipping pnpm install."
  } else {
    Invoke-Pnpm -Label "Installing dependencies" -Arguments @("install")
  }
}

Invoke-Pnpm -Label "Applying SQLite migrations" -Arguments @("db:migrate:sqlite")

if (-not $SkipSeed) {
  Invoke-Pnpm -Label "Seeding default administrator" -Arguments @("seed")
}

Write-Section "Starting API, Web, and Worker"
Write-Host "Open this URL after Vite prints its ready message:"
Write-Host "  http://localhost:$WebPort/login" -ForegroundColor Green
Write-Host ""
Write-Host "Login with:"
Write-Host "  Username: admin"
Write-Host "  Password: $AdminPassword"
Write-Host ""
Write-Host "Press Ctrl+C in this terminal to stop the local system."
Write-Host ""

& pnpm dev
if ($LASTEXITCODE -ne 0) {
  throw "pnpm dev exited with code $LASTEXITCODE."
}
