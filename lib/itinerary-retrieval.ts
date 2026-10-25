import type { ChatRequest } from './chat-contract';
import type { RagRetrieval } from './rag-types';
import { currentTrip } from './trip-engine';
import { places, REGIONS } from './trip-data';
import { namedKnowledgePlaceIds } from './rag-catalog';
import { requestsMorningAfternoonVisits } from './itinerary-selection';
import { placeMapCoordinates } from './trip-map-data';

export type RetrievalCoverage = {
  sufficient: boolean;
  reason: 'not-required' | 'covered' | 'missing-evidence' | 'too-few-places' | 'outside-corpus' | 'missing-requested-place' | 'missing-requested-theme';
};

function requestedDestinationText(text: string) {
  let active = text;
  const exclusions = [...text.matchAll(/(?:말고|대신(?:에)?|빼고|빼줘|빼주세요|제외(?:하고|한|해줘|해주세요|해)|제외(?=$|[\s,.!?]))/g)];
  for (const match of exclusions.reverse()) {
    const prefix = text.slice(0, match.index);
    // "빼지 말고" and "제외하지 말고" explicitly retain a destination.
    if (/(?:빼지|제외하지)(?:는)?\s*$/.test(prefix)) continue;
    const category = '(?:식당|식사|음식점|카페|숙소|숙박|호텔)(?:\\s*추천)?';
    const categoryTarget = prefix.match(new RegExp(`${category}(?:(?:은|는|을|를|와|과|랑|하고|및|,|·|/|\\s)*${category})*(?:은|는|을|를|도|만)?(?:\\s*(?:전부|모두|다))*\\s*$`));
    // "우도는 꼭 포함해줘. 식당·카페·숙소는 빼줘" excludes those
    // categories, not a named destination earlier in the request. A directly
    // connected mixed list ("우도와 식당은 빼줘") still excludes the place.
    if (categoryTarget) {
      const beforeCategories = prefix.slice(0, categoryTarget.index);
      const connectedList = /(?:와|과|랑|하고|및|[,·/])\s*$/.test(beforeCategories) &&
        !/(?:해줘|해주세요|해주고|해주시고|넣고|포함하고|넣어줘|넣어주고|알려줘)[\s,·/]*$/.test(beforeCategories);
      if (!connectedList) continue;
    }
    const clauseStart = Math.max(0, ...[...prefix.matchAll(/[.!?。！？;\n]/g)].map(boundary => boundary.index + 1));
    const suffixStart = Math.max(clauseStart, prefix.length - 100);
    let start: number | undefined;
    // Find the shortest named suffix, including aliases such as 한라산. This
    // keeps an earlier region/duration in an unspaced sentence intact.
    for (let index = prefix.length - 1; index >= suffixStart; index--) {
      if (namedKnowledgePlaceIds(prefix.slice(index)).length) { start = index; break; }
    }
    while (start !== undefined) {
      const connector = prefix.slice(0, start).match(/(?:과|와|랑|하고|및|,)\s*$/);
      if (!connector) break;
      const end = start - connector[0].length;
      let previous: number | undefined;
      for (let index = end - 1; index >= Math.max(clauseStart, end - 100); index--) {
        if (namedKnowledgePlaceIds(prefix.slice(index, end)).length) { previous = index; break; }
      }
      if (previous === undefined) break;
      start = previous;
    }
    if (start === undefined) {
      const target = prefix.match(/(?:제주(?:도)?|서울(?:시)?|당일|(?:[1-3]\s*박\s*)?[1-3]\s*일)(?:은|는|이|가|을|를)?\s*$/);
      if (target) start = prefix.length - target[0].length;
    }
    if (start !== undefined)
      active = active.slice(0, start) + ' '.repeat(match.index + match[0].length - start) + active.slice(match.index + match[0].length);
  }
  return active;
}

