import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { addPlanningPlaceCandidate, planningPlaceIdentity, planningPlaceRegion, selectPlanningPlaceCatalogue } from '../src/together/planningPlaces.ts';

const at = new Date('2026-11-10T12:00:00+09:00');
const scope = { groupId: 'family', activityId: 'dinner' };
const place = (id, area = '부산 해운대', extra = {}) => ({ id, kind: 'FOOD', name: `식당 ${id}`, area, address: `${area} 10`, lat: 35, lng: 129, image: '', description: '', duration: '', note: '개인 참고를 가져오지 않음', ...extra });
const places = [place('seoul', '서울 성동'), place('busan'), place('cafe', '부산 · 수영', { kind: 'CAFE', name: 'Coffee House' }), place('private', '부산', { personal: true })];
function fixture() {
  const state = createEmptyState('me', '사용자');
  state.members.push({ id: 'host', name: '모임장' });
  state.groups.push({ id: 'family', name: '가족', region: '부산', kind: 'FAMILY', ownerId: 'host', memberIds: ['me', 'host'], managerIds: [], archived: false, visibility: 'PRIVATE', introduction: '', cover: '', promotionPublished: false, interestPlaceIds: [] });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other', interestPlaceIds: ['seoul'] });
  state.activities.push({ id: 'dinner', groupId: 'family', kind: 'MEETUP', title: '저녁 약속', date: '2026-11-11', endDate: '', startTime: '18:30', meetingPoint: '기존 만나는 곳', venuePlaceId: 'seoul', description: '기존 소개', status: 'PLANNED', leadId: 'host', editorIds: [], participants: { me: 'MAYBE', host: 'JOINED' }, arrivedIds: ['host'], placeCandidateIds: [], revision: 4 });
  return state;
}

test('public catalogue search combines region, kind and case-insensitive text without private or duplicate records', () => {
  assert.equal(planningPlaceRegion(places[2]), '부산');
  assert.deepEqual(selectPlanningPlaceCatalogue([...places, places[0]], '', 'ALL', '', '부산').map(item => item.id), ['busan', 'cafe', 'seoul']);
  assert.deepEqual(selectPlanningPlaceCatalogue(places, 'COFFEE', 'CAFE', '부산').map(item => item.id), ['cafe']);
  assert.deepEqual(selectPlanningPlaceCatalogue(places, '', 'FOOD', '부산').map(item => item.id), ['busan']);
  assert.deepEqual(selectPlanningPlaceCatalogue(places, 'private'), []);
});

test('group-level add changes only the exact group candidate IDs and is idempotent', () => {
  const state = fixture(), before = structuredClone(state);
  assert.equal(addPlanningPlaceCandidate(state, 'me', { groupId: 'family' }, 'busan', undefined, places, at), 1);
  before.groups[0].interestPlaceIds = ['busan'];
  assert.deepEqual(state, before);
  addPlanningPlaceCandidate(state, 'me', { groupId: 'family' }, 'busan', undefined, places, at);
  assert.deepEqual(state, before);
});

test('ordinary members add exact-appointment candidates without changing venue, route, RSVP, chat or group saves', () => {
  const state = fixture(), before = structuredClone(state);
  assert.equal(addPlanningPlaceCandidate(state, 'me', scope, 'busan', 4, places, at), 2); // Existing confirmed venue is also available to a poll.
  before.activities[0].placeCandidateIds = ['busan']; before.activities[0].revision = 5;
  assert.deepEqual(state, before);
  addPlanningPlaceCandidate(state, 'me', scope, 'busan', 5, places, at);
  assert.deepEqual(state, before);
});

test('stale revision, missing revisions and cross-group IDs fail without partial mutation', () => {
  for (const [inputScope, revision] of [[scope, 3], [scope, undefined], [scope, NaN], [{ groupId: 'other', activityId: 'dinner' }, 4]]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => addPlanningPlaceCandidate(state, 'me', inputScope, 'busan', revision, places, at));
    assert.deepEqual(state, before);
  }
});

test('current membership, account identity and lifecycle are rechecked on every add', () => {
  const changes = [
    state => { state.groups[0].memberIds = ['host']; },
    state => { state.groups[0].blockedMemberIds = ['me']; },
    state => { state.members = state.members.filter(item => item.id !== 'me'); },
    state => { state.groups[0].archived = true; },
    state => { state.activities[0].status = 'CANCELLED'; },
    state => { state.activities[0].status = 'COMPLETED'; },
    state => { state.activities[0].date = '2026-11-09'; },
  ];
  for (const change of changes) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.throws(() => addPlanningPlaceCandidate(state, 'me', scope, 'busan', 4, places, at));
    assert.deepEqual(state, before);
  }
});

test('withdrawn and personal places cannot be silently copied, while full activity candidates keep their existing cap', () => {
  for (const placeId of ['withdrawn', 'private']) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => addPlanningPlaceCandidate(state, 'me', scope, placeId, 4, places, at));
    assert.deepEqual(state, before);
  }
  const state = fixture(); state.activities[0].placeCandidateIds = Array.from({ length: 40 }, (_, index) => `old-${index}`);
  const before = structuredClone(state);
  assert.throws(() => addPlanningPlaceCandidate(state, 'me', scope, 'busan', 4, places, at), /40/);
  assert.deepEqual(state, before);
});

