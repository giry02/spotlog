import type { ChatRequest } from './chat-contract';
import { currentTrip, type TripAction, type TripState } from './trip-engine';
import type { RagRetrieval } from './rag-types';
import { itineraryRequest } from './itinerary-retrieval';
import { findPlace } from './trip-data';
import { placeMapCoordinates } from './trip-map-data';

export const NEARBY_GROUPING_NOTICE = '선택한 방문지는 그대로 두고, 공식 대표 좌표의 직선거리 합이 줄도록 같은 날의 장소를 다시 묶었어요. 도로 경로와 이동 참고 시간은 지도에서 별도로 확인해 주세요.';

type BuildAction = Extract<TripAction, { type: 'build' }>;

function distance(firstId: string, secondId: string) {
  const first = placeMapCoordinates[firstId], second = placeMapCoordinates[secondId];
  const radians = Math.PI / 180;
  const latitude = (second.latitude - first.latitude) * radians;
  const longitude = (second.longitude - first.longitude) * radians;
  const arc = Math.sin(latitude / 2) ** 2 + Math.cos(first.latitude * radians) *
    Math.cos(second.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)));
}

function pairings(indices: number[]): number[][][] {
  if (!indices.length) return [[]];
  const [first, ...rest] = indices;
  return rest.flatMap((partner, index) => pairings(rest.filter((_, other) => other !== index))
    .map(pairs => [[first, partner], ...pairs]));
}

/** Only an explicit, unconstrained new build may regroup the same retrieved stops. */
export function regroupExplicitNearbyBuild(
  request: ChatRequest,
  actions: TripAction[],
  action: TripAction,
  state: TripState,
  retrieval?: RagRetrieval,
): { action: BuildAction; notice: string } | undefined {
  if (request.action.type !== 'message' || action.type !== 'build' || !action.visits ||
    !itineraryRequest(request).requested || !retrieval?.results.length) return;
  const text = request.action.text;
  if (!/가까운\s*(?:장소|방문지|곳)(?:들)?끼리\s*(?:같은\s*날(?:로|에)?\s*)?(?:묶어|묶고|배치해)/.test(text) ||
    /묶지|배치하지|최적화하지|가까운.{0,20}(?:말고|하지\s*마)/.test(text)) return;
  // Time/day/order instructions and all reservation contexts take priority.
  // Generic "오전·오후 한 곳씩" is allowed; naming a landmark together with a
  // time of day is conservatively treated as a fixed assignment.
  const needs = itineraryRequest(request);
  if (/DAY\s*[1-3]|[1-3]\s*일\s*차|첫(?:째)?\s*날|둘째\s*날|셋째\s*날|마지막\s*날|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:시|:)|순서|차례|먼저|마지막|그대로|유지|바꾸지|기존|예약|출발|도착/i.test(text) ||
    (needs.namedPlaceIds.length && /오전|오후|아침|점심|저녁/.test(text))) return;
  const previous = currentTrip(request.session);
  if (state.booked || previous.booked || state.plan.some(visit => visit.locked) || previous.plan.some(visit => visit.locked) ||
    actions.some(item => !['region', 'configure', 'build'].includes(item.type)) ||
    actions.filter(item => item.type === 'build').length !== 1 || actions.at(-1)?.type !== 'build') return;
  const visits = action.visits;
  if (visits.length < 4 || visits.length > 6 || visits.length !== state.days * 2 ||
    new Set(visits.map(visit => visit.placeId)).size !== visits.length ||
    Array.from({ length: state.days }, (_, index) => index + 1).some(day => visits.filter(visit => visit.day === day).length !== 2) ||
    visits.some(visit => findPlace(visit.placeId)?.planning?.dayScope === 'full-day' ||
      !Object.hasOwn(placeMapCoordinates, visit.placeId) || !retrieval.results.some(source => source.placeId === visit.placeId))) return;
  const score = (pairs: number[][]) => pairs.reduce((sum, [first, second]) => sum + distance(visits[first].placeId, visits[second].placeId), 0);
  const original = Array.from({ length: state.days }, (_, index) => visits.flatMap((visit, position) => visit.day === index + 1 ? [position] : []));
  let best = original, bestDistance = score(original);
  for (const pairs of pairings(visits.map((_, index) => index))) {
    const candidateDistance = score(pairs);
    if (candidateDistance + 0.05 < bestDistance) {
      best = pairs;
      bestDistance = candidateDistance;
    }
  }
  if (best === original) return;
  // Pair enumeration preserves the first remaining model-selected stop as the
  // next day's first stop. It changes neither the chosen set nor slot counts.
  return {
    action: { ...action, visits: best.flatMap((pair, index) => pair.map(position => ({ ...visits[position], day: index + 1 }))) },
    notice: NEARBY_GROUPING_NOTICE,
  };
}
