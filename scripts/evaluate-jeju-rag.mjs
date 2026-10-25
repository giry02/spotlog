// Read-only evaluation against the actual local RAG HTTP service and Moa app.
// This sends only authored test questions in new, disposable chat sessions.
// API keys remain in memory; reports never include keys or session snapshots.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import './evaluate-chat.mjs';
import { authoredDemoDocuments } from './rag/catalog.mjs';
import { readConfig } from './rag/cli.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function guaranteesTransport(message) {
  return message.split(/[.!?。\n]/).some((sentence) =>
    /(오늘|현재).{0,20}(무조건|반드시|보장|확실히).{0,15}(탈 수|가능|운항)/.test(sentence) &&
    !/(보장|단정|확신).{0,12}(없|않|못|안)|(?:탈 수|가능|운항).{0,16}(없|않|못|아니)|불가능/.test(sentence),
  );
}
function mislabelsReservationSegment(message) {
  return message.split(/[.!?。\n]/).some((sentence) =>
    /(?:성판악|관음사).{0,24}(?:진달래밭|삼각봉).{0,12}(?:에서\s*시작|출발점|시작점)/.test(sentence) &&
    !/예약.{0,8}구간|(?:시작|출발점|시작점).{0,12}(?:아니|않|없)/.test(sentence),
  );
}
function misusesBusServiceForFerries(message) {
  return message.split(/[.!?。\n]/).some((sentence) =>
    /(?:출항|운항|배편|승선).{0,35}(?:확인|조회).{0,35}(?:제주)?버스정보시스템|실시간\s*확인.{0,20}(?:제주)?버스정보시스템/.test(sentence) &&
    !/버스\s*(?:위치|노선|정류소|전용|만)|배편.{0,15}(?:아니|확인할 수 없)/.test(sentence),
  );
}
export const retrievalScenarios = [
  { id: 'west-beach-comparison', query: '제주 협재해수욕장과 금능해수욕장의 차이, 비양도와 모래 해변 특징을 비교해줘', expectedAll: ['hyeopjae', 'geumneung'] },
  { id: 'bijarim-forest', query: '제주 비자림의 비자나무 숲길과 천천히 걷기 좋은 탐방로 특징', expectedAll: ['bijarim'] },
  { id: 'songaksan-access', query: '제주 송악산 정상부 자연휴식년 출입통제와 해안 둘레길 방문시 주의할 점', expectedAll: ['songaksan'] },
  { id: 'east-coast-stairs', query: '성산일출봉 정상 등반 계단과 섭지코지 해안 산책의 차이', expectedAll: ['seongsan', 'seopjikoji'] },
  { id: 'waterfall-comparison', query: '제주 정방폭포와 천지연폭포 차이, 바다로 떨어지는 폭포와 산책로 계단', expectedAll: ['jeongbang', 'cheonjiyeon'] },
  { id: 'jusangjeolli-geology', query: '제주 중문 대포 주상절리대 돌기둥이 생긴 이유와 해안 지형 특징', expectedAll: ['jusangjeolli'] },
  { id: 'hallasan-course', query: '제주 한라산 백록담 정상에 가는 성판악 관음사 코스, 어리목 영실과 탐방예약 확인', expectedAll: ['hallasan'] },
  { id: 'udo-transport', query: '제주 우도 배편과 차량 반입 제한, 당일 기상에 따른 운항 여부를 어디서 확인해?', expectedAll: ['udo'] },
  { id: 'rain-indoor', query: '비오는 제주에서 아이와 갈 실내 전시 장소, 아쿠아플라넷과 국립제주박물관', expectedAny: ['aquaplanet', 'jejumuseum'] },
  { id: 'west-east-route', query: '제주 동부 성산과 서부 협재를 하루에 오가기보다 권역을 나눠 여행하는 동선 계획', expectedAny: ['jeju-general'] },
  { id: 'family-stairs', query: '제주 아이 동반 유모차로 계단이 많은 정방폭포와 성산일출봉을 갈 때 주의사항', expectedAny: ['jeongbang', 'seongsan'] },
  { id: 'saryeoni-forest', query: '제주 사려니숲길의 삼나무 숲과 숲길 탐방 구간 선택', expectedAll: ['saryeoni'] },
  { id: 'gotjawal-forest', query: '제주 곶자왈도립공원 용암 지형 숲의 생태와 탐방길', expectedAll: ['gotjawal'] },
  { id: 'manjanggul-closure', query: '제주 만장굴 용암동굴 관람과 휴관, 재개방 운영 여부 확인', expectedAll: ['manjanggul'] },
  { id: 'yongmeori-weather', query: '제주 용머리해안 파도와 만조에 따른 출입 통제, 당일 개방 여부 확인', expectedAll: ['yongmeori'] },
  { id: 'geomunoreum-reservation', query: '제주 거문오름 탐방은 사전 예약과 해설사 동행이 필요한가?', expectedAll: ['geomunoreum'] },
];

