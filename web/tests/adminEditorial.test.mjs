import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';
import { makeRegionSeed } from '../src/admin/regions.ts';
import { buildEditorialJournal, generateEditorialDraft, curatedPlaceIds, curatedIssues, memberGrade } from '../src/admin/editorialDraft.ts';
import { applyOpsCommand, OpsError, reportPhotoContext } from '../src/admin/opsDomain.ts';

const now = '2026-10-05T00:00:00.000Z', rights = { display: true, store: true, modify: false, ai: false };
const context = { actor: { operatorId: 'operator-admin', name: '관리자', role: 'ADMIN' }, now };
function place(id, kind = 'LANDMARK', region = 'kr-busan-haeundae', offset = 0) {
  const content = { regionId: region, kind, name: id, area: region.startsWith('kr-busan') ? '부산 해운대' : '제주 한림', address: '등록된 주소', description: `공개 출처의 ${id} 소개`, tags: ['산책'], operation: 'OPEN', rights, provider: '검수 자료 제공자', sourceUrl: 'https://example.com/place', checkedAt: '2026-10-05', location: { lat: 35.16 + offset, lng: 129.16, verified: true }, media: [{ mediaId: `photo:${id}`, type: 'PHOTO', url: '/admin-review.svg', caption: `${id} 사진`, alt: id, rights, withdrawn: false, provider: '사진 제공자', author: '사진 저자', sourceUrl: 'https://example.com/photo', license: '허용된 사진', licenseUrl: 'https://example.com/license', checkedAt: '2026-10-05' }] };
  return { placeId: id, revision: 1, state: 'PUBLISHED', revoked: false, draft: structuredClone(content), published: structuredClone(content) };
}
function state() { return { schemaVersion: 1, revision: 1, regions: makeRegionSeed(), places: [place('바다산책-1'), place('바다산책-2', 'LANDMARK', 'kr-busan-haeundae', .01), place('식당-1', 'FOOD'), place('식당-2', 'FOOD'), place('카페-1', 'CAFE'), place('카페-2', 'CAFE'), place('숙소-1', 'STAY'), place('제주장소', 'LANDMARK', 'kr-jeju-hallim')], ops: makeOpsSeed(), nearbyOverrides: [], audit: [], processedCommands: [], ai: {} }; }
const request = overrides => ({ curatedTripId: 'editorial-test', regionId: 'kr-busan', regionName: '부산', dayCount: 2, prompt: '바다 산책과 식사 카페 숙소 포함', now, ...overrides });

test('local generation creates independent private DAY draft from eligible places in the selected hierarchy', () => {
  const value = state(), before = structuredClone(value), draft = generateEditorialDraft(value, request());
  assert.deepEqual(value, before); assert.equal(draft.visibility, 'PRIVATE'); assert.equal(draft.generation.method, 'LOCAL_RULES');
  assert.equal(draft.days.length, 2); assert.deepEqual(draft.placeIds, curatedPlaceIds(draft.days)); assert.ok(!draft.placeIds.includes('제주장소'));
  assert.deepEqual(draft.days[0].visits.map(visit => visit.slot), ['morning', 'lunch', 'afternoon', 'stay']);
  assert.ok(draft.days[1].visits.every(visit => visit.slot !== 'stay'));
  assert.equal(draft.editorialJournal.authorName, 'Spotlog 운영'); assert.equal(draft.editorialJournal.sourceKind, 'EDITORIAL');
  assert.equal(draft.editorialJournal.days[0].places[0].description, before.places[0].published.description);
  assert.equal(draft.editorialJournal.cover.sourceCredit.author, '사진 저자');
  assert.equal(curatedIssues(value, draft).length, 0);
  for (const key of ['bookingFixed', 'planningPreferences', 'travelProgress', 'privateNote']) assert.equal(JSON.stringify(draft).includes(key), false);
});

test('prompt exclusions and requested dinner placement are respected without creating missing businesses', () => {
  const value = state(), noFood = generateEditorialDraft(value, request({ prompt: '음식점은 제외, 카페는 포함. 숙소 없이 천천히 산책' }));
  assert.ok(noFood.days.flatMap(day => day.visits).every(visit => !['식당-1', '식당-2', '숙소-1'].includes(visit.placeId)));
  const dinner = generateEditorialDraft(value, request({ prompt: '저녁 식사 포함' }));
  assert.ok(dinner.days.flatMap(day => day.visits).some(visit => visit.slot === 'dinner')); assert.ok(dinner.days.flatMap(day => day.visits).every(visit => visit.slot !== 'lunch'));
  value.places = value.places.filter(record => record.published.kind === 'LANDMARK');
  const missing = generateEditorialDraft(value, request()); assert.ok(missing.days.flatMap(day => day.visits).every(visit => visit.slot === 'morning'));
  assert.ok(missing.generation.notes.some(note => note.includes('없어 배치하지')));
});

