import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env = {}',
        shortCircuit: true,
      };
    if (specifier.startsWith('@/'))
      return next(
        new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    if (
      /(?:\/lib\/[^/]+|\/app\/api\/chat\/route)\.ts$/.test(
        context.parentURL ?? '',
      ) &&
      specifier.startsWith('./')
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const {
  ChatContractError,
  MAX_CHAT_REQUEST_BYTES,
  MAX_MODEL_RESPONSE_BYTES,
  applyModelReply,
  chatResponse,
  explicitConversationControl,
  parseChatRequest,
  parseModelReply,
  parseTripSession,
} = await import('../lib/chat-contract.ts');
const { createTripSession, currentTrip, appendTrip } =
  await import('../lib/trip-engine.ts');
const { communityTrips } = await import('../lib/community-trips.ts');
const { predictFlowise, readFlowiseConfig, modelContext } =
  await import('../lib/flowise-adapter.ts');
const { POST } = await import('../app/api/chat/route.ts');
const { env } = await import('cloudflare:workers');
Object.assign(env, {
  FLOWISE_BASE_URL: '',
  FLOWISE_CHATFLOW_ID: '',
  FLOWISE_API_KEY: '',
});

const request = (
  session = createTripSession(),
  action = { type: 'message', text: '제주에서 장소 찾아줘' },
) => ({
  protocolVersion: 1,
  requestId: 'request_test',
  sessionId: 'session_test',
  baseRevision: session.turns.at(-1).id,
  session,
  action,
});
const errorCode = (code) => (error) =>
  error instanceof ChatContractError && error.code === code;
const config = {
  baseUrl: 'https://flowise.example',
  chatflowId: 'flow_123',
  apiKey: 'server-only-test-key',
  timeoutMs: 1000,
};
const post = (body, extra = {}) =>
  new Request('https://moa.example/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });

test('protocol validates a normal session and every response correlates request and revision', () => {
  const input = parseChatRequest(request());
  const session = appendTrip(input.session, input.action);
  const response = chatResponse(input, session, 'demo');
  assert.equal(response.requestId, input.requestId);
  assert.equal(response.sessionId, input.sessionId);
  assert.equal(response.baseRevision, 1);
  assert.equal(response.revision, 2);
  assert.equal(response.mode, 'demo');
  assert.ok(response.message);
  assert.ok(response.nextQuestions.length);
});

test('session enum, scalar bounds, unknown fields and fake IDs are rejected', () => {
  for (const mutate of [
    (s) => {
      currentTrip(s).stage = 'payment';
    },
    (s) => {
      currentTrip(s).days = 99;
    },
    (s) => {
      currentTrip(s).walk = -1;
    },
    (s) => {
      currentTrip(s).booked = 'yes';
    },
    (s) => {
      currentTrip(s).foodBudget = Number.NaN;
    },
    (s) => {
      currentTrip(s).anchorId = 'fake';
    },
    (s) => {
      currentTrip(s).endpoint = 'https://attacker.example';
    },
    (s) => {
      s.turns.push({ ...s.turns[0] });
    },
  ]) {
    const session = structuredClone(createTripSession());
    mutate(session);
    assert.throws(
      () => parseChatRequest(request(session)),
      errorCode('INVALID_REQUEST'),
    );
  }
});

test('mismatched base revision cannot replace a newer session', () => {
  assert.throws(
    () => parseChatRequest({ ...request(), baseRevision: 2 }),
    errorCode('REVISION_MISMATCH'),
  );
});

test('older sessions without collection fields remain compatible', () => {
  const session = createTripSession();
  for (const turn of session.turns) delete turn.state.collectedIds;
  assert.ok(parseTripSession(session));
  assert.ok(parseChatRequest(request(session)));
  assert.deepEqual(modelContext(request(session)).state.collectedIds, []);
});

test('collected IDs must be bounded, canonical, unique and in the same region', () => {
  const valid = createTripSession();
  Object.assign(currentTrip(valid), {
    region: '제주',
    collectedIds: ['hyeopjae', 'hj-rice', 'hj-cafe'],
  });
  assert.ok(parseTripSession(valid));
  for (const collectedIds of [
    ['hyeopjae', 'hyeopjae'],
    ['fake-business'],
    ['hyeopjae', 'seoulforest'],
    ['sf-cafe'],
    Array.from({ length: 31 }, () => 'hyeopjae'),
  ]) {
    const session = structuredClone(valid);
    currentTrip(session).collectedIds = collectedIds;
    assert.throws(
      () => parseTripSession(session),
      errorCode('INVALID_REQUEST'),
    );
  }
});

test('collection actions parse closed fields and respect current region and collection IDs', () => {
  const session = createTripSession();
  Object.assign(currentTrip(session), {
    region: '제주',
    collectedIds: ['hyeopjae'],
  });
  assert.equal(
    parseChatRequest(
      request(session, { type: 'collect-entity', id: 'osulloc' }),
    ).action.type,
    'collect-entity',
  );
  assert.equal(
    parseChatRequest(
      request(session, { type: 'uncollect-entity', id: 'hyeopjae' }),
    ).action.type,
    'uncollect-entity',
  );
  assert.throws(
    () =>
      parseChatRequest(
        request(session, { type: 'collect-entity', id: 'seoulforest' }),
      ),
    errorCode('INVALID_REQUEST'),
  );
  assert.throws(
    () =>
      parseChatRequest(
        request(session, { type: 'uncollect-entity', id: 'osulloc' }),
      ),
    errorCode('INVALID_REQUEST'),
  );
  assert.throws(
    () =>
      parseModelReply({
        message: '담았어요',
        actions: [{ type: 'collect-entity', id: 'hyeopjae', saved: true }],
      }),
    errorCode('MODEL_OUTPUT_INVALID'),
  );
  assert.ok(
    modelContext(request(session)).allowedToolTypes.includes('collect-entity'),
  );
});

test('model collection batches preserve prior picks, deduplicate, and use current candidates', () => {
  const session = appendTrip(createTripSession(['saebyeol']), {
    type: 'place',
    id: 'hyeopjae',
  });
  const input = request(session, {
    type: 'message',
    text: '협재해변과 오설록을 이번 여행에 담아줘',
  });
  const before = JSON.stringify(session);
  const result = applyModelReply(
    input,
    parseModelReply({
      message: '두 장소를 담았어요.',
      actions: [
        { type: 'collect-entity', id: 'hyeopjae' },
        { type: 'collect-entity', id: 'osulloc' },
        { type: 'collect-entity', id: 'hyeopjae' },
        { type: 'show', stage: 'collection' },
      ],
    }),
  );
  assert.deepEqual(currentTrip(result).collectedIds, ['hyeopjae', 'osulloc']);
  assert.deepEqual(currentTrip(result).savedIds, ['saebyeol']);
  assert.equal(currentTrip(result).stage, 'collection');
  assert.equal(result.turns.length, session.turns.length + 1);
  assert.equal(JSON.stringify(session), before);
  const invalid = parseModelReply({
    message: '새 식당도 담았어요.',
    actions: [{ type: 'collect-entity', id: 'of-rice' }],
  });
  assert.throws(
    () => applyModelReply(input, invalid),
    errorCode('MODEL_ACTION_INVALID'),
  );
  assert.equal(JSON.stringify(session), before);
});

test('uncollect removes only the trip collection while long-term favorites stay intact', () => {
  const session = createTripSession(['hyeopjae']);
  Object.assign(currentTrip(session), {
    region: '제주',
    collectedIds: ['hyeopjae', 'osulloc'],
  });
  const result = applyModelReply(
    request(session),
    parseModelReply({
      message: '이번 여행에서 협재해변만 뺐어요.',
      actions: [{ type: 'uncollect-entity', id: 'hyeopjae' }],
    }),
  );
  assert.deepEqual(currentTrip(result).collectedIds, ['osulloc']);
  assert.deepEqual(currentTrip(result).savedIds, ['hyeopjae']);
});

test('collection to itinerary uses every collected entity without unsolicited lodging', () => {
  const session = createTripSession();
  Object.assign(currentTrip(session), {
    region: '제주',
    days: 2,
    anchorId: 'hyeopjae',
    collectedIds: ['hyeopjae', 'osulloc', 'hj-rice', 'of-cafe'],
  });
  const result = applyModelReply(
    request(session, { type: 'message', text: '담은 곳으로 이틀 일정 짜줘' }),
    parseModelReply({
      message: '담은 곳으로 일정을 만들었어요.',
      actions: [{ type: 'build' }],
    }),
  );
  for (const entityId of currentTrip(session).collectedIds)
    assert.ok(currentTrip(result).plan.some((v) => v.entityId === entityId));
  assert.ok(currentTrip(result).plan.every((v) => v.kind !== 'stay'));
});

test('collection rebuild preserves booked visit identity so the model guard remains strict', () => {
  let session = appendTrip(createTripSession(), {
    type: 'message',
    text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  });
  const lockedBefore = structuredClone(
    currentTrip(session).plan.filter((v) => v.locked),
  );
  assert.ok(lockedBefore.length);
  session = appendTrip(session, { type: 'collect-entity', id: 'hyeopjae' });
  session = appendTrip(session, { type: 'collect-entity', id: 'hj-rice' });
  const result = applyModelReply(
    request(session, {
      type: 'message',
      text: '담은 곳으로 일정 만들고 예약한 숙소는 유지해줘',
    }),
    parseModelReply({
      message: '담은 방문과 예약한 숙소를 이어서 배치했어요.',
      actions: [{ type: 'build' }],
    }),
  );
  assert.deepEqual(
    currentTrip(result).plan.filter((v) => v.locked),
    lockedBefore,
  );
  assert.equal(
    new Set(currentTrip(result).plan.map((v) => v.id)).size,
    currentTrip(result).plan.length,
  );
});

test('community attribution and filters are optional for old sessions and validate known source IDs', () => {
  const session = createTripSession();
  const s = currentTrip(session);
  delete s.communitySourceId;
  delete s.communityRegion;
  delete s.communityTheme;
  assert.ok(parseTripSession(session));
  s.communitySourceId = 'community-jeju-west-green';
  s.communityRegion = null;
  s.communityTheme = 'all';
  session.library = [
    {
      id: 'trip_demo',
      title: '출처를 보존한 내 여행',
      region: '제주',
      days: 1,
      visits: [],
      booked: false,
      communitySourceId: s.communitySourceId,
    },
  ];
  assert.ok(parseTripSession(session));
  for (const mutate of [
    (value) => {
      currentTrip(value).communitySourceId = 'unknown-course';
    },
    (value) => {
      value.library[0].communitySourceId = 'hyeopjae';
    },
    (value) => {
      currentTrip(value).communityRegion = '부산';
    },
    (value) => {
      currentTrip(value).communityTheme = 'shopping';
    },
  ]) {
    const invalid = structuredClone(session);
    mutate(invalid);
    assert.throws(
      () => parseTripSession(invalid),
      errorCode('INVALID_REQUEST'),
    );
  }
  s.communitySourceId = null;
  session.library[0].communitySourceId = null;
  assert.ok(parseTripSession(session));
});

test('community IDs and filter fields are closed and distinct from place IDs', () => {
  for (const action of [
    { type: 'copy-community', id: 'hyeopjae' },
    { type: 'copy-community', id: 'unknown-course' },
    { type: 'place', id: 'community-jeju-west-green' },
    { type: 'community-filter' },
    { type: 'community-filter', region: '부산' },
    { type: 'community-filter', theme: 'shopping' },
    { type: 'community-filter', region: null, plan: [] },
  ])
    assert.throws(
      () =>
        parseModelReply({
          message: '공개 코스를 찾아볼게요.',
          actions: [action],
        }),
      errorCode('MODEL_OUTPUT_INVALID'),
    );
  assert.ok(
    parseModelReply({
      message: '전체 지역의 초록 코스를 보여드릴게요.',
      actions: [{ type: 'community-filter', region: null, theme: 'green' }],
    }),
  );
});

test('public course browsing filters preserve private itinerary, selections, collection and booking', () => {
  let session = appendTrip(createTripSession(), {
    type: 'message',
    text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  });
  session = appendTrip(session, { type: 'collect-entity', id: 'hyeopjae' });
  const before = structuredClone(currentTrip(session));
  const result = applyModelReply(
    request(session, {
      type: 'message',
      text: '전체 지역의 초록 공개 코스 보여줘',
    }),
    parseModelReply({
      message: '데모 작성자의 초록 코스 예시예요.',
      actions: [
        { type: 'show', stage: 'community' },
        { type: 'community-filter', region: null, theme: 'green' },
      ],
    }),
  );
  for (const key of [
    'region',
    'theme',
    'days',
    'anchorId',
    'foodId',
    'cafeId',
    'stayId',
    'plan',
    'collectedIds',
    'savedPlanId',
    'booked',
  ])
    assert.deepEqual(currentTrip(result)[key], before[key]);
  assert.equal(currentTrip(result).stage, 'community');
  const context = modelContext(request(result));
  assert.equal(context.publicCourses.sourceKind, 'demo');
  assert.ok(context.publicCourses.candidates.length > 0);
  assert.ok(
    context.publicCourses.candidates.every(
      (course) =>
        course.theme === 'green' &&
        course.sourceKind === 'demo' &&
        course.author.includes('데모'),
    ),
  );
  assert.ok(context.allowedToolTypes.includes('copy-community'));
});

test('copy-community accepts only currently filtered public candidates', () => {
  const session = createTripSession();
  Object.assign(currentTrip(session), {
    communityRegion: '제주',
    communityTheme: 'green',
  });
  assert.ok(
    parseChatRequest(
      request(session, {
        type: 'copy-community',
        id: 'community-jeju-west-green',
      }),
    ),
  );
  assert.throws(
    () =>
      parseChatRequest(
        request(session, {
          type: 'copy-community',
          id: 'community-jeju-west-sea',
        }),
      ),
    errorCode('INVALID_REQUEST'),
  );
  assert.throws(
    () =>
      parseChatRequest(
        request(session, {
          type: 'copy-community',
          id: 'community-seoul-halfday',
        }),
      ),
    errorCode('INVALID_REQUEST'),
  );
});

test('copied public course is a private editable snapshot with attribution preserved through save and open', () => {
  const originalCourses = JSON.stringify(communityTrips);
  const source = communityTrips.find(
    (course) => course.id === 'community-jeju-west-green',
  );
  const session = createTripSession(['hyeopjae']);
  const copied = applyModelReply(
    request(session, {
      type: 'message',
      text: '이 공개 코스를 내 여행으로 가져와줘',
    }),
    parseModelReply({
      message: '공개 코스 예시를 내 여행 초안으로 복사했어요.',
      actions: [{ type: 'copy-community', id: source.id }],
    }),
  );
  assert.equal(currentTrip(copied).communitySourceId, source.id);
  assert.equal(currentTrip(copied).days, source.days);
  assert.deepEqual(
    currentTrip(copied).plan.map((v) => v.entityId),
    source.visits.map((v) => v.entityId),
  );
  assert.deepEqual(currentTrip(copied).savedIds, ['hyeopjae']);
  const edited = appendTrip(copied, {
    type: 'remove',
    id: currentTrip(copied).plan[0].id,
  });
  const saved = appendTrip(edited, { type: 'save' });
  assert.equal(saved.library.at(-1).communitySourceId, source.id);
  const opened = appendTrip(createTripSession([], saved.library), {
    type: 'open',
    id: saved.library.at(-1).id,
  });
  assert.equal(currentTrip(opened).communitySourceId, source.id);
  assert.ok(parseTripSession(opened));
  assert.equal(JSON.stringify(communityTrips), originalCourses);
});

test('model public-course copy cannot overwrite booking while direct action gets engine refusal', () => {
  const session = appendTrip(createTripSession(), {
    type: 'message',
    text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  });
  const before = JSON.stringify(session);
  const reply = parseModelReply({
    message: '공개 코스로 바꿨어요.',
    actions: [
      { type: 'bookmark', id: 'hyeopjae', saved: true },
      { type: 'copy-community', id: 'community-jeju-west-green' },
    ],
  });
  assert.throws(
    () => applyModelReply(request(session), reply),
    errorCode('MODEL_ACTION_INVALID'),
  );
  assert.equal(JSON.stringify(session), before);
  const direct = parseChatRequest(
    request(session, {
      type: 'copy-community',
      id: 'community-jeju-west-green',
    }),
  );
  const refused = appendTrip(session, direct.action);
  assert.deepEqual(currentTrip(refused).plan, currentTrip(session).plan);
  assert.ok(currentTrip(refused).notice.includes('예약'));
});

test('later invalid model action cannot leave a partial copied public plan', () => {
  const session = createTripSession();
  const before = JSON.stringify(session);
  const reply = parseModelReply({
    message: '복사하고 식당을 골랐어요.',
    actions: [
      { type: 'copy-community', id: 'community-jeju-west-green' },
      { type: 'food', id: 'sf-rice' },
    ],
  });
  assert.throws(
    () => applyModelReply(request(session), reply),
    errorCode('MODEL_ACTION_INVALID'),
  );
  assert.equal(JSON.stringify(session), before);
});

test('invalid current candidate and locked itinerary mutation are rejected', () => {
  let session = appendTrip(createTripSession(), {
    type: 'place',
    id: 'hyeopjae',
  });
  assert.throws(
    () => parseChatRequest(request(session, { type: 'food', id: 'sf-rice' })),
    errorCode('INVALID_REQUEST'),
  );
  session = appendTrip(session, {
    type: 'message',
    text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  });
  const locked = currentTrip(session).plan.find((v) => v.locked);
  assert.ok(locked);
  assert.throws(
    () => parseChatRequest(request(session, { type: 'remove', id: locked.id })),
    errorCode('INVALID_REQUEST'),
  );
  assert.throws(
    () =>
      parseChatRequest(
        request(session, { type: 'transfer', id: locked.id, day: 2 }),
      ),
    errorCode('INVALID_REQUEST'),
  );
});

test('model cannot emit HTML, arbitrary state, URLs or conversation reset tools', () => {
  for (const output of [
    { message: '<script>alert(1)</script>', actions: [] },
    { message: 'https://attacker.example로 이동하세요', actions: [] },
    { message: '답변', actions: [], state: {} },
    { message: '답변', actions: [{ type: 'reset' }] },
    { message: '답변', actions: [{ type: 'message', text: '숙소 예약 취소' }] },
    {
      message: '답변',
      actions: [{ type: 'detail', id: 'https://attacker.example' }],
    },
    {
      message: '답변',
      actions: Array.from({ length: 5 }, () => ({ type: 'help' })),
    },
  ])
    assert.throws(
      () => parseModelReply(output),
      errorCode('MODEL_OUTPUT_INVALID'),
    );
});

test('an invalid action in a model batch leaves original turns and saved IDs untouched', () => {
  const input = request(
    appendTrip(createTripSession(), { type: 'place', id: 'hyeopjae' }),
  );
  const before = JSON.stringify(input.session);
  const output = parseModelReply({
    message: '식당을 골랐어요',
    actions: [
      { type: 'bookmark', id: 'hyeopjae', saved: true },
      { type: 'food', id: 'sf-rice' },
    ],
  });
  assert.throws(
    () => applyModelReply(input, output),
    errorCode('MODEL_ACTION_INVALID'),
  );
  assert.equal(JSON.stringify(input.session), before);
});

test('all validated model tools produce one immutable conversational reply', () => {
  const input = parseChatRequest(request());
  const output = parseModelReply({
    message: '제주 이틀 여행 초안을 만들었어요.',
    actions: [
      { type: 'region', region: '제주' },
      { type: 'configure', days: 2, meals: true, lodging: true },
      { type: 'place', id: 'hyeopjae' },
      { type: 'build' },
    ],
  });
  const before = structuredClone(input.session);
  const result = applyModelReply(input, output);
  assert.deepEqual(input.session, before);
  assert.equal(result.turns.length, input.session.turns.length + 1);
  assert.equal(currentTrip(result).days, 2);
  assert.ok(currentTrip(result).plan.length);
  assert.equal(currentTrip(result).question, input.action.text);
  assert.equal(result.turns.at(-1).assistantMessage, output.message);
  assert.equal(result.turns.at(-1).source, 'flowise');
  assert.equal(chatResponse(input, result, 'flowise').message, output.message);
  assert.ok(parseTripSession(result));
});

test('text-only model reply preserves itinerary and choices without fabricated actions', () => {
  const session = appendTrip(createTripSession(), {
    type: 'message',
    text: '서울숲에서 반나절 일정 짜줘',
  });
  const input = request(session, {
    type: 'message',
    text: '어떤 방식으로 동작해?',
  });
  const result = applyModelReply(
    input,
    parseModelReply({
      message: '선택한 장소를 기준으로 카드 기능을 연결해요.',
      actions: [],
    }),
  );
  const expected = {
    ...currentTrip(session),
    stage: 'answer',
    notice: '',
    question: input.action.text,
  };
  assert.deepEqual(currentTrip(result), expected);
  assert.deepEqual(result.library, session.library);
});

test('changing region through model cannot discard a booked stay', () => {
  const session = appendTrip(createTripSession(), {
    type: 'message',
    text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  });
  const input = request(session, { type: 'message', text: '식당만 바꿔줘' });
  const reply = parseModelReply({
    message: '바꿨어요',
    actions: [{ type: 'region', region: '서울' }],
  });
  assert.throws(
    () => applyModelReply(input, reply),
    errorCode('MODEL_ACTION_INVALID'),
  );
  assert.ok(currentTrip(session).plan.some((v) => v.locked));
});

test('community region action remains a read-only filter for a booked private trip', () => {
  const session = appendTrip(
    appendTrip(createTripSession(), {
      type: 'message',
      text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
    }),
    { type: 'show', stage: 'community' },
  );
  const before = structuredClone(currentTrip(session));
  const result = applyModelReply(
    request(session, { type: 'message', text: '서울 공개 코스 보여줘' }),
    parseModelReply({
      message: '서울의 공개 코스 데모 예시예요.',
      actions: [{ type: 'region', region: '서울' }],
    }),
  );
  assert.equal(currentTrip(result).communityRegion, '서울');
  assert.equal(currentTrip(result).region, before.region);
  assert.deepEqual(currentTrip(result).plan, before.plan);
  assert.deepEqual(currentTrip(result).collectedIds, before.collectedIds);
});

test('explicit conversation controls are grounded in exact human phrases', () => {
  assert.deepEqual(explicitConversationControl('대화 초기화해줘'), {
    type: 'reset',
  });
  assert.deepEqual(explicitConversationControl('방금 수정 취소해줘'), {
    type: 'undo',
  });
  assert.deepEqual(explicitConversationControl('2번째 결과에서 이어갈래'), {
    type: 'message',
    text: '2번째 결과에서 이어갈래',
  });
  assert.equal(explicitConversationControl('대화 초기화 하지마'), null);
  assert.deepEqual(explicitConversationControl('첫 번째 결과에서 이어갈래'), {
    type: 'message',
    text: '첫 번째 결과에서 이어갈래',
  });
  assert.equal(explicitConversationControl('대화 초기화 기능이 뭐야?'), null);
});

test('server environment requires a complete explicit Flowise configuration', () => {
  assert.equal(readFlowiseConfig({}), null);
  assert.throws(
    () => readFlowiseConfig({ FLOWISE_BASE_URL: 'https://flowise.example' }),
    errorCode('FLOWISE_CONFIG_INVALID'),
  );
  assert.throws(
    () =>
      readFlowiseConfig({
        FLOWISE_BASE_URL: 'https://user:password@flowise.example',
        FLOWISE_CHATFLOW_ID: 'flow',
      }),
    errorCode('FLOWISE_CONFIG_INVALID'),
  );
  assert.throws(
    () =>
      readFlowiseConfig({
        FLOWISE_BASE_URL: 'https://flowise.example',
        FLOWISE_CHATFLOW_ID: '../flow',
      }),
    errorCode('FLOWISE_CONFIG_INVALID'),
  );
  assert.throws(
    () =>
      readFlowiseConfig({
        FLOWISE_BASE_URL: 'https://flowise.example',
        FLOWISE_CHATFLOW_ID: 'flow',
        FLOWISE_TIMEOUT_MS: '999999',
      }),
    errorCode('FLOWISE_CONFIG_INVALID'),
  );
  assert.equal(
    readFlowiseConfig({
      FLOWISE_BASE_URL: 'https://flowise.example/',
      FLOWISE_CHATFLOW_ID: 'flow',
    }).baseUrl,
    'https://flowise.example',
  );
});

test('Flowise request uses official prediction path, server auth and JSON context', async () => {
  const input = request();
  const reply = await predictFlowise(input, config, async (url, init) => {
    assert.equal(url, 'https://flowise.example/api/v1/prediction/flow_123');
    assert.equal(init.headers.Authorization, 'Bearer server-only-test-key');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.streaming, false);
    assert.equal(body.overrideConfig.sessionId, input.sessionId);
    assert.equal(JSON.parse(body.question).userMessage, input.action.text);
    assert.equal(
      JSON.parse(body.question).context.dataMode,
      'authored-demo-data',
    );
    assert.ok(!init.body.includes(config.apiKey));
    return Response.json({
      json: {
        message: '장소를 찾아볼게요',
        actions: [{ type: 'region', region: '제주' }],
      },
    });
  });
  assert.equal(reply.actions[0].type, 'region');
});

test('Flowise text-only and text-encoded JSON responses are supported', async () => {
  const input = request();
  const plain = await predictFlowise(input, config, async () =>
    Response.json({ text: '여행할 지역을 알려주세요.' }),
  );
  assert.deepEqual(plain, {
    message: '여행할 지역을 알려주세요.',
    actions: [],
  });
  const structured = await predictFlowise(input, config, async () =>
    Response.json({
      text: '```json\n{"message":"비교해볼게요","actions":[{"type":"compare"}]}\n```',
    }),
  );
  assert.equal(structured.actions[0].type, 'compare');
});

test('malformed model JSON and upstream failure never silently become demo success', async () => {
  const input = request();
  await assert.rejects(
    () =>
      predictFlowise(input, config, async () =>
        Response.json({ text: '{"message":"broken"' }),
      ),
    errorCode('MODEL_OUTPUT_INVALID'),
  );
  await assert.rejects(
    () =>
      predictFlowise(input, config, async () =>
        Response.json({ error: 'secret upstream detail' }, { status: 401 }),
      ),
    errorCode('FLOWISE_UPSTREAM_ERROR'),
  );
  await assert.rejects(
    () =>
      predictFlowise(input, config, async () => {
        throw new Error('private connection data');
      }),
    errorCode('FLOWISE_UNAVAILABLE'),
  );
});

test('Flowise oversized streamed body is bounded and timeout aborts requests', async () => {
  await assert.rejects(
    () =>
      predictFlowise(
        request(),
        config,
        async () => new Response('x'.repeat(MAX_MODEL_RESPONSE_BYTES + 1)),
      ),
    errorCode('FLOWISE_RESPONSE_TOO_LARGE'),
  );
  await assert.rejects(
    () =>
      predictFlowise(
        request(),
        { ...config, timeoutMs: 20 },
        async (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            );
          }),
      ),
    errorCode('FLOWISE_TIMEOUT'),
  );
});