// These are narrow acceptance checks for authored sample questions, not a claim
// that every Korean answer or all future operational facts are correct.
export const chatScenarios = [
  {
    id: 'beach-comparison',
    query: '제주 협재해수욕장과 금능해수욕장은 어떤 차이가 있어? 비양도와 해변 특징을 검색 자료를 근거로 비교해줘. 일정은 만들지 말고 설명만 해줘.',
    citeAll: ['hyeopjae', 'geumneung'],
    assertions: [
      ['mentions-hyeopjae', (message) => /협재/.test(message)],
      ['mentions-geumneung', (message) => /금능/.test(message)],
      ['explains-beach-features', (message) => /(비양도|백사장|모래|해변|수심)/.test(message)],
    ],
  },
  {
    id: 'waterfall-comparison',
    query: '제주 정방폭포와 천지연폭포는 어떻게 달라? 바다로 떨어지는 곳과 걷는 길, 계단을 검색 자료 근거로 비교해줘. 일정은 만들지 말고 설명만 해줘.',
    citeAll: ['jeongbang', 'cheonjiyeon'],
    assertions: [
      ['mentions-both-waterfalls', (message) => /정방/.test(message) && /천지연/.test(message)],
      ['explains-coast', (message) => /(바다|해안)/.test(message)],
      ['explains-walking-access', (message) => /(계단|산책|보행|탐방로)/.test(message)],
    ],
  },
  {
    id: 'songaksan-access',
    query: '제주 송악산은 지금 정상까지 올라가도 돼? 정상부와 해안 둘레길을 구분해서 검색 자료 근거로 알려줘. 일정은 만들지 말고 설명만 해줘.',
    citeAll: ['songaksan'],
    assertions: [
      ['mentions-access-restriction', (message) => /(통제|제한|휴식년|금지)/.test(message)],
      ['distinguishes-coastal-walk', (message) => /(해안|둘레길|둘레 길|탐방로)/.test(message)],
      ['no-unfounded-summit-permission', (message) => !/정상.{0,12}(출입|등산|진입|탐방|방문).{0,10}(가능해요|가능합니다|허용해요|허용됩니다)/.test(message)],
    ],
  },
  {
    id: 'hallasan-course',
    query: '제주 한라산 백록담 정상은 영실이나 어리목으로 갈 수 있어? 성판악과 관음사 코스, 예약 확인까지 검색 자료로 설명해줘. 일정은 만들지 말고 설명만 해줘.',
    citeAll: ['hallasan'],
    assertions: [
      ['mentions-summit-courses', (message) => /성판악/.test(message) && /관음사/.test(message)],
      ['mentions-other-courses', (message) => /영실|어리목/.test(message)],
      ['mentions-required-current-check', (message) => /예약|통제|확인/.test(message)],
      ['no-direct-yeongsil-summit-claim', (message) => !/(영실|어리목).{0,12}(백록담|정상).{0,8}(갈 수 있어요|갈 수 있습니다|도달할 수 있어요)/.test(message)],
      ['no-reservation-segment-as-trailhead', (message) => !mislabelsReservationSegment(message)],
    ],
  },
  {
    id: 'rain-indoor',
    query: '비가 오는 제주에서 아이와 갈 실내 장소로 아쿠아플라넷과 국립제주박물관을 비교해줘. 검색 자료 근거를 설명해줘. 일정은 만들지 말고 설명만 해줘.',
    citeAll: ['aquaplanet', 'jejumuseum'],
    assertions: [
      ['mentions-both-venues', (message) => /아쿠아플라넷/.test(message) && /제주박물관|국립제주박물관/.test(message)],
      ['explains-indoor-use', (message) => /실내|전시|수조|수족관/.test(message)],
      ['keeps-added-knowledge-out-of-plan', (_message, turn) => turn.state.plan.length === 0],
    ],
  },
  {
    id: 'udo-transport',
    query: '제주 우도 배는 오늘 무조건 탈 수 있어? 렌터카 반입과 배편을 검색 자료로 설명하고 실시간으로 확인해야 하는 것도 알려줘. 일정은 만들지 말고 설명만 해줘.',
    citeAll: ['udo'],
    assertions: [
      ['mentions-ferry', (message) => /배편|선박|도항선|여객선|배 |승선|운항/.test(message)],
      ['mentions-vehicle-limits', (message) => /차량|렌터카|렌트카|자동차/.test(message) && /제한|반입|허용|조건/.test(message)],
      ['requires-current-weather-check', (message) => /기상|날씨|파도|풍랑|바다\s*(?:상황|상태)|해상\s*(?:상태|상황)/.test(message) && /확인|변동|취소|통제/.test(message)],
      ['no-transport-guarantee', (message) => !guaranteesTransport(message)],
      ['no-ferry-status-from-bus-service', (message) => !misusesBusServiceForFerries(message)],
    ],
  },
];

