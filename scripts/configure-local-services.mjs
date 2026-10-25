import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const root = new URL('../', import.meta.url);
const flowise = JSON.parse(
  await readFile(
    new URL('.sites-runtime/ai/flowise-data/config.json', root),
    'utf8',
  ),
);
const rag = JSON.parse(
  await readFile(new URL('.sites-runtime/ai/rag/config.json', root), 'utf8'),
);
const port = Number(rag.RAG_PORT ?? 8765);
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(flowise.FLOWISE_BASE_URL) ||
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535 ||
  typeof flowise.FLOWISE_API_KEY !== 'string' ||
  !/^[A-Za-z0-9_-]{1,160}$/.test(flowise.FLOWISE_CHATFLOW_ID || '') ||
  (flowise.FLOWISE_PLANNER_CHATFLOW_ID !== undefined && !/^[A-Za-z0-9_-]{1,160}$/.test(flowise.FLOWISE_PLANNER_CHATFLOW_ID)) ||
  typeof rag.RAG_API_KEY !== 'string' ||
  [flowise.FLOWISE_API_KEY, rag.RAG_API_KEY].some(
    (key) => key.length < 24 || /[\r\n]/.test(key),
  )
)
  throw new Error(
    'Local service configuration is incomplete. Secret values were not printed.',
  );
const updates = {
  FLOWISE_BASE_URL: flowise.FLOWISE_BASE_URL,
  FLOWISE_CHATFLOW_ID: flowise.FLOWISE_CHATFLOW_ID,
  ...(flowise.FLOWISE_PLANNER_CHATFLOW_ID ? { FLOWISE_PLANNER_CHATFLOW_ID: flowise.FLOWISE_PLANNER_CHATFLOW_ID } : {}),
  FLOWISE_API_KEY: flowise.FLOWISE_API_KEY,
  FLOWISE_TIMEOUT_MS: '45000',
  CHAT_PROVIDER: 'flowise',
  RAG_ENABLED: 'true',
  RAG_BASE_URL: `http://127.0.0.1:${port}`,
  RAG_API_KEY: rag.RAG_API_KEY,
  RAG_TIMEOUT_MS: '15000',
};
const target = new URL('.dev.vars', root);
let existing = '';
try {
  existing = await readFile(target, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const lines = existing
  .split(/\r?\n/)
  .filter(
    (line) =>
      !Object.keys(updates).some((name) =>
        new RegExp(`^\\s*${name}\\s*=`).test(line),
      ),
  );
const content =
  lines.filter(Boolean).join('\n') +
  '\n' +
  Object.entries(updates)
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join('\n') +
  '\n';
const temporary = new URL(`.dev.vars.${randomUUID()}.tmp`, root);
await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
await rename(temporary, target);
console.log(
  'Moa local Flowise and RAG configuration saved. Restart the Moa development server; no credentials were printed.',
);
