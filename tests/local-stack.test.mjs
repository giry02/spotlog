import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  backgroundEnvironment,
  isFlowiseRuntimeHealth,
  inspect,
  startService,
  startServices,
} from '../scripts/start-local-stack.mjs';

const require = createRequire(import.meta.url);
const {
  hiddenArguments,
  installHiddenChildren,
} = require('../scripts/local-hidden-children.cjs');

test(
  'a cold Flowise start does not delay the browser and RAG services',
  { timeout: 2000 },
  async () => {
    let releaseFlowise;
    const slow = new Promise((done) => {
      releaseFlowise = done;
    });
    let reportBrowser;
    const browserReported = new Promise((done) => {
      reportBrowser = done;
    });
    const started = [];
    const results = startServices(
      [
        { name: 'flowise', port: 3002 },
        { name: 'moa', port: 3001 },
        { name: 'rag', port: 8765 },
      ],
      {
        start: async (service) => {
          started.push(service.name);
          if (service.name === 'flowise') await slow;
          return { status: 'ready', port: service.port };
        },
        onResult: (service) => {
          if (service.name === 'moa') reportBrowser();
        },
      },
    );
    try {
      await browserReported;
      assert.deepEqual(started, ['flowise', 'moa', 'rag']);
    } finally {
      releaseFlowise();
    }
    assert.deepEqual(Object.keys(await results), ['flowise', 'moa', 'rag']);
  },
);

test('one failed service does not prevent healthy services from preparing', async () => {
  const result = await startServices(
    [
      { name: 'broken', port: 3002 },
      { name: 'moa', port: 3001 },
    ],
    {
      start: async (service) => {
        if (service.name === 'broken')
          throw new Error('private runtime detail');
        return { status: 'ready', port: service.port };
      },
    },
  );
  assert.deepEqual(result.broken, {
    status: 'start-failed',
    port: 3002,
    code: 'SERVICE_START_FAILED',
  });
  assert.equal(result.moa.status, 'ready');
  assert.doesNotMatch(JSON.stringify(result), /private runtime detail/);
});

test('Flowise health accepts the pinned version as plain text, JSON string or JSON object', () => {
  for (const response of [
    '3.1.4',
    ' 3.1.4\n',
    '"3.1.4"',
    '{"version":"3.1.4"}',
  ])
    assert.equal(isFlowiseRuntimeHealth(response), true, response);
  for (const response of [
    '3.1.40',
    '"3.1.5"',
    '{"version":"3.1.5"}',
    '{"version":314}',
    '{"message":"3.1.4"}',
    '{}',
    'null',
    '[]',
    '{not-json',
    '',
    undefined,
  ])
    assert.equal(isFlowiseRuntimeHealth(response), false, String(response));
});

test('hidden descendants retain callbacks, pipes, IPC, environment and other spawn options', () => {
  const callback = () => {};
  const options = {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { EXAMPLE: 'retained' },
    detached: false,
    windowsHide: false,
  };
  const input = [['--flag'], options, callback];
  const result = hiddenArguments(input);
  assert.deepEqual(result, [
    ['--flag'],
    { ...options, windowsHide: true },
    callback,
  ]);
  assert.equal(result[1].env, options.env);
  assert.equal(options.windowsHide, false);
  assert.deepEqual(hiddenArguments([callback]), [
    { windowsHide: true },
    callback,
  ]);
  assert.deepEqual(hiddenArguments([]), [{ windowsHide: true }]);
  assert.deepEqual(hiddenArguments([['arg']]), [
    ['arg'],
    { windowsHide: true },
  ]);
});

test('all local Windows subprocess entry points hide windows, including promisified exec', async () => {
  const calls = [];
  const target = {};
  for (const name of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ]) {
    target[name] = (...args) => {
      calls.push({ name, args });
      return name;
    };
  }
  target.execFile[promisify.custom] = (...args) =>
    Promise.resolve({ stdout: 'ok', stderr: '', args });
  assert.equal(installHiddenChildren(target, 'linux'), false);
  assert.equal(installHiddenChildren(target, 'win32'), true);
  assert.equal(installHiddenChildren(target, 'win32'), false);
  for (const name of Object.keys(target)) {
    const args =
      name === 'exec' || name === 'execSync'
        ? [{ cwd: 'test-cwd' }]
        : [['argument'], { cwd: 'test-cwd' }];
    assert.equal(target[name]('test.exe', ...args), name);
  }
  assert.equal(calls.length, 7);
  for (const call of calls) {
    const args =
      call.name === 'exec' || call.name === 'execSync' ? [] : [['argument']];
    assert.deepEqual(call.args, [
      'test.exe',
      ...args,
      { cwd: 'test-cwd', windowsHide: true },
    ]);
  }
  const result = await promisify(target.execFile)('test.exe', ['arg']);
  assert.equal(result.stdout, 'ok');
  assert.deepEqual(result.args, ['test.exe', ['arg'], { windowsHide: true }]);
});

