import { readFile, writeFile, rename, mkdir, chmod } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const authDirectory = resolve(root, '.sites-runtime/ai/google-cloud/config');
const sdkDirectory = resolve(root, '.sites-runtime/ai/google-cloud/google-cloud-sdk');

// Google's official ADC login requires cloud-platform. Do not describe this
// consent as read-only: the application itself only performs fixed read APIs.
export const loginScopes = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/cloud-platform',
];

export function extractAuthorizedUserCredentials(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.type !== 'authorized_user') throw new Error('CREDENTIALS_INVALID');
  if (typeof value.client_id !== 'string' || !/^\d{6,30}-[A-Za-z0-9_-]{10,100}\.apps\.googleusercontent\.com$/.test(value.client_id) || typeof value.client_secret !== 'string' || !/^[A-Za-z0-9._~-]{16,512}$/.test(value.client_secret) || typeof value.refresh_token !== 'string' || !/^[A-Za-z0-9._~+/-]{20,4096}$/.test(value.refresh_token)) throw new Error('CREDENTIALS_INVALID');
  return { type: 'authorized_user', client_id: value.client_id, client_secret: value.client_secret, refresh_token: value.refresh_token };
}

export function replaceVerificationCredentials(existing, credentials) {
  const serialized = JSON.stringify(extractAuthorizedUserCredentials(credentials));
  // Remove the obsolete short-lived token so it cannot hide the refreshable
  // credential. Keep the API key and every unrelated setting byte-for-byte.
  const lines = existing.split(/\r?\n/).filter(line => !/^\s*GEMINI_BILLING_VERIFICATION_(?:TOKEN|CREDENTIALS)\s*=/.test(line));
  // dotenv keeps backslash-escaped double quotes literally. Single quotes keep
  // the JSON valid in both Wrangler bindings and our configuration CLI. The
  // strictly validated credential fields cannot contain a single quote.
  return lines.join('\n').trimEnd() + "\nGEMINI_BILLING_VERIFICATION_CREDENTIALS='" + serialized + "'\n";
}

async function run(command, args, environment, showOutput = false) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let boundedOutput = '';
    const collect = data => {
      // Never print credential data. SDK login output contains its authorization
      // URL, so retain only a bounded local diagnostic buffer, not stdout logs.
      boundedOutput = (boundedOutput + data.toString('utf8')).slice(-16384);
      if (showOutput) process.stdout.write(data);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', () => reject(new Error('AUTH_PROCESS_FAILED')));
    child.once('exit', code => {
      if (code !== 0) {
        const reason = /scope is required but not consented/i.test(boundedOutput) ? 'AUTH_PERMISSION_NOT_GRANTED' : /access_denied|denied|cancel/i.test(boundedOutput) ? 'AUTH_NOT_APPROVED' : 'AUTH_PROCESS_FAILED';
        reject(new Error(reason));
      } else resolveRun();
    });
  });
}

async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const identity = execFileSync('whoami.exe', [], { encoding: 'utf8', windowsHide: true }).trim();
    execFileSync('icacls.exe', [path, '/inheritance:r', '/grant:r', identity + ':(OI)(CI)F', 'SYSTEM:(OI)(CI)F'], { windowsHide: true, stdio: 'ignore' });
  } else await chmod(path, 0o700);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--login', '--save-existing'].includes(arg)) || args.length !== 1) throw new Error('USE_LOGIN_OR_SAVE_EXISTING');
  execFileSync('git', ['check-ignore', '--quiet', '.dev.vars'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  execFileSync('git', ['check-ignore', '--quiet', '.sites-runtime'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  await privateDirectory(authDirectory);
  const environment = {
    ...process.env,
    CLOUDSDK_CONFIG: authDirectory,
    CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true',
    CLOUDSDK_CORE_DISABLE_FILE_LOGGING: 'true',
    CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK: 'true',
    PYTHONIOENCODING: 'utf-8',
  };
  // An isolated credential store never overwrites the user's global ADC.
  const python = resolve(sdkDirectory, 'platform/bundledpython/python.exe');
  const gcloud = resolve(sdkDirectory, 'lib/gcloud.py');
  if (args.includes('--login')) {
    console.log(JSON.stringify({ stage: 'waiting-for-google-consent', client: 'official Google Cloud SDK', scopes: loginScopes, consentIncludesCloudManagement: true, appOperations: 'API-key project lookup and billing-status read only', billingSetupRequested: false }));
    await run(python, [gcloud, 'auth', 'application-default', 'login', '--disable-quota-project', '--scopes=' + loginScopes.join(',')], environment);
  }
  const adcPath = resolve(authDirectory, 'application_default_credentials.json');
  const credentials = extractAuthorizedUserCredentials(JSON.parse(await readFile(adcPath, 'utf8')));
  const envPath = resolve(root, '.dev.vars');
  const existing = await readFile(envPath, 'utf8');
  const verifierEnvironment = { ...process.env, GEMINI_BILLING_VERIFICATION_CREDENTIALS: JSON.stringify(credentials) };
  // A fixed read-only key/project/billing check must pass BEFORE enabling the
  // stored credential. Configuration checks never generate a Gemini answer.
  await run(process.execPath, [resolve(root, 'scripts/configure-large-model.mjs'), '--check', '--provider=gemini', '--model=gemini-3.6-flash'], verifierEnvironment, true);
  const backupDirectory = resolve(root, '.sites-runtime/ai/large-model');
  await privateDirectory(backupDirectory);
  await writeFile(resolve(backupDirectory, 'before-google-auth-' + randomUUID() + '.backup'), existing, { flag: 'wx', mode: 0o600 });
  const temporary = resolve(authDirectory, 'dev-vars-' + randomUUID() + '.tmp');
  await writeFile(temporary, replaceVerificationCredentials(existing, credentials), { flag: 'wx', mode: 0o600 });
  await rename(temporary, envPath);
  console.log(JSON.stringify({ stage: 'verified-and-saved', provider: 'gemini', model: 'gemini-3.6-flash', billingEnabled: false, generationRequested: false, restartRequired: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main(); }
  catch (error) {
    const code = ['CREDENTIALS_INVALID', 'AUTH_PROCESS_FAILED', 'AUTH_NOT_APPROVED', 'AUTH_PERMISSION_NOT_GRANTED', 'USE_LOGIN_OR_SAVE_EXISTING'].includes(error?.message) ? error.message : 'AUTH_SETUP_INCOMPLETE';
    console.error(JSON.stringify({ connected: false, code, remoteGeneration: 'still guarded; local fallback remains available' }));
    process.exitCode = 1;
  }
}
