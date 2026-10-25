import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import './evaluate-chat.mjs';
const { createTripSession } = await import('../lib/trip-engine.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');

const cases = [
  { id: 'greeting', text: '안녕하세요', status: 'not-needed', check: (b) => b.message.length > 5 },
  { id: 'general-knowledge', text: 'RAG가 무엇인지 처음 듣는 사람에게 쉽게 설명해줘.', status: 'not-needed', check: (b) => /검색|자료|정보/.test(b.message) },
  { id: 'live-jeju-weather', text: '오늘 제주 시내 날씨와 기온, 강수확률, 바람을 알려줘.', weather: 'ready', check: (b) => /제주/.test(b.message) && /기온|온도|°C|℃/.test(b.message) && /강수|비/.test(b.message) },
  { id: 'weather-missing-location', text: '내일 날씨 어때?', weather: 'asked-location', check: (b) => /지역|어디|제주|서울/.test(b.message) && !/\d+(?:\.\d+)?\s*(?:°C|℃)/.test(b.message) },
  { id: 'weather-unsupported-location', text: '부산 내일 날씨와 기온을 알려줘.', weather: 'unsupported-location', check: (b) => /부산|지원|확인/.test(b.message) && !/\d+(?:\.\d+)?\s*(?:°C|℃)/.test(b.message) },
  { id: 'weather-unsupported-date', text: '제주 한 달 뒤 날씨 예보 알려줘.', weather: 'unsupported-date', check: (b) => /7일|일주일|범위|예보|확인/.test(b.message) && !/\d+(?:\.\d+)?\s*(?:°C|℃)/.test(b.message) },
];
const endpoint = process.env.MOA_EVAL_URL || 'http://localhost:3001/api/chat';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname)) throw new Error('Local endpoint required');
const report = { evaluatedAt: new Date().toISOString(), provider: 'native-flowise-local-qwen3-8b', actualModelCalls: true, cases: [] };
for (const item of cases) {
  const request = { protocolVersion: 1, requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(), baseRevision: 1, session: createTripSession(), action: { type: 'message', text: item.text } };
  const started = performance.now();
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(55000) });
    const body = await response.json();
    const turn = body.session?.turns.at(-1);
    const passed = response.ok && body.mode === 'flowise' && body.requestId === request.requestId && body.sessionId === request.sessionId && body.baseRevision === 1 && body.revision === 2 && parseTripSession(body.session) && !turn.retrieval && turn.state.plan.length === 0 &&
      (item.weather ? turn.answerContext?.weather?.status === item.weather : turn.answerContext?.retrievalStatus === item.status) && item.check(body);
    report.cases.push({ id: item.id, query: item.text, status: response.status, passed: Boolean(passed), milliseconds: Math.round(performance.now() - started), answerContext: turn?.answerContext, responseText: body.message ?? null, errorCode: body.error?.code ?? null });
  } catch { report.cases.push({ id: item.id, passed: false, milliseconds: Math.round(performance.now() - started), outcome: 'transport-failure' }); }
  console.log(JSON.stringify({ id: item.id, passed: report.cases.at(-1).passed, milliseconds: report.cases.at(-1).milliseconds }));
}
report.passed = report.cases.every((item) => item.passed);
await mkdir('work/handoff', { recursive: true });
const path = resolve('work/handoff/CHAT_ROUTING_EVAL_20261015.json');
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, path }));
if (!report.passed) process.exitCode = 1;
