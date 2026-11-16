import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { readPlaceAssessment, upsertPlaceFeedback, withdrawPlaceFeedback, savePlaceMenu, withdrawPlaceMenu, isPlaceAssessmentStateFields } from '../src/together/businessAssessments.ts';

const at = new Date('2026-11-10T12:00:00Z');
const place = { id: 'food', kind: 'FOOD', name: '음식점', area: '부산', address: '주소', lat: 35, lng: 129, image: '', description: '', note: '', duration: '' };
const catalogue = [place, { ...place, id: 'stay', kind: 'STAY', name: '숙소' }];
const scope = { groupId: 'group', activityId: 'activity', placeId: 'food' };
const input = { rating: 4, note: '대화하기 편했어요.', recommended: true, purposes: ['TEAM_DINNER'] };
function fixture() {
  const state = createEmptyState('owner', '나');
  state.members.push({ id: 'member', name: '멤버' }, { id: 'other', name: '다른 모임원' });
  state.groups.push({ id: 'group', name: '모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'member'], managerIds: [], archived: false, promotionPublished: false });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other-group', ownerId: 'other', memberIds: ['other'] });
  state.activities.push({ id: 'activity', groupId: 'group', title: '회식', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'other-activity' });
  return state;
}

test('new rooms have no invented rating and submitted recommendations count only exact current room records', () => {
  const state = fixture();
  assert.deepEqual(readPlaceAssessment(state, 'owner', scope, catalogue).summary, { reviewCount: 0, averageRating: undefined, recommendationCount: 0, purposeCounts: [] });
  upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  upsertPlaceFeedback(state, 'member', scope, { ...input, rating: 2, recommended: false }, catalogue, at);
  for (const elsewhere of [{ ...scope, activityId: 'other-activity' }, { groupId: 'group', placeId: 'food' }, { ...scope, placeId: 'stay' }]) upsertPlaceFeedback(state, 'owner', elsewhere, { ...input, rating: 5 }, catalogue, at);
  const result = readPlaceAssessment(state, 'owner', scope, catalogue);
  assert.equal(result.summary.reviewCount, 2);
  assert.equal(result.summary.averageRating, 3);
  assert.equal(result.summary.recommendationCount, 1);
  assert.deepEqual(result.summary.purposeCounts, [{ purpose: 'TEAM_DINNER', count: 1 }]);
  assert.equal(isTogetherState(state), true);
  assert.deepEqual(state.activities[0].placeCandidateIds, undefined, 'reviewing does not silently select a venue or add candidates');
});

test('one author updates the same review with a fresh revision instead of inflating the count', () => {
  const state = fixture(), id = upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  const before = structuredClone(state);
  assert.throws(() => upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at), /바뀌었/);
  assert.deepEqual(state, before);
  assert.equal(upsertPlaceFeedback(state, 'owner', scope, { ...input, rating: 5, expectedRevision: 1 }, catalogue, at), id);
  assert.equal(state.placeFeedback.length, 1);
  assert.equal(state.placeFeedback[0].revision, 2);
  assert.equal(readPlaceAssessment(state, 'owner', scope, catalogue).summary.averageRating, 5);
});

test('withdrawal removes the rating from the summary, retains an own revision and permits explicit restoration', () => {
  const state = fixture(), id = upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  withdrawPlaceFeedback(state, 'owner', scope, 1, at);
  const hidden = readPlaceAssessment(state, 'owner', scope, catalogue);
  assert.equal(hidden.summary.reviewCount, 0);
  assert.equal(hidden.ownReview.id, id);
  assert.ok(hidden.ownReview.withdrawnAt);
  assert.throws(() => withdrawPlaceFeedback(state, 'owner', scope, 2, at));
  assert.throws(() => upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at));
  upsertPlaceFeedback(state, 'owner', scope, { ...input, expectedRevision: 2 }, catalogue, at);
  assert.equal(state.placeFeedback[0].id, id);
  assert.equal(state.placeFeedback[0].withdrawnAt, undefined);
  assert.equal(state.placeFeedback[0].revision, 3);
});

test('foreign room, missing identity, nonmember, blocked and revoked member cannot read or write', () => {
  for (const modify of [
    s => { s.groups[0].blockedMemberIds = ['owner']; },
    s => { s.groups[0].memberIds = ['member']; },
    s => { s.members = s.members.filter(row => row.id !== 'owner'); },
  ]) {
    const state = fixture(); modify(state); const before = structuredClone(state);
    assert.throws(() => readPlaceAssessment(state, 'owner', scope, catalogue));
    assert.throws(() => upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at));
    assert.deepEqual(state, before);
  }
  const state = fixture();
  for (const [actor, target] of [['', scope], ['other', scope], ['owner', { ...scope, groupId: 'other-group' }], ['owner', { ...scope, activityId: 'missing' }]]) {
    assert.throws(() => readPlaceAssessment(state, actor, target, catalogue));
    assert.throws(() => upsertPlaceFeedback(state, actor, target, input, catalogue, at));
  }
});

