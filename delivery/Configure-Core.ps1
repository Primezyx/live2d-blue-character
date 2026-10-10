param([Parameter(Mandatory = $true)][string]$CorePath)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $CorePath).Path
$expected = '25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f'
$actual = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
    throw 'This is not the verified Core 5.1.0 file. See README.md for the tested version and source.'
}
$destination = Join-Path $PSScriptRoot 'preview\vendor\live2dcubismcore.min.js'
if ($source -ne $destination) { Copy-Item -LiteralPath $source -Destination $destination }
Write-Output 'Verified Cubism Core 5.1.0 is ready. Run delivery\Open-Preview.bat.'
