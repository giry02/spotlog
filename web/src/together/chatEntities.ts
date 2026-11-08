import { canEditActivity, roomIdForActivity, roomIdForGroup, type ChatEntityReference, type TogetherActivity, type TogetherGroup, type TogetherMessage, type TogetherNotice, type TogetherPoll, type TogetherState, type TogetherTask } from './model.ts';
import type { TogetherGame } from './gameTypes.ts';
import type { TogetherChallenge } from './challengeTypes.ts';
import { isPollClosed, voteRoomPoll } from './polls.ts';

export type ChatEntityProjection =
  | { type: 'POLL'; value: TogetherPoll; canInteract: boolean }
  | { type: 'TASK'; value: TogetherTask; canInteract: boolean }
  | { type: 'ACTIVITY'; value: TogetherActivity; canInteract: boolean }
  | { type: 'NOTICE'; value: TogetherNotice; canInteract: boolean }
  | { type: 'GAME'; value: TogetherGame; canInteract: boolean }
  | { type: 'CHALLENGE'; value: TogetherChallenge; canInteract: boolean };

export function isChatEntityReference(value: unknown): value is ChatEntityReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return ['POLL', 'TASK', 'ACTIVITY', 'NOTICE', 'GAME', 'CHALLENGE'].includes(String(ref.type)) && typeof ref.id === 'string' && ref.id.trim().length > 0
    && Object.keys(ref).every(key => key === 'type' || key === 'id');
}

function resolveReference(state: TogetherState, ref: ChatEntityReference) {
  if (!isChatEntityReference(ref)) return null;
  if (ref.type === 'POLL') { const value = state.polls.find(item => item.id === ref.id); return value ? { type: ref.type, value } as const : null; }
  if (ref.type === 'TASK') { const value = state.tasks.find(item => item.id === ref.id); return value ? { type: ref.type, value } as const : null; }
  if (ref.type === 'NOTICE') { const value = state.notices.find(item => item.id === ref.id); return value ? { type: ref.type, value } as const : null; }
  if (ref.type === 'GAME') { const value = state.games?.find(item => item.id === ref.id); return value ? { type: ref.type, value } as const : null; }
  if (ref.type === 'CHALLENGE') { const value = state.challenges?.find(item => item.id === ref.id); return value ? { type: ref.type, value } as const : null; }
  const value = state.activities.find(item => item.id === ref.id); return value ? { type: ref.type, value } as const : null;
}

function memberGroup(state: TogetherState, actorId: string, groupId: string): TogetherGroup | undefined {
  const group = state.groups.find(item => item.id === groupId);
  return group && actorId && group.memberIds.includes(actorId) && !group.blockedMemberIds?.includes(actorId) ? group : undefined;
}
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const activityOpen = (activity?: TogetherActivity) => !activity || activity.status === 'PLANNED' && (!(activity.endDate || activity.date) || (activity.endDate || activity.date) >= today());
const groupManager = (group: TogetherGroup, actorId: string) => group.ownerId === actorId || group.managerIds.includes(actorId);

/** One original entity, projected only into its owning room. Activity links may also live in their persistent group's room. */
export function readChatEntity(state: TogetherState, actorId: string, roomId: string, message: TogetherMessage): ChatEntityProjection | null {
  if (message.deleted || message.roomId !== roomId || !message.entity) return null;
  const found = resolveReference(state, message.entity);
  if (!found) return null;
  const group = memberGroup(state, actorId, found.value.groupId);
  if (!group) return null;
  const activityId = found.type === 'ACTIVITY' ? found.value.id : found.value.activityId;
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === group.id) : undefined;
  if (activityId && !activity) return null;
  const owningRoom = activity ? roomIdForActivity(activity.id) : roomIdForGroup(group.id);
  const groupActivityLink = found.type === 'ACTIVITY' && group.spaceType !== 'ACTIVITY' && roomId === roomIdForGroup(group.id);
  if (roomId !== owningRoom && !groupActivityLink) return null;
  const active = !group.archived && activityOpen(activity);
  if (found.type === 'POLL') return { ...found, canInteract: active && !isPollClosed(found.value) };
  if (found.type === 'TASK') return { ...found, canInteract: active && (found.value.assigneeId === actorId || (activity ? canEditActivity(state, actorId, activity) : groupManager(group, actorId))) };
  if (found.type === 'CHALLENGE') return { ...found, canInteract: active && !found.value.closed && found.value.endDate >= today() };
  return { ...found, canInteract: false };
}

