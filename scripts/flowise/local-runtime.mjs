import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LOCAL_HTTP_DENY_LIST } from './chatflow.mjs';
import { backgroundEnvironment } from '../start-local-stack.mjs';

const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const data = resolve(
  process.env.MOA_FLOWISE_DATA_DIR ||
    resolve(project, '.sites-runtime/ai/flowise-data'),
);
const runtime = resolve(
  process.env.MOA_FLOWISE_RUNTIME_DIR ||
    resolve(project, '.sites-runtime/ai/flowise'),
);
const port = Number(process.env.FLOWISE_PORT || 3002);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid FLOWISE_PORT');
await mkdir(data, { recursive: true });
const environment = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(port),
  DATABASE_TYPE: 'sqlite',
  DATABASE_PATH: data,
  SECRETKEY_PATH: data,
  BLOB_STORAGE_PATH: resolve(data, 'storage'),
  LOG_PATH: resolve(data, 'logs'),
  DISABLE_FLOWISE_TELEMETRY: 'true',
  TRUST_PROXY: 'false',
  DEBUG: 'false',
  LOG_LEVEL: 'warn',
  LOG_SANITIZE_BODY_FIELDS:
    'user,password,credential,apikey,apisecret,question,history,overrideconfig',
  LOG_SANITIZE_HEADER_FIELDS: 'authorization,cookie,set-cookie',
  CORS_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}`,
  IFRAME_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}`,
  // Flowise 3.1.4 has a deny list but no per-host allow list. This explicit
  // replacement keeps its default blocked networks and allows only 127.0.0.1.
  HTTP_SECURITY_CHECK: 'false',
  HTTP_DENY_LIST: LOCAL_HTTP_DENY_LIST,
};
// Never persist values inherited from process.env; the file records reproducible,
// non-secret local settings only. Flowise owns credential/session secrets itself.
const safeSettings = Object.fromEntries(
  Object.entries(environment).filter(
    ([key]) =>
      !Object.hasOwn(process.env, key) ||
      [
        'HOST',
        'PORT',
        'DATABASE_TYPE',
        'DATABASE_PATH',
        'SECRETKEY_PATH',
        'BLOB_STORAGE_PATH',
        'LOG_PATH',
        'DISABLE_FLOWISE_TELEMETRY',
        'TRUST_PROXY',
        'DEBUG',
        'LOG_LEVEL',
        'LOG_SANITIZE_BODY_FIELDS',
        'LOG_SANITIZE_HEADER_FIELDS',
        'CORS_ORIGINS',
        'IFRAME_ORIGINS',
        'HTTP_SECURITY_CHECK',
        'HTTP_DENY_LIST',
      ].includes(key),
  ),
);
await writeFile(
  resolve(data, 'runtime-settings.json'),
  JSON.stringify(safeSettings, null, 2) + '\n',
);
const flowisePackage = resolve(runtime, 'node_modules/flowise/package.json');
const packageMetadata = JSON.parse(await readFile(flowisePackage, 'utf8'));
if (packageMetadata.version !== '3.1.4')
  throw new Error('This launcher requires exact Flowise 3.1.4');
const executable =
  process.env.MOA_FLOWISE_NODE ||
  (process.platform === 'win32'
    ? resolve(project, '.sites-runtime/ai/node-v24.22.0-win-x64/node.exe')
    : process.execPath);
if (!isAbsolute(executable))
  throw new Error('MOA_FLOWISE_NODE must be an absolute path');
const nodeVersion = execFileSync(executable, ['--version'], {
  encoding: 'utf8',
  windowsHide: true,
}).trim();
if (!/^v24\./.test(nodeVersion))
  throw new Error('Flowise 3.1.4 requires the pinned Node 24 runtime');
const child = spawn(
  executable,
  [resolve(runtime, 'node_modules/flowise/bin/run'), 'start'],
  {
    cwd: runtime,
    env: backgroundEnvironment(environment),
    stdio: 'inherit',
    windowsHide: true,
  },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
