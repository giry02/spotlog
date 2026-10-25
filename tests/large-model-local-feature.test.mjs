import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';

const { predictLargeModel, readLargeModelConfig } = await import('../lib/large-model-adapter.ts');
const { createTripSession, appendTrip, currentTrip, placeResults, foodResults } = await import('../lib/trip-engine.ts');
const { applyModelReply, namedItineraryAdditionScope, namedVisitRemovalScope } = await import('../lib/chat-contract.ts');
const local = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: 'qwen3:14b' });
const empty = {
  retrievalStatus: 'empty', coverage: { sufficient: false, reason: 'missing-evidence' },
  retrieval: { dataMode: 'curated-travel-data', indexVersion: 'idx:local-feature', embeddingModel: 'test', results: [] },
};
const unrelated = { ...empty, coverage: { sufficient: true, reason: 'sufficient' }, retrieval: { ...empty.retrieval, results: [{
  evidenceId: 'ev:unrelated', placeId: 'hallasan', documentId: 'doc:unrelated', chunkId: 'chunk:unrelated', sourceVersion: 'sv:unrelated',
  text: '이번 로컬 기능 요청과 관계없는 관광 안내', sourceKind: 'curated-official-summary',
}] } };
const request = (session, text) => ({ protocolVersion: 1, requestId: 'local-feature-test', sessionId: 'local-feature-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
function savedTrip() {
  let session = createTripSession();
  for (const id of ['catalog-busan-geumsu', 'catalog-busan-geodae']) session = appendTrip(session, { type: 'collect-entity', id });
  session = appendTrip(session, { type: 'configure', days: 2 });
  session = appendTrip(session, { type: 'build' });
  session = appendTrip(session, { type: 'visit-details', id: currentTrip(session).plan[0].id, note: 'PRIVATE_LOCAL_FEATURE_NOTE' });
  return appendTrip(session, { type: 'save' });
}
async function predict(input, reply, resources = empty, inspect = () => {}) {
  let calls = 0;
  const result = await predictLargeModel(input, local, async (url, init) => {
    if (String(url).endsWith('/api/show')) return Response.json({ details: { format: 'gguf', parameter_size: '14.8B', quantization_level: 'Q4_K_M' } });
    assert.equal(url, 'http://127.0.0.1:11434/api/chat'); calls++;
    const body = JSON.parse(init.body);
    inspect(body, JSON.parse(body.messages[1].content));
    return Response.json({ done: true, done_reason: 'stop', message: { content: JSON.stringify(reply) } });
  }, resources);
  assert.equal(calls, 1);
  return result;
}
const inspectFeature = (input, feature) => (_body, envelope) => {
  assert.equal(envelope.context.task, 'local-feature-navigator');
  assert.equal(envelope.context.requestedFeature, feature);
  assert.equal(envelope.userMessage, input.action.text);
  assert.equal(envelope.context.catalog, undefined);
  assert.ok(!envelope.context.allowedToolTypes.includes('build'));
  const json = JSON.stringify(envelope);
  for (const privateValue of ['PRIVATE_LOCAL_FEATURE_NOTE', 'latitude', 'longitude', 'sourceTitle']) assert.ok(!json.includes(privateValue));
};

test('no-RAG public-course filters use the local navigator and preserve the private two-day itinerary', async () => {
  const session = savedTrip(), before = structuredClone(session);
  const input = request(session, '공개 코스에서 부산 AI 추천 당일 코스 보여줘. 내 일정은 바꾸지 마.');
  const actions = [{ type: 'community-filter', region: '부산', contentType: 'ai', days: 1 }];
  const reply = await predict(input, { message: '부산 AI 추천 형식의 당일 공개 예시를 보여드려요.', actions }, empty, inspectFeature(input, 'community'));
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).communityRegion, '부산');
  assert.equal(currentTrip(result).communityDays, 1);
  assert.equal(currentTrip(result).communityType, 'ai');
  assert.equal(currentTrip(result).days, 2);
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
  assert.deepEqual(session, before);
});

test('no-RAG photo and motion feeds change only media filters, with a bounded prompt', async () => {
  const session = savedTrip(), before = structuredClone(session);
  for (const [text, mode] of [['제주 관광지 사진 피드 보여줘. 내 일정은 바꾸지 마.', 'photos'], ['제주 관광지 포토 모션 보여줘.', 'motion']]) {
    const input = request(session, text), actions = [{ type: 'media', mode, region: '제주', kind: 'LANDMARK' }];
    const reply = await predict(input, { message: '등록된 사진을 보여드려요.', actions }, empty, inspectFeature(input, 'media'));
    const result = applyModelReply(input, reply, 'large-model');
    assert.equal(currentTrip(result).mediaMode, mode);
    assert.equal(currentTrip(result).mediaRegion, '제주');
    assert.equal(currentTrip(result).region, '부산');
    assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
  }
  assert.deepEqual(session, before);
});

test('a saved itinerary can become READY without tourism RAG or unrelated publication authority', async () => {
  const session = savedTrip(), before = structuredClone(session);
  const input = request(session, '이 여행 작성 완료해줘. 공개 게시하지 마.');
  const reply = await predict(input, { message: '기기에 저장한 여행을 작성 완료로 바꿨어요.', actions: [{ type: 'plan-status', status: 'READY' }] }, empty, inspectFeature(input, 'local-trip'));
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).planStatus, 'READY');
  assert.equal(result.library[0].status, 'READY');
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
  assert.equal(currentTrip(result).spotlogNavigation, undefined);
  assert.deepEqual(session, before);
});

test('READY offline save, list and read use local snapshot IDs and never replace the current trip', async () => {
  let session = appendTrip(savedTrip(), { type: 'plan-status', status: 'READY' });
  const originalPlan = structuredClone(currentTrip(session).plan);
  const input = request(session, '오프라인 사본으로 저장해줘. 공개 게시나 사진 업로드는 하지 마.');
  const reply = await predict(input, { message: '기기 안에 일정 사본을 보관했어요.', actions: [{ type: 'offline-save' }] }, empty, inspectFeature(input, 'local-trip'));
  session = applyModelReply(input, reply, 'large-model');
  assert.equal(session.offlineTrips.length, 1);
  assert.equal(session.offlineTrips[0].sourcePlanId, session.library[0].id);
  const id = session.offlineTrips[0].id;
  for (const [text, action] of [['오프라인 사본 목록 보여줘.', { type: 'offline-library' }], ['오프라인 사본 열어줘.', { type: 'offline-open', id }]]) {
    const next = request(session, text);
    session = applyModelReply(next, await predict(next, { message: '기기의 오프라인 사본을 보여드려요.', actions: [action] }, empty, inspectFeature(next, 'local-trip')), 'large-model');
    assert.deepEqual(currentTrip(session).plan, originalPlan);
  }
});

