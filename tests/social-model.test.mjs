import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { createTripSession, appendTrip, currentTrip, isTripSession } = await import('../lib/trip-engine.ts');
const { parseTripAction, parseTripSession, applyModelReply } = await import('../lib/chat-contract.ts');
const { buildModelInput } = await import('../lib/model-input.ts');
const { localFeatureTask } = await import('../lib/local-feature-intent.ts');
const { socialRequestCandidates, socialActionMatchesRequest } = await import('../lib/social-intent.ts');
const { needsTravelRetrieval } = await import('../lib/chat-resources.ts');
const { predictLargeModel, readLargeModelConfig } = await import('../lib/large-model-adapter.ts');
const { communityTrips } = await import('../lib/community-trips.ts');
const { getSocialSample } = await import('../lib/social-samples.ts');
const { socialModelSample, socialModelSamples } = await import('../lib/social-model-samples.ts');
const { modelContext } = await import('../lib/model-context.ts');
const course = communityTrips.find(item => item.id === 'community-jeju-west-real-11');
const business = 'catalog-jeju-hyeopjae-sin-guksu';
const entityTarget = { kind: 'entity', id: business };
const request = (session, text) => ({ protocolVersion: 1, requestId: 'social-test', sessionId: 'social-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
function fixture() {
  let session = appendTrip(createTripSession(['hyeopjae']), { type: 'copy-community', id: course.id });
  session = appendTrip(session, { type: 'visit-details', id: currentTrip(session).plan[0].id, note: 'PRIVATE_SOCIAL_PLAN_NOTE', time: '09:10' });
  return appendTrip(session, { type: 'save' });
}
function assertOriginals(before, after) {
  const a = currentTrip(before), b = currentTrip(after);
  for (const key of ['plan', 'savedIds', 'collectedIds', 'region', 'days', 'title', 'startDate', 'booked', 'communitySourceId', 'savedPlanId']) assert.deepEqual(b[key], a[key], key);
  assert.deepEqual(after.library, before.library);
}
const config = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: 'qwen3:14b' });
const resources = { retrievalStatus: 'not-needed', retrievalInstruction: '', coverage: { sufficient: false, reason: 'missing-evidence' } };
async function predict(input, actions) {
  return predictLargeModel(input, config, async (url) => {
    if (String(url).endsWith('/api/show')) return Response.json({ details: { format: 'gguf', parameter_size: '14.8B', quantization_level: 'Q4_K_M' } });
    assert.ok(String(url).endsWith('/api/chat'));
    return Response.json({ done: true, done_reason: 'stop', message: { content: JSON.stringify({ message: '해당 스레드와 반응 화면을 확인하세요.', actions }) } });
  }, resources);
}

test('named business threads use bounded SAMPLE metrics without private plans or invented member metrics', () => {
  const input = request(fixture(), '협재신국수 스레드 보여줘. 댓글은 자동 전송하지 마.');
  assert.equal(localFeatureTask(input), 'social');
  assert.equal(needsTravelRetrieval(input), false);
  const context = buildModelInput(input).question.context;
  assert.deepEqual(context.allowedToolTypes, ['social']);
  assert.deepEqual(context.social.candidates.map(item => item.target), [entityTarget]);
  assert.equal(context.social.requestedView, 'threads');
  assert.deepEqual(context.social.publicMetrics, { source: 'UNCONNECTED', copies: null, reactions: null, threads: null });
  const sample = getSocialSample(entityTarget);
  assert.ok(sample);
  assert.deepEqual(context.social.publicSamples, [{
    target: entityTarget, source: 'SAMPLE', copies: sample.copies,
    reactions: { LIKE: sample.reactions.LIKE, LOVE: sample.reactions.LOVE, BEST: sample.reactions.BEST, HELPFUL: sample.reactions.HELPFUL },
    threads: { total: sample.threads.length, roots: sample.threads.filter(thread => thread.parentId === null).length,
      replies: sample.threads.filter(thread => thread.parentId !== null).length },
  }]);
  for (const thread of sample.threads) {
    assert.ok(!JSON.stringify(context).includes(thread.body));
    assert.ok(!JSON.stringify(context).includes(thread.author.id));
  }
  assert.ok(!JSON.stringify(context).includes('PRIVATE_SOCIAL_PLAN_NOTE'));
  for (const key of ['publicCourses', 'savedTrips', 'catalog', 'threads', 'memberStatistics']) assert.ok(!(key in context));
});

