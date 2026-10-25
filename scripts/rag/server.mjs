import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { RagError } from './ollama.mjs';

function authorized(header, secret) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(typeof header === 'string' ? header : '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function readBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new RagError('json_content_type_required', 415);
  const body = await new Promise((resolve, reject) => {
    let size = 0;
    let rejected = false;
    const chunks = [];
    request.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > 32768) {
        rejected = true;
        chunks.length = 0;
        reject(new RagError('request_too_large', 413));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks).toString('utf8')); });
    request.on('error', () => reject(new RagError('invalid_request', 400)));
    request.on('aborted', () => reject(new RagError('invalid_request', 400)));
  });
  try { return JSON.parse(body); } catch { throw new RagError('invalid_json', 400); }
}

export function createRagServer({ store, embedder, apiKey, maxConcurrent = 2 }) {
  if (typeof apiKey !== 'string' || apiKey.length < 24 || /\s/.test(apiKey)) throw new RagError('rag_api_key_required', 500);
  let concurrent = 0;
  const server = createServer(async (request, response) => {
    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(body));
    };
    try {
      if (request.url === '/health' && request.method === 'GET') { json(200, store.stats()); return; }
      if (!authorized(request.headers.authorization, apiKey)) { json(401, { error: 'unauthorized' }); return; }
      if (request.method !== 'POST' || !['/internal/rag/search', '/internal/rag/validate'].includes(request.url)) { json(404, { error: 'not_found' }); return; }
      if (concurrent >= maxConcurrent) { json(429, { error: 'rag_busy' }); return; }
      concurrent += 1;
      try {
        const input = await readBody(request);
        const result = request.url.endsWith('/search') ? await store.search(input, embedder) : store.validateEvidence(input);
        json(200, result);
      } finally { concurrent -= 1; }
    } catch (error) {
      json(error instanceof RagError ? error.status : 503, { error: error instanceof RagError ? error.code : 'rag_unavailable' });
    }
  });
  server.requestTimeout = 70000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
