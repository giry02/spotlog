// One-shot local startup recovery. This is not a watcher or scheduler.
// Only the RAG process is started; existing Flowise/Ollama runtimes are reused.
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { backgroundEnvironment } from './start-local-stack.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(projectRoot, '.sites-runtime/ai/rag');
const healthyModes = ['authored-demo-data', 'curated-travel-data'];

async function boundedHealth(url, check, timeoutMs = 2000) {
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, 2000))),
    });
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get('content-length') ?? 0) > 8192
    )
      return { ok: false, responded: true };
    const reader = response.body.getReader();
    let text = '';
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 8192) return { ok: false, responded: true };
        text += new TextDecoder().decode(part.value);
      }
    } finally {
      void reader.cancel().catch(() => {});
    }
    const metadata = check(text);
    return metadata
      ? { ok: true, responded: true, ...metadata }
      : { ok: false, responded: true };
  } catch {
    return { ok: false, responded: false };
  }
}

function ragHealth(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return;
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !healthyModes.includes(body.dataMode) ||
    !['ready', 'unindexed'].includes(body.status) ||
    !Number.isSafeInteger(body.documents) ||
    body.documents < 0
  )
    return;
  if (
    body.status === 'ready' &&
    (typeof body.indexVersion !== 'string' ||
      !/^idx:[a-zA-Z0-9:-]{1,160}$/.test(body.indexVersion) ||
      typeof body.embeddingModel !== 'string' ||
      !Number.isInteger(body.dimensions) ||
      body.dimensions < 1)
  )
    return;
  return {
    status: body.status,
    documents: body.documents,
    indexVersion: body.indexVersion ?? null,
    embeddingModel: body.embeddingModel ?? null,
  };
}

function flowiseHealth(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = text.trim();
  }
  const version = typeof value === 'string' ? value : value?.version;
  return typeof version === 'string' &&
    /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)
    ? { status: 'ready', version }
    : undefined;
}

function ollamaHealth(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return;
  }
  return typeof body?.version === 'string' &&
    /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(body.version)
    ? { status: 'ready', version: body.version }
    : undefined;
}

function isPortBound(port) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (bound) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePort(bound);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function inspectService(port, path, checker) {
  const health = await boundedHealth(
    `http://127.0.0.1:${port}${path}`,
    checker,
  );
  if (health.ok) {
    const { ok, responded, ...metadata } = health;
    return { port, ...metadata };
  }
  return {
    port,
    status:
      health.responded || (await isPortBound(port))
        ? 'port-conflict'
        : 'unavailable',
  };
}

async function configuredRagPort() {
  let saved = {};
  try {
    saved = JSON.parse(
      await readFile(resolve(runtimeDir, 'config.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('RAG_CONFIG_INVALID');
  }
  const port = Number(process.env.RAG_PORT || saved.RAG_PORT || 8765);
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    port === 3002 ||
    port === 11434
  )
    throw new Error('RAG_PORT_INVALID');
  return port;
}

async function startRag(port) {
  // Verify this exact executable can run native SQLite and typed project files.
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error('NODE_24_OR_NEWER_REQUIRED');
  await import('node:sqlite');
  await mkdir(runtimeDir, { recursive: true });
  const stdoutPath = resolve(runtimeDir, 'service.stdout.log');
  const stderrPath = resolve(runtimeDir, 'service.stderr.log');
  const stdout = openSync(stdoutPath, 'a');
  const stderr = openSync(stderrPath, 'a');
  let child;
  let spawnError;
  let exitCode;
  try {
    child = spawn(
      process.execPath,
      [resolve(projectRoot, 'scripts/rag/cli.mjs'), 'serve'],
      {
        cwd: projectRoot,
        detached: true,
        windowsHide: true,
        env: backgroundEnvironment(),
        stdio: ['ignore', stdout, stderr],
      },
    );
    child.once('error', () => {
      spawnError = true;
    });
    child.once('exit', (code) => {
      exitCode = code;
    });
    child.unref();
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && !spawnError && exitCode === undefined) {
    const health = await boundedHealth(
      `http://127.0.0.1:${port}/health`,
      ragHealth,
      Math.min(2000, deadline - Date.now()),
    );
    if (health.ok) {
      const metadata = {
        pid: child.pid,
        startedAt: new Date().toISOString(),
        executable: process.execPath,
        port,
      };
      await writeFile(
        resolve(runtimeDir, 'service-process.json'),
        JSON.stringify(metadata, null, 2) + '\n',
      );
      const { ok, responded, ...service } = health;
      return { port, ...service, started: true, pid: child.pid };
    }
    if (health.responded) break;
    const remaining = deadline - Date.now();
    if (remaining > 0)
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, Math.min(250, remaining)),
      );
  }
  // This is our newly created child only. No existing process is terminated.
  if (child?.pid && exitCode === undefined) child.kill();
  return {
    port,
    status: 'start-failed',
    code: spawnError
      ? 'SPAWN_FAILED'
      : exitCode !== undefined
        ? 'PROCESS_EXITED'
        : 'HEALTH_CHECK_FAILED',
    stdoutPath,
    stderrPath,
  };
}

export async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error('NODE_24_OR_NEWER_REQUIRED');
  const port = await configuredRagPort();
  const [rag, flowise, ollama] = await Promise.all([
    inspectService(port, '/health', ragHealth),
    inspectService(3002, '/api/v1/version', flowiseHealth),
    inspectService(11434, '/api/version', ollamaHealth),
  ]);
  const services = {
    rag:
      rag.status === 'unavailable'
        ? await startRag(port)
        : { ...rag, reused: rag.status !== 'port-conflict' },
    flowise,
    ollama,
  };
  const notices = [];
  if (services.rag.status === 'port-conflict')
    notices.push(
      'RAG 포트에 다른 서비스가 있어 시작하지 않았습니다. 포트 사용 상태를 확인해 주세요.',
    );
  if (services.rag.status === 'unindexed')
    notices.push(
      'RAG 서버는 실행 중이지만 색인이 없습니다. npm run rag:seed로 자료를 색인해 주세요.',
    );
  if (services.rag.status === 'start-failed')
    notices.push(
      'RAG 시작 상태를 확인하지 못했습니다. 표시된 로컬 로그를 확인해 주세요.',
    );
  if (flowise.status !== 'ready')
    notices.push(
      'Flowise(3002)가 준비되지 않았습니다. 기존 로컬 런타임을 npm run flowise:start로 시작해 주세요.',
    );
  if (ollama.status !== 'ready')
    notices.push(
      'Ollama(11434)가 준비되지 않았습니다. 기존에 설치한 로컬 Ollama를 시작해 주세요.',
    );
  const passed = Object.values(services).every(
    (service) => service.status === 'ready',
  );
  console.log(JSON.stringify({ passed, services, notices }, null, 2));
  if (!passed) process.exitCode = 1;
  return { passed, services, notices };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const code = [
      'NODE_24_OR_NEWER_REQUIRED',
      'RAG_CONFIG_INVALID',
      'RAG_PORT_INVALID',
    ].includes(error.message)
      ? error.message
      : 'LOCAL_SERVICE_SETUP_FAILED';
    console.error(JSON.stringify({ passed: false, code }));
    process.exitCode = 1;
  });
}
