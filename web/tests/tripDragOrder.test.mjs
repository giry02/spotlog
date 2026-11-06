import test from 'node:test';
import assert from 'node:assert/strict';
import { canDragPlanVisit, movePlanVisitBefore, planVisitGroups } from '../src/tripPlan.ts';

const visit = (id, kind = 'LANDMARK', anchorVisitId, extra = {}) => ({
  id: `place-${id}`, visitId: id, kind, name: id, area: '부산 중구', address: '부산',
  lat: 35.1, lng: 129.03, image: '', description: `${id} 설명`, note: `${id} 개인 메모`,
  duration: '30분', ...(anchorVisitId ? { anchorVisitId } : {}), ...extra,
});
const day = (places, dayId = 'day-one') => ({
  dayId, day: 1, date: '2026-10-12', title: '부산 여행', story: '', places,
  blocks: places.map(place => ({ id: `block-${place.visitId}`, type: 'PLACE', placeId: place.id, visitId: place.visitId })),
});
const setup = (places = [visit('a'), visit('a-food', 'FOOD', 'a', { planningSlot: 'lunch', time: '12:00' }), visit('b'), visit('c'), visit('stay', 'STAY', undefined, { bookingFixed: true, stayDayIds: ['day-one'], time: '19:00' })]) => ({
  id: 'drag-trip', purpose: 'PLAN', isMine: true, visibility: 'PRIVATE', planStage: 'DRAFT',
  title: '부산 여행', region: '부산', duration: '1박 2일', dateRange: '2026-10-12',
  status: 'PLANNING', cover: '', summary: '', story: '', author: '나', saves: 0, views: 0, tags: [],
  days: [day(places), { ...day([visit('other-day')], 'day-two'), day: 2, date: '2026-10-13' }],
});
const order = trip => trip.days[0].places.map(place => place.visitId);

test('groups include every linked visit and preserve independent food/cafe bases and visit identity', () => {
  const route = day([visit('landmark'), visit('lunch', 'FOOD', 'landmark'), visit('coffee', 'CAFE', 'landmark'), visit('dinner', 'FOOD'), visit('dessert', 'CAFE', 'dinner'), visit('stay', 'STAY')]);
  assert.deepEqual(planVisitGroups(route).map(group => group.map(place => place.visitId)), [['landmark', 'lunch', 'coffee'], ['dinner', 'dessert'], ['stay']]);
  assert.equal(canDragPlanVisit(route, 'coffee'), true);
  assert.equal(canDragPlanVisit(route, 'dessert'), true);
  assert.equal(canDragPlanVisit(route, 'stay'), false);
  assert.equal(canDragPlanVisit(route, 'missing'), false);
});

test('dragging a landmark to the end carries meals and stops before fixed lodging', () => {
  const original = setup(), baseline = structuredClone(original);
  const result = movePlanVisitBefore(original, 'day-one', 'a', null);
  assert.deepEqual(order(result), ['b', 'c', 'a', 'a-food', 'stay']);
  assert.equal(result.days[0].places[3].anchorVisitId, 'a');
  assert.equal(result.days[0].places.at(-1), original.days[0].places.at(-1));
  assert.equal(result.days[1], original.days[1]);
  assert.deepEqual(result.days[0].blocks.map(block => block.visitId), order(result));
  assert.deepEqual(new Set(result.days[0].blocks.map(block => block.id)), new Set(original.days[0].blocks.map(block => block.id)));
  assert.deepEqual(original, baseline);
});

test('a linked source and a linked destination resolve whole groups, without reparenting', () => {
  const original = setup([visit('a'), visit('a-food', 'FOOD', 'a'), visit('b'), visit('b-coffee', 'CAFE', 'b'), visit('c')]);
  const result = movePlanVisitBefore(original, 'day-one', 'b-coffee', 'a-food');
  assert.deepEqual(order(result), ['b', 'b-coffee', 'a', 'a-food', 'c']);
  assert.equal(result.days[0].places[1].anchorVisitId, 'b');
  assert.equal(result.days[0].places[3].anchorVisitId, 'a');
});

test('dropping inside the same group or at its existing boundary is an exact no-op', () => {
  const original = setup();
  for (const target of ['a', 'a-food', 'b']) assert.equal(movePlanVisitBefore(original, 'day-one', 'a-food', target), original);
  assert.equal(movePlanVisitBefore(original, 'day-one', 'c', null), original);
  assert.equal(movePlanVisitBefore(original, 'day-one', 'c', 'stay'), original);
});

