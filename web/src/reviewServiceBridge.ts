import type { Journey, Place, StoryBlock } from './data';
import type { PublicReviewSource, PublicReviewPlaceSource, NearbyOverride, OpsReport, PublicJournal, PublicComment, PublicJournalDay, PublicJournalPlace, PublicJournalBlock, PublicJournalPhoto, PublicSourceCredit, ExposureEntry, ExposureChannel, OpsReference } from './publicServiceTypes';
import type { HomeTripTemplate } from './consumerPublicSeed';
import { sourceVersion as textSourceVersion, TRANSLATION_GLOSSARY_VERSION, type TranslationRecord } from './travelGuide.ts';

/** This store contains public review projections only. It never reads customer storage. */
export const REVIEW_SERVICE_KEY = 'spotlog.review.service.v1';
export const REVIEW_SERVICE_EVENT = 'spotlog-review-service-change';
export interface ReviewStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type ReportReason = NonNullable<OpsReport['reasonCode']>;
export type ReportTarget = { type: OpsReport['targetType']; id: string; label: string; journalId?: string; cardId?: string; mediaId?: string; journey?: Journey; place?: Place; comment?: PublicComment; photo?: PublicJournalPhoto };
export type PublicPlaceProjection = Place & { regionId?: string; publicRevision?: number; publicMediaCredits?: ({ image: string } & PublicSourceCredit)[]; reviewedEnglish?: { original: string; translated: string; sourceRevision: number } };
export interface ReviewServiceState {
  schemaVersion: 1; revision: number;
  reports: OpsReport[]; publicJournals: PublicJournal[]; comments: PublicComment[];
  publishedPlaces: PublicPlaceProjection[]; blockedPlaceIds: string[]; withdrawnImages: string[];
  nearbyOverrides: NearbyOverride[]; operatingJournals: PublicJournal[]; exposures: ExposureEntry[]; references: OpsReference[];
  journalModeration: { id: string; state: string }[]; commentModeration: { id: string; state: string }[];
  reactionSelections?: { journalId: string; memberId: string; cheer: 'LOVE' | 'BEST' | 'HELPFUL' }[];
}
export const emptyReviewServiceState = (): ReviewServiceState => ({ schemaVersion: 1, revision: 1, reports: [], publicJournals: [], comments: [], publishedPlaces: [], blockedPlaceIds: [], withdrawnImages: [], nearbyOverrides: [], operatingJournals: [], exposures: [], references: [], journalModeration: [], commentModeration: [], reactionSelections: [] });
const storageOrDefault = (storage?: ReviewStorage): ReviewStorage => { if (storage) return storage; if (typeof localStorage === 'undefined') throw new Error('로컬 검수 저장소를 사용할 수 없어요.'); return localStorage; };
const validString = (value: unknown, max = 4000): value is string => typeof value === 'string' && value.length <= max;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const reportTypes = ['JOURNAL', 'COMMENT', 'PROFILE', 'PLACE', 'PHOTO'];
const reportReasons = ['SPAM', 'ABUSE', 'PRIVACY', 'COPYRIGHT', 'INFORMATION', 'OTHER'];
export function assertReviewReport(value: unknown): asserts value is OpsReport {
  const allowed = ['reportId', 'revision', 'targetType', 'targetId', 'journalId', 'cardId', 'category', 'original', 'status', 'createdAt', 'decision', 'reporterId', 'reason', 'receivedAt', 'localReview', 'reasonCode', 'source', 'mediaId', 'reasonDetail', 'placeId', 'targetLabel', 'photoSnapshot'];
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('신고 응답에 확인할 수 없는 자료가 포함되어 있어요.');
  if (!record(value) || !reportTypes.includes(String(value.targetType)) || !['OPEN', 'RESOLVED', 'DISMISSED'].includes(String(value.status)) || !['CONTENT', 'COPYRIGHT', 'INFORMATION', 'TRANSLATION'].includes(String(value.category)) || !Number.isInteger(value.revision) || Number(value.revision) < 1 || !['reportId', 'targetId', 'original', 'createdAt', 'decision'].every(key => validString(value[key])) || !value.reportId || !value.targetId || !Number.isFinite(Date.parse(String(value.createdAt))) || value.reasonCode !== undefined && !reportReasons.includes(String(value.reasonCode))) throw new Error('신고 응답 형식을 확인해 주세요.');
  for (const key of ['reporterId', 'journalId', 'cardId', 'placeId', 'targetLabel', 'mediaId', 'reasonDetail', 'receivedAt', 'reason']) if (value[key] !== undefined && !validString(value[key])) throw new Error('신고 문맥 형식을 확인해 주세요.');
  if (value.localReview !== undefined && typeof value.localReview !== 'boolean' || value.source !== undefined && value.source !== 'LOCAL_REVIEW') throw new Error('신고 접수 출처를 확인해 주세요.');
  if (value.receivedAt !== undefined && !Number.isFinite(Date.parse(String(value.receivedAt)))) throw new Error('신고 접수 시각을 확인해 주세요.');
  if (value.photoSnapshot !== undefined) {
    const photo = value.photoSnapshot;
    if (!record(photo) || Object.keys(photo).some(key => !['id', 'image', 'caption', 'sourceCredit'].includes(key)) || !validString(photo.id) || !validString(photo.image, 3000000) || !validString(photo.caption) || photo.sourceCredit !== undefined && (!record(photo.sourceCredit) || Object.keys(photo.sourceCredit).some(key => !['provider', 'author', 'sourceUrl', 'license', 'licenseUrl', 'checkedAt', 'changes'].includes(key)) || !Object.values(photo.sourceCredit).every(v => v === undefined || validString(v)))) throw new Error('공개 사진 신고 문맥을 확인해 주세요.');
  }
}
export function assertReviewServiceState(value: unknown): asserts value is ReviewServiceState {
  const keys = Object.keys(emptyReviewServiceState());
  if (!record(value) || value.schemaVersion !== 1 || !Number.isInteger(value.revision) || Number(value.revision) < 1 || Object.keys(value).some(key => !keys.includes(key)) || keys.filter(key => !['schemaVersion', 'revision'].includes(key) && !(key === 'reactionSelections' && value[key] === undefined)).some(key => !Array.isArray(value[key]) || (value[key] as unknown[]).length > 10000)) throw new Error('로컬 검수 자료 형식이 맞지 않아요. 기존 자료를 보존했어요.');
  (value.reports as unknown[]).forEach(assertReviewReport);
  if ((value.publicJournals as PublicJournal[]).some(j => j.ownerVisibility !== 'PUBLIC') || (value.operatingJournals as PublicJournal[]).some(j => j.ownerVisibility !== 'PUBLIC')) throw new Error('공용 검수 자료에 비공개 여행기를 저장할 수 없어요.');
}
export function readReviewServiceState(storage?: ReviewStorage): ReviewServiceState {
  const raw = storageOrDefault(storage).getItem(REVIEW_SERVICE_KEY);
  if (raw === null) return emptyReviewServiceState();
  let value: unknown; try { value = JSON.parse(raw); } catch { throw new Error('로컬 검수 자료를 읽지 못했어요. 기존 자료를 보존했어요.'); }
  assertReviewServiceState(value); value.reactionSelections ??= []; return value;
}
function writeReviewServiceState(state: ReviewServiceState, storage?: ReviewStorage) {
  assertReviewServiceState(state);
  try { storageOrDefault(storage).setItem(REVIEW_SERVICE_KEY, JSON.stringify(state)); } catch { throw new Error('신고·공개 검수 자료를 저장하지 못했어요. 입력을 유지했어요.'); }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REVIEW_SERVICE_EVENT));
}
const publicCredit = (c?: PublicSourceCredit): PublicSourceCredit | undefined => c && ({ provider: c.provider, author: c.author, sourceUrl: c.sourceUrl, license: c.license, licenseUrl: c.licenseUrl, checkedAt: c.checkedAt, changes: c.changes });
const publicPhoto = (p: PublicJournalPhoto): PublicJournalPhoto => ({ id: String(p.id), image: String(p.image ?? ''), caption: String(p.caption ?? ''), sourceCredit: publicCredit(p.sourceCredit) });
const publicPlace = (p: Place | PublicJournalPlace): PublicJournalPlace => ({ id: p.id, visitId: p.visitId, kind: p.kind, name: p.name, area: p.area, address: p.address, image: p.image, description: p.description, note: '', duration: p.duration, planningSlot: p.planningSlot, sourceCredit: 'sourceCredit' in p ? publicCredit(p.sourceCredit) : undefined, photos: p.photos?.map((photo, index) => publicPhoto({ id: 'id' in photo ? photo.id : String(photo.mediaId ?? `${p.id}:${index}`), image: photo.image, caption: photo.caption ?? '', sourceCredit: 'sourceCredit' in photo ? publicCredit(photo.sourceCredit as PublicSourceCredit) : undefined })) });
const publicBlock = (b: StoryBlock | PublicJournalBlock): PublicJournalBlock => ({ id: b.id, type: b.type, heading: b.heading, body: b.body, image: b.image, caption: b.caption, images: b.images?.map(publicPhoto), visitId: b.visitId, placeId: b.placeId, sourceCredit: 'sourceCredit' in b ? publicCredit(b.sourceCredit) : undefined });
export function projectPublicJourney(journey: Journey): PublicJournal {
  if (journey.visibility !== 'PUBLIC' || journey.status !== 'PUBLISHED' || journey.purpose === 'PLAN' || journey.trash) throw new Error('공개 여행기에서만 신고할 수 있어요. 개인 일정은 보내지 않아요.');
  const days: PublicJournalDay[] = journey.days.map(day => ({ dayId: day.dayId, day: day.day, date: day.date, title: day.title, story: day.story, places: day.places.map(publicPlace), blocks: day.blocks.map(publicBlock) }));
  return { journalId: journey.id, revision: 1, title: journey.title, original: journey.story, english: '', authorId: journey.isMine ? `public-author:${journey.author}` : journey.publicAuthorId ?? `public-author:${journey.author}`, authorName: journey.author, ownerVisibility: 'PUBLIC', moderation: 'VISIBLE', createdAt: new Date().toISOString(), sourceKind: 'PUBLIC_SAMPLE', region: journey.region, summary: journey.summary, tags: [...journey.tags], cover: { id: `${journey.id}:cover`, image: journey.cover, caption: '' }, days,
    cards: days.flatMap(day => day.blocks.filter(b => b.type === 'PLACE').map(block => { const p = day.places.find(p => block.visitId ? p.visitId === block.visitId : p.id === block.placeId); return { cardId: block.id, placeId: p?.id ?? block.placeId ?? '', name: p?.name ?? '', original: p?.description ?? '', english: '', day: day.day, visitId: p?.visitId, kind: p?.kind, address: p?.address, description: p?.description, image: p?.image, photos: p?.photos }; })),
    translation: { sourceRevision: 1, status: 'REVIEW', note: '고객이 선택한 공개 신고 대상 문맥 · 번역 검수 전' } };
}
const safeJournal = (j: PublicJournal): PublicJournal => ({ journalId: j.journalId, revision: j.revision, title: j.title, original: j.original, english: j.english, authorId: j.authorId, authorName: j.authorName, authorAvatar: j.authorAvatar, ownerVisibility: 'PUBLIC', moderation: j.moderation, createdAt: j.createdAt, sourceKind: j.sourceKind, sourceJournalId: j.sourceJournalId, sourceTemplateId: j.sourceTemplateId, region: j.region, summary: j.summary, tags: j.tags?.slice(), cover: j.cover && publicPhoto(j.cover), days: j.days?.map(day => ({ dayId: day.dayId, day: day.day, date: day.date, title: day.title, story: day.story, places: day.places.map(p => ({ ...publicPlace(p), note: j.sourceKind === 'EDITORIAL' ? p.note : '' })), blocks: day.blocks.map(publicBlock) })), cards: j.cards.map(c => ({ cardId: c.cardId, placeId: c.placeId, name: c.name, original: c.original, english: c.english, day: c.day, visitId: c.visitId, kind: c.kind, address: c.address, description: c.description, image: c.image, photos: c.photos?.map(publicPhoto), sourceCredit: publicCredit(c.sourceCredit), likes: c.likes, likeUsers: c.likeUsers?.map(u => ({ memberId: u.memberId, name: u.name, avatarUrl: u.avatarUrl, source: u.source })) ?? c.likeUsers })), translation: { sourceRevision: j.translation.sourceRevision, status: j.translation.status, note: j.translation.note }, metrics: j.metrics && { cheers: j.metrics.cheers, copies: j.metrics.copies, views: j.metrics.views, source: j.metrics.source }, reactionBreakdown: j.reactionBreakdown && { LOVE: j.reactionBreakdown.LOVE, BEST: j.reactionBreakdown.BEST, HELPFUL: j.reactionBreakdown.HELPFUL, source: j.reactionBreakdown.source } });
const safeComment = (c: PublicComment): PublicComment => ({ commentId: c.commentId, revision: c.revision, journalId: c.journalId, cardId: c.cardId, parentId: c.parentId, authorId: c.authorId, authorName: c.authorName, authorAvatar: c.authorAvatar, original: c.original, english: c.english, createdAt: c.createdAt, moderation: c.moderation, sourceKind: c.sourceKind });
export function validateReportTarget(target: ReportTarget): void {
  if (!reportTypes.includes(target.type) || !validString(target.id, 300) || !target.id.trim() || !validString(target.label, 300)) throw new Error('신고할 대상을 다시 선택해 주세요.');
  const j = target.journey && projectPublicJourney(target.journey);
  const photos = [...(target.place?.photos ?? []).map((p, index) => ({ id: p.mediaId ?? `${target.place!.id}:${index}`, image: p.image })), ...(target.place?.image ? [{ id: `${target.place.id}:${target.place.image}`, image: target.place.image }] : []), ...(j?.cover ? [j.cover] : []), ...(j?.days ?? []).flatMap(day => [...day.places.flatMap(p => [...(p.photos ?? []), ...(p.image ? [{ id: `${p.id}:${p.image}`, image: p.image }] : [])]), ...day.blocks.flatMap(b => b.images ?? (b.image ? [{ id: `${b.id}:photo`, image: b.image }] : []))])];
  const publicPersonalPlace = !!j?.days?.some(day => day.places.some(p => p.id === target.place?.id));
  if (target.journalId && target.journalId !== j?.journalId || target.cardId && j && !j.days?.some(d => d.blocks.some(b => b.id === target.cardId)) || target.type === 'JOURNAL' && (!j || j.journalId !== target.id) || target.type === 'PROFILE' && (!j || j.authorId !== target.id) || target.type === 'COMMENT' && (!j || !target.comment || target.comment.commentId !== target.id || target.comment.journalId !== j.journalId || target.comment.cardId !== target.cardId) || target.type === 'PLACE' && (!target.place || target.place.id !== target.id || target.place.personal && !publicPersonalPlace) || target.type === 'PHOTO' && (!target.photo || target.photo.id !== target.id || !j && (!target.place || target.place.personal) || !photos.some(p => p.id === target.id && p.image === target.photo!.image))) throw new Error('공개된 신고 대상의 문맥을 확인해 주세요.');
}
export function receiveLocalReviewReport(target: ReportTarget, reasonCode: ReportReason, detail: string, reporterId: string, storage?: ReviewStorage): { report: OpsReport; duplicate: boolean } {
  validateReportTarget(target);
  if (!reportReasons.includes(reasonCode) || !validString(detail, 1000) || !reporterId.trim()) throw new Error('신고 사유와 접수자를 확인해 주세요.');
  const state = readReviewServiceState(storage), duplicate = state.reports.find(r => r.reporterId === reporterId && r.targetType === target.type && r.targetId === target.id && (r.journalId ?? '') === (target.journalId ?? target.journey?.id ?? '') && (r.cardId ?? '') === (target.cardId ?? ''));
  if (duplicate) return { report: structuredClone(duplicate), duplicate: true };
  const now = new Date().toISOString(), report: OpsReport = { reportId: `local-report-${crypto.randomUUID()}`, revision: 1, targetType: target.type, targetId: target.id, journalId: target.journalId ?? target.journey?.id, cardId: target.cardId, placeId: target.place?.id, targetLabel: target.label, photoSnapshot: target.photo && publicPhoto(target.photo), mediaId: target.mediaId ?? (target.type === 'PHOTO' ? target.id : undefined), category: reasonCode === 'COPYRIGHT' ? 'COPYRIGHT' : reasonCode === 'INFORMATION' ? 'INFORMATION' : 'CONTENT', original: detail.trim() || reasonCode, status: 'OPEN', createdAt: now, receivedAt: now, decision: '', reporterId, reasonCode, reasonDetail: detail.trim(), source: 'LOCAL_REVIEW', localReview: true };
  if (target.journey) { const projected = projectPublicJourney(target.journey); if (!state.publicJournals.some(j => j.journalId === projected.journalId)) state.publicJournals.push(projected); }
  if (target.comment && !state.comments.some(c => c.commentId === target.comment!.commentId)) state.comments.push(safeComment(target.comment));
  state.reports.push(report); state.revision++; writeReviewServiceState(state, storage); return { report, duplicate: false };
}
export function pullReviewAdminProjection(storage?: ReviewStorage): { reports: OpsReport[]; publicJournals: PublicJournal[]; comments: PublicComment[] } {
  const state = readReviewServiceState(storage);
  return { reports: structuredClone(state.reports), publicJournals: state.publicJournals.map(safeJournal), comments: state.comments.map(safeComment) };
}
function projectAdminPlace(place: PublicReviewPlaceSource): PublicPlaceProjection | null {
  const c = place.published;
  if (place.state !== 'PUBLISHED' || place.revoked || !c || c.provenance?.origin === 'SYNTHETIC' || place.draft.provenance?.origin === 'SYNTHETIC' || c.operation !== 'OPEN' || !c.rights.display || !c.rights.store || !c.location.verified || !Number.isFinite(c.location.lat) || !Number.isFinite(c.location.lng)) return null;
  const media = c.media.filter(m => !m.withdrawn && !place.revokedMediaIds?.includes(m.mediaId) && m.rights.display && m.rights.store), photos = media.filter(m => m.type === 'PHOTO');
  return { id: place.placeId, kind: c.kind, name: c.name, area: c.area, address: c.address, lat: c.location.lat!, lng: c.location.lng!, image: (photos.find(m => m.cover) ?? photos[0])?.url ?? '', description: c.description, note: c.provenance?.note ?? '', duration: c.visitDuration ?? '', hook: c.hook, creator: c.creatorLabel, bestTime: c.guide.bestTime, tags: [...c.tags], locationVerified: true, regionId: c.regionId, publicRevision: place.revision, reviewedEnglish: c.guide.englishStatus === 'REVIEWED' ? { original: c.description, translated: c.guide.english, sourceRevision: c.guide.sourceRevision } : undefined, publicMediaCredits: media.map(m => ({ image: m.url, provider: m.provider, author: m.author, sourceUrl: m.sourceUrl, license: m.license, licenseUrl: m.licenseUrl, checkedAt: m.checkedAt, changes: m.provenance?.changes })), photos: photos.map(m => ({ mediaId: m.mediaId, placeId: place.placeId, sourceId: m.provenance?.sourceId, image: m.url, caption: m.caption, alt: m.alt, objectPosition: m.provenance?.objectPosition })), video: media.find(m => m.type === 'VIDEO')?.url, motionImages: media.filter(m => m.type === 'MOTION' && m.rights.modify).map(m => m.url) };
}
export function syncReviewPublicProjection(source: PublicReviewSource, storage?: ReviewStorage): void {
  const current = readReviewServiceState(storage);
  const before = JSON.stringify({ ...current, revision: 0 });
  const sourceReports = new Map(source.ops.reports.map(r => [r.reportId, r]));
  current.reports = current.reports.map(r => { const next = sourceReports.get(r.reportId); return next && next.revision >= r.revision ? { ...r, status: next.status, decision: next.decision, revision: next.revision } : r; });
  current.publishedPlaces = source.places.flatMap(p => { const projected = projectAdminPlace(p); return projected ? [projected] : []; });
  current.blockedPlaceIds = source.places.filter(p => p.draft.provenance?.origin !== 'SYNTHETIC' && (p.state === 'INACTIVE' || p.revoked || !!p.published && (p.published.operation !== 'OPEN' || !p.published.rights.display || !p.published.rights.store))).map(p => p.placeId);
  current.withdrawnImages = [...new Set(source.places.flatMap(p => [...(p.published?.media ?? []).filter(m => m.withdrawn || p.revokedMediaIds?.includes(m.mediaId) || !m.rights.display || !m.rights.store), ...p.draft.media.filter(m => m.withdrawn || p.revokedMediaIds?.includes(m.mediaId))].map(m => m.url)))];
  current.nearbyOverrides = source.nearbyOverrides.map(o => ({ ...o }));
  current.references = source.ops.references.filter(r => r.enabled).map(r => ({ ...r }));
  current.exposures = source.ops.exposures.map(e => ({ ...e }));
  current.journalModeration = source.ops.journals.map(j => ({ id: j.journalId, state: j.ownerVisibility === 'PUBLIC' ? j.moderation : 'HIDDEN' }));
  current.commentModeration = source.ops.comments.map(c => ({ id: c.commentId, state: c.moderation }));
  const allowedJournals = source.ops.journals.filter(j => j.ownerVisibility === 'PUBLIC');
  const publicIds = new Set(allowedJournals.filter(j => j.sourceKind !== 'SYNTHETIC').map(j => j.journalId));
  current.comments = source.ops.comments.filter(c => publicIds.has(c.journalId)).map(safeComment);
  current.publicJournals = [...new Map([...current.publicJournals.filter(j => !source.ops.journals.some(s => s.journalId === j.journalId)), ...allowedJournals.filter(j => j.sourceKind !== 'SYNTHETIC')].map(j => [j.journalId, safeJournal(j)])).values()];
  current.operatingJournals = [...allowedJournals.filter(j => j.sourceKind === 'EDITORIAL'), ...source.ops.curatedTrips.filter(t => t.visibility === 'PUBLIC' && t.editorialJournal?.ownerVisibility === 'PUBLIC').flatMap(t => t.editorialJournal ? [{ ...t.editorialJournal, sourceJournalId: t.curatedTripId }] : [])].filter(j => j.moderation === 'VISIBLE').map(safeJournal);
  if (before === JSON.stringify({ ...current, revision: 0 })) return;
  current.revision++; writeReviewServiceState(current, storage);
}
export function overlayPublicPlaces(baseline: Place[], state: ReviewServiceState): PublicPlaceProjection[] {
  const merged = new Map(baseline.map(p => [p.id, p as PublicPlaceProjection]));
  state.publishedPlaces.forEach(p => merged.set(p.id, p)); state.blockedPlaceIds.forEach(id => merged.delete(id));
  return [...merged.values()].map(p => { const hidden = new Set(state.withdrawnImages); if (!hidden.size) return p; const photos = p.photos?.filter(photo => !hidden.has(photo.image)); return { ...p, image: hidden.has(p.image) ? photos?.[0]?.image ?? '' : p.image, photos: photos ?? (hidden.has(p.image) ? [] : undefined), video: p.video && hidden.has(p.video) ? undefined : p.video, motionImages: p.motionImages?.filter(image => !hidden.has(image)) }; });
}
export function publicJournalToJourney(j: PublicJournal, catalog: Place[]): Journey {
  return { id: j.journalId, publicAuthorId: j.authorId, publicSourceKind: j.sourceKind, sourceTripId: j.sourceJournalId, purpose: 'JOURNAL', title: j.title, region: j.region ?? '국내', dateRange: '운영 자료로 구성한 일정', duration: (j.days?.length ?? 1) === 1 ? '당일 여행' : `${j.days!.length - 1}박 ${j.days!.length}일`, status: 'PUBLISHED', visibility: 'PUBLIC', cover: j.cover?.image ?? '', summary: j.summary ?? '', story: j.original, tags: [...(j.tags ?? []), '운영자료', '로컬검수'], saves: j.metrics?.copies ?? 0, views: j.metrics?.views ?? 0, author: j.authorName ?? 'Spotlog 운영', isMine: false, days: (j.days ?? []).map(day => ({ ...day, places: day.places.map(p => ({ ...p, lat: catalog.find(c => c.id === p.id)?.lat ?? NaN, lng: catalog.find(c => c.id === p.id)?.lng ?? NaN, photos: p.photos?.map(photo => ({ mediaId: photo.id, image: photo.image, caption: photo.caption, alt: photo.caption })) })), blocks: day.blocks.map(b => ({ ...b })) })) };
}

