#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stopCommand = Join-Path $root "stop-local.cmd"

if (-not (Test-Path -LiteralPath $stopCommand)) {
    throw "stop-local.cmd is missing."
}

$contents = Get-Content -LiteralPath $stopCommand -Raw
if ($contents -notmatch "docker\.exe compose down --remove-orphans") {
    throw "stop-local.cmd must run docker.exe compose down --remove-orphans."
}
if ($contents -match "--volumes") {
    throw "stop-local.cmd must preserve the Compose volume."
}

Write-Host "stop-local.cmd command contract passed."