function localUrl(value, label) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error(`${label}_LOCAL_URL_REQUIRED`);
  return url;
}

function officialSourceUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && (
      url.hostname === 'visitjeju.net' || url.hostname.endsWith('.visitjeju.net') ||
      url.hostname === 'jeju.go.kr' || url.hostname.endsWith('.jeju.go.kr') ||
      url.hostname === 'museum.go.kr' || url.hostname.endsWith('.museum.go.kr') ||
      url.hostname === 'aquaplanet.co.kr' || url.hostname.endsWith('.aquaplanet.co.kr') ||
      url.hostname === 'jejuwnh.jeju.go.kr' ||
      url.hostname === 'hallimpark.com' || url.hostname.endsWith('.hallimpark.com') ||
      url.hostname === 'yeomiji.or.kr' || url.hostname.endsWith('.yeomiji.or.kr') ||
      url.hostname === 'ecolandjeju.co.kr' || url.hostname.endsWith('.ecolandjeju.co.kr')
    );
  } catch { return false; }
}

function summarizeEvidence(item) {
  return {
    evidenceId: item.evidenceId,
    placeId: item.placeId,
    documentId: item.documentId,
    sourceKind: item.sourceKind,
    ...(item.title ? { title: item.title } : {}),
    ...(item.sourceTitle ? { sourceTitle: item.sourceTitle } : {}),
    ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    ...(item.checkedAt ? { checkedAt: item.checkedAt } : {}),
  };
}

export function assertChatScenario(scenario, message, turn) {
  const retrieval = turn?.retrieval;
  const evidence = retrieval?.results ?? [];
  const citations = turn?.evidenceIds ?? [];
  const cited = evidence.filter((item) => citations.includes(item.evidenceId));
  const checks = [
    { id: 'has-retrieved-evidence', passed: evidence.length > 0 },
    { id: 'has-real-evidence-citations', passed: citations.length > 0 && citations.every((id) => evidence.some((item) => item.evidenceId === id)) },
    { id: 'no-inline-model-references', passed: !/\bref[1-5]\b|evidenceIds/i.test(message) },
    { id: 'expected-places-cited', passed: scenario.citeAll.every((id) => cited.some((item) => item.placeId === id)) },
    // The live catalog deliberately mixes official summaries and authored demo
    // descriptions. Additional authored citations are valid, but every requested
    // comparison target still needs its own cited official summary.
    { id: 'cited-official-source', passed: scenario.citeAll.every((id) => cited.some((item) => item.placeId === id && item.sourceKind === 'curated-official-summary' && officialSourceUrl(item.sourceUrl))) },
    { id: 'cited-source-provenance', passed: cited.length > 0 && cited.every((item) => item.sourceKind === 'authored-demo-data' ? !item.sourceUrl : item.sourceKind === 'curated-official-summary' && officialSourceUrl(item.sourceUrl)) },
    ...scenario.assertions.map(([id, check]) => ({ id, passed: Boolean(check(message, turn)) })),
  ];
  return { passed: checks.every((item) => item.passed), checks, retrieved: evidence.map(summarizeEvidence), cited: cited.map(summarizeEvidence) };
}

