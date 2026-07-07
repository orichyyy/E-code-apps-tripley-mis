<#
Starts optional development-only integration services for adapter tests.

The base system does not require Redis or RabbitMQ for normal local startup.
Use this script only when you want to run optional Docker-backed adapter tests.

Default images are official Alpine variants to keep download size and runtime
resource usage low:
- Redis: redis:8.8.0-alpine
- RabbitMQ: rabbitmq:4.3.2-alpine

Examples:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1 -RedisOnly
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1 -RabbitMqOnly

After startup, run:
  $env:REDIS_URL = "redis://127.0.0.1:6379"
  $env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
  pnpm test:optional-integrations
#>

param(
  [string]$RedisImage = "redis:8.8.0-alpine",
  [string]$RabbitMqImage = "rabbitmq:4.3.2-alpine",
  [string]$RedisContainer = "tripley-redis-dev",
  [string]$RabbitMqContainer = "tripley-rabbitmq-dev",
  [int]$RedisPort = 6379,
  [int]$RabbitMqPort = 5672,
  [switch]$RedisOnly,
  [switch]$RabbitMqOnly
)

$ErrorActionPreference = "Stop"

function Test-DockerAvailable {
  docker version | Out-Null
}

function Start-ContainerIfNeeded {
  param(
    [string]$Name,
    [string]$Image,
    [string[]]$RunArgs
  )

  $existing = docker ps -a --filter "name=^/$Name$" --format "{{.Names}}"
  if ($existing -eq $Name) {
    $running = docker ps --filter "name=^/$Name$" --format "{{.Names}}"
    if ($running -eq $Name) {
      Write-Host "$Name is already running."
      return
    }
    Write-Host "Starting existing container $Name..."
    docker start $Name | Out-Null
    return
  }

  Write-Host "Pulling $Image if needed..."
  docker pull $Image | Out-Null
  Write-Host "Creating and starting $Name..."
  docker run @RunArgs | Out-Null
}

function Wait-ContainerCommand {
  param(
    [string]$Name,
    [string[]]$Command,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    docker exec $Name @Command *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "$Name is ready."
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "$Name did not become ready within $TimeoutSeconds seconds."
}

Test-DockerAvailable

if (-not $RabbitMqOnly) {
  Start-ContainerIfNeeded `
    -Name $RedisContainer `
    -Image $RedisImage `
    -RunArgs @(
      "--name", $RedisContainer,
      "--detach",
      "--publish", "$RedisPort`:6379",
      "--memory", "128m",
      "--restart", "unless-stopped",
      $RedisImage,
      "redis-server",
      "--save", "",
      "--appendonly", "no",
      "--maxmemory", "96mb",
      "--maxmemory-policy", "allkeys-lru"
    )
  Wait-ContainerCommand -Name $RedisContainer -Command @("redis-cli", "ping")
}

if (-not $RedisOnly) {
  Start-ContainerIfNeeded `
    -Name $RabbitMqContainer `
    -Image $RabbitMqImage `
    -RunArgs @(
      "--name", $RabbitMqContainer,
      "--detach",
      "--publish", "$RabbitMqPort`:5672",
      "--memory", "384m",
      "--env", "RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS=+S 1:1",
      "--restart", "unless-stopped",
      $RabbitMqImage
    )
  Wait-ContainerCommand -Name $RabbitMqContainer -Command @("rabbitmq-diagnostics", "-q", "ping")
}

Write-Host ""
Write-Host "Optional integration services are ready or starting:"
if (-not $RabbitMqOnly) {
  Write-Host "  REDIS_URL=redis://127.0.0.1:$RedisPort"
}
if (-not $RedisOnly) {
  Write-Host "  RABBITMQ_URL=amqp://guest:guest@127.0.0.1:$RabbitMqPort"
}
Write-Host ""
Write-Host "Stop containers when not needed:"
Write-Host "  docker stop $RedisContainer $RabbitMqContainer"
