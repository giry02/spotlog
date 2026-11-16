import { togetherId, type TogetherActivity, type TogetherGroup, type TogetherState } from './model.ts';

export const TEMPORARY_ROOM_PURPOSES = ['DINNER', 'BUSINESS', 'GATHERING'] as const;
export type TemporaryRoomPurpose = typeof TEMPORARY_ROOM_PURPOSES[number];
export interface TemporaryRoomSettings {
  purpose: TemporaryRoomPurpose;
  /** Only an explicitly chosen deadline closes a room automatically. No records are deleted. */
  expiresAt?: string;
  closedAt?: string;
  closedBy?: string;
  closeReason?: 'MANUAL' | 'EXPIRED';
  disposition?: 'ARCHIVE' | 'TRASH';
  trashedAt?: string;
}
export interface TemporaryRoomInput {
  title: string; purpose: TemporaryRoomPurpose; region?: string; date?: string;
  startTime?: string; description?: string; expiresAt?: string;
}
export const temporaryRoomPurposeLabel = (purpose: TemporaryRoomPurpose) => ({ DINNER: '회식', BUSINESS: '영업·접대', GATHERING: '일회성 모임' })[purpose];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
export function isTemporaryRoomSettings(value: unknown): value is TemporaryRoomSettings {
  if (!object(value) || !TEMPORARY_ROOM_PURPOSES.includes(value.purpose as TemporaryRoomPurpose)
    || Object.keys(value).some(key => !['purpose', 'expiresAt', 'closedAt', 'closedBy', 'closeReason', 'disposition', 'trashedAt'].includes(key))
    || value.expiresAt !== undefined && !timestamp(value.expiresAt)) return false;
  if (value.closedAt === undefined) return value.closedBy === undefined && value.closeReason === undefined && value.disposition === undefined && value.trashedAt === undefined;
  return timestamp(value.closedAt) && ['ARCHIVE', 'TRASH', undefined].includes(value.disposition as string | undefined)
    && (value.disposition === 'TRASH' ? timestamp(value.trashedAt) : value.trashedAt === undefined)
    && (value.closeReason === 'EXPIRED' && value.closedBy === undefined && timestamp(value.expiresAt) && Date.parse(value.closedAt) >= Date.parse(value.expiresAt)
    || value.closeReason === 'MANUAL' && typeof value.closedBy === 'string' && Boolean(value.closedBy.trim()));
}
export const isTemporaryRoomTrashed = (group: TogetherGroup | undefined): boolean => group?.temporaryRoom?.disposition === 'TRASH';
function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function validNow(at: Date): number {
  const time = at.getTime();
  if (!Number.isFinite(time)) throw new Error('현재 시간을 확인한 뒤 다시 시도해 주세요.');
  return time;
}

/** Makes one private appointment space. Creating it does not RSVP or register other members. */
export function createTemporaryRoom(state: TogetherState, actorId: string, input: TemporaryRoomInput, at = new Date()): { groupId: string; activityId: string } {
  const now = validNow(at);
  if (!actorId || !state.members.some(member => member.id === actorId)) throw new Error('로그인 후 일회성 모임을 만들어 주세요.');
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 80 || !TEMPORARY_ROOM_PURPOSES.includes(input.purpose)) throw new Error('모임 이름과 용도를 확인해 주세요.');
  if (input.region !== undefined && (typeof input.region !== 'string' || input.region.length > 100)
    || input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 2000)) throw new Error('지역은 100자, 안내는 2,000자 이내로 적어 주세요.');
  if (input.date !== undefined && input.date !== '' && !validDay(input.date)
    || input.startTime !== undefined && input.startTime !== '' && (!input.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime))) throw new Error('만날 날짜와 시간을 다시 확인해 주세요.');
  if (input.expiresAt !== undefined && (!timestamp(input.expiresAt) || Date.parse(input.expiresAt) <= now)) throw new Error('자동 종료 시간은 지금보다 이후로 선택해 주세요.');
  if (input.expiresAt && input.date && Date.parse(input.expiresAt) <= Date.parse(`${input.date}T${input.startTime || '00:00'}:00+09:00`)) throw new Error('자동 종료 시간은 약속 시작 이후로 선택해 주세요.');
  const title = input.title.trim(), groupId = togetherId('oneoff-space'), activityId = togetherId('oneoff');
  const temporaryRoom: TemporaryRoomSettings = { purpose: input.purpose, ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt).toISOString() } : {}) };
  state.groups.push({ id: groupId, name: title, kind: 'FRIENDS', region: input.region?.trim() || '', introduction: input.description?.trim() || '', cover: '',
    spaceType: 'ACTIVITY', visibility: 'PRIVATE', ownerId: actorId, memberIds: [actorId], managerIds: [], archived: false,
    promotionPublished: false, sourceKind: 'LOCAL', interestPlaceIds: [], createdAt: at.toISOString(), temporaryRoom });
  state.activities.push({ id: activityId, groupId, title, date: input.date || '', endDate: input.date || '', meetingPoint: '', description: input.description?.trim() || '',
    status: 'PLANNED', leadId: actorId, editorIds: [], participants: {}, arrivedIds: [], revision: 1, kind: 'MEETUP',
    ...(input.startTime ? { startTime: input.startTime } : {}) });
  return { groupId, activityId };
}