test('current DRAFT offline requests explain completion without changing status or any other saved trip', async () => {
  const session = savedTrip();
  for (let index = 1; index <= 4; index++) session.library.push({ ...structuredClone(session.library[0]), id: 'other-qa-saved-' + index, title: '다른 QA 여행 ' + index, status: 'READY' });
  const before = structuredClone(session), input = request(session, '현재 여행의 오프라인 사본을 이 기기에 저장해줘.');
  const reply = await predict(input, { message: '현재 여행은 저장된 초안이에요. 작성 완료한 뒤 오프라인 사본으로 보관할 수 있어요.', actions: [] }, empty, (_body, envelope) => {
    assert.equal(envelope.context.state.savedPlanId, currentTrip(session).savedPlanId);
    assert.equal(envelope.context.currentSavedTrip.id, currentTrip(session).savedPlanId);
    assert.equal(envelope.context.currentSavedTrip.status, 'DRAFT');
    assert.equal(envelope.context.currentSavedTrip.offlineSaveAllowed, false);
    assert.equal(envelope.context.savedTrips.length, 5);
    assert.match(envelope.context.currentSavedTrip.offlineSaveIssue, /작성 완료/);
  });
  for (const source of ['flowise', 'ollama', 'large-model']) {
    const result = applyModelReply(input, reply, source);
    assert.equal(currentTrip(result).planStatus, 'DRAFT');
    assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
    assert.deepEqual(result.library, before.library);assert.deepEqual(result.offlineTrips, before.offlineTrips);
    for (const action of [{ type: 'offline-save' }, { type: 'offline-save', id: session.library[1].id }, { type: 'plan-status', status: 'READY' }])
      assert.throws(() => applyModelReply(input, { message: '기기 사본을 저장했어요.', actions: [action] }, source), { code: 'MODEL_ACTION_INVALID' });
  }
  await assert.rejects(predict(input, { message: '작성 완료로 바꿨어요.', actions: [{ type: 'plan-status', status: 'READY' }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  assert.deepEqual(session, before);
});

test('the same current offline request saves only the exact READY current trip and honors negatives', async () => {
  let session = appendTrip(savedTrip(), { type: 'plan-status', status: 'READY' });
  for (let index = 1; index <= 4; index++) session.library.push({ ...structuredClone(session.library[0]), id: 'other-ready-qa-' + index, title: '기존 QA 여행 ' + index });
  const before = structuredClone(session), text = '현재 여행의 오프라인 사본을 이 기기에 저장해줘.', input = request(session, text);
  const reply = await predict(input, { message: '현재 완료 저장본의 기기 사본을 보관했어요.', actions: [{ type: 'offline-save' }] }, empty, (_body, envelope) => {
    assert.equal(envelope.context.currentSavedTrip.id, currentTrip(session).savedPlanId);
    assert.equal(envelope.context.currentSavedTrip.offlineSaveAllowed, true);
  });
  for (const source of ['flowise', 'ollama', 'large-model']) {
    const result = applyModelReply(input, reply, source);
    assert.equal(result.offlineTrips.length, 1);assert.equal(result.offlineTrips[0].sourcePlanId, currentTrip(session).savedPlanId);
    assert.deepEqual(result.library, before.library);assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
    assert.throws(() => applyModelReply(input, { message: '다른 여행 사본', actions: [{ type: 'offline-save', id: session.library[1].id }] }, source), { code: 'MODEL_ACTION_INVALID' });
    for (const negative of ['현재 여행의 오프라인 사본을 저장하지 마.', '현재 여행의 오프라인 사본 저장해주지 마.', '현재 여행의 오프라인 사본 저장 방법을 설명해줘.'])
      assert.throws(() => applyModelReply(request(session, negative), reply, source), { code: 'MODEL_ACTION_INVALID' });
  }
  const changed = appendTrip(session, { type: 'visit-details', id: currentTrip(session).plan[0].id, note: '저장본 이후 현재 변경' });
  const changedInput = request(changed, text);
  const { buildModelInput } = await import('../lib/model-input.ts');
  assert.equal(buildModelInput(changedInput).question.context.currentSavedTrip.offlineSaveAllowed, false);
  assert.throws(() => applyModelReply(changedInput, { message: '예전 완료본으로 대체', actions: [{ type: 'offline-save', id: currentTrip(changed).savedPlanId }] }, 'flowise'), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, before);
});

test('recent-trip continuation uses the saved active record and excludes trashed records', async () => {
  let session = savedTrip();
  const activeId = session.library[0].id;
  session.library.push({ ...structuredClone(session.library[0]), id: 'trash-local-feature', deletedAt: '2026-10-19T00:00:00Z', purgeAfter: '2027-04-19T00:00:00Z' });
  session.recentPlanIds = ['trash-local-feature', activeId];
  const input = request(session, '최근 저장한 여행 이어서 열어줘.');
  const reply = await predict(input, { message: '최근 활성 저장 여행을 이어서 열었어요.', actions: [{ type: 'continue-trip' }] }, empty, inspectFeature(input, 'local-trip'));
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).savedPlanId, activeId);
  assert.ok(result.library.find(item => item.id === 'trash-local-feature').deletedAt);
});

test('an explicit itinerary save can precede READY and offline copy in the same bounded reply', async () => {
  const session = savedTrip();
  const input = request(session, '이 여행을 저장하고 작성 완료한 다음 오프라인 사본으로 저장해줘. 공개 게시하지 마.');
  const actions = [{ type: 'save' }, { type: 'plan-status', status: 'READY' }, { type: 'offline-save' }];
  const result = applyModelReply(input, await predict(input, { message: '여행을 저장하고 작성 완료한 뒤 기기 사본으로 보관했어요.', actions }), 'large-model');
  assert.equal(result.library[0].status, 'READY');
  assert.equal(result.offlineTrips.length, 1);
  const offlineOnly = request(session, '오프라인 사본으로 저장해줘.');
  await assert.rejects(predict(offlineOnly, { message: '원본도 저장했어요.', actions: [{ type: 'save' }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});

test('journal preview opens only its explicit app entry and does not publish or edit an itinerary', async () => {
  const session = savedTrip(), before = structuredClone(session);
  const input = request(session, '여행기 미리보기로 열어줘. 게시하지 마.');
  const action = { type: 'open_spotlog', target: 'journal', entry: 'journal-preview' };
  const reply = await predict(input, { message: 'Spotlog 여행기 미리보기 화면을 여는 버튼을 준비했어요.', actions: [action] }, empty, inspectFeature(input, 'app'));
  const result = applyModelReply(input, reply, 'large-model');
  assert.deepEqual(currentTrip(result).spotlogNavigation, { target: 'journal', entry: 'journal-preview' });
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
  assert.deepEqual(result.library, session.library);
  assert.deepEqual(session, before);
});

test('every local navigator task rejects unrelated builds, original edits, and cross-task operations', async () => {
  const session = savedTrip();
  const requests = ['공개 코스에서 부산 당일 코스 보여줘.', '제주 관광지 사진 피드 보여줘.', '이 여행 작성 완료해줘.', '오프라인 사본 목록 보여줘.', '여행기 미리보기로 열어줘.'];
  for (const text of requests) for (const action of [
    { type: 'build', visits: [{ day: 1, placeId: 'hallasan' }] },
    { type: 'trip-meta', title: '무관한 원본 변경' },
    { type: 'region', region: '서울' },
  ]) await assert.rejects(predict(request(session, text), { message: '요청 범위를 벗어났어요.', actions: [action] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  for (const [text, action] of [
    [requests[0], { type: 'media', mode: 'photos' }],
    [requests[1], { type: 'community-filter', region: '서울' }],
    [requests[2], { type: 'offline-save' }],
    [requests[3], { type: 'offline-remove', id: 'offline-nonexistent' }],
    [requests[4], { type: 'open_spotlog', target: 'account', entry: 'account-delete' }],
    [requests[4], { type: 'open_spotlog', target: 'journal', entry: 'journal-preview', journeyId: session.library[0].id }],
  ]) await assert.rejects(predict(request(session, text), { message: '무관한 기능을 실행했어요.', actions: [action] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});

test('local-feature authority stays bounded even with unrelated retrieved evidence', async () => {
  const input = request(savedTrip(), '공개 코스에서 부산 AI 추천 당일 코스 보여줘.');
  const actions = [{ type: 'community-filter', region: '부산', contentType: 'ai', days: 1 }];
  assert.deepEqual((await predict(input, { message: '공개 예시를 보여드려요.', actions }, unrelated)).actions, actions);
  for (const reply of [
    { message: '무관한 관광 일정을 만들었어요.', actions: [{ type: 'build', visits: [{ day: 1, placeId: 'hallasan' }] }] },
    { message: '공개 예시를 보여드려요.', actions, evidenceIds: ['ev:unrelated'] },
  ]) await assert.rejects(predict(input, reply, unrelated), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});

test('a public-course browse is not authorization to copy a course into the private itinerary', async () => {
  const input = request(savedTrip(), '공개 코스에서 부산 AI 추천 당일 코스 보여줘.');
  await assert.rejects(predict(input, { message: '내 여행으로 가져왔어요.', actions: [{ type: 'copy-community', id: 'community-app-public-busan-coast-day' }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});

test('an explicitly named public course copies into a personal draft without changing the public source or saved trip', async () => {
  const { findCommunityTrip } = await import('../lib/community-trips.ts');
  const session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  const before = structuredClone(session);
  for (const [text, id] of [
    ['서쪽 바다와 차밭 1박 2일 코스를 내 여행으로 가져와. 공개 원본은 그대로 두고 내 여행 초안으로 복사해줘.', 'community-jeju-west-sea'],
    ['서쪽 바다와 차밭 1박 2일 코스를 내 여행 초안으로 복사해줘. 공개 원본은 수정하지 마.', 'community-jeju-west-sea'],
    ['첫 번째 코스를 내 여행 초안으로 가져와. 원본은 유지해줘.', 'community-jeju-west-real-11'],
  ]) {
    const course = findCommunityTrip(id), sourceBefore = structuredClone(course), action = { type: 'copy-community', id };
    const input = request(session, text);
    const reply = await predict(input, { message: '개인 여행 초안으로 가져왔어요.', actions: [action] }, empty, inspectFeature(input, 'community'));
    const result = applyModelReply(input, reply, 'large-model');
    assert.equal(currentTrip(result).communitySourceId, course.id);
    assert.equal(currentTrip(result).region, '제주');
    assert.equal(currentTrip(result).days, 2);
    assert.equal(currentTrip(result).planStatus, 'DRAFT');
    assert.deepEqual(currentTrip(result).plan.map(({ id, locked, ...visit }) => visit), course.visits);
    assert.deepEqual(result.library, before.library);
    assert.deepEqual(session, before);
    assert.deepEqual(course, sourceBefore);
    for (const wrong of [
      { type: 'copy-community', id: 'community-jeju-east-green' },
      { type: 'trip-meta', title: '무관한 변경' },
      { type: 'plan-status', status: 'DRAFT' },
    ]) await assert.rejects(predict(input, { message: '범위 밖 변경', actions: [wrong] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  }
});

test('an explicit public draft import accepts exactly one copy action and no mixed batch', async () => {
  const session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  const before = structuredClone(session);
  const input = request(session, '서쪽 바다와 차밭 1박 2일 코스를 내 여행으로 가져와. 공개 원본은 그대로 두고 내 여행 초안으로 복사해줘.');
  const copy = { type: 'copy-community', id: 'community-jeju-west-sea' };
  for (const actions of [
    [], [copy, copy],
    [copy, { type: 'community-filter', region: '제주' }],
    [{ type: 'community-filter', region: '제주' }, copy],
    [copy, { type: 'show', stage: 'community' }],
    [copy, { type: 'trip-meta', title: '추가 변경' }],
    [copy, { type: 'plan-status', status: 'DRAFT' }],
    [copy, { type: 'build' }],
  ]) await assert.rejects(predict(input, { message: '공개 코스를 가져왔어요.', actions }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  assert.deepEqual((await predict(input, { message: '개인 초안으로 가져왔어요.', actions: [copy] }, unrelated)).actions, [copy]);
  assert.deepEqual(session, before);
});

test('every model source enforces the same single public-copy batch at mutation time', () => {
  const session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  const before = structuredClone(session), copy = { type: 'copy-community', id: 'community-jeju-west-sea' };
  const input = request(session, '서쪽 바다와 차밭 1박 2일 코스를 내 여행으로 가져와. 공개 원본은 그대로 두고 내 여행 초안으로 복사해줘.');
  for (const source of ['flowise', 'ollama', 'large-model']) {
    for (const actions of [[], [copy, copy], [copy, { type: 'community-filter', region: '제주' }], [copy, { type: 'show', stage: 'community' }], [copy, { type: 'trip-meta', title: '추가 변경' }]])
      assert.throws(() => applyModelReply(input, { message: '가져왔어요.', actions }, source), { code: 'MODEL_ACTION_INVALID' });
    const result = applyModelReply(input, { message: '개인 초안으로 가져왔어요.', actions: [copy] }, source);
    assert.equal(currentTrip(result).communitySourceId, copy.id);
    assert.equal(currentTrip(result).planStatus, 'DRAFT');
    assert.deepEqual(result.library, before.library);
    for (const text of [
      '공개 코스를 내 여행 초안으로 가져와.',
      '첫 번째 공개 코스를 내 여행으로 가져오는 방법 알려줘.',
      '서쪽 바다와 차밭 1박 2일 공개 코스를 내 여행으로 복사하지 마.',
      '서쪽 바다와 차밭 1박 2일과 비자림과 동쪽 바다 1박 2일 공개 코스를 내 여행 초안으로 복사해줘.',
      '서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사해줘.',
    ]) assert.throws(() => applyModelReply(request(session, text), { message: '가져왔어요.', actions: [copy] }, source), { code: 'MODEL_ACTION_INVALID' });
  }
  const directInput = { ...input, action: copy };
  assert.equal(currentTrip(applyModelReply(directInput, { message: '가져왔어요.', actions: [copy] }, 'local-action')).communitySourceId, copy.id);
  assert.deepEqual(session, before);
});

test('copying only a public title edits trip metadata without replacing any visits', async () => {
  const session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  const before = structuredClone(session);
  for (const text of [
    '서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사해줘.',
    '공개 코스 서쪽 바다와 차밭 1박 2일의 제목만 내 여행 이름에 복사해줘.',
  ]) {
    const input = request(session, text), action = { type: 'trip-meta', title: '서쪽 바다와 차밭 1박 2일' };
    const reply = await predict(input, { message: '여행 이름만 바꿨어요.', actions: [action] }, empty, (_body, envelope) => {
      assert.equal(envelope.context.task, 'known-trip-editor');
      assert.equal(envelope.userMessage, text);
    });
    const result = applyModelReply(input, reply, 'large-model');
    assert.equal(currentTrip(result).title, action.title);
    assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
    assert.equal(currentTrip(result).region, currentTrip(session).region);
    assert.equal(currentTrip(result).communitySourceId, currentTrip(session).communitySourceId);
    assert.deepEqual(result.library, before.library);
    await assert.rejects(predict(input, { message: '전체 코스를 가져왔어요.', actions: [{ type: 'copy-community', id: 'community-jeju-west-sea' }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  }
  for (const text of ['서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사하지 마.', '서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사해 주지 마.']) {
    for (const action of [{ type: 'trip-meta', title: '서쪽 바다와 차밭 1박 2일' }, { type: 'copy-community', id: 'community-jeju-west-sea' }])
      await assert.rejects(predict(request(session, text), { message: '변경했어요.', actions: [action] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  }
  assert.deepEqual(session, before);
});

test('public copy authority rejects ambiguity, negatives, invisible sources and protected bookings', async () => {
  const session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  const before = structuredClone(session), action = { type: 'copy-community', id: 'community-jeju-west-sea' };
  for (const text of [
    '공개 코스를 내 여행 초안으로 가져와.',
    '첫 번째 공개 코스를 내 여행으로 가져오는 방법 알려줘.',
    '첫 번째 공개 코스를 내 여행으로 가져와 주지 마.',
    '서쪽 바다와 차밭 1박 2일 공개 코스를 내 여행으로 복사하지 마.',
    '서쪽 바다와 차밭 1박 2일과 비자림과 동쪽 바다 1박 2일 공개 코스를 내 여행 초안으로 복사해줘.',
    '공개 코스 community-app-public-busan-coast-day를 내 여행 초안으로 복사해줘.',
  ]) await assert.rejects(predict(request(session, text), { message: '가져왔어요.', actions: [action] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' }, text);
  const protectedSession = structuredClone(session);
  currentTrip(protectedSession).plan[0].locked = true;
  const protectedBefore = structuredClone(protectedSession);
  const input = request(protectedSession, '서쪽 바다와 차밭 1박 2일 코스를 내 여행 초안으로 복사해줘.');
  const reply = await predict(input, { message: '가져왔어요.', actions: [action] });
  assert.throws(() => applyModelReply(input, reply, 'large-model'), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(protectedSession, protectedBefore);
  assert.deepEqual(session, before);
});

test('conditional copy prohibitions deny import while a separate source-edit prohibition preserves import', async () => {
  const session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  const before = structuredClone(session), copy = { type: 'copy-community', id: 'community-jeju-west-sea' };
  for (const text of [
    '서쪽 바다와 차밭 1박 2일 공개 코스를 내 여행으로 복사해 주면 안 돼.',
    '서쪽 바다와 차밭 1박 2일 공개 코스를 내 여행으로 복사해주면 안돼요.',
    '서쪽 바다와 차밭 1박 2일 공개 코스를 내 여행으로 복사해 주면 안 됩니다.',
    '첫 번째 공개 코스를 내 여행으로 복사해 주면 안 돼.',
  ]) {
    const input = request(session, text), reply = { message: '가져왔어요.', actions: [copy] };
    await assert.rejects(predict(input, reply), { code: 'LARGE_MODEL_READONLY_VIOLATION' }, text);
    for (const source of ['flowise', 'ollama', 'large-model'])
      assert.throws(() => applyModelReply(input, reply, source), { code: 'MODEL_ACTION_INVALID' });
  }
  const text = '서쪽 바다와 차밭 1박 2일 코스를 내 여행 초안으로 복사해줘. 공개 원본을 수정해 주면 안 돼.';
  const input = request(session, text), reply = { message: '개인 초안으로 가져왔어요.', actions: [copy] };
  assert.deepEqual((await predict(input, reply)).actions, [copy]);
  for (const source of ['flowise', 'ollama', 'large-model'])
    assert.equal(currentTrip(applyModelReply(input, reply, source)).communitySourceId, copy.id);
  assert.deepEqual(session, before);
});

function publicJejuDraft() {
  let session = appendTrip(savedTrip(), { type: 'community-filter', region: '제주', days: 2 });
  session = appendTrip(session, { type: 'copy-community', id: 'community-jeju-west-sea' });
  return appendTrip(session, { type: 'visit-details', id: currentTrip(session).plan[0].id, note: 'PRIVATE_EXISTING_ADDITION_NOTE', time: '09:20', durationMinutes: 70 });
}

test('the exact named DAY 2 addition bypasses unrelated theme filters and preserves every existing visit', async () => {
  const session = publicJejuDraft(), before = structuredClone(session);
  assert.equal(placeResults(currentTrip(session)).some(item => item.id === 'saebyeol'), false);
  const input = request(session, '새별오름을 DAY 2 일정에 추가해줘. 기존 방문과 식당·숙소는 그대로 유지해줘.');
  const action = { type: 'add-entity', id: 'saebyeol', day: 2 };
  const reply = await predict(input, { message: '기존 방문은 유지하고 새별오름을 DAY 2에 추가했어요.', actions: [action] }, empty, (_body, envelope) => {
    assert.equal(envelope.context.task, 'named-itinerary-addition');
    assert.deepEqual(envelope.context.allowedToolTypes, ['add-entity']);
    assert.equal(envelope.context.candidate.id, 'saebyeol');
    assert.equal(envelope.context.requestedDay, 2);
    assert.equal(envelope.userMessage, input.action.text);
    const json = JSON.stringify(envelope);
    assert.ok(!json.includes('PRIVATE_EXISTING_ADDITION_NOTE'));
    assert.equal(envelope.context.catalog, undefined);
    assert.equal(envelope.context.candidates, undefined);
  });
  for (const source of ['flowise', 'ollama', 'large-model']) {
    const result = applyModelReply(input, reply, source), state = currentTrip(result);
    assert.equal(state.plan.length, currentTrip(session).plan.length + 1);
    assert.ok(state.plan.some(visit => visit.entityId === 'saebyeol' && visit.day === 2));
    for (const visit of currentTrip(session).plan) assert.deepEqual(state.plan.find(after => after.id === visit.id), visit);
    assert.equal(state.communitySourceId, currentTrip(session).communitySourceId);
    assert.equal(state.title, currentTrip(session).title);assert.equal(state.startDate, currentTrip(session).startDate);
    assert.deepEqual(result.library, before.library);
  }
  const wrongActions = [
    { type: 'add-entity', id: 'hyeopjae', day: 2 }, { type: 'add-entity', id: 'saebyeol', day: 1 },
    { type: 'add-entity', id: 'saebyeol' }, { type: 'build' }, { type: 'day-add' },
    { type: 'trip-meta', title: '무관한 변경' }, { type: 'collect-entity', id: 'saebyeol' },
  ];
  for (const wrong of wrongActions) {
    await assert.rejects(predict(input, { message: '범위 밖 작업', actions: [wrong] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
    for (const source of ['flowise', 'ollama', 'large-model'])
      assert.throws(() => applyModelReply(input, { message: '범위 밖 작업', actions: [wrong] }, source), { code: 'MODEL_ACTION_INVALID' });
  }
  for (const actions of [[action, action], [action, { type: 'save' }], [action, { type: 'trip-meta', title: '추가 변경' }]]) {
    await assert.rejects(predict(input, { message: '혼합 작업', actions }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
    assert.throws(() => applyModelReply(input, { message: '혼합 작업', actions }, 'flowise'), { code: 'MODEL_ACTION_INVALID' });
  }
  assert.deepEqual((await predict(input, { message: '대상을 확인할게요.', actions: [] })).actions, []);
  assert.deepEqual(session, before);
});

test('explicit food and stay additions retain business mode and engine duplicate-stay protection', async () => {
  const registered = publicJejuDraft(), before = structuredClone(registered);
  const foodText = '오름 아래 밥상을 DAY 2 일정에 추가해줘. 기존 방문과 식당·숙소는 그대로 유지해줘.';
  const food = { type: 'add-entity', id: 'sb-rice', day: 2 };
  const blockedInput = request(registered, foodText);
  assert.equal(namedItineraryAdditionScope(blockedInput).candidate.eligible, false);
  await assert.rejects(predict(blockedInput, { message: '가상 업체를 추가했어요.', actions: [food] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  assert.throws(() => applyModelReply(blockedInput, { message: '가상 업체를 추가했어요.', actions: [food] }, 'flowise'), { code: 'MODEL_ACTION_INVALID' });
  const blockedReply = await predict(blockedInput, { message: '현재 등록 업체 모드예요. 체험 업체를 사용하려면 직접 선택해 주세요.', actions: [] });
  assert.deepEqual(currentTrip(applyModelReply(blockedInput, blockedReply, 'large-model')).plan, currentTrip(registered).plan);
  assert.deepEqual(registered, before);
  const demo = appendTrip(registered, { type: 'configure', businessMode: 'demo' }), demoBefore = structuredClone(demo);
  const input = request(demo, foodText), scope = namedItineraryAdditionScope(input);
  assert.equal(scope.candidate.id, 'sb-rice');assert.equal(scope.candidate.fictional, true);assert.equal(scope.candidate.eligible, true);
  const reply = await predict(input, { message: '가상 식당을 DAY 2에 추가했어요.', actions: [food] });
  const withFood = applyModelReply(input, reply, 'large-model');
  assert.ok(currentTrip(withFood).plan.some(visit => visit.entityId === 'sb-rice' && visit.day === 2));
  for (const visit of currentTrip(demo).plan) assert.deepEqual(currentTrip(withFood).plan.find(after => after.id === visit.id), visit);
  const stayInput = request(withFood, '차밭 작은집을 DAY 1 일정에 추가해줘. 기존 숙소는 그대로 유지해줘.');
  const stay = { type: 'add-entity', id: 'stay-tea', day: 1 };
  const stayReply = await predict(stayInput, { message: 'DAY 1에는 바다곁 스테이 숙박이 이미 있어 차밭 작은집을 추가하거나 교체하지 않았어요. 기존 숙박을 유지해요.', actions: [] }, empty, (_body, envelope) => {
    assert.equal(envelope.context.existingStay.name, '바다곁 스테이');
    assert.equal(envelope.context.existingStay.day, 1);
    assert.equal(envelope.context.candidate.eligible, false);
    assert.deepEqual(envelope.context.allowedToolTypes, []);
    assert.match(envelope.context.instruction, /이미 배치/);
  });
  const duplicate = applyModelReply(stayInput, stayReply, 'large-model');
  assert.deepEqual(currentTrip(duplicate).plan, currentTrip(withFood).plan);
  await assert.rejects(predict(stayInput, { message: '숙소를 추가합니다.', actions: [stay] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  assert.throws(() => applyModelReply(stayInput, { message: '숙소를 추가합니다.', actions: [stay] }, 'flowise'), { code: 'MODEL_ACTION_INVALID' });
  const directDuplicate = appendTrip(withFood, stay);
  assert.deepEqual(currentTrip(directDuplicate).plan, currentTrip(withFood).plan);
  assert.match(currentTrip(directDuplicate).notice, /이미 숙박/);
  const currentStay = currentTrip(withFood).plan.find(visit => visit.kind === 'stay' && visit.day === 1);
  const withoutStay = appendTrip(withFood, { type: 'remove', id: currentStay.id });
  const validStayInput = request(withoutStay, '차밭 작은집을 DAY 1 일정에 추가해줘.');
  const validReply = await predict(validStayInput, { message: '가상 숙소를 비어 있던 DAY 1 숙박에 추가했어요.', actions: [stay] });
  const result = applyModelReply(validStayInput, validReply, 'large-model');
  assert.equal(currentTrip(result).plan.filter(visit => visit.kind === 'stay' && visit.day === 1).length, 1);
  assert.ok(currentTrip(result).plan.some(visit => visit.entityId === 'stay-tea' && visit.day === 1));
  assert.deepEqual(demo, demoBefore);
});

test('named additions do not waive negative, ambiguous, region, DAY, price or grounding checks', async () => {
  const session = publicJejuDraft(), before = structuredClone(session);
  const action = { type: 'add-entity', id: 'saebyeol', day: 2 };
  for (const text of [
    '새별오름을 DAY 2 일정에 추가하지 마.', '새별오름을 DAY 3 일정에 추가해줘.',
    '새별오름과 한라산을 DAY 2 일정에 추가해줘.', '새별오름과 미등록오름을 DAY 2 일정에 추가해줘.', '새별오름을 DAY 1과 DAY 2 일정에 추가해줘.',
  ]) {
    const input = request(session, text);
    assert.equal(namedItineraryAdditionScope(input), undefined);
    assert.throws(() => applyModelReply(input, { message: '추가했어요.', actions: [action] }, 'flowise'), { code: 'MODEL_ACTION_INVALID' });
  }
  const foreign = request(session, '해운대해수욕장을 DAY 2 일정에 추가해줘.');
  assert.equal(namedItineraryAdditionScope(foreign), undefined);
  assert.throws(() => applyModelReply(foreign, { message: '추가했어요.', actions: [{ type: 'add-entity', id: 'public-busan-haeundae', day: 2 }] }, 'flowise'), { code: 'MODEL_ACTION_INVALID' });
  const demo = appendTrip(appendTrip(session, { type: 'configure', businessMode: 'demo', foodBudget: 1 }), { type: 'stay-budget', value: 1 });
  for (const text of ['오름 아래 밥상을 DAY 2 일정에 추가해줘.', '차밭 작은집을 DAY 1 일정에 추가해줘.'])
    assert.equal(namedItineraryAdditionScope(request(demo, text)).candidate.eligible, false);
  const grounded = structuredClone(session);
  currentTrip(grounded).plan[0].knowledge = { indexVersion: 'idx:existing', evidenceIds: ['ev:existing'], documentIds: ['doc:existing'] };
  assert.throws(() => applyModelReply(request(grounded, '새별오름을 DAY 2 일정에 추가해줘.'), { message: '추가했어요.', actions: [action] }, 'flowise'), { code: 'MODEL_ITINERARY_UNGROUNDED' });
  assert.deepEqual(session, before);
});

test('an explicitly named current landmark becomes the food anchor without mutating the itinerary', async () => {
  const session = appendTrip(publicJejuDraft(), { type: 'add-entity', id: 'saebyeol', day: 2 }), before = structuredClone(session);
  assert.equal(currentTrip(session).anchorId, 'hyeopjae');
  const input = request(session, '새별오름 주변 식당 후보를 보여줘. 지금 만든 일정은 바꾸지 마.');
  const actions = [{ type: 'place', id: 'saebyeol' }, { type: 'show', stage: 'food', kind: '식당' }];
  const reply = await predict(input, { message: '새별오름 주변 등록 식당 봉성식당을 보여드려요. 현재 영업과 가격은 미확인이며 일정은 그대로 유지해요.', actions }, empty, (_body, envelope) => {
    assert.equal(envelope.context.task, 'named-nearby-food-browse');
    assert.deepEqual(envelope.context.nearbyAnchorRequest, { id: 'saebyeol', name: '새별오름', kind: '식당' });
    assert.match(envelope.serverExecutionHints, /id:saebyeol/);
    assert.deepEqual(envelope.context.foodCandidates, [{ id: 'catalog-jeju-bongseong', name: '봉성식당', region: '제주', registered: true, fictional: false, price: null }]);
    for (const key of ['catalog', 'candidates', 'retrieval', 'publicCourses', 'savedTrips']) assert.equal(envelope.context[key], undefined);
    assert.equal(envelope.recentConversation, undefined);
    assert.ok(!JSON.stringify(envelope).includes('부산'));
  });
  for (const source of ['flowise', 'ollama', 'large-model']) {
    const result = applyModelReply(input, reply, source), state = currentTrip(result);
    assert.equal(state.anchorId, 'saebyeol');assert.equal(state.stage, 'food');assert.equal(state.foodKind, '식당');
    assert.deepEqual(foodResults(state).map(item => item.id), ['catalog-jeju-bongseong']);
    assert.deepEqual(state.plan, currentTrip(session).plan);assert.deepEqual(result.library, before.library);
    for (const field of ['region', 'days', 'title', 'startDate', 'communitySourceId', 'booked', 'planStatus', 'businessMode'])
      assert.equal(state[field], currentTrip(session)[field]);
  }
  for (const actions of [
    [],
    [{ type: 'show', stage: 'food', kind: '식당' }],
    [{ type: 'show', stage: 'food', kind: '식당' }, { type: 'place', id: 'saebyeol' }],
    [{ type: 'place', id: 'hyeopjae' }, { type: 'show', stage: 'food', kind: '식당' }],
    [{ type: 'place', id: 'saebyeol' }, { type: 'show', stage: 'food', kind: '카페' }],
    [{ type: 'place', id: 'saebyeol' }, { type: 'show', stage: 'food', kind: '식당' }, { type: 'add-entity', id: 'sb-rice', day: 2 }],
  ]) for (const source of ['flowise', 'ollama', 'large-model'])
    assert.throws(() => applyModelReply(input, { message: '잘못된 기준이나 변경', actions }, source), { code: 'MODEL_ACTION_INVALID' });
  await assert.rejects(predict(input, { message: '무관한 변경', actions: [{ type: 'configure', businessMode: 'demo' }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  assert.deepEqual(session, before);
});

test('a named nearby browse cannot pass an empty-action cross-region answer as success for any provider',async()=>{
 const session=appendTrip(publicJejuDraft(),{type:'add-entity',id:'saebyeol',day:2}),before=structuredClone(session);
 const input=request(session,'새별오름 주변 식당 후보를 보여줘. 지금 만든 일정은 바꾸지 마.');
 const reply=await predict(input,{message:'부산 사거리분식과 남천숯불장어를 추천해요.',actions:[]});
 for(const source of ['flowise','ollama','large-model'])
  assert.throws(()=>applyModelReply(input,reply,source),{code:'MODEL_ACTION_INVALID'});
 assert.deepEqual(session,before);
});

test('nearby browsing exits an existing edit before selecting its explicit landmark', async () => {
  let session = appendTrip(publicJejuDraft(), { type: 'add-entity', id: 'saebyeol', day: 2 });
  const target = currentTrip(session).plan.find(visit => visit.kind === 'place' && visit.entityId !== 'saebyeol');
  session = appendTrip(session, { type: 'edit', id: target.id });
  const before = structuredClone(session), input = request(session, '새별오름 주변 식당 후보를 보여줘. 지금 만든 일정은 바꾸지 마.');
  const unsafe = [{ type: 'place', id: 'saebyeol' }, { type: 'show', stage: 'food', kind: '식당' }];
  for (const source of ['flowise', 'ollama', 'large-model'])
    assert.throws(() => applyModelReply(input, { message: '편집 모드를 남긴 조회', actions: unsafe }, source), { code: 'MODEL_ACTION_INVALID' });
  const actions = [{ type: 'show', stage: 'plan' }, ...unsafe];
  const reply = await predict(input, { message: '편집 대기를 해제하고 새별오름 주변 식당 후보를 열어요.', actions });
  for (const source of ['flowise', 'ollama', 'large-model']) {
    const result = applyModelReply(input, reply, source), state = currentTrip(result);
    assert.equal(state.editingId, null);assert.equal(state.anchorId, 'saebyeol');assert.equal(state.stage, 'food');
    assert.deepEqual(state.plan, currentTrip(session).plan);assert.deepEqual(result.library, before.library);
  }
  assert.deepEqual(session, before);
});

test('removing one named stay uses its visit ID and cannot delete a DAY or another visit', async () => {
  const session = publicJejuDraft(), before = structuredClone(session);
  const input = request(session, 'DAY 1 바다곁 스테이를 일정에서 빼줘. 다른 방문은 그대로 유지해줘.');
  const stay = currentTrip(session).plan.find(visit => visit.kind === 'stay' && visit.day === 1);
  const action = { type: 'remove', id: stay.id };
  const reply = await predict(input, { message: 'DAY 1의 바다곁 스테이 방문만 제거했어요. 다른 방문은 유지했어요.', actions: [action] }, empty, (_body, envelope) => {
    assert.equal(envelope.context.task, 'known-trip-editor');
    assert.deepEqual(envelope.context.allowedToolTypes, ['remove']);
    assert.equal(envelope.context.namedVisitRemoval.targets[0].id, stay.id);
  });
  for (const source of ['flowise', 'ollama', 'large-model']) {
    const result = applyModelReply(input, reply, source), state = currentTrip(result);
    assert.deepEqual(state.plan, currentTrip(session).plan.filter(visit => visit.id !== stay.id));
    assert.equal(state.days, currentTrip(session).days);assert.equal(state.title, currentTrip(session).title);
    assert.equal(state.startDate, currentTrip(session).startDate);assert.equal(state.communitySourceId, currentTrip(session).communitySourceId);
    assert.deepEqual(result.library, before.library);
  }
  const wrongVisit = currentTrip(session).plan.find(visit => visit.id !== stay.id);
  for (const actions of [[{ type: 'day-delete', day: 1 }], [{ type: 'day-copy', day: 1 }], [{ type: 'remove', id: wrongVisit.id }], [action, { type: 'trip-meta', title: '무관한 변경' }]])
    for (const source of ['flowise', 'ollama', 'large-model'])
      assert.throws(() => applyModelReply(input, { message: '범위 밖 제거', actions }, source), { code: 'MODEL_ACTION_INVALID' });
  await assert.rejects(predict(input, { message: '다른 방문 제거', actions: [{ type: 'remove', id: wrongVisit.id }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  const locked = structuredClone(session);currentTrip(locked).plan.find(visit => visit.id === stay.id).locked = true;
  const lockedInput = request(locked, input.action.text);
  const lockedReply = await predict(lockedInput, { message: '예약한 숙소는 제거하지 않고 유지해요.', actions: [] });
  assert.deepEqual(currentTrip(applyModelReply(lockedInput, lockedReply, 'large-model')).plan, currentTrip(locked).plan);
  for (const source of ['flowise', 'ollama', 'large-model'])
    assert.throws(() => applyModelReply(lockedInput, { message: '예약 숙소 제거', actions: [action] }, source), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, before);
});

test('a named stay repeated on another DAY still removes only the explicitly stated DAY', async () => {
  let session = appendTrip(publicJejuDraft(), { type: 'configure', days: 3, businessMode: 'demo' });
  session = appendTrip(session, { type: 'add-entity', id: 'stay-coast', day: 2 });
  const before = structuredClone(session), input = request(session, 'DAY 1 바다곁 스테이를 일정에서 빼줘. 다른 방문은 그대로 유지해줘.');
  const scope = namedVisitRemovalScope(input);
  assert.equal(scope.targets.length, 1);assert.equal(scope.targets[0].day, 1);
  const reply = await predict(input, { message: 'DAY 1의 바다곁 스테이만 제거했어요.', actions: [{ type: 'remove', id: scope.targets[0].id }] });
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).days, 3);
  assert.ok(currentTrip(result).plan.some(visit => visit.kind === 'stay' && visit.day === 2 && visit.entityId === 'stay-coast'));
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan.filter(visit => visit.id !== scope.targets[0].id));
  assert.deepEqual(session, before);
});

test('both explicit journal draft expressions navigate only to a draft destination without mutating saved records',async()=>{
 const session=savedTrip(),before=structuredClone(session);
 for(const text of ['여행기 초안으로 이어서 작성하는 화면을 열어줘. 게시하지 마.','앱에서 여행기 초안 화면을 열어줘. 게시하지 마.']){
  const input=request(session,text),action={type:'open_spotlog',target:'journal',entry:'journal-draft'};
  const reply=await predict(input,{message:'앱에서 여행과 DAY를 선택해 초안을 열 수 있어요.',actions:[action]},empty,inspectFeature(input,'app'));
  const result=applyModelReply(input,reply,'large-model');
  assert.deepEqual(currentTrip(result).spotlogNavigation,{target:'journal',entry:'journal-draft'});
  assert.deepEqual(currentTrip(result).plan,currentTrip(session).plan);assert.deepEqual(result.library,session.library);
  for(const unrelatedAction of [{type:'open_spotlog',target:'account',entry:'account-delete'},{...action,journeyId:session.library[0].id},{type:'build',visits:[{day:1,placeId:'hallasan'}]}]){
   await assert.rejects(predict(input,{message:'허용되지 않은 실행',actions:[unrelatedAction]}),{code:'LARGE_MODEL_READONLY_VIOLATION'});
  }
 }
 assert.deepEqual(session,before);
});
test('a photo feed retains bounded authority when a separate traffic lookup is forbidden',async()=>{
 const session=savedTrip(),before=structuredClone(session);
 const input=request(session,'부산 관광지 사진을 보여줘. 교통은 조회하지 마.');
 const reply=await predict(input,{message:'부산 관광지의 등록 사진을 보여드려요.',actions:[{type:'media',mode:'photos',region:'부산',kind:'LANDMARK'}]},empty,inspectFeature(input,'media'));
 const result=applyModelReply(input,reply,'large-model');
 assert.equal(currentTrip(result).mediaRegion,'부산');assert.equal(currentTrip(result).mediaKind,'LANDMARK');
 assert.deepEqual(currentTrip(result).plan,currentTrip(session).plan);assert.deepEqual(result.library,session.library);assert.deepEqual(session,before);
 await assert.rejects(predict(input,{message:'요청하지 않은 원본 변경',actions:[{type:'trip-meta',title:'변경'}]}),{code:'LARGE_MODEL_READONLY_VIOLATION'});
});

test('explicit journal draft navigation prohibitions are still rejected while a separate preview can open',async()=>{
 const session=savedTrip(),action={type:'open_spotlog',target:'journal',entry:'journal-draft'};
 for(const text of ['여행기 초안 화면은 열지 마.','여행기 초안을 불러오지 마.','여행기 초안 화면은 열지 마. 여행기 미리보기만 열어줘.']){
  const input=request(session,text);
  await assert.rejects(predict(input,{message:'초안을 여는 버튼을 준비했어요.',actions:[action]}),{code:'LARGE_MODEL_READONLY_VIOLATION'});
 }
 const input=request(session,'여행기 초안 화면은 열지 마. 여행기 미리보기만 열어줘.');
 const reply=await predict(input,{message:'미리보기 화면만 여는 버튼을 준비했어요.',actions:[{type:'open_spotlog',target:'journal',entry:'journal-preview'}]});
 assert.equal(reply.actions[0].entry,'journal-preview');
});

test('app destination actions report a prepared button instead of claiming an opened screen for every model source',()=>{
 const session=savedTrip(),before=structuredClone(session);
 const input=request(session,'이 저장 여행의 DAY 2 여행기 초안 화면을 열어줘. 게시하거나 사진을 업로드하지 마.');
 const action={type:'open_spotlog',target:'journal',entry:'journal-draft',day:2};
 const misleading='이 기기의 비공개 여행기를 초안으로 열었어요. 게시나 예약은 하지 않았습니다.';
 for(const source of ['flowise','ollama','large-model']){
  const result=applyModelReply(input,{message:misleading,actions:[action]},source),turn=result.turns.at(-1);
  assert.match(turn.assistantMessage,/버튼/);assert.match(turn.assistantMessage,/열 수 있어요/);assert.match(turn.assistantMessage,/앱 화면에서/);
  assert.ok(!turn.assistantMessage.includes('열었어요'));assert.equal(turn.source,source);
  assert.deepEqual(currentTrip(result).spotlogNavigation,{target:'journal',entry:'journal-draft',day:2});
  assert.deepEqual(currentTrip(result).plan,currentTrip(session).plan);assert.deepEqual(result.library,session.library);
 }
 const ordinary='기기에 저장한 여행을 그대로 유지했어요.';
 const unchanged=applyModelReply(request(session,'현재 기능만 설명해줘.'),{message:ordinary,actions:[]},'flowise');
 assert.equal(unchanged.turns.at(-1).assistantMessage,ordinary);assert.deepEqual(session,before);
});

test('photo requests require explicit region, viewing mode and kind without repairing model actions',async()=>{
 const session=savedTrip(),before=structuredClone(session);
 for(const [text,action] of [
  ['부산 관광지 사진을 보여줘. 교통은 조회하지 마.',{type:'media',mode:'photos',region:'부산',kind:'LANDMARK'}],
  ['제주 등록 사진 피드에서 관광지만 보여줘. 내 부산 여행 일정은 바꾸지 마.',{type:'media',mode:'photos',region:'제주',kind:'LANDMARK'}],
  ['부산 식당 등록 사진을 보여줘.',{type:'media',mode:'photos',region:'부산',kind:'FOOD'}],
  ['부산 카페 등록 사진을 포토모션으로 보여줘.',{type:'media',mode:'motion',region:'부산',kind:'CAFE'}],
  ['부산 상점 사진을 보여줘.',{type:'media',mode:'photos',region:'부산',kind:'SHOP'}],
  ['부산 숙소 사진을 포토모션으로 보여줘.',{type:'media',mode:'motion',region:'부산',kind:'STAY'}],
 ]){
  const input=request(session,text);
  const reply=await predict(input,{message:'등록 사진을 보여드려요.',actions:[action]},empty,inspectFeature(input,'media'));
  assert.deepEqual(reply.actions,[action]);
  for(const invalid of [{...action,kind:'all'},{...action,kind:undefined},{...action,region:undefined},{...action,region:'경주'},{...action,mode:action.mode==='photos'?'motion':'photos'}]){
   await assert.rejects(predict(input,{message:'사진을 보여드려요.',actions:[invalid]}),{code:'LARGE_MODEL_READONLY_VIOLATION'});
  }
  const result=applyModelReply(input,reply,'large-model');
  assert.deepEqual(currentTrip(result).plan,currentTrip(session).plan);assert.deepEqual(result.library,session.library);
 }
 assert.deepEqual(session,before);
});
test('Flowise and every other model reject missing or conflicting explicit media filters atomically',()=>{
 const session=savedTrip(),before=structuredClone(session);
 const input=request(session,'부산 관광지 사진을 보여줘. 교통은 조회하지 마.');
 const correct={type:'media',mode:'photos',region:'부산',kind:'LANDMARK'};
 for(const source of ['flowise','ollama','large-model']){
  for(const action of [{...correct,kind:'all'},{...correct,kind:undefined},{...correct,kind:'FOOD'},{...correct,region:'제주'},{...correct,region:undefined},{...correct,mode:'motion'}]){
   assert.throws(()=>applyModelReply(input,{message:'요청한 사진이에요.',actions:[action]},source),{code:'MODEL_ACTION_INVALID'});
  }
  const result=applyModelReply(input,{message:'부산 관광지 사진이에요.',actions:[correct]},source);
  assert.equal(currentTrip(result).mediaKind,'LANDMARK');assert.equal(currentTrip(result).mediaRegion,'부산');assert.equal(currentTrip(result).mediaMode,'photos');
  assert.deepEqual(currentTrip(result).plan,currentTrip(session).plan);assert.deepEqual(result.library,session.library);
 }
 assert.deepEqual(session,before);
});

test('negative photo or motion view clauses do not become positive media filter requirements',async()=>{
 const {mediaActionMatchesRequest}=await import('../lib/local-feature-intent.ts');
 const session=savedTrip(),before=structuredClone(session);
 for(const [text,mode] of [
  ['부산 카페 사진 보여줘. 포토모션은 보여주지 마.','photos'],
  ['부산 카페 사진 보여줘. 포토모션은 보여주지 말아줘.','photos'],
  ['포토모션은 보여주지 말고 부산 카페 사진 보여줘.','photos'],
  ['부산 카페 사진 보여줘. 제주 숙소 포토모션은 보여주지 마.','photos'],
  ['부산 카페 포토모션 보여줘. 사진 피드는 보여주지 마.','motion'],
 ]){
  const action={type:'media',mode,region:'부산',kind:'CAFE'};
  assert.equal(mediaActionMatchesRequest(action,text),true,text);
  for(const invalid of [{...action,mode:mode==='photos'?'motion':'photos'},{...action,region:'제주'},{...action,kind:'all'}])
   assert.equal(mediaActionMatchesRequest(invalid,text),false,text);
  for(const source of ['flowise','ollama','large-model']){
   const result=applyModelReply(request(session,text),{message:'요청한 보기 방식으로 등록 사진을 보여드려요.',actions:[action]},source);
   assert.equal(currentTrip(result).mediaMode,mode);assert.equal(currentTrip(result).mediaRegion,'부산');assert.equal(currentTrip(result).mediaKind,'CAFE');
   assert.deepEqual(currentTrip(result).plan,currentTrip(session).plan);assert.deepEqual(result.library,session.library);
  }
 }
 assert.deepEqual(session,before);
});
