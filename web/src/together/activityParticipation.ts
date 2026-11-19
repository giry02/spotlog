import type { TogetherActivity, TogetherGroup, TogetherState } from './model.ts';
import { koreaDay, shiftDay } from './discovery.ts';

export interface ActivityRepeatRule { intervalDays: 7 | 14 | 28; count: number }
export interface ActivityRepeatPreview {
  seriesId: string; actorId: string; groupId: string; sourceActivityId: string; sourceRevision: number;
  sourceVersion: string; intervalDays: 7 | 14 | 28; count: number;
  dates: Array<{ date: string; endDate: string }>;
}
const validDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const safeId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200
  && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function isActivityParticipationFields(row: Record<string, unknown>): boolean {
  if (row.endTime !== undefined && (typeof row.endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.endTime)
    || typeof row.startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime)
    || !validDay(row.date) || row.endDate !== '' && !validDay(row.endDate)
    || typeof row.endDate === 'string' && row.endDate !== '' && row.endDate < row.date
    || (!row.endDate || row.endDate === row.date) && row.endTime <= row.startTime)) return false;
  if (row.waitlist !== undefined && (!Array.isArray(row.waitlist) || row.waitlist.length > 500
    || !row.waitlist.every(safeId) || new Set(row.waitlist).size !== row.waitlist.length)) return false;
  if (row.repeat === undefined) return true;
  const value = row.repeat;
  return record(value) && Object.keys(value).length === 5 && safeId(value.seriesId) && safeId(value.sourceActivityId)
    && Number.isInteger(value.index) && Number.isInteger(value.count) && Number(value.count) >= 2 && Number(value.count) <= 8
    && Number(value.index) >= 1 && Number(value.index) <= Number(value.count)
    && typeof value.intervalDays === 'number' && [7, 14, 28].includes(value.intervalDays);
}

function context(state: TogetherState, actorId: string, groupId: string, activityId: string, at: Date) {
  const group = state.groups.find(item => item.id === groupId);
  const activity = state.activities.find(item => item.id === activityId && item.groupId === groupId);
  if (!Number.isFinite(at.getTime()) || !actorId || !group || !activity || !state.members.some(item => item.id === actorId)
    || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) throw new Error('지금 참여 중인 모임과 약속을 다시 확인해 주세요.');
  if (!isActivityParticipationFields({ ...activity })) throw new Error('약속의 시간과 참가 정보를 다시 확인해 주세요.');
  const endDate = validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date;
  const writable = !group.archived && activity.status === 'PLANNED'
    && (!validDay(endDate) || endDate >= koreaDay(at)) && !group.temporaryRoom?.closedAt
    && (!group.temporaryRoom?.expiresAt || Date.parse(group.temporaryRoom.expiresAt) > at.getTime());
  return { group, activity, writable };
}

/** Offers reserve a position only. A waiting member confirms their own attendance. */
export function selectActivityParticipation(state: TogetherState, actorId: string, groupId: string, activityId: string, at = new Date()) {
  let value: ReturnType<typeof context>;
  try { value = context(state, actorId, groupId, activityId, at); } catch { return null; }
  const { group, activity, writable } = value;
  const eligible = (id: string) => group.memberIds.includes(id) && !group.blockedMemberIds?.includes(id)
    && state.members.some(item => item.id === id);
  const joinedIds = Object.keys(activity.participants).filter(id => eligible(id) && activity.participants[id] === 'JOINED');
  const waitingIds = (activity.waitlist || []).filter(id => eligible(id) && activity.participants[id] !== 'JOINED');
  const seats = activity.capacity === undefined ? Infinity : Math.max(0, activity.capacity - joinedIds.length);
  const offeredIds = waitingIds.slice(0, seats);
  const position = waitingIds.indexOf(actorId);
  return { writable, capacity: activity.capacity, joinedCount: joinedIds.length, waitingCount: waitingIds.length,
    waitingIds, offeredIds, waitingPosition: position < 0 ? undefined : position + 1,
    isJoined: activity.participants[actorId] === 'JOINED', seatOffered: writable && offeredIds.includes(actorId),
    canJoin: writable && (joinedIds.includes(actorId) || activity.capacity === undefined
      || seats > 0 && (offeredIds.includes(actorId) || waitingIds.length < seats)),
    canJoinWaitlist: writable && activity.capacity !== undefined && !joinedIds.includes(actorId) && position < 0 && waitingIds.length < 500 && seats <= waitingIds.length,
    canRepeat: writable && group.spaceType !== 'ACTIVITY' && !group.temporaryRoom && activity.kind !== 'TRIP'
      && validDay(activity.date) && (activity.endDate === '' || activity.endDate === activity.date)
      && managesActivity(group, activity, actorId) };
}

function managesActivity(group: TogetherGroup, activity: TogetherActivity, actorId: string) {
  return group.ownerId === actorId || group.managerIds.includes(actorId) || activity.leadId === actorId || activity.editorIds.includes(actorId);
}

