$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

& npm run onsetsweep -- --workers 20
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
