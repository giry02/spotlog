import type { Place } from '../data';
import { canEditActivity, togetherId, type TogetherActivity, type TogetherState } from './model.ts';
import type { TogetherVisitGuide, VisitGuideFields, VisitGuideInput, VisitGuidePreview, VisitGuideProjection, VisitGuidePublication, VisitGuideScope, VisitGuideStop } from './visitGuideTypes';

const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const text = (v: unknown, limit: number) => typeof v === 'string' && v.length <= limit;
const integer = (v: unknown, minimum = 0) => Number.isInteger(v) && Number(v) >= minimum;
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const time = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const kinds = ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'];
const fieldsKeys = ['title', 'meetingText', 'entry', 'parking', 'preparations', 'selectedStopKeys'];
function isFields(v: unknown): v is VisitGuideFields {
  return object(v) && keys(v, fieldsKeys) && text(v.title, 100) && Boolean((v.title as string).trim())
    && text(v.meetingText, 300) && text(v.entry, 600) && text(v.parking, 600) && text(v.preparations, 1000)
    && Array.isArray(v.selectedStopKeys) && v.selectedStopKeys.length <= 100
    && v.selectedStopKeys.every(key => text(key, 220)) && new Set(v.selectedStopKeys).size === v.selectedStopKeys.length;
}
export function isVisitGuideProjection(v: unknown): v is VisitGuideProjection {
  return object(v) && keys(v, ['title', 'date', 'endDate', 'time', 'meetingText', 'entry', 'parking', 'preparations', 'stops'])
    && isFields({ title: v.title, meetingText: v.meetingText, entry: v.entry, parking: v.parking, preparations: v.preparations, selectedStopKeys: [] })
    && (v.date === '' || day(v.date)) && (v.endDate === '' || day(v.endDate)) && (!v.date || !v.endDate || v.endDate >= v.date)
    && (v.time === '' || time(v.time)) && Array.isArray(v.stops) && v.stops.length <= 100 && v.stops.every(stop => object(stop)
      && keys(stop, ['placeId', 'name', 'kind', 'address', 'day', 'order', 'lat', 'lng'])
      && text(stop.placeId, 200) && Boolean(stop.placeId) && text(stop.name, 200) && Boolean(stop.name) && kinds.includes(stop.kind as string)
      && text(stop.address, 500) && integer(stop.day, 1) && integer(stop.order, 1)
      && (stop.lat === undefined && stop.lng === undefined || typeof stop.lat === 'number' && Number.isFinite(stop.lat) && Math.abs(stop.lat) <= 90 && typeof stop.lng === 'number' && Number.isFinite(stop.lng) && Math.abs(stop.lng) <= 180));
}
export function isVisitGuidePublication(v: unknown): v is VisitGuidePublication {
  return object(v) && keys(v, ['token', 'issuedAt', 'expiresAt', 'revoked', 'projection']) && token(v.token) && timestamp(v.issuedAt) && timestamp(v.expiresAt)
    && Date.parse(v.expiresAt) > Date.parse(v.issuedAt) && Date.parse(v.expiresAt) - Date.parse(v.issuedAt) <= 168 * 3600000
    && typeof v.revoked === 'boolean' && isVisitGuideProjection(v.projection);
}
export function isTogetherVisitGuide(v: unknown): v is TogetherVisitGuide {
  return object(v) && keys(v, ['id', 'groupId', 'activityId', 'creatorId', 'revision', 'activityRevision', 'updatedAt', 'fields', 'publication', 'withdrawnTokens'])
    && ['id', 'groupId', 'activityId', 'creatorId'].every(key => text(v[key], 200) && Boolean(v[key])) && integer(v.revision, 1)
    && integer(v.activityRevision, 1) && timestamp(v.updatedAt) && isFields(v.fields) && (v.publication === undefined || isVisitGuidePublication(v.publication))
    && (v.withdrawnTokens === undefined || Array.isArray(v.withdrawnTokens) && v.withdrawnTokens.every(token) && new Set(v.withdrawnTokens).size === v.withdrawnTokens.length);
}
export function isVisitGuideStateFields(v: unknown): boolean {
  if (!object(v)) return false;
  if (v.visitGuides === undefined) return true;
  return Array.isArray(v.visitGuides) && v.visitGuides.every(isTogetherVisitGuide) && new Set(v.visitGuides.map(guide => guide.id)).size === v.visitGuides.length
    && new Set(v.visitGuides.map(guide => `${guide.groupId}:${guide.activityId}`)).size === v.visitGuides.length
    && new Set(v.visitGuides.flatMap(guide => guide.publication ? [guide.publication.token] : [])).size === v.visitGuides.filter(guide => guide.publication).length;
}
function nowMs(at: Date) { const value = at.getTime(); if (!Number.isFinite(value)) throw new Error('현재 시간을 다시 확인해 주세요.'); return value; }
function context(state: TogetherState, actorId: string, scope: VisitGuideScope, at: Date, write = false) {
  const now = nowMs(at), group = state.groups.find(row => row.id === scope.groupId);
  const activity = state.activities.find(row => row.id === scope.activityId && row.groupId === scope.groupId);
  if (!actorId || !state.members.some(row => row.id === actorId) || !group || !activity || !group.memberIds.includes(actorId)
    || group.blockedMemberIds?.includes(actorId) || group.temporaryRoom?.disposition === 'TRASH') throw new Error('현재 약속의 멤버만 방문 안내를 볼 수 있어요.');
  const end = day(activity.endDate) ? activity.endDate : activity.date;
  const past = day(end) && end < new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(at);
  const active = !group.archived && !group.temporaryRoom?.closedAt && !(group.temporaryRoom?.expiresAt && Date.parse(group.temporaryRoom.expiresAt) <= now) && activity.status === 'PLANNED' && !activity.journey?.trash && !past;
  const canEdit = active && canEditActivity(state, actorId, activity);
  if (write && !canEdit) throw new Error('현재 진행할 약속의 편집자만 안내를 저장하거나 발급할 수 있어요.');
  return { group, activity, active, canEdit };
}
const publicPlace = (place: Place) => !place.personal && typeof place.name === 'string' && place.name.trim() && kinds.includes(place.kind);
export interface VisitGuideSourceStop { key: string; label: string; day: number; order: number; publicStop?: VisitGuideStop; unavailableReason?: string }
function routeStops(activity: TogetherActivity, places: Place[]): VisitGuideSourceStop[] {
  const rows: VisitGuideSourceStop[] = [];
  const append = (original: Pick<Place, 'id' | 'name' | 'personal'>, stopKey: string, dayNumber: number, order: number) => {
    const current = places.find(place => place.id === original.id && publicPlace(place));
    const unavailableReason = original.personal ? '직접 등록한 개인 장소는 링크에서 제외돼요.' : !current ? '현재 공개 장소 정보가 없어 링크에서 제외돼요.' : undefined;
    const located = current && current.locationVerified !== false && Number.isFinite(current.lat) && Math.abs(current.lat) <= 90 && Number.isFinite(current.lng) && Math.abs(current.lng) <= 180 && (current.lat !== 0 || current.lng !== 0);
    rows.push({ key: stopKey, label: original.name, day: dayNumber, order, ...(unavailableReason ? { unavailableReason } : { publicStop: { placeId: current!.id, name: current!.name, kind: current!.kind, address: current!.address || '', day: dayNumber, order, ...(located ? { lat: current!.lat, lng: current!.lng } : {}) } }) });
  };
  if (activity.journey) activity.journey.days.forEach((journeyDay, d) => journeyDay.places.forEach((place, p) => append(place, `${d}:${p}:${place.id}`, d + 1, p + 1)));
  if (!rows.length && activity.venuePlaceId) {
    const current = places.find(place => place.id === activity.venuePlaceId);
    append(current || { id: activity.venuePlaceId, name: '현재 약속 장소' }, `venue:${activity.venuePlaceId}`, 1, 1);
  }
  return rows;
}
function storedGuide(state: TogetherState, scope: VisitGuideScope) {
  return state.visitGuides?.find(row => row.groupId === scope.groupId && row.activityId === scope.activityId);
}
function cleanInput(input: VisitGuideInput): VisitGuideInput {
  if (!object(input) || !keys(input, [...fieldsKeys, 'expectedActivityRevision', 'expectedGuideRevision', 'validityHours'])
    || !isFields(Object.fromEntries(fieldsKeys.map(key => [key, input[key as keyof VisitGuideInput]])))
    || !integer(input.expectedActivityRevision, 1) || !integer(input.expectedGuideRevision) || !integer(input.validityHours, 1) || input.validityHours > 168) throw new Error('안내 제목·내용·공유 기간을 다시 확인해 주세요.');
  return { title: input.title.trim(), meetingText: input.meetingText.trim(), entry: input.entry.trim(), parking: input.parking.trim(), preparations: input.preparations.trim(), selectedStopKeys: [...input.selectedStopKeys], expectedActivityRevision: input.expectedActivityRevision, expectedGuideRevision: input.expectedGuideRevision, validityHours: input.validityHours };
}
function selectedStops(stops: VisitGuideSourceStop[], selectedKeys: string[]): VisitGuideStop[] {
  const perDay = new Map<number, number>();
  return stops.filter(stop => selectedKeys.includes(stop.key) && stop.publicStop).map(stop => {
    const order = (perDay.get(stop.day) || 0) + 1; perDay.set(stop.day, order);
    return { ...stop.publicStop!, order };
  });
}
export function previewVisitGuide(state: TogetherState, actorId: string, scope: VisitGuideScope, input: VisitGuideInput, places: Place[], at = new Date()): VisitGuidePreview {
  const { activity } = context(state, actorId, scope, at, true), guide = storedGuide(state, scope), clean = cleanInput(input);
  if (clean.expectedActivityRevision !== activity.revision || clean.expectedGuideRevision !== (guide?.revision || 0)) throw new Error('일정이나 안내가 바뀌었어요. 최신 내용을 확인해 주세요.');
  const stops = routeStops(activity, places);
  if (clean.selectedStopKeys.some(key => !stops.some(stop => stop.key === key && stop.publicStop))) throw new Error('공유할 수 있는 현재 공개 장소를 다시 선택해 주세요.');
  const projection: VisitGuideProjection = { title: clean.title, date: day(activity.date) ? activity.date : '', endDate: day(activity.endDate) ? activity.endDate : '', time: time(activity.startTime) ? activity.startTime! : '',
    meetingText: clean.meetingText, entry: clean.entry, parking: clean.parking, preparations: clean.preparations,
    stops: selectedStops(stops, clean.selectedStopKeys) };
  const omissions = stops.filter(stop => !clean.selectedStopKeys.includes(stop.key)).map(stop => ({ label: stop.label, reason: stop.unavailableReason || '이번 안내에서 선택하지 않았어요.' }));
  const exactScope = { groupId: scope.groupId, activityId: scope.activityId };
  const key = JSON.stringify([actorId, exactScope, clean, projection, activity.revision, guide?.revision || 0]);
  return { actorId, ...exactScope, input: clean, projection, omissions, key };
}
function fieldsFrom(input: VisitGuideInput): VisitGuideFields {
  return { title: input.title, meetingText: input.meetingText, entry: input.entry, parking: input.parking, preparations: input.preparations, selectedStopKeys: [...input.selectedStopKeys] };
}
function commit(state: TogetherState, actorId: string, reviewed: VisitGuidePreview, at: Date, publication?: VisitGuidePublication) {
  const current = storedGuide(state, reviewed), withdrawnTokens = [...new Set([...(current?.withdrawnTokens || []), ...(current?.publication ? [current.publication.token] : [])])];
  const next: TogetherVisitGuide = { id: current?.id || togetherId('visit-guide'), groupId: reviewed.groupId, activityId: reviewed.activityId, creatorId: actorId,
    revision: (current?.revision || 0) + 1, activityRevision: reviewed.input.expectedActivityRevision, updatedAt: at.toISOString(), fields: fieldsFrom(reviewed.input), ...(publication ? { publication } : {}), ...(withdrawnTokens.length ? { withdrawnTokens } : {}) };
  state.visitGuides ??= [];
  if (current) state.visitGuides[state.visitGuides.indexOf(current)] = next; else state.visitGuides.push(next);
  return next;
}
/** Saving is member-only; a previous link is removed until an explicit new review and issue. */
export function saveVisitGuide(state: TogetherState, actorId: string, scope: VisitGuideScope, input: VisitGuideInput, places: Place[], at = new Date()): string {
  const reviewed = previewVisitGuide(state, actorId, scope, input, places, at);
  return commit(state, actorId, reviewed, at).id;
}
/** The host calls this only after the explicit preview/consent action, inside repository.update. */
export function publishVisitGuide(state: TogetherState, actorId: string, reviewed: VisitGuidePreview, places: Place[], at = new Date()): string {
  if (!reviewed || reviewed.actorId !== actorId) throw new Error('안내를 검토한 계정으로 다시 확인해 주세요.');
  const fresh = previewVisitGuide(state, actorId, reviewed, reviewed.input, places, at);
  if (fresh.key !== reviewed.key || JSON.stringify(fresh.projection) !== JSON.stringify(reviewed.projection)) throw new Error('공유될 내용이 바뀌었어요. 미리보기를 다시 확인해 주세요.');
  if (!globalThis.crypto?.getRandomValues) throw new Error('안전한 링크를 만들 수 없어요. 브라우저 환경을 확인해 주세요.');
  const bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes);
  const nextToken = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  if (state.visitGuides?.some(guide => guide.publication?.token === nextToken)) throw new Error('새 링크를 다시 발급해 주세요.');
  commit(state, actorId, fresh, at, { token: nextToken, issuedAt: at.toISOString(), expiresAt: new Date(nowMs(at) + fresh.input.validityHours * 3600000).toISOString(), revoked: false, projection: structuredClone(fresh.projection) });
  return nextToken;
}
/** Current editors may withdraw a link even after cancellation/archive; that never reopens the room. */
export function revokeVisitGuide(state: TogetherState, actorId: string, scope: VisitGuideScope, guideId: string, expectedRevision: number, at = new Date()): void {
  const { group, activity } = context(state, actorId, scope, at), guide = storedGuide(state, scope);
  const allowed = group.ownerId === actorId || group.managerIds.includes(actorId) || activity.leadId === actorId || activity.editorIds.includes(actorId);
  if (!allowed || !guide || guide.id !== guideId || expectedRevision !== guide.revision || !guide.publication) throw new Error('현재 안내와 편집 권한을 다시 확인해 주세요.');
  guide.publication.revoked = true; guide.revision += 1; guide.updatedAt = at.toISOString();
}
export function selectVisitGuide(state: TogetherState, actorId: string, scope: VisitGuideScope, places: Place[], at = new Date()) {
  const ctx = context(state, actorId, scope, at), guide = storedGuide(state, scope), sourceStops = routeStops(ctx.activity, places);
  const fields: VisitGuideFields = guide ? structuredClone(guide.fields) : { title: '방문 안내', meetingText: '', entry: '', parking: '', preparations: '', selectedStopKeys: [] };
  const projection: VisitGuideProjection = { title: fields.title, date: day(ctx.activity.date) ? ctx.activity.date : '', endDate: day(ctx.activity.endDate) ? ctx.activity.endDate : '', time: time(ctx.activity.startTime) ? ctx.activity.startTime! : '', meetingText: fields.meetingText, entry: fields.entry, parking: fields.parking, preparations: fields.preparations, stops: selectedStops(sourceStops, fields.selectedStopKeys) };
  return { ...ctx, guide: guide ? structuredClone(guide) : undefined, fields, projection, sourceStops, outdated: Boolean(guide && guide.activityRevision !== ctx.activity.revision),
    canRevoke: Boolean(guide?.publication && !guide.publication.revoked && (ctx.group.ownerId === actorId || ctx.group.managerIds.includes(actorId) || ctx.activity.leadId === actorId || ctx.activity.editorIds.includes(actorId))) };
}
/** Owner-side fresh validation for cache reconciliation; guest never receives this source state. */
export function readVisitGuide(state: TogetherState, linkToken: string, places: Place[], at = new Date()): VisitGuidePublication {
  if (!token(linkToken)) throw new Error('방문 안내 링크를 확인해 주세요.');
  const guide = state.visitGuides?.find(row => row.publication?.token === linkToken), publication = guide?.publication;
  if (!guide || !publication || !isTogetherVisitGuide(guide) || publication.revoked || Date.parse(publication.expiresAt) <= nowMs(at)) throw new Error('만료되거나 회수된 방문 안내예요.');
  const { active, canEdit, activity } = context(state, guide.creatorId, guide, at);
  if (!active || !canEdit || activity.revision !== guide.activityRevision) throw new Error('일정이나 접근 권한이 바뀌어 새 안내가 필요해요.');
  const fresh = previewVisitGuide(state, guide.creatorId, guide, { ...guide.fields, expectedActivityRevision: guide.activityRevision, expectedGuideRevision: guide.revision, validityHours: 1 }, places, at);
  if (JSON.stringify(fresh.projection) !== JSON.stringify(publication.projection)) throw new Error('장소 정보가 변경되어 새 안내가 필요해요.');
  return structuredClone(publication);
}