export interface ShareChatEntityOptions {
  /** Explicit activity updates can be shown in their activity room; unrelated rooms are always rejected. */
  roomId?: string;
  /** Stable action ID for a distinct update to the same object. Retries reuse this exact ID. */
  eventId?: string;
  body?: string;
}

/** Call in the same repository transaction as the explicit create action. Never backfills old records. */
export function shareChatEntity(state: TogetherState, actorId: string, ref: ChatEntityReference, options: ShareChatEntityOptions = {}): TogetherMessage {
  const found = resolveReference(state, ref);
  if (!found) throw new Error('대화에 올릴 항목을 찾지 못했어요.');
  const group = memberGroup(state, actorId, found.value.groupId);
  if (!group || group.archived) throw new Error('현재 모임원만 진행 중인 대화에 항목을 올릴 수 있어요.');
  const activityId = found.type === 'ACTIVITY' ? found.value.id : found.value.activityId;
  const roomId = options.roomId ?? (found.type === 'ACTIVITY' && group.spaceType !== 'ACTIVITY' ? roomIdForGroup(group.id) : activityId ? roomIdForActivity(activityId) : roomIdForGroup(group.id));
  if (options.eventId !== undefined && (typeof options.eventId !== 'string' || !options.eventId.trim() || options.eventId.length > 200)) throw new Error('공유 요청을 다시 확인해 주세요.');
  if (options.body !== undefined && (typeof options.body !== 'string' || options.body.length > 500)) throw new Error('공유 안내를 다시 확인해 주세요.');
  const body = options.body?.trim() ?? '';
  const id = options.eventId
    ? `entity-event:${encodeURIComponent(roomId)}:${encodeURIComponent(options.eventId)}`
    : `entity:${encodeURIComponent(roomId)}:${ref.type}:${encodeURIComponent(ref.id)}`;
  const message: TogetherMessage = { id, roomId, authorId: actorId, body, createdAt: new Date().toISOString(), entity: { type: ref.type, id: ref.id } };
  const projection = readChatEntity(state, actorId, roomId, message);
  if (!projection) throw new Error('이 항목은 선택한 대화방에 올릴 수 없어요.');
  if (['POLL', 'TASK', 'GAME', 'CHALLENGE'].includes(projection.type) && !activityOpen(activityId ? state.activities.find(item => item.id === activityId && item.groupId === group.id) : undefined)) throw new Error('지난 약속에는 진행 항목을 새로 공유할 수 없어요.');
  const previous = state.messages.find(item => item.id === id);
  if (previous) {
    if (previous.roomId !== roomId || previous.entity?.type !== ref.type || previous.entity.id !== ref.id || previous.body !== body) throw new Error('다른 공유에 사용된 요청이에요.');
    return previous;
  }
  const existing = !options.eventId && state.messages.find(item => item.roomId === roomId && item.entity?.type === ref.type && item.entity.id === ref.id);
  if (existing) return existing;
  state.messages.push(message);
  return message;
}

function liveCard(state: TogetherState, actorId: string, roomId: string, type: ChatEntityReference['type'], id: string) {
  const message = state.messages.find(item => item.roomId === roomId && !item.deleted && item.entity?.type === type && item.entity.id === id);
  const projection = message && readChatEntity(state, actorId, roomId, message);
  if (!projection) throw new Error('이 대화에서 사용할 수 없는 항목이에요.');
  return projection;
}

/** Casting a vote changes this actor's selection only. It never applies a time, venue or RSVP. */
export function voteChatPoll(state: TogetherState, actorId: string, roomId: string, pollId: string, optionId: string | null): TogetherPoll {
  const projection = liveCard(state, actorId, roomId, 'POLL', pollId);
  if (projection.type !== 'POLL' || !projection.canInteract) throw new Error('현재 이 투표에 응답할 수 없어요.');
  return voteRoomPoll(state, actorId, pollId, optionId);
}

export function toggleChatTask(state: TogetherState, actorId: string, roomId: string, taskId: string): TogetherTask {
  const projection = liveCard(state, actorId, roomId, 'TASK', taskId);
  if (projection.type !== 'TASK' || !projection.canInteract) throw new Error('담당자나 일정 운영자만 이 준비 상태를 바꿀 수 있어요.');
  projection.value.completed = !projection.value.completed;
  return projection.value;
}
