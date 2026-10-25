import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { embeddingIdentityKey, normalizeVector, RagError } from './ollama.mjs';

export const DATA_MODE = 'authored-demo-data';
const SOURCE_KINDS = ['authored-demo-data', 'curated-official-summary'];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);

export function validateSearchRequest(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some((key) => !['query', 'allowedPlaceIds', 'topK', 'indexVersion', 'distinctPlaces'].includes(key))) throw new RagError('invalid_search_request', 400);
  if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 2048 || !Array.isArray(input.allowedPlaceIds) || input.allowedPlaceIds.length > 128 || input.allowedPlaceIds.some((id) => !validId(id))) throw new RagError('invalid_search_request', 400);
  const topK = input.topK ?? 4;
  if (!Number.isInteger(topK) || topK < 1 || topK > 12 || (input.indexVersion !== undefined && !validId(input.indexVersion)) || (input.distinctPlaces !== undefined && typeof input.distinctPlaces !== 'boolean')) throw new RagError('invalid_search_request', 400);
  return { query: input.query.trim(), allowedPlaceIds: [...new Set(input.allowedPlaceIds)], topK, indexVersion: input.indexVersion, distinctPlaces: input.distinctPlaces === true };
}

function asDocument(input) {
  if (!validId(input.placeId) || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000 || !SOURCE_KINDS.includes(input.sourceKind) || input.rightsStatus !== 'approved') throw new RagError('invalid_document', 400);
  if (input.sourceKind === 'curated-official-summary' && (
    !validId(input.documentId) || !input.documentId.startsWith('moa-knowledge:') ||
    typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 ||
    typeof input.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkedAt) ||
    typeof input.sourceUrl !== 'string' || input.sourceUrl.length > 1000 || !/^https:\/\//.test(input.sourceUrl)
  )) throw new RagError('invalid_document', 400);
  const sourceHash = hash(input.text);
  const documentId = input.sourceKind === 'curated-official-summary' ? input.documentId : `moa-place:${input.placeId}`;
  return { documentId, placeId: input.placeId, text: input.text, sourceHash, sourceVersion: `sha256:${sourceHash}`, sourceKind: input.sourceKind, rightsStatus: 'approved', title: input.title ?? null, sourceUrl: input.sourceUrl ?? null, checkedAt: input.checkedAt ?? null };
}

