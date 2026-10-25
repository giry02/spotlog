import { createHash } from 'node:crypto';

export const PIPELINE_VERSION = 'authored-place-description-qwen-query-v2';
export const DEFAULT_EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
// Keep the 8 GB GPU available for the larger chat model. Small document/query
// batches are embedded on CPU; these exact options are part of the index identity.
export const EMBEDDING_OPTIONS = Object.freeze({ num_ctx: 4096, num_batch: 64, num_gpu: 0 });
const digest = (value) => createHash('sha256').update(value).digest('hex');

export class RagError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// Only local Ollama is supported here. An external provider requires a separate,
// explicitly reviewed configuration; never forward authored/private text by accident.
export function localOllamaUrl(baseUrl = 'http://127.0.0.1:11434') {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new RagError('ollama_url_must_be_local', 400);
  }
  return url.origin;
}

export function normalizeVector(vector, expectedDimensions) {
  if (!Array.isArray(vector) || vector.length < 1 || vector.length > 8192 || (expectedDimensions && vector.length !== expectedDimensions) || vector.some((value) => !Number.isFinite(value))) {
    throw new RagError('invalid_embedding');
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new RagError('invalid_embedding');
  return vector.map((value) => value / norm);
}

export function createOllamaEmbedder({ baseUrl, model = DEFAULT_EMBEDDING_MODEL, timeoutMs = 60000, fetchImpl = fetch } = {}) {
  const origin = localOllamaUrl(baseUrl);
  if (!/^[\w./:-]{1,160}$/.test(model)) throw new RagError('invalid_embedding_model', 400);
  async function request(path, body) {
    let response;
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new RagError('embedding_unavailable');
    }
    if (!response.ok) throw new RagError('embedding_unavailable');
    if (Number(response.headers.get('content-length')) > 2097152) throw new RagError('embedding_response_too_large');
    const text = await response.text();
    if (text.length > 2097152) throw new RagError('embedding_response_too_large');
    try { return JSON.parse(text); } catch { throw new RagError('invalid_embedding_response'); }
  }
  async function identity() {
    const tags = await request('/api/tags');
    const installed = tags.models?.find((item) => item.name === model || item.model === model);
    if (!installed?.digest || !/^[a-f\d]{64}$/.test(installed.digest)) throw new RagError('embedding_model_not_installed');
    return { model, digest: installed.digest, pipelineVersion: PIPELINE_VERSION, options: EMBEDDING_OPTIONS };
  }
  async function embed(text, { query = false } = {}) {
    const input = query
      ? `Instruct: Given a travel preference in Korean, retrieve relevant approved place descriptions.\nQuery: ${text}`
      : text;
    const result = await request('/api/embed', { model, input, truncate: false, keep_alive: '5m', options: EMBEDDING_OPTIONS });
    if (result.model !== model && result.model !== `${model}:latest`) throw new RagError('embedding_model_mismatch');
    if (!Array.isArray(result.embeddings) || result.embeddings.length !== 1) throw new RagError('invalid_embedding_response');
    return normalizeVector(result.embeddings[0]);
  }
  return { identity, embed, model, pipelineVersion: PIPELINE_VERSION, options: EMBEDDING_OPTIONS };
}

export function embeddingIdentityKey(identity) {
  return digest(JSON.stringify([identity.model, identity.digest, identity.pipelineVersion,
    Object.entries(identity.options ?? {}).sort(([left], [right]) => left.localeCompare(right))]));
}
