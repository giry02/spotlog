import './evaluate-chat.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const { createTripSession } = await import('../lib/trip-engine.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');
const endpoint = 'http://localhost:3001/api/chat';
const args = process.argv.slice(2);
const cases = [
  { id: 'new-rag-forest-itinerary', text: '제주 당일 일정으로 사려니숲길과 절물자연휴양림만 오전 오후에 넣어줘. 식당 카페 숙소는 빼줘.', days: 1, expected: ['saryeoni', 'jeolmul'] },
  { id: 'rag-three-days-with-full-day-destinations', text: '제주 2박 3일 관광지 일정 만들어줘. 1일차 한라산, 2일차 우도, 3일차 사려니숲길과 절물자연휴양림을 넣어줘. 식당 카페 숙소는 빼줘. 개방과 예약 확인이 필요한 초안으로 만들어줘.', days: 3, expected: ['hallasan', 'udo', 'saryeoni', 'jeolmul'], fullDays: ['hallasan','udo'] },
  { id: 'broad-jeju-three-day', text: '제주 2박 3일 여행 일정 만들어줘. 바다와 숲을 보고 싶어. 하루 오전 오후 위주로 배치하고 식당 카페 숙소는 빼줘.', days: 3 },
  { id: 'missing-rag-goes-to-local-14b', text: '부산 2박 3일 여행의 짐을 가볍게 싸려면 어떻게 해야 해? 검색 자료 없이도 설명할 수 있는 일반적인 준비 원칙 세 가지만 짧게 알려줘. 일정 카드는 만들지 말고 설명만 해줘.', large: true },
];
let previous = {};
try { previous = JSON.parse(await readFile('work/handoff/RAG_DRIVEN_ITINERARY_EVAL_20261015.json', 'utf8')); } catch {}
if (args.some(id => !cases.some(c => c.id === id))) throw new Error("UNKNOWN_EVALUATION_CASE");
const selected = args.length ? cases.filter(c => args.includes(c.id)) : cases;
const report = { ...previous, evaluatedAt: new Date().toISOString(), execution: 'actual-local-moa-flowise-rag-and-ollama-14b', cases: previous.cases ?? [] };
for (const item of selected) {
  const request = { protocolVersion: 1, requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(), baseRevision: 1, session: createTripSession(), action: { type: 'message', text: item.text } };
  const started = performance.now();
  let result = { id: item.id, query: item.text, evaluatedAt: new Date().toISOString(), passed: false };
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(235000) });
    const body = await response.json();
    result.status = response.status;
    if (!response.ok) result.errorCode = body.error?.code;
    else {
      const session = parseTripSession(body.session);
      const turn = session.turns.at(-1);
      const visits = turn.state.plan.filter(v => v.kind === 'place');
      const retrievedIds = new Set(turn.retrieval?.results.map(r => r.placeId));
      const checks = { correlation: body.requestId === request.requestId && body.sessionId === request.sessionId && body.revision === 2,
        actualModel: ['flowise','ollama','large-model'].includes(body.mode),
      };
      if (item.large) Object.assign(checks, { largeTier: body.mode === 'large-model' && turn.answerContext?.modelRouting?.tier === 'large' && turn.answerContext?.modelRouting?.provider === 'ollama' && /14b/.test(turn.answerContext?.modelRouting?.model ?? ''), reason: turn.answerContext.modelRouting.reason === 'rag-insufficient', noFakedEvidence: !turn.retrieval?.results.length && !turn.evidenceIds?.length, noUnexpectedMutation: !turn.state.plan.length, answer: /짐|준비|옷|챙|물품/.test(body.message) });
      else Object.assign(checks, { days: turn.state.days === item.days, requestedPlaces: (item.expected ?? []).every(id => visits.some(v => v.entityId === id)), noRandomFill: !item.expected || visits.every(v => item.expected.includes(v.entityId)), freshRag: visits.length > 0 && visits.every(v => retrievedIds.has(v.entityId)), allDaysCovered: Array.from({length:item.days},(_,i)=>i+1).every(day=>visits.some(v=>v.day===day)), sourceOnEveryVisit: visits.every(v => v.knowledge?.indexVersion === turn.retrieval?.indexVersion && v.knowledge.evidenceIds.length > 0), fullDayIsolated: (item.fullDays ?? []).every(id => { const v = visits.find(v => v.entityId === id); return v && visits.filter(other => other.day === v.day).length === 1; }), noFakeBusinesses: !turn.state.plan.some(v => v.kind !== 'place' && v.entityId !== null) });
      Object.assign(result, { passed: Object.values(checks).every(Boolean), checks, mode: body.mode, answerContext: turn.answerContext, indexVersion: turn.retrieval?.indexVersion, retrievedPlaces: [...retrievedIds], visits, responseText: body.message });
    }
  } catch { result.errorCode = 'TRANSPORT_OR_CONTRACT_FAILURE'; }
  result.milliseconds = Math.round(performance.now() - started);
  report.cases = [...report.cases.filter(c => c.id !== result.id), result];
  report.passed = report.cases.length === cases.length && report.cases.every(c => c.passed);
  await writeFile('work/handoff/RAG_DRIVEN_ITINERARY_EVAL_20261015.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ id: result.id, passed: result.passed, status: result.status, errorCode: result.errorCode, milliseconds: result.milliseconds, checks: result.checks }));
}
if (selected.some(item => !report.cases.find(c => c.id === item.id)?.passed)) process.exitCode = 1;
