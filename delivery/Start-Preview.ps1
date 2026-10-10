param([int]$Port = 8881, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$previewRoot = Join-Path $PSScriptRoot 'preview'
$core = Join-Path $previewRoot 'vendor\live2dcubismcore.min.js'
if (!(Test-Path -LiteralPath $core)) {
    throw 'Cubism Core is missing. Read README.md and run delivery\Configure-Core.ps1 with your authorized Core file.'
}
$expected = Get-Content -LiteralPath (Join-Path $previewRoot 'preview-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$entry = $expected.modelEntry
$localModel = Get-Content -LiteralPath (Join-Path $previewRoot $entry) -Raw -Encoding UTF8 | ConvertFrom-Json
$modelDir = ($entry -replace '/[^/]+$', '')
$mocKey = "$modelDir/$($localModel.FileReferences.Moc)"
$mocHash = $expected.files.$mocKey
if (!$mocHash) { throw 'The current model is missing from preview-manifest.json.' }
$chosenPort = $null
$lastPort = [Math]::Min($Port + 10, 65535)
foreach ($candidate in $Port..$lastPort) {
    $listener = @(Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue)
    if ($listener.Count) {
        try {
            $remote = Invoke-RestMethod "http://127.0.0.1:$candidate/preview-manifest.json" -TimeoutSec 2
            if ($remote.modelEntry -eq $entry -and $remote.files.$mocKey -eq $mocHash) {
                $chosenPort = $candidate
                break
            }
        } catch { }
        continue
    }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    $pythonArgs = @('server.py', '--port', "$candidate")
    if (!$python) {
        $python = Get-Command py.exe -ErrorAction SilentlyContinue
        $pythonArgs = @('-3') + $pythonArgs
    }
    if (!$python) { throw 'Install Python 3, then run this launcher again.' }
    $logRoot = Join-Path $PSScriptRoot '.local'
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    $server = Start-Process -FilePath $python.Source -ArgumentList $pythonArgs -WorkingDirectory $previewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot "preview-$candidate.log") -RedirectStandardError (Join-Path $logRoot "preview-$candidate-error.log")
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 200
        try {
            $remote = Invoke-RestMethod "http://127.0.0.1:$candidate/preview-manifest.json" -TimeoutSec 1
            if ($remote.modelEntry -eq $entry -and $remote.files.$mocKey -eq $mocHash) {
                $chosenPort = $candidate
                break
            }
        } catch { }
        if ($server.HasExited) { break }
    }
    if ($null -eq $chosenPort) { throw "The preview did not start. See $logRoot for its log." }
    break
}
if ($null -eq $chosenPort) { throw 'No available preview port was found.' }
$url = "http://127.0.0.1:$chosenPort/?dance=1&v=limbs-v08"
Write-Output $url
if (!$NoBrowser) { Start-Process $url }
