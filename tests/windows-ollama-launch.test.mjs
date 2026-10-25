import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  launchWindowsOllama,
  superviseWindowsOllama,
  WINDOWS_OLLAMA_LAUNCH_MODE,
} from '../scripts/launch-windows-ollama.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const launchId = '12345678-1234-1234-1234-123456789abc';
const service = {
  name: 'ollama',
  port: 11434,
  executable: resolve(
    projectRoot,
    '.sites-runtime/ai/ollama-0.40.4/ollama.exe',
  ),
  args: ['serve'],
  timeoutMs: 1250,
};
function harness(records = [], status = 'ready') {
  let clock = 0;
  const calls = { inspected: 0, waits: 0, input: '', unref: false };
  const launcher = new EventEmitter();
  launcher.pid = 41;
  launcher.stdin = new EventEmitter();
  launcher.stdin.end = (value) => {
    calls.input = value;
  };
  launcher.unref = () => {
    calls.unref = true;
  };
  const environment = {
    SystemRoot: 'C:/Windows',
    PRIVATE_TEST_VALUE: 'must-not-be-serialized',
  };
  const options = {
    projectRoot,
    recordPath: resolve(
      projectRoot,
      '.sites-runtime/ai/stack/ollama.process.json',
    ),
    stdoutPath: resolve(
      projectRoot,
      '.sites-runtime/ai/stack/ollama.stdout.log',
    ),
    stderrPath: resolve(
      projectRoot,
      '.sites-runtime/ai/stack/ollama.stderr.log',
    ),
    environment,
    inspectService: async () => {
      calls.inspected++;
      return { status, port: 11434 };
    },
  };
  const dependencies = {
    launchId,
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
      calls.waits++;
    },
    spawn: (command, args, spawnOptions) => {
      calls.command = command;
      calls.args = args;
      calls.spawnOptions = spawnOptions;
      return launcher;
    },
    readFile: async () => JSON.stringify(records.shift() ?? {}),
  };
  return { calls, launcher, options, dependencies };
}
function record(extra = {}) {
  return {
    launchMode: WINDOWS_OLLAMA_LAUNCH_MODE,
    launchId,
    launcherPid: 41,
    pid: 73,
    port: 11434,
    executable: service.executable,
    state: 'spawned',
    ...extra,
  };
}

test('only native Ollama PID is returned after an owned supervisor acknowledgement and health check', async () => {
  const h = harness([record()]);
  const result = await launchWindowsOllama(service, h.options, h.dependencies);
  assert.equal(result.status, 'ready');
  assert.equal(result.pid, 73);
  assert.equal(result.launcherPid, 41);
  assert.equal(result.started, true);
  assert.equal(h.calls.inspected, 1);
  assert.equal(h.calls.unref, true);
  assert.equal(h.calls.spawnOptions.detached, true);
  assert.equal(h.calls.spawnOptions.windowsHide, true);
  assert.deepEqual(h.calls.spawnOptions.stdio, ['pipe', 'ignore', 'ignore']);
  assert.equal(h.calls.spawnOptions.env, h.options.environment);
  assert.equal(
    h.calls.command,
    resolve(projectRoot, '.sites-runtime/ai/node-v24.22.0-win-x64/node.exe'),
  );
  assert.equal(h.calls.args.at(-1), '--supervise');
  assert.ok(
    h.calls.args.includes(
      resolve(projectRoot, 'scripts/launch-windows-ollama.mjs'),
    ),
  );
  assert.equal(h.calls.input.includes('must-not-be-serialized'), false);
  const input = JSON.parse(h.calls.input);
  assert.equal(input.launchId, launchId);
  assert.deepEqual(input.args, ['serve']);
  assert.equal(Object.hasOwn(input, 'environment'), false);
});

test('stale launches, other supervisors and wrong executable records cannot acknowledge this launch', async () => {
  const h = harness([
    record({ launchId: 'old-launch' }),
    record({ launcherPid: 99 }),
    record({ executable: resolve(projectRoot, 'not-ollama.exe') }),
    record(),
  ]);
  const result = await launchWindowsOllama(service, h.options, h.dependencies);
  assert.equal(result.pid, 73);
  assert.equal(h.calls.inspected, 1);
  assert.equal(h.calls.waits, 3);
});

