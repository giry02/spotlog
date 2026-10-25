import test from 'node:test';
import assert from 'node:assert/strict';
import { chatScenarios, assertChatScenario, mergeChatEvaluation } from '../scripts/evaluate-jeju-rag.mjs';

function fixture(placeIds) {
  const results = placeIds.map((placeId, index) => ({ evidenceId: `ev:jeju-${index}`, placeId, documentId: `jeju-${placeId}-visit`, sourceKind: 'curated-official-summary', sourceUrl: 'https://www.visitjeju.net/kr/detail/view?contentsid=sample' }));
  return { state: { plan: [] }, retrieval: { results }, evidenceIds: results.map((item) => item.evidenceId) };
}

test('Jeju evaluator rejects plausible answers with missing comparison citations', () => {
  const scenario = chatScenarios.find((item) => item.id === 'beach-comparison');
  const message = '협재와 금능은 비양도가 보이는 모래 해변입니다.';
  assert.equal(assertChatScenario(scenario, message, fixture(['hyeopjae', 'geumneung'])).passed, true);
  const checked = assertChatScenario(scenario, message, fixture(['hyeopjae']));
  assert.equal(checked.passed, false);
  assert.equal(checked.checks.find((item) => item.id === 'expected-places-cited').passed, false);
});

test('Jeju evaluator rejects an invented citation even when correct sources are present', () => {
  const scenario = chatScenarios.find((item) => item.id === 'beach-comparison');
  const turn = fixture(['hyeopjae', 'geumneung']);
  turn.evidenceIds.push('ev:invented');
  const checked = assertChatScenario(scenario, '협재와 금능은 비양도가 보이는 모래 해변입니다.', turn);
  assert.equal(checked.checks.find((item) => item.id === 'has-real-evidence-citations').passed, false);
});

test('Jeju evaluator flags model-only evidence identifiers leaking into displayed prose', () => {
  const scenario = chatScenarios.find((item) => item.id === 'beach-comparison');
  const checked = assertChatScenario(scenario, '협재와 금능은 비양도가 보이는 해변입니다. (참고: ref1, ref2)', fixture(['hyeopjae', 'geumneung']));
  assert.equal(checked.checks.find((item) => item.id === 'no-inline-model-references').passed, false);
});

test('Jeju evaluator rejects lookalike official source domains', () => {
  const scenario = chatScenarios.find((item) => item.id === 'beach-comparison');
  const turn = fixture(['hyeopjae', 'geumneung']);
  turn.retrieval.results[0].sourceUrl = 'https://www.visitjeju.net.example.com/official';
  const checked = assertChatScenario(scenario, '협재와 금능은 비양도가 보이는 모래 해변입니다.', turn);
  assert.equal(checked.checks.find((item) => item.id === 'cited-official-source').passed, false);
});

test('Jeju evaluator permits authored additions while requiring official coverage for every compared place', () => {
  const scenario = chatScenarios.find((item) => item.id === 'beach-comparison');
  const message = '협재와 금능은 비양도가 보이는 모래 해변입니다.';
  const turn = fixture(['hyeopjae', 'geumneung']);
  const authored = { evidenceId: 'ev:authored', placeId: 'hyeopjae', documentId: 'moa-place:hyeopjae', sourceKind: 'authored-demo-data' };
  turn.retrieval.results.push(authored);
  turn.evidenceIds.push(authored.evidenceId);
  assert.equal(assertChatScenario(scenario, message, turn).passed, true);
  turn.retrieval.results[1] = { ...turn.retrieval.results[1], documentId: 'moa-place:geumneung', sourceKind: 'authored-demo-data', sourceUrl: undefined };
  const checked = assertChatScenario(scenario, message, turn);
  assert.equal(checked.checks.find((item) => item.id === 'cited-official-source').passed, false);
});

test('Jeju evaluator catches a contradictory Songaksan summit permission', () => {
  const scenario = chatScenarios.find((item) => item.id === 'songaksan-access');
  const turn = fixture(['songaksan']);
  assert.equal(assertChatScenario(scenario, '정상부는 자연휴식년 출입통제 구간입니다. 해안 둘레길과 구분해야 합니다.', turn).passed, true);
  const checked = assertChatScenario(scenario, '출입 제한은 확인하세요. 정상부 탐방은 가능해요. 해안 둘레길도 있습니다.', turn);
  assert.equal(checked.checks.find((item) => item.id === 'no-unfounded-summit-permission').passed, false);
});

test('Jeju evaluator catches a ferry guarantee despite an unrelated weather warning', () => {
  const scenario = chatScenarios.find((item) => item.id === 'udo-transport');
  const turn = fixture(['udo']);
  const checked = assertChatScenario(scenario, '우도 배편은 기상을 확인하세요. 차량 반입 제한이 있습니다. 오늘 무조건 탈 수 있어요.', turn);
  assert.equal(checked.checks.find((item) => item.id === 'no-transport-guarantee').passed, false);
  const denial = assertChatScenario(scenario, '오늘 무조건 탈 수 있다고 단정할 수 없어요. 배편은 기상에 따라 취소되니 확인하세요. 렌터카 반입 제한도 확인하세요.', turn);
  assert.equal(denial.checks.find((item) => item.id === 'no-transport-guarantee').passed, true);
  const naturalDenial = assertChatScenario(scenario, '오늘 무조건 탈 수 있는 것은 아니고 바다 상황에 따라 배편은 변동될 수 있으므로 확인하세요. 차량 반입 제한이 있습니다.', turn);
  assert.equal(naturalDenial.checks.find((item) => item.id === 'no-transport-guarantee').passed, true);
  assert.equal(naturalDenial.checks.find((item) => item.id === 'requires-current-weather-check').passed, true);
});

