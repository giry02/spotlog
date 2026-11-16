import type { Place } from '../data';
import type { TogetherState } from './model';
import { getPlanningSupportContext, validPlanningDate } from './planningSupport.ts';
import type {
  PersonalRouteAcknowledgement, PersonalRouteChange, PersonalRouteSaveInput, PersonalRouteScope,
  PersonalRouteSelection, PersonalRouteSnapshot, PersonalRouteStop, PersonalRouteView, TogetherPersonalRoute,
} from './personalRouteTypes';

const MAX_STOPS = 500;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (row: Record<string, unknown>, allowed: string[]) => Object.keys(row).every(key => allowed.includes(key));
const text = (value: unknown, max = 1000): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const id = (value: unknown): value is string => text(value, 300) && Boolean(value.trim()) && value === value.trim() && !['__proto__', 'constructor', 'prototype'].includes(value);
const int = (value: unknown, min = 1): value is number => Number.isSafeInteger(value) && Number(value) >= min;
const day = (value: unknown) => value === '' || typeof value === 'string' && validPlanningDate(value);
const time = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const stamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const coordinate = (value: unknown, limit: number) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
const kinds = ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'];
const stableKey = (dayId: string, visitId: string) => JSON.stringify([dayId, visitId]);
const scopeEqual = (row: PersonalRouteScope, scope: PersonalRouteScope) => row.groupId === scope.groupId && row.activityId === scope.activityId;
const snapshotVersion = (snapshot: PersonalRouteSnapshot) => JSON.stringify([snapshot.date, snapshot.endDate, snapshot.startTime, snapshot.meetingPoint, snapshot.venuePlaceId,
  snapshot.stops.map(stop => [stop.key, stop.dayId, stop.visitId, stop.day, stop.date, stop.placeId, stop.name, stop.kind, stop.area, stop.address, stop.lat, stop.lng, stop.time, stop.duration, stop.bookingFixed])]);
const validStop = (value: unknown): value is PersonalRouteStop => object(value)
  && keys(value, ['key', 'dayId', 'visitId', 'day', 'date', 'placeId', 'name', 'kind', 'area', 'address', 'lat', 'lng', 'time', 'duration', 'bookingFixed'])
  && id(value.dayId) && id(value.visitId) && value.key === stableKey(value.dayId, value.visitId)
  && int(value.day) && Number(value.day) <= 366 && day(value.date) && id(value.placeId)
  && text(value.name, 300) && Boolean(value.name.trim()) && kinds.includes(String(value.kind)) && text(value.area, 500) && text(value.address, 1000)
  && (value.lat === undefined || coordinate(value.lat, 90)) && (value.lng === undefined || coordinate(value.lng, 180))
  && text(value.time, 200) && text(value.duration, 200) && typeof value.bookingFixed === 'boolean';
