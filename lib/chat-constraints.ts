import type { ChatRequest } from './chat-contract';
import type { TripAction, TripState } from './trip-engine';
import { itineraryRequest } from './itinerary-retrieval';
import { requestsMorningAfternoonVisits } from './itinerary-selection';
import { findPlace } from './trip-data';

function dailyVisitConstraints(request: ChatRequest) {
  if (request.action.type !== 'message' || !requestsMorningAfternoonVisits(request.action.text)) return;
  return { fullDayIds: itineraryRequest(request).namedPlaceIds.filter(id => findPlace(id)?.planning?.dayScope === 'full-day') };
}

/** Reject an incomplete model selection; never manufacture missing stops from the catalog. */
export function explicitBuildVisitViolation(request: ChatRequest, action: TripAction, state: TripState): string | undefined {
  if (action.type !== 'build' || !action.visits) return;
  const constraints = dailyVisitConstraints(request);
  if (!constraints) return;
  const selectedIds = new Set(action.visits.map(visit => visit.placeId));
  if (constraints.fullDayIds.some(id => !selectedIds.has(id)))
    return '직접 지정한 종일 방문지를 누락하지 않고 단독 일정으로 배치해야 해요.';
  for (let day = 1; day <= state.days; day++) {
    const visits = action.visits.filter(visit => visit.day === day);
    const fullDay = visits.filter(visit => findPlace(visit.placeId)?.planning?.dayScope === 'full-day');
    if (fullDay.length) {
      if (visits.length !== 1 || !constraints.fullDayIds.includes(fullDay[0].placeId))
        return '오전·오후에 한 곳씩 요청한 일정에 지정하지 않은 종일 방문지를 넣을 수 없어요.';
    } else if (visits.length !== 2) {
      return '오전·오후에 한 곳씩 요청한 일정은 각 날짜에 검증된 방문지 두 곳이 필요해요.';
    }
  }
}

export function explicitFullDayScheduleNotice(request: ChatRequest, state: TripState): string | undefined {
  const constraints = dailyVisitConstraints(request);
  if (!constraints) return;
  const names = [...new Set(state.plan.filter(visit => visit.kind === 'place' && visit.entityId && constraints.fullDayIds.includes(visit.entityId)).map(visit => findPlace(visit.entityId!)!.name))];
  if (!names.length) return;
  return `직접 지정한 ${names.join('·')} 방문일은 종일 일정으로 잡아, 그날은 오전·오후 두 곳 대신 한 곳만 배치했어요.`;
}

// Preserve clear human duration/exclusions when a model omits configure fields.
// This only refines a build the model already requested.
export function explicitBuildConstraints(request: ChatRequest, actions: TripAction[]) {
  if (request.action.type !== 'message' || !actions.some((action) => action.type === 'build')) return actions;
  const text = request.action.text.replace(/\s+/g, '');
  const needs = itineraryRequest(request);
  const constraints: Omit<Extract<TripAction, { type: 'configure' }>, 'type'> = {};
  if (needs.daysSpecified) constraints.days = needs.days;
  const category = '(?:(?:식당|식사|음식점|카페|숙소|숙박|호텔)(?:추천)?|다른장소|미정방문)(?:은|는|을|를|도|만)?';
  const exclusions = new RegExp(`(${category}(?:(?:와|과|랑|하고|및|이나|나|,|·|/)*${category})*)(?:(?:전부|모두)다?|다)?(?:빼줘|빼주세요|빼고|제외해줘|제외해주세요|제외하고|제외한|넣지마(?:세요)?|넣지말아줘|넣지말아주세요|추가하지마(?:세요)?|추가하지말아줘|추가하지말아주세요|필요없어(?:요)?)`, 'g');
  for (const match of text.matchAll(exclusions)) {
    if (/식당|식사|음식점/.test(match[1])) constraints.meals = false;
    if (/카페/.test(match[1])) constraints.cafes = false;
    if (/숙소|숙박|호텔/.test(match[1])) constraints.lodging = false;
  }
  if (!Object.keys(constraints).length) return actions;
  const result = actions.map((action) => action.type === 'configure' ? { ...action, ...constraints } : action);
  const build = result.findIndex((action) => action.type === 'build');
  const configure = result.slice(0, build).findLastIndex((action) => action.type === 'configure');
  if (configure < 0) result.splice(build, 0, { type: 'configure', ...constraints });
  return result;
}
