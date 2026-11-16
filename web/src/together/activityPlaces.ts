import type { Journey, JourneyDay, Place } from '../data';
import { canEditActivity, isMember, memberName, togetherId, type TogetherActivity, type TogetherPoll, type TogetherState } from './model.ts';
import { koreaDay } from './discovery.ts';

export interface ActivityPlaceScope { groupId: string; activityId: string }
export type ActivityPlaceAction = ActivityPlaceScope & { expectedRevision: number } & (
  | { type: 'ADD_CANDIDATE'; placeId: string }
  | { type: 'REMOVE_CANDIDATE'; placeId: string }
  | { type: 'SET_VENUE'; placeId?: string }
  | { type: 'ADD_STOP'; placeId: string; dayId?: string }
  | { type: 'REMOVE_STOP'; dayId: string; visitId: string }
  | { type: 'MOVE_STOP'; dayId: string; visitId: string; direction: -1 | 1 }
);
export const activityDayKey = (day: JourneyDay, index: number) => day.dayId || `day:${index}`;
const publicCatalog = (places: Place[]) => new Map(places.filter(place => !place.personal && place.id && place.name.trim()).map(place => [place.id, place]));

/** Resolve only this activity's already-shared snapshot or a current public catalogue ID. */
export function activityPlaceById(activity: TogetherActivity, places: Place[], id: string): Place | undefined {
  return publicCatalog(places).get(id) || activity.journey?.days.flatMap(day => day.places).find(place => place.id === id);
}
export function getActivityPlacesContext(state: TogetherState, userId: string, scope: ActivityPlaceScope, at = new Date()) {
  const group = state.groups.find(item => item.id === scope.groupId);
  const activity = state.activities.find(item => item.id === scope.activityId && item.groupId === scope.groupId);
  if (!userId || !state.members.some(item => item.id === userId) || !group || !activity || !isMember(state, userId, group.id) || group.blockedMemberIds?.includes(userId)) throw new Error('현재 모임원만 이 약속의 장소를 볼 수 있어요.');
  const finalDay = activity.endDate || activity.date;
  const writable = !group.archived && activity.status === 'PLANNED' && (!/^\d{4}-\d{2}-\d{2}$/.test(finalDay) || finalDay >= koreaDay(at));
  return { group, activity, writable, canEdit: writable && canEditActivity(state, userId, activity) };
}
export function selectActivityPlaces(state: TogetherState, userId: string, scope: ActivityPlaceScope, places: Place[], at = new Date()) {
  const context = getActivityPlacesContext(state, userId, scope, at), { activity } = context;
  const candidateIds = [...new Set(activity.placeCandidateIds ?? [])];
  return { ...context,
    candidates: candidateIds.flatMap(id => { const place = activityPlaceById(activity, places, id); return place ? [place] : []; }),
    missingCandidateCount: candidateIds.filter(id => !activityPlaceById(activity, places, id)).length,
    venue: activity.venuePlaceId ? activityPlaceById(activity, places, activity.venuePlaceId) : undefined,
    days: activity.journey?.days ?? [],
  };
}
function sharedVisit(place: Place): Place {
  return { id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address,
    lat: place.lat, lng: place.lng, locationVerified: place.locationVerified, image: place.image,
    photos: place.photos ? structuredClone(place.photos) : undefined, description: place.description,
    duration: place.duration, note: '', visitId: togetherId('visit') };
}
function newJourney(activity: TogetherActivity, author: string, region: string): Journey {
  return { id: togetherId('activity-route'), title: activity.title, purpose: 'PLAN', planStage: 'READY',
    region, dateRange: activity.date, startDate: activity.date || undefined, duration: '1일', status: 'PLANNING',
    visibility: 'PRIVATE', cover: '', summary: '', story: '', tags: [], saves: 0, author, isMine: false,
    days: [{ dayId: togetherId('day'), day: 1, date: activity.date, title: 'DAY 1', story: '', places: [], blocks: [] }] };
}
/** Execute within repository.update; stale UI and cross-appointment IDs fail before a write. */
export function applyActivityPlaceAction(state: TogetherState, userId: string, action: ActivityPlaceAction, places: Place[], at = new Date()) {
  const { group, activity, writable, canEdit } = getActivityPlacesContext(state, userId, action, at);
  if (!writable) throw new Error('지난 약속·취소·보관된 공간의 장소는 변경할 수 없어요.');
  if (activity.revision !== action.expectedRevision) throw new Error('약속이 바뀌었어요. 현재 장소를 확인하고 다시 선택해 주세요.');
  if (action.type !== 'ADD_CANDIDATE' && !canEdit) throw new Error('이 약속의 편집자만 장소와 방문 순서를 확정할 수 있어요.');
  const catalog = publicCatalog(places);
  const resolve = (id: string) => {
    const place = catalog.get(id) || activity.journey?.days.flatMap(day => day.places).find(item => item.id === id);
    if (!place) throw new Error('현재 공개 장소나 이 약속의 방문 장소를 다시 선택해 주세요.');
    return place;
  };
  let changed = false;
  if (action.type === 'ADD_CANDIDATE') {
    resolve(action.placeId);
    if (!(activity.placeCandidateIds ?? []).includes(action.placeId)) {
      if ((activity.placeCandidateIds?.length ?? 0) >= 40) throw new Error('약속 후보는 최대 40곳까지 담을 수 있어요.');
      activity.placeCandidateIds = [...(activity.placeCandidateIds ?? []), action.placeId]; changed = true;
    }
  } else if (action.type === 'REMOVE_CANDIDATE') {
    if (activity.placeCandidateIds?.includes(action.placeId)) { activity.placeCandidateIds = activity.placeCandidateIds.filter(id => id !== action.placeId); changed = true; }
  } else if (action.type === 'SET_VENUE') {
    const place = action.placeId ? resolve(action.placeId) : undefined;
    if (activity.venuePlaceId !== action.placeId) {
      activity.venuePlaceId = action.placeId;
      activity.meetingPoint = place ? [place.name, place.address || place.area].filter(Boolean).join(' · ') : '';
      changed = true;
    }
  } else if (action.type === 'ADD_STOP') {
    const place = resolve(action.placeId);
    const journey = activity.journey || newJourney(activity, memberName(state, userId, group.id), group.region);
    const day = action.dayId ? journey.days.find((item, index) => activityDayKey(item, index) === action.dayId) : journey.days[0];
    if (!day) throw new Error('방문 장소를 추가할 DAY를 다시 선택해 주세요.');
    if (day.places.length >= 30) throw new Error('하루 방문 장소는 최대 30곳까지 담을 수 있어요.');
    const visit = sharedVisit(place);
    day.places.push(visit); day.blocks.push({ id: togetherId('block'), type: 'PLACE', placeId: visit.id, visitId: visit.visitId });
    journey.cover ||= visit.image; activity.journey = journey; changed = true;
  } else {
    const day = activity.journey?.days.find((item, index) => activityDayKey(item, index) === action.dayId);
    const index = day?.places.findIndex(item => item.visitId === action.visitId) ?? -1;
    if (!day || index < 0) throw new Error('이 DAY의 방문 장소를 다시 선택해 주세요.');
    const place = day.places[index];
    if (place.bookingFixed) throw new Error('고정한 방문 장소예요. 기존 일정 편집에서 예약을 확인한 뒤 변경해 주세요.');
    if (action.type === 'REMOVE_STOP') {
      day.places.splice(index, 1); day.blocks = day.blocks.filter(item => item.type !== 'PLACE' || item.visitId !== action.visitId); changed = true;
    } else if (action.type === 'MOVE_STOP') {
      if (action.direction !== -1 && action.direction !== 1) throw new Error('이동할 방문 순서를 다시 선택해 주세요.');
      const next = index + action.direction;
      if (next < 0 || next >= day.places.length) return;
      if (day.places[next].bookingFixed) throw new Error('고정한 방문 장소의 순서는 기존 일정 편집에서 확인해 주세요.');
      [day.places[index], day.places[next]] = [day.places[next], day.places[index]];
      const positions = new Map(day.places.map((item, position) => [item.visitId, position]));
      const blocks = day.blocks.filter(item => item.type === 'PLACE').sort((a, b) => (positions.get(a.visitId) ?? Infinity) - (positions.get(b.visitId) ?? Infinity));
      let cursor = 0; day.blocks = day.blocks.map(item => item.type === 'PLACE' ? blocks[cursor++] : item); changed = true;
    } else throw new Error('지원하지 않는 장소 변경이에요.');
  }
  if (changed) activity.revision++;
}

