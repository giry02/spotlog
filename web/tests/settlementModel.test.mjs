import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SETTLEMENT_POT_ID, calculateSettlement, createSettlementLedger, deleteSettlementDeposit,
  deleteSettlementExpense, finalizeSettlement, isSettlementLedger, isSettlementReceipt, reconcileSettlementMembers,
  reopenSettlement, saveSettlementDeposit, saveSettlementExpense, setSettlementSettings, setSettlementTransferPaid,
} from '../src/settlementModel.ts';

const day = '2026-11-25';
const closedAt = day + 'T09:00:00.000Z';
const roster = [
  { id: 'a', name: '하늘' }, { id: 'b', name: '우주' }, { id: 'c', name: '바다' },
];
const expenses = (overrides = {}) => ({
  id: 'dinner', title: '저녁', date: day, amount: 10_001, payerId: 'a', participantIds: ['c', 'b', 'a'], ...overrides,
});
const deposit = (memberId, amount, id = 'deposit-' + memberId) => ({ id, memberId, amount, date: day });
const transfer = ({ fromId, toId, amount, paid }) => [fromId, toId, amount, paid];

test('splits whole won stably, only among selected people, while permitting a separate payer', () => {
  const original = createSettlementLedger(roster);
  const ledger = saveSettlementExpense(original, expenses({ participantIds: ['c', 'b'] }));
  const result = calculateSettlement(ledger);
  assert.equal(original.expenses.length, 0);
  assert.equal(result.spent, 10_001);
  assert.deepEqual(result.participants.map(row => [row.id, row.share, row.outOfPocket, row.net]), [
    ['a', 0, 10_001, 10_001], ['b', 5_001, 0, -5_001], ['c', 5_000, 0, -5_000],
  ]);
  assert.deepEqual(result.transfers.map(transfer), [
    ['b', 'a', 5_001, false], ['c', 'a', 5_000, false],
  ]);
});

test('counts advances, actual spending, budget and refunds independently', () => {
  const initial = setSettlementSettings(createSettlementLedger(roster), { budget: 24_000, depositTarget: 7_000 });
  const funded = saveSettlementDeposit(saveSettlementDeposit(saveSettlementDeposit(initial,
    deposit('a', 3_000, 'first-a')), deposit('a', 4_000, 'second-a')), deposit('b', 7_000));
  const ledger = saveSettlementExpense(funded, expenses({ payerId: SETTLEMENT_POT_ID, amount: 9_000 }));
  const result = calculateSettlement(ledger);
  assert.deepEqual([result.spent, result.depositTotal, result.budgetRemaining, result.potBalance],
    [9_000, 14_000, 15_000, 5_000]);
  assert.deepEqual(result.participants.map(row => [row.id, row.deposit, row.depositRemaining, row.share, row.net]), [
    ['a', 7_000, 0, 3_000, 4_000], ['b', 7_000, 0, 3_000, 4_000], ['c', 0, 7_000, 3_000, -3_000],
  ]);
  assert.deepEqual(result.transfers.map(transfer), [
    ['c', 'a', 3_000, false], [SETTLEMENT_POT_ID, 'a', 1_000, false], [SETTLEMENT_POT_ID, 'b', 4_000, false],
  ]);
  assert.equal(ledger.budget, 24_000);
});

test('records a shortfall as money due to the common fund', () => {
  const ledger = saveSettlementExpense(createSettlementLedger(roster), expenses({
    payerId: SETTLEMENT_POT_ID, amount: 100, participantIds: ['a', 'c'],
  }));
  const view = calculateSettlement(ledger);
  assert.equal(view.potBalance, -100);
  assert.deepEqual(view.transfers.map(transfer), [
    ['a', SETTLEMENT_POT_ID, 50, false], ['c', SETTLEMENT_POT_ID, 50, false],
  ]);
});