test('HTTP chat route implements demo mode and prevents cross-origin and oversized requests', async () => {
  const response = await POST(post(request()));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'demo');
  assert.equal(body.revision, 2);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const foreign = await POST(
    post(request(), { Origin: 'https://foreign.example' }),
  );
  assert.equal(foreign.status, 403);
  const oversized = await POST(
    new Request('https://moa.example/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(MAX_CHAT_REQUEST_BYTES + 1),
    }),
  );
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'REQUEST_TOO_LARGE');
});

test('HTTP errors preserve existing session and expose no credentials or upstream details', async () => {
  const input = request();
  const before = JSON.stringify(input.session);
  const response = await POST(post({ ...input, baseRevision: 2 }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.deepEqual(body.error, {
    code: 'REVISION_MISMATCH',
    message: '현재 대화와 요청의 기준이 달라요. 다시 시도해 주세요.',
  });
  assert.equal(body.session, undefined);
  assert.equal(JSON.stringify(input.session), before);
});

test('partial model configuration does not block direct cards or explicit human reset', async () => {
  Object.assign(env, {
    FLOWISE_BASE_URL: 'https://flowise.example',
    FLOWISE_CHATFLOW_ID: '',
    FLOWISE_API_KEY: '',
  });
  try {
    const card = await POST(
      post(request(createTripSession(), { type: 'help' })),
    );
    assert.equal(card.status, 200);
    const session = appendTrip(createTripSession(['hyeopjae']), {
      type: 'message',
      text: '제주 1박 2일 일정 짜줘',
    });
    const reset = await POST(
      post(request(session, { type: 'message', text: '대화 초기화해줘' })),
    );
    assert.equal(reset.status, 200);
    const resetBody = await reset.json();
    assert.equal(resetBody.session.turns.length, 1);
    assert.deepEqual(currentTrip(resetBody.session).savedIds, ['hyeopjae']);
    const question = await POST(post(request()));
    assert.equal(question.status, 503);
    assert.equal((await question.json()).error.code, 'FLOWISE_CONFIG_INVALID');
  } finally {
    Object.assign(env, {
      FLOWISE_BASE_URL: '',
      FLOWISE_CHATFLOW_ID: '',
      FLOWISE_API_KEY: '',
    });
  }
});

test('configured HTTP prediction returns the structured model turn without exposing its key', async (t) => {
  Object.assign(env, {
    FLOWISE_BASE_URL: 'https://flowise.example',
    FLOWISE_CHATFLOW_ID: 'flow_123',
    FLOWISE_API_KEY: 'server-only-test-key',
  });
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      json: {
        message: '제주 장소를 찾아볼게요.',
        actions: [{ type: 'region', region: '제주' }],
      },
    }),
  );
  try {
    const response = await POST(post(request()));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, 'flowise');
    assert.equal(body.session.turns.at(-1).source, 'flowise');
    assert.equal(body.message, '제주 장소를 찾아볼게요.');
    assert.ok(!JSON.stringify(body).includes('server-only-test-key'));
  } finally {
    t.mock.restoreAll();
    Object.assign(env, {
      FLOWISE_BASE_URL: '',
      FLOWISE_CHATFLOW_ID: '',
      FLOWISE_API_KEY: '',
    });
  }
});
