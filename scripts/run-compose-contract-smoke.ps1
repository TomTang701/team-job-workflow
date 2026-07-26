#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
$baseUrl = if ($BaseUrl) {
    $BaseUrl.TrimEnd("/")
} elseif ($env:TJW_CONTRACT_BASE_URL) {
    $env:TJW_CONTRACT_BASE_URL.TrimEnd("/")
} else {
    "http://127.0.0.1:8000"
}

function Invoke-ContractRequest {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("GET", "POST", "PATCH")]
        [string]$Method,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [object]$Body,
        [string]$AccessToken,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedStatus
    )

    $request = @{
        Uri = "$baseUrl$Path"
        Method = $Method
        UseBasicParsing = $true
        TimeoutSec = 10
        ErrorAction = "Stop"
    }
    if ($AccessToken) {
        $request.Headers = @{ Authorization = "Bearer $AccessToken" }
    }
    if ($PSBoundParameters.ContainsKey("Body")) {
        $request.ContentType = "application/json"
        $request.Body = $Body | ConvertTo-Json -Compress
    }

    $responseBody = $null
    try {
        $response = Invoke-WebRequest @request
        $actualStatus = [int]$response.StatusCode
        if ($response.Content) {
            $responseBody = $response.Content | ConvertFrom-Json
        }
    } catch {
        $failureResponse = $_.Exception.Response
        if ($null -eq $failureResponse) {
            throw "Contract request $Method $Path did not receive an HTTP response."
        }

        $actualStatus = [int]$failureResponse.StatusCode
    }

    if ($actualStatus -ne $ExpectedStatus) {
        throw "Contract request $Method $Path expected HTTP $ExpectedStatus but received HTTP $actualStatus."
    }
    return [PSCustomObject]@{
        StatusCode = $actualStatus
        Body = $responseBody
    }
}

$runId = [Guid]::NewGuid().ToString("N").Substring(0, 12)
$password = [Guid]::NewGuid().ToString("N")
$owner = Invoke-ContractRequest -Method "POST" -Path "/api/auth/register" -Body @{
    email = "compose-owner-$runId@example.test"
    password = $password
} -ExpectedStatus 201
$member = Invoke-ContractRequest -Method "POST" -Path "/api/auth/register" -Body @{
    email = "compose-member-$runId@example.test"
    password = $password
} -ExpectedStatus 201
$outsider = Invoke-ContractRequest -Method "POST" -Path "/api/auth/register" -Body @{
    email = "compose-outsider-$runId@example.test"
    password = $password
} -ExpectedStatus 201

$ownerToken = $owner.Body.access_token
$memberToken = $member.Body.access_token
$outsiderToken = $outsider.Body.access_token
if (-not $ownerToken -or -not $memberToken -or -not $outsiderToken) {
    throw "Registration responses did not contain access tokens."
}

$workspace = Invoke-ContractRequest -Method "POST" -Path "/api/workspaces" -AccessToken $ownerToken -Body @{
    name = "Compose contract workspace $runId"
} -ExpectedStatus 201
$workspaceId = [int]$workspace.Body.id

Invoke-ContractRequest -Method "POST" -Path "/api/workspaces/$workspaceId/members" -AccessToken $ownerToken -Body @{
    email = $member.Body.user.email
    role = "member"
} -ExpectedStatus 201 | Out-Null
Invoke-ContractRequest -Method "POST" -Path "/api/workspaces/$workspaceId/members" -AccessToken $memberToken -Body @{
    email = $outsider.Body.user.email
    role = "member"
} -ExpectedStatus 403 | Out-Null
Invoke-ContractRequest -Method "GET" -Path "/api/workspaces/$workspaceId" -AccessToken $outsiderToken -ExpectedStatus 403 | Out-Null

$application = Invoke-ContractRequest -Method "POST" -Path "/api/workspaces/$workspaceId/applications" -AccessToken $memberToken -Body @{
    company = "Example Systems"
    job_title = "Backend Intern"
} -ExpectedStatus 201
$applicationId = [int]$application.Body.id

Invoke-ContractRequest -Method "PATCH" -Path "/api/applications/$applicationId/status" -AccessToken $memberToken -Body @{
    status = "interview"
} -ExpectedStatus 200 | Out-Null
$task = Invoke-ContractRequest -Method "POST" -Path "/api/applications/$applicationId/tasks" -AccessToken $memberToken -Body @{
    title = "Prepare interview notes"
} -ExpectedStatus 201
Invoke-ContractRequest -Method "PATCH" -Path "/api/tasks/$($task.Body.id)" -AccessToken $memberToken -Body @{
    completed = $true
} -ExpectedStatus 200 | Out-Null
Invoke-ContractRequest -Method "POST" -Path "/api/applications/$applicationId/comments" -AccessToken $memberToken -Body @{
    body = "Sanitized Compose contract comment."
} -ExpectedStatus 201 | Out-Null

$details = Invoke-ContractRequest -Method "GET" -Path "/api/applications/$applicationId" -AccessToken $ownerToken -ExpectedStatus 200
$actions = @($details.Body.activities | ForEach-Object { $_.action })
foreach ($requiredAction in @("status_changed", "task_completed", "comment_added")) {
    if ($actions -notcontains $requiredAction) {
        throw "Application detail did not contain required activity '$requiredAction'."
    }
}

$root = Split-Path -Parent $PSScriptRoot
$pythonCandidates = @(
    $env:TJW_CONTRACT_PYTHON,
    (Join-Path $root ".venv\Scripts\python.exe")
)
$python = $pythonCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $python) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($null -eq $pythonCommand) {
        $pythonCommand = Get-Command python3 -ErrorAction SilentlyContinue
    }
    if ($null -ne $pythonCommand) {
        $python = $pythonCommand.Source
    }
}
if (-not $python) {
    throw "Python is required for the Compose concurrency contract smoke test."
}
& $python (Join-Path $root "tools\compose_concurrency_smoke.py") --base-url $baseUrl
if ($LASTEXITCODE -ne 0) {
    throw "Compose concurrency contract smoke test failed with exit code $LASTEXITCODE."
}

Write-Host "Compose HTTP contract smoke test passed." -ForegroundColor Green
