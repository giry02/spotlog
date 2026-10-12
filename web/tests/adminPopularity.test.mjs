import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';
import { activeExposures, applyOpsCommand, exposureIssues, mainExposureDraft, memberDeletionTransitions, popularContent } from '../src/admin/opsDomain.ts';
import { matchesAdminDto } from '../src/admin/contractGuard.ts';

const now = '2026-10-09T01:00:00.000Z', rights = { display: true, store: true, modify: false, ai: false };
const context = { actor: { operatorId: 'operator-admin', name: '검수 관리자', role: 'ADMIN' }, now };
function place(placeId, name, kind = 'LANDMARK') {
  const content = { name, description: `${name} 공개 소개`, area: '부산', kind, operation: 'OPEN', rights, location: { lat: 35, lng: 129, verified: true }, media: [{ mediaId: `photo:${placeId}`, type: 'PHOTO', url: '/admin-review.svg', rights, withdrawn: false }] };
  return { placeId, state: 'PUBLISHED', revision: 1, revoked: false, draft: structuredClone(content), published: structuredClone(content) };
}
function state() { return { schemaVersion: 1, revision: 1, places: [place('review-landmark', '검수 전망대'), place('review-landmark-2', '검수 공원'), place('review-food', '검수 식당', 'FOOD')], ops: makeOpsSeed(), audit: [], ai: {}, nearbyOverrides: [], processedCommands: [] }; }

test('local popularity uses clearly sourced fixed samples; API never falls back to sample or device records', () => {
  const value = state(), before = structuredClone(value);
  assert.deepEqual(popularContent(value, 'LOCAL', 'LANDMARK').map(item => item.saveCount), [128, 96]);
  assert.ok(popularContent(value, 'LOCAL', 'LANDMARK').every(item => item.source === 'SAMPLE'));
  assert.equal(popularContent(value, 'LOCAL', 'PLACE').length, 3);
  assert.deepEqual(popularContent(value, 'API', 'LANDMARK'), []);
  assert.deepEqual(value, before);
  delete value.ops.popularity;
  assert.equal(popularContent(value, 'LOCAL', 'LANDMARK').length, 2);
  assert.deepEqual(popularContent(value, 'API', 'LANDMARK'), []);
});

test('server popularity sorts saves and excludes malformed counts, private journals and missing targets', () => {
  const value = state();
  value.ops.popularity = { basis: 'SAVES', source: 'SERVER', observedAt: now, items: [
    { targetType: 'PLACE', targetId: 'review-landmark', saveCount: 4 }, { targetType: 'PLACE', targetId: 'review-landmark-2', saveCount: 12 },
    { targetType: 'PLACE', targetId: 'review-food', saveCount: -1 }, { targetType: 'PLACE', targetId: 'missing', saveCount: 900 },
    { targetType: 'JOURNAL', targetId: 'review-journal-1', saveCount: 42 }, { targetType: 'JOURNAL', targetId: 'review-journal-2', saveCount: 99 },
  ] };
  assert.deepEqual(popularContent(value, 'API', 'PLACE').map(item => item.targetId), ['review-landmark-2', 'review-landmark']);
  assert.deepEqual(popularContent(value, 'API', 'JOURNAL').map(item => item.targetId), ['review-journal-1']);
  assert.ok(popularContent(value, 'API', 'JOURNAL').every(item => item.source === 'SERVER'));
  value.ops.journals[0].moderation = 'HIDDEN'; assert.deepEqual(popularContent(value, 'API', 'JOURNAL'), []);
});

