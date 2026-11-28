import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronDown, Plus, ReceiptText, UserMinus, Users, Wallet } from 'lucide-react';
import ReceiptAttachmentField from './ReceiptAttachmentField';
import {
  calculateSettlement, deleteSettlementDeposit, deleteSettlementExpense, finalizeSettlement, reconcileSettlementMembers,
  reopenSettlement, saveSettlementDeposit, saveSettlementExpense, SETTLEMENT_POT_ID, setSettlementSettings,
  setSettlementTransferPaid, type SettlementDeposit, type SettlementExpense, type SettlementLedger,
  type SettlementMember, type SettlementReceipt, type SettlementTransfer,
} from './settlementModel';
import './settlement-panel.css';

type Props = {
  ledger: SettlementLedger;
  scopeTitle: string;
  roster?: readonly SettlementMember[];
  preferredPayerId?: string;
  canEdit: boolean;
  demoReceipt?: boolean;
  onSave: (ledger: SettlementLedger) => boolean;
};

type Tab = 'expenses' | 'deposits' | 'finish';
type Editor = { kind: 'budget' } | { kind: 'expense'; current?: SettlementExpense } |
  { kind: 'deposit'; memberId?: string; current?: SettlementDeposit };

const tabs = [
  { id: 'expenses', label: '예산·지출', icon: ReceiptText },
  { id: 'deposits', label: '예치금', icon: Wallet },
  { id: 'finish', label: '최종 정산', icon: Users },
] as const;

const amountFormatter = new Intl.NumberFormat('ko-KR');
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
const won = (amount: number) => amountFormatter.format(amount) + '원';
const today = () => dayFormatter.format(new Date());
const readAmount = (value: string) => {
  const input = value.trim();
  if (!input) return 0;
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(input) ? Number(input.replaceAll(',', '')) : NaN;
};
const currentMember = (member: SettlementMember) => member.active !== false;

function AmountField({ label, value, onChange, optional = false }: {
  label: string; value: string; onChange: (amount: string) => void; optional?: boolean;
}) {
  return <label className="settlement-panel__field">{label}
    <span className="settlement-panel__amount">
      <input aria-label={label} inputMode="numeric" value={value} onChange={event => onChange(event.currentTarget.value)}
        maxLength={20} placeholder="0" required={!optional} />
      <span aria-hidden="true">원</span>
    </span>
  </label>;
}

function SettingsEditor({ ledger, onCommit, onCancel }: {
  ledger: SettlementLedger; onCommit: (budget: number, depositTarget: number) => void; onCancel: () => void;
}) {
  const [budget, setBudget] = useState(ledger.budget ? String(ledger.budget) : '');
  const [depositTarget, setDepositTarget] = useState(ledger.depositTarget ? String(ledger.depositTarget) : '');
  return <form className="settlement-panel__editor" onSubmit={event => {
    event.preventDefault();
    onCommit(readAmount(budget), readAmount(depositTarget));
  }}>
    <h3>예산과 예치금 기준</h3>
    <AmountField label="전체 예산" value={budget} onChange={setBudget} optional />
    <AmountField label="1인당 예치금 목표" value={depositTarget} onChange={setDepositTarget} optional />
    <div className="settlement-panel__form-actions">
      <button type="button" onClick={onCancel}>취소</button><button className="settlement-panel__primary">저장</button>
    </div>
  </form>;
}

