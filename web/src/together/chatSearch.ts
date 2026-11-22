import { createAiRequestId, MAX_CHAT_AI_CHARACTERS, MAX_CHAT_AI_MESSAGES, postScopedAiJson, type ScopedAiRequest } from './chatAiSummary.ts';
import { canReadChatDigest, chatDigestDayKey, createChatDigest, projectChatDigest, type ChatDigestContext, type ChatDigestFilters, type ChatDigestSource } from './chatDigest.ts';
import { readChatEntity } from './chatEntities.ts';
import { memberName, type TogetherMessage, type TogetherState } from './model.ts';

export type ChatSearchKind = 'ALL' | 'TEXT' | 'LINK' | 'POLL' | 'TASK' | 'NOTICE' | 'STICKER';
export interface ChatSearchFilters { scope: 'all' | 'today' | 'recent7' | 'date'; authorId?: string; from?: string; to?: string; kind: ChatSearchKind }
export interface ChatSearchRequest extends ScopedAiRequest {
  feature: 'CHAT_SEARCH';
  payload: { question: string; filters: ChatDigestFilters; cutoff: string; sources: ChatDigestSource[] };
}
export interface ChatSearchAnswer { answer: string; sourceIds: string[]; unknown: boolean; speakerIds?: string[] }
export interface ChatSearchSnapshot { request: ChatSearchRequest; output: ChatSearchAnswer }
export interface ChatSearchSession {
  mode: 'KEYWORD' | 'AI'; query: string; question: string; filters: ChatSearchFilters;
  filtersOpen: boolean; scrollTop: number; selectedId: string; ai?: ChatSearchSnapshot;
}
export const emptyChatSearch = (): ChatSearchSession => ({ mode: 'KEYWORD', query: '', question: '', filters: { scope: 'all', kind: 'ALL' }, filtersOpen: false, scrollTop: 0, selectedId: '' });
const kinds: ChatSearchKind[] = ['ALL', 'TEXT', 'LINK', 'POLL', 'TASK', 'NOTICE', 'STICKER'];
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const normalized = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
const digestFilters = (filters: ChatSearchFilters): ChatDigestFilters => ({ scope: filters.scope, ...(filters.authorId ? { authorId: filters.authorId } : {}), ...(filters.scope === 'date' ? { from: filters.from, to: filters.to } : {}) });
export function chatSearchSelectionKey(question: string, filters: ChatSearchFilters): string {
  return JSON.stringify([question.trim(), filters.scope, filters.authorId || '', filters.scope === 'date' ? filters.from || '' : '', filters.scope === 'date' ? filters.to || '' : '']);
}
function dateNumber(value?: string): number {
  const at = value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? Date.parse(`${value}T00:00:00+09:00`) : NaN;
  return Number.isFinite(at) && chatDigestDayKey(at) === value ? at : NaN;
}
function searchWindow(filters: ChatSearchFilters, now: number): [number, number] {
  const today = dateNumber(chatDigestDayKey(now));
  if (filters.scope === 'all') return [-Infinity, Infinity];
  if (filters.scope === 'today') return [today, today + 86400000];
  if (filters.scope === 'recent7') return [today - 6 * 86400000, today + 86400000];
  const from = dateNumber(filters.from), to = dateNumber(filters.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error('검색할 시작 날짜와 종료 날짜를 확인해 주세요.');
  return [from, to + 86400000];
}
export function chatSearchMessageText(context: ChatDigestContext, message: TogetherMessage): string | null {
  if (message.entity) {
    const entity = readChatEntity(context.state, context.userId, context.roomId, message);
    return !entity ? null : entity.type === 'POLL' ? entity.value.question : entity.value.title;
  }
  return message.body || (message.stickerId ? '이모티콘' : '');
}
/** Literal search is local and read-only; it never changes the visible history or read cursor. */
export function selectChatSearchMessages(context: ChatDigestContext, query: string, filters: ChatSearchFilters, now = Date.now()): TogetherMessage[] {
  if (!canReadChatDigest(context)) throw new Error('이 대화를 볼 권한이 없어요.');
  if (!validText(query, 500) || !kinds.includes(filters.kind)) throw new Error('검색 조건을 확인해 주세요.');
  const [from, to] = searchWindow(filters, now), key = normalized(query);
  const counts = new Map<string, number>();
  for (const row of context.state.messages) counts.set(row.id, (counts.get(row.id) || 0) + 1);
  return context.state.messages.filter(message => {
    const at = Date.parse(message.createdAt);
    if (counts.get(message.id) !== 1 || message.roomId !== context.roomId || message.deleted || !Number.isFinite(at) || at < from || at >= to || filters.authorId && message.authorId !== filters.authorId) return false;
    const body = chatSearchMessageText(context, message);
    if (body === null) return false;
    if (filters.kind === 'TEXT' && (message.entity || message.stickerId || !message.body.trim())) return false;
    if (filters.kind === 'LINK' && !/https?:\/\/\S+/iu.test(message.body)) return false;
    if (['POLL', 'TASK', 'NOTICE'].includes(filters.kind) && message.entity?.type !== filters.kind) return false;
    if (filters.kind === 'STICKER' && !message.stickerId) return false;
    const activityId = context.roomId.startsWith('activity:') ? context.roomId.slice(9) : undefined;
    return !key || normalized(`${memberName(context.state, message.authorId, context.groupId, activityId)} ${body}`).includes(key);
  }).slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id));
}
/** The question does not keyword-filter the evidence: all explicitly selected human originals are sent. */
export function createChatSearchRequest(context: ChatDigestContext, question: string, filters: ChatSearchFilters, cutoff = Date.now(), requestId = createAiRequestId()): ChatSearchRequest {
  if (!validText(question, 500) || !question.trim()) throw new Error('이 대화에서 궁금한 내용을 적어 주세요.');
  const digest = createChatDigest(context, digestFilters(filters), cutoff);
  if (!digest.sources.length) throw new Error('선택한 범위에 질문할 텍스트 대화가 없어요. 기간이나 참여자를 바꿔 주세요.');
  if (digest.sources.length > MAX_CHAT_AI_MESSAGES || digest.sources.some(source => source.body.length > 6000) || digest.sources.reduce((sum, source) => sum + source.body.length, 0) > MAX_CHAT_AI_CHARACTERS) {
    throw new Error('선택한 대화가 많아요. 기간이나 참여자를 좁혀 주세요.');
  }
  return { schemaVersion: 1, feature: 'CHAT_SEARCH', requestId, scope: { userId: context.userId, groupId: context.groupId, roomId: context.roomId }, payload: { question: question.trim(), filters: digest.filters, cutoff: digest.cutoff, sources: digest.sources } };
}
export function parseChatSearchAnswer(value: unknown, request: ChatSearchRequest): ChatSearchAnswer {
  const fail = () => new Error('AI 답변의 내용과 원문 근거를 확인하지 못했어요. 다시 질문해 주세요.');
  if (!object(value) || !validText(value.answer, 600) || !value.answer.trim() || /\bp\d+\b/u.test(value.answer) || typeof value.unknown !== 'boolean' || !Array.isArray(value.sourceIds) || value.sourceIds.length > 6) throw fail();
  const allowed = new Set(request.payload.sources.map(source => source.id));
  if (value.sourceIds.some(id => typeof id !== 'string' || !allowed.has(id)) || value.unknown && value.sourceIds.length || !value.unknown && !value.sourceIds.length) throw fail();
  const speakers = value.speakerIds === undefined ? [] : value.speakerIds;
  if (!Array.isArray(speakers) || speakers.length > 6 || value.unknown && speakers.length || speakers.some(id => typeof id !== 'string' || !request.payload.sources.some(source => source.authorId === id && (value.sourceIds as unknown[]).includes(source.id)))) throw fail();
  return { answer: value.unknown ? '선택한 대화에서는 확인하지 못했어요. 기간이나 참여자를 바꾸어 질문해 보세요.' : value.answer.trim(), unknown: value.unknown, sourceIds: [...new Set(value.sourceIds as string[])], ...(speakers.length ? { speakerIds: [...new Set(speakers as string[])] } : {}) };
}
/** Cached answers disappear after source edits, scope revocation, or a changed question/filter. */
export function projectChatSearchRequest(context: ChatDigestContext, request: ChatSearchRequest, question = request.payload.question, filters?: ChatSearchFilters): boolean {
  if (question.trim() !== request.payload.question) return false;
  if (filters && chatSearchSelectionKey(question, filters) !== chatSearchSelectionKey(request.payload.question, { ...request.payload.filters, scope: request.payload.filters.scope as ChatSearchFilters['scope'], kind: 'TEXT' })) return false;
  try {
    const current = projectChatDigest(context, { ...request.scope, cutoff: request.payload.cutoff, filters: request.payload.filters, sources: request.payload.sources });
    return !current.forbidden && current.removedCount === 0;
  } catch { return false; }
}
export async function requestChatSearchAnswer(endpoint: string, request: ChatSearchRequest, signal: AbortSignal, currentContext: () => ChatDigestContext, fetcher?: typeof fetch): Promise<ChatSearchAnswer> {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (!projectChatSearchRequest(currentContext(), request)) throw new Error('대화 접근 권한이나 원문이 바뀌었어요. 다시 질문해 주세요.');
  const actualFetch = fetcher ?? fetch;
  let answer: ChatSearchAnswer;
  try {
    answer = await postScopedAiJson(endpoint, request, signal, value => parseChatSearchAnswer(value, request), async (url, init) => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (!projectChatSearchRequest(currentContext(), request)) throw new Error('access-changed');
      return actualFetch(url, init);
    });
  } catch (reason) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!projectChatSearchRequest(currentContext(), request)) throw new Error('대화 접근 권한이나 원문이 바뀌었어요. 다시 질문해 주세요.');
    if (reason instanceof Error && reason.message.includes('AI 요약')) throw new Error('AI 답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    throw reason;
  }
  if (!projectChatSearchRequest(currentContext(), request)) throw new Error('대화 접근 권한이나 원문이 바뀌었어요. 다시 질문해 주세요.');
  return answer;
}

