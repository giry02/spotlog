import type { Place } from '../data';
import { togetherId, type TogetherState } from './model.ts';
import { isTogetherPhotoAttachments } from './contentMedia.ts';
import { koreaDay } from './discovery.ts';
import type { BusinessPurpose, PlaceAssessmentScope, PlaceExperienceTag, PlaceFeedbackInput, PlaceMenuInput, TogetherPlaceFeedback, TogetherPlaceMenu } from './businessAssessmentTypes';
export type { BusinessPurpose, PlaceAssessmentScope, PlaceExperienceTag, PlaceFeedbackInput, PlaceMenuInput, TogetherPlaceFeedback, TogetherPlaceMenu } from './businessAssessmentTypes';

export const businessPurposes: ReadonlyArray<{ id: BusinessPurpose; label: string }> = [
  { id: 'TEAM_DINNER', label: '회식' }, { id: 'CLIENT_MEETING', label: '손님 접대·미팅' }, { id: 'FAMILY', label: '가족' },
  { id: 'FRIENDS', label: '친구' }, { id: 'DATE', label: '데이트' }, { id: 'SOLO', label: '혼자' }, { id: 'GROUP_TRIP', label: '단체 여행' },
];
export const placeExperienceTags: ReadonlyArray<{ id: PlaceExperienceTag; label: string; filterLabel: string }> = [
  { id: 'QUIET', label: '대화하기 조용했어요', filterLabel: '조용한 곳' },
  { id: 'PARKING', label: '주차하기 편했어요', filterLabel: '주차가 편한 곳' },
  { id: 'CHILD_FRIENDLY', label: '아이와 가기 좋았어요', filterLabel: '아이와 가기 좋은 곳' },
  { id: 'LOW_WALK', label: '많이 걷지 않았어요', filterLabel: '이동 부담이 적은 곳' },
  { id: 'RETURN_VISIT', label: '다시 가고 싶어요', filterLabel: '다시 가고 싶은 곳' },
  { id: 'GROUP_FRIENDLY', label: '여럿이 이용하기 좋았어요', filterLabel: '여럿이 가기 좋은 곳' },
];
export function isPlaceExperienceTags(value: unknown): value is PlaceExperienceTag[] | undefined {
  return value === undefined || Array.isArray(value) && value.length <= placeExperienceTags.length && new Set(value).size === value.length && value.every(tag => placeExperienceTags.some(item => item.id === tag));
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const id = (value: unknown): value is string => typeof value === 'string' && Boolean(value) && value === value.trim() && value.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && date(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const purposes = (value: unknown): value is BusinessPurpose[] => Array.isArray(value) && value.length <= businessPurposes.length && new Set(value).size === value.length && value.every(item => businessPurposes.some(purpose => purpose.id === item));
const sourceUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim() || /[\u0000-\u001f\u007f\\]/u.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
};
const baseRecord = (row: Record<string, unknown>) => ['id', 'groupId', 'placeId', 'authorId'].every(key => id(row[key]))
  && (row.activityId === undefined || id(row.activityId)) && Number.isInteger(row.revision) && Number(row.revision) >= 1
  && timestamp(row.createdAt) && timestamp(row.updatedAt) && (row.withdrawnAt === undefined || timestamp(row.withdrawnAt)) && isTogetherPhotoAttachments(row.photos);
const feedbackKeys = ['id', 'groupId', 'activityId', 'placeId', 'authorId', 'rating', 'note', 'recommended', 'purposes', 'photos', 'revision', 'createdAt', 'updatedAt', 'withdrawnAt', 'experienceTags'];
const menuKeys = ['id', 'groupId', 'activityId', 'placeId', 'authorId', 'name', 'priceText', 'note', 'sourceUrl', 'checkedOn', 'photos', 'revision', 'createdAt', 'updatedAt', 'withdrawnAt'];
export function isTogetherPlaceFeedback(value: unknown): value is TogetherPlaceFeedback {
  return object(value) && Object.keys(value).every(key => feedbackKeys.includes(key)) && baseRecord(value)
    && typeof value.rating === 'number' && Number.isInteger(value.rating) && value.rating >= 1 && value.rating <= 5
    && text(value.note, 2000) && typeof value.recommended === 'boolean' && purposes(value.purposes) && isPlaceExperienceTags(value.experienceTags);
}
export function isTogetherPlaceMenu(value: unknown): value is TogetherPlaceMenu {
  return object(value) && Object.keys(value).every(key => menuKeys.includes(key)) && baseRecord(value)
    && text(value.name, 100) && Boolean(value.name.trim()) && text(value.priceText, 80) && text(value.note, 600)
    && (value.sourceUrl === undefined || sourceUrl(value.sourceUrl)) && (value.checkedOn === undefined || date(value.checkedOn));
}
const scopeKey = (scope: PlaceAssessmentScope) => JSON.stringify([scope.groupId, scope.activityId ?? null, scope.placeId]);
const sameScope = (row: PlaceAssessmentScope, scope: PlaceAssessmentScope) => scopeKey(row) === scopeKey(scope);
/** Optional schema-v1 fields; duplicate records cannot inflate the room's recommendation counts. */
export function isPlaceAssessmentStateFields(value: unknown): boolean {
  if (!object(value)) return false;
  const feedback = value.placeFeedback, menus = value.placeMenus;
  if (feedback !== undefined && (!Array.isArray(feedback) || feedback.length > 10000 || !feedback.every(isTogetherPlaceFeedback))) return false;
  if (menus !== undefined && (!Array.isArray(menus) || menus.length > 10000 || !menus.every(isTogetherPlaceMenu))) return false;
  const reviews = (feedback ?? []) as TogetherPlaceFeedback[], rows = (menus ?? []) as TogetherPlaceMenu[];
  return new Set(reviews.map(row => row.id)).size === reviews.length
    && new Set(reviews.map(row => JSON.stringify([scopeKey(row), row.authorId]))).size === reviews.length
    && new Set(rows.map(row => row.id)).size === rows.length;
}
function context(state: TogetherState, actorId: string, scope: PlaceAssessmentScope) {
  if (!id(scope.groupId) || !id(scope.placeId) || scope.activityId !== undefined && !id(scope.activityId)) throw new Error('업체를 확인할 공간을 다시 선택해 주세요.');
  const group = state.groups.find(row => row.id === scope.groupId), activity = scope.activityId ? state.activities.find(row => row.id === scope.activityId && row.groupId === scope.groupId) : undefined;
  if (!actorId || !state.members.some(row => row.id === actorId) || !group || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId) || group.temporaryRoom?.disposition === 'TRASH' || scope.activityId && !activity) throw new Error('현재 모임원만 이 공간의 업체 정보를 볼 수 있어요.');
  return { group, activity };
}
function availablePlace(state: TogetherState, scope: PlaceAssessmentScope, places: Place[]): boolean {
  return places.some(place => place.id === scope.placeId && !place.personal && Boolean(place.name.trim()))
    || Boolean(scope.activityId && state.activities.find(activity => activity.id === scope.activityId && activity.groupId === scope.groupId)?.journey?.days.some(day => day.places.some(place => place.id === scope.placeId && Boolean(place.name.trim()))));
}
function closedTemporaryRoom(group: TogetherState['groups'][number], at: Date): boolean {
  return Boolean(group.temporaryRoom?.closedAt || group.temporaryRoom?.expiresAt && Date.parse(group.temporaryRoom.expiresAt) <= at.getTime());
}
function permission(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, places: Place[], at = new Date()) {
  const { group, activity } = context(state, actorId, scope), placeAvailable = availablePlace(state, scope, places);
  const retainedTemporaryHistory = group.archived && Boolean(group.temporaryRoom) && group.temporaryRoom?.disposition !== 'TRASH';
  const canReview = (!group.archived || retainedTemporaryHistory) && activity?.status !== 'CANCELLED' && placeAvailable;
  return { canReview, canMenuEdit: !group.archived && !closedTemporaryRoom(group, at) && activity?.status !== 'CANCELLED' && placeAvailable, placeAvailable };
}
function checkWrite(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, places: Place[], kind: 'REVIEW' | 'MENU', at: Date) {
  const allowed = permission(state, actorId, scope, places, at);
  if (!(kind === 'REVIEW' ? allowed.canReview : allowed.canMenuEdit)) throw new Error('이 공간은 업체 정보를 읽기만 할 수 있어요.');
}
function instant(now: Date): string { if (!Number.isFinite(now.getTime())) throw new Error('저장 시간을 다시 확인해 주세요.'); return now.toISOString(); }
function revision(current: { revision: number } | undefined, expected: number | undefined): void {
  if (current ? expected !== current.revision : expected !== undefined && expected !== 0) throw new Error('평가·메뉴 정보가 바뀌었어요. 최신 내용을 확인하고 다시 저장해 주세요.');
}
function cleanPhotos(value: PlaceFeedbackInput['photos']) {
  const result = value ?? [];
  if (!isTogetherPhotoAttachments(result)) throw new Error('JPG·PNG·WebP 사진을 4장, 저장 용량 2MB 이내로 선택해 주세요.');
  return structuredClone(result);
}
export function readPlaceAssessment(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, places: Place[], at = new Date()) {
  const access = permission(state, actorId, scope, places, at);
  const scoped = (state.placeFeedback ?? []).filter(row => isTogetherPlaceFeedback(row) && sameScope(row, scope));
  const reviews = scoped.filter(row => !row.withdrawnAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const menus = (state.placeMenus ?? []).filter(row => isTogetherPlaceMenu(row) && sameScope(row, scope) && !row.withdrawnAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { ...access, canWrite: access.canReview, reviews: structuredClone(reviews), menus: structuredClone(menus), ownReview: structuredClone(scoped.find(row => row.authorId === actorId)),
    summary: { reviewCount: reviews.length, averageRating: reviews.length ? Math.round(reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length * 10) / 10 : undefined,
      recommendationCount: reviews.filter(row => row.recommended).length,
      purposeCounts: businessPurposes.map(purpose => ({ purpose: purpose.id, count: reviews.filter(row => row.recommended && row.purposes.includes(purpose.id)).length })).filter(row => row.count > 0) } };
}
/** Run inside repository.update. The caller's draft is never changed before all checks succeed. */
export function upsertPlaceFeedback(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, input: PlaceFeedbackInput, places: Place[], now = new Date()): string {
  checkWrite(state, actorId, scope, places, 'REVIEW', now);
  const current = state.placeFeedback?.find(row => sameScope(row, scope) && row.authorId === actorId);
  revision(current, input.expectedRevision);
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 || !text(input.note, 2000) || typeof input.recommended !== 'boolean' || !purposes(input.purposes)) throw new Error('별점 1~5점과 평가 내용을 확인해 주세요.');
  if (!isPlaceExperienceTags(input.experienceTags)) throw new Error('경험 태그를 다시 선택해 주세요.');
  const photos = cleanPhotos(input.photos), at = instant(now);
  const tags = input.experienceTags === undefined ? current?.experienceTags : input.experienceTags;
  const row: TogetherPlaceFeedback = { id: current?.id ?? togetherId('place-feedback'), groupId: scope.groupId, ...(scope.activityId ? { activityId: scope.activityId } : {}), placeId: scope.placeId, authorId: actorId,
    rating: input.rating, note: input.note.trim(), recommended: input.recommended, purposes: [...input.purposes], photos, ...(tags !== undefined ? { experienceTags: [...tags] } : {}), revision: (current?.revision ?? 0) + 1, createdAt: current?.createdAt ?? at, updatedAt: at };
  state.placeFeedback ??= [];
  if (current) state.placeFeedback[state.placeFeedback.indexOf(current)] = row; else state.placeFeedback.push(row);
  return row.id;
}
export function withdrawPlaceFeedback(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, expectedRevision: number, now = new Date()): void {
  context(state, actorId, scope);
  const row = state.placeFeedback?.find(item => sameScope(item, scope) && item.authorId === actorId);
  if (!row || row.withdrawnAt) throw new Error('현재 내 평가를 다시 확인해 주세요.');
  revision(row, expectedRevision); const at = instant(now);
  row.withdrawnAt = at; row.updatedAt = at; row.revision++;
}
export function savePlaceMenu(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, input: PlaceMenuInput, places: Place[], now = new Date()): string {
  checkWrite(state, actorId, scope, places, 'MENU', now);
  const current = input.id ? state.placeMenus?.find(row => row.id === input.id && sameScope(row, scope) && row.authorId === actorId) : undefined;
  if (input.id && !current) throw new Error('이 공간에서 내가 공유한 메뉴만 수정할 수 있어요.');
  revision(current, input.expectedRevision);
  const at = instant(now);
  if (!text(input.name, 100) || !input.name.trim() || !text(input.priceText, 80) || !text(input.note, 600)
    || input.sourceUrl && !sourceUrl(input.sourceUrl.trim()) || input.checkedOn && (!date(input.checkedOn) || input.checkedOn > koreaDay(now))) throw new Error('메뉴·요금, 출처와 확인 날짜를 확인해 주세요.');
  const photos = cleanPhotos(input.photos);
  if ((state.placeMenus ?? []).some(row => sameScope(row, scope) && row.authorId === actorId && !row.withdrawnAt && row.id !== current?.id && row.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase())) throw new Error('이미 공유한 메뉴예요. 기존 메뉴를 수정해 주세요.');
  const row: TogetherPlaceMenu = { id: current?.id ?? togetherId('place-menu'), groupId: scope.groupId, ...(scope.activityId ? { activityId: scope.activityId } : {}), placeId: scope.placeId, authorId: actorId,
    name: input.name.trim(), priceText: input.priceText.trim(), note: input.note.trim(), ...(input.sourceUrl?.trim() ? { sourceUrl: input.sourceUrl.trim() } : {}), ...(input.checkedOn ? { checkedOn: input.checkedOn } : {}), photos,
    revision: (current?.revision ?? 0) + 1, createdAt: current?.createdAt ?? at, updatedAt: at };
  state.placeMenus ??= [];
  if (current) state.placeMenus[state.placeMenus.indexOf(current)] = row; else state.placeMenus.push(row);
  return row.id;
}
export function withdrawPlaceMenu(state: TogetherState, actorId: string, scope: PlaceAssessmentScope, menuId: string, expectedRevision: number, now = new Date()): void {
  const { group, activity } = context(state, actorId, scope);
  if (group.archived || closedTemporaryRoom(group, now) || activity?.status === 'CANCELLED') throw new Error('종료된 공간의 메뉴 정보는 읽기만 할 수 있어요.');
  const row = state.placeMenus?.find(item => item.id === menuId && sameScope(item, scope) && item.authorId === actorId);
  if (!row || row.withdrawnAt) throw new Error('현재 내가 공유한 메뉴를 다시 확인해 주세요.');
  revision(row, expectedRevision); const at = instant(now);
  row.withdrawnAt = at; row.updatedAt = at; row.revision++;
}