/** Public display overlay only; stored/authored and private snapshots remain untouched. */
export function restrictPublicJourneyMedia(journey: Journey, state: ReviewServiceState): Journey {
  if (journey.visibility !== 'PUBLIC' || !state.withdrawnImages.length) return journey;
  const hidden = new Set(state.withdrawnImages);
  return { ...journey, cover: hidden.has(journey.cover) ? '' : journey.cover, days: journey.days.map(day => ({ ...day, places: day.places.map(p => ({ ...p, image: hidden.has(p.image) ? '' : p.image, photos: p.photos?.filter(photo => !hidden.has(photo.image)), video: p.video && hidden.has(p.video) ? undefined : p.video, motionImages: p.motionImages?.filter(image => !hidden.has(image)) })), blocks: day.blocks.map(b => ({ ...b, image: b.image && hidden.has(b.image) ? '' : b.image, images: b.images?.filter(photo => !hidden.has(photo.image)) })) })) };
}

/** A reviewed translation only applies to the exact public source identity and text version. */
export function reviewedPublicTranslation(state: ReviewServiceState, sourceId: string, sourceVersion: string, text: string, glossaryVersion = TRANSLATION_GLOSSARY_VERSION): TranslationRecord | null {
  if (sourceVersion !== textSourceVersion(text) || glossaryVersion !== TRANSLATION_GLOSSARY_VERSION) return null;
  const journal = [...state.publicJournals, ...state.operatingJournals].find(j => sourceId === `${j.journalId}:story` && j.ownerVisibility === 'PUBLIC' && j.moderation === 'VISIBLE' && j.translation.status === 'APPROVED' && j.translation.sourceRevision > 0 && j.original === text && !!j.english.trim());
  const place = state.publishedPlaces.find(p => sourceId === `place:${p.id}:description` && p.reviewedEnglish?.original === text && p.reviewedEnglish.sourceRevision > 0 && !!p.reviewedEnglish.translated.trim());
  const translated = journal?.english ?? place?.reviewedEnglish?.translated;
  return translated ? { sourceId, sourceVersion, original: text, language: 'en', glossaryVersion, translated, status: 'reviewed' } : null;
}

