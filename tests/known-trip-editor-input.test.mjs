import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/lib/') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { buildModelInput, usesKnownTripEditor, usesCollectedBusinessPlanner } = await import('../lib/model-input.ts');
const { applyModelReply, parseModelReply } = await import('../lib/chat-contract.ts');
const { modelSystemPrompt } = await import('../lib/model-system-prompt.ts');
const { isWholeDayCopyOnlyRequest } = await import('../lib/trip-edit-intent.ts');
const request = (session, text) => ({ protocolVersion: 1, requestId: 'known-edit-test', sessionId: 'known-edit-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
function fixture() {
  let session = appendTrip(createTripSession(), { type: 'region', region: '부산' });
  session = appendTrip(session, { type: 'configure', days: 2, meals: false, cafes: false, lodging: false });
  session = appendTrip(session, { type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }, { day: 1, placeId: 'public-busan-dongbaek' }, { day: 2, placeId: 'public-busan-gwangalli' }] });
  return session;
}

test('known metadata and visit edits use exact grammar with current visit IDs and entity names', () => {
  const input = request(fixture(), '여행 이름을 가을 부산 검수로, 출발일을 2026-11-03으로 바꿔줘. DAY 1 해운대해수욕장 방문의 메모는 아침에 우산 챙기기, 방문 시각은 10:30, 체류시간은 90분으로 수정해줘. 나머지 방문과 날짜별 순서는 그대로 유지해줘.');
  const original = structuredClone(input), model = buildModelInput(input);
  assert.equal(usesKnownTripEditor(input), true);
  assert.equal(usesCollectedBusinessPlanner(input), false);
  assert.equal(model.question.context.task, 'known-trip-editor');
  assert.deepEqual(model.question.context.state.plan.map(v => v.id), currentTrip(input.session).plan.map(v => v.id));
  assert.equal(model.question.context.state.plan[0].entityName, '해운대해수욕장');
  for (const key of ['catalog', 'candidates', 'itineraryCandidates', 'retrieval']) assert.equal(model.question.context[key], undefined);
  assert.match(model.messages[0].content, /"type":"trip-meta"/);
  assert.match(model.messages[0].content, /"type":"visit-details"/);
  assert.match(model.messages[0].content, /memo, fields, entityType, targetType, visitId는 금지/);
  assert.match(model.messages[0].content, /id는 entityId가 아닌 plan의 방문 id/);
  assert.deepEqual(input, original);
});

test('the six actual DAY edit prompts select the same editor despite protection clauses or 날짜 wording', () => {
  const session = fixture();
  const texts = [
    '여행 이름을 가을 부산 검수로, 출발일을 2026-11-03으로 바꿔줘. DAY 1 해운대해수욕장 방문의 메모는 아침에 우산 챙기기, 방문 시각은 10:30, 체류시간은 90분으로 수정해줘. 나머지 방문과 날짜별 순서는 그대로 유지해줘.',
    'DAY 1 해운대해수욕장 방문의 메모와 방문 시각과 체류시간을 모두 지워줘. 메모와 시각은 빈 값, 체류시간은 미지정으로 해줘. 여행 이름·출발일과 다른 방문은 그대로 유지해줘.',
    'DAY 1 해운대해수욕장 방문의 메모를 아침에 우산 챙기기로, 방문 시각을 10:30으로, 체류시간을 90분으로 다시 설정해줘. 여행 이름·출발일과 나머지 방문은 그대로 유지해줘.',
    'DAY 1 전체를 마지막에 새 DAY로 복사해줘. 원래 DAY 1과 DAY 2는 그대로 두고 각 방문의 메모·방문 시각·체류시간도 복사해줘. 다른 장소는 추가하지 마.',
    'DAY 1 바로 뒤에 방문이 없는 빈 DAY를 하나 추가해줘. 원래 뒤에 있던 DAY의 방문 ID·메모·시각·체류시간과 순서는 그대로 두고 날짜 번호만 한 칸씩 뒤로 옮겨줘.',
    '방금 추가한 빈 DAY 2만 삭제해줘. 뒤 DAY를 하루씩 당기고 기존 방문·방문 ID·메모·시각·체류시간·여행 이름·출발일은 그대로 유지해줘.',
  ];
  for (const text of texts) {
    const input = request(session, text);
    assert.equal(usesKnownTripEditor(input), true, text);
    assert.equal(buildModelInput(input).question.context.task, 'known-trip-editor', text);
  }
});

