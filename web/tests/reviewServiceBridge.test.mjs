import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_SERVICE_KEY, assertReviewServiceState, emptyReviewServiceState, overlayPublicPlaces, projectPublicJourney, publicTemplatesFromReview, pullReviewAdminProjection, readReviewServiceState, receiveLocalReviewReport, recordPublicCardReaction, recordPublicCheer, restrictPublicJourneyMedia, reviewedPublicTranslation, reviewExposureOrder, syncReviewPublicProjection, validateReportTarget } from '../src/reviewServiceBridge.ts';
import { sourceVersion } from '../src/travelGuide.ts';
import { createReportAdapter } from '../src/reportService.ts';
import { assertReviewReport } from '../src/reviewServiceBridge.ts';

const memory = () => { const entries = new Map(); let writes = 0; const reads = []; return { entries, reads, get writes() { return writes; }, getItem(key) { reads.push(key); return entries.get(key) ?? null; }, setItem(key, value) { writes++; entries.set(key, value); } }; };
const place = { id: 'public-place', kind: 'LANDMARK', name: '공개 장소', area: '부산', address: '공개 주소', lat: 35.1, lng: 129.1, image: '/one.jpg', photos: [{ mediaId: 'photo-one', image: '/one.jpg', caption: '장면', alt: '장면' }], description: '공개 설명', note: 'PRIVATE_NOTE', duration: '1시간', bookingFixed: true, stayDayIds: ['PRIVATE_BOOKING'] };
const journey = { id: 'public-journal', purpose: 'JOURNAL', title: '공개 여행기', author: '작성자', region: '부산', dateRange: '샘플', duration: '당일 여행', cover: '/cover.jpg', summary: '공개 요약', story: '공개 본문', tags: ['부산'], saves: 0, status: 'PUBLISHED', visibility: 'PUBLIC', isMine: false, planningPreferences: { prompt: 'PRIVATE_AI_PROMPT' }, travelProgress: { dayId: 'd', visits: { private: { status: 'done' } } }, editorDraft: { value: { story: 'PRIVATE_DRAFT' } }, days: [{ dayId: 'd', day: 1, date: '1일차', title: '하루', story: '하루 글', places: [place], blocks: [{ id: 'card', type: 'PLACE', placeId: place.id }, { id: 'photo-block', type: 'IMAGE', images: [{ id: 'journey-photo', image: '/journey.jpg', caption: '공개 사진' }] }] }] };
const target = { type: 'JOURNAL', id: journey.id, label: journey.title, journey };
const photoTarget = { type: 'PHOTO', id: 'photo-one', label: place.name, place, photo: { id: 'photo-one', image: '/one.jpg', caption: '장면', sourceCredit: { provider: '제공자', sourceUrl: 'https://example.org/source', license: 'CC BY', checkedAt: '2026-10-05' } } };
const adminPlace = (id = place.id, origin = 'CATALOG') => {
  const content = { kind: 'LANDMARK', name: place.name, area: '부산', address: place.address, description: place.description, visitDuration: '1시간', tags: [], operation: 'OPEN', provenance: { origin }, location: { lat: 35.1, lng: 129.1, verified: true }, rights: { display: true, store: true, modify: true, ai: false }, guide: { bestTime: '오전' }, media: [{ mediaId: 'photo-one', type: 'PHOTO', url: '/one.jpg', cover: true, caption: '사진', alt: '사진', provider: '제공자', author: '저자', sourceUrl: 'https://example.org/source', license: 'CC BY', licenseUrl: 'https://example.org/license', checkedAt: '2026-10-05', rights: { display: true, store: true, modify: true, ai: false }, withdrawn: false }] };
  return { placeId: id, revision: 1, state: 'PUBLISHED', draft: structuredClone(content), published: structuredClone(content), revoked: false };
};
const admin = () => ({ places: [adminPlace()], nearbyOverrides: [], ops: { reports: [], references: [], exposures: [], journals: [], comments: [], curatedTrips: [] } });

