[CmdletBinding()]
param()

$workflowDirectory = Join-Path $PSScriptRoot '..\.github\workflows'
$workflowFiles = Get-ChildItem -LiteralPath $workflowDirectory -File |
    Where-Object { $_.Extension -in @('.yml', '.yaml') }
$mutableReferencePattern = '^\s*-\s+uses:\s+.+@(?!(?:[0-9a-f]{40})(?:\s|$))'
$violations = @(
    foreach ($workflowFile in $workflowFiles) {
        Select-String -LiteralPath $workflowFile.FullName -Pattern $mutableReferencePattern |
            ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
    }
)

if ($violations.Count -gt 0) {
    $violations | Write-Error
    throw 'GitHub Actions references must use full commit SHAs.'
}

Write-Output "Verified $($workflowFiles.Count) workflow file(s) use immutable action references."