test('a supervisor PID or an unacknowledged healthy port is never misreported as a native service', async () => {
  const h = harness([record({ pid: 41 })]);
  const result = await launchWindowsOllama(service, h.options, h.dependencies);
  assert.equal(result.status, 'start-failed');
  assert.equal(result.code, 'HEALTH_CHECK_TIMEOUT');
  assert.equal(result.launcherPid, 41);
  assert.equal(Object.hasOwn(result, 'pid'), false);
  assert.equal(h.calls.inspected, 0);
});

test('a supervisor launch error is handled without probing any service', async () => {
  const h = harness();
  h.dependencies.spawn = () => {
    throw new Error('mock spawn failure');
  };
  const result = await launchWindowsOllama(service, h.options, h.dependencies);
  assert.equal(result.code, 'SPAWN_FAILED');
  assert.equal(h.calls.inspected, 0);
  assert.equal(Object.hasOwn(result, 'pid'), false);
});

test('failed or exited supervisor records stop startup without a fabricated ready result', async () => {
  for (const [state, expected] of [
    ['failed', 'SPAWN_FAILED'],
    ['exited', 'PROCESS_EXITED'],
  ]) {
    const h = harness([record({ state, pid: null })]);
    const result = await launchWindowsOllama(
      service,
      h.options,
      h.dependencies,
    );
    assert.equal(result.status, 'start-failed');
    assert.equal(result.code, expected);
    assert.equal(h.calls.inspected, 0);
  }
});

test('broken supervisor stdin is handled without an unhandled error or a health check', async () => {
  const h = harness();
  h.launcher.stdin.end = () =>
    h.launcher.stdin.emit('error', new Error('mock broken pipe'));
  const result = await launchWindowsOllama(service, h.options, h.dependencies);
  assert.equal(result.code, 'SPAWN_FAILED');
  assert.equal(h.calls.inspected, 0);
});

test('early supervisor failure returns only an owned allowlisted phase and never error values', async () => {
  const h = harness();
  h.dependencies.readFile = async (path) =>
    JSON.stringify(
      path.includes('ollama.launch-')
        ? {
            launchId,
            launcherPid: 41,
            state: 'failed',
            phase: 'validate',
            code: 'DESCRIPTOR_CWD',
            exception: 'must-not-be-returned',
            environment: 'must-not-be-returned',
          }
        : {},
    );
  const result = await launchWindowsOllama(service, h.options, h.dependencies);
  assert.equal(result.supervisorPhase, 'validate');
  assert.equal(result.supervisorCode, 'DESCRIPTOR_CWD');
  assert.equal(JSON.stringify(result).includes('must-not-be-returned'), false);
  assert.equal(h.calls.inspected, 0);
});

test('foreign or non-allowlisted diagnostic text is omitted from the failure response', async () => {
  for (const diagnostic of [
    { launchId: 'old', launcherPid: 41, phase: 'validate' },
    { launchId, launcherPid: 99, phase: 'validate' },
    { launchId, launcherPid: 41, phase: 'untrusted error text' },
    {
      launchId,
      launcherPid: 41,
      phase: 'validate',
      code: 'untrusted error text',
    },
  ]) {
    const h = harness();
    h.dependencies.readFile = async (path) =>
      JSON.stringify(path.includes('ollama.launch-') ? diagnostic : {});
    const result = await launchWindowsOllama(
      service,
      h.options,
      h.dependencies,
    );
    if (
      diagnostic.phase !== 'validate' ||
      diagnostic.launchId !== launchId ||
      diagnostic.launcherPid !== 41
    )
      assert.equal(Object.hasOwn(result, 'supervisorPhase'), false);
    assert.equal(Object.hasOwn(result, 'supervisorCode'), false);
  }
});

