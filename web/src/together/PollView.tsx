import { useEffect, useRef, useState } from 'react';
import { BarChart3, Check, CheckSquare, Circle, Square } from 'lucide-react';
import type { TogetherPoll, TogetherState } from './model';
import { canManagePoll, canVotePoll, isPollClosed } from './polls';
import './polls.css';

type ActionResult = boolean | Promise<boolean>;
export interface PollViewProps {
  state: TogetherState; userId: string; poll: TogetherPoll; compact?: boolean;
  onVote: (optionId: string | null) => ActionResult;
  onClosePoll?: () => ActionResult;
  onConfirm?: (optionId: string) => ActionResult;
  onEdit?: () => void;
}
export default function PollView({ state, userId, poll, compact = false, onVote, onClosePoll, onConfirm, onEdit }: PollViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false), [winner, setWinner] = useState('');
  const pending = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => window.clearInterval(timer); }, [poll.id]);
  useEffect(() => { setConfirmingClose(false); setWinner(''); setError(''); }, [poll.id]);
  const group = state.groups.find(item => item.id === poll.groupId);
  const allowed = Boolean(group && userId && state.members.some(item => item.id === userId) && group.memberIds.includes(userId) && !group.blockedMemberIds?.includes(userId)
    && (!poll.activityId || state.activities.some(item => item.id === poll.activityId && item.groupId === poll.groupId)));
  if (!allowed) return <p className="room-poll-note">현재 볼 수 없는 투표예요.</p>;
  const closed = isPollClosed(poll, now), voting = canVotePoll(state, userId, poll, now), managing = canManagePoll(state, userId, poll, now);
  const members = new Set(group!.memberIds.filter(id => !group!.blockedMemberIds?.includes(id) && state.members.some(item => item.id === id)));
  const voters = new Set(poll.options.flatMap(option => option.voterIds.filter(id => members.has(id))));
  const voted = poll.options.some(option => option.voterIds.includes(userId));
  const responsesExist = poll.options.some(option => option.voterIds.length);
  const run = async (action: () => ActionResult) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { if (!await action()) setError('반영하지 못했어요. 현재 투표를 다시 확인해 주세요.'); else { setConfirmingClose(false); setWinner(''); setNow(new Date()); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : '투표를 변경하지 못했어요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className={`room-poll-view${compact ? ' is-compact' : ''}`} aria-label="함께 고르는 투표" data-poll-id={poll.id}>
    <div className="room-poll-heading"><BarChart3 size={17}/><span>{poll.kind === 'DATE' ? '날짜 투표' : '투표'}</span><small>{closed ? '마감' : '진행 중'} · {poll.multiple ? '복수 선택' : '하나 선택'}{poll.anonymous ? ' · 이름 비공개' : ''}</small></div>
    <h3>{poll.question}</h3>
    {poll.closesAt && <p className="room-poll-note">마감 {new Date(poll.closesAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} · 한국 시각</p>}
    <div className="room-poll-answers" role="group" aria-label={poll.question}>{poll.options.map(option => {
      const selected = option.voterIds.includes(userId), confirmed = option.id === poll.confirmedOptionId;
      const count = new Set(option.voterIds.filter(id => members.has(id))).size;
      const Icon = confirmed ? Check : poll.multiple ? selected ? CheckSquare : Square : selected ? Check : Circle;
      return <button type="button" key={option.id} aria-pressed={selected} aria-label={`${option.label} · ${count}표${selected ? ' · 내 선택' : ''}${confirmed ? ' · 확정' : ''}`} disabled={busy || !voting} className={`${selected ? 'is-selected' : ''}${confirmed ? ' is-confirmed' : ''}`} onClick={() => void run(() => onVote(option.id))}><Icon size={18}/><span>{option.label}{confirmed && <small>확정한 후보</small>}</span><strong>{count}</strong></button>;
    })}</div>
    <div className="room-poll-foot"><span>{voters.size}명 참여</span>{voting && voted && <button type="button" disabled={busy} onClick={() => void run(() => onVote(null))}>내 투표 취소</button>}</div>
    {managing && !poll.confirmedOptionId && <div className="room-poll-manage">
      {!closed && onEdit && !responsesExist && <button type="button" disabled={busy} onClick={onEdit}>투표 수정</button>}
      {!closed && onClosePoll && (confirmingClose ? <div className="room-poll-close-check"><span>투표를 마감할까요?</span><button type="button" disabled={busy} onClick={() => void run(onClosePoll)}>마감하기</button><button type="button" disabled={busy} onClick={() => setConfirmingClose(false)}>계속 받기</button></div> : <button type="button" disabled={busy} onClick={() => setConfirmingClose(true)}>투표 마감</button>)}
      {onConfirm && <div className="room-poll-confirm"><label><span className="room-poll-sr-only">확정할 후보</span><select aria-label="확정할 투표 후보" value={winner} disabled={busy} onChange={event => setWinner(event.target.value)}><option value="">결과 확인 후 후보 선택</option>{poll.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button type="button" disabled={busy || !winner} onClick={() => void run(() => onConfirm(winner))}>선택 확정</button></div>}
    </div>}
    {poll.confirmedOptionId && <p className="room-poll-note">후보를 확정했어요. 일정·참석·예약 변경은 별도로 확인해요.</p>}
    {!voting && !closed && <p className="room-poll-note">현재 이 모임·약속의 투표는 읽기만 가능해요.</p>}
    {error && <p className="room-poll-error" role="alert">{error}</p>}
  </section>;
}