test('main publication reuses exposure validation and source content without writing popularity', () => {
  const value = state(), aggregate = structuredClone(value.ops.popularity), placesBefore = structuredClone(value.places);
  const candidate = popularContent(value, 'LOCAL', 'LANDMARK')[0], draft = mainExposureDraft(value, candidate, 'main-exposure');
  assert.equal(draft.channel, 'HOME_PLACE'); assert.equal(draft.coverMediaId, 'photo:review-landmark'); assert.deepEqual(exposureIssues(value, draft), []);
  const { revision, ...payload } = draft;
  applyOpsCommand(value, { kind: 'ops.exposure.save', payload }, context);
  assert.equal(activeExposures(value, now, 'HOME_PLACE').length, 1);
  assert.deepEqual(value.ops.popularity, aggregate); assert.deepEqual(value.places, placesBefore);
  value.places[0].revokedMediaIds = [draft.coverMediaId];
  assert.equal(activeExposures(value, now, 'HOME_PLACE').length, 0);
  assert.ok(exposureIssues(value, draft).some(issue => issue.includes('대표 미디어')));
  value.places[0].revokedMediaIds = []; value.places[0].published.media[0].type = 'VIDEO';
  assert.ok(exposureIssues(value, draft).some(issue => issue.includes('실제 사진')));
  value.places[0].published.media[0].type = 'PHOTO'; value.places[0].published.provenance = { origin: 'SYNTHETIC' };
  assert.equal(activeExposures(value, now, 'HOME_PLACE').length, 0);
  assert.ok(exposureIssues(value, draft).some(issue => issue.includes('가상 장소')));
});

test('existing main exposure retains ID, title, introduction, period and order, with no duplicate', () => {
  const value = state(), candidate = popularContent(value, 'LOCAL', 'LANDMARK')[0];
  const previous = { ...mainExposureDraft(value, candidate, 'existing'), revision: 2, title: '운영자 편집 제목', introduction: '운영자 편집 소개', enabled: false, order: 7, startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z' };
  value.ops.exposures.push(previous);
  assert.deepEqual(mainExposureDraft(value, candidate, 'new-id'), { ...previous, enabled: true });
  assert.equal(value.ops.exposures.length, 1);
  const journalDraft = mainExposureDraft(value, popularContent(value, 'LOCAL', 'JOURNAL')[0], 'journal-main');
  assert.equal(journalDraft.channel, 'HOME_JOURNAL');
  assert.ok(exposureIssues(value, journalDraft).some(issue => issue.includes('가상 여행기')));
});

test('deletion selections follow the same permitted transitions as persistence, including terminal withdrawal', () => {
  const value = state(), member = value.ops.members[1];
  assert.deepEqual(memberDeletionTransitions('RECEIVED'), ['VERIFYING', 'WITHDRAWN']);
  assert.throws(() => applyOpsCommand(value, { kind: 'ops.member.deletion', memberId: member.memberId, status: 'READY', reason: '확인', entityRevision: member.revision }, context), error => error.code === 'INVALID');
  applyOpsCommand(value, { kind: 'ops.member.deletion', memberId: member.memberId, status: 'VERIFYING', reason: '확인 시작', entityRevision: member.revision }, context);
  assert.deepEqual(memberDeletionTransitions(member.deletionRequest.status), ['READY', 'WITHDRAWN']);
  applyOpsCommand(value, { kind: 'ops.member.deletion', memberId: member.memberId, status: 'WITHDRAWN', reason: '요청 철회', entityRevision: member.revision }, context);
  assert.deepEqual(memberDeletionTransitions(member.deletionRequest.status), []);
  assert.equal(member.state, 'ACTIVE');
});

test('aggregate contract rejects invalid counts and exposure commands reject forged popularity', () => {
  const snapshot = { basis: 'SAVES', source: 'SERVER', observedAt: now, items: [{ targetType: 'PLACE', targetId: 'p', saveCount: 0 }] };
  assert.equal(matchesAdminDto('OpsPopularitySnapshot', snapshot), true);
  for (const count of [-1, .5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(matchesAdminDto('OpsPopularitySnapshot', { ...snapshot, items: [{ ...snapshot.items[0], saveCount: count }] }), false);
  const value = state(), draft = mainExposureDraft(value, popularContent(value, 'LOCAL', 'LANDMARK')[0], 'main-test'), { revision, ...payload } = draft;
  const command = { kind: 'ops.exposure.save', payload, expectedRevision: 1, idempotencyKey: 'main-test' };
  assert.equal(matchesAdminDto('AdminCommand', command), true);
  assert.equal(matchesAdminDto('AdminCommand', { ...command, payload: { ...payload, saveCount: 9999 } }), false);
});