export function itineraryRequest(request: ChatRequest) {
  const text = request.action.type === 'message' ? request.action.text : '';
  const negated = /(?:일정|코스).{0,12}(?:만들지|짜지|생성하지|구성하지)|(?:만들|짜|생성|구성).{0,5}(?:말고|마세요|마\b)/.test(text);
  const requested = !negated && /(?:일정|코스|여행|\d\s*박\s*\d\s*일)/.test(text) && /만들|짜\s*(?:줘|주|줄|고)|짜줘|구성|배치|계획해|넣어/.test(text);
  const state = currentTrip(request.session);
  const destinations = requestedDestinationText(text);
  const duration = [...destinations.matchAll(/(?<!\d)(?:(\d{1,2})\s*박\s*)?(\d{1,2})\s*일(?!\s*(?:차|째))|당일/g)].at(-1);
  const days = duration ? (duration[0] === '당일' ? 1 : Number(duration[2])) : state.days;
  const namedPlaceIds = [...new Set([...namedKnowledgePlaceIds(destinations), ...places.filter(place => destinations.replace(/\s/g,'').includes(place.name.replace(/\s/g,''))).map(place=>place.id)])].filter(id => places.some(p => p.id === id));
  const regions = [...destinations.matchAll(new RegExp(REGIONS.join('|'), 'g'))].filter(match =>
    !/^(?:도|시)?(?:에서부터|에서|부터|서)?\s*출발/.test(destinations.slice(match.index + match[0].length)),
  );
  const explicitRegion = regions.at(-1)?.[0] ?? namedPlaceIds.map(id => places.find(p => p.id === id)?.region).at(-1) ?? state.region;
  const outsideNames = '속초|여수|전주|대전|대구|광주|인천|울릉|독도|울산|부여|공주|양양|춘천|통영|거제|남해|일본|도쿄|오사카|후쿠오카|파리|런던|뉴욕|방콕|다낭|베트남|대만|홍콩';
  // A supported departure or rejected destination does not authorize a trip to
  // another region. Only an explicit exclusion removes an outside destination.
  const requestedDestinations = text.replace(new RegExp(`(?:${outsideNames})(?:은|는|이|가|을|를)?\\s*(?:말고|대신(?:에)?|빼고|제외(?:하고|한|해줘|해주세요|해)?)`, 'g'), '');
  const outsideCorpus = new RegExp(outsideNames).test(requestedDestinations);
  return { requested, days, daysSpecified: Boolean(duration), namedPlaceIds, region: explicitRegion, outsideCorpus };
}

/** Search the current region and stated interests, never a fixed itinerary. */
export function itineraryRetrievalScope(request: ChatRequest) {
  const needs = itineraryRequest(request);
  const text = request.action.type === 'message' ? request.action.text : '';
  const morningAfternoon = requestsMorningAfternoonVisits(text);
  const eligible = places.filter(place => (!needs.region || place.region === needs.region) &&
    (!morningAfternoon || place.planning?.dayScope !== 'full-day' || needs.namedPlaceIds.includes(place.id)));
  // A named landmark is already prioritized separately. Its name alone should
  // not turn the rest of a trip into a thematic restriction.
  let interests = text;
  for (const id of needs.namedPlaceIds) {
    const name = places.find(place => place.id === id)?.name;
    if (name) interests = interests.replaceAll(name, ' ');
  }
  interests = interests.replace(/(?:바다|해변|해안|숲길|숲)(?:은|는|을|를)?\s*(?:말고|빼고|제외(?:하고|해줘)?)/g, ' ');
  interests = interests.replace(/(바다|해변|해안)(와|과|랑|하고|및)(?=숲)/g, '$1 $2 ');
  const themes = [
    { name: '바다·해안', requested: /바다|(?<![가-힣])해변|(?<![가-힣])해안/.test(interests), matches: /바다|해변|해수욕|해안/, description: false },
    { name: '숲', requested: /(?<![가-힣])숲(?:길)?(?:$|[\s,.·와과랑을이도]|하고|및|위주|중심)|삼림|산림/.test(interests), matches: /숲|삼나무|비자나무|곶자왈/, description: true },
  ].filter(theme => theme.requested).map(theme => ({
    name: theme.name,
    placeIds: eligible.filter(place => theme.matches.test([place.name, ...place.tags, ...(theme.description ? [place.description] : [])].join(' '))).map(place => place.id),
  }));
  const themed = new Set(themes.flatMap(theme => theme.placeIds));
  const allowedPlaceIds = eligible.filter(place => !themes.length || themed.has(place.id) || needs.namedPlaceIds.includes(place.id)).map(place => place.id);
  return { allowedPlaceIds, themes, morningAfternoon };
}

