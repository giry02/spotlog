import { discoveryLandmarks, placeCatalog } from '../data';
import { plannerBusinessSourceById } from '../plannerBusinessCatalog';
import { photoSources } from '../photoSources';
import { getConsumerPublicSeedProjection, homeTripTemplates, previewTemplateJourney } from '../consumerPublicSeed';
import { makeAiSeed } from './aiSeed';
import { makeOpsSeed } from './opsSeed';
import type { AdminKind, AdminPlace, AdminRegion, AdminState } from './types';
import type { CuratedTrip, CuratedVisit } from './opsTypes';
import { catalogMaster, emptyContent } from './content';
import { inferRegionId, makeRegionSeed } from './regions';
import { MASTER_MIGRATION, CATALOG_ADDITIONS_MIGRATION, BUSAN_CATALOG_ADDITIONS_MIGRATION } from './migration';
export { emptyContent } from './content';

export const REVIEW_TIME = '2026-10-05T00:00:00.000Z';
export const REVIEW_SESSION = { operatorId: 'operator-admin', name: '내부 관리자', role: 'ADMIN' as const };
/** Import the public home examples as private editorial drafts without approving their sources. */
export function makeSourceHomeDrafts(places: AdminPlace[], regions: AdminRegion[]): CuratedTrip[] {
  return homeTripTemplates.map(template => {
    const curatedTripId = `source-home:${template.id}`, preview = previewTemplateJourney(template);
    const days = preview.days.map(day => ({
      dayId: `${curatedTripId}:day-${day.day}`, day: day.day, title: day.title || `DAY ${day.day}`, introduction: day.story || '',
      visits: day.places.map((place, index) => {
        const record = places.find(item => item.placeId === place.id), media = record?.draft.media.find(item => item.type === 'PHOTO' && item.url === place.image);
        const slot: CuratedVisit['slot'] = place.planningSlot || (place.kind === 'STAY' ? 'stay' : place.kind === 'FOOD' ? 'lunch' : index === 0 ? 'morning' : 'afternoon');
        return { visitId: `${curatedTripId}:day-${day.day}:visit-${index + 1}`, placeId: place.id, slot, introduction: place.description, ...(media ? { mediaId: media.mediaId } : {}) };
      }),
    }));
    const placeIds = [...new Set(days.flatMap(day => day.visits.map(visit => visit.placeId)))];
    const cover = places.filter(record => placeIds.includes(record.placeId)).flatMap(record => record.draft.media).find(media => media.type === 'PHOTO' && media.url === template.cover);
    const regionId = inferRegionId(template.region, '') || regions.find(region => region.level === 'COUNTRY')?.regionId;
    return { curatedTripId, revision: 1, title: template.title, introduction: template.summary, placeIds, visibility: 'PRIVATE', sourceTemplateId: template.id, sourceKind: 'PUBLIC_SAMPLE', regionId, dayCount: template.dayCount, days, ...(cover ? { coverMediaId: cover.mediaId } : {}) };
  });
}
function reviewPlace(placeId: string, kind: AdminKind, name: string, lat: number, lng: number): AdminPlace {
  const content = emptyContent(kind);
  Object.assign(content, { name, area: '부산 · 검수 자료', regionId: 'kr-busan', visitDuration: kind === 'STAY' ? '숙박' : '1시간', provenance: { origin: 'SYNTHETIC' }, address: name + ' 가상 검수 주소 — 실제 방문용 아님', description: '관리자 등록·추천 흐름을 확인하는 가상 자료입니다.', provider: 'Spotlog 검수 자료', sourceUrl: 'https://example.org/spotlog-review', checkedAt: '2026-10-05' });
  content.rights = { display: true, store: true, modify: true, ai: true };
  content.location = { lat, lng, verified: true, reference: '검수 전용 가상 좌표', sourceUrl: content.sourceUrl, checkedAt: content.checkedAt };
  content.ai = { text: content.description, tags: [kind], sourceUrl: content.sourceUrl, provider: content.provider, checkedAt: content.checkedAt, allowed: true, version: 1 };
  content.media = [{ mediaId: placeId + '-photo', type: 'PHOTO', url: '/admin-review.svg', caption: '실제 장소 사진이 아닌 검수용 도형', alt: name + ' 검수용 도형', cover: true, provider: content.provider, author: 'Spotlog', sourceUrl: content.sourceUrl, license: '자체 검수용 도형', licenseUrl: content.sourceUrl, checkedAt: content.checkedAt, rights: { ...content.rights }, withdrawn: false }];
  return { placeId, revision: 1, state: 'PUBLISHED', draft: structuredClone(content), published: structuredClone(content), revoked: false, updatedAt: REVIEW_TIME, meta: { createdById: 'operator-admin', assignedToId: 'operator-admin', reviewStatus: 'READY' } };
}
export function makeAdminSeed(): AdminState {
  const samplePlaces = [reviewPlace('review-landmark', 'LANDMARK', '검수용 바다 전망대', 35.16, 129.16), reviewPlace('review-food', 'FOOD', '검수용 바다 식당', 35.161, 129.162), reviewPlace('review-cafe', 'CAFE', '검수용 풍경 카페', 35.164, 129.163), reviewPlace('review-stay', 'STAY', '검수용 바다 숙소', 35.162, 129.158), reviewPlace('review-landmark-2', 'LANDMARK', '검수용 도심 공원', 35.2, 129.1), reviewPlace('review-shop', 'SHOP', '검수용 여행 상점', 35.161, 129.159)];
  const sourcePlaces = placeCatalog.filter(place => !place.personal).map(place => {
    const discovery = discoveryLandmarks.find(item => item.id === place.id);
    // Catalog deduplication may have selected an itinerary instance. Retain the
    // discovery media and editorial fields for that same shared place identity.
    const original = { ...place, video: place.video ?? discovery?.video, motionImages: place.motionImages ?? discovery?.motionImages, hook: place.hook ?? discovery?.hook, creator: place.creator ?? discovery?.creator, bestTime: place.bestTime ?? discovery?.bestTime };
    return catalogMaster(original, photoSources, plannerBusinessSourceById.get(place.id), REVIEW_TIME);
  });
  const regions = makeRegionSeed(), ops = makeOpsSeed(), publicProjection = getConsumerPublicSeedProjection();
  ops.curatedTrips.push(...makeSourceHomeDrafts(sourcePlaces, regions).filter(trip => !ops.curatedTrips.some(existing => existing.curatedTripId === trip.curatedTripId)));
  ops.journals.push(...publicProjection.publicJournals.filter(journal => !ops.journals.some(existing => existing.journalId === journal.journalId)));
  ops.comments.push(...publicProjection.comments);
  return { schemaVersion: 1, revision: 1, places: [...samplePlaces, ...sourcePlaces], regions, migrations: [MASTER_MIGRATION, CATALOG_ADDITIONS_MIGRATION, BUSAN_CATALOG_ADDITIONS_MIGRATION], nearbyOverrides: [], ai: makeAiSeed(), ops, audit: [], processedCommands: [] };
}