async function postJson(url, input, apiKey, timeoutMs) {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json();
  if (!response.ok) {
    const code = typeof body.error === 'string' ? body.error : body.error?.code;
    return { status: response.status, errorCode: /^[A-Za-z0-9_-]{1,80}$/.test(code ?? '') ? code : 'HTTP_ERROR' };
  }
  return { status: response.status, body };
}

async function evaluateRetrieval({ ragBaseUrl, apiKey, allowedPlaceIds }) {
  const results = [];
  for (const scenario of retrievalScenarios) {
    const started = performance.now();
    let result = { id: scenario.id, query: scenario.query, passed: false };
    try {
      const response = await postJson(new URL('/internal/rag/search', ragBaseUrl), { query: scenario.query, allowedPlaceIds, topK: 5 }, apiKey, 30_000);
      if (!response.body) result = { ...result, status: response.status, errorCode: response.errorCode };
      else {
        const evidence = response.body.results ?? [];
        const returnedIds = evidence.map((item) => item.placeId);
        const validation = await postJson(new URL('/internal/rag/validate', ragBaseUrl), { indexVersion: response.body.indexVersion, allowedPlaceIds, results: evidence }, apiKey, 15_000);
        const checks = [
          { id: 'expected-recall', passed: (scenario.expectedAll ?? []).every((id) => returnedIds.includes(id)) && (!scenario.expectedAny || scenario.expectedAny.some((id) => returnedIds.includes(id))) },
          { id: 'candidate-isolation', passed: returnedIds.every((id) => allowedPlaceIds.includes(id)) },
          { id: 'source-evidence-valid', passed: validation.status === 200 && validation.body?.valid === true },
          { id: 'retrieved-official-source', passed: evidence.some((item) => officialSourceUrl(item.sourceUrl)) },
        ];
        result = { ...result, status: response.status, passed: checks.every((item) => item.passed), checks, indexVersion: response.body.indexVersion, retrieved: evidence.map(summarizeEvidence) };
      }
    } catch { result.errorCode = 'TRANSPORT_OR_FORMAT_FAILURE'; }
    results.push({ ...result, latencyMs: Math.round(performance.now() - started) });
  }
  return { plannedCases: retrievalScenarios.length, passed: results.every((item) => item.passed), results };
}

async function evaluateChat({ chatUrl, cases = chatScenarios }) {
  const { createTripSession } = await import('../lib/trip-engine.ts');
  const { parseTripSession } = await import('../lib/chat-contract.ts');
  const results = [];
  for (const scenario of cases) {
    const session = createTripSession();
    const input = { protocolVersion: 1, requestId: `jeju_eval_${crypto.randomUUID()}`, sessionId: `jeju_eval_${crypto.randomUUID()}`, baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text: scenario.query } };
    const started = performance.now();
    let result = { id: scenario.id, query: scenario.query, evaluatedAt: new Date().toISOString(), passed: false };
    try {
      const response = await postJson(chatUrl, input, null, 55_000);
      if (!response.body) result = { ...result, status: response.status, errorCode: response.errorCode };
      else {
        const body = response.body;
        const next = parseTripSession(body.session);
        const turn = next.turns.at(-1);
        const message = turn.assistantMessage ?? body.message ?? '';
        const analysis = assertChatScenario(scenario, message, turn);
        const correlation = body.protocolVersion === 1 && body.requestId === input.requestId && body.sessionId === input.sessionId && body.baseRevision === input.baseRevision && body.revision === turn.id && turn.id > input.baseRevision;
        const checks = [{ id: 'actual-flowise-provider', passed: body.mode === 'flowise' }, { id: 'correlation-and-revision', passed: correlation }, ...analysis.checks];
        result = { ...result, status: response.status, mode: body.mode, passed: checks.every((item) => item.passed), checks, responseText: message.slice(0, 4000), indexVersion: turn.retrieval?.indexVersion, retrieved: analysis.retrieved, cited: analysis.cited };
      }
    } catch { result.errorCode = 'TRANSPORT_OR_CONTRACT_FAILURE'; }
    const measured = { ...result, latencyMs: Math.round(performance.now() - started) };
    results.push(measured);
    console.error(JSON.stringify({ stage: 'chat-case-complete', id: measured.id, passed: measured.passed, status: measured.status, latencyMs: measured.latencyMs, ...(measured.errorCode ? { errorCode: measured.errorCode } : {}) }));
  }
  return { plannedCases: cases.length, passed: results.every((item) => item.passed), results };
}

