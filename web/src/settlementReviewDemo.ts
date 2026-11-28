import {
  createSettlementLedger,
  saveSettlementDeposit,
  saveSettlementExpense,
  SETTLEMENT_POT_ID,
  setSettlementSettings,
  type SettlementLedger,
  type SettlementMember,
} from './settlementModel.ts';
import type { SettlementScope } from './settlementStorage.ts';

const demoAccountId = 'spotlog-local-review-member';
const demoParentId = 'example-parent';

export function canOpenSettlementReviewDemo(reviewSession: boolean, scope: SettlementScope,
  roster: readonly SettlementMember[], canEdit: boolean): boolean {
  return reviewSession && canEdit
    && scope.kind === 'ACTIVITY' && scope.accountId === demoAccountId && scope.groupId === 'family-busan' && scope.id === 'family-past'
    && roster.length === 2 && roster.every(member => member.active !== false)
    && roster.some(member => member.id === demoAccountId) && roster.some(member => member.id === demoParentId);
}

export function buildSettlementReviewDemo(roster: readonly SettlementMember[], date: string): SettlementLedger {
  const members = [demoAccountId, demoParentId].map(id => {
    const member = roster.find(value => value.id === id);
    if (!member || member.active === false) throw new Error('시연용 일정의 참석자를 확인해 주세요.');
    return member;
  });
  const ledger = setSettlementSettings(createSettlementLedger(members), { budget: 220_000, depositTarget: 80_000 });
  const deposits = [
    { id: 'review-demo-deposit-self', memberId: demoAccountId, amount: 80_000, date },
    { id: 'review-demo-deposit-parent', memberId: demoParentId, amount: 60_000, date },
  ];
  const participantIds = members.map(member => member.id);
  const expenses = [
    { id: 'review-demo-stay', title: '바닷가 숙박비', amount: 100_000, date, payerId: SETTLEMENT_POT_ID, participantIds },
    { id: 'review-demo-transport', title: '역까지 이동한 교통비', amount: 24_000, date, payerId: demoAccountId, participantIds },
  ];
  return expenses.reduce(saveSettlementExpense, deposits.reduce(saveSettlementDeposit, ledger));
}
