import type { PublicActivityIntent, TogetherGroup, TogetherState } from './model';
import { togetherId } from './model.ts';
import { discoveryProfile, isDiscoverableGroup, koreaDay, upcomingPublicActivities } from './discovery.ts';

/** Allow only a bounded public identifier/date envelope, including on restored history records. */
export function isPublicActivityIntent(value: unknown): value is PublicActivityIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 3 && Object.keys(row).every(key => ['groupId', 'activityId', 'date'].includes(key))
    && ['groupId', 'activityId'].every(key => typeof row[key] === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(row[key] as string))
    && typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    && Number.isFinite(Date.parse(`${row.date}T12:00:00+09:00`)) && koreaDay(new Date(`${row.date}T12:00:00+09:00`)) === row.date;
}

/** Resolves against the approved public projection every time. It never returns internal activity fields. */
export function resolvePublicActivityIntent(state: TogetherState, value: unknown, viewerId = '', at = new Date()) {
  if (!isPublicActivityIntent(value)) return null;
  const group = state.groups.find(item => item.id === value.groupId);
  if (!group || !isDiscoverableGroup(group) || discoveryProfile(group).recruitment !== 'OPEN'
    || Boolean(viewerId && group.blockedMemberIds?.includes(viewerId))) return null;
  const activity = upcomingPublicActivities(state, group, at).find(item => item.id === value.activityId && item.groupId === group.id && item.date === value.date);
  if (!activity) return null;
  return { activity, canOpen: Boolean(viewerId && group.memberIds.includes(viewerId)) };
}

export function createPublicActivityIntent(state: TogetherState, groupId: string, activityId: string, at = new Date()): PublicActivityIntent | undefined {
  const group = state.groups.find(item => item.id === groupId);
  const activity = group && upcomingPublicActivities(state, group, at).find(item => item.id === activityId);
  if (!activity) return undefined;
  const intent = { groupId, activityId, date: activity.date };
  return resolvePublicActivityIntent(state, intent, '', at) ? intent : undefined;
}

/** Exact public policy snapshot for confirmation. Membership changes do not invalidate an unrelated person's confirmation. */
export function publicGroupJoinVersion(group: TogetherGroup): string {
  const profile = discoveryProfile(group);
  return JSON.stringify([group.id, group.name, group.introduction, group.visibility, group.promotionPublished, group.archived,
    group.region, profile.district, profile.joinMode, profile.recruitment, profile.joinGuide, profile.welcome, profile.topics, profile.style]);
}

function joinableGroup(state: TogetherState, groupId: string, userId: string, intent: PublicActivityIntent | undefined, at: Date, expectedVersion?: string) {
  const group = state.groups.find(item => item.id === groupId);
  if (!userId || !state.members.some(member => member.id === userId)) throw new Error('로그인 후 모임에 가입해 주세요.');
  if (!group || !isDiscoverableGroup(group) || discoveryProfile(group).recruitment !== 'OPEN' || group.blockedMemberIds?.includes(userId)) throw new Error('현재 가입을 받을 수 없는 모임이에요.');
  if (expectedVersion !== undefined && expectedVersion !== publicGroupJoinVersion(group)) throw new Error('가입 방식이나 모임 안내가 바뀌었어요. 모임 소개를 다시 확인해 주세요.');
  if (intent && (intent.groupId !== groupId || !resolvePublicActivityIntent(state, intent, userId, at))) throw new Error('선택한 정모의 공개 안내가 바뀌었어요. 모임 소개에서 일정을 다시 확인해 주세요.');
  return group;
}

/** Explicit direct join only. It never accepts an invite, RSVP, booking or private appointment on the actor's behalf. */
export function joinPublicGroup(state: TogetherState, groupId: string, userId: string, expectedVersion: string, intent?: PublicActivityIntent, at = new Date()): string {
  if (typeof expectedVersion !== 'string' || !expectedVersion) throw new Error('가입 안내를 다시 확인해 주세요.');
  const group = joinableGroup(state, groupId, userId, intent, at, expectedVersion);
  if (discoveryProfile(group).joinMode !== 'DIRECT') throw new Error('운영진 승인이 필요한 모임이에요. 가입 신청을 확인해 주세요.');
  if (group.memberIds.includes(userId)) return group.id;
  group.memberIds.push(userId);
  // A previously pending request is fulfilled by this new, explicit direct join; preserve its original text and ID.
  const pending = state.applications.find(item => item.groupId === groupId && item.userId === userId && item.status === 'PENDING');
  if (pending) { pending.status = 'APPROVED'; pending.decidedAt = at.toISOString(); pending.decidedBy = userId; pending.joinMode = 'DIRECT'; }
  return group.id;
}

/** Saves the selected public card with the applicant, without joining or changing any RSVP. */
export function requestGroupApplication(state: TogetherState, groupId: string, userId: string, message = '', intent?: PublicActivityIntent, at = new Date(), expectedVersion?: string) {
  const group = joinableGroup(state, groupId, userId, intent, at, expectedVersion);
  if (discoveryProfile(group).joinMode !== 'APPROVAL') throw new Error('바로 가입할 수 있는 모임이에요. 가입 안내를 다시 확인해 주세요.');
  if (group.memberIds.includes(userId)) throw new Error('이미 가입한 모임이에요. 모임 홈에서 확인해 주세요.');
  const body = message.trim();
  if (body.length > 500) throw new Error('가입 인사는 500자 이내로 적어 주세요.');
  const old = state.applications.find(item => item.groupId === groupId && item.userId === userId);
  if (old?.status === 'PENDING') return old;
  const request = { status: 'PENDING' as const, joinMode: 'APPROVAL' as const, message: body, createdAt: at.toISOString(), decidedAt: undefined, decidedBy: undefined,
    publicActivityIntent: intent ? { groupId: intent.groupId, activityId: intent.activityId, date: intent.date } : undefined };
  if (old) { Object.assign(old, request); return old; }
  const application = { id: togetherId('application'), groupId, userId, ...request };
  state.applications.push(application);
  return application;
}