function assertRetainedChat(previous, selectedId, indexVersion) {
  const expected = chatScenarios.map((item) => item.id);
  if (!previous || previous.plannedCases !== expected.length || !Array.isArray(previous.results) || previous.results.length !== expected.length || new Set(previous.results.map((item) => item.id)).size !== expected.length || previous.results.some((item) => !expected.includes(item.id))) throw new Error('CASE_PREVIOUS_REPORT_REQUIRED');
  if (previous.results.some((item) => item.id !== selectedId && item.indexVersion !== indexVersion)) throw new Error('CASE_PREVIOUS_INDEX_MISMATCH');
}

export function mergeChatEvaluation(previous, executed, { indexVersion, previousRunPath }) {
  if (!Array.isArray(executed.results) || executed.results.length !== 1 || !chatScenarios.some((item) => item.id === executed.results[0].id)) throw new Error('CASE_SINGLE_RESULT_REQUIRED');
  const selected = executed.results[0];
  assertRetainedChat(previous, selected.id, indexVersion);
  if (selected.indexVersion && selected.indexVersion !== indexVersion) throw new Error('CASE_EXECUTED_INDEX_MISMATCH');
  const retained = previous.results.filter((item) => item.id !== selected.id);
  const results = chatScenarios.map((scenario) => scenario.id === selected.id ? selected : retained.find((item) => item.id === scenario.id));
  const caseEvaluatedAt = Object.fromEntries(results.map((item) => [item.id, item.evaluatedAt ?? previous.caseEvaluatedAt?.[item.id] ?? previous.evaluatedAt]));
  return {
    plannedCases: chatScenarios.length,
    passed: results.every((item) => item.passed),
    results,
    caseEvaluatedAt,
    caseTimestampSources: Object.fromEntries(results.map((item) => [item.id, item.evaluatedAt ? 'individual-case-start' : previous.caseTimestampSources?.[item.id] ?? 'original-stage-start'])) ,
    executedCaseIds: [selected.id],
    retainedFromRun: previousRunPath,
    retainedCaseHashes: Object.fromEntries(retained.map((item) => [item.id, createHash('sha256').update(JSON.stringify(item)).digest('hex')])),
  };
}