test('ratings, purpose tags and photos are validated before mutating the room', () => {
  for (const bad of [
    { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: NaN }, { rating: '5' }, { note: 'x'.repeat(2001) },
    { recommended: 'yes' }, { purposes: ['SECRET'] }, { purposes: ['FAMILY', 'FAMILY'] },
    { photos: [{ id: 'photo', url: 'javascript:alert(1)', caption: '' }] },
  ]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => upsertPlaceFeedback(state, 'owner', scope, { ...input, ...bad }, catalogue, at));
    assert.deepEqual(state, before);
  }
});

test('catalogue withdrawals disable new writes, but current members can read and withdraw existing room evaluations', () => {
  const state = fixture(); upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  const result = readPlaceAssessment(state, 'owner', scope, []);
  assert.equal(result.canReview, false); assert.equal(result.placeAvailable, false); assert.equal(result.reviews.length, 1);
  assert.throws(() => upsertPlaceFeedback(state, 'owner', scope, { ...input, expectedRevision: 1 }, [], at));
  withdrawPlaceFeedback(state, 'owner', scope, 1, at);
});

test('only this appointment shared route can resolve a private snapshot absent from the current catalogue', () => {
  const state = fixture(), personal = { ...place, id: 'private-snapshot', personal: true };
  const target = { ...scope, placeId: personal.id };
  assert.equal(readPlaceAssessment(state, 'owner', target, [personal]).canReview, false);
  state.activities[1].journey = { days: [{ places: [personal] }] };
  assert.equal(readPlaceAssessment(state, 'owner', target, []).canReview, false);
  state.activities[0].journey = { days: [{ places: [personal] }] };
  upsertPlaceFeedback(state, 'owner', target, input, [], at);
  assert.equal(readPlaceAssessment(state, 'owner', target, []).summary.reviewCount, 1);
});

test('completed meetings accept after-event feedback and retained temporary history keeps reviews editable, not menus', () => {
  const state = fixture(); state.activities[0].status = 'COMPLETED';
  upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  state.groups[0].archived = true;
  assert.equal(readPlaceAssessment(state, 'owner', scope, catalogue).canReview, false);
  state.groups[0].temporaryRoom = { purpose: 'DINNER', closedAt: at.toISOString(), closeReason: 'EXPIRED', disposition: 'ARCHIVE' };
  const result = readPlaceAssessment(state, 'owner', scope, catalogue);
  assert.equal(result.canReview, true); assert.equal(result.canMenuEdit, false);
  upsertPlaceFeedback(state, 'owner', scope, { ...input, expectedRevision: 1 }, catalogue, at);
  assert.throws(() => savePlaceMenu(state, 'owner', scope, { name: '코스', priceText: '확인 필요', note: '' }, catalogue, at));
});

test('expiry stops menu changes even before the next automatic room sweep, without blocking after-event feedback', () => {
  const state = fixture();
  state.groups[0].temporaryRoom = { purpose: 'BUSINESS', expiresAt: '2026-11-10T11:59:00Z' };
  const result = readPlaceAssessment(state, 'owner', scope, catalogue, at);
  assert.equal(result.canMenuEdit, false); assert.equal(result.canReview, true);
  const before = structuredClone(state);
  assert.throws(() => savePlaceMenu(state, 'owner', scope, { name: '코스', priceText: '', note: '' }, catalogue, at));
  assert.deepEqual(state, before);
  upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
});

test('cancelled appointments deny new ratings and soft-trash denies reads and every feedback/menu mutation', () => {
  const state = fixture(); upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  const menu = savePlaceMenu(state, 'owner', scope, { name: '코스', priceText: '', note: '' }, catalogue, at);
  state.activities[0].status = 'CANCELLED';
  assert.equal(readPlaceAssessment(state, 'owner', scope, catalogue).canReview, false);
  assert.throws(() => upsertPlaceFeedback(state, 'owner', scope, { ...input, expectedRevision: 1 }, catalogue, at));
  state.groups[0].temporaryRoom = { purpose: 'DINNER', closedAt: at.toISOString(), closeReason: 'EXPIRED', disposition: 'TRASH', trashedAt: at.toISOString() };
  const before = structuredClone(state);
  assert.throws(() => readPlaceAssessment(state, 'owner', scope, catalogue));
  assert.throws(() => withdrawPlaceFeedback(state, 'owner', scope, 1, at));
  assert.throws(() => withdrawPlaceMenu(state, 'owner', scope, menu, 1, at));
  assert.throws(() => savePlaceMenu(state, 'owner', scope, { name: '다른 코스', priceText: '', note: '' }, catalogue, at));
  assert.deepEqual(state, before);
});

