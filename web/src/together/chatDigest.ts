import { isMember, roomIdForActivity, roomIdForGroup, type TogetherMessage, type TogetherState } from './model.ts';

export type ChatDigestScope = 'unread' | 'today' | 'recent7' | 'date' | 'all';
export type ChatDigestCategory = 'prepare' | 'time-place' | 'check' | 'other';
export interface ChatDigestFilters { scope: ChatDigestScope; authorId?: string; from?: string; to?: string }
export interface ChatDigestContext { state: TogetherState; userId: string; groupId: string; roomId: string; unreadAfter?: string }
export type ChatDigestSource = Pick<TogetherMessage, 'id' | 'roomId' | 'authorId' | 'body' | 'createdAt'>;
export interface ChatDigestSnapshot {
  userId: string; groupId: string; roomId: string; cutoff: string;
  filters: ChatDigestFilters; unreadAfter?: string; sources: ChatDigestSource[];
}
export const chatDigestCategories: ReadonlyArray<{ id: ChatDigestCategory; label: string }> = [
  { id: 'prepare', label: '준비 관련' }, { id: 'time-place', label: '시간·장소 관련' },
  { id: 'check', label: '확인·논의 관련' }, { id: 'other', label: '기타' },
];
const dayMs = 86_400_000;
const kstOffset = 9 * 60 * 60 * 1000;

/** The current room must belong to the specified group; public discovery is not membership. */
export function canReadChatDigest({ state, userId, groupId, roomId }: ChatDigestContext): boolean {
  const group = state.groups.find(item => item.id === groupId);
  if (!group || !isMember(state, userId, groupId) || group.blockedMemberIds?.includes(userId)) return false;
  if (roomId === roomIdForGroup(groupId)) return true;
  // Existing Spotlog members may read activity chats without attending, including past activities.
  return state.activities.some(item => item.groupId === groupId && roomId === roomIdForActivity(item.id));
}

