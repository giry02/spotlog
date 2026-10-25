import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  installHiddenChildren,
} = require('../scripts/local-hidden-children.cjs');
const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const preload = fileURLToPath(
  new URL('../scripts/local-hidden-children.cjs', import.meta.url),
);

test('installing a simulated Windows target never changes the process environment', () => {
  const before = process.env.NODE_OPTIONS;
  const target = Object.fromEntries(
    [
      'spawn',
      'spawnSync',
      'exec',
      'execSync',
      'execFile',
      'execFileSync',
      'fork',
    ].map((name) => [name, () => {}]),
  );
  // A fresh sentinel catches accidental propagation from a fake target even
  // when this test process was itself started with the real preload.
  process.env.NODE_OPTIONS = '--no-warnings';
  try {
    assert.equal(installHiddenChildren(target, 'win32'), true);
    assert.equal(target[Symbol.for('spotlog.localHiddenChildren')], true);
    assert.equal(process.env.NODE_OPTIONS, '--no-warnings');
  } finally {
    if (before === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = before;
  }
});

test(
  'CLI preload survives a Node grandchild in another working directory without duplicating background flags',
  { skip: process.platform !== 'win32' },
  async () => {
    const otherDirectory = await mkdtemp(
      join(tmpdir(), 'spotlog-hidden-entry-'),
    );
    try {
      const childScript = `
        const childProcess = require('node:child_process');
        process.stdout.write(JSON.stringify({
          installed: childProcess[Symbol.for('spotlog.localHiddenChildren')] === true,
          nodeOptions: process.env.NODE_OPTIONS,
          cwd: process.cwd(),
        }));
      `;
      const backgroundModule = new URL(
        '../scripts/start-local-stack.mjs',
        import.meta.url,
      ).href;
      const parentScript = `
        (async () => {
          const { spawnSync } = require('node:child_process');
          const { backgroundEnvironment } = await import(${JSON.stringify(backgroundModule)});
          const original = process.env.NODE_OPTIONS;
          const environment = backgroundEnvironment(process.env);
          const result = spawnSync(process.execPath, ['-e', ${JSON.stringify(childScript)}], {
            cwd: ${JSON.stringify(otherDirectory)},
            encoding: 'utf8',
            env: environment,
          });
          if (result.error) throw result.error;
          if (result.status !== 0) throw new Error('HIDDEN_GRANDCHILD_FAILED');
          process.stdout.write(JSON.stringify({
            ...JSON.parse(result.stdout),
            backgroundFlagUnchanged: environment.NODE_OPTIONS === original,
          }));
        })().catch(() => { process.exitCode = 1; });
      `;
      const { stdout, stderr } = await run(
        process.execPath,
        [
          '--require',
          './scripts/local-hidden-children.cjs',
          '-e',
          parentScript,
        ],
        {
          cwd: projectRoot,
          env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
          windowsHide: true,
          timeout: 15000,
        },
      );
      assert.equal(stderr, '');
      const result = JSON.parse(stdout);
      assert.equal(result.installed, true);
      assert.equal(result.cwd, otherDirectory);
      assert.equal(result.backgroundFlagUnchanged, true);
      assert.ok(result.nodeOptions.startsWith('--no-warnings '));
      const flag = `--require=${JSON.stringify(preload)}`;
      assert.equal(result.nodeOptions.split(flag).length - 1, 1);
    } finally {
      await rmdir(otherDirectory);
    }
  },
);

test(
  'fork inherits the normalized own preload across working directories and keeps other CLI flags',
  { skip: process.platform !== 'win32' },
  async () => {
    const otherDirectory = await mkdtemp(
      join(tmpdir(), 'spotlog hidden fork '),
    );
    const childModule = join(otherDirectory, 'verify-child.cjs');
    try {
      await writeFile(
        childModule,
        `
          const childProcess = require('node:child_process');
          process.send({
            installed: childProcess[Symbol.for('spotlog.localHiddenChildren')] === true,
            execArgv: process.execArgv,
            nodeOptions: process.env.NODE_OPTIONS,
            cwd: process.cwd(),
          });
          process.disconnect();
        `,
      );
      const relativePreload = './scripts/local-hidden-children.cjs';
      const variants = [
        {
          input: ['--require', relativePreload],
          normalized: ['--require', preload],
        },
        { input: ['-r', relativePreload], normalized: ['-r', preload] },
        {
          input: [`--require=${relativePreload}`],
          normalized: [`--require=${preload}`],
        },
      ];
      for (const variant of variants) {
        const flags = ['--no-deprecation', ...variant.input];
        const parentScript = `
          const { fork } = require('node:child_process');
          const parentFlags = process.execArgv.slice(0, ${flags.length});
          const child = fork(${JSON.stringify(childModule)}, [], {
            cwd: ${JSON.stringify(otherDirectory)},
            stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
          });
          let result;
          child.stderr.on('data', (value) => process.stderr.write(value));
          child.on('message', (value) => { result = value; });
          child.on('error', () => { process.exitCode = 1; });
          child.on('exit', (code, signal) => {
            if (code !== 0 || signal || !result) { process.exitCode = 1; return; }
            process.stdout.write(JSON.stringify({ ...result, parentFlags }));
          });
        `;
        const { stdout, stderr } = await run(
          process.execPath,
          [...flags, '-e', parentScript],
          {
            cwd: projectRoot,
            env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
            windowsHide: true,
            timeout: 15000,
          },
        );
        assert.equal(stderr, '');
        const result = JSON.parse(stdout);
        const expectedFlags = ['--no-deprecation', ...variant.normalized];
        assert.deepEqual(result.parentFlags, expectedFlags);
        assert.deepEqual(result.execArgv, expectedFlags);
        assert.equal(result.installed, true);
        assert.equal(result.cwd, otherDirectory);
        assert.ok(result.nodeOptions.startsWith('--no-warnings '));
        const flag = `--require=${JSON.stringify(preload)}`;
        assert.equal(result.nodeOptions.split(flag).length - 1, 1);
      }
    } finally {
      await unlink(childModule);
      await rmdir(otherDirectory);
    }
  },
);
