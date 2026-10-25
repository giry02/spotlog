import { communityTrips, findCommunityTrip } from './community-trips';
import { places, restaurants, stays, findPlace, findFood, findStay } from './trip-data';
import { resolveSocialTarget, type SocialTarget } from './social-target';
import type { TripState } from './trip-engine';

export type SocialView = 'overview' | 'threads' | 'reactions';
const compact = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
const entities = [...new Map([...places, ...restaurants, ...stays].map(entity => [entity.id, entity])).values()];

export function isExplicitAppSocialRequest(input: string) {
  return /앱(?:에서|으로)|스팟로그에서|spotlog에서/i.test(compact(input));
}

export function socialRequestedView(input: string): SocialView {
  const text = compact(input);
  const threads = /스레드|댓글|답글/.test(text);
  const reactions = /평가|평점|별점|반응|좋아요|응원/.test(text);
  if (/담김|담겼|담아갔|가져간/.test(text)) return 'overview';
  return threads && !reactions ? 'threads' : reactions && !threads ? 'reactions' : 'overview';
}

function namedSocialTargets(input: string) {
  const text = compact(input);
  return {
    courses: communityTrips.filter(course => text.includes(compact(course.title)) || text.includes(compact(course.id))),
    entities: entities.filter(entity => text.includes(compact(entity.name)) || text.includes(compact(entity.id))),
  };
}

/** Chooses only the bounded context supplied to a model. It never writes a
 * thread, adds a reaction, or invents a public member metric. */
export function isSocialFeatureRequest(state: TripState, input: string) {
  if (isExplicitAppSocialRequest(input)) return false;
  const text = compact(input);
  if (!/스레드|댓글|답글|평가|평점|별점|반응|좋아요|응원|담김|담겼|담아갔|가져간/.test(text)) return false;
  const named = namedSocialTargets(input);
  // Preserve generic existing app-entry requests; a named target, a current
  // target reference, or the new thread/evaluation/collection vocabulary opens
  // the chatbot reader instead of sending the customer to another screen.
  return named.courses.length > 0 || named.entities.length > 0 ||
    /스레드|평점|별점|담김|담겼|담아갔|가져간/.test(text) ||
    /(?:업체|식당|음식점|카페|숙소|호텔|스팟|장소|코스|여행기).{0,20}평가|평가.{0,20}(?:업체|식당|음식점|카페|숙소|호텔|스팟|장소|코스|여행기)/.test(text) ||
    Boolean(state.socialTarget && /여기|이업체|이장소|이스팟|이카드|이코스|이여행기/.test(text));
}

export function socialRequestCandidates(state: TripState, input: string): { target: SocialTarget; title: string; subtitle: string }[] {
  const text = compact(input), named = namedSocialTargets(input);
  let targets: SocialTarget[] = [];
  if (named.courses.length && named.entities.length) {
    // Course-card discussions must retain their exact course and visit index.
    // Repeated occurrences remain ambiguous unless a card number was stated.
    const index = text.match(/(?:방문|카드|스팟)(\d{1,3})번째|(?<!\d)(\d{1,3})번째(?:방문|카드|스팟)/)?.slice(1).find(Boolean);
    targets = named.courses.flatMap(course => course.visits.flatMap((visit, visitIndex) =>
      named.entities.some(entity => entity.id === visit.entityId) && (!index || visitIndex === Number(index) - 1)
        ? [{ kind: 'course-place' as const, id: course.id, visitIndex }] : []));
  } else if (named.courses.length) targets = named.courses.map(course => ({ kind: 'course', id: course.id }));
  else if (named.entities.length) targets = named.entities.map(entity => ({ kind: 'entity', id: entity.id }));
  else if (/이코스|이여행기|현재코스|가져온코스/.test(text)) {
    const target = state.socialTarget;
    if (target?.kind === 'course') targets = [target];
    else if (state.communitySourceId && findCommunityTrip(state.communitySourceId)) targets = [{ kind: 'course', id: state.communitySourceId }];
  } else if (/여기|이업체|이장소|이스팟|이카드|현재업체|현재장소/.test(text)) {
    if (state.socialTarget) targets = [state.socialTarget];
    else {
      const id = state.detailId ?? state.plan.find(visit => visit.id === state.editingId)?.entityId ??
        (state.stage === 'food' ? state.foodKind === '카페' ? state.cafeId : state.foodId : state.stage === 'stay' ? state.stayId : state.anchorId);
      if (id && (findPlace(id) || findFood(id) || findStay(id))) targets = [{ kind: 'entity', id }];
    }
  }
  return targets.flatMap(target => {
    const resolved = resolveSocialTarget(target);
    return resolved ? [{ target, title: resolved.title, subtitle: resolved.subtitle }] : [];
  });
}

export function socialActionMatchesRequest(action: { target: SocialTarget; view?: SocialView }, state: TripState, input: string) {
  if (!isSocialFeatureRequest(state, input)) return false;
  const text = compact(input);
  if (/(?:스레드|댓글|답글|평가|반응|담김)(?:창|화면|목록)?(?:은|는|을|를|도)?(?:아직|절대)?(?:보여주|보여|열|조회하|확인하)지(?:마|말|않)/.test(text)) return false;
  const candidates = socialRequestCandidates(state, input);
  return candidates.length === 1 && resolveSocialTarget(candidates[0].target)?.key === resolveSocialTarget(action.target)?.key &&
    (action.view ?? 'overview') === socialRequestedView(input);
}
