#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$LocalOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$evidencePath = Join-Path $root "local_data\verification-evidence.json"
$python = Join-Path $root ".venv\Scripts\python.exe"

function Invoke-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "Running $Name..." -ForegroundColor Cyan
    try {
        & $Action | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "$Name failed with exit code $LASTEXITCODE."
            return $false
        }
        return $true
    } catch {
        Write-Warning "$Name failed: $($_.Exception.Message)"
        return $false
    }
}

if (-not (Test-Path -LiteralPath $python)) {
    throw "Expected Python virtual environment at $python."
}

$backendPassed = Invoke-Check -Name "backend tests" -Action {
    & $python -m pytest -q
}

if ($env:OS -eq "Windows_NT" -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;$env:Path"
}

$node = Get-Command node -ErrorAction SilentlyContinue
$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
}
$frontendPassed = $false
if ($null -eq $node -or $null -eq $pnpm) {
    Write-Warning "Node.js and pnpm are required; frontend verification cannot run."
} else {
    $frontendPath = Join-Path $root "frontend"
    Push-Location -LiteralPath $frontendPath
    try {
        $frontendPassed = Invoke-Check -Name "frontend tests and production build" -Action {
            & $pnpm.Source test
            if ($LASTEXITCODE -ne 0) { throw "Frontend tests failed with exit code $LASTEXITCODE." }
            & $pnpm.Source build
            if ($LASTEXITCODE -ne 0) { throw "Frontend build failed with exit code $LASTEXITCODE." }
        }
    } finally {
        Pop-Location
    }
}

$dockerPassed = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerPassed = Invoke-Check -Name "Docker Compose smoke test" -Action {
        & (Join-Path $PSScriptRoot "run-docker-smoke.ps1")
    }
} else {
    Write-Warning "Docker Desktop is not available; Docker smoke remains unverified."
}

$browserUiSmokePassed = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $browserUiSmokePassed = Invoke-Check -Name "Compose UI browser smoke test" -Action {
        & (Join-Path $PSScriptRoot "run-browser-smoke.ps1")
    }
} else {
    Write-Warning "Docker Desktop is not available; browser smoke remains unverified."
}

$ciPassed = $false
if (-not $LocalOnly -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    $repo = (git -C $root remote get-url origin 2>$null)
    $commit = (git -C $root rev-parse HEAD 2>$null)
    if ($repo -match "github\.com[:/](?<owner>[^/]+)/(?<name>[^/.]+)(\.git)?$") {
        $repoName = "$($Matches.owner)/$($Matches.name)"
        $runs = gh run list --repo $repoName --commit $commit --limit 1 --json status,conclusion | ConvertFrom-Json
        if ($runs.Count -eq 1 -and $runs[0].status -eq "completed" -and $runs[0].conclusion -eq "success") {
            $ciPassed = $true
        }
    }
}

$docsPassed = (Test-Path (Join-Path $root "README.md")) -and
    (Test-Path (Join-Path $root "docker-compose.yml")) -and
    (Test-Path (Join-Path $root ".github\workflows\ci.yml")) -and
    ((Get-Content -Raw (Join-Path $root "README.md")) -match "Sanitized demo")

$seedSource = Get-Content -Raw (Join-Path $root "tools\seed_demo.py")
$seedEmails = [regex]::Matches($seedSource, "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+") | ForEach-Object { $_.Value }
$sanitizedDemoVerified = $seedEmails.Count -gt 0 -and @($seedEmails | Where-Object { -not $_.EndsWith("@example.test") }).Count -eq 0

New-Item -ItemType Directory -Path (Split-Path -Parent $evidencePath) -Force | Out-Null
$evidence = [ordered]@{
    generated_at_utc = [DateTime]::UtcNow.ToString("o")
    generated_by = "scripts/record-verification-evidence.ps1"
    backend_tests_passed = $backendPassed
    frontend_tests_and_build_passed = $frontendPassed
    docker_smoke_passed = $dockerPassed
    browser_ui_smoke_passed = $browserUiSmokePassed
    ci_passed = $ciPassed
    documentation_complete = $docsPassed
    sanitized_demo_verified = $sanitizedDemoVerified
}
$evidence | ConvertTo-Json | Set-Content -LiteralPath $evidencePath -Encoding UTF8
Get-Content -Raw -LiteralPath $evidencePath

if (-not ($backendPassed -and $frontendPassed -and $dockerPassed -and $browserUiSmokePassed -and $ciPassed -and $docsPassed -and $sanitizedDemoVerified)) {
    exit 1
}