test('generated cover belongs to a scheduled place rather than an unused candidate', () => {
  const value = state();
  value.places.unshift(place('배치하지-않는-식당', 'FOOD'));
  const draft = generateEditorialDraft(value, request({ dayCount: 1, prompt: '천천히 산책, 음식점 제외' }));
  assert.ok(!draft.placeIds.includes('배치하지-않는-식당'));
  assert.ok(draft.placeIds.some(id => draft.coverMediaId === `photo:${id}`));
  assert.equal(curatedIssues(value, draft).length, 0);
  const { revision, ...payload } = draft;
  applyOpsCommand(value, { kind: 'ops.curated.save', payload: { ...payload, visibility: 'PUBLIC' } }, context);
  assert.equal(value.ops.curatedTrips.find(trip => trip.curatedTripId === draft.curatedTripId).visibility, 'PUBLIC');
});

test('unverified, inactive, revoked places and withdrawn media never enter the draft', () => {
  const value = state(); value.places[0].published.location.verified = false;
  assert.throws(() => generateEditorialDraft(value, request()), /공개 랜드마크/);
  value.places[0].published.location.verified = true; value.places[0].published.media[0].withdrawn = true;
  const draft = generateEditorialDraft(value, request()); assert.equal(draft.days[0].visits[0].mediaId, undefined);
  assert.equal(draft.editorialJournal.days[0].places[0].image, '');
  value.places[0].state = 'INACTIVE'; assert.throws(() => generateEditorialDraft(value, request()), /공개 랜드마크/);
});

test('saving a generated draft stays private until an explicit publish command and uses revision conflicts', () => {
  const value = state(), draft = generateEditorialDraft(value, request()), { revision, ...payload } = draft;
  applyOpsCommand(value, { kind: 'ops.curated.save', payload }, context);
  let saved = value.ops.curatedTrips.find(trip => trip.curatedTripId === draft.curatedTripId);
  assert.equal(saved.visibility, 'PRIVATE'); assert.equal(saved.editorialJournal.ownerVisibility, 'PRIVATE');
  assert.equal(value.ops.journals.some(journal => journal.journalId === saved.editorialJournal.journalId), false);
  applyOpsCommand(value, { kind: 'ops.curated.save', payload: { ...payload, visibility: 'PUBLIC' }, entityRevision: saved.revision }, context);
  saved = value.ops.curatedTrips.find(trip => trip.curatedTripId === draft.curatedTripId); assert.equal(saved.visibility, 'PUBLIC');
  assert.equal(saved.editorialJournal.ownerVisibility, 'PUBLIC');
  assert.throws(() => applyOpsCommand(value, { kind: 'ops.curated.save', payload, entityRevision: 1 }, context), error => error instanceof OpsError && error.code === 'CONFLICT');
  assert.equal(value.ops.journals[0].authorId, 'review-member-1');
});

test('edited order/removal is retained while withdrawal and an empty DAY block publication', () => {
  const value = state(), draft = generateEditorialDraft(value, request());
  draft.days[0].visits.reverse(); draft.days[1].visits.splice(1, 1); draft.placeIds = curatedPlaceIds(draft.days);
  const { revision, ...payload } = draft;
  applyOpsCommand(value, { kind: 'ops.curated.save', payload }, context);
  const saved = value.ops.curatedTrips.find(trip => trip.curatedTripId === draft.curatedTripId);
  assert.deepEqual(saved.days, draft.days); assert.equal(saved.editorialJournal.days[0].places[0].id, draft.days[0].visits[0].placeId);
  value.places.find(record => record.placeId === saved.placeIds[0]).revoked = true;
  assert.throws(() => applyOpsCommand(value, { kind: 'ops.curated.save', payload: { ...payload, visibility: 'PUBLIC' }, entityRevision: saved.revision }, context), error => error.code === 'INELIGIBLE');
  const empty = generateEditorialDraft(state(), request()); empty.days[0].visits = []; empty.placeIds = curatedPlaceIds(empty.days);
  assert.ok(curatedIssues(state(), empty).some(issue => issue.includes('각 DAY')));
});

test('member grades require an actual server basis and unknown copies or views remain nullable', () => {
  const member = makeOpsSeed().members[0]; assert.equal(memberGrade(member), null);
  member.publicActivity = { journals: null, followers: null, copies: 1000, views: null, source: 'SAMPLE' }; assert.equal(memberGrade(member), null);
  member.publicActivity.source = 'SERVER'; assert.equal(memberGrade(member), '루트 메이커');
  member.publicActivity.copies = null; assert.equal(memberGrade(member), null); assert.equal(member.publicActivity.views, null);
});

