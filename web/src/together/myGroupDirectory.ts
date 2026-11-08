import type { GroupKind, TogetherActivity, TogetherGroup, TogetherState } from './model.ts';
import { roomIdForActivity, roomIdForGroup } from './model.ts';
import { koreaDay, publicActivityTimeKey } from './discovery.ts';

export type MyGroupKindFilter = 'ALL' | GroupKind;
export type MyGroupSort = 'KIND' | 'UPCOMING' | 'UNREAD' | 'NAME';
export interface MyGroupDirectoryOptions {
  kind?: MyGroupKindFilter;
  sort?: MyGroupSort;
  query?: string;
}
export interface MyGroupDirectoryItem {
  group: TogetherGroup;
  nextActivity: TogetherActivity | null;
  unreadCount: number;
  lastMessage?: { body: string; authorId: string; createdAt: string };
}
export interface MyGroupDirectoryResult {
  groups: MyGroupDirectoryItem[];
  /** Counts of eligible memberships before kind/search filtering, never public discovery totals. */
  counts: Record<MyGroupKindFilter, number>;
}

const kinds: readonly GroupKind[] = ['FAMILY', 'FRIENDS', 'HOBBY', 'GUIDE'];
const isKnownKind = (kind: unknown): kind is GroupKind => kinds.some(value => value === kind);
const textKey = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
const validDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00+09:00`))
  && koreaDay(new Date(`${value}T12:00:00+09:00`)) === value;
const idOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function byActivity(a: TogetherActivity, b: TogetherActivity): number {
  return idOrder(publicActivityTimeKey(a.date, a.startTime), publicActivityTimeKey(b.date, b.startTime))
    || idOrder(a.id, b.id);
}
function byName(a: MyGroupDirectoryItem, b: MyGroupDirectoryItem): number {
  return a.group.name.localeCompare(b.group.name, 'ko-KR') || idOrder(a.group.id, b.group.id);
}
function byUpcoming(a: MyGroupDirectoryItem, b: MyGroupDirectoryItem): number {
  if (!a.nextActivity || !b.nextActivity) {
    return Number(!a.nextActivity) - Number(!b.nextActivity) || byName(a, b);
  }
  return idOrder(publicActivityTimeKey(a.nextActivity.date, a.nextActivity.startTime), publicActivityTimeKey(b.nextActivity.date, b.nextActivity.startTime))
    || byName(a, b);
}

/**
 * Read-only directory of current persistent-group memberships. A private standalone
 * appointment is intentionally absent; unread counts never advance a read cursor.
 */
export function buildMyGroupDirectory(
  state: TogetherState,
  userId: string,
  options: MyGroupDirectoryOptions = {},
  at = new Date(),
): MyGroupDirectoryResult {
  if (!Number.isFinite(at.getTime())) throw new RangeError('목록의 기준 날짜를 확인해 주세요.');
  const counts: MyGroupDirectoryResult['counts'] = { ALL: 0, FAMILY: 0, FRIENDS: 0, HOBBY: 0, GUIDE: 0 };
  const eligible = userId ? state.groups.filter(group => group.spaceType !== 'ACTIVITY' && !group.archived
    && group.memberIds.includes(userId) && !group.blockedMemberIds?.includes(userId)) : [];
  const eligibleIds = new Set(eligible.map(group => group.id));
  const activities = new Map<string, TogetherActivity[]>();
  const roomGroups = new Map(eligible.map(group => [roomIdForGroup(group.id), group.id]));
  const today = koreaDay(at);
  for (const activity of state.activities) {
    if (!eligibleIds.has(activity.groupId)) continue;
    roomGroups.set(roomIdForActivity(activity.id), activity.groupId);
    if (activity.status !== 'PLANNED' || !validDay(activity.date)) continue;
    const end = validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date;
    if (end < today) continue;
    const groupActivities = activities.get(activity.groupId) ?? [];
    groupActivities.push(activity);
    activities.set(activity.groupId, groupActivities);
  }
  const unread = new Map<string, number>();
  const latest = new Map<string, { body: string; authorId: string; createdAt: string }>();
  for (const message of state.messages) {
    const groupId = roomGroups.get(message.roomId);
    if (!groupId || message.deleted) continue;
    const created = Date.parse(message.createdAt);
    if (Number.isFinite(created) && created <= at.getTime() && message.roomId === roomIdForGroup(groupId)
      && (!latest.has(groupId) || created > Date.parse(latest.get(groupId)!.createdAt))) {
      latest.set(groupId, { body: message.entity ? ({ POLL:'투표를 공유했어요', TASK:'준비할 일을 공유했어요', ACTIVITY:'약속을 공유했어요', NOTICE:'공지를 공유했어요', GAME:'놀이 결과를 공유했어요', CHALLENGE:'챌린지를 공유했어요' }[message.entity.type]) : message.body || (message.stickerId ? '이모티콘' : '메시지'), authorId: message.authorId, createdAt: message.createdAt });
    }
    if (message.authorId === userId) continue;
    const cursor = state.readCursors[message.roomId];
    const after = cursor ? Date.parse(cursor) : -Infinity;
    // Malformed cursor/date is not evidence that the customer has unread messages.
    if (!Number.isFinite(created) || Number.isNaN(after) || created <= after || created > at.getTime()) continue;
    unread.set(groupId, (unread.get(groupId) ?? 0) + 1);
  }
  const query = textKey(options.query ?? '');
  const selectedKind = options.kind && isKnownKind(options.kind) ? options.kind : 'ALL';
  const groups: MyGroupDirectoryItem[] = [];
  for (const group of eligible) {
    counts.ALL += 1;
    if (isKnownKind(group.kind)) counts[group.kind] += 1;
    if (selectedKind !== 'ALL' && group.kind !== selectedKind) continue;
    if (query && !textKey(`${group.name}\n${group.region}\n${group.introduction}`).includes(query)) continue;
    groups.push({ group, nextActivity: activities.get(group.id)?.sort(byActivity)[0] ?? null, unreadCount: unread.get(group.id) ?? 0, ...(latest.has(group.id) ? { lastMessage: latest.get(group.id) } : {}) });
  }
  groups.sort((a, b) => {
    if (options.sort === 'NAME') return byName(a, b);
    if (options.sort === 'UNREAD') return b.unreadCount - a.unreadCount || byUpcoming(a, b);
    if (options.sort === 'UPCOMING') return byUpcoming(a, b);
    // Unknown legacy kinds remain visible under ALL, after the four known sections.
    const rank = (kind: GroupKind) => isKnownKind(kind) ? kinds.indexOf(kind) : kinds.length;
    return rank(a.group.kind) - rank(b.group.kind) || byUpcoming(a, b);
  });
  return { groups, counts };
}
