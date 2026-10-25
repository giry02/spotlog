import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const { createTripSession, currentTrip, appendTrip } = await import('../lib/trip-engine.ts');
const { parseTripAction, parseTripSession, validateActionContext, applyModelReply } = await import('../lib/chat-contract.ts');
const step = (session, action) => appendTrip(session, parseTripAction(action));
const request = (session, text) => ({ protocolVersion: 1, requestId: 'stay-boundary', sessionId: 'stay-boundary', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
function trip(days = 3, stayDay = 2) {
  let session = createTripSession([], [], 'demo');
  for (const action of [
    { type: 'region', region: '제주' },
    { type: 'configure', days, meals: false, cafes: false, lodging: false },
    { type: 'build' },
    { type: 'trip-meta', title: '숙박 경계 검수', startDate: '2026-11-03' },
    { type: 'stay-placement', stayId: 'stay-tea', startDay: stayDay, nights: 1 },
  ]) session = step(session, action);
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay');
  return step(session, { type: 'visit-details', id: stay.id, time: '20:00', note: '체크인 전 연락', durationMinutes: 60 });
}

test('deleting the checkout DAY refuses the edit without deleting or shortening the remaining stay', () => {
  const session = trip(), original = structuredClone(session), before = currentTrip(session);
  const action = { type: 'day-delete', day: 3 };
  assert.throws(() => validateActionContext(action, session, false), /체크아웃/);
  const next = step(session, action), after = currentTrip(next);
  assert.equal(after.days, before.days);
  assert.deepEqual(after.plan, before.plan);
  assert.equal(after.title, before.title);
  assert.equal(after.startDate, before.startDate);
  assert.match(after.notice, /체크아웃.*여행 기간/);
  assert.deepEqual(next.turns.slice(0, -1), original.turns);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
});

test('a model batch cannot partially edit metadata before a refused checkout DAY deletion', () => {
  const session = trip(), original = structuredClone(session);
  assert.throws(() => applyModelReply(request(session, '여행 이름을 새 이름으로 바꾸고 DAY 3를 삭제해줘'), {
    message: '이름과 DAY를 변경했어요.',
    actions: [{ type: 'trip-meta', title: '새 이름' }, { type: 'day-delete', day: 3 }],
  }), error => error.code === 'MODEL_ACTION_INVALID');
  assert.deepEqual(session, original);
});

test('copying a stay to the last DAY is refused in both direct and model actions', () => {
  const session = trip(), original = structuredClone(session), before = currentTrip(session);
  const stay = before.plan.find(visit => visit.kind === 'stay');
  const action = { type: 'visit-copy', id: stay.id, day: 3 };
  assert.throws(() => validateActionContext(action, session, false), /체크아웃/);
  const next = step(session, action);
  assert.deepEqual(currentTrip(next).plan, before.plan);
  assert.match(currentTrip(next).notice, /체크아웃/);
  assert.deepEqual(next.turns.slice(0, -1), original.turns);
  assert.throws(() => applyModelReply(request(session, '여행 이름을 바꾸고 DAY 2 숙박을 DAY 3에 복사해줘'), {
    message: '이름과 숙박을 변경했어요.',
    actions: [{ type: 'trip-meta', title: '미적용 이름' }, action],
  }), error => error.code === 'MODEL_ACTION_INVALID');
  assert.deepEqual(session, original);
});

test('normal middle DAY deletion shifts stay IDs and metadata while preserving an in-range checkout', () => {
  const session = trip(4, 3), before = currentTrip(session), original = structuredClone(session);
  const action = { type: 'day-delete', day: 2 };
  validateActionContext(action, session, false);
  const next = step(session, action), after = currentTrip(next);
  assert.equal(after.days, 3);
  assert.deepEqual(after.plan, before.plan.filter(visit => visit.day !== 2).map(visit => ({ ...visit, day: visit.day > 2 ? visit.day - 1 : visit.day })));
  assert.equal(after.title, before.title);
  assert.equal(after.startDate, before.startDate);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
});

test('normal stay copy preserves note/time/duration, gets a new ID and does not mutate its source', () => {
  let session = trip(4, 1);
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay');
  session = step(session, { type: 'progress', id: stay.id, status: 'done' });
  const before = structuredClone(currentTrip(session)), original = structuredClone(session);
  const action = { type: 'visit-copy', id: stay.id, day: 2 };
  validateActionContext(action, session, false);
  const next = step(session, action), after = currentTrip(next);
  const copied = after.plan.find(visit => !before.plan.some(source => source.id === visit.id));
  assert.ok(copied);
  assert.equal(copied.day, 2);
  assert.equal(copied.status, undefined);
  assert.equal(copied.note, stay.note);
  assert.equal(copied.time, stay.time);
  assert.equal(copied.durationMinutes, stay.durationMinutes);
  assert.equal(copied.nights, stay.nights);
  assert.deepEqual(after.plan.filter(visit => visit.id !== copied.id), before.plan);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
});

test('deleting the stay DAY itself is allowed and does not change other visits', () => {
  const session = trip(), before = currentTrip(session);
  const action = { type: 'day-delete', day: 2 };
  validateActionContext(action, session, false);
  const next = step(session, action);
  assert.equal(currentTrip(next).days, 2);
  assert.deepEqual(currentTrip(next).plan, before.plan.filter(visit => visit.day !== 2).map(visit => ({ ...visit, day: visit.day > 2 ? visit.day - 1 : visit.day })));
  assert.ok(parseTripSession(next));
});

test('legacy multi-night stays use their full checkout range and old snapshots remain parseable', () => {
  const session = trip(4, 1);
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay');
  stay.nights = 3;
  const original = structuredClone(session);
  assert.ok(parseTripSession(session));
  for (const action of [{ type: 'visit-copy', id: stay.id, day: 2 }, { type: 'day-delete', day: 4 }]) {
    assert.throws(() => validateActionContext(action, session, false), /체크아웃/);
    assert.deepEqual(currentTrip(step(session, action)).plan, currentTrip(session).plan);
  }
  // Compatibility is preserved: an old out-of-range stay snapshot is not globally rejected.
  stay.day = 4;
  assert.ok(parseTripSession(session));
  assert.equal(original.turns.at(-1).state.plan.find(visit => visit.id === stay.id).day, 1);
});

test('copying a DAY refuses an included multi-night stay beyond the expanded trip atomically', () => {
  const session = trip(4, 1);
  currentTrip(session).plan.find(visit => visit.kind === 'stay').nights = 3;
  const original = structuredClone(session), before = currentTrip(session);
  const action = { type: 'day-copy', day: 1, toDay: 4 };
  assert.ok(parseTripSession(session));
  assert.throws(() => validateActionContext(action, session, false), /체크아웃/);
  const next = step(session, action), after = currentTrip(next);
  assert.equal(after.days, before.days);
  assert.equal(after.activeDay, before.activeDay);
  assert.deepEqual(after.plan, before.plan);
  assert.equal(after.title, before.title);
  assert.equal(after.startDate, before.startDate);
  assert.match(after.notice, /복사하면.*체크아웃.*여행 기간/);
  assert.deepEqual(next.turns.slice(0, -1), original.turns);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
  assert.throws(() => applyModelReply(request(session, '여행 이름을 새 이름으로 바꾸고 DAY 1을 새 DAY 4에 복사해줘'), {
    message: '이름과 DAY를 변경했어요.',
    actions: [{ type: 'trip-meta', title: '미적용 이름' }, action],
  }), error => error.code === 'MODEL_ACTION_INVALID');
  assert.deepEqual(session, original);
});

test('an in-range multi-night DAY copy keeps every stay field and the original snapshot', () => {
  const session = trip(4, 1);
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay');
  stay.nights = 3;
  const original = structuredClone(session), before = currentTrip(session);
  const action = { type: 'day-copy', day: 1, toDay: 2 };
  validateActionContext(action, session, false);
  const next = step(session, action), after = currentTrip(next);
  const copiedStay = after.plan.find(visit => visit.kind === 'stay' && visit.id !== stay.id);
  assert.equal(after.days, 5);
  assert.ok(copiedStay);
  assert.deepEqual(copiedStay, { ...stay, id: copiedStay.id, day: 2 });
  assert.equal(copiedStay.day + copiedStay.nights, after.days);
  assert.equal(after.plan.length, before.plan.length + before.plan.filter(visit => visit.day === 1).length);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
});

test('inserting a copied DAY before an existing multi-night stay shifts the complete range safely', () => {
  const session = trip(5, 2);
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay');
  stay.nights = 3;
  const original = structuredClone(session);
  const action = { type: 'day-copy', day: 1, toDay: 2 };
  validateActionContext(action, session, false);
  const next = step(session, action), after = currentTrip(next);
  assert.equal(after.days, 6);
  assert.deepEqual(after.plan.find(visit => visit.id === stay.id), { ...stay, day: 3 });
  assert.equal(after.plan.filter(visit => visit.kind === 'stay').length, 1);
  assert.equal(after.plan.find(visit => visit.id === stay.id).day + stay.nights, after.days);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
});

test('appending a copied DAY continues to exclude multi-night stays without shortening their source', () => {
  const session = trip(4, 1);
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay');
  stay.nights = 3;
  const original = structuredClone(session), before = currentTrip(session);
  const action = { type: 'day-copy', day: 1 };
  validateActionContext(action, session, false);
  const next = step(session, action), after = currentTrip(next);
  assert.equal(after.days, 5);
  assert.equal(after.plan.filter(visit => visit.kind === 'stay').length, 1);
  assert.deepEqual(after.plan.find(visit => visit.id === stay.id), stay);
  assert.equal(after.plan.filter(visit => visit.day === 5).length, before.plan.filter(visit => visit.day === 1 && visit.kind !== 'stay').length);
  assert.match(after.notice, /마지막 날의 숙박.*복사하지/);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(next));
});

test('locked reservations still refuse stay copies and DAY edits with every field intact', () => {
  const session = trip(4, 2);
  currentTrip(session).plan.find(visit => visit.kind === 'stay').locked = true;
  const original = structuredClone(session), stay = currentTrip(session).plan.find(visit => visit.locked);
  for (const action of [{ type: 'visit-copy', id: stay.id, day: 1 }, { type: 'day-delete', day: 2 }]) {
    assert.throws(() => validateActionContext(action, session, false), /예약/);
    assert.deepEqual(currentTrip(step(session, action)).plan, currentTrip(session).plan);
  }
  assert.deepEqual(session, original);
});
