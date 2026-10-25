import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context); return next(specifier, context); } });
const { visitOrderGroups, reorderDayVisits, proposedVisitOrder, visitOrderIdentity, finishVisitOrderGesture } = await import('../lib/trip-reorder.ts');
const { createTripSession, currentTrip, appendTrip } = await import('../lib/trip-engine.ts');
const { parseTripAction, parseTripSession, validateActionContext, applyModelReply } = await import('../lib/chat-contract.ts');
const { places, restaurants } = await import('../lib/trip-data.ts');
const [a, b, c, d] = places.filter(place => place.region === '제주');
const food = restaurants.find(item => item.placeId === a.id && !['카페','상점'].includes(item.cuisine));
const cafe = restaurants.find(item => item.placeId === a.id && item.cuisine === '카페');
const visit = (id, entity, extra = {}) => ({ id, day: 1, kind: 'place', entityId: entity.id, anchorId: entity.id, label: '오전 방문', locked: false, ...extra });
const order = plan => plan.filter(visit => visit.day === 1).map(visit => visit.id);
function fixture() {
  const session = createTripSession([], [], 'demo'), state = currentTrip(session);
  state.region = '제주'; state.days = 2; state.stage = 'plan'; state.plan = [
    visit('visit-1', a, { note: '원본 비공개 메모', time: '09:10', durationMinutes: 70, status: 'done' }),
    visit('visit-2', food, { kind: 'food', anchorId: a.id, label: '점심', note: '알레르기 확인', time: '12:00', status: 'skipped' }),
    visit('visit-3', cafe, { kind: 'cafe', anchorId: a.id, label: '카페에서 쉬기', durationMinutes: 25 }),
    visit('visit-4', b, { label: '오후 방문' }),
    visit('visit-5', c, { label: '추가 방문' }),
    visit('visit-6', a, { kind: 'stay', entityId: null, label: '숙박', locked: true, nights: 1, time: '20:00' }),
    visit('visit-7', d, { day: 2 }),
  ];
  return session;
}
const request = (session, text) => ({ protocolVersion: 1, requestId: 'order-test', sessionId: 'order-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });

test('dragging a linked meal carries its landmark, cafe and original visit data as one group', () => {
  const session = fixture(), original = structuredClone(session), state = currentTrip(session);
  assert.deepEqual(visitOrderGroups(state.plan, 1).map(group => group.visits.map(visit => visit.id)), [['visit-1','visit-2','visit-3'],['visit-4'],['visit-5'],['visit-6']]);
  const ids = proposedVisitOrder(state.plan, 1, 'visit-2', null), next = reorderDayVisits(state.plan, 1, ids);
  assert.deepEqual(order(next), ['visit-4','visit-5','visit-1','visit-2','visit-3','visit-6']);
  for (const row of next) assert.equal(row, state.plan.find(visit => visit.id === row.id));
  assert.equal(next.at(-1), state.plan.at(-1)); assert.deepEqual(session, original);
});

test('unknown, duplicate, missing, other DAY and split linked visits are rejected atomically', () => {
  const state = currentTrip(fixture()), original = structuredClone(state.plan);
  for (const ids of [
    ['visit-1','visit-2','visit-3','visit-4','visit-5'],
    ['visit-1','visit-2','visit-3','visit-4','visit-5','visit-5'],
    ['visit-1','visit-2','visit-3','visit-4','visit-5','missing'],
    ['visit-1','visit-2','visit-3','visit-4','visit-5','visit-7'],
    ['visit-1','visit-4','visit-2','visit-3','visit-5','visit-6'],
    ['visit-3','visit-2','visit-1','visit-4','visit-5','visit-6'],
  ]) { assert.throws(() => reorderDayVisits(state.plan, 1, ids)); assert.deepEqual(state.plan, original); }
  assert.throws(() => reorderDayVisits(state.plan, 3, ['visit-7']));
});

test('any lodging is a crossing barrier while groups on the same side can be reordered', () => {
  const rows = [visit('a', a), visit('b', b), visit('fixed', a, { kind: 'stay', entityId: null, locked: true }), visit('c', c), visit('d', d), visit('stay', a, { kind: 'stay', entityId: null })];
  assert.deepEqual(order(reorderDayVisits(rows, 1, ['b','a','fixed','d','c','stay'])), ['b','a','fixed','d','c','stay']);
  for (const ids of [['a','c','fixed','b','d','stay'], ['a','b','stay','fixed','c','d'], ['fixed','a','b','c','d','stay']]) assert.throws(() => reorderDayVisits(rows, 1, ids), /앞뒤/);
  assert.throws(() => proposedVisitOrder(rows, 1, 'fixed', null), /고정/);
  assert.throws(() => proposedVisitOrder(rows, 1, 'a', 'd'), /앞뒤/);
});

test('business only plans preserve distinct repeated visits and do not infer links from a shared map anchor', () => {
  const rows = [visit('lunch', food, { kind: 'food', anchorId: a.id, label: '점심' }), visit('dinner', food, { kind: 'food', anchorId: a.id, label: '저녁' }), visit('coffee', cafe, { kind: 'cafe', anchorId: a.id })];
  assert.equal(visitOrderGroups(rows, 1).length, 3);
  const next = reorderDayVisits(rows, 1, ['coffee','dinner','lunch']); assert.equal(next[1], rows[1]); assert.equal(next[2].label, '점심');
  const ambiguous = [visit('a', a), visit('b', b), visit('food', food, { kind: 'food', anchorId: a.id })];
  assert.throws(() => visitOrderGroups(ambiguous, 1), /연결된 방문/);
});

test('a completed saved trip becomes a working draft; original saved/offline/history and undo stay intact', () => {
  let session = appendTrip(fixture(), { type: 'save' }); session = appendTrip(session, { type: 'plan-status', status: 'READY' });
  const original = structuredClone(session), before = currentTrip(session), ids = proposedVisitOrder(before.plan, 1, 'visit-5', 'visit-1');
  const action = parseTripAction({ type: 'reorder-visits', day: 1, ids }), next = appendTrip(session, action), after = currentTrip(next);
  assert.equal(after.planStatus, 'DRAFT'); assert.equal(next.turns.length, session.turns.length + 1);
  assert.deepEqual(next.library, original.library); assert.deepEqual(next.offlineTrips, original.offlineTrips); assert.deepEqual(next.turns.slice(0, -1), original.turns);
  for (const row of before.plan) assert.deepEqual(after.plan.find(visit => visit.id === row.id), row);
  assert.ok(parseTripSession(next));
  const undone = appendTrip(next, { type: 'undo' }); assert.deepEqual(currentTrip(undone).plan, before.plan); assert.equal(currentTrip(undone).planStatus, 'READY'); assert.deepEqual(undone.library, original.library);
  assert.equal(appendTrip(session, { type: 'reorder-visits', day: 1, ids: order(before.plan) }), session);
});

test('closed parser and both direct/model boundaries reject invalid order without partial mutations', () => {
  const session = fixture(), original = structuredClone(session), state = currentTrip(session), ids = proposedVisitOrder(state.plan, 1, 'visit-4', 'visit-1');
  for (const action of [{ type: 'reorder-visits', day: 0, ids }, { type: 'reorder-visits', day: 1, ids: [...ids, ids[0]] }, { type: 'reorder-visits', day: 1, ids, extra: true }]) assert.throws(() => parseTripAction(action));
  for (const text of ['방문 순서 바꾸는 방법 알려줘', '방문 순서는 바꾸지 마', '순서 변경하지 말아줘', '순서 안 바꿔줘', '이동은 하지 마', 'DAY 2 순서를 바꿔줘', 'DAY 1 방문을 DAY 2로 옮겨줘', '제주 사진 보여줘']) assert.throws(() => validateActionContext({ type: 'reorder-visits', day: 1, ids }, session, true, request(session, text)));
  assert.doesNotThrow(() => validateActionContext({ type: 'reorder-visits', day: 1, ids }, session, true, request(session, 'DAY 1 오후 방문을 먼저 옮겨줘')));
  assert.throws(() => applyModelReply(request(session, 'DAY 1 순서를 바꿔줘'), { message: '바꿨어요', actions: [{ type: 'trip-meta', title: '변경' }, { type: 'reorder-visits', day: 1, ids: ['missing'] }] }));
  assert.deepEqual(session, original);
  const invalid = appendTrip(session, { type: 'reorder-visits', day: 30, ids: ['missing'] }); assert.deepEqual(currentTrip(invalid).plan, state.plan); assert.equal(currentTrip(invalid).activeDay, state.activeDay); assert.ok(parseTripSession(invalid));
});

test('cancel, outside drop, unchanged order and any intervening incoming edit never produce a drop action', () => {
  const state = currentTrip(fixture()), identity = visitOrderIdentity(state, 1), ids = proposedVisitOrder(state.plan, 1, 'visit-4', 'visit-1');
  assert.deepEqual(finishVisitOrderGesture(state, 1, identity, ids, 'drop', true), { type: 'reorder-visits', day: 1, ids });
  assert.equal(finishVisitOrderGesture(state, 1, identity, ids, 'cancel', true), null);
  assert.equal(finishVisitOrderGesture(state, 1, identity, ids, 'drop', false), null);
  assert.equal(finishVisitOrderGesture(state, 1, identity, order(state.plan), 'drop', true), null);
  for (const edit of [copy => copy.plan[0].note = '다른 화면에서 수정', copy => copy.plan[0].status = 'skipped', copy => copy.plan.reverse(), copy => copy.plan[3].locked = true, copy => copy.days = 3, copy => copy.pendingCandidates = [{ id: 'new' }]]) {
    const incoming = structuredClone(state); edit(incoming); assert.equal(finishVisitOrderGesture(incoming, 1, identity, ids, 'drop', true), null);
  }
  assert.equal(finishVisitOrderGesture(state, 1, identity, ['missing'], 'drop', true), null);
});

test('preserving other DAYs does not turn them into reorder targets; actual multi-DAY changes still fail', () => {
  const session = fixture(), ids = proposedVisitOrder(currentTrip(session).plan, 1, 'visit-4', 'visit-1');
  const action = { type: 'reorder-visits', day: 1, ids };
  for (const text of [
    'DAY 1의 관광지 방문 세 곳을 지금 순서의 정반대로 바꿔줘. 광안리해수욕장, 동백섬, 해운대해수욕장 순서로 배치해줘. DAY 2와 각 방문의 시각·체류시간·메모, 기존 저장본은 그대로 유지해줘.',
    'DAY 2는 그대로 두고 DAY 1 순서를 반대로 바꿔줘.',
    'DAY 1 순서를 반대로 바꿔줘. DAY 2와 DAY 3은 그대로 유지해줘.',
  ]) assert.doesNotThrow(() => validateActionContext(action, session, true, request(session, text)), text);
  for (const text of [
    'DAY 1과 DAY 2 순서를 반대로 바꿔줘.',
    'DAY 1의 방문을 DAY 2로 이동해줘.',
    'DAY 1은 그대로 두고 DAY 2 순서를 바꿔줘.',
    'DAY 1 순서를 바꾸지 말고 DAY 2는 그대로 유지해줘.',
    'DAY 1 순서를 어떻게 바꾸는지 설명하고 DAY 2는 그대로 유지해줘.',
    'DAY 1 순서는 그대로 유지해줘.',
    '방문 순서는 그대로 유지해줘.',
    'DAY 1 방문 순서 보여줘.',
  ]) assert.throws(() => validateActionContext(action, session, true, request(session, text)), text);
});