test('append without lodging and repeated visits to one business keep separate meal slots', () => {
  const original = setup([visit('lunch', 'FOOD', undefined, { id: 'same-restaurant', planningSlot: 'lunch' }), visit('cafe', 'CAFE'), visit('dinner', 'FOOD', undefined, { id: 'same-restaurant', planningSlot: 'dinner' })]);
  const result = movePlanVisitBefore(original, 'day-one', 'lunch', null);
  assert.deepEqual(order(result), ['cafe', 'dinner', 'lunch']);
  assert.equal(result.days[0].places[1].planningSlot, 'dinner');
  assert.equal(result.days[0].places[2].planningSlot, 'lunch');
  assert.equal(new Set(order(result)).size, 3);
});

test('personal notes, time, candidates, progress and non-place block positions remain intact', () => {
  const original = setup();
  const text = { id: 'text', type: 'TEXT', body: '작성한 글' }, image = { id: 'image', type: 'IMAGE', image: '/original.jpg', caption: '원본 사진' };
  original.days[0].blocks.splice(1, 0, text);
  original.days[0].blocks.splice(4, 0, image);
  original.businessCandidates = [{ id: 'candidate', dayId: 'day-one', anchorVisitId: 'a', kind: 'CAFE', selectedId: '__skip__', options: [{ place: visit('candidate-coffee', 'CAFE'), fixed: false }] }];
  original.travelProgress = { dayId: 'day-one', visitId: 'a-food', visits: { 'a': { status: 'done', recordedAt: '2026-10-12T10:00:00Z' } } };
  const result = movePlanVisitBefore(original, 'day-one', 'c', 'a');
  assert.equal(result.days[0].blocks[1], text);
  assert.equal(result.days[0].blocks[4], image);
  assert.deepEqual(result.days[0].blocks.filter(block => block.type === 'PLACE').map(block => block.visitId), order(result));
  assert.equal(result.businessCandidates, original.businessCandidates);
  assert.equal(result.travelProgress, original.travelProgress);
  for (const place of result.days[0].places) assert.equal(place, original.days[0].places.find(prior => prior.visitId === place.visitId));
  assert.equal(result.days[0].places.find(place => place.visitId === 'a-food').time, '12:00');
});

test('any lodging or fixed visit group rejects drag, even when invoked through a linked child', () => {
  const original = setup([visit('a'), visit('a-food', 'FOOD', 'a', { bookingFixed: true }), visit('b'), visit('stay', 'STAY')]);
  for (const source of ['a', 'a-food', 'stay']) {
    assert.equal(canDragPlanVisit(original.days[0], source), false);
    assert.throws(() => movePlanVisitBefore(original, 'day-one', source, 'b'), /숙소|고정/);
  }
});

test('fixed groups are crossing barriers but allow reorder within the same side', () => {
  const original = setup([visit('a'), visit('b'), visit('fixed', 'FOOD', undefined, { bookingFixed: true }), visit('c'), visit('d'), visit('stay', 'STAY')]);
  assert.throws(() => movePlanVisitBefore(original, 'day-one', 'a', 'c'), /앞뒤/);
  assert.throws(() => movePlanVisitBefore(original, 'day-one', 'c', 'fixed'), /앞뒤/);
  assert.throws(() => movePlanVisitBefore(original, 'day-one', 'a', null), /앞뒤/);
  assert.deepEqual(order(movePlanVisitBefore(original, 'day-one', 'b', 'a')), ['b', 'a', 'fixed', 'c', 'd', 'stay']);
  assert.deepEqual(order(movePlanVisitBefore(original, 'day-one', 'c', null)), ['a', 'b', 'fixed', 'd', 'c', 'stay']);
});

test('interior lodging cannot be crossed and several terminal lodging records stay at the end', () => {
  const interior = setup([visit('a'), visit('stay', 'STAY'), visit('b')]);
  assert.throws(() => movePlanVisitBefore(interior, 'day-one', 'a', null), /앞뒤/);
  assert.throws(() => movePlanVisitBefore(interior, 'day-one', 'b', 'stay'), /앞뒤/);
  const terminal = setup([visit('a'), visit('b'), visit('stay', 'STAY'), visit('stay-two', 'STAY')]);
  assert.deepEqual(order(movePlanVisitBefore(terminal, 'day-one', 'a', null)), ['b', 'a', 'stay', 'stay-two']);
});

