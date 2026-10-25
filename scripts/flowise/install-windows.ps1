$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtimeRoot = Join-Path $projectRoot '.sites-runtime/ai'
$flowiseRoot = Join-Path $runtimeRoot 'flowise'
$nodeVersion = 'v24.22.0'
$archiveName = "node-$nodeVersion-win-x64.zip"
$nodeRoot = Join-Path $runtimeRoot "node-$nodeVersion-win-x64"
New-Item -ItemType Directory -Force $runtimeRoot, $flowiseRoot | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $nodeRoot 'node.exe'))) {
  $archivePath = Join-Path $runtimeRoot $archiveName
  Invoke-WebRequest "https://nodejs.org/dist/$nodeVersion/$archiveName" -OutFile $archivePath
  $checksums = (Invoke-WebRequest "https://nodejs.org/dist/$nodeVersion/SHASUMS256.txt").Content
  $expectedHash = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") } | Select-Object -First 1).Split(' ')[0]
  if (!$expectedHash -or (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Node archive checksum mismatch.' }
  Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime-package.json') -Destination (Join-Path $flowiseRoot 'package.json')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime-package-lock.json') -Destination (Join-Path $flowiseRoot 'package-lock.json')
$previousTaskPath = $env:PATH
try {
  $env:PATH = "$nodeRoot;$previousTaskPath"
  npm install --prefix $flowiseRoot --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Flowise isolated installation failed.' }
  npm rebuild sqlite3 --prefix $flowiseRoot
  if ($LASTEXITCODE -ne 0) { throw 'Flowise sqlite3 setup failed.' }
  Write-Output 'Pinned local Flowise installed. Owner/data/keys are separate and were preserved.'
} finally { $env:PATH = $previousTaskPath }
