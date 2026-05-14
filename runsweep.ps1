$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

& npm run onsetsweep -- --spec 'plans/sheet_music_onset_repair/onset-sweep-spec.json' --workers 20
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
