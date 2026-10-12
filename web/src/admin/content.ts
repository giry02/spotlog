import type { AdminKind, AdminMedia, AdminPlace, PlaceContent } from './types';
import type { Place } from '../data';
import type { PhotoSource } from '../photoSources';
import type { PlannerBusinessSource } from '../plannerBusinessCatalog';
import { inferRegionId } from './regions.ts';

export function emptyContent(kind: AdminKind = 'LANDMARK'): PlaceContent {
  return { kind, name: '', companyId: '', area: '', regionId: '', visitDuration: '', hook: '', creatorLabel: '', address: '', description: '', tags: [], operation: 'OPEN',
    location: { lat: null, lng: null, verified: false, reference: '', sourceUrl: '', checkedAt: '' },
    rights: { display: false, store: false, modify: false, ai: false }, provider: '', sourceUrl: '', checkedAt: '', media: [],
    guide: { hours: '', bestTime: '', facilities: '', menu: '', lodging: '', access: '', english: '', englishStatus: 'MISSING', sourceUrl: '', checkedAt: '', sourceRevision: 0 },
    ai: { text: '', tags: [], sourceUrl: '', provider: '', checkedAt: '', allowed: false, version: 1 } };
}

/** Only the shared catalog is accepted here; callers never read customer storage. */
export function catalogMaster(place: Place, sources: PhotoSource[], businessSource: PlannerBusinessSource | undefined, importedAt: string): AdminPlace {
  const content = emptyContent(place.kind), sourceFor = (url: string) => sources.find(source => source.image === url);
  const placeSources = sources.filter(source => source.placeId === place.id), primarySource = sourceFor(place.image) ?? placeSources[0];
  Object.assign(content, { name: place.name, area: place.area, regionId: inferRegionId(place.area, place.address), address: place.address, description: place.description, tags: [...(place.tags ?? [])], visitDuration: place.duration, hook: place.hook ?? '', creatorLabel: place.creator ?? '', provider: businessSource?.provider ?? primarySource?.owner ?? '기존 프론트 샘플 — 사용 범위 재검수', sourceUrl: businessSource?.sourceUrl ?? primarySource?.coordinateSourceUrl ?? primarySource?.sourceUrl ?? '', checkedAt: businessSource?.checkedAt ?? primarySource?.verifiedAt ?? '', provenance: { origin: 'CATALOG', sourcePlaceId: place.id, sourceRecordId: businessSource?.providerRecordId, scope: businessSource?.scope ?? 'shared-catalog', note: place.note } });
  content.location = { lat: Number.isFinite(place.lat) ? place.lat : null, lng: Number.isFinite(place.lng) ? place.lng : null, verified: Boolean(businessSource), reference: businessSource?.coordinateReference ?? '기존 샘플 좌표 — 도착점 재확인 필요', sourceUrl: businessSource?.sourceUrl ?? primarySource?.coordinateSourceUrl ?? '', checkedAt: businessSource?.checkedAt ?? primarySource?.verifiedAt ?? '' };
  content.guide.bestTime = place.bestTime ?? '';
  const media: AdminMedia[] = [];
  const addMedia = (url: string, type: AdminMedia['type'], mediaId: string, caption = '', alt = '', sourceId?: string, objectPosition?: string, withdrawn = false) => {
    if (!url || media.some(item => item.mediaId === mediaId)) return;
    const source = sourceFor(url);
    media.push({ mediaId, type, url, caption: caption || source?.caption || source?.title || '', alt: alt || source?.title || place.name + (type === 'VIDEO' ? ' 영상' : ' 사진'), cover: false, provider: source?.owner ?? '기존 프론트 샘플 — 개별 출처 재검수', author: source?.author ?? '', sourceUrl: source?.sourceUrl ?? '', license: source?.license ?? '', licenseUrl: source?.licenseUrl ?? '', checkedAt: source?.verifiedAt ?? '', rights: { display: false, store: false, modify: false, ai: false }, withdrawn, provenance: { origin: 'CATALOG', sourceId: sourceId ?? source?.id, sourcePlaceId: place.id, imageSourceUrl: source?.imageSourceUrl, publishedAt: source?.publishedAt, originalTitle: source?.originalTitle, changes: source?.changes, reuseNote: source?.reuseNote, objectPosition: objectPosition ?? source?.objectPosition } });
  };
  for (const photo of place.photos ?? []) addMedia(photo.image, 'PHOTO', photo.mediaId ?? `${place.id}:photo:${media.length}`, photo.caption, photo.alt, photo.sourceId, photo.objectPosition, photo.availability === 'withdrawn');
  if (place.image && !media.some(item => item.url === place.image && item.type === 'PHOTO')) addMedia(place.image, 'PHOTO', `${place.id}:cover`);
  // Preserve additional known source photos, even when the consumer currently uses one cover.
  for (const source of placeSources) if (!media.some(item => item.provenance?.sourceId === source.id)) addMedia(source.image, 'PHOTO', `source:${source.id}`, source.caption, source.title, source.id, source.objectPosition);
  if (place.video) addMedia(place.video, 'VIDEO', `${place.id}:video`);
  for (const [index, url] of (place.motionImages ?? []).entries()) addMedia(url, 'MOTION', `${place.id}:motion:${index}`);
  const cover = media.find(item => item.type === 'PHOTO' && item.url === place.image && !item.withdrawn) ?? media.find(item => !item.withdrawn);
  if (cover) cover.cover = true;
  content.media = media;
  return { placeId: place.id, revision: 1, state: 'DRAFT', draft: content, revoked: false, updatedAt: importedAt, meta: { createdById: 'catalog-import', assignedToId: '', reviewStatus: 'NEEDS_CHECK', sourceBatchId: 'shared-catalog-v2', importedAt } };
}
