#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $node) {
    throw "Node.js LTS is required. Install it with: winget install --id OpenJS.NodeJS.LTS --exact"
}

$corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
if ($null -eq $corepack) {
    throw "The installed Node.js runtime does not provide Corepack."
}

$shimDirectory = Join-Path $env:LOCALAPPDATA "Programs\Nodejs-Corepack"
New-Item -ItemType Directory -Path $shimDirectory -Force | Out-Null
& $corepack.Source enable --install-directory $shimDirectory
if ($LASTEXITCODE -ne 0) {
    throw "Corepack could not create user-level pnpm shims."
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathEntries = @($userPath -split ";" | Where-Object { $_ })
if ($pathEntries -notcontains $shimDirectory) {
    [Environment]::SetEnvironmentVariable("Path", "$shimDirectory;$userPath", "User")
}

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$refreshedUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$refreshedUserPath"
$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
    throw "pnpm.cmd was not found after creating the user-level Corepack shims."
}

& $pnpm.Source --version
if ($LASTEXITCODE -ne 0) {
    throw "pnpm.cmd did not run successfully."
}

Write-Host "Frontend runtime is ready. Open a new terminal before using pnpm.cmd." -ForegroundColor Green
