#requires -Version 5.1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker Desktop is required for this smoke test."
    exit 1
}
try {
    docker compose up --build -d
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $ready = $false
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ready) { docker compose logs; throw "API did not become healthy." }
    Write-Host "Docker smoke test passed." -ForegroundColor Green
} finally {
    docker compose down --volumes --remove-orphans
}
