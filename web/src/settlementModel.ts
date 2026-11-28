export const SETTLEMENT_POT_ID = '__settlement_pot__';
export const MAX_SETTLEMENT_RECEIPT_LENGTH = 300_000;

export interface SettlementMember {
  id: string;
  name: string;
  active?: boolean;
}

export interface SettlementReceipt {
  url: string;
  name: string;
}

export interface SettlementExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  payerId: string;
  participantIds: string[];
  receipt?: SettlementReceipt;
}

export interface SettlementDeposit {
  id: string;
  memberId: string;
  amount: number;
  date: string;
}

export interface SettlementTransfer {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  paid: boolean;
}

export interface SettlementBatch {
  closedAt: string;
  transfers: SettlementTransfer[];
}

export interface SettlementLedger {
  schemaVersion: 1;
  members: SettlementMember[];
  budget: number;
  depositTarget: number;
  expenses: SettlementExpense[];
  deposits: SettlementDeposit[];
  final?: SettlementBatch;
  history: SettlementBatch[];
}

export interface SettlementParticipant extends SettlementMember {
  outOfPocket: number;
  deposit: number;
  share: number;
  net: number;
  depositRemaining: number;
}

export interface SettlementView {
  spent: number;
  depositTotal: number;
  potBalance: number;
  budgetRemaining: number;
  participants: SettlementParticipant[];
  transfers: SettlementTransfer[];
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown, limit: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit;
const validId = (value: unknown): value is string => nonempty(value, 180) && !/[\x00-\x1f\x7f]/.test(value);
const amount = (value: unknown, allowZero = false): value is number =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1);
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

export function isSettlementReceipt(value: unknown): value is SettlementReceipt {
  return record(value) && nonempty(value.name, 120)
    && typeof value.url === 'string' && value.url.length <= MAX_SETTLEMENT_RECEIPT_LENGTH && value.url === value.url.trim()
    && /^data:image\/(?:jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value.url);
}

function isMember(value: unknown): value is SettlementMember {
  return record(value) && validId(value.id) && value.id !== SETTLEMENT_POT_ID && nonempty(value.name, 100)
    && (value.active === undefined || typeof value.active === 'boolean');
}

function cloneMembers(members: readonly SettlementMember[]): SettlementMember[] {
  if (!members.every(isMember) || new Set(members.map(item => item.id)).size !== members.length) {
    throw new Error('정산 참여자 정보를 확인해 주세요.');
  }
  return members.map(member => ({ ...member, name: member.name.trim() }));
}

export function createSettlementLedger(members: readonly SettlementMember[] = []): SettlementLedger {
  return { schemaVersion: 1, members: cloneMembers(members), budget: 0, depositTarget: 0, expenses: [], deposits: [], history: [] };
}

export function reconcileSettlementMembers(ledger: SettlementLedger, roster: readonly SettlementMember[]): SettlementLedger {
  const current = new Map(cloneMembers(roster).map(member => [member.id, member]));
  const members = ledger.members.map(previous => {
    const next = current.get(previous.id);
    current.delete(previous.id);
    return next ?? { ...previous, active: false };
  });
  return { ...ledger, members: cloneMembers([...members, ...current.values()]) };
}

function assertOpen(ledger: SettlementLedger): void {
  if (ledger.final) throw new Error('확정된 정산을 다시 열고 수정해 주세요.');
}

export function setSettlementSettings(ledger: SettlementLedger, settings: { budget: number; depositTarget: number }): SettlementLedger {
  assertOpen(ledger);
  if (!amount(settings.budget, true) || !amount(settings.depositTarget, true)) {
    throw new Error('예산과 선납금은 0원 이상 원 단위로 입력해 주세요.');
  }
  return { ...ledger, budget: settings.budget, depositTarget: settings.depositTarget };
}

function validExpense(value: unknown, memberIds: ReadonlySet<string>): value is SettlementExpense {
  return record(value) && validId(value.id) && nonempty(value.title, 120) && amount(value.amount) && validDate(value.date)
    && (value.payerId === SETTLEMENT_POT_ID || typeof value.payerId === 'string' && memberIds.has(value.payerId))
    && Array.isArray(value.participantIds) && value.participantIds.length > 0 && value.participantIds.length <= memberIds.size
    && new Set(value.participantIds).size === value.participantIds.length
    && value.participantIds.every(id => typeof id === 'string' && memberIds.has(id))
    && (value.receipt === undefined || isSettlementReceipt(value.receipt));
}

function validDeposit(value: unknown, memberIds: ReadonlySet<string>): value is SettlementDeposit {
  return record(value) && validId(value.id) && typeof value.memberId === 'string' && memberIds.has(value.memberId)
    && amount(value.amount) && validDate(value.date);
}

function upsertRecord<T extends { id: string }>(items: readonly T[], item: T): T[] {
  if (items.some(value => value.id === item.id)) return items.map(value => value.id === item.id ? item : value);
  return [...items, item];
}