test('preserves net balances when confirmed payments are carried into a reopened settlement', () => {
  const ledger = saveSettlementExpense(createSettlementLedger(roster), expenses({ amount: 30_000 }));
  const finalized = finalizeSettlement(ledger, closedAt);
  assert.ok(isSettlementLedger(JSON.parse(JSON.stringify(finalized))));
  assert.throws(() => deleteSettlementExpense(finalized, 'dinner'), /다시 열고/);
  assert.throws(() => setSettlementSettings(finalized, { budget: 5, depositTarget: 0 }), /다시 열고/);
  const recorded = setSettlementTransferPaid(finalized, finalized.final.transfers[0].id, true);
  assert.deepEqual(calculateSettlement(recorded).participants.map(row => row.net), [10_000, 0, -10_000]);
  assert.equal(finalized.final.transfers[0].paid, false);
  const reopened = reopenSettlement(recorded);
  assert.equal(reopened.final, undefined);
  assert.deepEqual(reopened.history[0].transfers.map(transfer), [['b', 'a', 10_000, true]]);
  const adjusted = saveSettlementExpense(reopened, expenses({ amount: 24_000 }));
  assert.deepEqual(calculateSettlement(adjusted).transfers.map(transfer), [
    ['c', 'a', 6_000, false], ['c', 'b', 2_000, false],
  ]);
  const secondFinal = finalizeSettlement(adjusted, day + 'T10:00:00.000Z');
  assert.ok(isSettlementLedger(secondFinal));
  assert.throws(() => setSettlementTransferPaid(secondFinal, finalized.final.transfers[0].id, true), /다시 확인/);
});

test('deposits without expenses can be fully refunded and stay cleared after reopening', () => {
  const ledger = saveSettlementDeposit(createSettlementLedger(roster), deposit('a', 5_000));
  const finalized = finalizeSettlement(ledger, closedAt);
  assert.deepEqual(finalized.final.transfers.map(transfer), [[SETTLEMENT_POT_ID, 'a', 5_000, false]]);
  const recorded = setSettlementTransferPaid(finalized, finalized.final.transfers[0].id, true);
  const reopened = reopenSettlement(recorded);
  assert.equal(calculateSettlement(reopened).potBalance, 0);
  assert.equal(calculateSettlement(reopened).transfers.length, 0);
  assert.ok(isSettlementLedger(reopened));
});

test('keeps former participant history but only includes current members in new entries', () => {
  const original = saveSettlementDeposit(saveSettlementExpense(createSettlementLedger(roster), expenses()), deposit('c', 1_000));
  const changed = reconcileSettlementMembers(original, [{ ...roster[0], name: '새 이름' }, roster[1], { id: 'd', name: '구름' }]);
  assert.deepEqual(changed.members.map(member => [member.id, member.active === false]), [
    ['a', false], ['b', false], ['c', true], ['d', false],
  ]);
  assert.equal(changed.members[0].name, '새 이름');
  assert.ok(calculateSettlement(changed).participants.find(row => row.id === 'c').share > 0);
  assert.throws(() => saveSettlementExpense(changed, expenses({ id: 'other' })), /현재 정산 참여자/);
  assert.throws(() => saveSettlementDeposit(changed, deposit('c', 2_000, 'other')), /현재 정산 참여자/);
  const edited = saveSettlementExpense(changed, expenses({ amount: 10_002 }));
  assert.equal(edited.expenses[0].amount, 10_002);
  assert.equal(saveSettlementDeposit(changed, deposit('c', 2_000)).deposits[0].amount, 2_000);
  assert.equal(deleteSettlementDeposit(changed, 'deposit-c').deposits.length, 0);
  assert.ok(isSettlementLedger(changed));
});

test('rejects malformed amounts, shares, dates, receipts, mismatched final snapshots and foreign accounts', () => {
  const original = createSettlementLedger(roster);
  for (const bad of [
    { amount: -1 }, { amount: 10.5 }, { date: '2026-02-31' }, { participantIds: [] },
    { participantIds: ['a', 'a'] }, { payerId: 'other' }, { receipt: { url: 'data:image/svg+xml;base64,AAAA', name: '문서' } },
  ]) {
    assert.throws(() => saveSettlementExpense(original, expenses(bad)));
  }
  assert.throws(() => saveSettlementDeposit(original, deposit(SETTLEMENT_POT_ID, 20)));
  assert.throws(() => finalizeSettlement(original, closedAt), /기록한 뒤/);
  assert.equal(isSettlementReceipt({ url: 'https://example.org/receipt.jpg', name: '영수증' }), false);
  assert.equal(isSettlementReceipt({ url: 'data:image/jpeg;base64,' + 'A'.repeat(300_001), name: '영수증' }), false);
  const receipt = { url: 'data:image/webp;base64,AAAA', name: '영수증.webp' };
  const valid = finalizeSettlement(saveSettlementExpense(original, expenses({ receipt })), closedAt);
  assert.ok(isSettlementLedger(valid));
  const forged = structuredClone(valid);
  forged.final.transfers[0].amount += 1;
  assert.equal(isSettlementLedger(forged), false);
  forged.final.transfers[0].toId = 'foreign';
  assert.equal(isSettlementLedger(forged), false);
});
