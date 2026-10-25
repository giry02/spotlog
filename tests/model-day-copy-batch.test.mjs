import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession } = await import('../lib/chat-contract.ts');
function trip() {
  let session = createTripSession();
  for (const action of [
    { type: 'region', region: '부산' },
    { type: 'configure', days: 2, meals: false, cafes: false, lodging: false },
    { type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }, { day: 1, placeId: 'public-busan-dongbaek' }, { day: 2, placeId: 'public-busan-gwangalli' }] },
    { type: 'trip-meta', title: '가을 부산 검수', startDate: '2026-11-03' },
  ]) session = appendTrip(session, action);
  const first = currentTrip(session).plan[0];
  return appendTrip(session, { type: 'visit-details', id: first.id, note: '아침에 우산 챙기기', time: '10:30', durationMinutes: 90 });
}
const request = (session, text = 'DAY 1 전체를 마지막에 새 DAY로 복사해줘. 원래 방문과 메모는 그대로 유지해줘.') => ({ protocolVersion: 1, requestId: 'copy-batch', sessionId: 'copy-batch', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
const apply = (session, actions, text) => applyModelReply(request(session, text), { message: '요청한 DAY와 방문을 복사했어요.', actions });

test('the observed day-copy plus repeated constituent visit-copy batch is refused atomically', () => {
  const session = trip(), original = structuredClone(session), sources = currentTrip(session).plan.filter(visit => visit.day === 1);
  const actions = [{ type: 'day-copy', day: 1, toDay: 3 }, ...sources.map(visit => ({ type: 'visit-copy', id: visit.id, day: 3 }))];
  assert.throws(() => apply(session, actions), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
  assert.throws(() => apply(session, [{ type: 'trip-meta', title: '미적용 이름' }, ...actions], '여행 이름을 바꾸고 DAY 1 전체를 마지막에 복사해줘.'), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
});

test('one whole-DAY copy preserves exact constituent details and unique copy IDs', () => {
  const session = trip(), before = currentTrip(session), original = structuredClone(session);
  const result = apply(session, [{ type: 'day-copy', day: 1 }]), after = currentTrip(result);
  assert.equal(after.days, 3);
  assert.equal(after.plan.length, 5);
  assert.deepEqual(after.plan.filter(visit => visit.day < 3), before.plan);
  const copied = after.plan.filter(visit => visit.day === 3), sources = before.plan.filter(visit => visit.day === 1);
  for (const [index, copy] of copied.entries()) assert.deepEqual(copy, { ...sources[index], id: copy.id, day: 3 });
  assert.equal(new Set(after.plan.map(visit => visit.id)).size, after.plan.length);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(result));
});

test('a whole-DAY copy can coexist with a constituent visit copied to a different DAY', () => {
  const session = trip(), first = currentTrip(session).plan[0], original = structuredClone(session);
  const result = apply(session, [{ type: 'day-copy', day: 1 }, { type: 'visit-copy', id: first.id, day: 2 }], 'DAY 1 전체를 마지막에 복사하고 DAY 2로 해운대 방문을 따로 복사해줘.');
  assert.equal(currentTrip(result).plan.filter(visit => visit.day === 3).length, 2);
  assert.equal(currentTrip(result).plan.filter(visit => visit.day === 2).length, 2);
  assert.deepEqual(session, original);
});

test('a different source visit may be added to the newly copied DAY', () => {
  const session = trip(), other = currentTrip(session).plan.find(visit => visit.day === 2);
  const result = apply(session, [{ type: 'day-copy', day: 1 }, { type: 'visit-copy', id: other.id, day: 3 }], 'DAY 1 전체를 마지막에 복사하고 DAY 3에는 광안리 방문을 따로 복사해줘.');
  assert.equal(currentTrip(result).plan.filter(visit => visit.day === 3).length, 3);
  assert.ok(parseTripSession(result));
});

test('the duplicate guard follows copied visit IDs through a later DAY insertion', () => {
  const session = trip(), first = currentTrip(session).plan[0], original = structuredClone(session);
  assert.throws(() => apply(session, [{ type: 'day-copy', day: 1 }, { type: 'day-add', afterDay: 1 }, { type: 'visit-copy', id: first.id, day: 4 }], 'DAY 1을 복사하고 빈 DAY를 추가한 뒤 방문을 복사해줘.'), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
});

test('after deleting the copied DAY, its old tracking cannot block a valid individual visit copy', () => {
  const session = trip(), first = currentTrip(session).plan[0];
  const result = apply(session, [{ type: 'day-copy', day: 1, toDay: 2 }, { type: 'day-delete', day: 2 }, { type: 'visit-copy', id: first.id, day: 2 }], 'DAY 1을 DAY 2로 복사한 뒤 그 DAY를 삭제하고 해운대 방문만 DAY 2로 복사해줘.');
  assert.equal(currentTrip(result).days, 2);
  assert.equal(currentTrip(result).plan.length, 4);
  assert.ok(parseTripSession(result));
});

test('individual visit copies without a whole-DAY copy remain explicit independent operations', () => {
  const session = trip(), first = currentTrip(session).plan[0];
  const result = apply(session, [{ type: 'visit-copy', id: first.id, day: 2 }, { type: 'visit-copy', id: first.id, day: 2 }], '해운대 방문을 DAY 2에 두 번 복사해줘.');
  assert.equal(currentTrip(result).days, 2);
  assert.equal(currentTrip(result).plan.length, 5);
  assert.ok(parseTripSession(result));
});

test('a whole-DAY-only request rejects replayed historical note/time clears atomically', () => {
  const session = trip(), original = structuredClone(session);
  const actions = [{ type: 'day-copy', day: 1 }, ...currentTrip(session).plan.map(visit => ({ type: 'visit-details', id: visit.id, note: '', time: '', durationMinutes: 0 }))];
  assert.throws(() => apply(session, actions), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
  assert.throws(() => apply(session, [{ type: 'day-copy', day: 1 }, { type: 'day-add' }]), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
});

test('an explicit note change combined with whole-DAY copying retains the general atomic edit path', () => {
  const session = trip(), first = currentTrip(session).plan[0];
  const result = apply(session, [{ type: 'visit-details', id: first.id, note: '새 메모' }, { type: 'day-copy', day: 1 }], '해운대 방문의 메모를 새 메모로 바꾸고 DAY 1 전체를 마지막에 복사해줘.');
  assert.equal(currentTrip(result).plan.find(visit => visit.id === first.id).note, '새 메모');
  assert.equal(currentTrip(result).plan.find(visit => visit.day === 3 && visit.entityId === first.entityId).note, '새 메모');
  assert.ok(parseTripSession(result));
});