test('rich public projections are fully redacted on private restoration while immutable source IDs remain', () => {
  const value = state(), journal = value.ops.journals[0], editorial = generateEditorialDraft(value, request()).editorialJournal;
  Object.assign(journal, { days: editorial.days, cover: editorial.cover, summary: '공개 요약', tags: ['공개태그'] });
  const sourceBefore = structuredClone(value.places), trash = value.ops.trash.find(record => record.kind === 'JOURNAL'); trash.publicJournalId = journal.journalId;
  applyOpsCommand(value, { kind: 'ops.trash.restore', trashId: trash.trashId, reason: '복원 검수', entityRevision: 1 }, context);
  assert.equal(journal.ownerVisibility, 'PRIVATE'); assert.equal(journal.original, ''); assert.deepEqual(journal.cards, []);
  for (const key of ['days', 'cover', 'summary', 'tags', 'metrics']) assert.equal(journal[key], undefined);
  assert.equal(journal.journalId, 'review-journal-1'); assert.deepEqual(value.places, sourceBefore);
});

test('operators are created as active records without credentials or sessions and need administrator permission', () => {
  const value = state(), command = { kind: 'ops.operator.create', payload: { operatorId: 'worker', name: '담당 운영자', role: 'OPERATOR' } };
  assert.throws(() => applyOpsCommand(value, command, { ...context, actor: { ...context.actor, role: 'OPERATOR' } }), error => error.code === 'FORBIDDEN');
  applyOpsCommand(value, command, context); const record = value.ops.operators.find(operator => operator.operatorId === 'worker');
  assert.equal(record.active, true); assert.deepEqual(record.sessions, []); assert.equal(record.password, undefined);
  assert.throws(() => applyOpsCommand(value, command, context), error => error.code === 'CONFLICT');
});

test('standalone discovered photo reports retain source context and resolve the registered place through the immutable source ID', () => {
  const value = state(), registered = value.places[0]; registered.placeId = 'registered-1'; registered.published.provenance = { origin: 'CATALOG', sourcePlaceId: '바다산책-1' };
  const photo = { id: 'photo:바다산책-1', image: '/admin-review.svg', caption: '발견 사진 신고', sourceCredit: { provider: '공개 사진 제공자', author: '사진 작성자', sourceUrl: 'https://example.com/actual-photo' } };
  const report = { reportId: 'photo-report', revision: 1, targetType: 'PHOTO', targetId: photo.id, placeId: '바다산책-1', mediaId: photo.id, targetLabel: '바다산책 발견 사진', photoSnapshot: photo, category: 'COPYRIGHT', original: '권리 확인 요청', status: 'OPEN', createdAt: now, decision: '' };
  const before = structuredClone(report), context = reportPhotoContext(value, report);
  assert.equal(context.place.placeId, 'registered-1'); assert.deepEqual(context.photo, photo); assert.equal(context.withdrawn, false); assert.deepEqual(report, before);
  registered.published.media[0].withdrawn = true; assert.equal(reportPhotoContext(value, report).withdrawn, true);
  assert.equal(report.photoSnapshot.sourceCredit.author, '사진 작성자'); assert.equal(report.status, 'OPEN');
});

test('editing a home recommendation preserves its original template reference and never retargets another source', () => {
  const value = state(), draft = generateEditorialDraft(value, request()); draft.sourceTemplateId = 'home-source-1'; draft.sourceKind = 'PUBLIC_SAMPLE';
  value.ops.curatedTrips.push({ ...draft, revision: 1 });
  const { revision, sourceTemplateId, sourceKind, ...payload } = draft;
  applyOpsCommand(value, { kind: 'ops.curated.save', payload, entityRevision: 1 }, context);
  const saved = value.ops.curatedTrips.find(trip => trip.curatedTripId === draft.curatedTripId);
  assert.equal(saved.sourceTemplateId, 'home-source-1'); assert.equal(saved.editorialJournal.sourceTemplateId, 'home-source-1'); assert.equal(saved.editorialJournal.sourceJournalId, draft.curatedTripId);
  assert.throws(() => applyOpsCommand(value, { kind: 'ops.curated.save', payload: { ...payload, sourceTemplateId: 'different-source' }, entityRevision: 2 }, context), error => error.code === 'INVALID');
  assert.equal(saved.visibility, 'PRIVATE');
});

test('private source editing shows original registered sample context while unverified places still block publication', () => {
  const value = state(), draft = generateEditorialDraft(value, request()); draft.sourceKind = 'PUBLIC_SAMPLE'; draft.sourceTemplateId = 'original-home-1';
  value.places[0].state = 'DRAFT'; delete value.places[0].published; value.places[0].draft.rights = { display: false, store: false, modify: false, ai: false };
  const privatePreview = buildEditorialJournal(value, draft, now);
  assert.equal(privatePreview.ownerVisibility, 'PRIVATE'); assert.equal(privatePreview.days[0].places[0].name, '바다산책-1'); assert.equal(privatePreview.days[0].places[0].photos[0].sourceCredit.author, '사진 저자');
  const { revision, ...payload } = draft; assert.throws(() => applyOpsCommand(value, { kind: 'ops.curated.save', payload: { ...payload, visibility: 'PUBLIC' } }, context), error => error.code === 'INELIGIBLE');
});