function archiveRoom(state: TogetherState, group: TogetherGroup, activity: TogetherActivity, at: Date, actorId?: string, disposition: 'ARCHIVE' | 'TRASH' = 'ARCHIVE'): void {
  group.archived = true;
  group.promotionPublished = false;
  group.promotionActivityIds = [];
  group.promotionActivitySnapshots = [];
  group.temporaryRoom = { ...group.temporaryRoom!, closedAt: at.toISOString(), disposition, ...(disposition === 'TRASH' ? { trashedAt: at.toISOString() } : {}), ...(actorId ? { closedBy: actorId, closeReason: 'MANUAL' as const } : { closeReason: 'EXPIRED' as const }) };
  if (activity.status === 'PLANNED') activity.status = 'COMPLETED';
  activity.revision += 1;
  state.invites.filter(invite => invite.groupId === group.id).forEach(invite => { invite.revoked = true; });
}

/** Owner/managers close the reviewed exact original. History, members, routes and RSVP remain intact. */
export function closeTemporaryRoom(state: TogetherState, actorId: string, groupId: string, activityId: string, expectedRevision: number, disposition: 'ARCHIVE' | 'TRASH' = 'ARCHIVE', at = new Date()): TogetherActivity {
  validNow(at);
  const group = state.groups.find(item => item.id === groupId), activities = state.activities.filter(item => item.groupId === groupId);
  const activity = activities.find(item => item.id === activityId);
  const trashRetainedHistory = group?.archived && group.temporaryRoom?.closedAt && !isTemporaryRoomTrashed(group) && disposition === 'TRASH';
  if (!group || group.spaceType !== 'ACTIVITY' || !isTemporaryRoomSettings(group.temporaryRoom) || !activity || activities.length !== 1 || (group.archived || group.temporaryRoom.closedAt) && !trashRetainedHistory
    || !state.members.some(member => member.id === actorId) || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)
    || group.ownerId !== actorId && !group.managerIds.includes(actorId)) throw new Error('일회성 모임의 방장과 매니저만 이 방을 종료할 수 있어요.');
  if (!Number.isInteger(expectedRevision) || expectedRevision !== activity.revision) throw new Error('일정이 변경됐어요. 최신 내용을 확인하고 다시 종료해 주세요.');
  if (!['ARCHIVE', 'TRASH'].includes(disposition) || disposition === 'TRASH' && group.ownerId !== actorId) throw new Error('만든 사람만 휴지통으로 이동할 수 있어요.');
  if (trashRetainedHistory) {
    group.temporaryRoom = { ...group.temporaryRoom, disposition: 'TRASH', trashedAt: at.toISOString() };
    activity.revision += 1;
    return activity;
  }
  archiveRoom(state, group, activity, at, actorId, disposition);
  return activity;
}

/** The creator restores retained history only. Closing, invite revocation and RSVP are never undone. */
export function restoreTemporaryRoom(state: TogetherState, actorId: string, groupId: string, activityId: string, expectedRevision: number, at = new Date()): TogetherActivity {
  validNow(at);
  const group = state.groups.find(item => item.id === groupId), activities = state.activities.filter(item => item.groupId === groupId);
  const activity = activities.find(item => item.id === activityId);
  if (!group || group.spaceType !== 'ACTIVITY' || !isTemporaryRoomSettings(group.temporaryRoom) || !isTemporaryRoomTrashed(group) || !group.archived || !activity || activities.length !== 1
    || group.ownerId !== actorId || !state.members.some(member => member.id === actorId) || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) throw new Error('만든 사람만 이 일회성 모임의 기록을 복원할 수 있어요.');
  if (!Number.isInteger(expectedRevision) || expectedRevision !== activity.revision) throw new Error('기록 상태가 변경됐어요. 최신 내용을 다시 확인해 주세요.');
  const { trashedAt: _trashedAt, ...retained } = group.temporaryRoom!;
  group.temporaryRoom = { ...retained, disposition: 'ARCHIVE' };
  activity.revision += 1;
  return activity;
}

/** Explicit deadlines only; idempotent and limited to the one-off backing space. */
export function expireTemporaryRooms(state: TogetherState, at = new Date()): number {
  const now = validNow(at); let changed = 0;
  for (const group of state.groups) {
    const settings = group.temporaryRoom;
    if (group.spaceType !== 'ACTIVITY' || !settings || !isTemporaryRoomSettings(settings) || settings.closedAt || !settings.expiresAt || Date.parse(settings.expiresAt) > now) continue;
    const activities = state.activities.filter(activity => activity.groupId === group.id);
    if (activities.length !== 1) continue;
    archiveRoom(state, group, activities[0], at); changed += 1;
  }
  return changed;
}