test('social read actions and reload validation preserve itinerary, favorites, private saved original and source', async () => {
  const before = fixture(), snapshot = structuredClone(before);
  const input = request(before, '협재신국수 스레드 보여줘');
  const action = { type: 'social', target: entityTarget, view: 'threads' };
  const reply = await predict(input, [action]);
  const after = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(after).stage, 'social');
  assert.deepEqual(currentTrip(after).socialTarget, entityTarget);
  assert.equal(currentTrip(after).socialView, 'threads');
  assertOriginals(before, after);
  assert.deepEqual(before, snapshot);
  assert.equal(isTripSession(after), true);
  assert.deepEqual(parseTripSession(JSON.parse(JSON.stringify(after))), JSON.parse(JSON.stringify(after)));
  assert.match(after.turns.at(-1).assistantMessage, /샘플 커뮤니티/);
  assert.match(after.turns.at(-1).assistantMessage, /이 기기에 저장/);
  assert.equal(currentTrip(after).notice, '');
});

test('course evaluations and collections open the separate public-course reaction scope', async () => {
  const before = fixture(), input = request(before, `${course.title} 코스 평가랑 담김 보여줘`);
  const action = { type: 'social', target: { kind: 'course', id: course.id }, view: 'overview' };
  assert.equal(localFeatureTask(input), 'social');
  const context = buildModelInput(input).question.context;
  const sample = getSocialSample(action.target);
  assert.deepEqual(context.social.publicSamples.map(item => item.target), [action.target]);
  assert.equal(context.social.publicSamples[0].copies, sample.copies);
  assert.equal(context.social.publicSamples[0].source, 'SAMPLE');
  const reply = await predict(input, [action]);
  const after = applyModelReply(input, reply, 'flowise');
  assert.deepEqual(currentTrip(after).socialTarget, action.target);
  assertOriginals(before, after);
});