test('explicit undefined options are replaced in the native options slot', () => {
  const callback = () => {};
  assert.deepEqual(hiddenArguments([['arg'], undefined]), [
    ['arg'],
    { windowsHide: true },
  ]);
  assert.deepEqual(
    hiddenArguments([['arg'], undefined, callback], 'execFile'),
    [['arg'], { windowsHide: true }, callback],
  );
  assert.deepEqual(hiddenArguments([undefined, callback], 'exec'), [
    { windowsHide: true },
    callback,
  ]);
  assert.deepEqual(hiddenArguments([undefined, { cwd: 'retained' }], 'spawn'), [
    undefined,
    { cwd: 'retained', windowsHide: true },
  ]);
  assert.deepEqual(
    hiddenArguments([null, { cwd: 'retained' }, callback], 'execFile'),
    [null, { cwd: 'retained', windowsHide: true }, callback],
  );
});

test('native optional argv, undefined options, and callbacks still run after the preload', async () => {
  const native = require('node:child_process');
  const value = await new Promise((done, reject) => {
    native.execFile(
      process.execPath,
      ['-e', "process.stdout.write('callback-output')"],
      undefined,
      (error, stdout) => (error ? reject(error) : done(stdout)),
    );
  });
  assert.equal(value, 'callback-output');
  const child = native.spawn(
    process.execPath,
    ['-e', "process.stdout.write('spawn-output')"],
    undefined,
  );
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (part) => {
    output += part;
  });
  assert.deepEqual(await once(child, 'exit'), [0, null]);
  assert.equal(output, 'spawn-output');
  const result = native.spawnSync(process.execPath, undefined, {
    input: "process.stdout.write('no-argv-output')",
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'no-argv-output');
});

test('background environment is inherited without losing existing Node options or duplicating preload', () => {
  const original = { NODE_OPTIONS: '--no-warnings', EXAMPLE: 'retained' };
  const environment = backgroundEnvironment(original);
  assert.equal(environment.EXAMPLE, 'retained');
  assert.equal(original.NODE_OPTIONS, '--no-warnings');
  if (process.platform === 'win32') {
    assert.match(environment.NODE_OPTIONS, /^--no-warnings --require=/);
    assert.match(environment.NODE_OPTIONS, /local-hidden-children\.cjs/);
    assert.equal(
      backgroundEnvironment(environment).NODE_OPTIONS,
      environment.NODE_OPTIONS,
    );
  } else assert.deepEqual(environment, original);
});