function ExpenseEditor({ members, current, preferredPayerId, demoReceipt, onCommit, onCancel }: {
  members: readonly SettlementMember[]; current?: SettlementExpense;
  preferredPayerId?: string;
  demoReceipt?: boolean;
  onCommit: (expense: SettlementExpense) => void; onCancel: () => void;
}) {
  const active = members.filter(currentMember);
  const eligible = members.filter(member => currentMember(member) || member.id === current?.payerId || current?.participantIds.includes(member.id));
  const [title, setTitle] = useState(current?.title ?? '');
  const [amount, setAmount] = useState(current ? String(current.amount) : '');
  const [date, setDate] = useState(current?.date ?? today);
  const [payerId, setPayerId] = useState(current?.payerId
    ?? active.find(member => member.id === preferredPayerId)?.id ?? active[0]?.id ?? SETTLEMENT_POT_ID);
  const [participantIds, setParticipantIds] = useState(current?.participantIds ?? active.map(member => member.id));
  const [receipt, setReceipt] = useState<SettlementReceipt | undefined>(current?.receipt);
  const numeric = readAmount(amount);
  const count = participantIds.length;
  const quotient = Math.floor(numeric / count);
  const payer = payerId === SETTLEMENT_POT_ID ? '공동금' : eligible.find(member => member.id === payerId)?.name;
  const split = count > 0
    ? `${count}명 균등 분담${Number.isSafeInteger(numeric) && numeric > 0
      ? ` · 1인 ${numeric % count ? `${amountFormatter.format(quotient)}–${won(quotient + 1)}` : won(quotient)}` : ''}`
    : '한 명 이상 선택해 주세요.';
  return <form className="settlement-panel__editor" onSubmit={event => {
    event.preventDefault();
    onCommit({ id: current?.id ?? crypto.randomUUID(), title, amount: numeric, date, payerId, participantIds, ...(receipt && { receipt }) });
  }}>
    <h3>{current ? '지출 수정' : '지출 등록'}</h3>
    <ReceiptAttachmentField demoReceipt={demoReceipt} value={receipt} onChange={setReceipt} onRecognizedTotal={total => setAmount(String(total))} />
    <label className="settlement-panel__field">사용한 곳 또는 항목
      <input value={title} onChange={event => setTitle(event.currentTarget.value)} placeholder="예: 저녁 식사" maxLength={100} required />
    </label>
    <AmountField label="지출 금액" value={amount} onChange={setAmount} />
    <details className="settlement-panel__details settlement-panel__split">
      <summary><span><strong>날짜·결제·분담</strong><small>{date} · {payer} 결제 · {count}명</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="settlement-panel__split-fields">
        <label className="settlement-panel__field">사용한 날짜
          <input type="date" value={date} onChange={event => setDate(event.currentTarget.value)} required />
        </label>
        <label className="settlement-panel__field">결제한 사람
          <select value={payerId} onChange={event => setPayerId(event.currentTarget.value)}>
            {eligible.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            <option value={SETTLEMENT_POT_ID}>공동금에서 지출</option>
          </select>
        </label>
        <fieldset className="settlement-panel__participants">
          <legend>함께 나눌 사람</legend>
          <div className="settlement-panel__checks">
            {eligible.map(member => <label key={member.id}>
              <input type="checkbox" checked={participantIds.includes(member.id)} onChange={event => {
                const checked = event.currentTarget.checked;
                setParticipantIds(ids => checked ? [...ids, member.id] : ids.filter(id => id !== member.id));
              }} />
              {member.name}
            </label>)}
          </div>
        </fieldset>
      </div>
    </details>
    <p className="settlement-panel__meta" aria-live="polite">{split}</p>
    <div className="settlement-panel__form-actions">
      <button type="button" onClick={onCancel}>취소</button>
      <button className="settlement-panel__primary" disabled={!count}>{current ? '수정 저장' : '지출 저장'}</button>
    </div>
  </form>;
}

function DepositEditor({ members, current, initialMemberId, remainingByMember, onCommit, onCancel }: {
  members: readonly SettlementMember[]; current?: SettlementDeposit; initialMemberId?: string;
  remainingByMember: ReadonlyMap<string, number>;
  onCommit: (deposit: SettlementDeposit) => void; onCancel: () => void;
}) {
  const eligible = members.filter(member => currentMember(member) || member.id === current?.memberId);
  const [memberId, setMemberId] = useState(current?.memberId ?? initialMemberId ?? eligible[0]?.id ?? '');
  const suggestion = (id: string) => {
    const remaining = remainingByMember.get(id);
    return remaining ? String(remaining) : '';
  };
  const [amount, setAmount] = useState(current ? String(current.amount) : suggestion(memberId));
  const [date, setDate] = useState(current?.date ?? today);
  return <form className="settlement-panel__editor" onSubmit={event => {
    event.preventDefault();
    onCommit({ id: current?.id ?? crypto.randomUUID(), memberId, amount: readAmount(amount), date });
  }}>
    <h3>{current ? '예치금 수정' : '예치금 입금 기록'}</h3>
    <label className="settlement-panel__field">낸 사람
      <select value={memberId} onChange={event => {
        const next = event.currentTarget.value;
        if (!current && amount === suggestion(memberId)) setAmount(suggestion(next));
        setMemberId(next);
      }} required>
        {eligible.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    </label>
    <AmountField label="입금액" value={amount} onChange={setAmount} />
    <label className="settlement-panel__field">입금일
      <input type="date" value={date} onChange={event => setDate(event.currentTarget.value)} required />
    </label>
    <div className="settlement-panel__form-actions">
      <button type="button" onClick={onCancel}>취소</button>
      <button className="settlement-panel__primary" disabled={!memberId}>{current ? '수정 저장' : '입금내역 저장'}</button>
    </div>
  </form>;
}

function TransferItem({ transfer, memberName, onPaid }: {
  transfer: SettlementTransfer; memberName: (id: string) => string; onPaid?: () => void;
}) {
  return <li className="settlement-panel__row settlement-panel__transfer">
    <div className="settlement-panel__row-text">
      <span className="settlement-panel__transfer-route"><strong>{memberName(transfer.fromId)}</strong>
        <ArrowRight size={14} aria-label="에서" /><strong>{memberName(transfer.toId)}</strong></span>
      {transfer.paid && <span className="settlement-panel__positive"><Check size={14} aria-hidden="true" /> 처리 완료</span>}
    </div>
    <strong>{won(transfer.amount)}</strong>
    {onPaid && <button type="button"
      aria-label={`${memberName(transfer.fromId)} → ${memberName(transfer.toId)} ${transfer.paid ? '완료 취소' : '처리 완료 표시'}`}
      onClick={onPaid}>{transfer.paid ? '완료 취소' : '완료 표시'}</button>}
  </li>;
}

export default function SettlementPanel({ ledger, scopeTitle, roster, preferredPayerId, canEdit, demoReceipt, onSave }: Props) {
  const [tab, setTab] = useState<Tab>('expenses');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [memberNameDraft, setMemberNameDraft] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const panel = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const { view, rosterError } = useMemo(() => {
    try {
      return { view: roster ? reconcileSettlementMembers(ledger, roster) : ledger, rosterError: '' };
    } catch (error) {
      return { view: ledger, rosterError: error instanceof Error ? error.message : '정산 참여자 목록을 확인해 주세요.' };
    }
  }, [ledger, roster]);
  const summary = useMemo(() => calculateSettlement(view), [view]);
  useEffect(() => {
    if (!editor) return;
    const frame = requestAnimationFrame(() => {
      const heading = panel.current?.querySelector<HTMLElement>('.settlement-panel__editor h3');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.scrollIntoView({ block: 'nearest' });
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [editor]);
  const members = view.members.filter(currentMember);
  const canWrite = canEdit && !rosterError;
  const editable = canWrite && !view.final;
  const memberName = (id: string) => id === SETTLEMENT_POT_ID ? '공동금' : view.members.find(member => member.id === id)?.name ?? '참여자';
  const editingNotice = () => setNotice({ text: '작성 중인 내역을 저장하거나 취소해 주세요.' });
  const changeEditor = (next: Editor | null) => {
    if (next && editor) { editingNotice(); return; }
    setEditor(next); setDeleteId(''); setNotice(null);
  };
  const commit = (update: () => SettlementLedger, message: string) => {
    if (!canWrite) return false;
    try {
      if (!onSave(update())) throw new Error('저장할 수 없어요. 다시 시도해 주세요.');
      setEditor(null); setDeleteId(''); setNotice({ text: message });
      return true;
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : '처리하지 못했어요. 다시 시도해 주세요.' });
      return false;
    }
  };
  const addMember = (event: FormEvent) => {
    event.preventDefault();
    const name = memberNameDraft.trim();
    if (!name) return;
    if (members.some(member => member.name === name)) { setNotice({ error: true, text: '같은 이름이 있어요. 구분할 수 있는 이름을 써 주세요.' }); return; }
    const previous = view.members.find(member => !currentMember(member) && member.name === name);
    const added = { id: previous?.id ?? crypto.randomUUID(), name };
    if (commit(() => reconcileSettlementMembers(view, [...members, added]), '참여자를 추가했어요.')) setMemberNameDraft('');
  };
  const changeTab = (next: Tab) => {
    if (tab === next) return;
    if (editor) { editingNotice(); return; }
    setTab(next); changeEditor(null);
  };
  const budgetText = view.budget ? won(view.budget) : '설정 전';
  const shownTransfers = view.final?.transfers ?? summary.transfers;
  const pendingTransfers = shownTransfers.filter(transfer => !transfer.paid).length;
  const contributionRows = summary.participants.filter(member => currentMember(member) || member.deposit || member.share || member.outOfPocket || member.net);
  const reachedDeposit = contributionRows.filter(member => currentMember(member) && (view.depositTarget ? !member.depositRemaining : member.deposit > 0)).length;

  return <section ref={panel} className="settlement-panel" aria-label="비용 정산">
    <div className="settlement-panel__overview">
      <div className="settlement-panel__scope"><span>{scopeTitle}</span>{view.final && <span className="settlement-panel__chip">{view.final.transfers.every(transfer => transfer.paid) ? '정산 완료' : '정산 확정'}</span>}</div>
      <div className="settlement-panel__headline">
        <div><span>총 지출</span><strong>{won(summary.spent)}</strong></div>
        {editable && <button type="button" onClick={() => changeEditor({ kind: 'budget' })}>예산 설정</button>}
      </div>
      <dl className="settlement-panel__figures">
        <div><dt>전체 예산</dt><dd>{budgetText}</dd></div>
        {view.budget > 0 && <div><dt>{summary.budgetRemaining < 0 ? '예산 초과' : '남은 예산'}</dt>
          <dd className={summary.budgetRemaining < 0 ? 'settlement-panel__negative' : undefined}>{won(Math.abs(summary.budgetRemaining))}</dd></div>}
        <div><dt>{summary.potBalance < 0 ? '공동금 부족액' : '공동금 잔액'}</dt>
          <dd className={summary.potBalance < 0 ? 'settlement-panel__negative' : undefined}>{won(Math.abs(summary.potBalance))}</dd></div>
      </dl>
    </div>

    <div className="settlement-panel__tabs" role="group" aria-label="정산 항목">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => changeTab(id)}>
        <Icon size={16} aria-hidden="true" />{label}
      </button>)}
    </div>
    {rosterError && <p className="settlement-panel__notice settlement-panel__negative" role="alert">{rosterError}</p>}
    {notice && <p className={notice.error ? 'settlement-panel__notice settlement-panel__negative' : 'settlement-panel__notice'}
      role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}

    {editable && editor?.kind === 'budget' && <SettingsEditor ledger={view} onCancel={() => changeEditor(null)}
      onCommit={(budget, depositTarget) => commit(() => setSettlementSettings(view, { budget, depositTarget }), '예산과 예치금 기준을 저장했어요.')} />}

    {tab === 'expenses' && <>
      {!roster && <details className="settlement-panel__details" open={!members.length || undefined}>
        <summary><span>정산 참여자 · {members.length}명</span><ChevronDown size={16} aria-hidden="true" /></summary>
        {members.length > 0 && <ul className="settlement-panel__roster">{members.map(member => <li key={member.id}>
          <span>{member.name}</span>{editable && <button type="button" aria-label={`${member.name} 참여자에서 제외`}
            onClick={() => commit(() => reconcileSettlementMembers(view, members.filter(item => item.id !== member.id)), '다음 지출의 참여자 목록에서 뺐어요.')}>
            <UserMinus size={15} aria-hidden="true" />
          </button>}
        </li>)}</ul>}
        {editable && <form className="settlement-panel__inline" onSubmit={addMember}>
          <input aria-label="참여자 이름" value={memberNameDraft} onChange={event => setMemberNameDraft(event.currentTarget.value)} maxLength={40} placeholder="참여자 이름" required />
          <button type="submit">참여자 추가</button>
        </form>}
      </details>}
      <div className="settlement-panel__section-title"><h3>지출 내역</h3>
        {editable && <button type="button" className="settlement-panel__primary" disabled={!members.length} onClick={() => changeEditor({ kind: 'expense' })}>
          <Plus size={16} aria-hidden="true" /> 지출 등록
        </button>}
      </div>
      {editable && editor?.kind === 'expense' && <ExpenseEditor key={editor.current?.id ?? 'new'} members={view.members}
        current={editor.current} preferredPayerId={preferredPayerId} demoReceipt={demoReceipt} onCancel={() => changeEditor(null)}
        onCommit={expense => commit(() => saveSettlementExpense(view, expense), '지출을 저장했어요.')} />}
      {view.expenses.length ? <ul className="settlement-panel__list">
        {[...view.expenses].sort((a, b) => b.date.localeCompare(a.date)).map(expense => <li key={expense.id}>
          <div className="settlement-panel__row">
            <span className="settlement-panel__row-text"><strong>{expense.title}</strong>
              <small>{expense.date} · {memberName(expense.payerId)} 결제 · {expense.participantIds.length}명 분담</small>
            </span>
            <strong>{won(expense.amount)}</strong>
          </div>
          {expense.receipt && <details className="settlement-panel__receipt">
            <summary>영수증 보기 <ChevronDown size={15} aria-hidden="true" /></summary>
            <img src={expense.receipt.url} alt={`${expense.title} 영수증`} loading="lazy" />
          </details>}
          {editable && <div className="settlement-panel__record-actions">
            {deleteId === expense.id ? <>
              <span>지출을 삭제할까요?</span><button type="button" onClick={() => setDeleteId('')}>취소</button>
              <button type="button" className="settlement-panel__negative" onClick={() => commit(() => deleteSettlementExpense(view, expense.id), '지출을 삭제했어요.')}>삭제 확인</button>
            </> : <>
              <button type="button" aria-label={`${expense.title} 지출 수정`} onClick={() => changeEditor({ kind: 'expense', current: expense })}>수정</button>
              <button type="button" aria-label={`${expense.title} 지출 삭제`} onClick={() => setDeleteId(expense.id)}>삭제</button>
            </>}
          </div>}
        </li>)}
      </ul> : !editor && <p className="settlement-panel__empty">{members.length ? '첫 지출을 등록해 보세요.' : '정산에 함께할 사람을 먼저 추가해 주세요.'}</p>}
    </>}

    {tab === 'deposits' && <>
      <div className="settlement-panel__section-title"><h3>선납금(예치금) 현황</h3><strong>{won(summary.depositTotal)}</strong></div>
      {members.length > 0 && <p className="settlement-panel__meta">{view.depositTarget
        ? `1인당 목표 ${won(view.depositTarget)} · 목표 달성 ${reachedDeposit}/${members.length}명`
        : `입금한 사람 ${reachedDeposit}/${members.length}명`}</p>}
      {editable && editor?.kind === 'deposit' && <DepositEditor key={editor.current?.id ?? editor.memberId} members={view.members} current={editor.current}
        initialMemberId={editor.memberId} remainingByMember={new Map(contributionRows.map(member => [member.id, member.depositRemaining]))} onCancel={() => changeEditor(null)}
        onCommit={deposit => commit(() => saveSettlementDeposit(view, deposit), '예치금 입금내역을 저장했어요.')} />}
      {contributionRows.length > 0 ? <ul className="settlement-panel__list">
        {contributionRows.map(member => <li key={member.id}>
          <div className="settlement-panel__row">
            <span className="settlement-panel__row-text"><strong>{member.name}</strong>
              <small>{member.deposit ? view.depositTarget && member.depositRemaining ? `${won(member.depositRemaining)} 남음` : view.depositTarget ? '목표 달성' : '입금 기록 있음' : '입금 기록 없음'}</small>
            </span>
            <strong>{won(member.deposit)}</strong>
            {editable && currentMember(member) && <button type="button" aria-label={`${member.name} 입금 추가`} onClick={() => changeEditor({ kind: 'deposit', memberId: member.id })}>입금 추가</button>}
          </div>
        </li>)}
      </ul> : <p className="settlement-panel__empty">정산 참여자를 추가하면 입금내역을 기록할 수 있어요.</p>}
      {view.deposits.length > 0 && <details className="settlement-panel__details">
        <summary><span>입금내역 · {view.deposits.length}건</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <ul className="settlement-panel__list">{[...view.deposits].sort((a, b) => b.date.localeCompare(a.date)).map(deposit => <li key={deposit.id}>
          <div className="settlement-panel__row"><span className="settlement-panel__row-text"><strong>{memberName(deposit.memberId)}</strong><small>{deposit.date}</small></span>
            <strong>{won(deposit.amount)}</strong>
          </div>
          {editable && <div className="settlement-panel__record-actions">
            {deleteId === deposit.id ? <>
              <span>입금내역을 삭제할까요?</span><button type="button" onClick={() => setDeleteId('')}>취소</button>
              <button type="button" className="settlement-panel__negative" onClick={() => commit(() => deleteSettlementDeposit(view, deposit.id), '입금내역을 삭제했어요.')}>삭제 확인</button>
            </> : <>
              <button type="button" aria-label={`${memberName(deposit.memberId)} 입금내역 수정`} onClick={() => changeEditor({ kind: 'deposit', current: deposit })}>수정</button>
              <button type="button" aria-label={`${memberName(deposit.memberId)} 입금내역 삭제`} onClick={() => setDeleteId(deposit.id)}>삭제</button>
            </>}
          </div>}
        </li>)}</ul>
      </details>}
    </>}

    {tab === 'finish' && <>
      <div className="settlement-panel__section-title"><h3>{view.final ? '확정한 정산' : '정산 미리보기'}</h3>
        {view.final && !!pendingTransfers && <span className="settlement-panel__chip">{pendingTransfers}건 남음</span>}
      </div>
      {view.final && !!pendingTransfers && <p className="settlement-panel__meta">실제 송금을 확인한 뒤 완료로 표시하세요.</p>}
      {shownTransfers.length > 0 ? <ul className="settlement-panel__list">{shownTransfers.map(transfer => <TransferItem key={transfer.id} transfer={transfer} memberName={memberName}
        onPaid={view.final && canWrite && (() => commit(() => setSettlementTransferPaid(view, transfer.id, !transfer.paid),
          transfer.paid ? '완료 표시를 취소했어요.' : '처리 완료로 기록했어요.')) || undefined} />)}</ul>
        : <p className="settlement-panel__empty">{view.expenses.length || view.deposits.length ? '주고받을 돈이 없어요.' : '지출이나 예치금을 기록하면 정산을 미리 볼 수 있어요.'}</p>}
      {canWrite && (view.final ? <button type="button" className="settlement-panel__wide" onClick={() => commit(() => reopenSettlement(view), '정산을 다시 열었어요.')}>정산 다시 열기</button>
        : (view.expenses.length > 0 || view.deposits.length > 0) && <button type="button" className="settlement-panel__primary settlement-panel__wide"
          onClick={() => commit(() => finalizeSettlement(view), '최종 정산을 확정했어요.')}>최종 정산 확정</button>)}
      <div className="settlement-panel__section-title"><h3>사람별 정산</h3></div>
      {contributionRows.length > 0 ? <ul className="settlement-panel__list">
        {contributionRows.map(member => <li key={member.id} className="settlement-panel__row">
          <span className="settlement-panel__row-text"><strong>{member.name}</strong>
            <small>분담 {won(member.share)} · 개인 결제 {won(member.outOfPocket)} · 예치 {won(member.deposit)}</small>
          </span>
          <strong className={member.net > 0 ? 'settlement-panel__positive' : member.net < 0 ? 'settlement-panel__negative' : undefined}>
            {member.net > 0 ? '받을 돈 ' : member.net < 0 ? '낼 돈 ' : ''}{won(Math.abs(member.net))}
          </strong>
        </li>)}
      </ul> : <p className="settlement-panel__empty">정산 참여자를 추가하면 사람별 금액을 볼 수 있어요.</p>}
      {view.history.some(batch => batch.transfers.some(transfer => transfer.paid)) && <details className="settlement-panel__details">
        <summary><span>이전 완료 기록</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <ul className="settlement-panel__list">{view.history.flatMap((batch, index) =>
          batch.transfers.filter(transfer => transfer.paid).map(transfer => <TransferItem key={`${index}:${transfer.id}`} transfer={transfer} memberName={memberName} />))}</ul>
      </details>}
    </>}
  </section>;
}
