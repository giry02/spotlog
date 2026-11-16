import type { Journey, Place } from '../data';
import { isPublicJournal } from '../journalVisibility.ts';
import { resolvePlacePhotos } from '../placePhotos.ts';
import { isShareableJourney, memberName, togetherId, type TogetherState } from './model.ts';
import { createTemporaryRoom } from './temporaryRooms.ts';

export interface OutingRecipePreview {
  sourceId: string; title: string; region: string; dayPlaceIds: string[][]; placeNames: string[][];
  cover: string; dayCount: number; placeCount: number; version: string;
}
export interface OutingRecipeInput {
  requestId: string; title: string; date: string; groupId?: string; consent: boolean;
}
export const OUTING_RECIPE_TITLE_LIMIT = 80;
const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
const addDay = (day: string, offset: number) => day ? new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10) : '';

/** Synchronous SHA-256 for opaque retry keys, not identity or authorization. No source text is stored in IDs. */
function opaqueFingerprint(text: string): string {
  const bytes = new TextEncoder().encode(text), padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(padded.length - 4, bytes.length * 8 >>> 0);
  const values = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const constants = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const rotate = (value: number, bits: number) => value >>> bits | value << 32 - bits;
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const left = words[i - 15], right = words[i - 2];
      words[i] = (words[i - 16] + (rotate(left, 7) ^ rotate(left, 18) ^ left >>> 3) + words[i - 7] + (rotate(right, 17) ^ rotate(right, 19) ^ right >>> 10)) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = values;
    for (let i = 0; i < 64; i++) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + constants[i] + words[i]) >>> 0;
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c)) >>> 0;
      h = g; g = f; f = e; e = d + first >>> 0; d = c; c = b; b = a; a = first + second >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => { values[index] = values[index] + value >>> 0; });
  }
  return values.map(value => value.toString(16).padStart(8, '0')).join('');
}
/** Compare the complete copied payload while ignoring only freshly generated object IDs. */
function copiedJourneyFacts(journey: Journey | undefined): string {
  if (!journey) return '';
  const { id: _id, days, ...fields } = journey;
  return JSON.stringify({ ...fields, days: days.map(day => {
    const { dayId: _dayId, places, blocks, ...dayFields } = day;
    return { ...dayFields, places: places.map(place => { const { visitId: _visitId, ...placeFields } = place; return placeFields; }),
      blocks: blocks.map(block => { const { id: _blockId, visitId, ...blockFields } = block; return { ...blockFields, visitIndex: places.findIndex(place => place.visitId === visitId) }; }) };
  }) });
}

/** Only the current catalogue and the reviewed order form a recipe. Never copy journal text or private photos. */
export function prepareOutingRecipe(source: Journey, places: Place[]): OutingRecipePreview {
  if (!source || !isShareableJourney(source) || source.planStage === 'DRAFT' || source.businessCandidates?.length || !source.isMine && !isPublicJournal(source)
    || source.isMine && source.purpose === 'JOURNAL' && source.status !== 'PUBLISHED') throw new Error('현재 공개된 코스나 완성한 내 일정에서 다시 선택해 주세요.');
  if (!source.days.length || source.days.length > 31 || !source.days.some(day => day.places.length) || source.days.some(day => day.places.length > 100)) throw new Error('함께할 장소가 있는 코스를 선택해 주세요.');
  const catalogue = new Map(places.filter(place => !place.personal && place.id && place.name.trim()).map(place => [place.id, place]));
  const current = source.days.map(day => day.places.map(place => {
    const found = catalogue.get(place.id);
    if (!found || place.personal) throw new Error('현재 공개 장소에서 찾을 수 없는 방문이 있어요. 원본 코스를 먼저 확인해 주세요.');
    return found;
  }));
  const facts = current.map(day => day.map(place => ({ id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address,
    lat: place.lat, lng: place.lng, locationVerified: place.locationVerified, description: place.description, duration: place.duration,
    photos: resolvePlacePhotos(place, [], true) })));
  return { sourceId: source.id, title: source.title, region: source.region, dayPlaceIds: current.map(day => day.map(place => place.id)),
    placeNames: current.map(day => day.map(place => place.name)), cover: facts.flat()[0]?.photos[0]?.image || '',
    dayCount: source.days.length, placeCount: current.flat().length,
    version: JSON.stringify({ id: source.id, title: source.title, region: source.region, owned: source.isMine, visibility: source.visibility, status: source.status, purpose: source.purpose, facts }) };
}

