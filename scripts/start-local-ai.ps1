param([string]$Model = 'qwen3:8b')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $projectRoot '.sites-runtime/ai'
$ollamaExe = Join-Path $runtimeRoot 'ollama-0.40.4/ollama.exe'
if (!(Test-Path -LiteralPath $ollamaExe)) {
  throw 'Install the pinned official Ollama Windows archive described in docs/CHATBOT_IMPLEMENTATION_20261015.md first.'
}
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $runtimeRoot 'models'
$env:OLLAMA_NO_CLOUD = '1'
try { $version = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 }
catch {
  Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runtimeRoot 'ollama.stdout.log') `
    -RedirectStandardError (Join-Path $runtimeRoot 'ollama.stderr.log') | Out-Null
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try { $version = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 1; break }
    catch { Start-Sleep -Milliseconds 250 }
  }
}
if (!$version -or $version.version -ne '0.40.4') { throw 'Ollama runtime version mismatch; existing service was not changed.' }
$installed = (Invoke-RestMethod 'http://127.0.0.1:11434/api/tags').models
if ($Model -notin $installed.name) { throw 'Model not installed. Pull the selected model using this project Ollama runtime first.' }
Write-Output "Local Ollama ready: $Model at http://127.0.0.1:11434"
Write-Output 'Moa configuration lives in ignored .dev.vars. Run npm run dev -- --port 3001 from the project root.'
