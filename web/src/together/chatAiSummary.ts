import { withRequestDeadline } from '../requestDeadline.ts';
import { chatDigestSelectionKey, createChatDigest, projectChatDigest,
  type ChatDigestContext, type ChatDigestFilters, type ChatDigestSource } from './chatDigest.ts';

export type ChatAiSummaryPurpose = 'KEY_POINTS' | 'PREPARATION' | 'OPEN_QUESTIONS' | 'PERSON';
export const chatAiSummaryPurposes: ReadonlyArray<{ id: ChatAiSummaryPurpose; label: string }> = [
  { id: 'KEY_POINTS', label: '핵심 내용' }, { id: 'PREPARATION', label: '준비물' },
  { id: 'OPEN_QUESTIONS', label: '확인할 일' }, { id: 'PERSON', label: '특정인 발언' },
];
export interface AiRequestScope { userId: string; groupId: string; roomId: string }
export interface ScopedAiRequest {
  schemaVersion: 1; requestId: string; feature: 'CHAT_SUMMARY' | 'REVIEW_DRAFT'; scope: AiRequestScope; payload: unknown;
}
export interface ChatAiSummaryRequest extends ScopedAiRequest {
  feature: 'CHAT_SUMMARY';
  payload: {
    purpose: ChatAiSummaryPurpose; filters: ChatDigestFilters; unreadAfter?: string; cutoff: string; sources: ChatDigestSource[];
  };
}
export interface ChatAiSummaryOutput {
  title: string;
  sections: Array<{ kind?: 'TIME_PLACE' | 'PREPARATION' | 'CHANGED' | 'OPEN_QUESTIONS' | 'OTHER'; heading: string; items: Array<{ text: string; sourceIds: string[] }> }>;
}
export interface ChatAiSummarySnapshot { request: ChatAiSummaryRequest; output: ChatAiSummaryOutput }
export const MAX_CHAT_AI_MESSAGES = 300;
export const MAX_CHAT_AI_CHARACTERS = 60000;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, maximum: number): value is string => typeof value === 'string' && Boolean(value.trim()) && value.length <= maximum;
const sameScope = (value: unknown, scope: AiRequestScope) => isRecord(value) && value.userId === scope.userId && value.groupId === scope.groupId && value.roomId === scope.roomId;