export async function main(args = process.argv.slice(2)) {
  const flags = new Set(args);
  const caseFlags = args.filter((item) => item.startsWith('--case='));
  const caseId = caseFlags[0]?.slice('--case='.length);
  if ([...flags].some((item) => !['--dry-run', '--retrieval-only', '--chat-only'].includes(item) && !item.startsWith('--case=')) || (flags.has('--retrieval-only') && flags.has('--chat-only')) || caseFlags.length > 1 || (caseId && !chatScenarios.some((item) => item.id === caseId))) throw new Error('INVALID_ARGUMENTS');
  if (caseId && !flags.has('--chat-only')) throw new Error('CASE_REQUIRES_CHAT_ONLY');
  const selectedCases = caseId ? chatScenarios.filter((item) => item.id === caseId) : chatScenarios;
  if (flags.has('--dry-run')) {
    console.log(JSON.stringify({ dryRun: true, retrievalCases: retrievalScenarios.map(({ id, query, expectedAll, expectedAny }) => ({ id, query, expectedAll, expectedAny })), chatCases: selectedCases.map(({ id, query, citeAll, assertions }) => ({ id, query, citeAll, checks: assertions.map(([name]) => name) })) }, null, 2));
    return;
  }
  const config = await readConfig();
  const ragBaseUrl = localUrl(process.env.MOA_EVAL_RAG_URL ?? `http://127.0.0.1:${config.port}`, 'RAG');
  const chatUrl = localUrl(process.env.MOA_EVAL_URL ?? 'http://localhost:3001/api/chat', 'CHAT');
  const outputPath = resolve(projectRoot, 'work/handoff/JEJU_RAG_EVAL_20261015.json');
  const docs = await authoredDemoDocuments(projectRoot);
  const allowedPlaceIds = [...new Set(docs.map((document) => document.placeId))];
  let previous = {};
  if (flags.has('--retrieval-only') || flags.has('--chat-only')) {
    try { previous = JSON.parse(await readFile(outputPath, 'utf8')); } catch { /* First stage is allowed. */ }
  }
  let health = null;
  try { health = await (await fetch(new URL('/health', ragBaseUrl), { signal: AbortSignal.timeout(5000) })).json(); } catch { /* Individual cases record transport failures. */ }
  if (caseId) {
    if (!health?.indexVersion || previous.metadata?.indexVersion !== health.indexVersion || previous.retrieval?.results?.some((item) => item.indexVersion !== health.indexVersion)) throw new Error('CASE_PREVIOUS_INDEX_MISMATCH');
    assertRetainedChat(previous.chat, caseId, health.indexVersion);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runHistoryPath = resolve(projectRoot, '.sites-runtime/ai/rag/evaluations', `jeju-${stamp}.json`);
  const report = { ...previous, evaluatedAt: new Date().toISOString(), stage: caseId ? 'chat-case' : flags.has('--retrieval-only') ? 'retrieval' : flags.has('--chat-only') ? 'chat' : 'both', execution: 'actual-local-http-rag-and-native-flowise', catalogDocuments: docs.length, allowedPlaces: allowedPlaceIds.length, metadata: health, runHistoryPath };
  if (!flags.has('--chat-only')) report.retrieval = { evaluatedAt: new Date().toISOString(), ...(await evaluateRetrieval({ ragBaseUrl, apiKey: config.apiKey, allowedPlaceIds })) };
  if (!flags.has('--retrieval-only')) {
    const evaluatedAt = new Date().toISOString();
    const executed = await evaluateChat({ chatUrl, cases: selectedCases });
    if (caseId) {
      const rawPath = runHistoryPath.replace(/\.json$/, '-raw-case.json');
      await mkdir(dirname(rawPath), { recursive: true });
      await writeFile(rawPath, JSON.stringify({ evaluatedAt, metadata: health, selectedCase: caseId, chat: executed }, null, 2) + '\n', { flag: 'wx' });
      report.rawExecutedChatReport = rawPath;
      report.chat = { evaluatedAt, ...mergeChatEvaluation(previous.chat, executed, { indexVersion: health.indexVersion, previousRunPath: previous.runHistoryPath }) };
    } else report.chat = { evaluatedAt, ...executed };
  }
  const usedIndexes = [...(report.retrieval?.results ?? []), ...(report.chat?.results ?? [])].map((item) => item.indexVersion).filter(Boolean);
  report.sameIndexForAllCases = usedIndexes.length > 0 && new Set(usedIndexes).size === 1 && usedIndexes.every((index) => index === health?.indexVersion);
  report.passed = report.retrieval?.passed === true && report.chat?.passed === true && report.sameIndexForAllCases;
  report.limitations = ['Acceptance checks cover authored sample questions only; no general Korean accuracy claim.', 'Current operating hours, reservations, ferry status and weather are not live data.', 'Additional knowledge places are explanatory sources; this evaluation does not add itinerary cards.'];
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(runHistoryPath), { recursive: true });
  await writeFile(runHistoryPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  const executedPassed = flags.has('--retrieval-only') ? report.retrieval.passed : flags.has('--chat-only') ? report.chat.passed : report.passed;
  console.log(JSON.stringify({ outputPath, passed: executedPassed, overallPassed: report.passed, retrieval: report.retrieval?.results.map(({ id, passed, latencyMs, errorCode }) => ({ id, passed, latencyMs, errorCode })), chat: report.chat?.results.map(({ id, passed, latencyMs, errorCode, checks }) => ({ id, passed, latencyMs, errorCode, failedChecks: checks?.filter((item) => !item.passed).map((item) => item.id) })) }, null, 2));
  if (!executedPassed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(/^CASE_[A-Z_]+$/.test(error.message ?? '') ? error.message : 'JEJU_EVALUATION_SETUP_FAILED'); process.exitCode = 1; });
}
