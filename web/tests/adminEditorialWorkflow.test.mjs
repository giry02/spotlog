import test from 'node:test';
import assert from 'node:assert/strict';
import { curatedDraftTarget, curatedMainExposureDraft } from '../src/admin/editorialWorkflow.ts';
import { generateEditorialDraft } from '../src/admin/editorialDraft.ts';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';
import { makeRegionSeed } from '../src/admin/regions.ts';
import { applyOpsCommand, activeExposures } from '../src/admin/opsDomain.ts';

const now = '2026-10-12T00:00:00.000Z';
const context = { actor: { operatorId: 'operator-admin', name: '관리자', role: 'ADMIN' }, now };
const rights = { display: true, store: true, modify: false, ai: false };
function fixture() {
  const places = ['바닷길', '공원'].map((name, index) => {
    const content = {
      kind: 'LANDMARK', name, regionId: 'kr-busan-haeundae', area: '부산 해운대', address: `부산 해운대구 등록 주소 ${index}`, description: '출처를 확인한 장소 소개', operation: 'OPEN', tags: ['산책'],
      location: { lat: 35.16 + index * 0.01, lng: 129.16, verified: true }, rights, provider: '등록 자료', sourceUrl: 'https://example.com/place', checkedAt: '2026-10-12',
      media: [{ mediaId: `photo:${index}`, type: 'PHOTO', url: '/admin-review.svg', caption: name, alt: name, rights, withdrawn: false, provider: '사진 제공자', sourceUrl: 'https://example.com/photo' }],
    };
    return { placeId: `place:${index}`, state: 'PUBLISHED', revision: 1, revoked: false, draft: structuredClone(content), published: structuredClone(content) };
  });
  const state = { schemaVersion: 1, revision: 1, regions: makeRegionSeed(), places, ops: makeOpsSeed(), nearbyOverrides: [], audit: [], processedCommands: [], ai: {} };
  const draft = generateEditorialDraft(state, { curatedTripId: 'curated:busan', regionId: 'kr-busan', regionName: '부산', dayCount: 1, prompt: '산책만, 식당 카페 숙소 제외', now });
  const { revision, ...payload } = draft;
  applyOpsCommand(state, { kind: 'ops.curated.save', payload: { ...payload, visibility: 'PUBLIC' } }, context);
  return { state, trip: state.ops.curatedTrips.find(record => record.curatedTripId === draft.curatedTripId) };
}

test('opening main after recommendation publication selects HOME_TRIP but does not publish or mutate data', () => {
  const { state, trip } = fixture(), before = structuredClone(state);
  const entry = curatedMainExposureDraft(state, trip, 'exposure:new');
  assert.equal(entry.channel, 'HOME_TRIP'); assert.equal(entry.targetId, trip.curatedTripId);
  assert.equal(entry.title, trip.title); assert.equal(entry.enabled, false); assert.equal(entry.revision, 0);
  assert.deepEqual(state, before); assert.ok(entry.coverMediaId.startsWith('photo:'));
  assert.equal(activeExposures(state, now).some(item => item.targetId === trip.curatedTripId), false);
});

test('editing an existing main placement keeps the exact period, order, cover, status and revision', () => {
  const { state, trip } = fixture();
  const existing = { ...curatedMainExposureDraft(state, trip, 'exposure:scheduled'), revision: 4, title: '기존 홈 소개', enabled: false, startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z', order: 9 };
  state.ops.exposures.push(existing);
  const selected = curatedMainExposureDraft(state, trip, 'exposure:ignored');
  assert.deepEqual(selected, existing); selected.title = '입력 중'; assert.equal(existing.title, '기존 홈 소개');
});

test('private, removed and rights-withdrawn recommendations cannot start main publication', () => {
  const { state, trip } = fixture();
  const privateTrip = structuredClone(trip); privateTrip.curatedTripId = 'private'; privateTrip.visibility = 'PRIVATE'; state.ops.curatedTrips.push(privateTrip);
  assert.throws(() => curatedMainExposureDraft(state, privateTrip, 'e'), /공개/);
  assert.throws(() => curatedMainExposureDraft(state, { ...trip, curatedTripId: 'missing' }, 'e'), /공개/);
  state.places[0].revoked = true;
  assert.throws(() => curatedMainExposureDraft(state, trip, 'e'), /공개/);
});

test('main ordering appends beyond the highest HOME_TRIP order without using other channel positions', () => {
  const { state, trip } = fixture();
  state.ops.exposures.push({ exposureId: 'older', channel: 'HOME_TRIP', targetId: 'other-trip', order: 50 });
  state.ops.exposures.push({ exposureId: 'photo', channel: 'DISCOVERY_PHOTO', targetId: 'place:0', order: 900 });
  assert.equal(curatedMainExposureDraft(state, trip, 'new').order, 51);
});

test('new regional draft keys are separate while existing recommendations do not change with the global region', () => {
  assert.notEqual(curatedDraftTarget(undefined, 'kr-busan'), curatedDraftTarget(undefined, 'kr-jeju'));
  assert.equal(curatedDraftTarget('saved:trip', 'kr-busan'), curatedDraftTarget('saved:trip', 'kr-jeju'));
  assert.equal(curatedDraftTarget(undefined, undefined), 'new:all');
});
