import type { Place } from '../data';
import { roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';
import { koreaDay } from './discovery.ts';

export interface PlaceProposalTarget { groupId: string; activityId?: string }
export interface PlaceProposalDestination extends PlaceProposalTarget { label: string }
export interface PlaceProposalPreview { id: string; name: string; kind: string; area: string; address: string; description: string }
const kinds: Record<Place['kind'], string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const clean = (value: string, length: number) => String(value || '').trim().slice(0, length);

/** The sharing preview contains deliberately chosen venue facts, never visit/booking/private-note fields. */
export function placeProposalPreview(place: Place): PlaceProposalPreview {
  if (!place.id || !place.name?.trim() || !kinds[place.kind]) throw new Error('공유할 장소를 다시 선택해 주세요.');
  return { id: place.id, name: clean(place.name, 160), kind: kinds[place.kind], area: clean(place.area, 100),
    address: clean(place.address, 300), description: clean(place.description, 500) };
}
export const placeProposalVersion = (place: Place) => JSON.stringify(placeProposalPreview(place));
export function placeProposalBody(place: Place): string {
  const value = placeProposalPreview(place);
  return [`장소 제안 · ${value.name}`, [value.kind, value.area].filter(Boolean).join(' · '), value.address, value.description].filter(Boolean).join('\n');
}

export function placeProposalDestinations(state: TogetherState, actorId: string, at = new Date()): PlaceProposalDestination[] {
  if (!actorId || !state.members.some(member => member.id === actorId)) return [];
  return state.groups.filter(group => !group.archived && group.memberIds.includes(actorId) && !group.blockedMemberIds?.includes(actorId)).flatMap(group => {
    const activities = state.activities.filter(activity => activity.groupId === group.id && activity.status === 'PLANNED'
      && (!(activity.endDate || activity.date) || (activity.endDate || activity.date) >= koreaDay(at)));
    return [
      ...(group.spaceType === 'ACTIVITY' ? [] : [{ groupId: group.id, label: `${group.name} · 모임 전체 대화` }]),
      ...activities.map(activity => ({ groupId: group.id, activityId: activity.id, label: `${activity.title} · ${group.spaceType === 'ACTIVITY' ? '약속 대화' : group.name}` })),
    ];
  });
}

/** An explicit proposal is one idempotent message. It never changes attendance, venue, routes or personal saves. */
export function proposeSavedPlace(state: TogetherState, actorId: string, target: PlaceProposalTarget, place: Place,
  expectedPlaceVersion: string, requestId: string, publicPlaceIds: ReadonlyArray<string>, at = new Date()): string {
  if (!requestId || requestId.length > 160 || !/^[A-Za-z0-9_-]+$/.test(requestId)) throw new Error('공유 요청을 다시 확인해 주세요.');
  if (expectedPlaceVersion !== placeProposalVersion(place)) throw new Error('장소 정보가 바뀌었어요. 내용을 다시 확인한 뒤 제안해 주세요.');
  const destination = placeProposalDestinations(state, actorId, at).find(item => item.groupId === target.groupId && item.activityId === target.activityId);
  if (!destination) throw new Error('이 모임이나 약속에 지금 제안할 수 없어요. 현재 참여 상태를 다시 확인해 주세요.');
  const roomId = target.activityId ? roomIdForActivity(target.activityId) : roomIdForGroup(target.groupId);
  const id = `place-proposal:${requestId}`, body = placeProposalBody(place);
  const previous = state.messages.find(message => message.id === id);
  if (previous) {
    if (previous.authorId !== actorId || previous.roomId !== roomId || previous.body !== body || previous.deleted) throw new Error('다른 제안에 사용된 요청이에요. 다시 열어 주세요.');
    return roomId;
  }
  state.messages.push({ id, roomId, authorId: actorId, body, createdAt: at.toISOString() });
  // Only current public catalogue IDs become reusable common candidates. Personal venue facts stay in this explicit message.
  if (!target.activityId && !place.personal && publicPlaceIds.includes(place.id)) {
    const group = state.groups.find(item => item.id === target.groupId)!;
    group.interestPlaceIds = [...new Set([...(group.interestPlaceIds ?? []), place.id])];
  }
  return roomId;
}