export interface ChatSearchMemory {
  activate(userId: string): void;
  reconcile(state: TogetherState, userId: string): void;
  read(context: ChatDigestContext): ChatSearchSession;
  write(context: ChatDigestContext, session: ChatSearchSession): boolean;
}
/** Parent-owned, bounded page memory. No device persistence, account merging or implicit AI requests. */
export function createChatSearchMemory(): ChatSearchMemory {
  let active = '';
  const sessions = new Map<string, { groupId: string; roomId: string; value: ChatSearchSession }>();
  const key = (context: ChatDigestContext) => JSON.stringify([context.userId, context.groupId, context.roomId]);
  const allowed = (context: ChatDigestContext) => context.userId === active && canReadChatDigest(context);
  const clean = (context: ChatDigestContext, input: ChatSearchSession) => {
    const value = structuredClone(input);
    if (value.ai && !projectChatSearchRequest(context, value.ai.request, value.question, value.filters)) delete value.ai;
    return value;
  };
  return {
    activate: userId => { if (active !== userId) { sessions.clear(); active = userId; } },
    reconcile: (state, userId) => {
      if (userId !== active) return;
      for (const [id, entry] of sessions) {
        const context = { state, userId, groupId: entry.groupId, roomId: entry.roomId };
        if (!allowed(context)) sessions.delete(id); else entry.value = clean(context, entry.value);
      }
    },
    read: context => {
      if (!allowed(context)) { sessions.delete(key(context)); return emptyChatSearch(); }
      return clean(context, sessions.get(key(context))?.value || emptyChatSearch());
    },
    write: (context, session) => {
      if (!allowed(context)) { sessions.delete(key(context)); return false; }
      if (!['KEYWORD', 'AI'].includes(session.mode) || !validText(session.query, 500) || !validText(session.question, 500) || !kinds.includes(session.filters.kind) || !['all', 'today', 'recent7', 'date'].includes(session.filters.scope)
        || !Number.isFinite(session.scrollTop) || session.scrollTop < 0 || session.scrollTop > 10000000 || typeof session.selectedId !== 'string') return false;
      const id = key(context); sessions.delete(id);
      sessions.set(id, { groupId: context.groupId, roomId: context.roomId, value: clean(context, session) });
      while (sessions.size > 24) sessions.delete(sessions.keys().next().value!);
      return true;
    },
  };
}
