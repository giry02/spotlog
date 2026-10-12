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
const {
  createTripSession,
  appendTrip,
  currentTrip,
  communityResults,
  isTripSession,
  placeResults,
  nextQuestions,
} = await import('../lib/trip-engine.ts');
const { communityTrips, findCommunityTrip } =
  await import('../lib/community-trips.ts');
const { places, restaurants, findPlace, findFood, findStay } =
  await import('../lib/trip-data.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');
const say = (session, text) => appendTrip(session, { type: 'message', text });
const show = (session) =>
  appendTrip(session, { type: 'show', stage: 'community' });
const copy = (session, id) =>
  appendTrip(session, { type: 'copy-community', id });
const privateState = (s) => {
  const {
    stage,
    question,
    notice,
    communityRegion,
    communityTheme,
    ...privateFields
  } = s;
  return JSON.parse(JSON.stringify(privateFields));
};
const privateTrip = () =>
  say(
    createTripSession(['hyeopjae']),
    '서울숲에서 반나절 일정 짜줘. 점심과 카페를 넣어줘',
  );

test('all six courses are openly identified as authored demos with valid canonical visits', () => {
  assert.equal(communityTrips.length, 6);
  assert.equal(new Set(communityTrips.map((t) => t.id)).size, 6);
  for (const course of communityTrips) {
    assert.equal(course.sourceKind, 'demo');
    assert.match(course.author, /데모 프로필/);
    assert.ok(findPlace(course.coverPlaceId));
    assert.ok(course.notes.some((n) => /실제 회원 게시물.*아닙니다/.test(n)));
    for (const visit of course.visits) {
      assert.ok(visit.day >= 1 && visit.day <= course.days);
      assert.ok(findPlace(visit.anchorId));
      assert.ok(
        visit.kind === 'place'
          ? findPlace(visit.entityId)
          : visit.kind === 'stay'
            ? findStay(visit.entityId)
            : findFood(visit.entityId),
      );
    }
  }
});
test('public courses filter region and theme without implicitly filtering private travel duration', () => {
  const s = {
    ...currentTrip(createTripSession()),
    days: 1,
    region: '서울',
    theme: 'green',
    communityRegion: '제주',
    communityTheme: 'all',
  };
  const allJeju = communityResults(s);
  assert.equal(allJeju.length, 5);
  assert.ok(allJeju.some((t) => t.days === 2));
  assert.ok(allJeju.some((t) => t.days === 1));
  assert.ok(
    communityResults({ ...s, communityTheme: 'sea' }).every(
      (t) => t.region === '제주' && t.theme === 'sea',
    ),
  );
  assert.equal(
    communityResults({ ...s, communityRegion: null, communityTheme: 'all' })
      .length,
    6,
  );
});
test('opening and filtering public courses preserves private itinerary, picks and travel collection', () => {
  let before = privateTrip();
  before = appendTrip(before, { type: 'collect-entity', id: 'sf-rice' });
  const original = privateState(currentTrip(before)),
    history = JSON.stringify(before.turns);
  let result = show(before);
  assert.deepEqual(privateState(currentTrip(result)), original);
  assert.equal(currentTrip(result).communityRegion, '서울');
  result = appendTrip(result, {
    type: 'community-filter',
    region: '제주',
    theme: 'sea',
  });
  assert.deepEqual(privateState(currentTrip(result)), original);
  result = appendTrip(result, { type: 'region', region: '제주' });
  assert.equal(currentTrip(result).stage, 'community');
  assert.equal(currentTrip(result).region, '서울');
  assert.deepEqual(privateState(currentTrip(result)), original);
  assert.equal(JSON.stringify(result.turns.slice(0, -3)), history);
});
test('a public-course question with duration does not regenerate or resize the private itinerary', () => {
  const before = privateTrip();
  const result = say(
    before,
    '다른 여행자가 만든 제주 1박 2일 바다 코스 보여줘',
  );
  assert.equal(currentTrip(result).stage, 'community');
  assert.equal(currentTrip(result).days, 1);
  assert.deepEqual(
    privateState(currentTrip(result)),
    privateState(currentTrip(before)),
  );
  assert.ok(communityResults(currentTrip(result)).some((t) => t.days === 1));
  assert.ok(communityResults(currentTrip(result)).some((t) => t.days === 2));
});
test('community context recognizes simple region/theme messages without changing private data', () => {
  const before = show(privateTrip());
  for (const q of [
    '제주 코스 보여줘',
    '바다만 보여줘',
    '전체 지역 공개 코스 보여줘',
  ]) {
    const result = say(before, q);
    assert.equal(currentTrip(result).stage, 'community');
    assert.deepEqual(
      privateState(currentTrip(result)),
      privateState(currentTrip(before)),
    );
  }
});
test('ordinal copy resolves the filtered course and makes a separate editable private snapshot', () => {
  let before = appendTrip(privateTrip(), { type: 'save' });
  before = show(before);
  before = appendTrip(before, {
    type: 'community-filter',
    region: '제주',
    theme: 'sea',
  });
  const course = communityResults(currentTrip(before))[0],
    source = JSON.stringify(course),
    priorTurns = JSON.stringify(before.turns);
  const result = say(before, '첫 번째 코스를 내 여행으로 가져와');
  assert.equal(currentTrip(result).communitySourceId, course.id);
  assert.equal(currentTrip(result).region, course.region);
  assert.equal(currentTrip(result).days, course.days);
  assert.deepEqual(
    currentTrip(result).plan.map(({ id, locked, ...v }) => v),
    course.visits,
  );
  assert.deepEqual(currentTrip(result).savedIds, currentTrip(before).savedIds);
  assert.deepEqual(result.library, before.library);
  assert.equal(JSON.stringify(result.turns.slice(0, -1)), priorTurns);
  currentTrip(result).plan[0].label = '내가 수정한 이름';
  assert.equal(JSON.stringify(course), source);
});
test('named course copy works without relying on the itinerary duration parser', () => {
  const course = findCommunityTrip('community-jeju-east-green');
  const result = say(
    createTripSession(),
    `${course.title} 코스를 내 여행으로 가져와`,
  );
  assert.equal(currentTrip(result).communitySourceId, course.id);
  assert.equal(currentTrip(result).days, 2);
  assert.ok(currentTrip(result).plan.some((v) => v.entityId === 'bijarim'));
  assert.ok(isTripSession(result));
  assert.doesNotThrow(() =>
    parseTripSession(JSON.parse(JSON.stringify(result))),
  );
});
test('copy preserves attribution through targeted edits, saving, reset and reopening', () => {
  const course = findCommunityTrip('community-jeju-west-green'),
    source = JSON.stringify(course);
  let session = copy(createTripSession(['hyeopjae']), course.id);
  session = appendTrip(session, {
    type: 'remove',
    id: currentTrip(session).plan[0].id,
  });
  session = appendTrip(session, { type: 'save' });
  const saved = session.library.at(-1);
  assert.equal(saved.communitySourceId, course.id);
  session = appendTrip(session, { type: 'reset' });
  assert.equal(currentTrip(session).communitySourceId, undefined);
  session = appendTrip(session, { type: 'open', id: saved.id });
  assert.equal(currentTrip(session).communitySourceId, course.id);
  assert.deepEqual(currentTrip(session).plan, saved.visits);
  assert.equal(JSON.stringify(course), source);
});
test('community copy refuses a current booking without changing its private plan or collection', () => {
  let before = say(
    createTripSession(['hyeopjae']),
    '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  );
  before = appendTrip(before, { type: 'collect-entity', id: 'osulloc' });
  const original = privateState(currentTrip(before));
  const result = copy(before, 'community-jeju-east-sea');
  assert.equal(currentTrip(result).stage, 'community');
  assert.match(currentTrip(result).notice, /예약한 숙소.*보호/);
  assert.deepEqual(privateState(currentTrip(result)), original);
});
test('copy explanations and negative requests keep the active private plan unchanged', () => {
  const before = appendTrip(show(privateTrip()), {
    type: 'community-filter',
    region: '제주',
  });
  for (const q of [
    '첫 번째 코스 가져오는 방법 알려줘',
    '첫 번째 코스 복사하지 마',
    '첫 번째 코스를 내 여행으로 가져와 주지 마',
  ]) {
    const result = say(before, q);
    assert.deepEqual(
      privateState(currentTrip(result)),
      privateState(currentTrip(before)),
      q,
    );
  }
});
test('undoing a copied course restores the previous private course and its source attribution', () => {
  let session = copy(createTripSession(), 'community-jeju-west-green');
  const original = currentTrip(session);
  session = copy(session, 'community-jeju-east-sea');
  session = appendTrip(session, { type: 'undo' });
  assert.equal(
    currentTrip(session).communitySourceId,
    original.communitySourceId,
  );
  assert.deepEqual(currentTrip(session).plan, original.plan);
});
test('two-day automatic Jeju draft gives four distinct landmarks with AM and PM slots', () => {
  const session = say(createTripSession(), '제주 1박 2일 일정 짜줘'),
    s = currentTrip(session);
  const visits = s.plan.filter((v) => v.kind === 'place');
  assert.equal(visits.length, 4);
  assert.equal(new Set(visits.map((v) => v.entityId)).size, 4);
  for (const day of [1, 2]) {
    const group = visits.filter((v) => v.day === day);
    assert.deepEqual(
      group.map((v) => v.label),
      ['오전 방문', '오후 방문'],
    );
    assert.equal(new Set(group.map((v) => findPlace(v.entityId).area)).size, 1);
  }
  assert.ok(visits.length < places.filter((p) => p.region === '제주').length);
});
test('three-day automatic draft uses six landmarks and keeps each DAY in one authored area', () => {
  const s = currentTrip(say(createTripSession(), '제주 2박 3일 일정 짜줘'));
  const visits = s.plan.filter((v) => v.kind === 'place');
  assert.equal(visits.length, 6);
  assert.equal(new Set(visits.map((v) => v.entityId)).size, 6);
  for (const day of [1, 2, 3]) {
    const group = visits.filter((v) => v.day === day);
    assert.equal(group.length, 2);
    assert.equal(new Set(group.map((v) => findPlace(v.entityId).area)).size, 1);
  }
  assert.doesNotThrow(() =>
    parseTripSession(say(createTripSession(), '제주 2박 3일 일정 짜줘')),
  );
});
test('named eastern anchor uses its area for the AM/PM draft and aliases resolve chat selection', () => {
  const result = say(createTripSession(), '성산에서 1박 2일 일정 짜줘');
  const visits = currentTrip(result).plan.filter((v) => v.kind === 'place');
  assert.equal(visits.length, 4);
  assert.ok(visits.every((v) => findPlace(v.entityId).area === 'east'));
  assert.equal(visits[0].entityId, 'seongsan');
  assert.equal(
    currentTrip(say(createTripSession(), '금능 골라줘')).anchorId,
    'geumneung',
  );
});
test('all explicit collected places survive with AM, PM and additional visit labels', () => {
  const ids = [
    'hyeopjae',
    'geumneung',
    'osulloc',
    'saebyeol',
    'songaksan',
    'cheonjiyeon',
  ];
  let session = ids.reduce(
    (s, id) => appendTrip(s, { type: 'collect-entity', id }),
    createTripSession(),
  );
  session = appendTrip(session, { type: 'build' });
  const visits = currentTrip(session).plan.filter((v) => v.kind === 'place');
  assert.deepEqual(
    visits.map((v) => v.entityId),
    ids,
  );
  assert.deepEqual(
    visits.slice(0, 2).map((v) => v.label),
    ['오전 방문', '오후 방문'],
  );
  assert.ok(visits.slice(2).every((v) => v.label === '추가 방문'));
  assert.ok(!currentTrip(session).plan.some((v) => v.kind === 'stay'));
});
test('favorites-only draft keeps all explicitly saved landmarks instead of applying auto-draft limits', () => {
  const ids = places.filter((p) => p.region === '제주').map((p) => p.id);
  let session = say(createTripSession(ids), '제주에서 찾아줘');
  session = appendTrip(session, { type: 'configure', days: 2 });
  session = appendTrip(session, { type: 'build', savedOnly: true });
  assert.equal(
    currentTrip(session).plan.filter((v) => v.kind === 'place').length,
    ids.length,
  );
});
test('bounded automatic rebuilding keeps booked overnight records exactly intact', () => {
  let session = say(
    createTripSession(),
    '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  );
  const original = currentTrip(session).plan.filter((v) => v.locked);
  session = appendTrip(session, { type: 'build' });
  assert.deepEqual(
    currentTrip(session).plan.filter((v) => v.locked),
    original,
  );
  assert.equal(
    new Set(currentTrip(session).plan.map((v) => v.id)).size,
    currentTrip(session).plan.length,
  );
});
test('new sea destinations and named sample businesses resolve without unwanted implicit place collection', () => {
  const result = say(createTripSession(), '제주에서 바다 볼 만한 곳 찾아줘');
  assert.ok(placeResults(currentTrip(result)).length >= 4);
  const food = restaurants.find((r) => r.id === 'seongsan-rice');
  const collected = say(createTripSession(), `${food.name} 여행에 담아줘`);
  assert.deepEqual(currentTrip(collected).collectedIds, [food.id]);
});
test('community follow-up copy action is available only through a visible public list', () => {
  const session = show(createTripSession());
  assert.ok(
    nextQuestions(currentTrip(session)).some((q) => /첫 번째.*가져와/.test(q)),
  );
  const before = privateTrip(),
    result = say(before, '다른 사람이 만든 첫 번째 코스를 내 여행으로 가져와');
  assert.equal(currentTrip(result).stage, 'community');
  assert.deepEqual(
    privateState(currentTrip(result)),
    privateState(currentTrip(before)),
  );
});
test('a blocked region change stops before rebuilding the old copied itinerary as a false success', () => {
  const before = copy(createTripSession(), 'community-jeju-west-green');
  const result = say(before, '서울 당일 일정 짜줘');
  assert.deepEqual(
    privateState(currentTrip(result)),
    privateState(currentTrip(before)),
  );
  assert.match(
    currentTrip(result).notice,
    /다른 지역 일정으로 바꾸지 않았어요/,
  );
  assert.match(currentTrip(result).notice, /초기화/);
});
test('explicit east, west and south itinerary requests use only that authored Jeju area', () => {
  for (const [direction, area] of [
    ['동쪽', 'east'],
    ['서쪽', 'west'],
    ['남쪽', 'south'],
    ['서귀포', 'south'],
  ]) {
    const session = say(
      createTripSession(),
      `제주 ${direction} 1박 2일 일정 짜줘`,
    );
    const visits = currentTrip(session).plan.filter((v) => v.kind === 'place');
    assert.ok(visits.length >= 2, direction);
    assert.ok(
      visits.every((v) => findPlace(v.entityId).area === area),
      direction,
    );
    assert.doesNotThrow(() => parseTripSession(session));
  }
});
test('a request to travel with another person is not treated as public-course browsing', () => {
  const result = say(
    createTripSession(),
    '다른 사람이랑 제주 2박 3일 여행 일정 짜줘',
  );
  assert.equal(currentTrip(result).stage, 'plan');
  assert.equal(currentTrip(result).days, 3);
  assert.equal(
    currentTrip(result).plan.filter((v) => v.kind === 'place').length,
    6,
  );
  const publicResult = say(
    createTripSession(),
    '다른 사람이 만든 제주 여행 보여줘',
  );
  assert.equal(currentTrip(publicResult).stage, 'community');
});
test('a duration with an explicit AM and PM place placement command builds the requested area itinerary', () => {
  const session = say(
    createTripSession(),
    '제주 동쪽 1박 2일, 오전 오후로 장소 넣어줘',
  );
  const state = currentTrip(session);
  assert.equal(state.stage, 'plan');
  assert.equal(state.days, 2);
  for (const day of [1, 2]) {
    const visits = state.plan.filter(
      (v) => v.kind === 'place' && v.day === day,
    );
    assert.equal(visits.length, 2);
    assert.deepEqual(
      visits.map((v) => v.label),
      ['오전 방문', '오후 방문'],
    );
    assert.ok(visits.every((v) => findPlace(v.entityId).area === 'east'));
  }
  assert.doesNotThrow(() => parseTripSession(session));
});