test('explicit report projects only public reading context and never reads private storage', () => {
  const storage = memory(); const { report } = receiveLocalReviewReport(target, 'PRIVACY', '확인해 주세요', 'local-self', storage);
  const projection = pullReviewAdminProjection(storage); const raw = JSON.stringify(projection);
  assert.doesNotThrow(() => assertReviewReport(report)); assert.equal(projection.publicJournals[0].ownerVisibility, 'PUBLIC');
  for (const privateValue of ['PRIVATE_NOTE', 'PRIVATE_BOOKING', 'PRIVATE_AI_PROMPT', 'PRIVATE_DRAFT', 'planningPreferences', 'travelProgress', 'bookingFixed']) assert.ok(!raw.includes(privateValue), privateValue);
  assert.deepEqual([...new Set(storage.reads)], [REVIEW_SERVICE_KEY]);
  assert.equal(projection.publicJournals[0].days[0].blocks[1].images[0].id, 'journey-photo');
  assert.equal(projection.publicJournals[0].cards[0].cardId, 'card');
});
test('private journals and plans cannot enter public review via any target', () => {
  for (const changed of [{ visibility: 'PRIVATE' }, { purpose: 'PLAN' }, { status: 'PLANNING' }, { trash: { deletedAt: 'x' } }]) assert.throws(() => receiveLocalReviewReport({ ...target, journey: { ...journey, ...changed } }, 'OTHER', '', 'local-self', memory()));
  assert.throws(() => projectPublicJourney({ ...journey, visibility: 'PRIVATE' }));
});
test('a newly published own journal is attributed to its current author even with legacy copied public identity', () => {
  const own = { ...journey, isMine: true, author: '새 작성자', publicAuthorId: 'spotlog-editorial', publicSourceKind: 'EDITORIAL' };
  const projected = projectPublicJourney(own);
  assert.equal(projected.authorId, 'public-author:새 작성자'); assert.equal(projected.authorName, '새 작성자');
  assert.equal(projectPublicJourney({ ...own, isMine: false }).authorId, 'spotlog-editorial');
});
test('duplicate reports keep their ID and administrator decision, without another write', () => {
  const storage = memory(), first = receiveLocalReviewReport(target, 'OTHER', '', 'local-self', storage);
  const source = admin(); source.ops.reports = [{ ...first.report, revision: 2, status: 'RESOLVED', decision: '확인 완료' }]; syncReviewPublicProjection(source, storage);
  const writes = storage.writes, duplicate = receiveLocalReviewReport(target, 'SPAM', '다른 사유', 'local-self', storage);
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.report.reportId, first.report.reportId); assert.equal(duplicate.report.status, 'RESOLVED'); assert.equal(storage.writes, writes);
});
test('PHOTO report retains safe exact image identity and attribution without a journal', () => {
  const storage = memory(), result = receiveLocalReviewReport(photoTarget, 'COPYRIGHT', '사진 확인', 'local-self', storage);
  assert.equal(result.report.placeId, place.id); assert.equal(result.report.targetId, 'photo-one'); assert.equal(result.report.photoSnapshot.sourceCredit.provider, '제공자');
  assert.doesNotThrow(() => assertReviewReport(result.report)); assert.equal(pullReviewAdminProjection(storage).publicJournals.length, 0);
  assert.throws(() => validateReportTarget({ ...photoTarget, photo: { ...photoTarget.photo, image: '/unrelated.jpg' } }));
});
test('COMMENT report requires exact public parent journal and card identity', () => {
  const comment = { commentId: 'comment', revision: 1, journalId: journey.id, cardId: 'card', authorId: 'other', original: '공개 댓글', english: '', createdAt: '2026-10-05T00:00:00.000Z', moderation: 'VISIBLE' };
  const input = { type: 'COMMENT', id: 'comment', label: '댓글', journey, cardId: 'card', comment };
  validateReportTarget(input); assert.throws(() => validateReportTarget({ ...input, cardId: 'photo-block' })); assert.throws(() => validateReportTarget({ ...input, comment: { ...comment, journalId: 'other-journal' } }));
});
test('sync is idempotent and excludes legacy synthetic publication by draft provenance', () => {
  const storage = memory(), source = admin(); const synthetic = adminPlace('legacy-synthetic', 'SYNTHETIC'); delete synthetic.published.provenance; source.places.push(synthetic);
  syncReviewPublicProjection(source, storage); const writes = storage.writes; syncReviewPublicProjection(source, storage);
  assert.equal(storage.writes, writes); assert.deepEqual(readReviewServiceState(storage).publishedPlaces.map(p => p.id), [place.id]);
});
test('draft master imports leave all baseline consumer places intact; explicit inactive and revoked images remove exposure', () => {
  const source = admin(), storage = memory(); source.places[0].state = 'DRAFT'; delete source.places[0].published; syncReviewPublicProjection(source, storage);
  assert.equal(overlayPublicPlaces([place], readReviewServiceState(storage)).length, 1);
  source.places[0].revokedMediaIds = ['photo-one']; syncReviewPublicProjection(source, storage);
  const rendered = overlayPublicPlaces([place], readReviewServiceState(storage))[0]; assert.equal(rendered.image, ''); assert.deepEqual(rendered.photos, []);
  source.places[0].state = 'INACTIVE'; syncReviewPublicProjection(source, storage); assert.equal(overlayPublicPlaces([place], readReviewServiceState(storage)).length, 0);
});
test('rights withdrawal filters public media overlays without rewriting stored or private journeys', () => {
  const state = { ...emptyReviewServiceState(), withdrawnImages: ['/one.jpg', '/journey.jpg', '/cover.jpg'] };
  const rendered = restrictPublicJourneyMedia(journey, state); assert.equal(rendered.cover, ''); assert.equal(rendered.days[0].places[0].photos.length, 0); assert.equal(rendered.days[0].blocks[1].images.length, 0);
  assert.equal(journey.cover, '/cover.jpg'); const privateJourney = { ...journey, visibility: 'PRIVATE' }; assert.equal(restrictPublicJourneyMedia(privateJourney, state), privateJourney);
});
test('schema failures preserve previous storage and reject unrecognized report data', () => {
  const storage = memory(); storage.entries.set(REVIEW_SERVICE_KEY, '{broken'); assert.throws(() => readReviewServiceState(storage)); assert.equal(storage.writes, 0);
  assert.throws(() => assertReviewServiceState({ ...emptyReviewServiceState(), privateJourneys: [] }));
  const state = emptyReviewServiceState(); state.reports = [{ reportId: 'r', revision: 1, targetType: 'JOURNAL', targetId: 'j', category: 'CONTENT', original: '', status: 'OPEN', createdAt: '2026-10-05T00:00:00.000Z', decision: '', privatePrompt: 'hidden' }]; assert.throws(() => assertReviewServiceState(state));
});
test('API receipt validates parent context and does not send customer content or use local review storage', async () => {
  const original = globalThis.fetch, storage = memory(); let sent;
  const serverReport = { reportId: 'server-report', revision: 1, targetType: 'JOURNAL', targetId: journey.id, journalId: journey.id, category: 'CONTENT', original: '기타', status: 'OPEN', createdAt: '2026-10-05T00:00:00.000Z', receivedAt: '2026-10-05T00:00:00.000Z', reporterId: 'authenticated-user', decision: '' };
  globalThis.fetch = async (url, options) => { sent = { url, options }; return new Response(JSON.stringify({ report: serverReport, duplicate: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try {
    const adapter = createReportAdapter({ endpoint: '/api/reports', localReview: true, storage }); const result = await adapter.submit(target, 'OTHER', '확인', new AbortController().signal);
    assert.equal(result.mode, 'API'); assert.equal(storage.reads.length, 0); assert.equal(storage.writes, 0); assert.equal(sent.options.credentials, 'same-origin'); assert.ok(!sent.options.body.includes('PRIVATE_')); assert.ok(!sent.options.body.includes('공개 본문'));
    serverReport.journalId = 'wrong'; await assert.rejects(() => adapter.submit(target, 'OTHER', '', new AbortController().signal));
  } finally { globalThis.fetch = original; }
  assert.throws(() => createReportAdapter({ endpoint: 'https://other.example/reports' }));
});
test('approved English requires exact public source, original text and source version; draft/stale content stays original', () => {
  const state = emptyReviewServiceState(), journal = projectPublicJourney(journey);
  journal.english = 'Reviewed public story'; journal.translation.status = 'APPROVED'; state.publicJournals = [journal];
  assert.equal(reviewedPublicTranslation(state, `${journey.id}:story`, sourceVersion(journey.story), journey.story).translated, journal.english);
  assert.equal(reviewedPublicTranslation(state, `${journey.id}:title`, sourceVersion(journey.story), journey.story), null);
  assert.equal(reviewedPublicTranslation(state, `${journey.id}:story`, 'old-version', journey.story), null);
  assert.equal(reviewedPublicTranslation(state, `${journey.id}:story`, sourceVersion('changed'), 'changed'), null);
  journal.translation.status = 'REVIEW'; assert.equal(reviewedPublicTranslation(state, `${journey.id}:story`, sourceVersion(journey.story), journey.story), null);
  state.publishedPlaces = [{ ...place, reviewedEnglish: { original: place.description, translated: 'Reviewed description', sourceRevision: 2 } }];
  assert.equal(reviewedPublicTranslation(state, `place:${place.id}:description`, sourceVersion(place.description), place.description).translated, 'Reviewed description');
});
test('only explicitly selected public reactions enter the shared projection with nullable unprovided aggregates', () => {
  const storage = memory(); recordPublicCardReaction(journey, 'card', { id: 'local-self', name: '공개 이름' }, true, storage);
  recordPublicCardReaction(journey, 'card', { id: 'local-self', name: '공개 이름' }, true, storage);
  let projected = pullReviewAdminProjection(storage).publicJournals[0]; assert.equal(projected.cards[0].likes, 1); assert.equal(projected.cards[0].likeUsers.length, 1); assert.equal(projected.ownerVisibility, 'PUBLIC');
  recordPublicCheer(journey, 'local-self', 'LOVE', true, storage); recordPublicCheer(journey, 'local-self', 'LOVE', true, storage);
  projected = pullReviewAdminProjection(storage).publicJournals[0]; assert.equal(projected.reactionBreakdown.LOVE, 1); assert.equal(projected.reactionBreakdown.BEST, null); assert.equal(projected.reactionBreakdown.source, 'SAMPLE'); assert.equal(projected.metrics.copies, null);
  recordPublicCheer(journey, 'local-self', 'BEST', true, storage); projected = pullReviewAdminProjection(storage).publicJournals[0]; assert.equal(projected.reactionBreakdown.LOVE, 0); assert.equal(projected.reactionBreakdown.BEST, 1);
  assert.throws(() => recordPublicCardReaction({ ...journey, visibility: 'PRIVATE' }, 'card', { id: 'self', name: '이름' }, true, storage));
});
test('public pull preserves attribution and discards unexpected nested private metadata', () => {
  const storage = memory(); receiveLocalReviewReport(target, 'OTHER', '', 'local-self', storage);
  const state = readReviewServiceState(storage), journal = state.publicJournals[0];
  journal.translation.privatePrompt = 'HIDDEN_PROMPT'; journal.metrics = { cheers: null, copies: null, views: null, source: 'SAMPLE', privateBookings: ['HIDDEN_BOOKING'] }; journal.days[0].places[0].privateNote = 'HIDDEN_NOTE';
  storage.entries.set(REVIEW_SERVICE_KEY, JSON.stringify(state)); const safe = pullReviewAdminProjection(storage);
  assert.ok(!JSON.stringify(safe).includes('HIDDEN_')); assert.equal(safe.publicJournals[0].ownerVisibility, 'PUBLIC');
});
test('only complete explicitly public operational templates replace a source template identity', () => {
  const state = emptyReviewServiceState(), editorial = { ...projectPublicJourney(journey), sourceKind: 'EDITORIAL', sourceJournalId: 'source-home:curation', sourceTemplateId: 'curation' };
  state.operatingJournals = [{ ...editorial, ownerVisibility: 'PRIVATE' }]; assert.deepEqual(publicTemplatesFromReview(state, [place]), []);
  state.operatingJournals = [{ ...editorial, days: [] }]; assert.deepEqual(publicTemplatesFromReview(state, [place]), []);
  state.operatingJournals = [editorial]; const templates = publicTemplatesFromReview(state, [place]); assert.equal(templates[0].id, 'curation'); assert.equal(templates[0].sourceTripId, 'source-home:curation'); assert.equal(templates[0].places[0].id, place.id);
});
test('exposure time windows end exclusively and published metadata and order override the baseline', () => {
  const state = emptyReviewServiceState(), now = Date.parse('2026-10-05T00:00:00.000Z');
  state.publishedPlaces = [place]; state.exposures = [{ exposureId: 'e', revision: 1, channel: 'HOME_TRIP', targetId: 'source-home:curation', title: '운영 제목', introduction: '운영 소개', coverMediaId: 'photo-one', startsAt: '2026-10-04T00:00:00.000Z', endsAt: '2026-10-06T00:00:00.000Z', enabled: true, order: 1 }];
  const items = [{ id: 'other', title: '기본', summary: '', cover: '' }, { id: 'curation', sourceTripId: 'source-home:curation', title: '원본', summary: '원본 소개', cover: '/cover.jpg' }];
  const result = reviewExposureOrder(items, 'HOME_TRIP', state, now); assert.equal(result[0].id, 'curation'); assert.equal(result[0].title, '운영 제목'); assert.equal(result[0].summary, '운영 소개'); assert.equal(result[0].cover, '/one.jpg'); assert.equal(items[1].title, '원본');
  state.exposures[0].endsAt = '2026-10-05T00:00:00.000Z'; assert.deepEqual(reviewExposureOrder(items, 'HOME_TRIP', state, now).map(i => i.id), ['other']);
});
