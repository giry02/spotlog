import { evaluateChat, scenarios } from './evaluate-chat.mjs';
const cases = [
  ...scenarios,
  {
    id: 'rag-explanation',
    fresh: true,
    text: '서울숲에서 나무 그늘을 걸으며 쉴 수 있는지 검색 자료의 근거도 함께 알려줘',
    check: (_state, _before, turn) =>
      turn.retrieval.results.some((e) => e.placeId === 'seoulforest') &&
      turn.evidenceIds?.some((id) =>
        turn.retrieval.results.some(
          (e) => e.evidenceId === id && e.placeId === 'seoulforest',
        ),
      ),
  },
];
const report = await evaluateChat({
  endpoint: process.env.MOA_EVAL_URL ?? 'http://localhost:3001/api/chat',
  cases,
  expectedMode: 'flowise',
  requireRag: true,
});
console.log(
  JSON.stringify(
    { execution: 'real-flowise-local-llm-and-rag', ...report },
    null,
    2,
  ),
);
process.exitCode = report.passed ? 0 : 1;
