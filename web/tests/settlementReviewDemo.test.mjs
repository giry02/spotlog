import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSettlement, saveSettlementExpense, SETTLEMENT_POT_ID } from '../src/settlementModel.ts';
import { buildSettlementReviewDemo, canOpenSettlementReviewDemo } from '../src/settlementReviewDemo.ts';

const scope = { kind: 'ACTIVITY', id: 'family-past', groupId: 'family-busan', accountId: 'spotlog-local-review-member' };
const participants = [{ id: scope.accountId, name: '검수 여행자' }, { id: 'example-parent', name: '엄마' }];
const initial = { ledger: buildSettlementReviewDemo(participants, '2026-11-11'), raw: null, error: '' };

test('the rehearsal is available only for the authorized review scope and two named participants', () => {
  assert.equal(canOpenSettlementReviewDemo(true, scope, participants, true), true);
  assert.equal(canOpenSettlementReviewDemo(false, scope, participants, true), false);
  assert.equal(canOpenSettlementReviewDemo(true, scope, participants, false), false);
  for (const changed of [{ accountId: 'real-member' }, { groupId: 'other-family' }, { id: 'family-next' }, { kind: 'GROUP' }]) {
    assert.equal(canOpenSettlementReviewDemo(true, { ...scope, ...changed }, participants, true), false);
  }
  assert.equal(canOpenSettlementReviewDemo(true, scope, [{ ...participants[0], active: false }, participants[1]], true), false);
  assert.equal(canOpenSettlementReviewDemo(true, scope, [...participants, { id: 'example-sibling', name: '지우' }], true), false);
});

test('the live receipt step produces the amounts printed in the presentation', () => {
  const initialView = calculateSettlement(initial.ledger);
  assert.equal(initial.ledger.expenses.length, 2);
  assert.equal(initialView.spent, 124_000);
  assert.equal(initialView.depositTotal, 140_000);
  assert.equal(initialView.potBalance, 40_000);
  assert.equal(initialView.participants[1].depositRemaining, 20_000);
  const lunch = saveSettlementExpense(initial.ledger, {
    id: 'lunch-test', title: '바닷가 점심 식사', amount: 60_000, date: '2026-11-11', payerId: SETTLEMENT_POT_ID,
    participantIds: participants.map(member => member.id),
  });
  const summary = calculateSettlement(lunch);
  assert.equal(summary.spent, 184_000);
  assert.equal(summary.budgetRemaining, 36_000);
  assert.deepEqual(summary.participants.map(member => member.share), [92_000, 92_000]);
  assert.deepEqual(summary.transfers.map(({ fromId, toId, amount }) => [fromId, toId, amount]), [
    ['example-parent', scope.accountId, 12_000], ['example-parent', SETTLEMENT_POT_ID, 20_000],
  ]);
  const replay = buildSettlementReviewDemo(participants, '2026-11-11');
  assert.notEqual(replay, initial.ledger);
  assert.deepEqual(replay, initial.ledger);
  assert.equal(calculateSettlement(replay).spent, 124_000);
});
