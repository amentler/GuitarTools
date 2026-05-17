$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

$workerInput = Read-Host "Worker count [20]"
if ([string]::IsNullOrWhiteSpace($workerInput)) {
    $workerCount = 20
} elseif ($workerInput -match '^\d+$' -and [int]$workerInput -ge 1) {
    $workerCount = [int]$workerInput
} else {
    Write-Error "Worker count must be a positive integer."
    exit 1
}

& npm run onsetsweep -- --workers $workerCount
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
