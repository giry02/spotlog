# This supervisor has no console. Ollama is deliberately started with a new
# attached console hidden at creation, which native descendants can inherit.
param([ValidatePattern('^[a-f0-9-]{36}$')][string]$RequestId, [int]$LauncherPid = 0)
$ErrorActionPreference = 'Stop'
$directorySeparators = [char[]]@([char]92, [char]47)
$projectRoot = ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))).TrimEnd($directorySeparators)
$runtimeRoot = Join-Path $projectRoot '.sites-runtime/ai'
$logRoot = Join-Path $runtimeRoot 'stack'
$expectedExecutable = [IO.Path]::GetFullPath((Join-Path $runtimeRoot 'ollama-0.40.4/ollama.exe'))
$recordPath = Join-Path $logRoot 'ollama.process.json'
$stdoutPath = Join-Path $logRoot 'ollama.stdout.log'
$stderrPath = Join-Path $logRoot 'ollama.stderr.log'
$launchMode = 'windows-hidden-attached-console-v1'
$startedAt = [DateTime]::UtcNow.ToString('o')
$launchId = $RequestId
$launcherProcessId = if ($LauncherPid -gt 0) { $LauncherPid } else { $PID }
$diagnosticPath = Join-Path $logRoot ('ollama.launch-' + $RequestId + '.json')
$phase = 'input'
$failureCode = 'DESCRIPTOR_INPUT'
$nativePid = $null
$serviceProcess = $null
$launchLock = $null
$outFile = $null
$errFile = $null
$outCopy = $null
$errCopy = $null
$resultCode = 1

