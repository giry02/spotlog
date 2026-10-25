import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { modelContext } = await import('../lib/model-context.ts');
const { compactModelContext, buildModelInput, resolveModelEvidenceIds, usesItineraryPlanner } = await import('../lib/model-input.ts');
const { itinerarySystemPrompt } = await import('../lib/model-system-prompt.ts');
const { createTripSession, appendTrip } = await import('../lib/trip-engine.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { parseModelReply, applyModelReply } = await import('../lib/chat-contract.ts');
const { predictFlowise, readFlowiseConfig } = await import('../lib/flowise-adapter.ts');

test('planning input keeps fresh evidence and current request while withholding unrelated action catalogs', () => {
  const original = request();
  const input = { ...original, action: { type: 'message', text: '제주 당일 일정으로 사려니숲길과 절물자연휴양림만 넣어줘. 식당 카페 숙소는 빼줘.' } };
  const evidence = { ...retrieval(), results: retrieval().results.filter(r => r.placeId === 'osulloc') };
  const before = structuredClone(input);
  const model = buildModelInput(input, { retrieval: evidence, retrievalStatus: 'available', retrievalInstruction: '검증한 근거만 사용' });
  assert.equal(model.question.userMessage, input.action.text);
  assert.equal(model.question.context.itineraryRequest.days, 1);
  assert.equal(model.question.context.itineraryRequest.daysSpecified, true);
  assert.deepEqual(model.question.context.itineraryCandidates.map(p => p.id), ['osulloc']);
  assert.equal(model.question.context.catalog, undefined);
  assert.equal(model.question.context.candidates, undefined);
  assert.deepEqual(model.question.context.retrieval.results.map(r => r.text), evidence.results.map(r => r.text));
  assert.ok(model.question.context.state.plan.some(v => v.locked));
  assert.deepEqual(input, before);
});

test('planning deduplicates only identical answers while retaining every recent user constraint and current booking state', () => {
  const input = request();
  const last = input.session.turns.at(-1);
  for (let index = 0; index < 6; index++) {
    input.session.turns.push({
      ...structuredClone(last), id: input.session.nextId++,
      assistantMessage: 'REPEATED_COMPLETED_PLAN '.repeat(100),
      state: { ...structuredClone(last.state), question: `앞선 사용자 조건 ${index}: 식사 예산과 예약을 지켜줘.` },
    });
  }
  input.action.text = '제주 2박 3일 오전 오후 한 곳씩 일정 짜줘. 사려니숲길은 꼭 포함해줘. 바다와 숲 위주로 해줘. 식당 카페 숙소는 빼줘.';
  const original = structuredClone(input);
  freezeDeep(input);
  const model = buildModelInput(input, retrieval());
  assert.ok(model.messages[0].content.startsWith(itinerarySystemPrompt));
  const history = model.question.recentConversation;
  assert.deepEqual(history.map(turn => turn.question), input.session.turns.slice(-6).map(turn => turn.state.question));
  assert.equal(history[0].answer, input.session.turns.at(-1).assistantMessage);
  assert.ok(history.slice(1).every(turn => turn.answerSameAsConversation === 1 && turn.answer === undefined));
  assert.match(model.messages[0].content, /answerSameAsConversation.*1부터 시작/);
  assert.equal(JSON.stringify(model.messages).match(/REPEATED_COMPLETED_PLAN/g).length, 100);
  assert.deepEqual(model.question.context.state, {
    ...modelContext(input).state,
    plan: modelContext(input).state.plan.map(({ knowledge: _knowledge, ...visit }) => visit),
  });
  assert.equal(model.question.context.itineraryRequest.days, 3);
  assert.equal(model.question.context.itineraryPreferences.morningAfternoon, true);
  assert.ok(model.question.context.itineraryRequest.namedPlaceIds.includes('saryeoni'));
  assert.deepEqual(model.question.context.itineraryPreferences.themes, ['바다·해안', '숲']);
  assert.equal(model.question.userMessage, input.action.text);
  assert.deepEqual(input, original);
});

test('every shared-answer reference restores the exact original answer from an earlier item in the transmitted history', () => {
  const input = request();
  const base = structuredClone(input.session.turns.at(-1));
  const answers = ['제안 1: 바다 위주 코스', undefined, '제안 2: 숲 위주 코스', '제안 1: 바다 위주 코스', '제안 2: 숲 위주 코스', '서로 다른 세 번째 제안'];
  for (const [index, answer] of answers.entries()) {
    input.session.turns.push({ ...structuredClone(base), id: input.session.nextId++, state: { ...structuredClone(base.state), question: `선택지 질문 ${index + 1}` }, ...(answer === undefined ? {} : { assistantMessage: answer }) });
  }
  input.action.text = '두 번째 안으로 제주 2박 3일 일정 짜줘.';
  const model = buildModelInput(freezeDeep(input), retrieval());
  const history = model.question.recentConversation;
  const restored = history.map((turn, index) => {
    if (turn.answerSameAsConversation === undefined) return { question: turn.question, answer: turn.answer };
    assert.ok(Number.isInteger(turn.answerSameAsConversation));
    assert.ok(turn.answerSameAsConversation >= 1 && turn.answerSameAsConversation < index + 1);
    const original = history[turn.answerSameAsConversation - 1];
    assert.equal(typeof original.answer, 'string');
    assert.equal(original.answerSameAsConversation, undefined);
    return { question: turn.question, answer: original.answer };
  });
  assert.deepEqual(restored, input.session.turns.slice(-6).map(turn => ({ question: turn.state.question, answer: turn.assistantMessage })));
  assert.deepEqual(history.filter(turn => turn.answerSameAsConversation !== undefined).map(turn => turn.answerSameAsConversation), [1, 3]);
});

test('history-dependent replanning keeps the prior answers intact', () => {
  for (const prefix of ['', '같은 조건으로', '방금 만든 거에서', '이전꺼처럼', '앞서 추천한 곳으로', '그렇게', '두 번째 안으로', '2번 코스로', '추천해준 코스로', '이걸로']) {
    const input = request();
    input.session.turns.at(-1).state.question = '숲길 위주로 하고 우도는 빼줘.';
    input.session.turns.at(-1).assistantMessage = '1번은 바다 코스, 2번은 사려니숲길을 포함하고 우도를 제외한 숲 코스예요.';
    input.session.turns.push({
      ...structuredClone(input.session.turns.at(-1)), id: input.session.nextId++,
      state: { ...structuredClone(input.session.turns.at(-1).state), question: '대안의 차이를 설명해줘.' },
      assistantMessage: '첫 번째 안은 바다를, 두 번째 안은 숲과 여유로운 산책을 중심으로 제안했어요.',
    });
    input.action.text = `${prefix} 제주 2박 3일 일정 다시 짜줘.`;
    const model = buildModelInput(input, retrieval());
    assert.equal(model.messages[0].content, itinerarySystemPrompt);
    assert.deepEqual(model.question.recentConversation, input.session.turns.slice(-6).filter(turn => turn.state.question).map(turn => ({ question: turn.state.question, answer: turn.assistantMessage })));
    assert.equal(model.question.recentConversationFormat, undefined);
  }
});

test('planner deduplicates only exact repeated titles and preserves every RAG body, source, candidate and reference', () => {
  const input = request();
  input.action.text = '제주 당일 일정 짜줘. 식당 카페 숙소는 빼줘.';
  const evidence = retrieval();
  evidence.results[0].title = '본문과 다른 고유 문서 제목';
  const original = structuredClone(evidence);
  freezeDeep(evidence);
  const context = buildModelInput(input, evidence).question.context;
  assert.deepEqual(context.retrieval.results.map(item => item.text), evidence.results.map(item => item.text));
  context.retrieval.results.forEach((item, index) => {
    const source = evidence.results[index];
    assert.equal(item.evidenceId, `ref${index + 1}`);
    assert.equal(item.placeId, source.placeId);
    assert.equal(item.sourceKind, source.sourceKind);
    assert.equal(item.checkedAt, source.checkedAt);
    if (item.title === undefined) assert.ok(source.text === source.title || source.text.startsWith(`${source.title}\n`));
    else assert.equal(item.title, source.title);
  });
  assert.equal(context.retrieval.results[0].title, '본문과 다른 고유 문서 제목');
  assert.deepEqual(context.itineraryCandidates.map(item => item.id), [...new Set(evidence.results.map(item => item.placeId))]);
  for (const candidate of context.itineraryCandidates) {
    assert.ok(candidate.name && candidate.region && candidate.area && candidate.tags.length);
    assert.ok(['half-day', 'full-day'].includes(candidate.dayScope));
    assert.ok(candidate.representativeLocation.latitude && candidate.representativeLocation.longitude);
    assert.deepEqual(candidate.evidenceIds, evidence.results.flatMap((item, index) => item.placeId === candidate.id ? [`ref${index + 1}`] : []));
  }
  assert.deepEqual(evidence, original);
});

test('the exact live Busan generation and explicit no-additions protection clauses retain the narrow planner', () => {
  const session = createTripSession();
  const base = { protocolVersion: 1, requestId: 'live-planner-protection', sessionId: 'live-planner-protection', baseRevision: session.turns.at(-1).id, session };
  const text = '부산 2일 일정을 만들어줘. DAY 1에는 해운대해수욕장 → 동백섬, DAY 2에는 광안리해수욕장을 넣어줘. 이 관광지 세 곳만 넣고 식당·카페·숙소·다른 장소나 미정 방문은 추가하지 마.';
  for (const protection of ['추가하지 마', '추가하지 마세요', '추가하지 말아줘', '추가하지 말아 주세요', '추가하지 말고']) {
    const input = { ...base, action: { type: 'message', text: text.replace('추가하지 마', protection) } };
    assert.equal(usesItineraryPlanner(input), true, protection);
    const built = buildModelInput(input);
    assert.equal(built.question.context.itineraryRequest.days, 2);
    assert.equal(built.question.context.catalog, undefined);
    assert.equal(built.question.userMessage, input.action.text);
  }
  for (const mixed of [
    text + ' 그리고 카페 하나를 추가해줘.',
    text + ' 방문 메모도 수정해줘.',
    text + ' 여행을 저장해줘.',
    '부산 일정은 만들지 마. 다른 장소도 추가하지 마.',
  ]) assert.equal(usesItineraryPlanner({ ...base, action: { type: 'message', text: mixed } }), false, mixed);
});

test('mixed saving, editing and addition requests keep the general action system and main Flowise flow', async () => {
  const config = readFlowiseConfig({ FLOWISE_BASE_URL: 'http://127.0.0.1:3002', FLOWISE_CHATFLOW_ID: 'main-flow', FLOWISE_PLANNER_CHATFLOW_ID: 'planner-flow' });
  for (const text of ['제주 2박 3일 일정 짜고 저장해줘.', '제주 일정에 카페를 추가해서 만들어줘.', '제주 일정에 사려니숲길 넣어줘.', '제주 일정을 만들고 DAY 2 오후는 다른 곳으로 교체해줘.']) {
    const input = request();
    input.action.text = text;
    assert.equal(usesItineraryPlanner(input), false);
    const model = buildModelInput(input, retrieval());
    assert.ok(model.question.context.catalog);
    assert.notEqual(model.messages[0].content, itinerarySystemPrompt);
    const urls = [];
    await predictFlowise(input, config, async url => { urls.push(url); return Response.json({ json: { message: '요청을 확인해요.', actions: [] } }); });
    assert.deepEqual(urls, ['http://127.0.0.1:3002/api/v1/prediction/main-flow']);
  }
});

test('native Flowise dispatches explicit planning to its private planner flow and ordinary chat to the main flow', async () => {
  const config = readFlowiseConfig({ FLOWISE_BASE_URL: 'http://127.0.0.1:3002', FLOWISE_CHATFLOW_ID: 'main-flow', FLOWISE_PLANNER_CHATFLOW_ID: 'planner-flow' });
  const urls = [];
  const fetcher = async (url) => { urls.push(url); return Response.json({ json: { message: '추가 조건을 확인할게요.', actions: [] } }); };
  const input = request();
  await predictFlowise({ ...input, action: { type: 'message', text: '제주 당일 일정 만들어줘' } }, config, fetcher);
  await predictFlowise({ ...input, action: { type: 'message', text: '안녕하세요' } }, config, fetcher);
  assert.deepEqual(urls, ['http://127.0.0.1:3002/api/v1/prediction/planner-flow', 'http://127.0.0.1:3002/api/v1/prediction/main-flow']);
  assert.throws(() => readFlowiseConfig({ FLOWISE_BASE_URL: 'http://127.0.0.1:3002', FLOWISE_CHATFLOW_ID: 'main-flow', FLOWISE_PLANNER_CHATFLOW_ID: '../admin' }), { code: 'FLOWISE_CONFIG_INVALID' });
});

function request() {
  let session = createTripSession();
  session = appendTrip(session, { type: 'region', region: '제주' });
  session = appendTrip(session, { type: 'configure', days: 2, lodging: false });
  session = appendTrip(session, { type: 'build' });
  session.turns.at(-1).state.plan[0].locked = true;
  return { protocolVersion: 1, requestId: 'input-test', sessionId: 'input-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text: 'DAY 2 오후만 바꿔줘. 예약한 곳은 그대로 두고 새 장소를 임의로 빼지 마.' } };
}

function retrieval() {
  return {
    dataMode: 'curated-travel-data',
    indexVersion: 'idx:canonical-original',
    embeddingModel: 'embedding:test',
    results: ragCatalog().filter((item) => item.sourceKind === 'curated-official-summary').slice(0, 5).map((source, index) => ({ ...source, evidenceId: `idx:canonical-original:evidence-${index}`, sourceVersion: `sha256:original-${index}` })),
  };
}

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test('explicit inline reference lists move to verified citation IDs without leaking model aliases', () => {
  const original = retrieval();
  const reply = resolveModelEvidenceIds({ message: '차 문화 공간을 설명해요. (evidenceIds: ref1, ref2) 다음 특징도 참고했어요. (참고: ref2)', actions: [] }, original);
  assert.deepEqual(reply.evidenceIds, original.results.slice(0, 2).map((item) => item.evidenceId));
  assert.equal(reply.message, '차 문화 공간을 설명해요.  다음 특징도 참고했어요.');
  assert.equal(parseModelReply(reply).actions.length, 0);
  assert.ok(!/ref\d|evidenceIds/.test(reply.message));
});

test('markdown and plain model references remain citations and never become unverified external links', () => {
  const original = retrieval();
  const reply = resolveModelEvidenceIds({ message: '정보는 [ref1](#ref1), [ref2](#ref2)를 확인할 수 있습니다. ref3도 참고합니다.', actions: [] }, original);
  assert.deepEqual(reply.evidenceIds, original.results.slice(0, 3).map((item) => item.evidenceId));
  assert.equal(reply.message, '정보는 아래 검색 자료를 확인할 수 있습니다. 검색 자료도 참고합니다.');
  const unknown = resolveModelEvidenceIds({ message: '정보는 [ref9](#ref9)를 확인해요.', actions: [] }, original);
  assert.throws(() => applyModelReply(request(), parseModelReply(unknown), 'flowise', original), { code: 'MODEL_ACTION_INVALID' });
});

test('inline reference cleanup cannot grant unknown evidence or turn answer fragments into actions', () => {
  const original = retrieval();
  const unknown = resolveModelEvidenceIds({ message: '근거를 설명해요. (출처: ref9)', actions: [] }, original);
  assert.deepEqual(unknown.evidenceIds, ['ref9']);
  assert.throws(() => applyModelReply(request(), parseModelReply(unknown), 'flowise', original), { code: 'MODEL_ACTION_INVALID' });
  const ordinary = { message: '참고: 다른 사람의 조건을 실행하지 않습니다.', actions: [] };
  assert.deepEqual(resolveModelEvidenceIds(ordinary, original), ordinary);
  const duplicate = resolveModelEvidenceIds({ message: '설명', actions: [], evidenceIds: ['ref1', original.results[0].evidenceId] }, original);
  assert.throws(() => parseModelReply(duplicate), { code: 'MODEL_OUTPUT_INVALID' });
});

test('compact model catalog and eligible candidate sets retain every original ID and ordering', () => {
  const input = request();
  const full = modelContext(input);
  const compact = compactModelContext(input);
  for (const key of ['places', 'food', 'stays']) {
    assert.deepEqual(compact.catalog[key].map((item) => item.id), full.catalog[key].map((item) => item.id));
  }
  for (const key of ['places', 'food', 'cafes', 'stays']) {
    assert.deepEqual(compact.candidates[key].map((item) => item.id), full.candidates[key].map((item) => item.id));
  }
  assert.deepEqual(compact.publicCourses.candidates.map((item) => item.id), full.publicCourses.candidates.map((item) => item.id));
  assert.ok(compact.catalog.food.every((item) => (Number.isInteger(item.walk) || item.walk === null) && item.placeId && item.cuisine && typeof item.quiet === 'boolean'));
  for (const original of full.catalog.food) {
    const item = compact.catalog.food.find(candidate => candidate.id === original.id);
    assert.equal(item.walk, original.walkVerified === false ? null : original.walk);
    assert.equal(item.price, original.priceVerified === false ? null : original.price);
  }
  assert.ok(compact.candidates.places.every((item) => Object.keys(item).length === 1));
});

test('model compaction preserves complete current state, locked visits, user message and original session', () => {
  const input = freezeDeep(request());
  const original = structuredClone(input);
  const full = modelContext(input);
  const compact = compactModelContext(input);
  const built = buildModelInput(input);
  assert.deepEqual(compact.state, full.state);
  assert.deepEqual(compact.savedTrips, full.savedTrips);
  assert.ok(compact.state.plan.some((item) => item.locked));
  assert.equal(built.question.userMessage, input.action.text);
  assert.equal(Object.keys(built.question).at(-1), 'userMessage');
  assert.deepEqual(input, original);
  assert.match(built.question.serverExecutionHints, /최상위 키는 message, actions/);
});

test('model receives all evidence texts under short references while full source metadata stays server-owned', () => {
  const evidence = freezeDeep(retrieval());
  const original = structuredClone(evidence);
  const compact = buildModelInput(request(), evidence).question.context.retrieval;
  assert.equal(compact.dataMode, evidence.dataMode);
  assert.equal(compact.results.length, evidence.results.length);
  assert.deepEqual(compact.results.map((item) => item.evidenceId), ['ref1', 'ref2', 'ref3', 'ref4', 'ref5']);
  compact.results.forEach((item, index) => {
    assert.equal(item.text, evidence.results[index].text);
    assert.equal(item.placeId, evidence.results[index].placeId);
    assert.equal(item.checkedAt, evidence.results[index].checkedAt);
    assert.ok(Object.keys(item).every((key) => ['evidenceId', 'placeId', 'title', 'text', 'sourceKind', 'checkedAt'].includes(key)));
  });
  for (const privateIndexField of ['sourceVersion', 'chunkId', 'indexVersion', 'sourceUrl', 'embeddingModel']) assert.ok(!JSON.stringify(compact).includes(privateIndexField));
  assert.deepEqual(evidence, original);
  const hints = buildModelInput(request(), evidence).question.serverExecutionHints;
  assert.match(hints, /evidenceIds 배열이 필수/);
  assert.match(hints, /message 본문에는 ref 식별자/);
});

test('resource wrapper keeps availability instructions and aliases evidence without mutating sources', () => {
  const evidence = freezeDeep(retrieval());
  const resources = { retrievalStatus: 'available', retrievalInstruction: '공식 근거와 예시를 구분해 답한다.', retrieval: evidence };
  const context = buildModelInput(request(), resources).question.context;
  assert.equal(context.retrievalInstruction, resources.retrievalInstruction);
  assert.equal(context.retrievalStatus, 'available');
  assert.equal(context.retrieval.results[0].evidenceId, 'ref1');
  assert.equal(evidence.results[0].evidenceId, 'idx:canonical-original:evidence-0');
});

test('evidence aliases map to original IDs for both direct retrieval and resource-wrapped replies', () => {
  const evidence = freezeDeep(retrieval());
  const reply = freezeDeep({ message: '검색 근거 설명', actions: [], evidenceIds: ['ref5', 'ref1'] });
  const expected = [evidence.results[4].evidenceId, evidence.results[0].evidenceId];
  assert.deepEqual(resolveModelEvidenceIds(reply, evidence).evidenceIds, expected);
  assert.deepEqual(resolveModelEvidenceIds(reply, { retrievalStatus: 'available', retrieval: evidence }).evidenceIds, expected);
  assert.deepEqual(reply.evidenceIds, ['ref5', 'ref1']);
});

test('unknown aliases and canonical IDs remain for existing strict evidence validation to reject', () => {
  const evidence = retrieval();
  const originalId = evidence.results[0].evidenceId;
  const reply = { message: '근거 확인', actions: [], evidenceIds: ['ref99', 'made-up:canonical', originalId] };
  assert.deepEqual(resolveModelEvidenceIds(reply, evidence).evidenceIds, reply.evidenceIds);
  assert.deepEqual(resolveModelEvidenceIds(reply).evidenceIds, reply.evidenceIds);
  const noCitation = { message: '일반 대화', actions: [] };
  assert.equal(resolveModelEvidenceIds(noCitation, evidence), noCitation);
});