/** Stable IDs first; legacy options are linked only by a unique, exact name-and-address label. */
export function resolveScopedPollPlace(state: TogetherState, userId: string, poll: TogetherPoll, optionId: string, places: Place[]): Place | undefined {
  const group = state.groups.find(item => item.id === poll.groupId);
  if (!group || !state.members.some(item => item.id === userId) || !group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) return;
  const activity = poll.activityId ? state.activities.find(item => item.id === poll.activityId && item.groupId === group.id) : undefined;
  if (poll.activityId && !activity || group.spaceType === 'ACTIVITY' && !activity) return;
  const option = poll.options.find(item => item.id === optionId);
  if (!option) return;
  const catalog = publicCatalog(places);
  if (option.placeId) return catalog.get(option.placeId) || activity?.journey?.days.flatMap(day => day.places).find(place => place.id === option.placeId);
  const ids = new Set(activity ? [...(activity.placeCandidateIds ?? []), ...(activity.venuePlaceId ? [activity.venuePlaceId] : []), ...(activity.journey?.days.flatMap(day => day.places.map(place => place.id)) ?? [])] : group.interestPlaceIds ?? []);
  const matches = [...ids].flatMap(id => { const place = catalog.get(id); return place && option.label === `${place.name} · ${place.address || place.area}` ? [place] : []; });
  return matches.length === 1 ? matches[0] : undefined;
}