function Write-LaunchDiagnostic([string]$State) {
  try {
    $diagnostic = [ordered]@{
      launchId = $launchId
      launcherPid = $launcherProcessId
      supervisorPid = $PID
      state = $State
      phase = $phase
    }
    if ($State -eq 'failed') { $diagnostic['code'] = $failureCode }
    $temporaryPath = $diagnosticPath + '.tmp'
    [IO.File]::WriteAllText($temporaryPath, ($diagnostic | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
    if ([IO.File]::Exists($diagnosticPath)) { [IO.File]::Replace($temporaryPath, $diagnosticPath, [NullString]::Value) }
    else { [IO.File]::Move($temporaryPath, $diagnosticPath) }
  } catch {}
}

function Write-ServiceRecord([string]$State, [string]$Code = '', $ExitCode = $null) {
  $record = [ordered]@{
    pid = $nativePid
    launcherPid = $launcherProcessId
    supervisorPid = $PID
    executable = $expectedExecutable
    port = 11434
    startedAt = $startedAt
    updatedAt = [DateTime]::UtcNow.ToString('o')
    launchMode = $launchMode
    launchId = $launchId
    state = $State
  }
  if ($Code) { $record['code'] = $Code }
  if ($null -ne $ExitCode) { $record['exitCode'] = [int]$ExitCode }
  $temporaryPath = $recordPath + '.' + $launchId + '.tmp'
  [IO.File]::WriteAllText($temporaryPath, ($record | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
  if ([IO.File]::Exists($recordPath)) { [IO.File]::Replace($temporaryPath, $recordPath, [NullString]::Value) }
  else { [IO.File]::Move($temporaryPath, $recordPath) }
}

try {
  Write-LaunchDiagnostic 'starting'
  $inputText = [Console]::In.ReadToEnd()
  if ($inputText.Length -gt 16384) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_JSON'
  $descriptor = $inputText | ConvertFrom-Json
  $phase = 'validate'
  Write-LaunchDiagnostic 'starting'
  $failureCode = 'DESCRIPTOR_VERSION'
  if ($descriptor.version -ne 1) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_SERVICE'
  if ($descriptor.serviceName -ne 'ollama') { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_PORT'
  if ($descriptor.port -ne 11434) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_REQUEST_ID'
  if ($descriptor.launchId -ne $RequestId) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_EXECUTABLE'
  if ([IO.Path]::GetFullPath([string]$descriptor.executable) -ne $expectedExecutable) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_CWD'
  $descriptorRoot = ([IO.Path]::GetFullPath([string]$descriptor.cwd)).TrimEnd($directorySeparators)
  if ($descriptorRoot -ne $projectRoot) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_RECORD_PATH'
  if ([IO.Path]::GetFullPath([string]$descriptor.recordPath) -ne [IO.Path]::GetFullPath($recordPath)) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_STDOUT_PATH'
  if ([IO.Path]::GetFullPath([string]$descriptor.stdoutPath) -ne [IO.Path]::GetFullPath($stdoutPath)) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_STDERR_PATH'
  if ([IO.Path]::GetFullPath([string]$descriptor.stderrPath) -ne [IO.Path]::GetFullPath($stderrPath)) { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'DESCRIPTOR_ARGUMENTS'
  if (@($descriptor.args).Count -ne 1 -or [string]($descriptor.args[0]) -ne 'serve') { throw 'INVALID_LAUNCH_DESCRIPTOR' }
  $failureCode = 'SUPERVISOR_DIRECTORY'
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
  # The exclusive file handle is released by Windows even after a crash. A
  # second supervisor never starts another Ollama or overwrites its record.
  $phase = 'lock'
  $failureCode = 'SUPERVISOR_LOCK'
  Write-LaunchDiagnostic 'starting'
  $launchLock = [IO.File]::Open((Join-Path $logRoot 'ollama.launch.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $phase = 'record'
  $failureCode = 'SUPERVISOR_RECORD'
  Write-LaunchDiagnostic 'starting'
  Write-ServiceRecord 'launching'
  $phase = 'logs'
  $failureCode = 'SUPERVISOR_LOGS'
  Write-LaunchDiagnostic 'starting'
  $outFile = [IO.File]::Open($stdoutPath, [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
  $errFile = [IO.File]::Open($stderrPath, [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
  $serviceProcess = New-Object Diagnostics.Process
  $serviceProcess.StartInfo.FileName = $expectedExecutable
  $serviceProcess.StartInfo.Arguments = 'serve'
  $serviceProcess.StartInfo.WorkingDirectory = $projectRoot
  $serviceProcess.StartInfo.UseShellExecute = $false
  $serviceProcess.StartInfo.CreateNoWindow = $false
  $serviceProcess.StartInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  $serviceProcess.StartInfo.RedirectStandardInput = $true
  $serviceProcess.StartInfo.RedirectStandardOutput = $true
  $serviceProcess.StartInfo.RedirectStandardError = $true
  $phase = 'start'
  $failureCode = 'OLLAMA_START'
  Write-LaunchDiagnostic 'starting'
  [void]$serviceProcess.Start()
  $nativePid = $serviceProcess.Id
  $serviceProcess.StandardInput.Close()
  # Stream directly to files, rather than retaining an unbounded service log in
  # memory or depending on PowerShell callback runspaces.
  $phase = 'stream'
  $failureCode = 'SUPERVISOR_STREAM'
  Write-LaunchDiagnostic 'starting'
  $outCopy = $serviceProcess.StandardOutput.BaseStream.CopyToAsync($outFile)
  $errCopy = $serviceProcess.StandardError.BaseStream.CopyToAsync($errFile)
  Write-ServiceRecord 'spawned'
  $phase = 'wait'
  $failureCode = 'OLLAMA_WAIT'
  Write-LaunchDiagnostic 'running'
  $serviceProcess.WaitForExit()
  $resultCode = $serviceProcess.ExitCode
  $phase = 'exit'
  $failureCode = 'SUPERVISOR_EXIT_RECORD'
  Write-ServiceRecord 'exited' '' $resultCode
  Write-LaunchDiagnostic 'exited'
} catch {
  # No exception, argument, environment, or inherited key values are logged.
  Write-LaunchDiagnostic 'failed'
  if ($serviceProcess) {
    try { if (!$serviceProcess.HasExited) { $serviceProcess.Kill() } } catch {}
  }
  if ($launchLock) {
    try { Write-ServiceRecord 'failed' 'OLLAMA_SUPERVISOR_FAILED' 1 } catch {}
  }
  $resultCode = 1
} finally {
  $copies = @($outCopy, $errCopy) | Where-Object { $null -ne $_ }
  if ($copies.Count) { try { [void][Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$copies, 2000) } catch {} }
  if ($serviceProcess) { $serviceProcess.Dispose() }
  if ($outFile) { $outFile.Dispose() }
  if ($errFile) { $errFile.Dispose() }
  if ($launchLock) { $launchLock.Dispose() }
}
exit $resultCode
