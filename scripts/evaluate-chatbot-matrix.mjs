import './evaluate-chat.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession } = await import('../lib/chat-contract.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { restaurants, stays } = await import('../lib/trip-data.ts');

// Disposable, authored fixtures only. No browser storage, real bookings or chat
// history is read. Fixture evidence is historical, never current build authority.
export function twoDayFixture({ booked = false } = {}) {
  let session = createTripSession();
  for (const action of [
    { type: 'region', region: '제주' },
    { type: 'configure', days: 2, booked, meals: false, cafes: false },
    { type: 'build' },
  ]) session = appendTrip(session, action);
  const visits = [
    { day: 1, placeId: 'hyeopjae' }, { day: 1, placeId: 'osulloc' },
    { day: 2, placeId: 'saryeoni' }, { day: 2, placeId: 'jeolmul' },
  ];
  const retrieval = {
    dataMode: 'curated-travel-data', indexVersion: 'idx:authored-evaluation-fixture',
    embeddingModel: 'authored-evaluation-fixture',
    results: visits.map(({ placeId }) => {
      const source = ragCatalog().find(item => item.placeId === placeId && item.sourceKind === 'curated-official-summary');
      if (!source) throw new Error('FIXTURE_OFFICIAL_SOURCE_MISSING');
      return { ...source, evidenceId: `ev:fixture:${placeId}`, sourceVersion: 'sv:fixture' };
    }),
  };
  session = applyModelReply({ protocolVersion: 1, requestId: 'fixture', sessionId: 'fixture',
    baseRevision: session.turns.at(-1).id, session,
    action: { type: 'message', text: '평가용으로 작성한 제주 이틀 일정입니다.' } }, {
    message: '평가 전용 제주 이틀 일정입니다.', actions: [{ type: 'build', visits }],
  }, 'flowise', retrieval);
  return parseTripSession(session);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noMutation = ({ state, before }) => same(state.plan, before.plan) && state.days === before.days && state.booked === before.booked;
const noEvidence = ({ turn }) => !turn.retrieval?.results.length && !turn.evidenceIds?.length;
const noCards = ({ state }) => state.plan.length === 0;

export const chatbotMatrix = [
  { id: 'greeting', text: '안녕하세요', checks: {
    meaningfulAnswer: ({ body }) => body.message.length > 5,
    noUnexpectedPlan: noCards, retrievalNotNeeded: ({ turn }) => turn.answerContext?.retrievalStatus === 'not-needed',
  } },
  { id: 'general-knowledge', text: 'RAG가 무엇인지 처음 듣는 사람에게 세 문장으로 쉽게 설명해줘.', checks: {
    answersQuestion: ({ body }) => /검색|자료|정보/.test(body.message), noUnexpectedPlan: noCards,
    retrievalNotNeeded: ({ turn }) => turn.answerContext?.retrievalStatus === 'not-needed',
  } },
  { id: 'live-jeju-weather', allowedModes: ['local-action'], text: '오늘 제주 시내 날씨와 기온, 강수확률, 바람을 알려줘.', checks: {
    realWeatherReady: ({ turn }) => turn.answerContext?.weather?.status === 'ready',
    datedWeather: ({ turn }) => Boolean(turn.answerContext?.weather?.retrievedAt) && turn.answerContext.weather.dates?.length > 0,
    answersWeather: ({ body }) => /제주/.test(body.message) && /기온|온도|°C|℃/.test(body.message) && /강수|비/.test(body.message),
    noUnexpectedPlan: noCards, noPretendRag: noEvidence,
  } },
  { id: 'weather-needs-location', allowedModes: ['local-action'], text: '내일 날씨 어때?', checks: {
    asksLocation: ({ turn, body }) => turn.answerContext?.weather?.status === 'asked-location' && /지역|어디/.test(body.message),
    noMadeUpTemperature: ({ body }) => !/\d+(?:\.\d+)?\s*(?:°C|℃)/.test(body.message), noUnexpectedPlan: noCards,
  } },
  { id: 'new-rag-forest-day', text: '제주 당일 일정으로 사려니숲길과 절물자연휴양림만 오전 오후에 넣어줘. 식당 카페 숙소는 빼줘.', plan: { days: 1, expected: ['saryeoni', 'jeolmul'], excludeBusinesses: true } },
  { id: 'broad-jeju-three-day', text: '제주 2박 3일 여행 일정 만들어줘. 바다와 숲을 보고 싶어. 하루 오전 오후 위주로 배치하고 식당 카페 숙소는 빼줘.', plan: { days: 3, excludeBusinesses: true } },
  { id: 'existing-two-day-to-one-day', fixture: () => twoDayFixture(), text: '기존 이틀 일정을 제주 당일 일정으로 다시 만들어줘. 사려니숲길과 절물자연휴양림만 오전 오후에 넣어줘. 식당 카페 숙소는 전부 빼줘.', plan: { days: 1, expected: ['saryeoni', 'jeolmul'], excludeBusinesses: true } },
  { id: 'day-one-view-preserves-duration-and-booking', allowedModes: ['local-action'], fixture: () => twoDayFixture({ booked: true }), text: 'DAY 1 일정만 보여줘. 전체 여행 기간과 다른 날짜 일정, 예약한 숙소는 그대로 유지해.', checks: {
    honestDeterministicView: ({ body, turn }) => body.mode === 'local-action' && turn.source === 'local-action' && !turn.answerContext?.modelRouting,
    noMutation, selectedDay: ({ state }) => state.activeDay === 1 && state.stage === 'plan',
    bookingPreserved: ({ state, before }) => before.plan.some(visit => visit.locked) && before.plan.filter(visit => visit.locked).every(visit => same(state.plan.find(after => after.id === visit.id), visit)),
    noUnplannedBusinessClaims: ({ body, before }) => {
      const answer = body.message.toLowerCase().replace(/\s/g, '');
      return [...restaurants, ...stays].every(business => ![business.name, business.id].some(name => answer.includes(name.toLowerCase().replace(/\s/g, ''))) || before.plan.some(visit => visit.day === 1 && visit.entityId === business.id));
    },
  } },
  { id: 'partial-afternoon-edit-preserves-others-and-booking', fixture: () => twoDayFixture({ booked: true }), text: 'DAY 2 오후 장소만 돌문화공원으로 바꿔줘. DAY 1과 나머지 방문, 예약한 숙소, 전체 여행 기간은 그대로 둬.', checks: {
    requestedReplacement: ({ state, before }) => {
      const target = before.plan.find(visit => visit.day === 2 && visit.kind === 'place' && visit.label.includes('오후'));
      return Boolean(target) && state.plan.find(visit => visit.id === target.id)?.entityId === 'dolculturepark';
    },
    onlyTargetChanged: ({ state, before }) => {
      const target = before.plan.find(visit => visit.day === 2 && visit.kind === 'place' && visit.label.includes('오후'));
      return Boolean(target) && state.days === before.days && state.booked === before.booked && state.plan.length === before.plan.length && before.plan.filter(visit => visit.id !== target.id).every(visit => same(state.plan.find(after => after.id === visit.id), visit));
    },
    freshReplacementEvidence: ({ state, turn }) => {
      const target = state.plan.find(visit => visit.entityId === 'dolculturepark');
      return Boolean(target?.knowledge?.evidenceIds.length) && target.knowledge.indexVersion === turn.retrieval?.indexVersion && turn.retrieval.results.some(source => source.placeId === 'dolculturepark' && target.knowledge.evidenceIds.includes(source.evidenceId));
    },
  } },
  { id: 'missing-rag-hands-to-local-14b', profile: 'ollama', text: '부산 2박 3일 여행의 짐을 가볍게 싸려면 어떻게 해야 해? 검색 자료 없이도 설명할 수 있는 일반적인 준비 원칙 세 가지만 짧게 알려줘. 일정 카드는 만들지 말고 설명만 해줘.', checks: {
    realLargerModel: ({ body, turn }) => body.mode === 'large-model' && turn.answerContext?.modelRouting?.tier === 'large' && turn.answerContext.modelRouting.provider === 'ollama' && /14b/.test(turn.answerContext.modelRouting.model ?? '') && turn.answerContext.modelRouting.status === 'ready',
    insufficiencyHandoff: ({ turn }) => turn.answerContext?.modelRouting?.reason === 'rag-insufficient',
    usefulGeneralAnswer: ({ body }) => /짐|준비|옷|챙|물품/.test(body.message), noFakedEvidence: noEvidence, noUnexpectedPlan: noCards,
  } },
  { id: 'missing-rag-hands-to-configured-gemini', profile: 'gemini', text: '부산 2박 3일 여행의 짐을 가볍게 싸려면 어떻게 해야 해? 검색 자료 없이도 설명할 수 있는 일반적인 준비 원칙 세 가지만 짧게 알려줘. 일정 카드는 만들지 말고 설명만 해줘.', checks: {
    realConfiguredFallback: ({ body, turn }) => body.mode === 'large-model' && turn.answerContext?.modelRouting?.tier === 'large' && turn.answerContext.modelRouting.provider === 'gemini' && turn.answerContext.modelRouting.model === 'gemini-3.6-flash' && turn.answerContext.modelRouting.status === 'ready',
    insufficiencyHandoff: ({ turn }) => turn.answerContext?.modelRouting?.reason === 'rag-insufficient',
    usefulGeneralAnswer: ({ body }) => /짐|준비|옷|챙|물품/.test(body.message), noFakedEvidence: noEvidence, noUnexpectedPlan: noCards,
  } },
];

export function inspectMatrixResponse(item, request, body) {
  const checks = {
    executionMode: ['flowise', 'ollama', 'large-model'].includes(body.mode) || Boolean(item.allowedModes?.includes(body.mode)),
    correlation: body.protocolVersion === 1 && body.requestId === request.requestId && body.sessionId === request.sessionId && body.baseRevision === request.baseRevision,
  };
  const session = parseTripSession(body.session), turn = session.turns.at(-1);
  const state = currentTrip(session), before = currentTrip(request.session);
  checks.revision = body.revision === turn.id && body.revision === request.baseRevision + 1;
  checks.message = typeof body.message === 'string' && body.message.trim().length > 0;
  checks.priorTurnsUnchanged = same(session.turns.slice(0, -1), request.session.turns);
  const context = { body, session, turn, state, before };
  if (item.plan) {
    const visits = state.plan.filter(visit => visit.kind === 'place');
    const expected = item.plan.expected;
    Object.assign(checks, {
      requestedDuration: state.days === item.plan.days,
      replyDurationMatchesCards: [...body.message.matchAll(/([0-2])\s*박\s*([1-3])\s*일/g)].every(([, nights, days]) => Number(days) === state.days && Number(nights) === state.days - 1),
      allDaysCovered: Array.from({ length: item.plan.days }, (_, index) => index + 1).every(day => visits.some(visit => visit.day === day)),
      requestedPlaces: !expected || expected.every(id => visits.some(visit => visit.entityId === id)),
      noUnrequestedPlaces: !expected || visits.every(visit => expected.includes(visit.entityId)),
      excludedBusinesses: !item.plan.excludeBusinesses || (!state.plan.some(visit => visit.kind !== 'place') && state.meals === false && state.cafes === false && state.lodging === false),
      currentRagGrounding: visits.length > 0 && visits.every(visit => visit.knowledge?.indexVersion === turn.retrieval?.indexVersion && visit.knowledge.evidenceIds.length > 0 && visit.knowledge.evidenceIds.every(id => turn.retrieval.results.some(source => source.evidenceId === id && source.placeId === visit.entityId))),
      noFixtureGrounding: !visits.some(visit => visit.knowledge?.indexVersion === 'idx:authored-evaluation-fixture'),
    });
  }
  for (const [name, check] of Object.entries(item.checks ?? {})) checks[name] = Boolean(check(context));
  return { checks, passed: Object.values(checks).every(Boolean), session, turn, state };
}

function localEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error('LOCAL_ENDPOINT_REQUIRED');
  return url;
}

