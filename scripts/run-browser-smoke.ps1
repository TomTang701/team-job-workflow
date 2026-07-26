#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is required for the browser smoke test."
}

if ($env:OS -eq "Windows_NT" -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;$env:Path"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required for the browser smoke test."
}

$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
}
if ($null -eq $pnpm) {
    throw "pnpm is required for the browser smoke test."
}

function Test-HttpReady {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [int]$ExpectedStatus = 200
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 2
        return $response.StatusCode -eq $ExpectedStatus
    } catch {
        return $false
    }
}

try {
    docker compose up --build -d
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose startup failed with exit code $LASTEXITCODE."
    }

    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        if ((Test-HttpReady -Uri "http://127.0.0.1:8000/health") -and (Test-HttpReady -Uri "http://127.0.0.1:8080/")) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) {
        docker compose logs
        throw "Compose API and web UI did not become ready."
    }

    Push-Location -LiteralPath (Join-Path $root "frontend")
    try {
        & $pnpm.Source exec playwright test --config playwright.config.ts
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright browser smoke failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }

    Write-Host "Compose UI browser smoke test passed." -ForegroundColor Green
} finally {
    docker compose down --volumes --remove-orphans
}
