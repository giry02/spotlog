import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/(trip-engine|trip-data|travel-links)\.ts$/.test(
        context.parentURL ?? '',
      ) &&
      specifier.startsWith('./')
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});
const { createTripSession, currentTrip, appendTrip, foodResults, stayResults } =
  await import('../lib/trip-engine.ts');
const { scenarios } = await import('../lib/trip-data.ts');
const message = (s, text) => appendTrip(s, { type: 'message', text });
const plan = (text) => message(createTripSession(), text);

test('a request to find lodging without an existing reservation is not marked as booked', () => {
  const s = currentTrip(
    plan('제주 1박 2일 일정 짜줘. 숙소는 아직 예약 안 했어'),
  );
  assert.equal(s.booked, false);
  assert.ok(s.plan.some((v) => v.kind === 'stay' && !v.locked));
});

test('place → restaurant → stay → itinerary preserves chosen IDs and prior replies', () => {
  let s = plan('제주에서 바다 볼 만한 곳 찾아줘');
  s = appendTrip(s, { type: 'place', id: 'hyeopjae' });
  s = appendTrip(s, { type: 'show', stage: 'food' });
  s = appendTrip(s, { type: 'food', id: 'hj-rice' });
  const previous = JSON.stringify(s.turns);
  s = appendTrip(s, { type: 'show', stage: 'stay' });
  s = appendTrip(s, { type: 'stay', id: 'stay-coast' });
  s = appendTrip(s, { type: 'build' });
  const state = currentTrip(s);
  assert.equal(state.days, 2);
  assert.equal(state.plan[0].entityId, 'hyeopjae');
  assert.ok(state.plan.some((v) => v.entityId === 'hj-rice'));
  assert.ok(state.plan.some((v) => v.entityId === 'stay-coast'));
  assert.equal(JSON.stringify(s.turns.slice(0, 5)), previous);
});

test('direct itinerary creates meals and nights without forcing candidate selection', () => {
  const s = currentTrip(
    plan(scenarios.find((x) => x.id === 'complete').prompt),
  );
  assert.equal(s.stage, 'plan');
  assert.equal(s.days, 2);
  assert.ok(s.plan.some((v) => v.kind === 'food'));
  assert.equal(s.plan.filter((v) => v.kind === 'stay').length, 1);
  assert.ok(s.plan.every((v) => v.anchorId !== 'seoulforest'));
});

test('one meal replacement leaves every other visit and booked accommodation intact', () => {
  let s = plan(scenarios.find((x) => x.id === 'booked').prompt);
  const before = structuredClone(currentTrip(s).plan);
  const target = before.find((v) => v.label === '점심');
  s = appendTrip(s, { type: 'edit', id: target.id });
  const replacement = foodResults(currentTrip(s)).find(
    (r) => r.id !== target.entityId,
  );
  s = appendTrip(s, { type: 'food', id: replacement.id });
  assert.equal(currentTrip(s).stage, 'plan');
  assert.equal(
    currentTrip(s).plan.find((v) => v.id === target.id).entityId,
    replacement.id,
  );
  assert.deepEqual(
    currentTrip(s).plan.filter((v) => v.id !== target.id),
    before.filter((v) => v.id !== target.id),
  );
  assert.ok(currentTrip(s).plan.find((v) => v.kind === 'stay').locked);
});

test('booked lodging announced after browsing stays does not keep suggesting hotels', () => {
  let s = message(createTripSession(), '협재해변 근처 숙소 찾아줘');
  s = message(s, '숙소는 이미 예약했어');
  assert.notEqual(currentTrip(s).stage, 'stay');
  s = appendTrip(s, { type: 'build' });
  assert.equal(currentTrip(s).plan.filter((v) => v.kind === 'stay').length, 1);
  assert.ok(
    currentTrip(s)
      .plan.filter((v) => v.kind === 'stay')
      .every((v) => v.locked && v.entityId === null),
  );
});