export async function evaluateChatbotMatrix({ endpoint = 'http://localhost:3001/api/chat', profile = 'gemini', cases = chatbotMatrix.filter(item => !item.profile || item.profile === profile), fetcher = fetch, timeoutMs = 235000, onResult = () => {} } = {}) {
  const url = localEndpoint(endpoint);
  const report = { reportVersion: 1, evaluatedAt: new Date().toISOString(), endpoint: url.href, profile,
    fixturePolicy: 'authored disposable sessions; no browser storage or real bookings',
    actualEndpointCalls: fetcher === fetch, modelResponseCount: 0, localResponseCount: 0, plannedCases: cases.map(item => item.id), cases: [] };
  for (const item of cases) {
    const session = item.fixture?.() ?? createTripSession();
    const request = { protocolVersion: 1, requestId: `eval_${crypto.randomUUID()}`, sessionId: `eval_${crypto.randomUUID()}`,
      baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text: item.text } };
    const result = { id: item.id, query: item.text, evaluatedAt: new Date().toISOString(), requestId: request.requestId,
      sessionId: request.sessionId, baseRevision: request.baseRevision, fixture: Boolean(item.fixture), passed: false };
    const started = performance.now();
    try {
      const response = await fetcher(url, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request), signal: AbortSignal.timeout(timeoutMs) });
      result.status = response.status;
      const body = await response.json();
      if (!response.ok) {
        result.outcome = `HTTP_${response.status}`;
        if (/^[A-Z_]{1,64}$/.test(body.error?.code ?? '')) result.errorCode = body.error.code;
      } else {
        const inspection = inspectMatrixResponse(item, request, body);
        Object.assign(result, { passed: inspection.passed, checks: inspection.checks, outcome: inspection.passed ? 'PASS' : 'SEMANTIC_CHECK_FAILED',
          revision: body.revision, mode: body.mode, answerContext: inspection.turn.answerContext,
          indexVersion: inspection.turn.retrieval?.indexVersion, evidenceIds: inspection.turn.evidenceIds ?? [],
          retrievedPlaces: [...new Set(inspection.turn.retrieval?.results.map(source => source.placeId))],
          visits: inspection.state.plan, days: inspection.state.days,
          businessPreferences: { meals: inspection.state.meals, cafes: inspection.state.cafes, lodging: inspection.state.lodging }, responseText: body.message });
      }
    } catch { result.outcome = 'TRANSPORT_OR_CONTRACT_FAILURE'; }
    result.milliseconds = Math.round(performance.now() - started);
    report.cases.push(result);
    report.modelResponseCount = report.cases.filter(item => ['flowise', 'ollama', 'large-model'].includes(item.mode)).length;
    report.localResponseCount = report.cases.filter(item => item.mode === 'local-action').length;
    report.passed = report.cases.length === cases.length && report.cases.every(result => result.passed);
    await onResult(result, report);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--list')) { console.log(JSON.stringify(chatbotMatrix.map(item => ({ id: item.id, query: item.text, fixture: Boolean(item.fixture), profile: item.profile ?? 'all' })), null, 2)); }
  else {
    const selected = args.filter(argument => argument.startsWith('--case=')).map(argument => argument.slice(7));
    if (args.some(argument => !/^(?:--case=|--report=|--endpoint=|--profile=)/.test(argument)) || selected.some(id => !chatbotMatrix.some(item => item.id === id))) throw new Error('UNKNOWN_EVALUATION_ARGUMENT');
    const profile = args.find(argument => argument.startsWith('--profile='))?.slice(10) ?? 'gemini';
    if (!['gemini', 'ollama'].includes(profile)) throw new Error('UNKNOWN_EVALUATION_PROFILE');
    const endpoint = args.find(argument => argument.startsWith('--endpoint='))?.slice(11) ?? 'http://localhost:3001/api/chat';
    const timestamp = new Date().toISOString().replace(/[^0-9T]/g, '');
    const reportPath = resolve(args.find(argument => argument.startsWith('--report='))?.slice(9) ?? `work/handoff/CHATBOT_MATRIX_20261016_${timestamp}.json`);
    await mkdir(dirname(reportPath), { recursive: true });
    const report = await evaluateChatbotMatrix({ endpoint, profile, cases: selected.length ? chatbotMatrix.filter(item => selected.includes(item.id)) : chatbotMatrix.filter(item => !item.profile || item.profile === profile),
      async onResult(result, report) {
        await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify({ id: result.id, passed: result.passed, status: result.status, outcome: result.outcome,
          errorCode: result.errorCode, milliseconds: result.milliseconds, checks: result.checks }));
      },
    });
    console.log(JSON.stringify({ passed: report.passed, reportPath }));
    if (!report.passed) process.exitCode = 1;
  }
}
