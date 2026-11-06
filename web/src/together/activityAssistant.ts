import type { Place } from '../data';
import { canEditActivity, roomIdForActivity, roomIdForGroup, unpublishActivityFromGroup, type TogetherState } from './model.ts';
import { shareChatEntity } from './chatEntities.ts';

export const activityAssistantFeatures = [
  { id: 'places', title: '함께 고를 장소', description: '모임에 공유한 장소로 후보 투표 만들기' },
  { id: 'conditions', title: '조건 맞추기', description: '직접 확인한 예산·걷기 조건 비교' },
  { id: 'changes', title: '바뀐 점 확인', description: '현재 시간과 변경 제안을 나란히 확인' },
  { id: 'preparation', title: '준비할 일', description: '선택한 원문에서 직접 준비 항목 등록' },
  { id: 'first', title: '처음 참여해요', description: '현재 안내와 준비 상태 한눈에 보기' },
  { id: 'plan-b', title: '다른 안 찾기', description: '기존 일정을 지키며 대안 후보 정하기' },
  { id: 'again', title: '다시 만나요', description: '지난 약속에서 새로운 약속 초안 시작' },
  { id: 'language', title: '다른 언어로', description: '원문·시간대와 함께 번역 요청 준비' },
] as const;
export type ActivityAssistantFeature = typeof activityAssistantFeatures[number]['id'];
export interface ActivityAssistantScope { groupId: string; activityId?: string }
export function getAssistantContext(state: TogetherState, userId: string, scope: ActivityAssistantScope, writable = false) {
  const group = state.groups.find(item => item.id === scope.groupId);
  if (!userId || !group || !group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) throw new Error('현재 모임원만 이 내용을 볼 수 있어요.');
  const activity = scope.activityId ? state.activities.find(item => item.id === scope.activityId && item.groupId === group.id) : undefined;
  if (scope.activityId && !activity) throw new Error('이 모임의 약속을 다시 선택해 주세요.');
  if (writable && (group.archived || activity?.status === 'CANCELLED')) throw new Error('보관·취소된 공간에는 반영할 수 없어요.');
  return { group, activity, roomId: activity ? roomIdForActivity(activity.id) : roomIdForGroup(group.id) };
}
export interface AssistantPlace { id: string; name: string; kind: Place['kind']; area: string; address: string; lat: number; lng: number }
/** Only IDs explicitly shared to this group/route, intersected with the current caller's public catalog. */
export function selectAssistantPlaces(state: TogetherState, userId: string, scope: ActivityAssistantScope, places: Place[]): AssistantPlace[] {
  const { group, activity } = getAssistantContext(state, userId, scope);
  const ids = new Set([...(group.interestPlaceIds ?? []), ...(activity?.journey?.days.flatMap(day => day.places.map(place => place.id)) ?? [])]);
  return [...new Map(places.filter(place => ids.has(place.id) && !place.personal).map(place => [place.id,
    { id: place.id, name: place.name, kind: place.kind, area: place.area, address: place.address, lat: place.lat, lng: place.lng }])).values()];
}
export const assistantSourceVersion = (body: string) => {
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++) hash = Math.imul(hash ^ body.charCodeAt(i), 16777619);
  return `${body.length}:${hash >>> 0}`;
};
export function selectAssistantMessages(state: TogetherState, userId: string, scope: ActivityAssistantScope) {
  const { roomId } = getAssistantContext(state, userId, scope);
  const counts = new Map<string, number>();
  state.messages.forEach(item => counts.set(item.id, (counts.get(item.id) ?? 0) + 1));
  return state.messages.filter(item => item.roomId === roomId && !item.deleted && item.entity === undefined && item.body.trim() && counts.get(item.id) === 1)
    .map(item => ({ id: item.id, roomId, authorId: item.authorId, body: item.body, createdAt: item.createdAt, version: assistantSourceVersion(item.body) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export interface AssistantConditions { budgetCap?: number; walkingLimit?: number }
export interface AssistantPlaceEvidence { placeId: string; costPerPerson?: number; walkingMinutes?: number }
export type AssistantCheck = 'MATCH' | 'CONFLICT' | 'UNKNOWN';
const validAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** A name, straight-line coordinate or model guess is never evidence of price or walking time. */
export function compareAssistantConditions(conditions: AssistantConditions, evidence: AssistantPlaceEvidence) {
  const check = (limit: unknown, actual: unknown): AssistantCheck => !validAmount(limit) || !validAmount(actual) ? 'UNKNOWN' : actual <= limit ? 'MATCH' : 'CONFLICT';
  return { budget: check(conditions.budgetCap, evidence.costPerPerson), walking: check(conditions.walkingLimit, evidence.walkingMinutes) };
}
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function compareAssistantTime(state: TogetherState, userId: string, scope: ActivityAssistantScope, proposedTime: string) {
  const { activity } = getAssistantContext(state, userId, scope);
  if (!activity) throw new Error('시간을 비교할 약속을 선택해 주세요.');
  if (!validTime(proposedTime)) throw new Error('변경할 시각을 입력해 주세요.');
  return { current: activity.startTime || '', proposed: proposedTime, changed: activity.startTime !== proposedTime, date: activity.date, revision: activity.revision };
}
interface ActionBase extends ActivityAssistantScope { id: string; expectedRevision?: number }
export type ActivityAssistantAction =
  | (ActionBase & { type: 'CREATE_POLL'; question: string; placeIds: string[] })
  | (ActionBase & { type: 'CREATE_TASK'; title: string; sourceMessageIds: string[]; sourceVersions: Record<string, string>; assignee: 'UNASSIGNED' | 'SELF' })
  | (ActionBase & { type: 'UPDATE_ACTIVITY_TIME'; startTime: string })
  | (ActionBase & { type: 'CREATE_ACTIVITY_DRAFT'; title: string });
const bounded = (value: string, maximum: number, label: string) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new Error(`${label}을 다시 확인해 주세요.`);
  return value.trim();
};
/** Called inside the host repository.update. Rechecks latest membership, source and revision before any write. */
export function applyActivityAssistantAction(state: TogetherState, userId: string, action: ActivityAssistantAction, places: Place[]) {
  const { group, activity } = getAssistantContext(state, userId, action, true);
  bounded(action.id, 160, '요청 ID');
  if (activity && action.expectedRevision !== activity.revision) throw new Error('약속이 바뀌었어요. 현재 내용을 확인하고 다시 반영해 주세요.');
  if (action.type !== 'CREATE_ACTIVITY_DRAFT' && activity?.status === 'COMPLETED') throw new Error('지난 약속은 새 약속으로 이어가 주세요.');
  if (action.type === 'CREATE_POLL') {
    const question = bounded(action.question, 160, '투표 제목');
    const ids = [...new Set(action.placeIds)];
    const candidates = selectAssistantPlaces(state, userId, action, places);
    if (ids.length < 2 || ids.length > 8 || ids.some(id => !candidates.some(place => place.id === id))) throw new Error('현재 공유된 장소에서 2~8곳을 선택해 주세요.');
    const labels = ids.map(id => { const place = candidates.find(place => place.id === id)!; return `${place.name} · ${place.address || place.area}`; });
    const previous = state.polls.find(item => item.id === action.id);
    if (previous) { if (previous.groupId !== group.id || previous.activityId !== action.activityId || previous.question !== question || previous.options.map(option => option.label).join('\n') !== labels.join('\n')) throw new Error('요청 ID가 다른 항목에 사용됐어요.'); shareChatEntity(state, userId, { type: 'POLL', id: previous.id }); return previous.id; }
    const existing = state.polls.find(item => item.groupId === group.id && item.activityId === action.activityId && !item.closed && item.question === question && item.options.map(option => option.label).join('\n') === labels.join('\n'));
    if (existing) { shareChatEntity(state, userId, { type: 'POLL', id: existing.id }); return existing.id; }
    state.polls.push({ id: action.id, groupId: group.id, activityId: action.activityId, question,
      options: labels.map((label, index) => ({ id: `${action.id}-option-${index}`, label, voterIds: [] })), closed: false });
    shareChatEntity(state, userId, { type: 'POLL', id: action.id });
  } else if (action.type === 'CREATE_TASK') {
    const title = bounded(action.title, 200, '준비할 일');
    if (!['UNASSIGNED', 'SELF'].includes(action.assignee)) throw new Error('다른 사람의 수락 없이 담당자를 지정할 수 없어요.');
    const ids = [...new Set(action.sourceMessageIds)];
    const sources = selectAssistantMessages(state, userId, action);
    if (ids.length > 12 || ids.some(id => !sources.some(item => item.id === id && item.version === action.sourceVersions[id]))) throw new Error('원문이 바뀌었거나 접근할 수 없어요. 다시 선택해 주세요.');
    const previous = state.tasks.find(item => item.id === action.id);
    const assigneeId = action.assignee === 'SELF' ? userId : undefined;
    const matches = (item: TogetherState['tasks'][number]) => item.groupId === group.id && item.activityId === action.activityId && item.title === title && item.assigneeId === assigneeId && [...(item.sourceMessageIds ?? [])].sort().join('\n') === [...ids].sort().join('\n');
    if (previous) { if (!matches(previous)) throw new Error('요청 ID가 다른 항목에 사용됐어요.'); shareChatEntity(state, userId, { type: 'TASK', id: previous.id }); return previous.id; }
    const existing = state.tasks.find(item => !item.completed && matches(item));
    if (existing) { shareChatEntity(state, userId, { type: 'TASK', id: existing.id }); return existing.id; }
    state.tasks.push({ id: action.id, groupId: group.id, activityId: action.activityId, title, assigneeId: action.assignee === 'SELF' ? userId : undefined, completed: false, sourceMessageIds: ids });
    shareChatEntity(state, userId, { type: 'TASK', id: action.id });
  } else if (action.type === 'UPDATE_ACTIVITY_TIME') {
    if (!activity || !canEditActivity(state, userId, activity) || activity.status !== 'PLANNED') throw new Error('약속을 편집할 권한이 없어요.');
    if (!validTime(action.startTime)) throw new Error('유효한 시각을 입력해 주세요.');
    if (activity.journey?.days.some(day => day.places.some(place => place.bookingFixed))) throw new Error('고정 예약이 있어요. 기존 일정 편집에서 예약을 확인한 뒤 변경해 주세요.');
    if (activity.startTime !== action.startTime) { activity.startTime = action.startTime; activity.revision++; unpublishActivityFromGroup(state, activity.id); shareChatEntity(state, userId, { type: 'ACTIVITY', id: activity.id }, { roomId: roomIdForActivity(activity.id), eventId: `time:${action.id}`, body: '약속 시각을 변경했어요.' }); }
  } else if (action.type === 'CREATE_ACTIVITY_DRAFT') {
    const title = bounded(action.title, 100, '새 약속 이름');
    if (state.groups.some(item => item.id === action.id)) throw new Error('요청 ID가 다른 공간에 사용됐어요.');
    // An invite to one private appointment must never grant access to a later appointment.
    const targetGroupId = group.spaceType === 'ACTIVITY' ? `assistant-space-${action.id}` : group.id;
    const previous = state.activities.find(item => item.id === action.id);
    if (previous) {
      const target = state.groups.find(item => item.id === previous.groupId);
      if (previous.groupId !== targetGroupId || previous.title !== title || !target?.memberIds.includes(userId) || target.blockedMemberIds?.includes(userId)
        || (group.spaceType === 'ACTIVITY' && (target.spaceType !== 'ACTIVITY' || target.visibility !== 'PRIVATE' || target.ownerId !== userId))) throw new Error('요청 ID가 다른 항목에 사용됐어요.');
      shareChatEntity(state, userId, { type: 'ACTIVITY', id: previous.id });
      return previous.id;
    }
    if (group.spaceType === 'ACTIVITY') {
      if (state.groups.some(item => item.id === targetGroupId) || state.activities.some(item => item.id === targetGroupId)) throw new Error('요청 ID가 다른 공간에 사용됐어요.');
      state.groups.push({ id: targetGroupId, name: title, kind: group.kind, spaceType: 'ACTIVITY', region: '', introduction: '', cover: '',
        visibility: 'PRIVATE', ownerId: userId, memberIds: [userId], managerIds: [], archived: false, promotionPublished: false, sourceKind: 'LOCAL', interestPlaceIds: [] });
    }
    state.activities.push({ id: action.id, groupId: targetGroupId, title, kind: 'MEETUP', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED',
      leadId: userId, editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
    shareChatEntity(state, userId, { type: 'ACTIVITY', id: action.id });
  } else throw new Error('지원하지 않는 반영 요청이에요.');
  return action.id;
}

/** Future server wire contract. IDs/versions only, no account-wide chat or personal-place export. */
export interface ActivityAssistantRequestV1 extends ActivityAssistantScope {
  requestId: string; feature: ActivityAssistantFeature; activityRevision?: number;
  roomId: string; sourceMessageIds: string[]; sourceVersions: Record<string, string>; placeIds: string[];
  locale: string; timeZone: string; instruction: string;
}
export interface ActivityAssistantResponseV1 { requestId: string; status: 'UNCONNECTED' | 'READY' | 'INSUFFICIENT_DATA'; explanation: string; sourceMessageIds: string[] }
export function prepareAssistantRequest(state: TogetherState, userId: string, request: ActivityAssistantRequestV1, places: Place[]): ActivityAssistantRequestV1 {
  const context = getAssistantContext(state, userId, request);
  if (!activityAssistantFeatures.some(item => item.id === request.feature) || request.roomId !== context.roomId || request.activityRevision !== context.activity?.revision) throw new Error('요청의 공간과 버전을 확인해 주세요.');
  const messages = selectAssistantMessages(state, userId, request), shared = selectAssistantPlaces(state, userId, request, places);
  const sourceMessageIds = [...new Set(request.sourceMessageIds)], placeIds = [...new Set(request.placeIds)];
  if (sourceMessageIds.length > 12 || sourceMessageIds.some(id => !messages.some(message => message.id === id && request.sourceVersions[id] === message.version))) throw new Error('요청 원문을 다시 선택해 주세요.');
  if (placeIds.length > 8 || placeIds.some(id => !shared.some(place => place.id === id))) throw new Error('공유 장소를 다시 선택해 주세요.');
  if (typeof request.instruction !== 'string' || request.instruction.length > 1000) throw new Error('요청은 1000자 이내로 작성해 주세요.');
  return { requestId: bounded(request.requestId, 160, '요청 ID'), groupId: context.group.id, activityId: context.activity?.id, activityRevision: context.activity?.revision,
    feature: request.feature, roomId: context.roomId, sourceMessageIds, sourceVersions: Object.fromEntries(sourceMessageIds.map(id => [id, request.sourceVersions[id]])),
    placeIds, locale: bounded(request.locale, 40, '언어'), timeZone: bounded(request.timeZone, 80, '시간대'), instruction: request.instruction.trim() };
}
export function unconnectedAssistantResponse(request: ActivityAssistantRequestV1): ActivityAssistantResponseV1 {
  return { requestId: request.requestId, status: 'UNCONNECTED', explanation: 'AI 서비스 연결 후 선택한 원문과 조건으로 제안을 받을 수 있어요. 지금은 직접 비교·입력한 내용만 반영할 수 있어요.', sourceMessageIds: [] };
}
