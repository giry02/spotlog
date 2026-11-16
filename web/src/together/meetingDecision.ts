import type { Place } from '../data';
import { distanceBetween, setPlanDates } from '../tripPlan.ts';
import { validCalendarDay } from './calendarPlans.ts';
import { koreaDay } from './discovery.ts';
import { canEditActivity, togetherId, unpublishActivityFromGroup, type TogetherState } from './model.ts';
import { assertCurrentActivityEditor } from './activityLifecycle.ts';
import type { DecisionApplicationPreview, DecisionCandidateComparison, DecisionCandidateInput, DecisionComparison, DecisionCreateInput, DecisionDateOption, DecisionResponse, DecisionResponseInput, DecisionScope, DecisionSelection, TogetherDecision } from './decisionTypes';
export type { DecisionApplicationPreview, DecisionCandidateComparison, DecisionCandidateInput, DecisionComparison, DecisionCreateInput, DecisionDateOption, DecisionResponse, DecisionResponseInput, DecisionScope, DecisionSelection, TogetherDecision } from './decisionTypes';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const id = (value: unknown): value is string => typeof value === 'string' && Boolean(value) && value === value.trim() && value.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
const money = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000_000;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;
const ids = (value: unknown, max = 1000): value is string[] => Array.isArray(value) && value.length <= max && value.every(id) && new Set(value).size === value.length;
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && validCalendarDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const keys = (row: Record<string, unknown>, allowed: string[]) => Object.keys(row).every(key => allowed.includes(key));
const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const candidate = (row: unknown): row is DecisionCandidateInput => object(row) && keys(row, ['placeId', 'referenceCostKrw']) && id(row.placeId) && (row.referenceCostKrw === undefined || money(row.referenceCostKrw));
const dateOption = (row: unknown): row is DecisionDateOption => object(row) && keys(row, ['id', 'date', 'time']) && id(row.id) && validCalendarDay(row.date) && (row.time === undefined || validTime(row.time));
const responseKeys = ['userId', 'availablePlaceIds', 'preferredPlaceId', 'availableDateIds', 'budgetMaxKrw', 'originPlaceId', 'revision', 'updatedAt'];
const validResponse = (row: unknown): row is DecisionResponse => object(row) && keys(row, responseKeys) && id(row.userId) && ids(row.availablePlaceIds, 8) && ids(row.availableDateIds, 8)
  && (row.preferredPlaceId === undefined || id(row.preferredPlaceId) && row.availablePlaceIds.includes(row.preferredPlaceId))
  && (row.budgetMaxKrw === undefined || money(row.budgetMaxKrw)) && (row.originPlaceId === undefined || id(row.originPlaceId)) && integer(row.revision) && timestamp(row.updatedAt);
