import type { AdminState } from './types';
import type { CuratedTrip, ExposureEntry } from './opsTypes';
import { curatedIssues } from './editorialDraft.ts';
import { exposureMediaChoices } from './opsDomain.ts';

/** Opening the main editor never publishes, re-enables, or changes an existing schedule. */
export function curatedMainExposureDraft(state: AdminState, trip: CuratedTrip, exposureId: string): ExposureEntry {
  const published = state.ops.curatedTrips.find(item => item.curatedTripId === trip.curatedTripId);
  if (!published || published.visibility !== 'PUBLIC' || curatedIssues(state, published).length) throw new Error('추천 여행을 확인하고 공개한 뒤 메인에 게시하세요.');
  const existing = state.ops.exposures.find(item => item.channel === 'HOME_TRIP' && item.targetId === published.curatedTripId);
  if (existing) return structuredClone(existing);
  const media = exposureMediaChoices(state, { channel: 'HOME_TRIP', targetId: published.curatedTripId });
  return {
    exposureId, revision: 0, channel: 'HOME_TRIP', targetId: published.curatedTripId,
    title: published.title, introduction: published.introduction,
    coverMediaId: media.find(item => item.mediaId === published.coverMediaId && item.type === 'PHOTO')?.mediaId ?? media.find(item => item.type === 'PHOTO')?.mediaId ?? '',
    startsAt: '', endsAt: '', enabled: false,
    order: Math.max(-1, ...state.ops.exposures.filter(item => item.channel === 'HOME_TRIP').map(item => item.order)) + 1,
  };
}

export function curatedDraftTarget(tripId: string | undefined, regionId: string | undefined): string {
  return tripId || `new:${regionId || 'all'}`;
}