export class RagStore {
  constructor({ dbPath }) {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS documents (
        document_id TEXT PRIMARY KEY, place_id TEXT NOT NULL, source_version TEXT NOT NULL,
        source_hash TEXT NOT NULL, text TEXT NOT NULL, source_kind TEXT NOT NULL,
        rights_status TEXT NOT NULL, active INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS revocations (
        document_id TEXT PRIMARY KEY, revoked_at TEXT NOT NULL, reason TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS indexes (
        index_version TEXT PRIMARY KEY, embedding_model TEXT NOT NULL, embedding_digest TEXT NOT NULL,
        identity_key TEXT NOT NULL, dimensions INTEGER NOT NULL, pipeline_version TEXT NOT NULL,
        source_hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chunks (
        index_version TEXT NOT NULL REFERENCES indexes(index_version), chunk_id TEXT NOT NULL,
        document_id TEXT NOT NULL, place_id TEXT NOT NULL, source_version TEXT NOT NULL,
        source_hash TEXT NOT NULL, text TEXT NOT NULL, vector TEXT NOT NULL,
        PRIMARY KEY(index_version, chunk_id)
      );
      CREATE TABLE IF NOT EXISTS runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    if (!this.db.prepare('PRAGMA table_info(indexes)').all().some((column) => column.name === 'embedding_options')) {
      this.db.exec("ALTER TABLE indexes ADD COLUMN embedding_options TEXT NOT NULL DEFAULT '{}'");
    }
    const columns = this.db.prepare('PRAGMA table_info(documents)').all().map((column) => column.name);
    for (const column of ['title', 'source_url', 'checked_at']) {
      if (!columns.includes(column)) this.db.exec(`ALTER TABLE documents ADD COLUMN ${column} TEXT`);
    }
    this.db.exec('PRAGMA user_version=3');
  }

  close() { this.db.close(); }

  active() {
    const row = this.db.prepare("SELECT value FROM runtime_state WHERE key='active_index'").get();
    return row ? this.db.prepare('SELECT * FROM indexes WHERE index_version=?').get(row.value) : null;
  }

  stats() {
    const active = this.active();
    return {
      dataMode: this.db.prepare("SELECT 1 FROM documents WHERE active=1 AND source_kind='curated-official-summary' LIMIT 1").get() ? 'curated-travel-data' : DATA_MODE,
      status: active ? 'ready' : 'unindexed',
      indexVersion: active?.index_version ?? null,
      embeddingModel: active?.embedding_model ?? null,
      dimensions: active?.dimensions ?? null,
      embeddingDigest: active?.embedding_digest ?? null,
      pipelineVersion: active?.pipeline_version ?? null,
      embeddingOptions: active ? JSON.parse(active.embedding_options) : null,
      documents: this.db.prepare("SELECT count(*) AS n FROM documents d WHERE active=1 AND rights_status='approved' AND NOT EXISTS(SELECT 1 FROM revocations r WHERE r.document_id=d.document_id)").get().n,
    };
  }

  // Embeddings are prepared outside the transaction. Only a complete new index is
  // activated. Existing revocations live in a separate ledger and survive reseeds.
  async seed(inputs, embedder) {
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 10000) throw new RagError('invalid_documents', 400);
    const docs = inputs.map(asDocument).sort((a, b) => a.documentId.localeCompare(b.documentId));
    if (new Set(docs.map((doc) => doc.documentId)).size !== docs.length) throw new RagError('duplicate_document', 400);
    const identity = await embedder.identity();
    const key = embeddingIdentityKey(identity);
    const previous = this.active();
    const reusable = previous?.identity_key === key
      ? new Map(this.db.prepare('SELECT * FROM chunks WHERE index_version=?').all(previous.index_version).map((chunk) => [chunk.document_id, chunk]))
      : new Map();
    const vectors = [];
    let dimensions;
    for (const doc of docs) {
      const old = reusable.get(doc.documentId);
      const cached = old?.source_hash === doc.sourceHash && old.text === doc.text
        ? normalizeVector(JSON.parse(old.vector), previous.dimensions) : undefined;
      const vector = normalizeVector(cached ?? await embedder.embed(doc.text), dimensions);
      dimensions ??= vector.length;
      vectors.push(vector);
    }
    if (key !== embeddingIdentityKey(await embedder.identity())) throw new RagError('embedding_model_changed_during_index');
    const sourceHash = hash(JSON.stringify(docs.map(({ documentId, sourceHash }) => [documentId, sourceHash])));
    const indexVersion = `idx:${hash(JSON.stringify([key, dimensions, sourceHash])).slice(0, 32)}`;
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR IGNORE INTO indexes (index_version,embedding_model,embedding_digest,identity_key,dimensions,pipeline_version,source_hash,created_at,embedding_options) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(indexVersion, identity.model, identity.digest, key, dimensions, identity.pipelineVersion, sourceHash, now, JSON.stringify(identity.options ?? {}));
      this.db.exec('UPDATE documents SET active=0');
      const docWrite = this.db.prepare(`INSERT INTO documents (document_id,place_id,source_version,source_hash,text,source_kind,rights_status,active,updated_at,title,source_url,checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(document_id) DO UPDATE SET place_id=excluded.place_id,source_version=excluded.source_version,
        source_hash=excluded.source_hash,text=excluded.text,source_kind=excluded.source_kind,
        rights_status=excluded.rights_status,active=excluded.active,updated_at=excluded.updated_at,
        title=excluded.title,source_url=excluded.source_url,checked_at=excluded.checked_at`);
      const chunkWrite = this.db.prepare('INSERT OR REPLACE INTO chunks VALUES (?,?,?,?,?,?,?,?)');
      docs.forEach((doc, index) => {
        docWrite.run(doc.documentId, doc.placeId, doc.sourceVersion, doc.sourceHash, doc.text, doc.sourceKind, doc.rightsStatus, 1, now, doc.title, doc.sourceUrl, doc.checkedAt);
        chunkWrite.run(indexVersion, `${doc.documentId}:description`, doc.documentId, doc.placeId, doc.sourceVersion, doc.sourceHash, doc.text, JSON.stringify(vectors[index]));
      });
      this.db.prepare("INSERT OR REPLACE INTO runtime_state VALUES ('active_index',?)").run(indexVersion);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.stats();
  }

  revoke(documentId, reason = 'operator-revoked') {
    if (!validId(documentId) || typeof reason !== 'string' || !reason.trim() || reason.length > 160) throw new RagError('invalid_revocation', 400);
    this.db.prepare('INSERT OR IGNORE INTO revocations VALUES (?,?,?)').run(documentId, new Date().toISOString(), reason);
    return { documentId, revoked: true };
  }

  assertIndex(active, expectedVersion) {
    if (!active) throw new RagError('rag_not_indexed');
    if (expectedVersion && active.index_version !== expectedVersion) throw new RagError('index_version_mismatch', 409);
  }

  eligibleChunks(indexVersion, allowedPlaceIds) {
    if (!allowedPlaceIds.length) return [];
    const placeholders = allowedPlaceIds.map(() => '?').join(',');
    return this.db.prepare(`SELECT c.*,d.source_kind,d.title,d.source_url,d.checked_at FROM chunks c JOIN documents d ON d.document_id=c.document_id
      WHERE c.index_version=? AND c.place_id IN (${placeholders})
      AND d.active=1 AND d.rights_status='approved' AND d.source_kind IN ('authored-demo-data','curated-official-summary')
      AND d.place_id=c.place_id AND d.source_version=c.source_version AND d.source_hash=c.source_hash AND d.text=c.text
      AND NOT EXISTS (SELECT 1 FROM revocations r WHERE r.document_id=c.document_id)`)
      .all(indexVersion, ...allowedPlaceIds);
  }

  // The active index and current rights are read in one SQLite snapshot after
  // every awaited provider call. This covers both in-process and CLI reseeds.
  snapshotChunks(indexVersion, allowedPlaceIds) {
    this.db.exec('BEGIN');
    try {
      this.assertIndex(this.active(), indexVersion);
      const chunks = this.eligibleChunks(indexVersion, allowedPlaceIds);
      this.db.exec('COMMIT');
      return chunks;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  toEvidence(chunk, indexVersion) {
    return {
      evidenceId: `${indexVersion}:${hash(JSON.stringify([chunk.chunk_id, chunk.source_hash])).slice(0, 24)}`,
      placeId: chunk.place_id, documentId: chunk.document_id, chunkId: chunk.chunk_id,
      sourceVersion: chunk.source_version, text: chunk.text, sourceKind: chunk.source_kind,
      ...(chunk.title ? { title: chunk.title, sourceUrl: chunk.source_url, checkedAt: chunk.checked_at } : {}),
    };
  }

  async search(input, embedder) {
    const request = validateSearchRequest(input);
    const active = this.active();
    this.assertIndex(active, request.indexVersion);
    if (embeddingIdentityKey(await embedder.identity()) !== active.identity_key) throw new RagError('embedding_model_mismatch');
    const response = { dataMode: this.stats().dataMode, indexVersion: active.index_version, embeddingModel: active.embedding_model, results: [] };
    if (!request.allowedPlaceIds.length) { this.snapshotChunks(active.index_version, []); return response; }
    const queryVector = normalizeVector(await embedder.embed(request.query, { query: true }), active.dimensions);
    // Re-read both index and the rights ledger after the asynchronous model call.
    // A revoke/reseed which happened while embedding was running takes effect now.
    if (embeddingIdentityKey(await embedder.identity()) !== active.identity_key) throw new RagError('embedding_model_mismatch');
    const candidates = this.snapshotChunks(active.index_version, request.allowedPlaceIds).map((chunk) => {
      let vector;
      try { vector = normalizeVector(JSON.parse(chunk.vector), active.dimensions); } catch { throw new RagError('corrupt_index'); }
      return { chunk, score: vector.reduce((sum, value, index) => sum + value * queryVector[index], 0) };
    });
    candidates.sort((a, b) => b.score - a.score || a.chunk.chunk_id.localeCompare(b.chunk.chunk_id));
    const seen = new Set();
    const ranked = request.distinctPlaces ? candidates.filter(({ chunk }) => {
      if (seen.has(chunk.place_id)) return false;
      seen.add(chunk.place_id);
      return true;
    }) : candidates;
    response.results = ranked.slice(0, request.topK).map(({ chunk }) => this.toEvidence(chunk, active.index_version));
    return response;
  }

  validateEvidence(input) {
    if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some((key) => !['indexVersion', 'allowedPlaceIds', 'results'].includes(key)) || !validId(input.indexVersion) || !Array.isArray(input.allowedPlaceIds) || input.allowedPlaceIds.length > 128 || input.allowedPlaceIds.some((id) => !validId(id)) || !Array.isArray(input.results) || input.results.length > 12) throw new RagError('invalid_evidence_request', 400);
    const current = new Map(this.snapshotChunks(input.indexVersion, input.allowedPlaceIds).map((chunk) => {
      const evidence = this.toEvidence(chunk, input.indexVersion);
      return [evidence.evidenceId, evidence];
    }));
    const fields = ['evidenceId', 'placeId', 'documentId', 'chunkId', 'sourceVersion', 'text', 'sourceKind', 'title', 'sourceUrl', 'checkedAt'];
    if (input.results.some((value) => !value || typeof value !== 'object' || Object.keys(value).some((key) => !fields.includes(key)) || !current.has(value.evidenceId) || fields.some((key) => value[key] !== current.get(value.evidenceId)[key]))) throw new RagError('evidence_no_longer_valid', 409);
    return { valid: true, dataMode: this.stats().dataMode, indexVersion: input.indexVersion, results: input.results };
  }
}