test('a named course-card thread cannot be replaced by its global business or another course card', async () => {
  const before = fixture(), input = request(before, `${course.title} 코스의 협재신국수 카드 스레드 보여줘`);
  const expected = { kind: 'course-place', id: course.id, visitIndex: 1 };
  assert.deepEqual(socialRequestCandidates(currentTrip(before), input.action.text).map(item => item.target), [expected]);
  assert.deepEqual(buildModelInput(input).question.context.social.publicSamples.map(item => item.target), [expected]);
  const correct = { type: 'social', target: expected, view: 'threads' };
  const after = applyModelReply(input, { message: '카드 스레드 화면을 열게요.', actions: [correct] }, 'flowise');
  assert.deepEqual(currentTrip(after).socialTarget, expected);
  assertOriginals(before, after);
  for (const target of [entityTarget, { kind: 'course', id: course.id }, { kind: 'course-place', id: course.id, visitIndex: 2 }]) {
    assert.throws(() => applyModelReply(input, { message: '조회 화면입니다.', actions: [{ ...correct, target }] }, 'flowise'));
    await assert.rejects(predict(input, [{ ...correct, target }]), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  }
});

test('model sample projection is scope-bound, bounded and independent of device records', () => {
  assert.equal(socialModelSample({ kind: 'entity', id: 'unknown' }), null);
  const targets = [entityTarget, { kind: 'course', id: course.id }, { kind: 'course-place', id: course.id, visitIndex: 1 }];
  const projection = socialModelSamples(targets.map(target => ({ target })));
  assert.deepEqual(projection.map(item => item.target), targets);
  assert.equal(socialModelSamples(Array.from({ length: 20 }, () => ({ target: entityTarget }))).length, 8);
  const session = fixture(), input = request(session, '협재신국수 스레드 보여줘');
  const first = buildModelInput(input).question.context.social;
  const modified = structuredClone(input);
  modified.session.library.push({ ...structuredClone(modified.session.library[0]), id: 'PRIVATE_SAVED_COPY_ID', title: 'PRIVATE_SAVED_COPY_TITLE' });
  modified.session.localSocial = { body: 'PRIVATE_LOCAL_COMMENT_BODY', reaction: 'LOVE' };
  assert.deepEqual(buildModelInput(modified).question.context.social, first);
  assert.deepEqual(modelContext(input).social.publicSamples, first.publicSamples);
  assert.ok(!JSON.stringify(buildModelInput(modified)).includes('PRIVATE_'));
});

test('social instructions preserve SAMPLE provenance and validated text never echoes fictional server claims', () => {
  const input = request(fixture(), '협재신국수 스레드 보여줘');
  const text = buildModelInput(input).messages[0].content;
  for (const word of ['publicSamples', 'SAMPLE', 'UNCONNECTED', '실제 회원', '전송']) assert.ok(text.includes(word), word);
  const after = applyModelReply(input, {
    message: '실제 회원 999명이 다녀갔고 댓글을 서버에 등록했어요.',
    actions: [{ type: 'social', target: entityTarget, view: 'threads' }],
  }, 'flowise');
  assert.ok(!after.turns.at(-1).assistantMessage.includes('999'));
  assert.match(after.turns.at(-1).assistantMessage, /샘플 커뮤니티/);
  assertOriginals(input.session, after);
});

test('social tool rejects writing payloads, unknown targets and invalid card indexes', () => {
  for (const extra of [{ body: '작성하려는 댓글' }, { score: 5 }, { reaction: 'LOVE' }, { submit: true }, { delete: true }]) assert.throws(() => parseTripAction({ type: 'social', target: entityTarget, ...extra }));
  for (const target of [{ kind: 'entity', id: 'unknown' }, { kind: 'course', id: business }, { kind: 'course-place', id: course.id, visitIndex: -1 }, { kind: 'course-place', id: course.id, visitIndex: 999 }, { ...entityTarget, body: 'nested payload' }]) assert.throws(() => parseTripAction({ type: 'social', target }));
  assert.throws(() => parseTripAction({ type: 'social', target: entityTarget, view: 'submit' }));
});

test('every model provider rejects unrelated edits and duplicate social actions atomically', async () => {
  const before = fixture(), input = request(before, '협재신국수 스레드 보여줘. 내 일정은 그대로 둬.'), snapshot = structuredClone(before);
  const social = { type: 'social', target: entityTarget, view: 'threads' };
  for (const actions of [[{ type: 'trip-meta', title: '무관한 변경' }], [social, { type: 'save' }], [social, social], [{ type: 'open_spotlog', target: 'community', entry: 'place-comment' }]]) {
    assert.throws(() => applyModelReply(input, { message: '확인합니다.', actions }, 'flowise'));
  }
  await assert.rejects(predict(input, [{ type: 'trip-meta', title: '무관한 변경' }]), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  assert.deepEqual(before, snapshot);
});

test('explicit app navigation and existing generic app social requests keep their original destination', () => {
  const before = fixture();
  for (const text of ['협재신국수 스레드를 앱에서 열어줘', '협재신국수 댓글 창을 앱에서 열어줘', '공개 여행기 전체 댓글 창을 보여줘. 댓글 전송은 하지 마.', '공개 장소 카드 좋아요 반응 창만 열어줘. 반응은 직접 누를게.', '다른 사람의 공개 여행기 응원 창만 열어줘.']) assert.equal(localFeatureTask(request(before, text)), 'app', text);
});

test('unknown or multiple named targets cannot be guessed, and explicit read prohibitions preserve the screen', () => {
  const state = currentTrip(fixture());
  for (const text of ['없는업체ABC 스레드 보여줘', '협재신국수 봉성식당 스레드 보여줘', '협재신국수 스레드는 보여주지 마']) assert.equal(socialActionMatchesRequest({ target: entityTarget, view: 'threads' }, state, text), false, text);
  assert.equal(socialActionMatchesRequest({ target: { id: business, kind: 'entity' }, view: 'threads' }, state, '협재신국수 스레드 보여줘'), true);
});

test('collection counts open the overview and evaluation-purpose fixture wording never acquires social authority', () => {
  const before = fixture();
  for (const suffix of ['담김 보여줘', '평가랑 담김 보여줘', '댓글이랑 담김 보여줘']) {
    const context = buildModelInput(request(before, `${course.title} ${suffix}`)).question.context;
    assert.equal(context.requestedFeature, 'social');
    assert.equal(context.social.requestedView, 'overview');
  }
  for (const text of ['평가용으로 작성한 제주 이틀 일정입니다.', '평가 전용 제주 이틀 일정입니다.', '내 이틀 일정을 평가해줘']) assert.notEqual(localFeatureTask(request(before, text)), 'social', text);
});

test('current scope references retain course-card identity and state reload rejects missing or forged social targets', () => {
  const before = fixture();
  const target = { kind: 'course-place', id: course.id, visitIndex: 1 };
  const after = appendTrip(before, { type: 'social', target, view: 'threads' });
  assert.deepEqual(socialRequestCandidates(currentTrip(after), '이 카드 평가 보여줘').map(item => item.target), [target]);
  for (const corrupt of [{ socialTarget: undefined }, { socialTarget: { kind: 'entity', id: 'unknown' } }, { socialView: 'write' }]) {
    const invalid = structuredClone(after); Object.assign(invalid.turns.at(-1).state, corrupt);
    assert.equal(isTripSession(invalid), false); assert.throws(() => parseTripSession(invalid));
  }
});