test('Windows double-click entry uses a hidden no-profile bootstrap and direct Node executable', async () => {
  const entry = await readFile(
    new URL('../Spotlog 시작.vbs', import.meta.url),
    'utf8',
  );
  const bootstrap = await readFile(
    new URL('../scripts/start-local-hidden.ps1', import.meta.url),
    'utf8',
  );
  assert.match(entry, /-NoProfile -NonInteractive/);
  assert.match(entry, /shell\.Run command, 0, False/);
  assert.match(bootstrap, /StartInfo\.CreateNoWindow = \$true/);
  assert.match(bootstrap, /StartInfo\.UseShellExecute = \$false/);
  assert.match(
    bootstrap,
    /StartInfo\.WindowStyle = \[Diagnostics\.ProcessWindowStyle\]::Hidden/,
  );
  assert.match(bootstrap, /--require/);
  assert.match(bootstrap, /launcher-status\.json/);
  assert.match(bootstrap, /\$child\.WaitForExit\(\)/);
  assert.doesNotMatch(bootstrap.replace(/^\s*#.*$/gm, ''), /-PassThru\s+-Wait/);
  assert.doesNotMatch(
    bootstrap.replace(/^\s*#.*$/gm, ''),
    /Stop-Process|taskkill|cmd\.exe|npm\.cmd/,
  );
});

test('preload preserves native promisified execFile output and child handle', async () => {
  const native = require('node:child_process');
  const run = promisify(native.execFile);
  const pending = run(process.execPath, [
    '-e',
    "process.stdout.write('standard-output');process.stderr.write('standard-error')",
  ]);
  assert.ok(pending.child?.pid);
  const result = await pending;
  assert.equal(result.stdout, 'standard-output');
  assert.equal(result.stderr, 'standard-error');
});

async function server(body, status = 200) {
  const instance = createServer((_request, response) => {
    response.writeHead(status);
    response.end(body);
  });
  instance.listen(0, '127.0.0.1');
  await once(instance, 'listening');
  return instance;
}
function service(port, extra = {}) {
  return {
    name: `test-local-stack-${process.pid}`,
    port,
    urls: [`http://127.0.0.1:${port}/health`],
    check: (text) => text === 'ready',
    executable: process.execPath,
    args: [],
    required: [],
    environment: {},
    timeoutMs: 4000,
    ...extra,
  };
}

test('existing healthy service is reused without installation or spawn', async () => {
  const instance = await server('ready');
  try {
    const result = await startService(
      service(instance.address().port, {
        executable: 'does-not-exist',
        required: ['does-not-exist'],
      }),
    );
    assert.equal(result.status, 'ready');
    assert.equal(result.reused, true);
    assert.equal(result.started, undefined);
  } finally {
    await new Promise((done) => instance.close(done));
  }
});

test('unrelated HTTP server is preserved and reported as port conflict', async () => {
  const instance = await server('another application');
  try {
    const description = service(instance.address().port, {
      executable: 'does-not-exist',
    });
    assert.equal((await inspect(description)).status, 'port-conflict');
    assert.equal((await startService(description)).status, 'port-conflict');
    const response = await fetch(description.urls[0]);
    assert.equal(await response.text(), 'another application');
  } finally {
    await new Promise((done) => instance.close(done));
  }
});

test('detached service survives launcher completion and next run reuses it', async () => {
  const placeholder = await server('unused');
  const port = placeholder.address().port;
  await new Promise((done) => placeholder.close(done));
  const name = `test-local-stack-${process.pid}-detached`;
  const description = service(port, {
    name,
    args: [
      '--input-type=module',
      '-e',
      `import{createServer}from'node:http';createServer((q,s)=>s.end('ready')).listen(${port},'127.0.0.1');`,
    ],
  });
  let child;
  try {
    const first = await startService(description);
    assert.equal(first.status, 'ready');
    assert.equal(first.started, true);
    const record = JSON.parse(
      await readFile(
        resolve(`.sites-runtime/ai/stack/${name}.process.json`),
        'utf8',
      ),
    );
    child = record.pid;
    assert.equal(child, first.pid);
    process.kill(child, 0);
    const second = await startService(description);
    assert.equal(second.status, 'ready');
    assert.equal(second.reused, true);
    assert.equal(second.started, undefined);
    assert.equal(await (await fetch(description.urls[0])).text(), 'ready');
  } finally {
    if (child) {
      try {
        process.kill(child);
      } catch {}
    }
    for (const suffix of ['process.json', 'stdout.log', 'stderr.log'])
      await rm(resolve(`.sites-runtime/ai/stack/${name}.${suffix}`), {
        force: true,
      });
  }
});

test('retry waits for a recorded cold-start process instead of spawning a duplicate', async () => {
  const placeholder = await server('unused');
  const port = placeholder.address().port;
  await new Promise((done) => placeholder.close(done));
  const name = `test-local-stack-${process.pid}-pending`;
  const recordPath = resolve(`.sites-runtime/ai/stack/${name}.process.json`);
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import{createServer}from'node:http';setTimeout(()=>createServer((q,s)=>s.end('ready')).listen(${port},'127.0.0.1'),500);`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  await once(child, 'spawn');
  try {
    await mkdir(resolve('.sites-runtime/ai/stack'), { recursive: true });
    await writeFile(
      recordPath,
      JSON.stringify({ pid: child.pid, executable: process.execPath, port }),
    );
    const result = await startService(
      service(port, { name, args: ['--invalid-node-start-option'] }),
    );
    assert.equal(result.status, 'ready');
    assert.equal(result.reused, true);
    assert.equal(result.pid, child.pid);
    assert.equal(JSON.parse(await readFile(recordPath, 'utf8')).pid, child.pid);
  } finally {
    child.kill();
    for (const suffix of ['process.json', 'stdout.log', 'stderr.log'])
      await rm(resolve(`.sites-runtime/ai/stack/${name}.${suffix}`), {
        force: true,
      });
  }
});
