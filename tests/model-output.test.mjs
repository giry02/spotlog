import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { parseProviderReply } = await import('../lib/model-output.ts');

test('a valid message-only envelope becomes a read-only reply without inventing actions', () => {
  assert.deepEqual(parseProviderReply({ message: '일반 질문에 답해요.' }), { message: '일반 질문에 답해요.', actions: [] });
  assert.deepEqual(parseProviderReply({ message: '근거 설명', evidenceIds: ['ref1'] }), { message: '근거 설명', actions: [], evidenceIds: ['ref1'] });
});
test('read-only normalization never repairs invalid actions, wrappers or unsafe message content', () => {
  for (const value of [
    { message: '답변', actions: null }, { message: '답변', actions: 'build' },
    { message: '답변', status: 'success' }, { response: '답변' },
    { message: '<script>run()</script>' }, { message: 'https://attacker.example/' },
    { message: '' }, { message: '답변', evidenceIds: ['ref1', 'ref1'] },
  ]) assert.throws(() => parseProviderReply(value), { code: 'MODEL_OUTPUT_INVALID' });
});