/** Only a deliberate reaction to the current public document enters this isolated projection. */
export function recordPublicCardReaction(journey: Journey, cardId: string, member: { id: string; name: string; avatar?: string }, liked: boolean, storage?: ReviewStorage): void {
  const projected = projectPublicJourney(journey), card = projected.cards.find(c => c.cardId === cardId);
  if (!card || !member.id || !member.name) throw new Error('공개 장소 카드 반응 대상을 확인해 주세요.');
  const state = readReviewServiceState(storage);
  let journal = state.publicJournals.find(j => j.journalId === journey.id);
  if (!journal) { journal = projected; state.publicJournals.push(journal); }
  const target = journal.cards.find(c => c.cardId === cardId);
  if (!target) throw new Error('공개 장소 카드가 변경되었어요. 다시 열어 주세요.');
  const users = target.likeUsers ?? [], already = users.some(u => u.memberId === member.id);
  if (already === liked) return;
  target.likeUsers = liked ? [...users, { memberId: member.id, name: member.name, avatarUrl: member.avatar ?? null, source: 'SAMPLE' }] : users.filter(u => u.memberId !== member.id);
  target.likes = target.likeUsers.length; journal.revision++; state.revision++; writeReviewServiceState(state, storage);
}
export function recordPublicCheer(journey: Journey, memberId: string, cheer: 'LOVE' | 'BEST' | 'HELPFUL', active?: boolean, storage?: ReviewStorage): void {
  if (!['LOVE','BEST','HELPFUL'].includes(cheer) || !memberId) throw new Error('공개 응원 대상을 확인해 주세요.');
  const projected = projectPublicJourney(journey), state = readReviewServiceState(storage);
  let journal = state.publicJournals.find(j => j.journalId === journey.id);
  if (!journal) { journal = projected; state.publicJournals.push(journal); }
  const selections = state.reactionSelections ?? [], previous = selections.find(s => s.journalId === journey.id && s.memberId === memberId);
  if (active === true && previous?.cheer === cheer || active === false && !previous) return;
  const counts = journal.reactionBreakdown ?? { LOVE: null, BEST: null, HELPFUL: null, source: 'SAMPLE' as const };
  if (previous) counts[previous.cheer] = Math.max(0, (counts[previous.cheer] ?? 0) - 1);
  state.reactionSelections = selections.filter(s => s !== previous);
  if (active ?? previous?.cheer !== cheer) { counts[cheer] = (counts[cheer] ?? 0) + 1; state.reactionSelections.push({ journalId: journey.id, memberId, cheer }); }
  counts.source = 'SAMPLE'; journal.reactionBreakdown = counts;
  journal.metrics = { cheers: ['LOVE','BEST','HELPFUL'].reduce((sum, key) => sum + (counts[key as 'LOVE'|'BEST'|'HELPFUL'] ?? 0), 0), copies: journal.metrics?.copies ?? null, views: journal.metrics?.views ?? null, source: 'SAMPLE' };
  journal.revision++; state.revision++; writeReviewServiceState(state, storage);
}

