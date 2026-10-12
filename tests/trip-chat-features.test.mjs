import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') &&
      specifier.startsWith('./') &&
      !/\.[a-z]+$/.test(specifier)
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});
const { createTripSession, appendTrip, currentTrip, isTripSession } =
  await import('../lib/trip-engine.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');
const {
  comparisonRows,
  budgetSummary,
  itineraryChecks,
  chatEntityDetail,
  chatHelpGroups,
} = await import('../lib/trip-chat-features.ts');
const say = (session, text) => appendTrip(session, { type: 'message', text });
const itinerary = () =>
  say(createTripSession(), '제주 1박 2일, 바다와 맛집, 숙소까지 일정 짜줘');

test('DAY switching is a read-only turn, not a duration-triggered rebuild', () => {
  const original = itinerary(),
    before = JSON.stringify(original);
  const result = say(original, 'DAY 2 일정 보여줘');
  assert.equal(currentTrip(result).activeDay, 2);
  assert.deepEqual(currentTrip(result).plan, currentTrip(original).plan);
  assert.equal(JSON.stringify(original), before);
});
test('out-of-range DAY produces an explicit reply and preserves plan', () => {
  const original = itinerary(),
    result = say(original, 'DAY 3 일정 보여줘');
  assert.match(currentTrip(result).notice, /없어요/);
  assert.deepEqual(currentTrip(result).plan, currentTrip(original).plan);
});
test('compound Korean meal amount uses full numeric amount', () => {
  let session = say(createTripSession(), '협재 근처 식당 찾아줘');
  session = say(session, '식당 1만5천원 이하로');
  assert.equal(currentTrip(session).foodBudget, 15000);
});
test('bookmark requests add and remove without selecting or replacing context', () => {
  let session = itinerary(),
    before = currentTrip(session);
  session = say(session, '오설록 찜해줘');
  assert.ok(currentTrip(session).savedIds.includes('osulloc'));
  assert.equal(currentTrip(session).anchorId, before.anchorId);
  assert.deepEqual(currentTrip(session).plan, before.plan);
  session = say(session, '오설록 찜해줘');
  assert.equal(
    currentTrip(session).savedIds.filter((id) => id === 'osulloc').length,
    1,
  );
  session = say(session, '오설록 찜 해제해줘');
  assert.ok(!currentTrip(session).savedIds.includes('osulloc'));
});
test('named menu question opens detail without selecting or changing itinerary', () => {
  const before = itinerary(),
    result = say(before, '모래빛 식탁 메뉴 보여줘');
  assert.equal(currentTrip(result).stage, 'detail');
  assert.equal(currentTrip(result).detailId, 'hj-pasta');
  assert.equal(currentTrip(result).foodId, currentTrip(before).foodId);
  assert.deepEqual(currentTrip(result).plan, currentTrip(before).plan);
  assert.ok(
    chatEntityDetail(currentTrip(result)).menu.some(
      (item) => item.name === '해산물 파스타',
    ),
  );
});
test('ordinal menu query refers to current candidates, not selection', () => {
  const before = say(createTripSession(), '협재 근처 식당 찾아줘');
  const result = say(before, '두 번째 식당 메뉴 보여줘');
  assert.equal(currentTrip(result).detailId, 'hj-pasta');
  assert.equal(currentTrip(result).foodId, null);
  assert.equal(currentTrip(before).stage, 'food');
});
test('unqualified menu question asks which candidate when none is selected', () => {
  const before = say(createTripSession(), '협재 근처 식당 찾아줘');
  const result = say(before, '메뉴 보여줘');
  assert.equal(currentTrip(result).detailId, null);
  assert.match(currentTrip(result).notice, /이름이나 후보 번호/);
});
test('cafe selected from detail uses its kind and retains itinerary until add', () => {
  const before = itinerary();
  let result = say(before, '파도 한 모금 상세정보 보여줘');
  result = appendTrip(result, { type: 'select-entity', id: 'hj-cafe' });
  assert.equal(currentTrip(result).foodKind, '카페');
  assert.equal(currentTrip(result).cafeId, 'hj-cafe');
  assert.deepEqual(currentTrip(result).plan, currentTrip(before).plan);
  result = say(result, '이 카페를 DAY 1에 추가해줘');
  assert.ok(
    currentTrip(result).plan.some(
      (v) => v.entityId === 'hj-cafe' && v.day === 1,
    ),
  );
});
test('comparison uses existing candidate IDs and never auto-selects a winner', () => {
  const before = say(createTripSession(), '협재 근처 식당 찾아줘');
  const result = say(before, '이 두 식당 비교해줘');
  assert.deepEqual(currentTrip(result).comparisonIds, ['hj-rice', 'hj-pasta']);
  assert.equal(currentTrip(result).foodId, null);
  assert.deepEqual(
    comparisonRows(currentTrip(result)).map((row) => row.id),
    ['hj-rice', 'hj-pasta'],
  );
  const selected = say(result, '두 번째 후보 선택해줘');
  assert.equal(currentTrip(selected).foodId, 'hj-pasta');
});
test('comparison with fewer than two real candidates asks for another candidate', () => {
  const before = say(createTripSession(), '협재 근처 카페 찾아줘');
  const result = say(before, '카페 비교해줘');
  assert.deepEqual(currentTrip(result).comparisonIds, []);
  assert.match(currentTrip(result).notice, /2개 이상/);
});
test('named comparison is read-only and may compare places from different regions', () => {
  const result = say(itinerary(), '오설록과 서울숲 비교해줘');
  assert.deepEqual(currentTrip(result).comparisonIds, [
    'osulloc',
    'seoulforest',
  ]);
  assert.equal(comparisonRows(currentTrip(result))[0].price, '확인 필요');
});
test('explicit meal remove changes only the requested DAY slot', () => {
  const before = itinerary(),
    target = currentTrip(before).plan.find(
      (v) => v.day === 1 && v.label === '점심',
    );
  const result = say(before, 'DAY 1 점심 일정에서 빼줘');
  assert.deepEqual(
    currentTrip(result).plan,
    currentTrip(before).plan.filter((v) => v.id !== target.id),
  );
});
test('ambiguous named repeated visit asks for DAY and does not change plan', () => {
  let session = itinerary();
  const state = currentTrip(session),
    visit = state.plan.find((v) => v.kind === 'place');
  state.plan.push({ ...visit, id: 'visit-repeated', day: 2 });
  const result = say(session, '협재 일정에서 빼줘');
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
  assert.match(currentTrip(result).notice, /여러 개/);
});
test('named selection while editing changes precisely one visit', () => {
  const before = itinerary(),
    target = currentTrip(before).plan.find(
      (v) => v.day === 1 && v.label === '점심',
    );
  let result = say(before, 'DAY 1 점심 바꿔줘');
  result = say(result, '모래빛 식탁 선택해줘');
  assert.equal(
    currentTrip(result).plan.find((v) => v.id === target.id).entityId,
    'hj-pasta',
  );
  assert.deepEqual(
    currentTrip(result).plan.filter((v) => v.id !== target.id),
    currentTrip(before).plan.filter((v) => v.id !== target.id),
  );
});
test('within-DAY ordinal move preserves entities and moves only requested pair', () => {
  const before = itinerary(),
    result = say(before, 'DAY 1 첫 번째 방문 순서를 뒤로 옮겨줘');
  const original = currentTrip(before).plan,
    moved = currentTrip(result).plan;
  assert.equal(moved[0].id, original[1].id);
  assert.equal(moved[1].id, original[0].id);
  assert.deepEqual(
    moved.map((v) => v.entityId).sort(),
    original.map((v) => v.entityId).sort(),
  );
});
test('explicit transfer only moves specified visit to destination DAY', () => {
  const before = itinerary(),
    result = say(before, 'DAY 1 첫 번째 방문을 DAY 2로 옮겨줘');
  const id = currentTrip(before).plan.find(
    (v) => v.kind === 'place' && v.day === 1,
  ).id;
  assert.equal(currentTrip(result).plan.find((v) => v.id === id).day, 2);
  assert.deepEqual(
    currentTrip(result).plan.filter((v) => v.id !== id),
    currentTrip(before).plan.filter((v) => v.id !== id),
  );
});
test('missing selected cafe never silently succeeds or rebuilds an itinerary', () => {
  const before = itinerary(),
    result = say(before, 'DAY 2 카페 추가해줘');
  assert.deepEqual(currentTrip(result).plan, currentTrip(before).plan);
  assert.match(currentTrip(result).notice, /먼저 골라/);
});
test('locked booking cannot be removed, replaced or transferred through chat', () => {
  const before = say(
    createTripSession(),
    '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  );
  for (const text of [
    'DAY 1 숙소 일정에서 빼줘',
    'DAY 1 숙소 바꿔줘',
    'DAY 1 숙소를 DAY 2로 옮겨줘',
  ]) {
    const result = say(before, text);
    assert.deepEqual(currentTrip(result).plan, currentTrip(before).plan);
    assert.match(currentTrip(result).notice, /예약|숙박/);
  }
});
test('save, library list and numbered reopen all work in engine messages', () => {
  let session = say(itinerary(), '일정 저장해줘');
  assert.equal(session.library.length, 1);
  session = say(session, '저장한 여행 보여줘');
  assert.equal(currentTrip(session).stage, 'library');
  assert.equal(currentTrip(session).librarySnapshot.length, 1);
  session = say(session, '첫 번째 저장한 여행 열어줘');
  assert.equal(currentTrip(session).stage, 'plan');
  assert.deepEqual(currentTrip(session).plan, session.library[0].visits);
});
test('library snapshot stays unchanged after a later saved plan is added', () => {
  let session = say(itinerary(), '일정 저장해줘');
  session = say(session, '저장한 여행 보여줘');
  const archived = currentTrip(session),
    snapshot = JSON.stringify(archived);
  session = say(session, '서울숲에서 당일 일정 짜줘');
  session = say(session, '일정 저장해줘');
  assert.equal(session.library.length, 2);
  assert.equal(JSON.stringify(archived), snapshot);
  assert.equal(archived.librarySnapshot.length, 1);
});
test('chat reset erases conversation and draft while preserving favorites and library', () => {
  let session = say(itinerary(), '협재 찜해줘');
  session = say(session, '일정 저장해줘');
  const result = say(session, '대화 초기화해줘');
  assert.equal(result.turns.length, 1);
  assert.equal(currentTrip(result).question, '');
  assert.equal(currentTrip(result).plan.length, 0);
  assert.deepEqual(currentTrip(result).savedIds, ['hyeopjae']);
  assert.deepEqual(result.library, session.library);
});
test('reset explanations and negations preserve the draft, saved data and prior conversation', () => {
  let before = say(itinerary(), '협재 찜해줘');
  before = say(before, '일정 저장해줘');
  for (const q of [
    '대화 초기화 방법 알려줘',
    '대화 초기화하지 마',
    '대화 지워 달라는 뜻이 아니야',
    '새 대화 시작 방법은 뭐야?',
  ]) {
    const result = say(before, q);
    assert.equal(result.turns.length, before.turns.length + 1, q);
    assert.deepEqual(result.turns.slice(0, -1), before.turns, q);
    assert.deepEqual(currentTrip(result).plan, currentTrip(before).plan, q);
    assert.deepEqual(
      currentTrip(result).savedIds,
      currentTrip(before).savedIds,
      q,
    );
    assert.deepEqual(result.library, before.library, q);
  }
});
test('undo explanations and negations never restore a previous itinerary', () => {
  const before = say(itinerary(), 'DAY 1 점심 일정에서 빼줘');
  for (const q of [
    '방금 수정 취소 방법 알려줘',
    '방금 수정 취소하지 마',
    '실행 취소가 무슨 뜻이야?',
    '이전으로 되돌려 달라는 말이 아니야',
  ]) {
    const result = say(before, q);
    assert.deepEqual(currentTrip(result).plan, currentTrip(before).plan, q);
    assert.deepEqual(result.turns.slice(0, -1), before.turns, q);
    assert.equal(currentTrip(result).undoOfTurnId, undefined, q);
  }
});
test('history numbering refers to visible results rather than blank initial turn', () => {
  let session = say(createTripSession(), '협재 찾아줘');
  const first = currentTrip(session);
  session = say(session, '주변 식당 찾아줘');
  session = say(session, '대화 기록 보여줘');
  assert.equal(currentTrip(session).historySnapshot[0].id, 2);
  session = say(session, '첫 번째 결과에서 이어갈래');
  assert.equal(currentTrip(session).stage, first.stage);
  assert.equal(session.turns.at(-1).restoredFrom, 2);
});
test('undo restores last itinerary change after read-only turns and keeps history', () => {
  const before = itinerary();
  let session = say(before, 'DAY 1 점심 일정에서 빼줘');
  session = say(session, '여행 예산 계산해줘');
  session = say(session, '방금 수정 취소해줘');
  assert.deepEqual(currentTrip(session).plan, currentTrip(before).plan);
  assert.equal(session.turns.length, before.turns.length + 3);
});
test('undo does not modify saved snapshot or bookmark choices', () => {
  let session = say(itinerary(), '일정 저장해줘');
  const library = JSON.stringify(session.library);
  session = say(session, 'DAY 1 점심 일정에서 빼줘');
  session = say(session, '협재 찜해줘');
  session = say(session, '방금 수정 취소해줘');
  assert.equal(JSON.stringify(session.library), library);
  assert.ok(currentTrip(session).savedIds.includes('hyeopjae'));
});
test('undo can restore a reserved stay visit status without changing its booking', () => {
  const before = say(
    createTripSession(),
    '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  );
  const stay = currentTrip(before).plan.find((v) => v.locked);
  let session = appendTrip(before, {
    type: 'progress',
    id: stay.id,
    status: 'done',
  });
  session = say(session, '방금 수정 취소해줘');
  assert.deepEqual(
    currentTrip(session).plan.find((v) => v.id === stay.id),
    stay,
  );
  assert.equal(currentTrip(session).booked, true);
});
test('budget separates per-person meal costs from per-room nightly costs', () => {
  const session = say(itinerary(), '3인 2객실 여행 예산 계산해줘');
  const summary = budgetSummary(currentTrip(session));
  assert.equal(summary.people, 3);
  assert.equal(summary.rooms, 2);
  for (const line of summary.lines)
    assert.equal(
      line.amount,
      line.unitPrice * (line.category === 'stay' ? 2 : 3),
    );
  assert.equal(
    summary.total,
    summary.foodTotal + summary.cafeTotal + summary.stayTotal,
  );
  assert.ok(summary.excluded.some((e) => /입장료/.test(e.reason)));
});
test('budget excludes unknown locked bookings and skipped visits', () => {
  let session = say(
    createTripSession(),
    '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  );
  const state = currentTrip(session),
    meal = state.plan.find((v) => v.kind === 'food');
  session = appendTrip(session, {
    type: 'progress',
    id: meal.id,
    status: 'skipped',
  });
  const summary = budgetSummary(currentTrip(session));
  assert.equal(summary.stayTotal, 0);
  assert.ok(summary.excluded.some((e) => /예약한 숙소/.test(e.reason)));
  assert.ok(!summary.lines.some((l) => l.visitId === meal.id));
});
test('budget target reports current estimate without claiming automatic optimization', () => {
  const result = say(itinerary(), '2인 30만원 안에서 여행 예산 맞춰줘');
  assert.equal(currentTrip(result).stage, 'budget');
  assert.match(currentTrip(result).notice, /자동 교체.*아직/);
});
test('checks flag supported constraints and explicitly leave live travel timing unchecked', () => {
  const session = say(itinerary(), '일정 시간 괜찮아?');
  assert.equal(currentTrip(session).stage, 'check');
  const checks = itineraryChecks(currentTrip(session));
  assert.ok(
    checks.some(
      (c) => c.id === 'live-not-checked' && /이동시간/.test(c.description),
    ),
  );
  assert.ok(!checks.some((c) => /몇 분|혼잡|제시간/.test(c.title)));
});
test('checks warn about missing menu and configured price limit without deleting visits', () => {
  let session = itinerary();
  session = appendTrip(session, { type: 'configure', foodBudget: 10000 });
  const checks = itineraryChecks(currentTrip(session));
  assert.ok(checks.some((c) => c.id.startsWith('food-budget-')));
  assert.equal(
    currentTrip(session).plan.length,
    currentTrip(itinerary()).plan.length,
  );
});
test('help/scenario/wiring language has a functional help result and useful examples', () => {
  for (const text of [
    '시나리오 보여줘',
    '사용법 알려줘',
    '연결된 기능 보여줘',
    '할 수 있는 기능',
  ])
    assert.equal(currentTrip(say(createTripSession(), text)).stage, 'help');
  assert.ok(
    chatHelpGroups.some((g) => g.examples.some((q) => /초기화/.test(q))),
  );
});
test('all new states survive persistence validation and compatible old sessions remain valid', () => {
  const before = itinerary();
  assert.ok(isTripSession(before));
  for (const text of [
    '이 두 식당 비교해줘',
    '여행 예산 계산해줘',
    '일정 점검해줘',
    '모래빛 식탁 메뉴 보여줘',
    '저장한 여행 보여줘',
    '대화 기록 보여줘',
    '사용법 알려줘',
  ])
    assert.ok(isTripSession(JSON.parse(JSON.stringify(say(before, text)))));
});
test('chat feature results satisfy the strict server session contract on the next turn', () => {
  const bases = [
    itinerary(),
    say(
      createTripSession(),
      '서울숲에서 반나절 일정 짜줘. 점심과 카페를 넣어줘',
    ),
    say(createTripSession(), '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어'),
  ];
  const prompts = [
    'DAY 2 일정 보여줘',
    '첫 번째 식당 메뉴 보여줘',
    'DAY 1 점심 바꿔줘',
    'DAY 1 점심 일정에서 빼줘',
    'DAY 1 첫 번째 방문을 DAY 2로 옮겨줘',
    '모래빛 식탁 선택해줘',
    '오설록 선택해줘',
    '서울숲 선택해줘',
    '오설록과 서울숲 비교해줘',
    '파도 한 모금 상세정보 보여줘',
    '2인 1객실 여행 예산 계산해줘',
    '일정 점검해줘',
    '저장한 여행 보여줘',
    '대화 기록 보여줘',
    '방금 수정 취소해줘',
    '사용법 알려줘',
  ];
  for (const base of bases)
    for (const q of prompts)
      assert.doesNotThrow(
        () => parseTripSession(JSON.parse(JSON.stringify(say(base, q)))),
        q,
      );
});