test('same-venue aliases appear once and keep the already-shared canonical ID; different branches remain distinct', () => {
  const aliases = [place('first', '부산 기장', { name: '웨이브온 커피', address: '부산 기장군 장안읍 해맞이로 286' }), place('saved-alias', '부산 기장', { name: '웨이브온커피', address: '부산 기장군 장안읍 해맞이로286' }), place('other-branch', '부산 수영', { name: '웨이브온커피', address: '부산 수영구 광안해변로 100' })];
  const before = structuredClone(aliases);
  assert.deepEqual(selectPlanningPlaceCatalogue(aliases).map(item => item.id), ['first', 'other-branch']);
  assert.deepEqual(selectPlanningPlaceCatalogue(aliases, '', 'ALL', '', '', ['saved-alias']).map(item => item.id), ['saved-alias', 'other-branch']);
  assert.deepEqual(selectPlanningPlaceCatalogue(aliases, '웨이브온 커피', 'ALL', '', '', ['saved-alias']).map(item => item.id), ['saved-alias']);
  assert.deepEqual(aliases, before);
});

test('adding an alias of a shared venue is a no-op for both scopes, and a new branch is still addable', () => {
  const aliases = [place('original', '부산', { name: '우리-카페', address: '부산 해맞이로 286' }), place('alias', '부산', { name: '우리 카페', address: '부산 해맞이로286' }), place('branch', '부산', { name: '우리카페', address: '부산 해맞이로 287' })];
  for (const targetScope of [{ groupId: 'family' }, scope]) {
    const state = fixture();
    state.groups[0].interestPlaceIds = ['original'];
    state.activities[0].placeCandidateIds = ['original'];
    const before = structuredClone(state);
    addPlanningPlaceCandidate(state, 'me', targetScope, 'alias', targetScope.activityId ? 4 : undefined, aliases, at);
    assert.deepEqual(state, before);
    addPlanningPlaceCandidate(state, 'me', targetScope, 'branch', targetScope.activityId ? 4 : undefined, aliases, at);
    assert.deepEqual(targetScope.activityId ? state.activities[0].placeCandidateIds : state.groups[0].interestPlaceIds, ['original', 'branch']);
  }
});

test('missing addresses, different parcel numbers and stale aliases never bypass identity or revision safeguards', () => {
  const a = place('a', '부산', { name: '동네 카페', address: '' }), b = { ...a, id: 'b' };
  assert.equal(planningPlaceIdentity(a), undefined);
  assert.equal(selectPlanningPlaceCatalogue([a, b]).length, 2);
  const parcel = [place('one', '부산', { name: '동네카페', address: '부산 101-1' }), place('two', '부산', { name: '동네카페', address: '부산 1011' })];
  assert.equal(selectPlanningPlaceCatalogue(parcel).length, 2);
  const state = fixture(); state.activities[0].placeCandidateIds = ['one'];
  const before = structuredClone(state);
  assert.throws(() => addPlanningPlaceCandidate(state, 'me', scope, 'one', 3, parcel, at), /바뀌/);
  assert.deepEqual(state, before);
});

test('unshared exact aliases prefer an intact active place gallery, while an already-shared ID still wins', () => {
  const legacy = place('cover-only', '부산 기장', { name: '바다 커피', address: '부산 해맞이로 286', image: 'generic-beach.jpg' });
  const gallery = place('gallery', '부산 기장', { name: '바다커피', address: '부산 해맞이로286', photos: [{ placeId: 'gallery', sourceId: 'licensed-photo', image: 'actual-cafe.webp', alt: '카페 전경', caption: '', availability: 'available' }] });
  const branch = { ...gallery, id: 'another-branch', address: '부산 해맞이로 287' };
  const input = [legacy, gallery, branch], before = structuredClone(input);
  const catalogue = selectPlanningPlaceCatalogue(input);
  assert.deepEqual(catalogue.map(item => item.id), ['gallery', 'another-branch']);
  assert.equal(catalogue[0], gallery);
  assert.deepEqual(selectPlanningPlaceCatalogue(input, '', 'ALL', '', '', ['cover-only']).map(item => item.id), ['cover-only', 'another-branch']);
  assert.deepEqual(input, before);
});

test('withdrawn, empty, sourceless or wrong-place galleries cannot outrank the original catalogue record', () => {
  const legacy = place('legacy', '부산', { name: '동네 카페', address: '부산 10' });
  const photo = { placeId: 'alias', sourceId: 'source', image: 'photo.webp', alt: '', caption: '' };
  for (const changes of [{ availability: 'withdrawn' }, { image: ' ' }, { sourceId: ' ' }, { placeId: 'foreign' }, { placeId: undefined }]) {
    const alias = { ...legacy, id: 'alias', photos: [{ ...photo, ...changes }] };
    assert.deepEqual(selectPlanningPlaceCatalogue([legacy, alias]).map(item => item.id), ['legacy']);
  }
});
