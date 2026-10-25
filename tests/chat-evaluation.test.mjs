import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChat } from '../scripts/evaluate-chat.mjs';

test('live evaluator fails closed on demo and stops dependent model calls', async () => {
  let calls = 0;
  const report = await evaluateChat({
    endpoint: 'http://127.0.0.1:3000/api/chat',
    cases: [
      { id: 'first', text: '제주', check: () => true },
      { id: 'second', text: '카페', check: () => true },
    ],
    fetcher: async () => {
      calls++;
      return Response.json({ mode: 'demo' });
    },
  });
  assert.equal(report.passed, false);
  assert.equal(calls, 1);
  assert.equal(report.results[0].outcome, 'REAL_MODEL_NOT_CONNECTED');
});

test('live evaluator refuses remote endpoints before transmitting a session', async () => {
  await assert.rejects(
    evaluateChat({
      endpoint: 'https://remote.example/api/chat',
      fetcher: () => {
        throw new Error('must not call');
      },
    }),
    /LOCAL_ENDPOINT_REQUIRED/,
  );
});

test('live evaluator rejects response from another request without accepting its session', async () => {
  const report = await evaluateChat({
    endpoint: 'http://localhost:3000/api/chat',
    fetcher: async () => Response.json({ mode: 'flowise', requestId: 'other' }),
  });
  assert.equal(report.results[0].outcome, 'CORRELATION_INVALID');
});

test('live evaluator carries validated context forward and omits raw model/error content', async () => {
  let previous;
  const report = await evaluateChat({
    endpoint: 'http://localhost:3000/api/chat',
    cases: [
      { id: 'first', text: '제주', check: () => true },
      { id: 'second', text: '카페', check: () => true },
    ],
    fetcher: async (_url, init) => {
      const input = JSON.parse(init.body);
      if (previous) {
        assert.equal(input.sessionId, previous.sessionId);
        assert.equal(input.baseRevision, previous.revision);
        return Response.json(
          { error: 'secret-upstream-content' },
          { status: 504 },
        );
      }
      const session = structuredClone(input.session);
      session.turns.push({
        id: session.nextId++,
        state: structuredClone(session.turns.at(-1).state),
      });
      previous = {
        ...input,
        revision: session.turns.at(-1).id,
        session,
        mode: 'flowise',
      };
      return Response.json(previous);
    },
  });
  assert.equal(report.results[0].outcome, 'PASS');
  assert.equal(report.results[1].outcome, 'HTTP_504');
  assert.equal(report.passed, false);
  assert.ok(!JSON.stringify(report).includes('secret-upstream-content'));
});