export function assessRetrievalCoverage(request: ChatRequest, retrieval?: RagRetrieval, retrievalStatus?: string): RetrievalCoverage {
  const needs = itineraryRequest(request);
  if (needs.outsideCorpus) return { sufficient: false, reason: 'outside-corpus' };
  if (retrievalStatus === 'not-needed') return { sufficient: true, reason: 'not-required' };
  if (!retrieval?.results.length) return { sufficient: false, reason: 'missing-evidence' };
  const scope = needs.requested ? itineraryRetrievalScope(request) : null;
  const allowed = scope ? new Set(scope.allowedPlaceIds) : null;
  const ids = new Set(retrieval.results.map(r => r.placeId).filter(id => !allowed || allowed.has(id)));
  if (needs.namedPlaceIds.some(id => !ids.has(id))) return { sufficient: false, reason: 'missing-requested-place' };
  if (!needs.requested) return { sufficient: true, reason: 'covered' };
  if (scope?.themes.some(theme => !theme.placeIds.some(id => ids.has(id))))
    return { sufficient: false, reason: 'missing-requested-theme' };
  // A full-day destination consumes both illustrative day slots. This is a
  // planning constraint, not a claim about opening hours or actual travel time.
  const capacity = [...ids].reduce((sum, id) => {
    const place = places.find(p => p.id === id);
    return sum + (place && (!needs.region || place.region === needs.region) ? (place.planning?.dayScope === 'full-day' ? 2 : 1) : 0);
  }, 0);
  return capacity >= needs.days * 2 ? { sufficient: true, reason: 'covered' } : { sufficient: false, reason: 'too-few-places' };
}

export function itineraryEvidenceCandidates(retrieval?: RagRetrieval, request?: ChatRequest) {
  const allowed = request && itineraryRequest(request).requested ? new Set(itineraryRetrievalScope(request).allowedPlaceIds) : null;
  const candidates = [...new Set(retrieval?.results.map(r => r.placeId) ?? [])].flatMap(id => {
    const place = places.find(p => p.id === id);
    const point = Object.hasOwn(placeMapCoordinates, id) ? placeMapCoordinates[id] : undefined;
    return place && (!allowed || allowed.has(id)) ? [{ id: place.id, name: place.name, region: place.region, area: place.area, tags: place.tags,
      dayScope: place.planning?.dayScope ?? 'half-day',
      ...(place.planningNote ? { planningNote: place.planningNote } : {}),
      ...(point ? { representativeLocation: { latitude: point.latitude, longitude: point.longitude } } : {}),
      evidenceIds: retrieval!.results.flatMap((r, i) => r.placeId === id ? [`ref${i + 1}`] : []),
    }] : [];
  });
  return candidates.map(candidate => {
    const origin = candidate.representativeLocation;
    if (!origin) return candidate;
    // These are only distances between public landmark representative points
    // already retrieved for this request. No user location, geocoder or routing
    // service is involved, and the model still chooses every day and visit.
    const nearbyCandidates = candidates.flatMap(other => {
      const destination = other.representativeLocation;
      if (other.id === candidate.id || !destination) return [];
      const radians = Math.PI / 180;
      const latitude = (destination.latitude - origin.latitude) * radians;
      const longitude = (destination.longitude - origin.longitude) * radians;
      const arc = Math.sin(latitude / 2) ** 2 + Math.cos(origin.latitude * radians) *
        Math.cos(destination.latitude * radians) * Math.sin(longitude / 2) ** 2;
      const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)));
      return [{ placeId: other.id, straightLineKm: Math.round(distanceKm * 10) / 10 }];
    }).sort((first, second) => first.straightLineKm - second.straightLineKm || first.placeId.localeCompare(second.placeId)).slice(0, 3);
    return { ...candidate, nearbyCandidates };
  });
}
