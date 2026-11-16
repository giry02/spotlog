import type { Place } from '../data';
import { applyActivityPlaceAction } from './activityPlaces.ts';
import { selectAssistantPlaces, type ActivityAssistantScope } from './activityAssistant.ts';
import { getPlanningSupportContext } from './planningSupport.ts';
import type { TogetherState } from './model';

export const planningPlaceRegion = (place: Pick<Place, 'area'>) => place.area.trim().split(/[·,\s]+/)[0] || '';
const normalizedName = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\p{White_Space}\p{Punctuation}\p{Symbol}]/gu, '');
const normalizedAddress = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\p{White_Space}/gu, '');
/** Same label and exact address only. Missing addresses or different chain branches never coalesce. */
export function planningPlaceIdentity(place: Pick<Place, 'name' | 'address'>): string | undefined {
  const name = normalizedName(place.name), address = normalizedAddress(place.address);
  return name && address ? JSON.stringify([name, address]) : undefined;
}
const publicPlaces = (places: Place[]) => [...new Map(places.filter(place => !place.personal && place.id && place.name.trim()).map(place => [place.id, place])).values()];
const hasActivePlaceGallery = (place: Place) => Boolean(place.photos?.some(photo => photo.placeId === place.id && photo.availability !== 'withdrawn' && photo.image.trim() && photo.sourceId?.trim()));

/** Search the current public catalogue; personal saved records are never merged into it. */
export function selectPlanningPlaceCatalogue(places: Place[], query = '', kind: Place['kind'] | 'ALL' = 'ALL', region = '', preferredRegion = '', preferredIds: ReadonlyArray<string> = []) {
  const search = query.trim().toLocaleLowerCase('ko-KR');
  const preferredRanks = new Map(preferredIds.map((id, index) => [id, index]));
  const groups = new Map<string, Place[]>();
  publicPlaces(places).forEach(place => { const key = planningPlaceIdentity(place) ?? `id:${place.id}`; groups.set(key, [...(groups.get(key) ?? []), place]); });
  // Keep an already-shared ID first; otherwise prefer explicit active place photos over a cover-only alias.
  // Choose one intact record: do not combine gallery/source fields from different catalogue identities.
  const catalog = [...groups.values()].map(aliases => ({ aliases, place: [...aliases].sort((a, b) => (preferredRanks.get(a.id) ?? Infinity) - (preferredRanks.get(b.id) ?? Infinity)
    || Number(hasActivePlaceGallery(b)) - Number(hasActivePlaceGallery(a)))[0] }));
  return catalog.filter(({ aliases, place }) => (kind === 'ALL' || place.kind === kind) && (!region || planningPlaceRegion(place) === region) && (!search || aliases.some(alias => [alias.name, alias.area, alias.address].join(' ').toLocaleLowerCase('ko-KR').includes(search))))
    .map(item => item.place)
    .sort((a, b) => Number(Boolean(preferredRegion && planningPlaceRegion(b) === preferredRegion)) - Number(Boolean(preferredRegion && planningPlaceRegion(a) === preferredRegion)));
}

/** Called inside repository.update. Only add a candidate; never change venue, route, RSVP or private saves. */
export function addPlanningPlaceCandidate(state: TogetherState, userId: string, scope: ActivityAssistantScope, placeId: string, expectedRevision: number | undefined, places: Place[], at = new Date()) {
  if (!state.members.some(item => item.id === userId)) throw new Error('현재 계정의 모임 접근 권한을 다시 확인해 주세요.');
  const { group, activity, canWrite } = getPlanningSupportContext(state, userId, scope, at);
  if (!canWrite) throw new Error('지난 약속·취소·보관된 공간에는 새 후보를 담을 수 없어요.');
  const candidate = publicPlaces(places).find(item => item.id === placeId);
  if (!candidate) throw new Error('현재 공개된 장소에서 후보를 다시 선택해 주세요.');
  const shared = selectAssistantPlaces(state, userId, scope, places), identity = planningPlaceIdentity(candidate);
  if (activity) {
    if (!Number.isSafeInteger(expectedRevision)) throw new Error('약속의 현재 내용을 다시 확인해 주세요.');
    if (activity.revision !== expectedRevision) throw new Error('약속이 바뀌었어요. 현재 장소를 확인하고 다시 선택해 주세요.');
    if (identity && shared.some(place => planningPlaceIdentity(place) === identity)) return shared.length;
    applyActivityPlaceAction(state, userId, { ...scope, activityId: activity.id, expectedRevision: expectedRevision!, type: 'ADD_CANDIDATE', placeId }, places, at);
  } else if (!(group.interestPlaceIds ?? []).includes(placeId) && !(identity && shared.some(place => planningPlaceIdentity(place) === identity))) {
    group.interestPlaceIds = [...(group.interestPlaceIds ?? []), placeId];
  }
  return selectAssistantPlaces(state, userId, scope, places).length;
}
