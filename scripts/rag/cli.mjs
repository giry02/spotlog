import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createOllamaEmbedder, DEFAULT_EMBEDDING_MODEL } from './ollama.mjs';
import { RagStore } from './store.mjs';
import { authoredDemoDocuments } from './catalog.mjs';
import { createRagServer } from './server.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeDir = resolve(projectRoot, '.sites-runtime/ai/rag');
const configPath = resolve(runtimeDir, 'config.json');

export async function readConfig() {
  let saved = {};
  try { saved = JSON.parse(await readFile(configPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return {
    apiKey: process.env.RAG_API_KEY || saved.RAG_API_KEY,
    baseUrl: process.env.OLLAMA_BASE_URL || saved.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.RAG_EMBEDDING_MODEL || saved.RAG_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    port: Number(process.env.RAG_PORT || saved.RAG_PORT || 8765),
    dbPath: process.env.RAG_DB_PATH ? resolve(process.env.RAG_DB_PATH) : resolve(runtimeDir, 'rag.sqlite'),
  };
}

async function main() {
  const command = process.argv[2] || 'status';
  if (command === 'init') {
    await mkdir(runtimeDir, { recursive: true });
    try {
      await writeFile(configPath, JSON.stringify({ RAG_API_KEY: randomBytes(32).toString('hex'), OLLAMA_BASE_URL: 'http://127.0.0.1:11434', RAG_EMBEDDING_MODEL: DEFAULT_EMBEDDING_MODEL, RAG_PORT: 8765 }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.log('RAG local configuration created. Secret stored only in ignored runtime config.');
    } catch (error) { if (error.code === 'EEXIST') console.log('RAG configuration already exists; preserved.'); else throw error; }
    return;
  }
  const config = await readConfig();
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw new Error('invalid_rag_port');
  const store = new RagStore({ dbPath: config.dbPath });
  const embedder = createOllamaEmbedder({ baseUrl: config.baseUrl, model: config.model });
  try {
    if (command === 'status') console.log(JSON.stringify(store.stats(), null, 2));
    else if (command === 'seed') console.log(JSON.stringify(await store.seed(await authoredDemoDocuments(projectRoot), embedder), null, 2));
    else if (command === 'revoke') console.log(JSON.stringify(store.revoke(process.argv[3], process.argv[4] || 'operator-revoked')));
    else if (command === 'search') {
      const query = process.argv[3];
      const allowedPlaceIds = (process.argv[4] || '').split(',').filter(Boolean);
      console.log(JSON.stringify(await store.search({ query, allowedPlaceIds, topK: 4 }, embedder), null, 2));
    } else if (command === 'serve') {
      const server = createRagServer({ store, embedder, apiKey: config.apiKey });
      await new Promise((resolvePromise, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolvePromise); });
      console.log(`RAG listening on http://127.0.0.1:${config.port}; authored demo sources only.`);
      const stop = () => server.close(() => { store.close(); process.exit(0); });
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      return;
    } else throw new Error('usage: node scripts/rag/cli.mjs init|seed|serve|status|search QUERY ALLOWED_IDS|revoke DOCUMENT_ID [REASON]');
  } finally { if (command !== 'serve') store.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.code || 'rag_command_failed'); process.exitCode = 1; });
}
