#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

foreach ($expectedBinding in @(
    @{ Service = "api"; ContainerPort = "8000/tcp"; HostPort = "8000" },
    @{ Service = "web"; ContainerPort = "80/tcp"; HostPort = "8080" }
)) {
    $containerLines = @(docker compose ps -q $expectedBinding.Service)
    if ($LASTEXITCODE -ne 0 -or $containerLines.Count -ne 1) {
        throw "Expected exactly one running container for service '$($expectedBinding.Service)'."
    }
    $containerId = ([string]$containerLines[0]).Trim()
    $portJsonLines = @(docker inspect $containerId --format '{{json .NetworkSettings.Ports}}')
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect port bindings for service '$($expectedBinding.Service)'."
    }
    $portMappings = (($portJsonLines -join "`n") | ConvertFrom-Json)
    $bindings = @($portMappings.PSObject.Properties[$expectedBinding.ContainerPort].Value)
    if ($bindings.Count -eq 0) {
        throw "Service '$($expectedBinding.Service)' does not publish $($expectedBinding.ContainerPort)."
    }
    foreach ($binding in $bindings) {
        if ($binding.HostIp -ne "127.0.0.1" -or [string]$binding.HostPort -ne $expectedBinding.HostPort) {
            throw "Service '$($expectedBinding.Service)' must bind $($expectedBinding.ContainerPort) only to 127.0.0.1:$($expectedBinding.HostPort), but Docker reported $($binding.HostIp):$($binding.HostPort)."
        }
    }
}

Write-Host "Compose ports are bound only to loopback." -ForegroundColor Green
