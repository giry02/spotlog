# Invoked by the double-click VBS entry point: neither this bootstrap nor its
# Node -> Miniflare -> workerd descendants need an interactive console.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $projectRoot '.sites-runtime/ai'
$logRoot = Join-Path $runtimeRoot 'stack'
$node = Join-Path $runtimeRoot 'node-v24.22.0-win-x64/node.exe'
$preload = Join-Path $PSScriptRoot 'local-hidden-children.cjs'
$launcher = Join-Path $PSScriptRoot 'start-local-stack.mjs'
$statusPath = Join-Path $logRoot 'launcher-status.json'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Write-LauncherStatus([string]$State, [int]$ExitCode = 0) {
  [ordered]@{
    state = $State
    updatedAt = [DateTime]::UtcNow.ToString('o')
    exitCode = $ExitCode
    url = 'http://localhost:3001/'
    stdoutPath = Join-Path $logRoot 'launcher.stdout.log'
    stderrPath = Join-Path $logRoot 'launcher.stderr.log'
  } | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
}

try {
  if (!(Test-Path -LiteralPath $node -PathType Leaf)) { throw 'PINNED_NODE_RUNTIME_MISSING' }
  Write-LauncherStatus 'starting'
  # Passing full executable/argument paths avoids npm.cmd and shell forwarding.
  $child = New-Object System.Diagnostics.Process
  $child.StartInfo.FileName = $node
  $child.StartInfo.Arguments = '--require "' + $preload + '" "' + $launcher + '"'
  $child.StartInfo.WorkingDirectory = $projectRoot
  $child.StartInfo.UseShellExecute = $false
  $child.StartInfo.CreateNoWindow = $true
  $child.StartInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  $child.StartInfo.RedirectStandardOutput = $true
  $child.StartInfo.RedirectStandardError = $true
  [void]$child.Start()
  # Stream the coordinator's small, sanitized progress records immediately.
  # The one-byte file buffers avoid displaying stale logs during cold startup.
  $outputFile = New-Object IO.FileStream((Join-Path $logRoot 'launcher.stdout.log'), [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite, 1, [IO.FileOptions]::Asynchronous)
  $errorFile = New-Object IO.FileStream((Join-Path $logRoot 'launcher.stderr.log'), [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite, 1, [IO.FileOptions]::Asynchronous)
  $output = $child.StandardOutput.BaseStream.CopyToAsync($outputFile)
  $errors = $child.StandardError.BaseStream.CopyToAsync($errorFile)
  # Start-Process -Wait waits for detached descendants too. A direct Process
  # handle waits only for the coordinator and reliably retains its exit code.
  $child.WaitForExit()
  $output.GetAwaiter().GetResult()
  $errors.GetAwaiter().GetResult()
  $outputFile.Dispose()
  $errorFile.Dispose()
  if ($child.ExitCode -eq 0) { Write-LauncherStatus 'ready' }
  else { Write-LauncherStatus 'failed' $child.ExitCode }
} catch {
  # Deliberately omit exception text: the log contains no environment values,
  # inherited secrets, credential files, or child command lines.
  Write-LauncherStatus 'failed' 1
}