/** New IDs, blank notes, no bookings/locks/progress or historical dates. The source is never mutated. */
export function createOutingFromRecipe(state: TogetherState, actorId: string, reviewed: OutingRecipePreview, currentSource: Journey, input: OutingRecipeInput, places: Place[], now = new Date()): { groupId: string; activityId: string } {
  if (!actorId || !state.members.some(member => member.id === actorId)) throw new Error('로그인한 뒤 함께할 약속을 만들어 주세요.');
  const fresh = prepareOutingRecipe(currentSource, places);
  if (!reviewed || reviewed.sourceId !== fresh.sourceId || reviewed.version !== fresh.version) throw new Error('코스나 장소 정보가 바뀌었어요. 최신 내용을 다시 확인해 주세요.');
  if (!input || !/^[A-Za-z0-9_-]{1,160}$/.test(input.requestId) || typeof input.title !== 'string' || !input.title.trim() || input.title.length > OUTING_RECIPE_TITLE_LIMIT || input.consent !== true) throw new Error('약속 이름은 80자 이내로 적고 동선 사본 공유에 동의해 주세요.');
  if (!Number.isFinite(now.getTime())) throw new Error('현재 시간을 다시 확인해 주세요.');
  if (typeof input.date !== 'string' || input.date && (!validDay(input.date) || input.date < now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }))) throw new Error('오늘 이후 날짜를 선택하거나 날짜 미정으로 남겨 주세요.');
  const destination = input.groupId ? state.groups.find(group => group.id === input.groupId) : undefined;
  if (input.groupId && (!destination || destination.spaceType === 'ACTIVITY' || destination.archived || destination.temporaryRoom || !destination.memberIds.includes(actorId) || destination.blockedMemberIds?.includes(actorId))) throw new Error('현재 참여 중인 모임을 다시 선택해 주세요.');
  const title = input.title.trim();
  const prefix = `recipe-${opaqueFingerprint(JSON.stringify([actorId, input.requestId]))}-`;
  const id = `${prefix}${opaqueFingerprint(JSON.stringify([fresh.version, title, input.date, input.groupId || null]))}`;
  const priorRequests = state.activities.filter(activity => activity.id.startsWith(prefix));
  if (state.activities.some(activity => activity.id === `recipe-${input.requestId}`) || priorRequests.some(activity => activity.id !== id)) throw new Error('같은 요청에 다른 코스나 조건이 저장됐어요. 새로 확인해 주세요.');
  const previous = priorRequests.find(activity => activity.id === id);
  const catalogue = new Map(places.filter(place => !place.personal && place.id && place.name.trim()).map(place => [place.id, place]));
  const days = fresh.dayPlaceIds.map((ids, index) => {
    const selected = ids.map(placeId => {
      const place = catalogue.get(placeId)!, photos = structuredClone(resolvePlacePhotos(place, [], true));
      return { id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address, lat: place.lat, lng: place.lng,
        locationVerified: place.locationVerified, image: photos[0]?.image || '', photos, description: place.description, duration: place.duration,
        note: '', visitId: togetherId('visit'), bookingFixed: false };
    });
    return { dayId: togetherId('day'), day: index + 1, date: addDay(input.date, index), title: `DAY ${index + 1}`, story: '', places: selected,
      blocks: selected.map(place => ({ id: togetherId('block'), type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) };
  });
  const journey: Journey = { id: togetherId('outing'), purpose: 'PLAN', planStage: 'READY', title, region: fresh.region,
    status: 'PLANNING', visibility: 'PRIVATE', cover: fresh.cover, summary: '', story: '', tags: [], saves: 0, author: memberName(state, actorId), isMine: false,
    duration: `${days.length}일`, dateRange: input.date ? `${input.date}${days.length > 1 ? ` ~ ${days.at(-1)!.date}` : ''}` : '', startDate: input.date || undefined, days };
  if (input.date && days.some(day => !validDay(day.date))) throw new Error('선택한 기간의 마지막 날짜를 다시 확인해 주세요.');
  if (previous) {
    const previousGroup = state.groups.find(group => group.id === previous.groupId);
    if (!previousGroup || previousGroup.archived || previousGroup.temporaryRoom?.closedAt || !previousGroup.memberIds.includes(actorId) || previousGroup.blockedMemberIds?.includes(actorId)
      || previous.leadId !== actorId || previous.title !== title || previous.date !== input.date || previous.endDate !== days.at(-1)!.date || previous.status !== 'PLANNED' || previous.revision !== 1
      || previous.kind !== (days.length > 1 ? 'TRIP' : 'MEETUP') || (input.groupId ? previous.groupId !== input.groupId : previousGroup.spaceType !== 'ACTIVITY')
      || copiedJourneyFacts(previous.journey) !== copiedJourneyFacts(journey)) throw new Error('같은 요청의 저장 내용이 달라요. 새로 확인해 주세요.');
    return { groupId: previous.groupId, activityId: previous.id };
  }
  let groupId: string;
  if (destination) {
    groupId = destination.id;
    state.activities.push({ id, groupId, title, date: input.date, endDate: days.at(-1)!.date, description: '', meetingPoint: '', status: 'PLANNED',
      leadId: actorId, editorIds: [], participants: {}, arrivedIds: [], revision: 1, kind: days.length > 1 ? 'TRIP' : 'MEETUP', journey });
  } else {
    const result = createTemporaryRoom(state, actorId, { title, purpose: 'GATHERING', region: fresh.region, date: input.date }, now);
    groupId = result.groupId;
    const activity = state.activities.find(item => item.id === result.activityId)!;
    activity.id = id; activity.journey = journey; activity.endDate = days.at(-1)!.date; activity.kind = days.length > 1 ? 'TRIP' : 'MEETUP';
    state.groups.find(group => group.id === groupId)!.cover = fresh.cover;
  }
  const activity = state.activities.find(item => item.id === id)!;
  activity.placeCandidateIds = [...new Set(fresh.dayPlaceIds.flat())];
  return { groupId, activityId: id };
}
