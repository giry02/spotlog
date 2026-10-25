# Local authored-demo RAG

This runtime is an actual SQLite-backed semantic index, using Ollama's installed
`qwen3-embedding:0.6b` model and cosine similarity over persisted 1024-dimensional
vectors. It is a bounded development implementation, not PostgreSQL/pgvector or
Spotlog's production member database. The only seeded texts are the existing
Moa-authored names, regions, descriptions and tags for 13 landmarks plus 62
independently written Jeju summaries from 37 checked official URLs. These cover
28 Jeju destinations with two topics each, plus six planning/transport/safety
documents. `trip-data.ts` re-exports the itinerary catalog; `jeju-knowledge.ts`
contains the additional source texts. No websites are fetched at query time;
no photographs, private plans, bookings, chats or third-party reviews are indexed.
`curated-official-summary` documents retain title, source URL and check date;
the original examples retain `authored-demo-data`. The mixed data mode is
`curated-travel-data`. Knowledge-only destinations do not become itinerary actions.

Requires Node24+ for `node:sqlite` and native TypeScript stripping (Node26.2
was used for this implementation); no additional npm dependency is required.
Ollama must already be serving on the loopback interface.

```powershell
.sites-runtime/ai/ollama-0.40.4/ollama.exe pull qwen3-embedding:0.6b
node scripts/rag/cli.mjs init
node scripts/rag/cli.mjs seed
node scripts/rag/cli.mjs serve
# Alternatively recover/reuse a detached RAG and inspect all local services:
npm run local:services
```

The `init` command creates an unpredictable Bearer key in the ignored
`.sites-runtime/ai/rag/config.json`. It never prints or replaces an existing key.
The server binds only to `127.0.0.1`, port8765, with no CORS. Environment overrides:
`RAG_API_KEY`, `OLLAMA_BASE_URL`, `RAG_EMBEDDING_MODEL`, `RAG_PORT`, `RAG_DB_PATH`.
The SQLite database defaults to `.sites-runtime/ai/rag/rag.sqlite`. Keep the entire
runtime directory out of Git. Browser clients must call the Moa server, which owns
the allowlist and credentials; do not expose this API/key to browsers.

`GET /health` returns local index metadata only. Its `status:ready` means an index
is present; a real search separately checks Ollama/model availability and digest.
Bearer auth is required for both POST endpoints:

```json
POST /internal/rag/search
{"query":"차밭과 초록 풍경","allowedPlaceIds":["osulloc","bijarim"],"topK":4,"indexVersion":"optional-current-index-id"}
```

Response: `{dataMode,indexVersion,embeddingModel,results}`. Each result contains
`evidenceId,placeId,documentId,chunkId,sourceVersion,text,sourceKind`. Similarity
scores are internal retrieval aids; they are not popularity or travel times.
An empty allowlist yields zero results; no unrestricted default exists.

```json
POST /internal/rag/validate
{"indexVersion":"current-index-id","allowedPlaceIds":["osulloc"],"results":["exact original evidence objects"]}
```

The final server application step must send the original retrieved objects, after
checking current candidate availability in its own catalog. Validation compares
all fields and current document version/text/rights against the separate
revocation ledger. A stale index/evidence yields409, never a substitute answer.
The service stores and checks hash-derived document versions; it does not claim
access to Spotlog's operational rights or live business status.

```powershell
node scripts/rag/cli.mjs status
node scripts/rag/cli.mjs search '나무 그늘에서 산책' 'bijarim,seoulforest'
node scripts/rag/cli.mjs revoke 'moa-place:osulloc' 'rights-withdrawn'
node --test tests/local-rag.test.mjs
node scripts/rag/evaluate.mjs
```

Revocation blocks search and final validation immediately, including a search
already awaiting an embedding. Reseeding never clears revocations. There is no
automatic un-revoke command. Removed documents become inactive. An entire index
is built before one transaction updates documents and switches the active index.
Failed embedding/dimension/model checks preserve the existing index. Changing the
model digest, dimensions or query preprocessing requires reseeding. Mixed vectors
are refused. Old indexes may remain on disk for inspection, but cannot bypass the
current documents/ledger. Do not restore an old database over a newer rights ledger.

Unchanged text reuses stored vectors only when model digest, preprocessing and
embedding options match exactly. Changed text is embedded before atomic activation.
Document IDs distinguish multiple official topics for the same destination. Revoke
each document whose rights are withdrawn; a destination can have several sources.

The Moa server treats retrieval availability as optional for normal conversation.
Unavailable or invalid pre-generation evidence is discarded and clearly reported;
the configured real LLM can still answer general knowledge. Post-generation source
withdrawal remains a blocking error. Current weather uses a separate server tool,
not this static corpus; no external large-model fallback is configured.

Regression tests explicitly use fake embeddings for failure/security scenarios.
`evaluate.mjs` separately exercises real model retrieval and times Korean queries,
then uses a disposable SQLite snapshot for a real-vector revocation test. It saves
its report under the ignored runtime directory and leaves the active service data
untouched. This small corpus evaluation does not establish full travel quality.

The embedding options are explicit: CPU-only `num_gpu:0`, context4096 and
`num_batch:64`. They are recorded in the index metadata/signature. CPU embedding
leaves the 8 GB GPU available for the larger chat model. Queries are bounded to
2048 characters; `truncate:false` rejects any token overflow instead of silently
dropping conditions. These limits are separate from the chat input limit.

When moving to a Mac later, reinstall compatible Node/Ollama, pull the same model
tag and verify the recorded digest, recreate keys, then reseed from approved
source text and rerun the same scenarios. Do not copy Windows binaries or expose
the loopback service to a network. Production shared DB rights/revisions, service
authentication, network policy and user ownership are separate integration work.

Official references: [Ollama model tag](https://ollama.com/library/qwen3-embedding:0.6b),
[Ollama embeddings](https://docs.ollama.com/capabilities/embeddings),
[Qwen3 Embedding query instruction format](https://github.com/QwenLM/Qwen3-Embedding).
