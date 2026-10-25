param([string]$SourcePath, [string]$TemporaryDirectory)
$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($SourcePath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'SUPERVISOR_SYNTAX_INVALID' }
# Load only the two record-writing function declarations. The supervisor's
# top-level code, process creation, locks and real service files never run.
$definitions = $ast.FindAll({
  param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -in @('Write-LaunchDiagnostic', 'Write-ServiceRecord')
}, $false)
if ($definitions.Count -ne 2) { throw 'RECORD_FUNCTIONS_MISSING' }
foreach ($definition in $definitions) {
  . ([ScriptBlock]::Create($definition.Extent.Text))
}
$launchId = '00000000-0000-0000-0000-000000000001'
$diagnosticPath = Join-Path $TemporaryDirectory 'diagnostic.json'
$recordPath = Join-Path $TemporaryDirectory 'service.json'
$expectedExecutable = Join-Path $TemporaryDirectory 'unused-test.exe'
$launchMode = 'windows-hidden-attached-console-v1'
$launcherProcessId = 2468
$startedAt = '2026-10-16T00:00:00Z'
$nativePid = $null
$phase = 'input'
$failureCode = 'DESCRIPTOR_JSON'
Write-LaunchDiagnostic 'starting'
$phase = 'validate'
Write-LaunchDiagnostic 'failed'
$diagnostic = [IO.File]::ReadAllText($diagnosticPath) | ConvertFrom-Json
if ($diagnostic.state -ne 'failed' -or $diagnostic.phase -ne 'validate' -or $diagnostic.code -ne 'DESCRIPTOR_JSON') {
  throw 'ATOMIC_DIAGNOSTIC_UPDATE_FAILED'
}
Write-ServiceRecord 'launching'
$nativePid = 7373
Write-ServiceRecord 'spawned'
$record = [IO.File]::ReadAllText($recordPath) | ConvertFrom-Json
if ($record.pid -ne 7373 -or $record.state -ne 'spawned' -or $record.launcherPid -ne 2468 -or $record.supervisorPid -ne $PID) { throw 'ATOMIC_SERVICE_RECORD_UPDATE_FAILED' }
Write-Output 'record-updates-passed'