test('existing draft marks nights as booked when told about an existing booking', () => {
  let s = plan('제주 1박 2일 일정 짜줘');
  const visits = currentTrip(s).plan.filter((v) => v.kind !== 'stay');
  s = message(s, '숙소는 이미 예약했어');
  assert.deepEqual(
    currentTrip(s).plan.filter((v) => v.kind !== 'stay'),
    visits,
  );
  assert.ok(currentTrip(s).plan.find((v) => v.kind === 'stay').locked);
});

test('restaurant and cafe choices remain separate when creating a day plan', () => {
  let s = plan('서울숲 근처 식당 찾아줘');
  s = appendTrip(s, { type: 'food', id: 'sf-pasta' });
  s = appendTrip(s, { type: 'show', stage: 'food', kind: '카페' });
  s = appendTrip(s, { type: 'food', id: 'sf-cafe' });
  s = appendTrip(s, { type: 'build' });
  assert.ok(currentTrip(s).plan.some((v) => v.entityId === 'sf-pasta'));
  assert.ok(currentTrip(s).plan.some((v) => v.entityId === 'sf-cafe'));
  assert.ok(!currentTrip(s).plan.some((v) => v.kind === 'stay'));
});

test('saved places must stay in one region and use only saved landmarks', () => {
  let s = createTripSession(['hyeopjae', 'osulloc', 'seoulforest']);
  s = message(s, '찜한 장소로 일정 짜줘');
  assert.equal(currentTrip(s).plan.length, 0);
  s = message(s, '찜한 제주 장소로 1박 2일 일정 짜줘');
  assert.deepEqual(
    currentTrip(s)
      .plan.filter((v) => v.kind === 'place')
      .map((v) => v.entityId)
      .sort(),
    ['hyeopjae', 'osulloc'],
  );
});

test('meal/cafe/lodging exclusions are honored for a direct itinerary', () => {
  const s = currentTrip(
    plan('제주 1박 2일 일정 짜줘. 관광지만, 식당 빼고 카페 빼고 숙소 제외'),
  );
  assert.ok(s.plan.length > 0);
  assert.ok(s.plan.every((v) => v.kind === 'place'));
});

test('empty restaurant or hotel results stay empty until conditions are widened', () => {
  let s = plan('협재해변 근처 식당 찾아줘');
  s = message(s, '도보 1분 안에서');
  assert.equal(foodResults(currentTrip(s)).length, 0);
  s = message(s, '도보 20분, 전체 음식, 10만원 이하로');
  assert.ok(foodResults(currentTrip(s)).length > 0);
  s = message(s, '숙소 1만원 이하로');
  assert.equal(stayResults(currentTrip(s)).length, 0);
});

test('save and reopen do not mutate the stored plan, explicit resave updates it', () => {
  let s = plan('제주 1박 2일 일정 짜줘');
  s = appendTrip(s, { type: 'save' });
  const saved = structuredClone(s.library[0]);
  s = appendTrip(s, {
    type: 'remove',
    id: currentTrip(s).plan.find((v) => v.kind === 'food').id,
  });
  assert.deepEqual(s.library[0], saved);
  s = appendTrip(s, { type: 'save' });
  assert.equal(s.library.length, 1);
  assert.equal(s.library[0].visits.length, saved.visits.length - 1);
  s = appendTrip(s, { type: 'open', id: saved.id });
  assert.deepEqual(currentTrip(s).plan, s.library[0].visits);
});

test('returning to an earlier response appends a new branch without deleting subsequent replies', () => {
  let s = plan('제주에서 바다 볼 만한 곳 찾아줘');
  const early = s.turns.at(-1);
  s = appendTrip(s, { type: 'place', id: 'hyeopjae' });
  s = appendTrip(s, { type: 'bookmark', id: 'hyeopjae' });
  const count = s.turns.length;
  s = appendTrip(s, { type: 'resume', id: early.id });
  assert.equal(s.turns.length, count + 1);
  assert.equal(currentTrip(s).anchorId, null);
  assert.deepEqual(currentTrip(s).savedIds, ['hyeopjae']);
});

