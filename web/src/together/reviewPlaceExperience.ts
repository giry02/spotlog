import type { Place } from '../data';
import type { TogetherState } from './model';
import { assertMemberRecordWriteAccess } from './memberRecords.ts';
import { addGroupPost, type GroupPostInput } from './groupContent.ts';
import { isPlaceExperienceTags, readPlaceAssessment, upsertPlaceFeedback, type PlaceExperienceTag } from './businessAssessments.ts';

export const MAX_REVIEW_PLACE_EXPERIENCES = 8;
export interface ReviewPlaceExperienceDraft {
  placeId: string;
  sourceVersion: string;
  rating: number;
  note: string;
  recommended: boolean;
  experienceTags: PlaceExperienceTag[];
}
export interface ReviewExperiencePlace {
  place: Place;
  sourceVersion: string;
  /** Existing and withdrawn own records are never overwritten by this new-post flow. */
  hasOwnReview: boolean;
  ownReview?: { rating: number; note: string; recommended: boolean; experienceTags: PlaceExperienceTag[]; withdrawn: boolean };
}

/** Public catalogue places explicitly shared in this exact space, never guessed from a review or photo. */
export function selectReviewExperiencePlaces(state: TogetherState, actorId: string, groupId: string, places: ReadonlyArray<Place>, activityId?: string): ReviewExperiencePlace[] {
  assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
  const group = state.groups.find(item => item.id === groupId)!;
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  const ids = [...new Set(activity ? [
    ...(activity.journey?.days.flatMap(day => day.places.map(place => place.id)) || []),
    ...(activity.venuePlaceId ? [activity.venuePlaceId] : []), ...(activity.placeCandidateIds || []),
  ] : group.interestPlaceIds || [])];
  const catalogue = new Map(places.filter(place => !place.personal && place.id && place.name.trim()).map(place => [place.id, place]));
  return ids.flatMap(id => {
    const place = catalogue.get(id);
    if (!place) return [];
    const scope = { groupId, ...(activityId ? { activityId } : {}), placeId: id };
    const assessment = readPlaceAssessment(state, actorId, scope, [...places]);
    if (!assessment.canReview) return [];
    const own = assessment.ownReview;
    return [{ place, sourceVersion: JSON.stringify([actorId, groupId, activityId || null, place.id, place.kind, place.name, place.address || '', place.area]),
      hasOwnReview: Boolean(own), ...(own ? { ownReview: { rating: own.rating, note: own.note, recommended: own.recommended, experienceTags: [...(own.experienceTags || [])], withdrawn: Boolean(own.withdrawnAt) } } : {}) }];
  });
}

/** Check fresh space, source and own-record status before any mutation; input body/photos never enter place feedback. */
export function validateReviewPlaceExperiences(state: TogetherState, actorId: string, groupId: string, input: GroupPostInput,
  experiences: ReadonlyArray<ReviewPlaceExperienceDraft>, places: ReadonlyArray<Place>, activityId?: string): void {
  assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
  if (!Array.isArray(experiences) || experiences.length > MAX_REVIEW_PLACE_EXPERIENCES) throw new Error('장소 경험은 한 번에 8곳까지 선택해 주세요.');
  if (experiences.length && input.category !== 'REVIEW') throw new Error('장소 경험은 모임·약속 후기에서 함께 남길 수 있어요.');
  if (!experiences.length) return;
  const eligible = new Map(selectReviewExperiencePlaces(state, actorId, groupId, places, activityId).map(item => [item.place.id, item]));
  const seen = new Set<string>();
  for (const draft of experiences) {
    if (!draft || typeof draft !== 'object' || Object.keys(draft).some(key => !['placeId', 'sourceVersion', 'rating', 'note', 'recommended', 'experienceTags'].includes(key))
      || typeof draft.placeId !== 'string' || seen.has(draft.placeId)) throw new Error('경험을 남길 장소를 중복 없이 다시 확인해 주세요.');
    seen.add(draft.placeId);
    const source = eligible.get(draft.placeId);
    if (!source || source.sourceVersion !== draft.sourceVersion) throw new Error('공유 장소나 작성 공간이 바뀌었어요. 선택한 장소를 다시 확인해 주세요.');
    if (source.hasOwnReview) throw new Error(`${source.place.name}에 이미 내 평가가 있어요. 기존 평가에서 확인·수정하거나 이번 선택에서 빼 주세요.`);
    if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5 || typeof draft.note !== 'string' || draft.note.length > 2000
      || typeof draft.recommended !== 'boolean' || !Array.isArray(draft.experienceTags) || !isPlaceExperienceTags(draft.experienceTags)) throw new Error(`${source.place.name}의 별점 1~5점과 경험 내용을 확인해 주세요.`);
  }
}

/** Use inside repository.update. A failure leaves both post and all place experiences untouched. */
export function commitReviewPostWithExperiences(state: TogetherState, actorId: string, groupId: string, input: GroupPostInput,
  experiences: ReadonlyArray<ReviewPlaceExperienceDraft>, places: ReadonlyArray<Place>, activityId?: string): string {
  validateReviewPlaceExperiences(state, actorId, groupId, input, experiences, places, activityId);
  const draft = structuredClone(state);
  const postId = addGroupPost(draft, actorId, groupId, input, activityId);
  for (const experience of experiences) upsertPlaceFeedback(draft, actorId, { groupId, ...(activityId ? { activityId } : {}), placeId: experience.placeId }, {
    rating: experience.rating, note: experience.note, recommended: experience.recommended, purposes: [],
    experienceTags: [...experience.experienceTags], photos: [], expectedRevision: 0,
  }, [...places]);
  state.posts = draft.posts;
  if (experiences.length) state.placeFeedback = draft.placeFeedback;
  return postId;
}