test('Jeju evaluator distinguishes reservation-managed sections from trail starting points', () => {
  const scenario = chatScenarios.find((item) => item.id === 'hallasan-course');
  const turn = fixture(['hallasan']);
  const wrong = assertChatScenario(scenario, '성판악 코스는 진달래밭에서 시작하고 관음사는 삼각봉에서 시작합니다. 영실과 어리목은 예약을 확인하세요.', turn);
  assert.equal(wrong.checks.find((item) => item.id === 'no-reservation-segment-as-trailhead').passed, false);
  const correct = assertChatScenario(scenario, '성판악 예약 대상 구간은 진달래밭에서 시작합니다. 관음사 예약 관리 구간은 삼각봉에서 시작합니다. 어리목과 영실은 백록담 정상 코스가 아니므로 예약과 통제를 확인하세요.', turn);
  assert.equal(correct.checks.find((item) => item.id === 'no-reservation-segment-as-trailhead').passed, true);
  const directDenial = assertChatScenario(scenario, '성판악 코스는 진달래밭에서 시작하는 것이 아니에요. 관음사도 삼각봉이 시작점은 아니에요. 영실과 어리목은 백록담으로 갈 수 없어 예약 정보를 구분해야 합니다.', turn);
  assert.equal(directDenial.checks.find((item) => item.id === 'no-reservation-segment-as-trailhead').passed, true);
});

test('Jeju evaluator catches ferry operating checks incorrectly attributed to bus information', () => {
  const scenario = chatScenarios.find((item) => item.id === 'udo-transport');
  const turn = fixture(['udo']);
  const wrong = assertChatScenario(scenario, '우도 배편과 차량 반입은 기상에 따라 변동됩니다. 실시간 확인은 제주버스정보시스템이나 운영사 안내를 통해 가능합니다.', turn);
  assert.equal(wrong.checks.find((item) => item.id === 'no-ferry-status-from-bus-service').passed, false);
  const correct = assertChatScenario(scenario, '우도 배편은 운영사에서 확인하고 본섬 버스 노선은 제주버스정보시스템에서 확인합니다. 차량 반입은 기상에 따라 변동될 수 있어요.', turn);
  assert.equal(correct.checks.find((item) => item.id === 'no-ferry-status-from-bus-service').passed, true);
});

test('Jeju evaluator checks explanatory additions do not create itinerary cards', () => {
  const scenario = chatScenarios.find((item) => item.id === 'rain-indoor');
  const turn = fixture(['aquaplanet', 'jejumuseum']);
  turn.state.plan.push({ entityId: 'aquaplanet' });
  const checked = assertChatScenario(scenario, '아쿠아플라넷과 국립제주박물관은 실내 전시를 볼 수 있어요.', turn);
  assert.equal(checked.checks.find((item) => item.id === 'keeps-added-knowledge-out-of-plan').passed, false);
});

test('case-only evaluation preserves all retained result bytes and per-case provenance', () => {
  const previous = { plannedCases: 6, evaluatedAt: '2026-10-15T02:00:00Z', results: chatScenarios.map((item) => ({ id: item.id, indexVersion: 'idx:same', passed: item.id !== 'rain-indoor', responseText: `${item.id} original answer` })) };
  const before = JSON.stringify(previous);
  const selected = { id: 'rain-indoor', indexVersion: 'idx:same', passed: true, evaluatedAt: '2026-10-15T02:30:00Z', responseText: '새로운 확인 답변' };
  const merged = mergeChatEvaluation(previous, { results: [selected] }, { indexVersion: 'idx:same', previousRunPath: 'prior-immutable.json' });
  assert.equal(merged.plannedCases, 6);
  assert.equal(merged.passed, true);
  assert.equal(JSON.stringify(previous), before);
  for (const item of previous.results.filter((item) => item.id !== selected.id)) {
    assert.equal(JSON.stringify(merged.results.find((candidate) => candidate.id === item.id)), JSON.stringify(item));
    assert.equal(merged.retainedCaseHashes[item.id].length, 64);
    assert.equal(merged.caseEvaluatedAt[item.id], previous.evaluatedAt);
    assert.equal(merged.caseTimestampSources[item.id], 'original-stage-start');
  }
  assert.equal(merged.caseEvaluatedAt[selected.id], selected.evaluatedAt);
  assert.deepEqual(merged.executedCaseIds, ['rain-indoor']);
});

test('case-only evaluation refuses results retained from another source index', () => {
  const previous = { plannedCases: 6, results: chatScenarios.map((item) => ({ id: item.id, indexVersion: 'idx:old', passed: true })) };
  const selected = { id: 'rain-indoor', indexVersion: 'idx:new', passed: true };
  assert.throws(() => mergeChatEvaluation(previous, { results: [selected] }, { indexVersion: 'idx:new' }), /CASE_PREVIOUS_INDEX_MISMATCH/);
  previous.results.forEach((item) => { item.indexVersion = 'idx:new'; });
  selected.indexVersion = 'idx:other';
  assert.throws(() => mergeChatEvaluation(previous, { results: [selected] }, { indexVersion: 'idx:new' }), /CASE_EXECUTED_INDEX_MISMATCH/);
});