export function saveSettlementExpense(ledger: SettlementLedger, expense: SettlementExpense): SettlementLedger {
  assertOpen(ledger);
  if (!validExpense(expense, new Set(ledger.members.map(member => member.id)))) {
    throw new Error('지출 이름, 날짜, 금액과 나눌 사람을 확인해 주세요.');
  }
  const previous = ledger.expenses.find(item => item.id === expense.id);
  const active = new Set(ledger.members.filter(member => member.active !== false).map(member => member.id));
  if (expense.payerId !== SETTLEMENT_POT_ID && !active.has(expense.payerId) && expense.payerId !== previous?.payerId
    || expense.participantIds.some(id => !active.has(id) && !previous?.participantIds.includes(id))) {
    throw new Error('현재 정산 참여자만 새 지출에 포함할 수 있어요.');
  }
  const next = {
    ...expense, title: expense.title.trim(), participantIds: [...expense.participantIds],
    ...(expense.receipt ? { receipt: { ...expense.receipt } } : {}),
  };
  return { ...ledger, expenses: upsertRecord(ledger.expenses, next) };
}

export function deleteSettlementExpense(ledger: SettlementLedger, id: string): SettlementLedger {
  assertOpen(ledger);
  return { ...ledger, expenses: ledger.expenses.filter(expense => expense.id !== id) };
}

export function saveSettlementDeposit(ledger: SettlementLedger, deposit: SettlementDeposit): SettlementLedger {
  assertOpen(ledger);
  if (!validDeposit(deposit, new Set(ledger.members.map(member => member.id)))) {
    throw new Error('선납한 사람, 날짜와 금액을 확인해 주세요.');
  }
  const previous = ledger.deposits.find(item => item.id === deposit.id);
  if (previous?.memberId !== deposit.memberId && !ledger.members.some(member => member.id === deposit.memberId && member.active !== false)) {
    throw new Error('현재 정산 참여자만 새 선납금을 낼 수 있어요.');
  }
  return { ...ledger, deposits: upsertRecord(ledger.deposits, { ...deposit }) };
}

export function deleteSettlementDeposit(ledger: SettlementLedger, id: string): SettlementLedger {
  assertOpen(ledger);
  return { ...ledger, deposits: ledger.deposits.filter(deposit => deposit.id !== id) };
}

function safeSum(total: number, delta: number): number {
  const result = total + delta;
  if (!Number.isSafeInteger(result)) throw new Error('정산 금액의 합계가 너무 커요.');
  return result;
}

function balances(ledger: SettlementLedger, includeFinal: boolean) {
  const participants = ledger.members.map(member => ({
    ...member, outOfPocket: 0, deposit: 0, share: 0, net: 0, depositRemaining: 0,
  }));
  const byId = new Map(participants.map(item => [item.id, item]));
  const order = new Map(ledger.members.map((member, index) => [member.id, index]));
  let spent = 0, depositTotal = 0, potBalance = 0;
  for (const deposit of ledger.deposits) {
    const member = byId.get(deposit.memberId)!;
    member.deposit = safeSum(member.deposit, deposit.amount);
    depositTotal = safeSum(depositTotal, deposit.amount);
  }
  potBalance = depositTotal;
  for (const expense of ledger.expenses) {
    spent = safeSum(spent, expense.amount);
    const split = [...expense.participantIds].sort((left, right) => order.get(left)! - order.get(right)!);
    const share = Math.floor(expense.amount / split.length);
    const remainder = expense.amount % split.length;
    split.forEach((id, index) => {
      const member = byId.get(id)!;
      member.share = safeSum(member.share, share + Number(index < remainder));
    });
    if (expense.payerId === SETTLEMENT_POT_ID) potBalance = safeSum(potBalance, -expense.amount);
    else {
      const payer = byId.get(expense.payerId)!;
      payer.outOfPocket = safeSum(payer.outOfPocket, expense.amount);
    }
  }
  for (const member of participants) {
    member.net = safeSum(safeSum(member.outOfPocket, member.deposit), -member.share);
    member.depositRemaining = Math.max(0, ledger.depositTarget - member.deposit);
  }
  const batches = includeFinal && ledger.final ? [...ledger.history, ledger.final] : ledger.history;
  for (const batch of batches) {
    for (const payment of batch.transfers) {
      if (!payment.paid) continue;
      if (payment.fromId === SETTLEMENT_POT_ID) potBalance = safeSum(potBalance, -payment.amount);
      else {
        const from = byId.get(payment.fromId)!;
        from.net = safeSum(from.net, payment.amount);
      }
      if (payment.toId === SETTLEMENT_POT_ID) potBalance = safeSum(potBalance, payment.amount);
      else {
        const to = byId.get(payment.toId)!;
        to.net = safeSum(to.net, -payment.amount);
      }
    }
  }
  return { spent, depositTotal, potBalance, budgetRemaining: ledger.budget - spent, participants };
}