export function chatDigestDayKey(instant: number): string { return new Date(instant + kstOffset).toISOString().slice(0, 10); }
function dateStart(value: string | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}T00:00:00+09:00`);
  return Number.isFinite(timestamp) && chatDigestDayKey(timestamp) === value ? timestamp : NaN;
}
function windowFor(filters: ChatDigestFilters, reference: number, unreadAfter?: string): { start: number; end: number; strictStart: boolean } {
  if (!Number.isFinite(reference)) throw new Error('모아볼 기준 시각을 확인해 주세요.');
  if (filters.authorId !== undefined && !filters.authorId) throw new Error('발언한 참여자를 선택해 주세요.');
  const today = dateStart(chatDigestDayKey(reference));
  switch (filters.scope) {
    case 'all': return { start: -Infinity, end: Infinity, strictStart: false };
    case 'today': return { start: today, end: today + dayMs, strictStart: false };
    case 'recent7': return { start: today - 6 * dayMs, end: today + dayMs, strictStart: false };
    case 'unread': {
      const start = unreadAfter === undefined ? -Infinity : Date.parse(unreadAfter);
      if (Number.isNaN(start)) throw new Error('마지막 읽음 시각을 확인하지 못했어요. 다른 범위를 선택해 주세요.');
      return { start, end: Infinity, strictStart: true };
    }
    case 'date': {
      const start = dateStart(filters.from), lastDay = dateStart(filters.to);
      if (!Number.isFinite(start) || !Number.isFinite(lastDay)) throw new Error('시작 날짜와 종료 날짜를 선택해 주세요.');
      if (start > lastDay) throw new Error('종료 날짜를 시작 날짜 이후로 선택해 주세요.');
      return { start, end: lastDay + dayMs, strictStart: false };
    }
    default: throw new Error('모아볼 대화 범위를 확인해 주세요.');
  }
}

/** Selection is literal, read-only and bounded by the current account, room and generation cutoff. */
export function selectChatDigestMessages(context: ChatDigestContext, filters: ChatDigestFilters, cutoff = Date.now(), reference = cutoff): ChatDigestSource[] {
  if (!canReadChatDigest(context)) throw new Error('이 대화를 볼 권한이 없어요.');
  if (!Number.isFinite(cutoff)) throw new Error('모아볼 기준 시각을 확인해 주세요.');
  const window = windowFor(filters, reference, context.unreadAfter);
  const ids = new Map<string, number>();
  context.state.messages.forEach(message => ids.set(message.id, (ids.get(message.id) ?? 0) + 1));
  return context.state.messages.filter(message => {
    const instant = Date.parse(message.createdAt);
    return message.roomId === context.roomId && !message.deleted && message.entity === undefined && Boolean(message.id && message.body.trim()) && ids.get(message.id) === 1
      && Number.isFinite(instant) && instant <= cutoff && instant < window.end
      && (window.strictStart ? instant > window.start : instant >= window.start)
      && (filters.authorId === undefined || message.authorId === filters.authorId);
  }).map(({ id, roomId, authorId, body, createdAt }) => ({ id, roomId, authorId, body, createdAt }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

export function chatDigestSelectionKey(filters: ChatDigestFilters, unreadAfter?: string): string {
  return JSON.stringify([filters.scope, filters.authorId ?? null, filters.scope === 'date' ? filters.from ?? '' : '',
    filters.scope === 'date' ? filters.to ?? '' : '', filters.scope === 'unread' ? unreadAfter ?? null : null]);
}
export function createChatDigest(context: ChatDigestContext, filters: ChatDigestFilters, cutoff = Date.now()): ChatDigestSnapshot {
  const sources = selectChatDigestMessages(context, filters, cutoff);
  return { userId: context.userId, groupId: context.groupId, roomId: context.roomId, cutoff: new Date(cutoff).toISOString(),
    filters: { ...filters }, unreadAfter: context.unreadAfter, sources };
}

/** Never display cached text after an edit/deletion, room change or access revocation. */
export function projectChatDigest(context: ChatDigestContext, snapshot: ChatDigestSnapshot, now = Date.now()): {
  forbidden: boolean; sources: ChatDigestSource[]; removedCount: number; newMessageCount: number;
} {
  const denied = { forbidden: true, sources: [], removedCount: 0, newMessageCount: 0 };
  if (snapshot.userId !== context.userId || snapshot.groupId !== context.groupId || snapshot.roomId !== context.roomId || !canReadChatDigest(context)) return denied;
  const current = new Map<string, TogetherMessage[]>();
  context.state.messages.forEach(message => current.set(message.id, [...(current.get(message.id) ?? []), message]));
  const sources = snapshot.sources.filter(source => {
    const matches = current.get(source.id);
    const message = matches?.length === 1 ? matches[0] : undefined;
    return message && message.entity === undefined && !message.deleted && message.roomId === context.roomId && message.authorId === source.authorId
      && message.body === source.body && message.createdAt === source.createdAt;
  });
  const capturedIds = new Set(snapshot.sources.map(source => source.id));
  const latest = selectChatDigestMessages({ ...context, unreadAfter: snapshot.unreadAfter }, snapshot.filters, Math.max(now, Date.parse(snapshot.cutoff)), Date.parse(snapshot.cutoff));
  return { forbidden: false, sources, removedCount: snapshot.sources.length - sources.length,
    newMessageCount: latest.filter(message => !capturedIds.has(message.id)).length };
}

/** Keyword folders only. Original text, author and reservation/decision status are never rewritten. */
export function chatDigestCategory(body: string): ChatDigestCategory {
  if (/[?？]|확인|알아보|문의|미정|가능할|가능한지|어떨까|어때/.test(body)) return 'check';
  if (/준비|챙|지참|가져|돗자리|물병|보조배터리|준비물/.test(body)) return 'prepare';
  if (/\d\s*(?:시|분|월|일)|\d{1,2}:\d{2}|만나|집합|장소|출구|정문|역에서|카페|식당/.test(body)) return 'time-place';
  return 'other';
}
export function groupChatDigestSources(sources: ChatDigestSource[]): Array<{ id: ChatDigestCategory; label: string; sources: ChatDigestSource[] }> {
  return chatDigestCategories.map(category => ({ ...category, sources: sources.filter(source => chatDigestCategory(source.body) === category.id) })).filter(group => group.sources.length > 0);
}