test('the displayed example with a duration produces a complete plan', () => {
  const s = currentTrip(plan('제주 1박 2일, 바다랑 맛집 가고 싶어'));
  assert.equal(s.stage, 'plan');
  assert.ok(s.plan.length > 0);
});

test('DAY selection carries its anchor into nearby search and adding a cafe preserves other days', () => {
  let s = plan('제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어');
  s = appendTrip(s, { type: 'day', day: 2 });
  const before = structuredClone(currentTrip(s).plan);
  const anchor = before.find((v) => v.day === 2 && v.kind === 'place').entityId;
  assert.equal(currentTrip(s).anchorId, anchor);
  s = appendTrip(s, { type: 'show', stage: 'food', kind: '카페' });
  s = appendTrip(s, { type: 'food', id: foodResults(currentTrip(s))[0].id });
  s = appendTrip(s, { type: 'add-selected' });
  assert.equal(currentTrip(s).plan.length, before.length + 1);
  assert.deepEqual(
    currentTrip(s).plan.filter((v) => v.day === 1),
    before.filter((v) => v.day === 1),
  );
  assert.equal(currentTrip(s).plan.at(-1).kind, 'cafe');
});

test('a combined place and cuisine request opens the filtered restaurant unit', () => {
  const s = currentTrip(plan('협재해변 근처 한식 찾아줘'));
  assert.equal(s.stage, 'food');
  assert.equal(s.cuisine, '한식');
  assert.deepEqual(
    foodResults(s).map((r) => r.id),
    ['hj-rice'],
  );
});

const { nextPendingVisit, isTripSession } =
  await import('../lib/trip-engine.ts');
const { directionsTarget, mapLinks, nearbyMapSearch } =
  await import('../lib/travel-links.ts');

test('directions question keeps itinerary, selections and old replies while linking only a real landmark', () => {
  let session = plan('제주 1박 2일 일정 짜줘');
  const before = currentTrip(session);
  const oldTurns = JSON.stringify(session.turns);
  const spot = before.plan.find((v) => v.kind === 'place');
  session = message(
    session,
    `${spot.entityId === 'osulloc' ? '오설록' : '협재해변'} 길찾기 해줘`,
  );
  const state = currentTrip(session);
  assert.equal(state.stage, 'directions');
  assert.deepEqual(state.plan, before.plan);
  assert.equal(state.foodId, before.foodId);
  assert.equal(JSON.stringify(session.turns.slice(0, -1)), oldTurns);
  const target = directionsTarget(state);
  assert.ok(target.links);
  assert.equal(new URL(target.links.directions).searchParams.get('api'), '1');
  assert.ok(
    new URL(target.links.directions).searchParams
      .get('destination')
      .replace(/\s/g, '')
      .includes(target.place.name.replace(/\s/g, '')),
  );
  assert.equal(mapLinks('hj-rice'), null);
  assert.equal(nearbyMapSearch('hj-rice', '식당'), null);
});

test('fictional and booked lodging cannot silently route to an anchor as if it were the business', () => {
  let session = plan('제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어');
  const state = currentTrip(session);
  for (const visit of state.plan.filter((v) => v.kind !== 'place')) {
    const mapped = currentTrip(
      appendTrip(session, { type: 'directions', id: visit.id }),
    );
    assert.equal(directionsTarget(mapped).links, null);
    assert.equal(directionsTarget(mapped).unavailable, true);
  }
  session = appendTrip(createTripSession(), { type: 'place', id: 'hyeopjae' });
  session = appendTrip(session, { type: 'show', stage: 'food' });
  session = appendTrip(session, { type: 'food', id: 'hj-rice' });
  assert.equal(
    directionsTarget(currentTrip(message(session, '여기 길찾기 해줘'))).links,
    null,
  );
});