function validSnapshot(value: unknown): value is PersonalRouteSnapshot {
  return object(value) && keys(value, ['date', 'endDate', 'startTime', 'meetingPoint', 'venuePlaceId', 'stops'])
    && day(value.date) && day(value.endDate) && (value.startTime === '' || time(value.startTime)) && text(value.meetingPoint, 2000)
    && (value.venuePlaceId === undefined || id(value.venuePlaceId)) && Array.isArray(value.stops) && value.stops.length > 0 && value.stops.length <= MAX_STOPS
    && value.stops.every(validStop) && new Set(value.stops.map(stop => stop.key)).size === value.stops.length;
}
export function isTogetherPersonalRoute(value: unknown): value is TogetherPersonalRoute {
  if (!object(value) || !keys(value, ['groupId', 'activityId', 'userId', 'startKey', 'endKey', 'originPlaceId', 'joinTime', 'snapshot', 'revision', 'updatedAt'])
    || !id(value.groupId) || !id(value.activityId) || !id(value.userId) || !text(value.startKey, 1300) || !text(value.endKey, 1300)
    || value.originPlaceId !== undefined && !id(value.originPlaceId) || value.joinTime !== undefined && !time(value.joinTime)
    || !validSnapshot(value.snapshot) || !int(value.revision) || !stamp(value.updatedAt)) return false;
  const first = value.snapshot.stops.findIndex(stop => stop.key === value.startKey), last = value.snapshot.stops.findIndex(stop => stop.key === value.endKey);
  return first >= 0 && last >= first;
}
/** Old schema-v1 records need no migration; every optional record has an exact activity scope. */
export function isPersonalRouteStateFields(value: unknown): boolean {
  if (!object(value)) return false;
  if (value.personalRoutes === undefined) return true;
  return Array.isArray(value.personalRoutes) && value.personalRoutes.length <= 1000 && value.personalRoutes.every(isTogetherPersonalRoute)
    && new Set(value.personalRoutes.map(row => JSON.stringify([row.groupId, row.activityId, row.userId]))).size === value.personalRoutes.length
    && Array.isArray(value.activities) && value.personalRoutes.every(row => (value.activities as unknown[]).some(activity => object(activity) && activity.id === row.activityId && activity.groupId === row.groupId));
}
function context(state: TogetherState, actorId: string, scope: PersonalRouteScope, at: Date) {
  if (!Number.isFinite(at.getTime()) || !id(actorId) || !id(scope.groupId) || !id(scope.activityId) || !state.members.some(row => row.id === actorId)) throw new Error('현재 계정과 약속을 다시 확인해 주세요.');
  const access = getPlanningSupportContext(state, actorId, scope, at);
  if (!access.activity || access.group.temporaryRoom?.disposition === 'TRASH') throw new Error('현재 모임의 약속에서 확인해 주세요.');
  const expires = access.group.temporaryRoom?.expiresAt;
  const invalidDate = [access.activity.date, access.activity.endDate].some(value => Boolean(value) && !validPlanningDate(value));
  const expired = Boolean(expires && (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= at.getTime()));
  return { ...access, activity: access.activity, writable: access.canWrite && !invalidDate && !expired && !access.group.temporaryRoom?.closedAt,
    memberIds: [...new Set(access.group.memberIds.filter(memberId => state.members.some(row => row.id === memberId) && !access.group.blockedMemberIds?.includes(memberId)))] };
}
function canonicalRoute(state: TogetherState, actorId: string, scope: PersonalRouteScope, places: Place[], at: Date) {
  const access = context(state, actorId, scope, at), activity = access.activity, issues: string[] = [];
  const stops: PersonalRouteStop[] = [];
  const push = (place: Place, dayId: string, visitId: string, dayNumber: number, date: string) => {
    const stop: PersonalRouteStop = { key: stableKey(dayId, visitId), dayId, visitId, day: dayNumber, date, placeId: place.id,
      name: place.name, kind: place.kind, area: place.area, address: place.address,
      ...(coordinate(place.lat, 90) ? { lat: place.lat } : {}), ...(coordinate(place.lng, 180) ? { lng: place.lng } : {}),
      time: place.time || '', duration: place.duration || '', bookingFixed: Boolean(place.bookingFixed) };
    if (!validStop(stop)) issues.push('방문 장소의 고정 ID와 날짜·정보를 먼저 확인해 주세요.');
    stops.push(stop);
  };
  if (activity.journey?.days.some(row => row.places.length > 0)) {
    if (activity.journey.trash) issues.push('휴지통의 동선은 구간을 선택할 수 없어요.');
    const days = activity.journey.days;
    if (days.length > 366 || new Set(days.map(row => row.dayId)).size !== days.length) issues.push('DAY의 고정 ID를 먼저 확인해 주세요.');
    for (const row of days) {
      if (!id(row.dayId)) issues.push('고정 ID가 없는 DAY예요. 공동 동선을 먼저 확인해 주세요.');
      for (const place of row.places) {
        if (!id(place.visitId)) issues.push('고정 ID가 없는 방문이에요. 다른 방문으로 자동 연결하지 않아요.');
        push(place, row.dayId || '', place.visitId || '', row.day, row.date);
        if (stops.length > MAX_STOPS) { issues.push(`한 약속에서 최대 ${MAX_STOPS}곳의 구간을 선택할 수 있어요.`); break; }
      }
      if (stops.length > MAX_STOPS) break;
    }
  } else if (activity.venuePlaceId) {
    const place = places.find(row => row.id === activity.venuePlaceId && !row.personal);
    if (place) push({ ...place, time: activity.startTime || '' }, 'meeting-venue', `venue:${place.id}`, 1, activity.date);
    else issues.push('만날 장소의 현재 공개 정보를 먼저 확인해 주세요.');
  } else issues.push('공동 동선이나 만날 장소를 먼저 정해 주세요.');
  if (new Set(stops.map(stop => stop.key)).size !== stops.length) issues.push('방문 ID가 겹쳐 구간을 구분할 수 없어요.');
  const snapshot: PersonalRouteSnapshot = { date: activity.date, endDate: activity.endDate, startTime: activity.startTime || '', meetingPoint: activity.meetingPoint,
    ...(activity.venuePlaceId ? { venuePlaceId: activity.venuePlaceId } : {}), stops };
  if (!validSnapshot(snapshot) && !issues.length) issues.push('현재 일정 정보를 먼저 확인해 주세요.');
  return { ...access, snapshot, version: snapshotVersion(snapshot), issues: [...new Set(issues)] };
}
function selectedStops(snapshot: PersonalRouteSnapshot, firstKey: string, lastKey: string) {
  const first = snapshot.stops.findIndex(stop => stop.key === firstKey), last = snapshot.stops.findIndex(stop => stop.key === lastKey);
  return first >= 0 && last >= first ? snapshot.stops.slice(first, last + 1) : [];
}
function changesFor(row: TogetherPersonalRoute, current: PersonalRouteSnapshot): { changes: PersonalRouteChange[]; needsReselect: boolean; stops: PersonalRouteStop[]; previousStops: PersonalRouteStop[] } {
  const before = row.snapshot, previousStops = selectedStops(before, row.startKey, row.endKey), stops = selectedStops(current, row.startKey, row.endKey), changes: PersonalRouteChange[] = [];
  if (before.date !== current.date || before.endDate !== current.endDate) changes.push({ kind: 'DATE', label: '약속 날짜가 바뀌었어요.', before: [before.date, before.endDate].filter(Boolean).join(' ~ ') || '미정', after: [current.date, current.endDate].filter(Boolean).join(' ~ ') || '미정' });
  if (before.startTime !== current.startTime) changes.push({ kind: 'TIME', label: '함께 만나는 시각이 바뀌었어요.', before: before.startTime || '미정', after: current.startTime || '미정' });
  if (before.meetingPoint !== current.meetingPoint) changes.push({ kind: 'MEETING', label: '집합 안내가 바뀌었어요.', before: before.meetingPoint || '미정', after: current.meetingPoint || '미정' });
  if (before.venuePlaceId !== current.venuePlaceId) changes.push({ kind: 'VENUE', label: '약속의 대표 장소가 바뀌었어요.', before: before.venuePlaceId || '미정', after: current.venuePlaceId || '미정' });
  const currentByKey = new Map(current.stops.map(stop => [stop.key, stop]));
  const missing = previousStops.filter(stop => !currentByKey.has(stop.key));
  for (const stop of missing) changes.push({ kind: 'REMOVED', label: `${stop.name} 방문이 삭제되거나 다른 DAY로 옮겨졌어요.`, before: stop.name, stopKey: stop.key });
  const needsReselect = !stops.length;
  if (needsReselect && !missing.length) changes.push({ kind: 'ORDER', label: '합류 지점이 종료 지점보다 뒤로 바뀌었어요. 구간을 다시 선택해 주세요.' });
  if (!needsReselect) {
    const previousByKey = new Map(previousStops.map(stop => [stop.key, stop]));
    for (const stop of previousStops.filter(stop => currentByKey.has(stop.key) && !stops.some(next => next.key === stop.key))) {
      changes.push({ kind: 'ORDER', label: `${stop.name} 방문이 내 구간 밖으로 옮겨졌어요.`, before: stop.name, stopKey: stop.key });
    }
    for (const stop of stops) {
      const old = previousByKey.get(stop.key);
      if (!old) { changes.push({ kind: 'ADDED', label: `내 구간에 ${stop.name} 방문이 추가됐어요.`, after: stop.name, stopKey: stop.key }); continue; }
      const facts = (value: PersonalRouteStop) => [value.placeId, value.name, value.kind, value.area, value.address, value.lat, value.lng];
      if (JSON.stringify(facts(old)) !== JSON.stringify(facts(stop))) changes.push({ kind: 'PLACE', label: `${old.name} 장소 정보가 바뀌었어요.`, before: `${old.name} · ${old.address}`, after: `${stop.name} · ${stop.address}`, stopKey: stop.key });
      if (old.date !== stop.date) changes.push({ kind: 'DATE', label: `${stop.name} 방문 날짜가 바뀌었어요.`, before: old.date || '미정', after: stop.date || '미정', stopKey: stop.key });
      if (old.time !== stop.time || old.duration !== stop.duration) changes.push({ kind: 'TIME', label: `${stop.name} 방문 시각·체류 정보가 바뀌었어요.`, before: [old.time, old.duration].filter(Boolean).join(' · ') || '미정', after: [stop.time, stop.duration].filter(Boolean).join(' · ') || '미정', stopKey: stop.key });
      if (old.bookingFixed !== stop.bookingFixed) changes.push({ kind: 'BOOKING', label: `${stop.name} 예약 고정 표시가 바뀌었어요. 실제 예약은 별도로 확인해 주세요.`, before: old.bookingFixed ? '고정' : '고정 안 함', after: stop.bookingFixed ? '고정' : '고정 안 함', stopKey: stop.key });
    }
    const commonBefore = previousStops.filter(stop => stops.some(next => next.key === stop.key)).map(stop => stop.key);
    const commonAfter = stops.filter(stop => previousByKey.has(stop.key)).map(stop => stop.key);
    if (JSON.stringify(commonBefore) !== JSON.stringify(commonAfter)) changes.push({ kind: 'ORDER', label: '내 구간의 방문 순서가 바뀌었어요.' });
  }
  return { changes, needsReselect, stops, previousStops };
}
export function selectPersonalRoutes(state: TogetherState, actorId: string, scope: PersonalRouteScope, places: Place[], at = new Date()): PersonalRouteSelection {
  const access = canonicalRoute(state, actorId, scope, places, at);
  const members = (state.personalRoutes || []).filter(row => scopeEqual(row, scope) && access.memberIds.includes(row.userId) && isTogetherPersonalRoute(row)).map(row => {
    const result = changesFor(row, access.snapshot), invalid = access.issues.length > 0 || result.needsReselect;
    const view: PersonalRouteView = { groupId: row.groupId, activityId: row.activityId, userId: row.userId, startKey: row.startKey, endKey: row.endKey,
      ...(row.originPlaceId ? { originPlaceId: row.originPlaceId } : {}), ...(row.joinTime ? { joinTime: row.joinTime } : {}), revision: row.revision, updatedAt: row.updatedAt,
      ...result, needsReselect: invalid, status: invalid ? 'INVALID' : result.changes.length ? 'CHANGED' : 'CURRENT',
      routeChanged: snapshotVersion(row.snapshot) !== access.version,
      ...(access.activity.participants[row.userId] ? { participation: access.activity.participants[row.userId] } : {}) };
    return view;
  });
  return structuredClone({ activity: access.activity, route: { ...access.snapshot, version: access.version, issues: access.issues },
    members, own: members.find(row => row.userId === actorId), writable: access.writable && !access.issues.length, canWithdraw: access.writable,
    missingMemberIds: access.memberIds.filter(memberId => !members.some(row => row.userId === memberId)) });
}
function assertWrite(state: TogetherState, actorId: string, scope: PersonalRouteScope, expectedRevision: number, routeVersion: string, places: Place[], at: Date, allowRouteIssues = false) {
  const access = canonicalRoute(state, actorId, scope, places, at);
  const own = state.personalRoutes?.find(row => scopeEqual(row, scope) && row.userId === actorId);
  if (!access.writable || access.issues.length && !allowRouteIssues) throw new Error('종료·보관·취소되었거나 확인이 필요한 동선은 읽기만 할 수 있어요.');
  if (!int(expectedRevision, 0) || expectedRevision !== (own?.revision ?? 0) || typeof routeVersion !== 'string' || routeVersion !== access.version) throw new Error('내 구간이나 공동 일정이 바뀌었어요. 최신 내용을 다시 확인해 주세요.');
  return { ...access, own };
}
/** Shares only the actor's explicit segment. Never changes common route, bookings or attendance. */
export function savePersonalRoute(state: TogetherState, actorId: string, scope: PersonalRouteScope, input: PersonalRouteSaveInput, places: Place[], at = new Date()): void {
  if (!object(input) || !keys(input, ['startKey', 'endKey', 'originPlaceId', 'joinTime', 'expectedRevision', 'routeVersion'])) throw new Error('공유할 내 구간을 다시 확인해 주세요.');
  const access = assertWrite(state, actorId, scope, input.expectedRevision, input.routeVersion, places, at);
  if (!text(input.startKey, 1300) || !text(input.endKey, 1300) || !selectedStops(access.snapshot, input.startKey, input.endKey).length
    || input.joinTime !== undefined && !time(input.joinTime) || input.originPlaceId !== undefined && (!id(input.originPlaceId) || !places.some(place => place.id === input.originPlaceId && !place.personal))) throw new Error('최신 동선의 합류·종료 지점과 공개 출발 기준 장소·시각을 확인해 주세요.');
  const record: TogetherPersonalRoute = { groupId: scope.groupId, activityId: scope.activityId, userId: actorId, startKey: input.startKey, endKey: input.endKey,
    ...(input.originPlaceId ? { originPlaceId: input.originPlaceId } : {}), ...(input.joinTime ? { joinTime: input.joinTime } : {}),
    snapshot: structuredClone(access.snapshot), revision: (access.own?.revision || 0) + 1, updatedAt: at.toISOString() };
  if (!isTogetherPersonalRoute(record)) throw new Error('내 구간 정보를 다시 확인해 주세요.');
  if (!access.own && (state.personalRoutes?.length || 0) >= 1000) throw new Error('저장된 구간이 많아요. 이전 구간을 정리한 뒤 다시 시도해 주세요.');
  state.personalRoutes ??= [];
  if (access.own) state.personalRoutes[state.personalRoutes.indexOf(access.own)] = record; else state.personalRoutes.push(record);
}
export function removePersonalRoute(state: TogetherState, actorId: string, scope: PersonalRouteScope, input: { expectedRevision: number; routeVersion: string }, places: Place[], at = new Date()): void {
  if (!object(input) || !keys(input, ['expectedRevision', 'routeVersion'])) throw new Error('해제할 내 구간을 다시 확인해 주세요.');
  const access = assertWrite(state, actorId, scope, input.expectedRevision, input.routeVersion, places, at, true);
  if (!access.own) throw new Error('공유한 내 구간이 없어요.');
  state.personalRoutes = state.personalRoutes!.filter(row => row !== access.own);
}
export function previewPersonalRouteAcknowledgement(state: TogetherState, actorId: string, scope: PersonalRouteScope, places: Place[], at = new Date()): PersonalRouteAcknowledgement {
  const selection = selectPersonalRoutes(state, actorId, scope, places, at), own = selection.own;
  if (!selection.writable || !own || own.needsReselect || own.status !== 'CHANGED') throw new Error('내 구간을 먼저 다시 선택하거나 변경 내용을 확인해 주세요.');
  return { groupId: scope.groupId, activityId: scope.activityId, actorId, expectedRevision: own.revision, routeVersion: selection.route.version,
    key: JSON.stringify([scope.groupId, scope.activityId, actorId, own.revision, own.startKey, own.endKey, own.originPlaceId, own.joinTime, selection.route.version, own.changes]), changes: structuredClone(own.changes) };
}
/** Applies only the exact newly reviewed route snapshot to the actor's own acknowledgement. */
export function acknowledgePersonalRoute(state: TogetherState, actorId: string, reviewed: PersonalRouteAcknowledgement, places: Place[], at = new Date()): void {
  if (!object(reviewed) || !keys(reviewed, ['groupId', 'activityId', 'actorId', 'expectedRevision', 'routeVersion', 'key', 'changes']) || reviewed.actorId !== actorId) throw new Error('현재 계정의 변경 확인을 다시 열어 주세요.');
  const current = previewPersonalRouteAcknowledgement(state, actorId, reviewed, places, at);
  if (reviewed.expectedRevision !== current.expectedRevision || reviewed.routeVersion !== current.routeVersion || reviewed.key !== current.key || JSON.stringify(reviewed.changes) !== JSON.stringify(current.changes)) throw new Error('검토 이후 내 구간이나 공동 일정이 바뀌었어요. 다시 확인해 주세요.');
  const access = assertWrite(state, actorId, reviewed, reviewed.expectedRevision, reviewed.routeVersion, places, at);
  const next: TogetherPersonalRoute = { ...access.own!, snapshot: structuredClone(access.snapshot), revision: access.own!.revision + 1, updatedAt: at.toISOString() };
  if (!isTogetherPersonalRoute(next)) throw new Error('내 구간의 변경 확인을 다시 열어 주세요.');
  state.personalRoutes![state.personalRoutes!.indexOf(access.own!)] = next;
}