export function setActivityWaitlist(state: TogetherState, actorId: string, groupId: string, activityId: string, join: boolean, at = new Date()): void {
  const access = context(state, actorId, groupId, activityId, at);
  const view = selectActivityParticipation(state, actorId, groupId, activityId, at)!;
  if (!access.writable) throw new Error('지난·완료·취소·보관된 약속은 대기를 바꿀 수 없어요.');
  if (join && view.waitingPosition !== undefined || !join && view.waitingPosition === undefined) return;
  if (join && !view.canJoinWaitlist) throw new Error('지금은 대기 신청 대신 참가 여부를 선택할 수 있어요.');
  access.activity.waitlist = join ? [...view.waitingIds, actorId] : view.waitingIds.filter(id => id !== actorId);
  access.activity.revision += 1;
}

function repeatSource(activity: TogetherActivity) {
  return JSON.stringify([activity.title, activity.date, activity.endDate, activity.startTime, activity.endTime,
    activity.meetingPoint, activity.description, activity.cover, activity.capacity, activity.kind, activity.venuePlaceId, activity.placeCandidateIds]);
}
function ruleValid(rule: ActivityRepeatRule) {
  return rule && [7, 14, 28].includes(rule.intervalDays) && Number.isInteger(rule.count) && rule.count >= 2 && rule.count <= 8;
}

/** Previews only additional dates. Each occurrence starts with no attendance, records or private route. */
export function previewActivityRepeats(state: TogetherState, actorId: string, groupId: string, activityId: string, rule: ActivityRepeatRule, at = new Date()): ActivityRepeatPreview {
  const { activity } = context(state, actorId, groupId, activityId, at);
  const view = selectActivityParticipation(state, actorId, groupId, activityId, at);
  if (!view?.canRepeat) throw new Error('담당자가 날짜가 있는 하루 약속에서 반복 일정을 만들 수 있어요.');
  if (!ruleValid(rule)) throw new Error('반복 간격과 추가 회차 2~8회를 선택해 주세요.');
  const dates = Array.from({ length: rule.count }, (_, index) => {
    const date = shiftDay(activity.date, rule.intervalDays * (index + 1));
    return { date, endDate: date };
  });
  return { seriesId: 'repeat-' + crypto.randomUUID(), actorId, groupId, sourceActivityId: activityId,
    sourceRevision: activity.revision, sourceVersion: repeatSource(activity), ...rule, dates };
}

/** Revalidates the reviewed source and creates all additional dates in one repository transaction. */
export function applyActivityRepeatPreview(state: TogetherState, actorId: string, preview: ActivityRepeatPreview, at = new Date()): string[] {
  if (!preview || actorId !== preview.actorId || !safeId(preview.seriesId) || !ruleValid(preview)) throw new Error('반복 일정의 검토 내용을 다시 확인해 주세요.');
  const { activity } = context(state, actorId, preview.groupId, preview.sourceActivityId, at);
  if (!selectActivityParticipation(state, actorId, preview.groupId, preview.sourceActivityId, at)?.canRepeat) throw new Error('지금 이 약속의 반복 일정을 만들 수 없어요.');
  const existing = state.activities.filter(item => item.groupId === preview.groupId && item.repeat?.seriesId === preview.seriesId);
  if (existing.length) {
    if (existing.length !== preview.count || existing.some(item => item.repeat?.sourceActivityId !== activity.id)) throw new Error('만들어진 반복 회차를 다시 확인해 주세요.');
    return existing.sort((a, b) => a.repeat!.index - b.repeat!.index).map(item => item.id);
  }
  if (activity.revision !== preview.sourceRevision || repeatSource(activity) !== preview.sourceVersion
    || !Array.isArray(preview.dates) || preview.dates.length !== preview.count
    || preview.dates.some((row, index) => row.date !== shiftDay(activity.date, preview.intervalDays * (index + 1)) || row.endDate !== row.date)) {
    throw new Error('원래 약속이 바뀌었어요. 추가할 날짜를 다시 확인해 주세요.');
  }
  const copies: TogetherActivity[] = preview.dates.map((row, index) => ({
    id: preview.seriesId + '-' + (index + 1), groupId: preview.groupId,
    title: activity.title, date: row.date, endDate: row.endDate, meetingPoint: activity.meetingPoint, description: activity.description,
    status: 'PLANNED', kind: 'MEETUP', leadId: actorId, editorIds: [], participants: {}, arrivedIds: [], revision: 1,
    ...(activity.startTime && { startTime: activity.startTime }), ...(activity.endTime && { endTime: activity.endTime }),
    ...(activity.cover && { cover: activity.cover }), ...(activity.capacity !== undefined && { capacity: activity.capacity }),
    ...(activity.venuePlaceId && { venuePlaceId: activity.venuePlaceId }),
    ...(activity.placeCandidateIds && { placeCandidateIds: [...activity.placeCandidateIds] }),
    repeat: { seriesId: preview.seriesId, sourceActivityId: activity.id, index: index + 1, count: preview.count, intervalDays: preview.intervalDays },
  }));
  if (copies.some(item => state.activities.some(existing => existing.id === item.id))) throw new Error('같은 반복 일정이 이미 있어요.');
  state.activities.push(...copies);
  return copies.map(item => item.id);
}
