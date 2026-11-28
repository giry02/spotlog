import { createSettlementLedger, isSettlementLedger, type SettlementLedger, type SettlementMember } from './settlementModel.ts';

export type SettlementScope =
  | { kind: 'PERSONAL_TRIP'; accountId: string; id: string }
  | { kind: 'GROUP'; accountId: string; id: string }
  | { kind: 'ACTIVITY'; accountId: string; groupId: string; id: string };

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
export type SettlementStorageSnapshot = { ledger: SettlementLedger; raw: string | null; error: string };

export function settlementStorageKey(scope: SettlementScope): string {
  const parts = [scope.accountId, scope.kind, scope.kind === 'ACTIVITY' ? scope.groupId : '', scope.id];
  return 'spotlog.settlement.v1:' + parts.map(encodeURIComponent).join(':');
}

export function readSettlementStorage(storage: StorageAccess | undefined, scope: SettlementScope, members: readonly SettlementMember[]): SettlementStorageSnapshot {
  const unavailable = { ledger: createSettlementLedger(), raw: null, error: '이 브라우저에서 정산 기록을 불러올 수 없어요.' };
  if (!storage) return unavailable;
  try {
    const raw = storage.getItem(settlementStorageKey(scope));
    if (raw === null) return { ledger: createSettlementLedger(members), raw, error: '' };
    const ledger: unknown = JSON.parse(raw);
    return isSettlementLedger(ledger) ? { ledger, raw, error: '' }
      : { ...unavailable, raw, error: '기존 정산 기록을 읽을 수 없어요. 기록은 그대로 보관했어요.' };
  } catch {
    return unavailable;
  }
}

/** Refuse writes based on stale or unreadable records so a second open sheet cannot erase recent entries. */
export function saveSettlementStorage(storage: StorageAccess | undefined, scope: SettlementScope, base: SettlementStorageSnapshot, ledger: SettlementLedger): SettlementStorageSnapshot {
  if (!storage || base.error) throw new Error(base.error || '이 브라우저에서 정산 기록을 저장할 수 없어요.');
  if (!isSettlementLedger(ledger)) throw new Error('정산 기록의 금액이나 참여자를 다시 확인해 주세요.');
  const key = settlementStorageKey(scope);
  if (storage.getItem(key) !== base.raw) throw new Error('다른 화면에서 정산 기록이 바뀌었어요. 최신 내역을 확인하고 다시 저장해 주세요.');
  const raw = JSON.stringify(ledger);
  try {
    storage.setItem(key, raw);
  } catch {
    throw new Error('기기 저장 공간을 확인해 주세요. 입력은 남아 있으니 사진을 줄이거나 빼고 다시 저장할 수 있어요.');
  }
  return { ledger, raw, error: '' };
}
