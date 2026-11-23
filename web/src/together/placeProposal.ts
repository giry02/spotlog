import type { Place } from '../data';
import { isMember, roomIdForActivity, roomIdForGroup, type ChatPlaceProposalReference, type TogetherMessage, type TogetherState } from './model.ts';
import { koreaDay } from './discovery.ts';
import { applyActivityPlaceAction } from './activityPlaces.ts';

export interface PlaceProposalTarget { groupId: string; activityId?: string }
export interface PlaceProposalDestination extends PlaceProposalTarget { label: string }
export interface PlaceProposalPreview { id: string; name: string; kind: string; area: string; address: string; description: string }
export interface ChatPlaceProposal { name: string; area: string; body: string; place?: Place }
const proposalIdPrefix = 'place-proposal:';
const proposalTitlePrefix = '장소 제안 · ';
const proposalFieldSeparator = ' · ';
const requestIdPattern = /^[A-Za-z0-9_-]{1,160}$/u;
const kinds: Record<Place['kind'], string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const proposalKinds = new Set(Object.values(kinds));
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
  return [proposalTitlePrefix + value.name, [value.kind, value.area].filter(Boolean).join(proposalFieldSeparator), value.address, value.description].filter(Boolean).join('\n');
}

export function isChatPlaceProposalReference(value: unknown): value is ChatPlaceProposalReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reference = value as Record<string, unknown>;
  return typeof reference.name === 'string' && reference.name.length > 0 && reference.name.length <= 160
    && reference.name === reference.name.trim() && !/[\r\n]/u.test(reference.name)
    && (reference.publicPlaceId === undefined || typeof reference.publicPlaceId === 'string' && reference.publicPlaceId.trim().length > 0)
    && Object.keys(reference).every(key => key === 'name' || key === 'publicPlaceId');
}

function proposalText(body: string): ChatPlaceProposal | null {
  if (!body.startsWith(proposalTitlePrefix)) return null;
  const lines = body.split('\n');
  const name = lines[0].slice(proposalTitlePrefix.length).trim();
  if (!name || name.length > 160 || name.includes('\r')) return null;
  const metadata = lines[1] ?? '';
  const separator = metadata.indexOf(proposalFieldSeparator);
  const area = separator !== -1 && proposalKinds.has(metadata.slice(0, separator))
    ? clean(metadata.slice(separator + proposalFieldSeparator.length), 100)
    : '';
  return { name, area, body: lines.slice(1).join('\n') };
}

/** Resolve the current room's original proposal. Older messages get a live venue only on an exact, unique public match. */
export function readChatPlaceProposal(state: TogetherState, actorId: string, roomId: string, message: TogetherMessage, places: readonly Place[]): ChatPlaceProposal | null {
  if (message.roomId !== roomId || message.deleted || message.entity || message.stickerId || !message.id.startsWith(proposalIdPrefix)
    || !requestIdPattern.test(message.id.slice(proposalIdPrefix.length))) return null;
  const originals = state.messages.filter(item => item.id === message.id);
  const original = originals[0];
  if (originals.length !== 1 || original.roomId !== roomId || original.deleted || original.entity || original.stickerId) return null;
  const activity = state.activities.find(item => roomIdForActivity(item.id) === roomId);
  const group = activity
    ? state.groups.find(item => item.id === activity.groupId)
    : state.groups.find(item => roomIdForGroup(item.id) === roomId);
  if (!group || group.spaceType === 'ACTIVITY' && !activity || !isMember(state, actorId, group.id)
    || group.blockedMemberIds?.includes(actorId) || !state.members.some(item => item.id === actorId)) return null;
  const shared = proposalText(original.body);
  if (!shared) return null;
  const reference = original.placeProposal;
  if (reference !== undefined) {
    if (!isChatPlaceProposalReference(reference) || reference.name !== shared.name) return null;
    // A typed personal proposal stays a snapshot even if a similarly named public venue exists.
    const place = reference.publicPlaceId ? places.find(item => item.id === reference.publicPlaceId && !item.personal) : undefined;
    return place ? { ...shared, place } : shared;
  }
  const matches = new Map(places.filter(place => !place.personal && place.id && place.name?.trim() && kinds[place.kind]
    && placeProposalBody(place) === original.body).map(place => [place.id, place]));
  const place = matches.size === 1 ? matches.values().next().value : undefined;
  return place ? { ...shared, place } : shared;
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

/** An explicit public proposal also holds its exact ID in the chosen space. Venue, visits and RSVP need separate confirmation. */
export function proposeSavedPlace(state: TogetherState, actorId: string, target: PlaceProposalTarget, place: Place,
  expectedPlaceVersion: string, requestId: string, publicPlaceIds: ReadonlyArray<string>, at = new Date()): string {
  if (typeof requestId !== 'string' || !requestIdPattern.test(requestId)) throw new Error('공유 요청을 다시 확인해 주세요.');
  if (expectedPlaceVersion !== placeProposalVersion(place)) throw new Error('장소 정보가 바뀌었어요. 내용을 다시 확인한 뒤 제안해 주세요.');
  const destination = placeProposalDestinations(state, actorId, at).find(item => item.groupId === target.groupId && item.activityId === target.activityId);
  if (!destination) throw new Error('이 모임이나 약속에 지금 제안할 수 없어요. 현재 참여 상태를 다시 확인해 주세요.');
  const roomId = target.activityId ? roomIdForActivity(target.activityId) : roomIdForGroup(target.groupId);
  const id = proposalIdPrefix + requestId, body = placeProposalBody(place);
  const shared = proposalText(body);
  if (!shared) throw new Error('공유할 장소 이름을 다시 확인해 주세요.');
  const publicPlaceId = !place.personal && publicPlaceIds.includes(place.id) ? place.id : undefined;
  const previous = state.messages.find(message => message.id === id);
  if (previous) {
    const previousPublicId = previous.placeProposal?.publicPlaceId;
    const differentPlace = previousPublicId ? place.personal || previousPublicId !== place.id : previous.placeProposal && publicPlaceId;
    if (previous.authorId !== actorId || previous.roomId !== roomId || previous.body !== body || previous.deleted || differentPlace) {
      throw new Error('다른 제안에 사용된 요청이에요. 다시 열어 주세요.');
    }
    return roomId;
  }
  // Only current public catalogue IDs become reusable common candidates. Personal venue facts stay in this explicit message.
  if (publicPlaceId) {
    if (target.activityId) {
      const activity = state.activities.find(item => item.id === target.activityId && item.groupId === target.groupId)!;
      applyActivityPlaceAction(state, actorId, { groupId: target.groupId, activityId: activity.id, expectedRevision: activity.revision, type: 'ADD_CANDIDATE', placeId: place.id }, [place], at);
    } else {
      const group = state.groups.find(item => item.id === target.groupId)!;
      group.interestPlaceIds = [...new Set([...(group.interestPlaceIds ?? []), place.id])];
    }
  }
  state.messages.push({ id, roomId, authorId: actorId, body, createdAt: at.toISOString(),
    placeProposal: { name: shared.name, ...(publicPlaceId ? { publicPlaceId } : {}) } });
  return roomId;
}
