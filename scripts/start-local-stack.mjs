// Start this project's already installed local stack once. No watcher, task,
// login item, model download, or public listener is installed by this command.
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { closeSync, openSync } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  launchWindowsOllama,
  WINDOWS_OLLAMA_LAUNCH_MODE,
} from './launch-windows-ollama.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(projectRoot, '.sites-runtime/ai');
const logRoot = resolve(runtimeRoot, 'stack');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export function backgroundEnvironment(environment = process.env) {
  if (process.platform !== 'win32') return { ...environment };
  const preload = resolve(projectRoot, 'scripts/local-hidden-children.cjs');
  const flag = `--require=${JSON.stringify(preload)}`;
  const current = environment.NODE_OPTIONS || '';
  return {
    ...environment,
    NODE_OPTIONS: current.includes(flag)
      ? current
      : `${current} ${flag}`.trim(),
  };
}

async function health(url, check) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok || !response.body) return { status: 'port-conflict' };
    let bytes = 0;
    let value = '';
    const reader = response.body.getReader();
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 131072) return { status: 'port-conflict' };
        value += new TextDecoder().decode(part.value);
      }
    } finally {
      void reader.cancel().catch(() => {});
    }
    return check(value, response)
      ? { status: 'ready', url }
      : { status: 'port-conflict' };
  } catch {
    return { status: 'unavailable' };
  }
}

async function portBound(port) {
  const checks = await Promise.all(
    ['127.0.0.1', '::1'].map(
      (host) =>
        new Promise((done) => {
          const socket = createConnection({ port, host });
          let finished = false;
          const finish = (bound) => {
            if (finished) return;
            finished = true;
            socket.destroy();
            done(bound);
          };
          socket.setTimeout(800);
          socket.once('connect', () => finish(true));
          socket.once('timeout', () => finish(false));
          socket.once('error', () => finish(false));
        }),
    ),
  );
  return checks.some(Boolean);
}

const jsonMatches = (check) => (text) => {
  try {
    return check(JSON.parse(text));
  } catch {
    return false;
  }
};

export function isFlowiseRuntimeHealth(text) {
  return (
    typeof text === 'string' &&
    (text.trim() === '3.1.4' ||
      jsonMatches((body) => body === '3.1.4' || body?.version === '3.1.4')(
        text,
      ))
  );
}

export async function inspect(service) {
  const results = await Promise.all(
    service.urls.map((url) => health(url, service.check)),
  );
  const ready = results.find((result) => result.status === 'ready');
  if (ready) return { ...ready, port: service.port };
  return {
    status:
      results.some((result) => result.status === 'port-conflict') ||
      (await portBound(service.port))
        ? 'port-conflict'
        : 'unavailable',
    port: service.port,
  };
}

