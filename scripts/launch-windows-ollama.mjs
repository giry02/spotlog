import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const WINDOWS_OLLAMA_LAUNCH_MODE = 'windows-hidden-attached-console-v1';

/** The supervisor receives only non-secret launch metadata over stdin. */
export async function launchWindowsOllama(service, options, dependencies = {}) {
  const {
    projectRoot,
    recordPath,
    stdoutPath,
    stderrPath,
    environment,
    inspectService,
  } = options;
  const spawnProcess = dependencies.spawn ?? spawn;
  const read = dependencies.readFile ?? readFile;
  const now = dependencies.now ?? Date.now;
  const wait =
    dependencies.wait ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  const launchId = dependencies.launchId ?? randomUUID();
  const diagnosticPath = resolve(
    dirname(recordPath),
    `ollama.launch-${launchId}.json`,
  );
  const bridge = resolve(projectRoot, 'scripts/launch-windows-ollama.mjs');
  const node = resolve(
    projectRoot,
    '.sites-runtime/ai/node-v24.22.0-win-x64/node.exe',
  );
  const input = {
    version: 1,
    serviceName: service.name,
    executable: service.executable,
    args: service.args,
    cwd: projectRoot,
    recordPath,
    stdoutPath,
    stderrPath,
    port: service.port,
    launchId,
  };
  let launcher;
  let spawnFailed = false;
  let exited = false;
  let nativePid;
  try {
    launcher = spawnProcess(
      node,
      [
        '--require',
        resolve(projectRoot, 'scripts/local-hidden-children.cjs'),
        bridge,
        '--supervise',
      ],
      {
        cwd: projectRoot,
        detached: true,
        windowsHide: true,
        env: environment,
        stdio: ['pipe', 'ignore', 'ignore'],
      },
    );
    launcher.once('error', () => {
      spawnFailed = true;
    });
    launcher.once('exit', () => {
      exited = true;
    });
    launcher.stdin.once('error', () => {
      spawnFailed = true;
    });
    launcher.stdin.end(JSON.stringify(input));
    launcher.unref();
  } catch {
    spawnFailed = true;
  }
  const deadline = now() + service.timeoutMs;
  while (now() < deadline && !spawnFailed && !exited) {
    let record;
    try {
      const value = JSON.parse(await read(recordPath, 'utf8'));
      if (
        value.launchMode === WINDOWS_OLLAMA_LAUNCH_MODE &&
        value.launchId === launchId &&
        value.launcherPid === launcher.pid &&
        value.port === service.port &&
        typeof value.executable === 'string' &&
        resolve(value.executable).toLowerCase() ===
          resolve(service.executable).toLowerCase()
      )
        record = value;
    } catch {}
    if (spawnFailed || exited) break;
    if (record?.state === 'failed') {
      spawnFailed = true;
      break;
    }
    if (record?.state === 'exited') {
      exited = true;
      break;
    }
    if (
      Number.isSafeInteger(record?.pid) &&
      record.pid > 0 &&
      record.pid !== launcher.pid
    )
      nativePid = record.pid;
    if (nativePid) {
      const current = await inspectService(service);
      if (spawnFailed || exited) break;
      if (current.status === 'ready')
        return {
          ...current,
          started: true,
          pid: nativePid,
          launcherPid: launcher.pid,
          launchMode: WINDOWS_OLLAMA_LAUNCH_MODE,
        };
    }
    await wait(250);
  }
  let supervisorPhase;
  let supervisorCode;
  try {
    const diagnostic = JSON.parse(await read(diagnosticPath, 'utf8'));
    const phases = [
      'input',
      'validate',
      'lock',
      'record',
      'logs',
      'start',
      'stream',
      'wait',
      'exit',
    ];
    if (
      diagnostic.launchId === launchId &&
      diagnostic.launcherPid === launcher?.pid &&
      phases.includes(diagnostic.phase)
    ) {
      supervisorPhase = diagnostic.phase;
      const codes = [
        'DESCRIPTOR_INPUT',
        'DESCRIPTOR_JSON',
        'DESCRIPTOR_VERSION',
        'DESCRIPTOR_SERVICE',
        'DESCRIPTOR_PORT',
        'DESCRIPTOR_REQUEST_ID',
        'DESCRIPTOR_EXECUTABLE',
        'DESCRIPTOR_CWD',
        'DESCRIPTOR_RECORD_PATH',
        'DESCRIPTOR_STDOUT_PATH',
        'DESCRIPTOR_STDERR_PATH',
        'DESCRIPTOR_ARGUMENTS',
        'SUPERVISOR_DIRECTORY',
        'SUPERVISOR_LOCK',
        'SUPERVISOR_RECORD',
        'SUPERVISOR_LOGS',
        'OLLAMA_START',
        'SUPERVISOR_STREAM',
        'OLLAMA_WAIT',
        'SUPERVISOR_EXIT_RECORD',
      ];
      if (codes.includes(diagnostic.code)) supervisorCode = diagnostic.code;
    }
  } catch {}
  return {
    status: 'start-failed',
    port: service.port,
    code: spawnFailed
      ? 'SPAWN_FAILED'
      : exited
        ? 'PROCESS_EXITED'
        : 'HEALTH_CHECK_TIMEOUT',
    ...(nativePid ? { pid: nativePid } : {}),
    ...(launcher?.pid ? { launcherPid: launcher.pid } : {}),
    launchMode: WINDOWS_OLLAMA_LAUNCH_MODE,
    ...(supervisorPhase ? { supervisorPhase } : {}),
    ...(supervisorCode ? { supervisorCode } : {}),
    diagnosticPath,
    stdoutPath,
    stderrPath,
  };
}

