import {
  ChatContractError,
  type ChatRequest,
  type ModelReply,
} from './chat-contract';
import { boundedResponse, type ServerEnvironment } from './flowise-adapter';
import type { RagEvidence, RagRetrieval } from './rag-types';
import { knowledgeSource, ragAllowedPlaceIds, ragPlaceIdsForQuery } from './rag-catalog';
import { itineraryRequest, itineraryRetrievalScope } from './itinerary-retrieval';

export type RagConfig = { baseUrl: string; apiKey: string; timeoutMs: number };
export function readRagConfig(env: ServerEnvironment): RagConfig | null {
  if (env.RAG_ENABLED !== 'true') return null;
  try {
    const baseUrl = env.RAG_BASE_URL ?? 'http://127.0.0.1:8765';
    if (typeof baseUrl !== 'string') throw new Error();
    const url = new URL(baseUrl);
    const apiKey =
      typeof env.RAG_API_KEY === 'string' ? env.RAG_API_KEY.trim() : '';
    const timeoutMs = Number(env.RAG_TIMEOUT_MS ?? 15000);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      apiKey.length < 24 ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 30000
    )
      throw new Error();
    return { baseUrl: url.origin, apiKey, timeoutMs };
  } catch {
    throw new ChatContractError(
      'RAG_CONFIG_INVALID',
      '검색 자료 연결 설정을 확인해 주세요.',
      503,
    );
  }
}

function invalid(): never {
  throw new ChatContractError(
    'RAG_OUTPUT_INVALID',
    '검색 근거를 확인하지 못해 현재 화면을 유지했어요.',
    502,
  );
}
export function parseRagRetrieval(
  value: unknown,
  allowedPlaceIds: string[],
): RagRetrieval {
  if (!value || typeof value !== 'object') return invalid();
  const body = value as RagRetrieval;
  if (
    Object.keys(body).some(
      (key) =>
        !['dataMode', 'indexVersion', 'embeddingModel', 'results'].includes(
          key,
        ),
    )
  )
    return invalid();
  if (
    !['authored-demo-data', 'curated-travel-data'].includes(body.dataMode) ||
    typeof body.indexVersion !== 'string' ||
    !/^[A-Za-z0-9_.:-]{1,160}$/.test(body.indexVersion) ||
    typeof body.embeddingModel !== 'string' ||
    !/^[A-Za-z0-9_.:/-]{1,160}$/.test(body.embeddingModel) ||
    !Array.isArray(body.results) ||
    body.results.length > 12
  )
    return invalid();
  const ids = new Set<string>();
  for (const item of body.results) {
    if (
      !item ||
      typeof item !== 'object' ||
      !allowedPlaceIds.includes(item.placeId) ||
      Object.keys(item).some(
        (key) =>
          ![
            'evidenceId',
            'placeId',
            'documentId',
            'chunkId',
            'sourceVersion',
            'text',
            'sourceKind',
            'title',
            'sourceUrl',
            'checkedAt',
          ].includes(key),
      ) ||
      !ragAllowedPlaceIds().includes(item.placeId) ||
      !['authored-demo-data', 'curated-official-summary'].includes(item.sourceKind) ||
      ['evidenceId', 'documentId', 'chunkId', 'sourceVersion'].some(
        (key) =>
          typeof item[key as keyof RagEvidence] !== 'string' ||
          !/^[A-Za-z0-9_.:-]{1,160}$/.test(item[key as keyof RagEvidence] as string),
      ) ||
      typeof item.text !== 'string' ||
      !item.text.trim() ||
      item.text.length > 4000 ||
      /<\/?[a-z][^>]*>|https?:\/\//i.test(item.text) ||
      ids.has(item.evidenceId)
    )
      return invalid();
    ids.add(item.evidenceId);
    const canonical = knowledgeSource(item.documentId);
    if (!canonical || canonical.placeId !== item.placeId || canonical.sourceKind !== item.sourceKind ||
      ['title', 'sourceUrl', 'checkedAt'].some((key) => item[key as keyof RagEvidence] !== canonical[key as keyof typeof canonical])) return invalid();
  }
  return body;
}