test('the Node bridge forwards validated metadata to non-detached hidden PowerShell and waits for exit', async () => {
  const h = harness([record()]);
  await launchWindowsOllama(service, h.options, h.dependencies);
  const child = new EventEmitter();
  child.stdin = new EventEmitter();
  const calls = { drained: 0 };
  child.stdout = {
    resume: () => {
      calls.drained++;
    },
  };
  child.stderr = {
    resume: () => {
      calls.drained++;
    },
  };
  child.stdin.end = (text) => {
    calls.forwarded = JSON.parse(text);
  };
  let settled = false;
  const pending = superviseWindowsOllama(Readable.from([h.calls.input]), {
    pid: 41,
    environment: h.options.environment,
    spawn: (command, args, options) => {
      calls.command = command;
      calls.args = args;
      calls.options = options;
      return child;
    },
  }).then((code) => {
    settled = true;
    return code;
  });
  await new Promise((done) => setImmediate(done));
  assert.equal(settled, false);
  assert.equal(calls.options.detached, false);
  assert.equal(calls.options.windowsHide, true);
  assert.deepEqual(calls.options.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(calls.args[calls.args.indexOf('-LauncherPid') + 1], '41');
  assert.equal(calls.args[calls.args.indexOf('-RequestId') + 1], launchId);
  assert.equal(calls.drained, 2);
  assert.deepEqual(calls.forwarded, JSON.parse(h.calls.input));
  child.emit('exit', 7);
  assert.equal(await pending, 7);
});

test('invalid or over-16KiB bridge input never creates a PowerShell process', async () => {
  for (const input of ['{}', '{not-json', 'x'.repeat(16385)]) {
    let spawned = false;
    const code = await superviseWindowsOllama(Readable.from([input]), {
      spawn: () => {
        spawned = true;
        throw new Error('must not spawn');
      },
    });
    assert.equal(code, 1);
    assert.equal(spawned, false);
  }
});

test(
  'Windows PowerShell overwrites both supervisor records and rejects an isolated invalid descriptor before service launch',
  { skip: process.platform !== 'win32' },
  async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'spotlog-record-update-'),
    );
    try {
      const run = promisify(execFile);
      const root = fileURLToPath(new URL('../', import.meta.url));
      const powershell = resolve(
        process.env.SystemRoot || 'C:/Windows',
        'System32/WindowsPowerShell/v1.0/powershell.exe',
      );
      const { stdout, stderr } = await run(
        powershell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          resolve(root, 'tests/fixtures/verify-ollama-record-updates.ps1'),
          '-SourcePath',
          resolve(root, 'scripts/start-windows-ollama.ps1'),
          '-TemporaryDirectory',
          temporaryDirectory,
        ],
        { windowsHide: true, timeout: 15000 },
      );
      assert.equal(stderr, '');
      assert.equal(stdout.trim(), 'record-updates-passed');
      const scripts = join(temporaryDirectory, 'scripts');
      const stack = join(temporaryDirectory, '.sites-runtime/ai/stack');
      await mkdir(scripts);
      await mkdir(stack, { recursive: true });
      const isolatedSupervisor = join(scripts, 'start-windows-ollama.ps1');
      await copyFile(
        resolve(root, 'scripts/start-windows-ollama.ps1'),
        isolatedSupervisor,
      );
      const requestId = '00000000-0000-0000-0000-000000000001';
      const invalid = run(
        powershell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          isolatedSupervisor,
          '-RequestId',
          requestId,
        ],
        { windowsHide: true, timeout: 15000 },
      );
      invalid.child.stdin.end('{}');
      const completion = await invalid.then(
        (value) => ({ code: 0, ...value }),
        (error) => ({
          code: error.code,
          stdout: error.stdout,
          stderr: error.stderr,
        }),
      );
      assert.equal(completion.code, 1);
      assert.equal(completion.stderr, '');
      assert.equal(completion.stdout, '');
      const diagnostic = JSON.parse(
        await readFile(join(stack, `ollama.launch-${requestId}.json`), 'utf8'),
      );
      assert.equal(diagnostic.state, 'failed');
      assert.equal(diagnostic.phase, 'validate');
      assert.equal(diagnostic.code, 'DESCRIPTOR_VERSION');
      assert.equal(diagnostic.launcherPid, diagnostic.supervisorPid);
      await assert.rejects(access(join(stack, 'ollama.process.json')), {
        code: 'ENOENT',
      });
      await assert.rejects(access(join(stack, 'ollama.launch.lock')), {
        code: 'ENOENT',
      });
    } finally {
      // Verify the exact absolute disposable root before recursive cleanup.
      const target = resolve(temporaryDirectory);
      assert.equal(dirname(target), resolve(tmpdir()));
      assert.ok(basename(target).startsWith('spotlog-record-update-'));
      await rm(target, { recursive: true, force: true });
    }
  },
);