function buildTransfers(participants: SettlementParticipant[], potBalance: number, closedAt?: string): SettlementTransfer[] {
  const balances = [...participants.map(({ id, net }) => ({ id, net })), { id: SETTLEMENT_POT_ID, net: -potBalance }];
  const debtors = balances.filter(item => item.net < 0);
  const creditors = balances.filter(item => item.net > 0);
  const transfers: SettlementTransfer[] = [];
  let debtorIndex = 0, creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex], creditor = creditors[creditorIndex];
    const amount = Math.min(-debtor.net, creditor.net);
    transfers.push({ id: ['transfer', closedAt, transfers.length + 1].filter(part => part !== undefined).join('-'), fromId: debtor.id, toId: creditor.id, amount, paid: false });
    debtor.net += amount;
    creditor.net -= amount;
    if (debtor.net === 0) debtorIndex++;
    if (creditor.net === 0) creditorIndex++;
  }
  return transfers;
}

export function calculateSettlement(ledger: SettlementLedger): SettlementView {
  const totals = balances(ledger, true);
  return { ...totals, transfers: ledger.final?.transfers.map(item => ({ ...item })) ?? buildTransfers(totals.participants, totals.potBalance) };
}

export function finalizeSettlement(ledger: SettlementLedger, now = new Date().toISOString()): SettlementLedger {
  assertOpen(ledger);
  if (!ledger.expenses.length && !ledger.deposits.length && !ledger.history.length) {
    throw new Error('지출이나 선납금을 기록한 뒤 정산을 확정해 주세요.');
  }
  if (!validTime(now)) throw new Error('정산 확정 시간을 확인해 주세요.');
  const { participants, potBalance } = balances(ledger, false);
  return { ...ledger, final: { closedAt: now, transfers: buildTransfers(participants, potBalance, now) } };
}

export function setSettlementTransferPaid(ledger: SettlementLedger, id: string, paid: boolean): SettlementLedger {
  if (!ledger.final) throw new Error('정산을 확정한 뒤 지급 여부를 기록해 주세요.');
  if (!ledger.final.transfers.some(item => item.id === id) || typeof paid !== 'boolean') {
    throw new Error('선택한 정산 내역을 다시 확인해 주세요.');
  }
  return { ...ledger, final: { ...ledger.final, transfers: ledger.final.transfers.map(item => item.id === id ? { ...item, paid } : item) } };
}

export function reopenSettlement(ledger: SettlementLedger): SettlementLedger {
  if (!ledger.final) return ledger;
  const confirmed = ledger.final.transfers.filter(item => item.paid);
  const history = confirmed.length ? [...ledger.history, { ...ledger.final, transfers: confirmed }] : ledger.history;
  const { final: _final, ...opened } = ledger;
  return { ...opened, history };
}

const validTime = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const distinctIds = (values: readonly { id: string }[]) => new Set(values.map(item => item.id)).size === values.length;

function validBatch(value: unknown, accounts: ReadonlySet<string>, archived = false): value is SettlementBatch {
  const account = (id: unknown): id is string => typeof id === 'string' && accounts.has(id);
  const isTransfer = (item: unknown): item is SettlementTransfer => record(item)
    && validId(item.id) && account(item.fromId) && account(item.toId) && item.fromId !== item.toId
    && Number.isSafeInteger(item.amount) && Number(item.amount) > 0 && typeof item.paid === 'boolean' && (!archived || item.paid);
  return record(value) && validTime(value.closedAt) && Array.isArray(value.transfers)
    && value.transfers.length <= accounts.size && (!archived || value.transfers.length > 0)
    && value.transfers.every(isTransfer) && distinctIds(value.transfers);
}

/** Validate stored data before any recorded expense, payment, or image is rendered. */
export function isSettlementLedger(value: unknown): value is SettlementLedger {
  if (!record(value) || value.schemaVersion !== 1 || !amount(value.budget, true) || !amount(value.depositTarget, true)
    || !Array.isArray(value.members) || !value.members.every(isMember) || !distinctIds(value.members)) return false;
  const members = new Set(value.members.map(item => item.id));
  if (!Array.isArray(value.expenses) || !value.expenses.every(item => validExpense(item, members)) || !distinctIds(value.expenses)
    || !Array.isArray(value.deposits) || !value.deposits.every(item => validDeposit(item, members)) || !distinctIds(value.deposits)) return false;
  const accounts = new Set([...members, SETTLEMENT_POT_ID]);
  if (!Array.isArray(value.history) || !value.history.every(item => validBatch(item, accounts, true))
    || value.final !== undefined && !validBatch(value.final, accounts)) return false;
  try {
    const ledger = value as unknown as SettlementLedger;
    const submitted = ledger.final;
    balances(ledger, !!submitted);
    if (!submitted) return true;
    const before = balances(ledger, false);
    const expected = buildTransfers(before.participants, before.potBalance, submitted.closedAt);
    return expected.length === submitted.transfers.length &&
      expected.every((transfer, i) => {
        const actual = submitted.transfers[i];
        return transfer.id === actual.id && transfer.fromId === actual.fromId && transfer.toId === actual.toId && transfer.amount === actual.amount;
      });
  } catch {
    return false;
  }
}