async function ragPost(
  config: RagConfig,
  path: string,
  body: unknown,
  fetcher: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetcher(config.baseUrl + path, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new ChatContractError(
        response.status === 409 ? 'RAG_STALE_EVIDENCE' : 'RAG_UNAVAILABLE',
        '검색 자료가 바뀌었거나 연결을 확인해야 해요. 현재 화면에서 다시 시도해 주세요.',
        response.status === 409 ? 409 : 503,
      );
    return JSON.parse(await boundedResponse(response, 65536));
  } catch (error) {
    if (error instanceof ChatContractError) throw error;
    throw new ChatContractError(
      controller.signal.aborted ? 'RAG_TIMEOUT' : 'RAG_UNAVAILABLE',
      '검색 자료를 확인하지 못했어요. 현재 화면에서 다시 시도해 주세요.',
      controller.signal.aborted ? 504 : 503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieveForChat(
  request: ChatRequest,
  config: RagConfig,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
) {
  if (request.action.type !== 'message')
    throw new ChatContractError(
      'RAG_ACTION_INVALID',
      '질문만 검색할 수 있어요.',
    );
  if (request.action.text.length > 2048)
    throw new ChatContractError(
      'RAG_QUERY_TOO_LONG',
      '검색 질문을 2048자 이내로 줄여 주세요. 입력은 그대로 유지했어요.',
      400,
    );
  // The authored catalog is the authoritative active/allowed set for this demo.
  // A client/model cannot widen it. Operational membership/rights DB is separate.
  const planning = itineraryRequest(request);
  const scope = itineraryRetrievalScope(request);
  const allowedPlaceIds = planning.outsideCorpus ? [] : planning.requested
    ? scope.allowedPlaceIds
    : ragPlaceIdsForQuery(request.action.text);
  const raw = await ragPost(
    config,
    '/internal/rag/search',
    { query: request.action.text, allowedPlaceIds, topK: planning.requested ? 8 : 5, ...(planning.requested ? { distinctPlaces: true } : {}) },
    fetcher,
  );
  const retrieval = parseRagRetrieval(raw, allowedPlaceIds);
  if (!planning.requested) return retrieval;
  // Named user destinations take priority over broad semantic similarity. Pin
  // every supplementary read to the same index so a reseed cannot mix sources.
  const preferred: RagEvidence[] = [];
  for (const id of planning.namedPlaceIds.slice(0, 6)) {
    if (!allowedPlaceIds.includes(id)) continue;
    const specific = parseRagRetrieval(await ragPost(config, '/internal/rag/search', {
      query: request.action.text, allowedPlaceIds: [id], topK: 2, indexVersion: retrieval.indexVersion,
    }, fetcher), [id]);
    if (specific.indexVersion !== retrieval.indexVersion || specific.embeddingModel !== retrieval.embeddingModel) return invalid();
    preferred.push(...specific.results);
  }
  // A single embedding query can rank every forest above every coast (or vice
  // versa). Read each explicitly requested theme from the same live index so
  // both interests reach the model instead of manufacturing unsourced stops.
  const themed: RagEvidence[][] = [];
  if (scope.themes.length > 1) {
    for (const theme of scope.themes) {
      if (!theme.placeIds.length) continue;
      const specific = parseRagRetrieval(await ragPost(config, '/internal/rag/search', {
        query: request.action.text, allowedPlaceIds: theme.placeIds,
        topK: Math.min(8, Math.max(1, planning.days)), distinctPlaces: true, indexVersion: retrieval.indexVersion,
      }, fetcher), theme.placeIds);
      if (specific.indexVersion !== retrieval.indexVersion || specific.embeddingModel !== retrieval.embeddingModel) return invalid();
      themed.push(specific.results);
    }
  }
  const balanced: RagEvidence[] = [];
  for (let index = 0; index < Math.max(0, ...themed.map(group => group.length)); index++)
    for (const group of themed) if (group[index]) balanced.push(group[index]);
  const seen = new Set<string>();
  const merged = [...preferred, ...balanced, ...retrieval.results].filter(item => {
    if (seen.has(item.evidenceId)) return false;
    seen.add(item.evidenceId);
    return true;
  });
  // Multiple source documents for named places must not displace the fresh
  // evidence for all the other places needed to fill the requested days.
  if (merged.length > 12) {
    const represented = new Set<string>();
    const first = merged.filter(item => {
      if (represented.has(item.placeId)) return false;
      represented.add(item.placeId);
      return true;
    });
    const chosen = new Set(first.map(item => item.evidenceId));
    return { ...retrieval, results: [...first, ...merged.filter(item => !chosen.has(item.evidenceId))].slice(0, 12) };
  }
  return { ...retrieval, results: merged };
}

export async function revalidateRetrieval(
  retrieval: RagRetrieval,
  reply: ModelReply,
  config: RagConfig,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
) {
  if (
    reply.evidenceIds?.some(
      (id) => !retrieval.results.some((item) => item.evidenceId === id),
    )
  )
    return invalid();
  return validateRetrievedEvidence(retrieval, config, fetcher);
}

export async function validateRetrievedEvidence(
  retrieval: RagRetrieval,
  config: RagConfig,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
) {
  // The RAG database is an index, not the authority for current source facts.
  // A changed app catalog must fail until it is reindexed, even if SQLite still
  // holds an internally consistent older description.
  for (const evidence of retrieval.results) {
    const source = knowledgeSource(evidence.documentId);
    const text = source?.text ?? '';
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text),
    );
    const version =
      'sha256:' +
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    if (
      !source ||
      text !== evidence.text ||
      version !== evidence.sourceVersion ||
      evidence.placeId !== source.placeId ||
      evidence.sourceKind !== source.sourceKind ||
      evidence.chunkId !== source.chunkId ||
      ['title', 'sourceUrl', 'checkedAt'].some((key) => evidence[key as keyof RagEvidence] !== source[key as keyof typeof source])
    )
      throw new ChatContractError(
        'RAG_STALE_EVIDENCE',
        '원본 설명이 바뀌어 검색 자료 갱신이 필요해요.',
        409,
      );
  }
  // Revalidate all material sent to the model, including material it did not cite.
  const result = (await ragPost(
    config,
    '/internal/rag/validate',
    {
      indexVersion: retrieval.indexVersion,
      allowedPlaceIds: ragAllowedPlaceIds(),
      results: retrieval.results,
    },
    fetcher,
  )) as { valid?: boolean };
  if (result?.valid !== true)
    throw new ChatContractError(
      'RAG_STALE_EVIDENCE',
      '검색 자료가 변경되어 결과를 반영하지 않았어요.',
      409,
    );
}