export function isTogetherDecision(value: unknown): value is TogetherDecision {
  if (!object(value) || !keys(value, ['id', 'groupId', 'activityId', 'title', 'creatorId', 'candidates', 'dateOptions', 'expectedMemberIds', 'responses', 'revision', 'status', 'createdAt', 'updatedAt', 'applied'])
    || !['id', 'groupId', 'activityId', 'creatorId'].every(key => id(value[key])) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100
    || !Array.isArray(value.candidates) || value.candidates.length < 2 || value.candidates.length > 8 || !value.candidates.every(candidate) || new Set(value.candidates.map(row => row.placeId)).size !== value.candidates.length
    || !Array.isArray(value.dateOptions) || value.dateOptions.length > 8 || !value.dateOptions.every(dateOption) || new Set(value.dateOptions.map(row => row.id)).size !== value.dateOptions.length || new Set(value.dateOptions.map(row => `${row.date}|${row.time || ''}`)).size !== value.dateOptions.length
    || !ids(value.expectedMemberIds) || !value.expectedMemberIds.length || !Array.isArray(value.responses) || value.responses.length > 1000 || !value.responses.every(validResponse)
    || new Set(value.responses.map(row => row.userId)).size !== value.responses.length || !integer(value.revision) || !['OPEN', 'APPLIED', 'CANCELLED'].includes(String(value.status)) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) return false;
  const placeIds = value.candidates.map(row => row.placeId), dateIds = value.dateOptions.map(row => row.id), expectedMemberIds = value.expectedMemberIds;
  if (!value.responses.every(row => expectedMemberIds.includes(row.userId) && row.availablePlaceIds.every(placeId => placeIds.includes(placeId)) && row.availableDateIds.every(dateId => dateIds.includes(dateId)))) return false;
  if (value.status !== 'APPLIED') return value.applied === undefined;
  const applied = value.applied;
  return object(applied) && keys(applied, ['placeId', 'dateOptionId', 'actorId', 'appliedAt', 'acknowledgedMissingMemberIds']) && placeIds.includes(String(applied.placeId)) && id(applied.actorId) && timestamp(applied.appliedAt)
    && (dateIds.length ? dateIds.includes(String(applied.dateOptionId)) : applied.dateOptionId === undefined) && ids(applied.acknowledgedMissingMemberIds)
    && applied.acknowledgedMissingMemberIds.every(memberId => expectedMemberIds.includes(memberId));
}
export function isMeetingDecisionStateFields(value: unknown): boolean {
  if (!object(value) || value.decisions === undefined) return object(value);
  if (!Array.isArray(value.decisions) || value.decisions.length > 1000 || !value.decisions.every(isTogetherDecision)) return false;
  const rows = value.decisions as TogetherDecision[];
  return new Set(rows.map(row => row.id)).size === rows.length
    && Array.isArray(value.activities) && rows.every(row => (value.activities as unknown[]).some(activity => object(activity) && activity.id === row.activityId && activity.groupId === row.groupId))
    && new Set(rows.filter(row => row.status === 'OPEN').map(row => JSON.stringify([row.groupId, row.activityId]))).size === rows.filter(row => row.status === 'OPEN').length;
}
const sameScope = (row: DecisionScope, scope: DecisionScope) => row.groupId === scope.groupId && row.activityId === scope.activityId;
function context(state: TogetherState, actorId: string, scope: DecisionScope, at: Date) {
  if (!Number.isFinite(at.getTime()) || !id(scope.groupId) || !id(scope.activityId)) throw new Error('이 약속에서 다시 확인해 주세요.');
  const group = state.groups.find(row => row.id === scope.groupId), activity = state.activities.find(row => row.id === scope.activityId && row.groupId === scope.groupId);
  if (!id(actorId) || !state.members.some(row => row.id === actorId) || !group || !activity || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId) || group.temporaryRoom?.disposition === 'TRASH') throw new Error('현재 모임원만 이 약속의 결정을 볼 수 있어요.');
  const expected = group.memberIds.filter(memberId => state.members.some(row => row.id === memberId) && !group.blockedMemberIds?.includes(memberId));
  const writable = !group.archived && activity.status === 'PLANNED' && (!validCalendarDay(activity.endDate || activity.date) || (activity.endDate || activity.date) >= koreaDay(at))
    && !group.temporaryRoom?.closedAt && (!group.temporaryRoom?.expiresAt || Date.parse(group.temporaryRoom.expiresAt) > at.getTime());
  return { group, activity, expectedMemberIds: [...new Set(expected)], writable, canManage: writable && canEditActivity(state, actorId, activity) };
}
const publicCatalog = (places: Place[]) => new Map(places.filter(place => !place.personal && id(place.id) && place.name.trim()).map(place => [place.id, place]));
function currentDecision(state: TogetherState, scope: DecisionScope, decisionId: string): TogetherDecision {
  const found = state.decisions?.find(row => row.id === decisionId && sameScope(row, scope));
  if (!found || !isTogetherDecision(found)) throw new Error('이 약속의 결정 내용을 다시 확인해 주세요.');
  return found;
}
const sameMembers = (left: string[], right: string[]) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
function assertOpenWritable(state: TogetherState, actorId: string, scope: DecisionScope, decisionId: string, at: Date) {
  const access = context(state, actorId, scope, at), decision = currentDecision(state, scope, decisionId);
  if (!access.writable || decision.status !== 'OPEN') throw new Error('종료·보관·취소된 공간의 결정은 읽기만 할 수 있어요.');
  return { ...access, decision };
}
export function createMeetingDecision(state: TogetherState, actorId: string, scope: DecisionScope, input: DecisionCreateInput, places: Place[], at = new Date()): string {
  const access = context(state, actorId, scope, at);
  if (!access.canManage) throw new Error('현재 일정 편집자만 함께 정하기를 시작할 수 있어요.');
  assertCurrentActivityEditor(state, actorId, scope.groupId, scope.activityId, input.expectedActivityRevision);
  if (!object(input) || !keys(input, ['title', 'candidates', 'dateOptions', 'expectedActivityRevision', 'replaceDecisionId', 'expectedDecisionRevision']) || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 100
    || !Array.isArray(input.candidates) || input.candidates.length < 2 || input.candidates.length > 8 || !input.candidates.every(candidate) || new Set(input.candidates.map(row => row.placeId)).size !== input.candidates.length
    || !Array.isArray(input.dateOptions) || input.dateOptions.length > 8 || !input.dateOptions.every(dateOption) || new Set(input.dateOptions.map(row => row.id)).size !== input.dateOptions.length || new Set(input.dateOptions.map(row => `${row.date}|${row.time || ''}`)).size !== input.dateOptions.length
    || input.dateOptions.some(row => row.date < koreaDay(at))) throw new Error('후보 2~8곳과 오늘 이후의 날짜 후보를 확인해 주세요.');
  const catalog = publicCatalog(places);
  if (input.candidates.some(row => !catalog.has(row.placeId))) throw new Error('현재 공개된 장소 후보를 다시 선택해 주세요.');
  const previous = state.decisions?.find(row => sameScope(row, scope) && row.status === 'OPEN');
  if (previous ? input.replaceDecisionId !== previous.id || input.expectedDecisionRevision !== previous.revision : input.replaceDecisionId !== undefined || input.expectedDecisionRevision !== undefined) throw new Error('진행 중인 결정과 응답을 확인하고 명시적으로 다시 시작해 주세요.');
  const id = togetherId('meeting-decision'), stamp = at.toISOString();
  const decision: TogetherDecision = { id, groupId: scope.groupId, activityId: scope.activityId, title: input.title.trim(), creatorId: actorId, candidates: structuredClone(input.candidates), dateOptions: structuredClone(input.dateOptions), expectedMemberIds: access.expectedMemberIds,
    responses: [], revision: 1, status: 'OPEN', createdAt: stamp, updatedAt: stamp };
  if (previous) { previous.status = 'CANCELLED'; previous.revision++; previous.updatedAt = stamp; }
  state.decisions ??= []; state.decisions.push(decision);
  return id;
}
export function submitDecisionResponse(state: TogetherState, actorId: string, scope: DecisionScope, decisionId: string, input: DecisionResponseInput, places: Place[], at = new Date()): void {
  const { decision, expectedMemberIds } = assertOpenWritable(state, actorId, scope, decisionId, at);
  const firstNewMemberResponse = !decision.expectedMemberIds.includes(actorId) && !decision.responses.some(row => row.userId === actorId);
  if (!object(input) || !keys(input, ['availablePlaceIds', 'preferredPlaceId', 'availableDateIds', 'budgetMaxKrw', 'originPlaceId', 'expectedRevision']) || input.expectedRevision !== decision.revision && !(firstNewMemberResponse && input.expectedRevision === 0)) throw new Error('결정·응답이 바뀌었어요. 최신 내용을 확인하고 다시 제출해 주세요.');
  const placeIds = decision.candidates.map(row => row.placeId), dateIds = decision.dateOptions.map(row => row.id), catalog = publicCatalog(places);
  if (!ids(input.availablePlaceIds, 8) || input.availablePlaceIds.some(placeId => !placeIds.includes(placeId)) || !ids(input.availableDateIds, 8) || input.availableDateIds.some(dateId => !dateIds.includes(dateId))
    || input.preferredPlaceId !== undefined && (!id(input.preferredPlaceId) || !input.availablePlaceIds.includes(input.preferredPlaceId)) || input.budgetMaxKrw !== undefined && !money(input.budgetMaxKrw)
    || input.originPlaceId !== undefined && (!id(input.originPlaceId) || !catalog.has(input.originPlaceId)) || placeIds.some(placeId => !catalog.has(placeId))) throw new Error('가능한 장소·날짜와 선택한 참고 조건을 다시 확인해 주세요.');
  const previous = decision.responses.find(row => row.userId === actorId), stamp = at.toISOString();
  const response: DecisionResponse = { userId: actorId, availablePlaceIds: [...input.availablePlaceIds], availableDateIds: [...input.availableDateIds], ...(input.preferredPlaceId ? { preferredPlaceId: input.preferredPlaceId } : {}), ...(input.budgetMaxKrw !== undefined ? { budgetMaxKrw: input.budgetMaxKrw } : {}), ...(input.originPlaceId ? { originPlaceId: input.originPlaceId } : {}), revision: (previous?.revision ?? 0) + 1, updatedAt: stamp };
  decision.responses = decision.responses.filter(row => expectedMemberIds.includes(row.userId));
  if (previous) decision.responses[decision.responses.indexOf(previous)] = response; else decision.responses.push(response);
  decision.expectedMemberIds = expectedMemberIds;
  decision.revision++; decision.updatedAt = stamp;
}
export function compareMeetingDecision(state: TogetherState, actorId: string, scope: DecisionScope, decisionId: string, places: Place[], at = new Date()): DecisionComparison {
  const access = context(state, actorId, scope, at), decision = currentDecision(state, scope, decisionId), catalog = publicCatalog(places);
  const responses = decision.responses.filter(row => access.expectedMemberIds.includes(row.userId)), budgets = responses.flatMap(row => row.budgetMaxKrw === undefined ? [] : [row.budgetMaxKrw]);
  const rows = decision.candidates.map((row): DecisionCandidateComparison => {
    const place = catalog.get(row.placeId), distances = responses.flatMap(response => { const origin = response.originPlaceId ? catalog.get(response.originPlaceId) : undefined; const km = origin && place ? distanceBetween(origin, place) : null; return km === null ? [] : [km]; });
    const availableCount = responses.filter(response => response.availablePlaceIds.includes(row.placeId)).length, knownCosts = row.referenceCostKrw !== undefined;
    return { ...row, availableCount, blockedCount: responses.length - availableCount, preferredCount: responses.filter(response => response.preferredPlaceId === row.placeId).length, allAvailable: responses.length > 0 && availableCount === responses.length, sourceAvailable: Boolean(place),
      withinBudgetCount: knownCosts ? budgets.filter(budget => budget >= row.referenceCostKrw!).length : 0, overBudgetCount: knownCosts ? budgets.filter(budget => budget < row.referenceCostKrw!).length : 0, unknownBudgetCount: knownCosts ? responses.length - budgets.length : responses.length,
      distance: { knownOriginCount: distances.length, unknownOriginCount: responses.length - distances.length, ...(distances.length ? { minKm: Math.min(...distances), maxKm: Math.max(...distances), meanKm: distances.reduce((sum, km) => sum + km, 0) / distances.length, spreadKm: distances.length >= 2 ? Math.max(...distances) - Math.min(...distances) : undefined } : {}) } };
  });
  const sourceIds = [...new Set([...decision.candidates.map(row => row.placeId), ...responses.flatMap(row => row.originPlaceId ? [row.originPlaceId] : [])])].sort();
  const sources = sourceIds.map(placeId => { const place = catalog.get(placeId); return place ? [placeId, place.kind, place.name, place.area, place.address, place.lat, place.lng, place.locationVerified] : [placeId, null]; });
  return { key: JSON.stringify([decision, access.activity, [...access.expectedMemberIds].sort(), sources]), responseCount: responses.length, expectedMemberCount: access.expectedMemberIds.length, missingMemberIds: access.expectedMemberIds.filter(memberId => !responses.some(row => row.userId === memberId)), membershipChanged: !sameMembers(decision.expectedMemberIds, access.expectedMemberIds), rows,
    dates: decision.dateOptions.map(row => { const availableCount = responses.filter(response => response.availableDateIds.includes(row.id)).length; return { ...row, availableCount, blockedCount: responses.length - availableCount, allAvailable: responses.length > 0 && availableCount === responses.length }; }),
    budgetKnownCount: budgets.length, ...(budgets.length ? { budgetMinKrw: Math.min(...budgets), budgetMaxKrw: Math.max(...budgets) } : {}) };
}
export function selectMeetingDecision(state: TogetherState, actorId: string, scope: DecisionScope, places: Place[], decisionId?: string, at = new Date()) {
  const access = context(state, actorId, scope, at);
  const selected = decisionId ? currentDecision(state, scope, decisionId) : state.decisions?.find(row => sameScope(row, scope) && row.status === 'OPEN') ?? state.decisions?.filter(row => sameScope(row, scope)).at(-1);
  const decision = selected ? structuredClone(selected) : undefined;
  const comparison = decision ? compareMeetingDecision(state, actorId, scope, decision.id, places, at) : undefined;
  return { decision, comparison, canManage: access.canManage, writable: access.writable, canRespond: Boolean(access.writable && decision?.status === 'OPEN'), ownResponse: decision?.responses.find(row => row.userId === actorId) };
}
const moveDay = (day: string, offset: number) => { const next = new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10); if (!validCalendarDay(next)) throw new Error('기존 여행 날짜를 먼저 확인해 주세요.'); return next; };
function proposedValues(activity: TogetherState['activities'][number], place: Place, option?: DecisionDateOption) {
  const before = { date: activity.date, endDate: activity.endDate, startTime: activity.startTime || '', venuePlaceId: activity.venuePlaceId, meetingPoint: activity.meetingPoint }, after = { ...before, venuePlaceId: place.id, meetingPoint: [place.name, place.address || place.area].filter(Boolean).join(' · ') };
  if (option) {
    if (activity.date && !validCalendarDay(activity.date) || activity.endDate && (!validCalendarDay(activity.endDate) || !activity.date || activity.endDate < activity.date)) throw new Error('기존 일정의 날짜를 먼저 확인해 주세요.');
    if (activity.journey?.days.some(day => day.places.some(stop => stop.bookingFixed)) && (activity.date !== option.date || activity.journey.days.some((day, index) => day.date !== moveDay(option.date, index)))) throw new Error('예약 고정 방문이 있어 날짜를 바꿀 수 없어요. 예약 상태를 먼저 확인해 주세요.');
    after.date = option.date; after.startTime = option.time || '';
    if (activity.journey) { if (!activity.journey.days.length || activity.journey.days.length > 366) throw new Error('여행 DAY 구성을 먼저 확인해 주세요.'); after.endDate = moveDay(option.date, activity.journey.days.length - 1); }
    else after.endDate = activity.date && activity.endDate ? moveDay(option.date, Math.round((Date.parse(`${activity.endDate}T00:00:00Z`) - Date.parse(`${activity.date}T00:00:00Z`)) / 86400000)) : option.date;
  }
  return { before, after };
}
const dateLabel = (value: { date: string; endDate: string; startTime: string }) => `${value.date || '날짜 미정'}${value.endDate && value.endDate !== value.date ? ` ~ ${value.endDate}` : ''} · ${value.startTime || '시각 미정'} (한국 시각)`;
export function previewMeetingDecisionApplication(state: TogetherState, actorId: string, scope: DecisionScope, decisionId: string, selection: DecisionSelection, places: Place[], at = new Date()): DecisionApplicationPreview {
  const { decision, activity, canManage } = assertOpenWritable(state, actorId, scope, decisionId, at);
  if (!canManage) throw new Error('현재 일정 편집자만 변경안을 확인하고 반영할 수 있어요.');
  if (!object(selection) || !keys(selection, ['placeId', 'dateOptionId', 'acknowledgeMissing']) || !id(selection.placeId) || typeof selection.acknowledgeMissing !== 'boolean') throw new Error('반영할 후보를 다시 선택해 주세요.');
  const comparison = compareMeetingDecision(state, actorId, scope, decisionId, places, at), row = comparison.rows.find(item => item.placeId === selection.placeId), catalog = publicCatalog(places), place = catalog.get(selection.placeId);
  if (!comparison.responseCount || !row?.allAvailable || !row.sourceAvailable || !place) throw new Error('응답한 멤버 모두가 가능한 현재 장소만 선택할 수 있어요.');
  if (comparison.missingMemberIds.length && !selection.acknowledgeMissing) throw new Error('아직 응답하지 않은 멤버가 있어요. 미응답을 확인한 뒤 다시 선택해 주세요.');
  if (decision.candidates.some(candidate => !catalog.has(candidate.placeId))) throw new Error('장소 후보가 변경됐어요. 현재 후보로 결정을 다시 시작해 주세요.');
  const option = decision.dateOptions.find(item => item.id === selection.dateOptionId);
  if (decision.dateOptions.length ? !option || !comparison.dates.find(item => item.id === option.id)?.allAvailable || option.date < koreaDay(at) : selection.dateOptionId !== undefined) throw new Error('응답한 멤버 모두가 가능한 오늘 이후의 날짜를 선택해 주세요.');
  const values = proposedValues(activity, place, option);
  if (JSON.stringify(values.before) === JSON.stringify(values.after)) throw new Error('이 내용은 이미 현재 일정에 반영되어 있어요.');
  const notes = ['만나는 장소와 선택한 날짜만 반영해요. 참석 선택·예약·방문 장소와 순서는 자동으로 바꾸지 않아요.', '참고 비용과 직선거리는 공식 가격·실제 도로 이동 시간·예약 가능 여부가 아니에요.'];
  if (comparison.missingMemberIds.length) notes.push(`${comparison.missingMemberIds.length}명은 아직 응답하지 않았어요. 미응답을 가능으로 집계하지 않았어요.`);
  if (row.overBudgetCount) notes.push(`입력된 참고 비용이 ${row.overBudgetCount}명의 참고 예산보다 높아요. 실제 금액과 조건은 별도로 확인해 주세요.`);
  if (option && activity.journey) notes.push('여행 기간·방문 순서를 유지하며 DAY 날짜를 함께 옮겨요.');
  return { groupId: scope.groupId, activityId: scope.activityId, decisionId, actorId, key: comparison.key, selection: structuredClone(selection), before: { venueLabel: values.before.meetingPoint || '만날 곳 미정', dateLabel: dateLabel(values.before) }, after: { venueLabel: values.after.meetingPoint, dateLabel: dateLabel(values.after) }, notes };
}
/** Run within repository.update; only freshly re-derived canonical values may be applied. */
export function applyMeetingDecision(state: TogetherState, actorId: string, reviewed: DecisionApplicationPreview, places: Place[], at = new Date()) {
  if (!reviewed || reviewed.actorId !== actorId) throw new Error('현재 계정으로 변경안을 다시 확인해 주세요.');
  const fresh = previewMeetingDecisionApplication(state, actorId, reviewed, reviewed.decisionId, reviewed.selection, places, at);
  if (JSON.stringify(fresh) !== JSON.stringify(reviewed)) throw new Error('후보·응답·일정이 바뀌었어요. 최신 변경안을 다시 확인해 주세요.');
  const decision = currentDecision(state, fresh, fresh.decisionId), activity = state.activities.find(row => row.id === fresh.activityId && row.groupId === fresh.groupId)!;
  assertCurrentActivityEditor(state, actorId, fresh.groupId, fresh.activityId, activity.revision);
  const place = publicCatalog(places).get(fresh.selection.placeId)!, option = decision.dateOptions.find(row => row.id === fresh.selection.dateOptionId), values = proposedValues(activity, place, option);
  const journey = option && activity.journey ? setPlanDates(activity.journey, option.date) : undefined;
  activity.venuePlaceId = values.after.venuePlaceId; activity.meetingPoint = values.after.meetingPoint;
  if (option) { activity.date = values.after.date; activity.endDate = values.after.endDate; activity.startTime = values.after.startTime || undefined; if (journey) activity.journey = journey; }
  activity.revision++; unpublishActivityFromGroup(state, activity.id);
  const comparison = compareMeetingDecision(state, actorId, fresh, decision.id, places, at);
  const currentMembers = context(state, actorId, fresh, at).expectedMemberIds;
  decision.expectedMemberIds = currentMembers; decision.responses = decision.responses.filter(row => currentMembers.includes(row.userId));
  decision.status = 'APPLIED'; decision.revision++; decision.updatedAt = at.toISOString(); decision.applied = { placeId: place.id, ...(option ? { dateOptionId: option.id } : {}), actorId, appliedAt: at.toISOString(), acknowledgedMissingMemberIds: comparison.missingMemberIds };
  return activity;
}
