import { memberAppointments } from './platformModel.ts';
import { koreaDay, publicActivityTimeKey } from '../together/discovery.ts';
import { buildMyGroupDirectory } from '../together/myGroupDirectory.ts';
import { roomIdForActivity, roomIdForGroup, type TogetherState } from '../together/model.ts';

export interface MemberReturnActivity {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  date: string;
  endDate: string;
  startTime?: string;
}

export interface MemberReturnChat {
  groupId: string;
  groupName: string;
  activityId?: string;
  activityTitle?: string;
  unreadCount: number;
}

export interface MemberHomeReturn {
  nextActivity: MemberReturnActivity | null;
  unreadChat: MemberReturnChat | null;
}

const validDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00+09:00`))
  && koreaDay(new Date(`${value}T12:00:00+09:00`)) === value;
const validTime = (value: string | undefined): value is string => Boolean(value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));

/**
 * Member-only return destinations, intentionally separate from the public home
 * projection. The allowlist contains no message body, precise meeting point,
 * participant identifiers or route; reading it never advances a read cursor.
 */
export function selectMemberHomeReturn(state: TogetherState, viewerId = '', at = new Date()): MemberHomeReturn {
  const empty: MemberHomeReturn = { nextActivity: null, unreadChat: null };
  if (!viewerId || !state.members.some(member => member.id === viewerId)) return empty;
  if (!Number.isFinite(at.getTime())) throw new RangeError('이어보기의 기준 날짜를 확인해 주세요.');
  const today = koreaDay(at);
  const next = memberAppointments(state, viewerId, 'upcoming', today)
    .filter(activity => activity.status === 'PLANNED' && validDay(activity.date)
      && activity.participants[viewerId] !== 'DECLINED'
      && (validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date) >= today)
    .sort((a, b) => publicActivityTimeKey(a.date, a.startTime).localeCompare(publicActivityTimeKey(b.date, b.startTime)) || a.id.localeCompare(b.id))[0];
  const nextGroup = next && state.groups.find(group => group.id === next.groupId);
  const nextActivity: MemberReturnActivity | null = next && nextGroup ? {
    id: next.id, groupId: next.groupId, groupName: nextGroup.name, title: next.title, date: next.date,
    endDate: validDay(next.endDate) && next.endDate >= next.date ? next.endDate : next.date,
    ...(validTime(next.startTime) ? { startTime: next.startTime } : {}),
  } : null;

  // Reuse the current persistent-membership gate, then constrain each room.
  // The directory's historical unread total also includes cancelled activities;
  // those must never become a home return destination.
  const { groups } = buildMyGroupDirectory(state, viewerId, {}, at);
  const rooms = new Map<string, Omit<MemberReturnChat, 'unreadCount'>>();
  for (const { group } of groups) rooms.set(roomIdForGroup(group.id), { groupId: group.id, groupName: group.name });
  const eligible = new Map(groups.map(({ group }) => [group.id, group]));
  for (const activity of state.activities) {
    const group = eligible.get(activity.groupId);
    if (!group || activity.status !== 'PLANNED' || activity.participants[viewerId] === 'DECLINED') continue;
    rooms.set(roomIdForActivity(activity.id), { groupId: group.id, groupName: group.name, activityId: activity.id, activityTitle: activity.title });
  }
  const unread = new Map<string, { count: number; latest: number }>();
  for (const message of state.messages) {
    if (!rooms.has(message.roomId) || message.deleted || message.authorId === viewerId) continue;
    const created = Date.parse(message.createdAt);
    const cursor = state.readCursors[message.roomId];
    const after = cursor ? Date.parse(cursor) : -Infinity;
    if (!Number.isFinite(created) || Number.isNaN(after) || created <= after || created > at.getTime()) continue;
    const previous = unread.get(message.roomId);
    unread.set(message.roomId, { count: (previous?.count ?? 0) + 1, latest: Math.max(previous?.latest ?? -Infinity, created) });
  }
  const latestRoom = [...unread.entries()].sort((a, b) => b[1].latest - a[1].latest || a[0].localeCompare(b[0]))[0];
  const unreadChat = latestRoom ? { ...rooms.get(latestRoom[0])!, unreadCount: latestRoom[1].count } : null;
  return { nextActivity, unreadChat };
}