/** Only configured public exposure slots alter defaults; time windows remain effective. */
export function reviewExposureOrder<T extends { id: string; sourceTripId?: string }>(items: T[], channel: ExposureChannel, state: ReviewServiceState, now = Date.now()): T[] {
  const matching = (item: T) => state.exposures.filter(e => e.channel === channel && (e.targetId === item.id || e.targetId === item.sourceTripId));
  const active = (item: T) => matching(item).filter(e => e.enabled && (!e.startsAt || Date.parse(e.startsAt) <= now) && (!e.endsAt || Date.parse(e.endsAt) > now));
  return items.filter(item => !matching(item).length || active(item).length > 0).map(item => { const exposure = active(item)[0]; if (!exposure) return item; const cover = state.publishedPlaces.flatMap(p => p.photos ?? []).find(p => p.mediaId === exposure.coverMediaId)?.image; return { ...item, ...(exposure.title ? { title: exposure.title } : {}), ...(exposure.introduction ? { summary: exposure.introduction } : {}), ...(cover ? { cover } : {}) }; }).sort((a, b) => {
    const left = active(a)[0], right = active(b)[0];
    return left && right ? left.order - right.order : left ? -1 : right ? 1 : 0;
  });
}

export function publicTemplatesFromReview(state: ReviewServiceState, catalog: Place[]): HomeTripTemplate[] {
  return state.operatingJournals.filter(j => j.ownerVisibility === 'PUBLIC' && j.moderation === 'VISIBLE' && j.days?.length && j.days.every(day => day.places.length > 0)).flatMap(j => { const places = [...new Map(j.days!.flatMap(day => day.places).map(p => catalog.find(c => c.id === p.id)).filter((p): p is Place => !!p).map(p => [p.id,p])).values()];return places.length ? [{ id: j.sourceTemplateId ?? j.sourceJournalId ?? j.journalId, sourceTripId: j.sourceJournalId, publicJourney: restrictPublicJourneyMedia(publicJournalToJourney(j,catalog),state), region: j.region ?? '국내', eyebrow: '운영 추천 · 공개 자료', title: j.title, summary: j.summary ?? '', duration: j.days!.length === 1 ? '당일 여행' : `${j.days!.length - 1}박 ${j.days!.length}일`, dayCount: j.days!.length, cover: j.cover?.image ?? '', places }] : [];});
}