test('done, skipped and undo preserve visits, locked bookings, saved copies and response snapshots', () => {
  let session = appendTrip(
    plan('제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어'),
    { type: 'save' },
  );
  const before = currentTrip(session);
  const saved = JSON.stringify(session.library);
  const oldTurns = JSON.stringify(session.turns);
  const first = nextPendingVisit(before);
  session = message(session, '다녀왔어');
  assert.equal(
    currentTrip(session).plan.find((v) => v.id === first.id).status,
    'done',
  );
  assert.equal(JSON.stringify(session.turns.slice(0, -1)), oldTurns);
  assert.equal(JSON.stringify(session.library), saved);
  const second = nextPendingVisit(currentTrip(session));
  session = message(session, '이번엔 건너뛸래');
  assert.equal(
    currentTrip(session).plan.find((v) => v.id === second.id).status,
    'skipped',
  );
  assert.deepEqual(
    currentTrip(session).plan.map(({ status, ...v }) => v),
    before.plan,
  );
  session = appendTrip(session, {
    type: 'progress',
    id: first.id,
    status: 'pending',
  });
  assert.equal(nextPendingVisit(currentTrip(session)).id, first.id);
  assert.ok(
    currentTrip(session).plan.some((v) => v.kind === 'stay' && v.locked),
  );
  assert.equal(isTripSession(session), true);
});

test('progress moves to the next DAY and repeats remain distinguishable by visit ID', () => {
  let session = plan('제주 1박 2일 일정 짜줘');
  for (const visit of currentTrip(session).plan.filter((v) => v.day === 1)) {
    session = appendTrip(session, {
      type: 'progress',
      id: visit.id,
      status: 'done',
    });
  }
  assert.equal(currentTrip(session).activeDay, 2);
  assert.equal(nextPendingVisit(currentTrip(session)).day, 2);
  assert.equal(
    currentTrip(session).anchorId,
    nextPendingVisit(currentTrip(session)).anchorId,
  );
  session = message(session, '서울숲 다녀왔어');
  assert.match(currentTrip(session).notice, /현재 일정에 없/);
  assert.ok(
    currentTrip(session)
      .plan.filter((v) => v.day === 2)
      .every((v) => !v.status),
  );
});

test('real nearby search opens an external card without choosing or adding a fictional business', () => {
  const session = plan('서울숲에서 반나절 일정 짜줘');
  const before = currentTrip(session);
  const after = currentTrip(message(session, '실제 식당 찾아줘'));
  assert.equal(after.stage, 'external');
  assert.deepEqual(after.plan, before.plan);
  assert.equal(after.foodId, before.foodId);
  assert.ok(
    decodeURIComponent(nearbyMapSearch(after.anchorId, '식당')).includes(
      '서울숲',
    ),
  );
  assert.equal(isTripSession(session), true); // legacy visits without a status stay readable
});

test('named progress uses aliases and repeated names require an explicit visit', () => {
  let session = plan('제주 1박 2일 일정 짜줘');
  const first = currentTrip(session).plan.find((v) => v.entityId === 'osulloc');
  session = message(session, '오설록 다녀왔어');
  assert.equal(
    currentTrip(session).plan.find((v) => v.id === first.id).status,
    'done',
  );
  session = message(session, '오설록 아직 안갔어');
  assert.equal(
    currentTrip(session).plan.find((v) => v.id === first.id).status,
    undefined,
  );
  const duplicate = { ...first, id: 'visit-repeat', day: 2 };
  session = {
    ...session,
    turns: session.turns.map((turn, i) =>
      i === session.turns.length - 1
        ? {
            ...turn,
            state: { ...turn.state, plan: [...turn.state.plan, duplicate] },
          }
        : turn,
    ),
  };
  const before = currentTrip(session).plan;
  session = message(session, '오설록 다녀왔어');
  assert.match(currentTrip(session).notice, /여러 DAY/);
  assert.deepEqual(currentTrip(session).plan, before);
  session = appendTrip(session, {
    type: 'progress',
    id: 'visit-repeat',
    status: 'done',
  });
  assert.equal(
    currentTrip(session).plan.find((v) => v.id === first.id).status,
    undefined,
  );
  assert.equal(
    currentTrip(session).plan.find((v) => v.id === 'visit-repeat').status,
    'done',
  );
});