export function createAiRequestId(): string {
  return globalThis.crypto?.randomUUID?.() || `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Public service URL only. Provider keys and model selection belong to that server. */
export function normalizeAiEndpoint(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const endpoint = value.trim();
  if (/[\\\r\n#]/.test(endpoint) || endpoint.startsWith('//')) throw new Error('AI 서버 연결 주소를 확인해 주세요.');
  if (endpoint.startsWith('/')) return endpoint;
  try {
    const url = new URL(endpoint);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || !(url.protocol === 'https:' || url.protocol === 'http:' && loopback)) throw new Error();
    return url.href;
  } catch { throw new Error('AI 서버 연결 주소를 확인해 주세요.'); }
}

/** One explicit POST, no fallback, retry, logging or browser persistence. */
export async function postScopedAiJson<T>(endpoint: string, request: ScopedAiRequest, signal: AbortSignal,
  parseOutput: (value: unknown) => T, fetcher: typeof fetch = fetch): Promise<T> {
  const path = normalizeAiEndpoint(endpoint);
  if (!path) throw new Error('AI 서버가 아직 연결되지 않았어요. 원문 모아보기를 이용해 주세요.');
  return withRequestDeadline(async requestSignal => {
    let response: Response;
    try {
      response = await fetcher(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(request), signal: requestSignal });
    } catch (cause) {
      if (requestSignal.aborted) throw new DOMException('Cancelled', 'AbortError');
      throw new Error('AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', { cause });
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('AI 서버에서 대화 접근 권한을 확인하지 못했어요.');
      if (response.status === 429) throw new Error('AI 요청이 많아요. 잠시 후 다시 시도해 주세요.');
      if (response.status === 413) throw new Error('선택한 대화가 많아요. 기간이나 참여자를 좁혀 주세요.');
      throw new Error('AI 요약을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new Error('AI 응답 형식을 확인하지 못했어요. 다시 시도해 주세요.'); }
    if (requestSignal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!isRecord(body) || body.schemaVersion !== 1 || body.requestId !== request.requestId || !sameScope(body.scope, request.scope)) {
      throw new Error('다른 요청이나 대화방의 AI 응답은 표시할 수 없어요. 다시 시도해 주세요.');
    }
    return parseOutput(body.output);
  }, signal, 45000);
}

/** Copy exactly the selected human originals; shared entity cards and other private state never enter the request. */
export function createChatAiSummaryRequest(context: ChatDigestContext, filters: ChatDigestFilters,
  purpose: ChatAiSummaryPurpose, cutoff = Date.now(), requestId = createAiRequestId()): ChatAiSummaryRequest {
  if (!chatAiSummaryPurposes.some(item => item.id === purpose)) throw new Error('요약할 목적을 선택해 주세요.');
  if (purpose === 'PERSON' && !filters.authorId) throw new Error('요약할 참여자를 선택해 주세요.');
  const snapshot = createChatDigest(context, filters, cutoff);
  if (!snapshot.sources.length) throw new Error('선택한 조건에 요약할 원문이 없어요. 기간이나 참여자를 바꿔 주세요.');
  if (snapshot.sources.length > MAX_CHAT_AI_MESSAGES || snapshot.sources.reduce((sum, source) => sum + source.body.length, 0) > MAX_CHAT_AI_CHARACTERS) {
    throw new Error('한 번에 요약할 대화가 많아요. 기간이나 참여자를 좁혀 주세요.');
  }
  return { schemaVersion: 1, requestId, feature: 'CHAT_SUMMARY',
    scope: { userId: context.userId, groupId: context.groupId, roomId: context.roomId },
    payload: { purpose, filters: snapshot.filters, ...(snapshot.unreadAfter === undefined ? {} : { unreadAfter: snapshot.unreadAfter }), cutoff: snapshot.cutoff, sources: snapshot.sources } };
}

/** Every generated statement must cite one or more exact source IDs from this request. */
export function parseChatAiSummaryOutput(value: unknown, request: ChatAiSummaryRequest): ChatAiSummaryOutput {
  const invalid = () => new Error('AI 요약의 내용과 원문 근거를 확인하지 못했어요. 다시 시도해 주세요.');
  if (!isRecord(value) || !text(value.title, 120) || !Array.isArray(value.sections) || !value.sections.length || value.sections.length > 8) throw invalid();
  const allowed = new Set(request.payload.sources.map(source => source.id));
  let itemCount = 0, characterCount = value.title.length;
  const sections = value.sections.map(section => {
    if (!isRecord(section) || !text(section.heading, 80) || !Array.isArray(section.items) || !section.items.length) throw invalid();
    characterCount += section.heading.length;
    const items = section.items.map(item => {
      if (!isRecord(item) || !text(item.text, 2000) || !Array.isArray(item.sourceIds) || !item.sourceIds.length || item.sourceIds.length > 20
        || item.sourceIds.some(id => typeof id !== 'string' || !allowed.has(id))) throw invalid();
      itemCount += 1; characterCount += item.text.length;
      if (itemCount > 40 || characterCount > 20000) throw invalid();
      return { text: item.text, sourceIds: [...new Set(item.sourceIds as string[])] };
    });
    const kind = ['TIME_PLACE', 'PREPARATION', 'CHANGED', 'OPEN_QUESTIONS', 'OTHER'].includes(String(section.kind))
      ? section.kind as NonNullable<ChatAiSummaryOutput['sections'][number]['kind']> : undefined;
    return { heading: section.heading, items, ...(kind ? { kind } : {}) };
  });
  return { title: value.title, sections };
}

export function requestChatAiSummary(endpoint: string, request: ChatAiSummaryRequest, signal: AbortSignal, fetcher?: typeof fetch): Promise<ChatAiSummaryOutput> {
  return postScopedAiJson(endpoint, request, signal, value => parseChatAiSummaryOutput(value, request), fetcher);
}

/** Recheck captured text and current scope before accepting or displaying any late response. */
export function projectChatAiRequest(context: ChatDigestContext, request: ChatAiSummaryRequest,
  filters: ChatDigestFilters = request.payload.filters, purpose: ChatAiSummaryPurpose = request.payload.purpose): {
    available: boolean; reason: 'access' | 'selection' | 'sources' | null; newMessageCount: number;
  } {
  const snapshot = { ...request.scope, cutoff: request.payload.cutoff, filters: request.payload.filters,
    unreadAfter: request.payload.unreadAfter, sources: request.payload.sources };
  try {
    const projection = projectChatDigest(context, snapshot);
    if (projection.forbidden) return { available: false, reason: 'access', newMessageCount: 0 };
    if (purpose !== request.payload.purpose || chatDigestSelectionKey(filters, context.unreadAfter) !== chatDigestSelectionKey(snapshot.filters, snapshot.unreadAfter)) {
      return { available: false, reason: 'selection', newMessageCount: 0 };
    }
    if (projection.removedCount) return { available: false, reason: 'sources', newMessageCount: projection.newMessageCount };
    return { available: true, reason: null, newMessageCount: projection.newMessageCount };
  } catch { return { available: false, reason: 'access', newMessageCount: 0 }; }
}

export function configuredChatAiEndpoint(): string {
  return normalizeAiEndpoint(import.meta.env?.VITE_CHAT_AI_ENDPOINT);
}