/** Keep a non-detached PowerShell host alive behind the detached Node bridge. */
export async function superviseWindowsOllama(
  input = process.stdin,
  dependencies = {},
) {
  const spawnProcess = dependencies.spawn ?? spawn;
  const environment = dependencies.environment ?? process.env;
  const bridgePid = dependencies.pid ?? process.pid;
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let descriptor;
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of input) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += data.length;
      if (bytes > 16384) {
        input.destroy?.();
        return 1;
      }
      chunks.push(data);
    }
    descriptor = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const pathMatches = (value, expected) =>
      typeof value === 'string' &&
      resolve(value).toLowerCase() === resolve(expected).toLowerCase();
    const stack = resolve(projectRoot, '.sites-runtime/ai/stack');
    if (
      descriptor.version !== 1 ||
      descriptor.serviceName !== 'ollama' ||
      descriptor.port !== 11434 ||
      !/^[a-f0-9-]{36}$/.test(descriptor.launchId) ||
      !Array.isArray(descriptor.args) ||
      descriptor.args.length !== 1 ||
      descriptor.args[0] !== 'serve' ||
      !pathMatches(descriptor.cwd, projectRoot) ||
      !pathMatches(
        descriptor.executable,
        resolve(projectRoot, '.sites-runtime/ai/ollama-0.40.4/ollama.exe'),
      ) ||
      !pathMatches(
        descriptor.recordPath,
        resolve(stack, 'ollama.process.json'),
      ) ||
      !pathMatches(
        descriptor.stdoutPath,
        resolve(stack, 'ollama.stdout.log'),
      ) ||
      !pathMatches(descriptor.stderrPath, resolve(stack, 'ollama.stderr.log'))
    )
      return 1;
  } catch {
    return 1;
  }
  const powershell = resolve(
    environment.SystemRoot || environment.SYSTEMROOT || 'C:/Windows',
    'System32/WindowsPowerShell/v1.0/powershell.exe',
  );
  return new Promise((done) => {
    try {
      const child = spawnProcess(
        powershell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-WindowStyle',
          'Hidden',
          '-File',
          resolve(projectRoot, 'scripts/start-windows-ollama.ps1'),
          '-RequestId',
          descriptor.launchId,
          '-LauncherPid',
          String(bridgePid),
        ],
        {
          cwd: projectRoot,
          detached: false,
          windowsHide: true,
          env: environment,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      // Do not forward or persist PowerShell host output or inherited values.
      child.stdout.resume();
      child.stderr.resume();
      child.once('error', () => done(1));
      child.once('exit', (code) => done(Number.isInteger(code) ? code : 1));
      child.stdin.once('error', () => done(1));
      child.stdin.end(JSON.stringify(descriptor));
    } catch {
      done(1);
    }
  });
}

if (
  process.argv[2] === '--supervise' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  superviseWindowsOllama()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      process.exitCode = 1;
    });
}