export async function startService(service) {
  const existing = await inspect(service);
  if (existing.status !== 'unavailable')
    return { ...existing, reused: existing.status === 'ready' };
  const windowsOllama =
    process.platform === 'win32' && service.name === 'ollama';
  const required = windowsOllama
    ? [
        ...service.required,
        resolve(projectRoot, 'scripts/start-windows-ollama.ps1'),
      ]
    : service.required;
  for (const path of required) {
    try {
      await access(path);
    } catch {
      return { status: 'installation-missing', port: service.port, path };
    }
  }
  await mkdir(logRoot, { recursive: true });
  const stdoutPath = resolve(logRoot, `${service.name}.stdout.log`);
  const stderrPath = resolve(logRoot, `${service.name}.stderr.log`);
  let child;
  let spawnFailed = false;
  let exited = false;
  const recordPath = resolve(logRoot, `${service.name}.process.json`);
  let pending;
  try {
    const saved = JSON.parse(await readFile(recordPath, 'utf8'));
    if (
      resolve(saved.executable) === service.executable &&
      saved.port === service.port
    ) {
      const candidates = [saved.pid];
      if (windowsOllama && saved.launchMode === WINDOWS_OLLAMA_LAUNCH_MODE)
        candidates.push(saved.launcherPid);
      for (const pid of candidates) {
        if (!Number.isSafeInteger(pid) || pid <= 0) continue;
        try {
          process.kill(pid, 0);
          pending = saved;
          break;
        } catch {}
      }
    }
  } catch {}
  if (pending) {
    const deadline = Date.now() + service.timeoutMs;
    while (Date.now() < deadline) {
      const current = await inspect(service);
      if (current.status === 'ready') {
        if (
          windowsOllama &&
          pending.launchMode === WINDOWS_OLLAMA_LAUNCH_MODE
        ) {
          try {
            const latest = JSON.parse(await readFile(recordPath, 'utf8'));
            if (
              latest.launchId === pending.launchId &&
              latest.launcherPid === pending.launcherPid &&
              Number.isSafeInteger(latest.pid) &&
              latest.pid > 0 &&
              latest.pid !== latest.launcherPid
            )
              pending = latest;
          } catch {}
        }
        return {
          ...current,
          reused: true,
          ...(Number.isSafeInteger(pending.pid) ? { pid: pending.pid } : {}),
          ...(windowsOllama && Number.isSafeInteger(pending.launcherPid)
            ? {
                launcherPid: pending.launcherPid,
                launchMode: pending.launchMode,
              }
            : {}),
        };
      }
      await wait(250);
    }
    return {
      status: 'start-failed',
      port: service.port,
      code: 'EXISTING_PROCESS_NOT_READY',
      pid: pending.pid,
      stdoutPath,
      stderrPath,
    };
  }
  if (windowsOllama)
    return launchWindowsOllama(service, {
      projectRoot,
      recordPath,
      stdoutPath,
      stderrPath,
      environment: backgroundEnvironment({
        ...process.env,
        ...service.environment,
      }),
      inspectService: inspect,
    });
  const stdout = openSync(stdoutPath, 'a');
  const stderr = openSync(stderrPath, 'a');
  try {
    child = spawn(service.executable, service.args, {
      cwd: projectRoot,
      detached: true,
      windowsHide: true,
      env: backgroundEnvironment({ ...process.env, ...service.environment }),
      stdio: ['ignore', stdout, stderr],
    });
    child.once('error', () => {
      spawnFailed = true;
    });
    child.once('exit', () => {
      exited = true;
    });
    child.unref();
    if (child.pid)
      await writeFile(
        recordPath,
        JSON.stringify(
          {
            pid: child.pid,
            startedAt: new Date().toISOString(),
            executable: service.executable,
            port: service.port,
          },
          null,
          2,
        ) + '\n',
      );
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  const deadline = Date.now() + service.timeoutMs;
  while (Date.now() < deadline && !spawnFailed && !exited) {
    const current = await inspect(service);
    if (current.status === 'ready') {
      await writeFile(
        resolve(logRoot, `${service.name}.process.json`),
        JSON.stringify(
          {
            pid: child.pid,
            startedAt: new Date().toISOString(),
            executable: service.executable,
            port: service.port,
          },
          null,
          2,
        ) + '\n',
      );
      return { ...current, started: true, pid: child.pid };
    }
    // A just-starting service can open its port before its routes exist.
    // Wait for health without terminating any existing process.
    await wait(250);
  }
  return {
    status: 'start-failed',
    port: service.port,
    code: spawnFailed
      ? 'SPAWN_FAILED'
      : exited
        ? 'PROCESS_EXITED'
        : 'HEALTH_CHECK_TIMEOUT',
    stdoutPath,
    stderrPath,
  };
}

export async function startServices(
  services,
  { start = startService, onResult = () => {} } = {},
) {
  // Their health routes do not depend on each other. A cold Flowise import must
  // not hold the browser and RAG server behind its longer preparation window.
  const entries = await Promise.all(
    services.map(async (service) => {
      let result;
      try {
        result = await start(service);
      } catch {
        result = {
          status: 'start-failed',
          port: service.port,
          code: 'SERVICE_START_FAILED',
        };
      }
      onResult(service, result);
      return [service.name, result];
    }),
  );
  return Object.fromEntries(entries);
}

async function startStack() {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error('NODE_24_OR_NEWER_REQUIRED');
  let ragConfig;
  try {
    ragConfig = JSON.parse(
      await readFile(resolve(runtimeRoot, 'rag/config.json'), 'utf8'),
    );
  } catch {
    throw new Error('EXISTING_RAG_CONFIGURATION_REQUIRED');
  }
  const ragPort = Number(process.env.RAG_PORT || ragConfig.RAG_PORT || 8765);
  if (
    !Number.isInteger(ragPort) ||
    ragPort < 1024 ||
    ragPort > 65535 ||
    [3001, 3002, 11434].includes(ragPort)
  )
    throw new Error('RAG_PORT_INVALID');
  const ollamaExe = resolve(runtimeRoot, 'ollama-0.40.4/ollama.exe');
  const flowiseLauncher = resolve(
    projectRoot,
    'scripts/flowise/local-runtime.mjs',
  );
  const flowiseExe = resolve(runtimeRoot, 'node-v24.22.0-win-x64/node.exe');
  const ragLauncher = resolve(projectRoot, 'scripts/rag/cli.mjs');
  const moaLauncher = resolve(projectRoot, 'node_modules/vinext/dist/cli.js');
  const services = [
    {
      name: 'ollama',
      port: 11434,
      urls: ['http://127.0.0.1:11434/api/version'],
      check: jsonMatches((body) => body?.version === '0.40.4'),
      executable: ollamaExe,
      args: ['serve'],
      required: [ollamaExe, resolve(runtimeRoot, 'models')],
      environment: {
        OLLAMA_HOST: '127.0.0.1:11434',
        OLLAMA_MODELS: resolve(runtimeRoot, 'models'),
        OLLAMA_NO_CLOUD: '1',
      },
      timeoutMs: 45000,
    },
    {
      name: 'flowise',
      port: 3002,
      urls: ['http://127.0.0.1:3002/api/v1/version'],
      check: isFlowiseRuntimeHealth,
      executable: flowiseExe,
      args: [flowiseLauncher],
      required: [
        flowiseExe,
        flowiseLauncher,
        resolve(runtimeRoot, 'flowise/node_modules/flowise/bin/run'),
        resolve(runtimeRoot, 'flowise-data/database.sqlite'),
        resolve(runtimeRoot, 'flowise-data/config.json'),
      ],
      environment: { FLOWISE_PORT: '3002' },
      // A cold import on this Windows runtime has exceeded five minutes.
      // Other services prepare independently and keep their shorter limits.
      timeoutMs: 600000,
    },
    {
      name: 'rag',
      port: ragPort,
      urls: [`http://127.0.0.1:${ragPort}/health`],
      check: jsonMatches(
        (body) =>
          body?.status === 'ready' &&
          ['authored-demo-data', 'curated-travel-data'].includes(
            body.dataMode,
          ) &&
          body.documents > 0 &&
          typeof body.indexVersion === 'string',
      ),
      executable: process.execPath,
      args: [ragLauncher, 'serve'],
      required: [
        ragLauncher,
        resolve(runtimeRoot, 'rag/config.json'),
        resolve(runtimeRoot, 'rag/rag.sqlite'),
      ],
      environment: { RAG_PORT: String(ragPort) },
      timeoutMs: 15000,
    },
    {
      name: 'moa',
      port: 3001,
      urls: [
        'http://localhost:3001/',
        'http://127.0.0.1:3001/',
        'http://[::1]:3001/',
      ],
      check: (text, response) =>
        /text\/html/i.test(response.headers.get('content-type') || '') &&
        /모아|Moa|moa/.test(text),
      executable: process.execPath,
      args: [
        moaLauncher,
        'dev',
        '--host',
        'localhost',
        '--port',
        '3001',
        '--strictPort',
      ],
      required: [moaLauncher, resolve(projectRoot, '.dev.vars')],
      environment: { MOA_DEV_HOST: 'localhost' },
      timeoutMs: 45000,
    },
  ];
  const result = await startServices(services, {
    onResult: (service, result) =>
      console.log(JSON.stringify({ service: service.name, ...result })),
  });
  const passed = services.every(
    (service) => result[service.name]?.status === 'ready',
  );
  const output = {
    passed,
    services: result,
    ...(passed
      ? { url: result.moa.url }
      : {
          notice:
            '서비스 준비를 확인하지 못했습니다. 기존 프로세스는 종료하지 않았습니다. 표시된 상태와 로컬 로그를 확인해 주세요.',
        }),
  };
  console.log(JSON.stringify(output, null, 2));
  if (!passed) process.exitCode = 1;
  return output;
}

export async function main() {
  await mkdir(logRoot, { recursive: true });
  const lockPath = resolve(logRoot, 'startup.lock');
  const token = JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });
  let acquired = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(lockPath, token, { flag: 'wx' });
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let saved;
      try {
        saved = await readFile(lockPath, 'utf8');
      } catch {
        continue;
      }
      let alive = false;
      try {
        const prior = JSON.parse(saved);
        if (Number.isSafeInteger(prior.pid) && prior.pid > 0) {
          process.kill(prior.pid, 0);
          alive = true;
        }
      } catch {}
      if (alive || attempt === 1) throw new Error('STACK_START_IN_PROGRESS');
      if ((await readFile(lockPath, 'utf8')) === saved) await rm(lockPath);
    }
  }
  if (!acquired) throw new Error('STACK_START_IN_PROGRESS');
  try {
    return await startStack();
  } finally {
    try {
      if ((await readFile(lockPath, 'utf8')) === token) await rm(lockPath);
    } catch {}
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const known = [
      'NODE_24_OR_NEWER_REQUIRED',
      'EXISTING_RAG_CONFIGURATION_REQUIRED',
      'RAG_PORT_INVALID',
      'STACK_START_IN_PROGRESS',
    ];
    console.error(
      JSON.stringify({
        passed: false,
        code: known.includes(error.message)
          ? error.message
          : 'LOCAL_STACK_START_FAILED',
      }),
    );
    process.exitCode = 1;
  });
}