test('menu information preserves member source, checked date and literal price without inventing official facts', () => {
  const state = fixture(), photos = [{ id: 'photo', url: '/shared-menu.jpg', caption: '직접 확인한 메뉴판' }];
  const id = savePlaceMenu(state, 'owner', scope, { name: '  저녁 코스  ', priceText: '  문의 후 확인  ', note: '알레르기는 가게에 확인', sourceUrl: 'https://example.com/menu', checkedOn: '2026-11-10', photos }, catalogue, at);
  photos[0].caption = '다른 메모';
  const row = readPlaceAssessment(state, 'member', scope, catalogue).menus[0];
  assert.equal(row.id, id); assert.equal(row.authorId, 'owner'); assert.equal(row.priceText, '문의 후 확인'); assert.equal(row.name, '저녁 코스');
  assert.equal(row.photos[0].caption, '직접 확인한 메뉴판'); assert.equal(row.sourceUrl, 'https://example.com/menu'); assert.equal(row.checkedOn, '2026-11-10');
  row.photos[0].caption = '읽기 결과 수정';
  assert.equal(state.placeMenus[0].photos[0].caption, '직접 확인한 메뉴판');
  assert.equal(isTogetherState(state), true);
});

test('menus require original author, exact scope and current revision; withdrawal is recoverable with the same record', () => {
  const state = fixture(), draft = { name: '객실', priceText: '날짜별 문의', note: '' };
  const id = savePlaceMenu(state, 'owner', scope, draft, catalogue, at);
  for (const [actor, target, change] of [['member', scope, { id, expectedRevision: 1 }], ['owner', { ...scope, activityId: 'other-activity' }, { id, expectedRevision: 1 }], ['owner', scope, { id, expectedRevision: 0 }]]) {
    const before = structuredClone(state);
    assert.throws(() => savePlaceMenu(state, actor, target, { ...draft, ...change }, catalogue, at));
    assert.deepEqual(state, before);
  }
  assert.throws(() => savePlaceMenu(state, 'owner', scope, draft, catalogue, at), /이미 공유/);
  withdrawPlaceMenu(state, 'owner', scope, id, 1, at);
  assert.equal(readPlaceAssessment(state, 'owner', scope, catalogue).menus.length, 0);
  assert.equal(savePlaceMenu(state, 'owner', scope, { ...draft, id, expectedRevision: 2 }, catalogue, at), id);
  assert.equal(state.placeMenus[0].revision, 3);
});

test('unsafe sources, impossible or future check dates and excessively long menu fields fail atomically', () => {
  for (const bad of [{ name: '' }, { name: 'x'.repeat(101) }, { priceText: 'x'.repeat(81) }, { note: 'x'.repeat(601) }, { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://user:secret@example.com' }, { checkedOn: '2026-02-30' }, { checkedOn: '2026-11-11' }]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => savePlaceMenu(state, 'owner', scope, { name: '코스', priceText: '', note: '', ...bad }, catalogue, at));
    assert.deepEqual(state, before);
  }
});

test('optional persisted fields accept legacy states and reject malformed or duplicate author ratings', () => {
  const state = fixture(); assert.equal(isPlaceAssessmentStateFields(state), true); assert.equal(isTogetherState(state), true);
  upsertPlaceFeedback(state, 'owner', scope, input, catalogue, at);
  for (const mutate of [s => { s.placeFeedback[0].rating = 9; }, s => { s.placeFeedback.push({ ...s.placeFeedback[0], id: 'duplicate-author' }); }, s => { s.placeFeedback[0].activityId = ''; }, s => { s.placeMenus = {}; }]) {
    const candidate = structuredClone(state); mutate(candidate);
    assert.equal(isPlaceAssessmentStateFields(candidate), false); assert.equal(isTogetherState(candidate), false);
  }
  const other = structuredClone(state); other.placeFeedback.push({ ...other.placeFeedback[0], id: 'different-room', activityId: 'other-activity' });
  assert.equal(isTogetherState(other), true);
});