test('negation, instructions, new generation and mixed save requests do not open the editor exception', () => {
  const session = fixture();
  for (const text of [
    '메모 수정하지 마.', 'DAY 2 삭제하지 마.', 'DAY 1 복사 안 해줘.', '메모 안 바꿔줘.',
    'DAY 삭제 어떻게 해?', '메모 수정 방법 알려줘.', '출발일 변경 가능한지 설명해줘.',
    '부산 2일 일정을 새로 만들어줘.', '여행 이름을 가을로 바꾸고 저장해줘.',
    'DAY 1을 복사하고 새 식당을 추천해줘.',
    'DAY 1에 새 관광지 해운대해수욕장 방문을 추가해줘.',
    'DAY 1에 새 카페를 추가해줘.',
  ]) assert.equal(usesKnownTripEditor(request(session, text)), false, text);
  assert.equal(usesKnownTripEditor(request(createTripSession(), '메모를 바꿔줘.')), false);
});

test('an exact two-action metadata reply applies without tourism retrieval and leaves other visits intact', () => {
  const session = fixture(), input = request(session, '여행 이름을 가을 부산 검수로, 출발일을 2026-11-03으로 바꿔줘. DAY 1 해운대해수욕장 메모와 시각과 체류시간을 수정해줘.');
  const before = structuredClone(currentTrip(session));
  const reply = parseModelReply({ message: '여행 이름·시작일과 지정한 방문 세부를 바꿨어요.', actions: [
    { type: 'trip-meta', title: '가을 부산 검수', startDate: '2026-11-03' },
    { type: 'visit-details', id: before.plan[0].id, note: '아침에 우산 챙기기', time: '10:30', durationMinutes: 90 },
  ] });
  const state = currentTrip(applyModelReply(input, reply, 'large-model'));
  assert.equal(state.title, '가을 부산 검수');
  assert.equal(state.startDate, '2026-11-03');
  assert.deepEqual(state.plan[0], { ...before.plan[0], note: '아침에 우산 챙기기', time: '10:30', durationMinutes: 90 });
  assert.deepEqual(state.plan.slice(1), before.plan.slice(1));
  assert.equal(state.days, before.days);
});

test('clear fields and DAY copy remain individual exact actions rather than nested edits or a rebuild', () => {
  let session = fixture();
  const firstId = currentTrip(session).plan[0].id;
  session = appendTrip(session, { type: 'visit-details', id: firstId, note: '챙길 물건', time: '10:30', durationMinutes: 90 });
  const clearInput = request(session, 'DAY 1 해운대해수욕장 메모와 시각과 체류시간을 지워줘.');
  session = applyModelReply(clearInput, { message: '지정한 방문 세부를 비웠어요.', actions: [{ type: 'visit-details', id: firstId, note: '', time: '', durationMinutes: 0 }] }, 'large-model');
  const before = structuredClone(currentTrip(session)), copyInput = request(session, 'DAY 1을 마지막에 복사해줘. 다른 장소는 추가하지 마.');
  const copied = currentTrip(applyModelReply(copyInput, { message: 'DAY 1을 마지막에 복사했어요.', actions: [{ type: 'day-copy', day: 1 }] }, 'large-model'));
  assert.deepEqual(copied.plan.filter(v => v.day < 3), before.plan);
  assert.deepEqual(copied.plan.filter(v => v.day === 3).map(v => [v.entityId, v.note, v.time, v.durationMinutes]), before.plan.filter(v => v.day === 1).map(v => [v.entityId, v.note, v.time, v.durationMinutes]));
});