test('invalid IDs and a visit or target on another DAY are rejected without changing data', () => {
  const original = setup(), baseline = structuredClone(original);
  for (const [dayId, source, target] of [['deleted-day', 'a', 'b'], ['day-one', 'deleted', 'b'], ['day-one', 'a', 'deleted'], ['day-one', 'other-day', 'a'], ['day-one', 'a', 'other-day']]) {
    assert.throws(() => movePlanVisitBefore(original, dayId, source, target), /바뀌었어요/);
  }
  assert.deepEqual(original, baseline);
});

test('only the owner of a live private PLAN can reorder', () => {
  const original = setup();
  for (const patch of [{ isMine: false }, { purpose: 'JOURNAL' }, { visibility: 'PUBLIC' }, { trash: { deletedAt: '2026-10-12T00:00:00Z', expiresAt: '2027-04-12T00:00:00Z', ownerId: 'owner', previousVisibility: 'PRIVATE', previousStatus: 'PLANNING' } }]) {
    assert.throws(() => movePlanVisitBefore({ ...original, ...patch }, 'day-one', 'a', 'c'), /비공개 여행/);
  }
});

test('malformed links or ambiguous visit identity cannot cause a silent detach or merge', () => {
  const cases = [
    [visit('a'), visit('b'), visit('a-food', 'FOOD', 'a')],
    [visit('orphan', 'FOOD', 'missing'), visit('b')],
    [visit('a', 'FOOD', 'b'), visit('b', 'CAFE', 'a')],
    [visit('a'), visit('a')],
    [visit('a'), { ...visit('b'), visitId: undefined }],
  ];
  for (const places of cases) {
    const original = setup(places), baseline = structuredClone(original), source = places[0].visitId;
    assert.equal(canDragPlanVisit(original.days[0], source), false);
    assert.throws(() => movePlanVisitBefore(original, 'day-one', source, null), /연결된 장소/);
    assert.deepEqual(original, baseline);
  }
});

test('unfilled planning gaps retain their IDs and slot while reversed boundaries are reconciled', () => {
  const original = setup();
  original.days[0].planningGaps = [{ id: 'gap', kind: 'CAFE', slot: 'afternoon', reason: 'missing-data', afterVisitId: 'a', beforeVisitId: 'b' }];
  const result = movePlanVisitBefore(original, 'day-one', 'b', 'a');
  const gap = result.days[0].planningGaps[0];
  assert.equal(gap.id, 'gap');
  assert.equal(gap.kind, 'CAFE');
  assert.equal(gap.slot, 'afternoon');
  const positions = new Map(result.days[0].places.map((place, index) => [place.visitId, index]));
  assert.ok(gap.afterVisitId === undefined || positions.has(gap.afterVisitId));
  assert.ok(gap.beforeVisitId === undefined || positions.has(gap.beforeVisitId));
  assert.ok(gap.afterVisitId === undefined || gap.beforeVisitId === undefined || positions.get(gap.afterVisitId) < positions.get(gap.beforeVisitId));
  assert.deepEqual(original.days[0].planningGaps[0], { id: 'gap', kind: 'CAFE', slot: 'afternoon', reason: 'missing-data', afterVisitId: 'a', beforeVisitId: 'b' });
});

test('all insertion boundaries preserve complete groups and matching place blocks', () => {
  const original = setup([visit('a'), visit('a-food', 'FOOD', 'a'), visit('b', 'CAFE'), visit('b-food', 'FOOD', 'b'), visit('c', 'SHOP'), visit('stay', 'STAY')]);
  for (const source of ['a', 'a-food', 'b', 'b-food', 'c']) {
    for (const target of ['a', 'a-food', 'b', 'b-food', 'c', 'stay', null]) {
      const result = movePlanVisitBefore(original, 'day-one', source, target), ids = order(result);
      assert.equal(ids.at(-1), 'stay');
      assert.equal(ids[ids.indexOf('a') + 1], 'a-food');
      assert.equal(ids[ids.indexOf('b') + 1], 'b-food');
      assert.deepEqual(new Set(ids), new Set(order(original)));
      assert.deepEqual(result.days[0].blocks.map(block => block.visitId), ids);
    }
  }
});