test('known selected stays and visit progress retain their exact IDs and constraints in the editor context', () => {
  let session = fixture();
  session = appendTrip(session, { type: 'stay', id: 'catalog-busan-westin' });
  const first = currentTrip(session).plan[0];
  session = appendTrip(session, { type: 'progress', id: first.id, status: 'done' });
  const input = request(session, '선택한 숙소를 DAY 1 체크인 1박으로 배치해줘.'), model = buildModelInput(input);
  assert.equal(usesKnownTripEditor(input), true);
  assert.equal(model.question.context.task, 'known-trip-editor');
  assert.equal(model.question.context.knownStays[0].id, 'catalog-busan-westin');
  assert.equal(model.question.context.knownStays[0].price, null);
  assert.equal(model.question.context.state.plan[0].status, 'done');
  assert.equal(model.question.context.state.plan[0].locked, false);
  assert.match(model.messages[0].content, /startDay\+nights는 state.days 이내/);
  assert.match(modelSystemPrompt, /context.task가 known-trip-editor/);
});

test('the narrow trip title grammar matches the existing 100-character action limit', () => {
  const model = buildModelInput(request(fixture(), '여행 이름을 가을 부산으로 바꿔줘.'));
  assert.match(model.messages[0].content, /"title"\?:"100자 이내 여행명"/);
  assert.doesNotMatch(model.messages[0].content, /200자 이내 여행명/);
  assert.equal(parseModelReply({ message: '여행 이름을 바꿨어요.', actions: [{ type: 'trip-meta', title: '가'.repeat(100) }] }).actions[0].title.length, 100);
  assert.throws(() => parseModelReply({ message: '여행 이름을 바꿨어요.', actions: [{ type: 'trip-meta', title: '가'.repeat(101) }] }), { code: 'MODEL_OUTPUT_INVALID' });
});

test('whole DAY copy receives only current state and a single allowed action despite earlier clear/reapply turns', () => {
  let session = fixture();
  const id = currentTrip(session).plan[0].id;
  session = appendTrip(session, { type: 'visit-details', id, note: '', time: '', durationMinutes: 0 });
  session = appendTrip(session, { type: 'visit-details', id, note: '현재 메모', time: '10:30', durationMinutes: 90 });
  const text = 'DAY 1 전체를 마지막에 새 DAY로 복사해줘. 원래 DAY 1과 DAY 2는 그대로 두고 각 방문의 메모·방문 시각·체류시간도 복사해줘. 다른 장소는 추가하지 마.';
  const input = request(session, text), model = buildModelInput(input);
  assert.equal(isWholeDayCopyOnlyRequest(input), true);
  assert.equal(model.question.recentConversation, undefined);
  assert.deepEqual(model.question.context.allowedToolTypes, ['day-copy']);
  assert.equal(model.question.context.state.plan[0].note, '현재 메모');
  assert.match(model.messages[0].content, /실행 시 정확히 한 개만 반환/);
  assert.match(model.messages[0].content, /visit-copy\/visit-details\/trip-meta/);
  for (const mixed of [
    'DAY 1을 복사하고 메모를 바꿔줘.', 'DAY 1을 복사하고 DAY 2를 삭제해줘.',
    'DAY 1을 복사하고 DAY 2 뒤에 빈 날을 추가해줘.', 'DAY 1의 방문 하나를 복사해줘.',
    'DAY 1을 복사하고 해운대 방문도 복사해줘.', 'DAY 1 복사하지 마.',
    'DAY 1 복사 방법 알려줘.', 'DAY 1을 복사하고 DAY 2도 복사해줘.',
  ]) assert.equal(isWholeDayCopyOnlyRequest(request(session, mixed)), false, mixed);
});
