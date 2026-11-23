import { useEffect, useRef, useState } from 'react';
import { BarChart3, Check, CheckSquare, Circle, MapPin, Square, X } from 'lucide-react';
import type { Place } from '../data';
import type { TogetherPoll, TogetherState } from './model';
import { canManagePoll, canVotePoll, isPollClosed } from './polls';
import { resolveScopedPollPlace } from './activityPlaces';
import { ActivityPlaceDetail } from './ActivityPlacesRoute';
import { previewPollActivityApplication, type PollActivityApplicationPreview } from './pollActivityApplication';
import './polls.css';

type ActionResult = boolean | Promise<boolean>;
export interface PollViewProps {
  state: TogetherState; userId: string; poll: TogetherPoll; compact?: boolean;
  onVote: (optionId: string | null) => ActionResult;
  onClosePoll?: () => ActionResult;
  onConfirm?: (optionId: string) => ActionResult;
  onEdit?: () => void;
  onApplyToActivity?: (pollId: string) => void;
  places?: Place[];
  onOpenPlace?: (place: Place) => void;
}
export default function PollView({ state, userId, poll, compact = false, onVote, onClosePoll, onConfirm, onEdit, onApplyToActivity, places = [], onOpenPlace }: PollViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false), [winner, setWinner] = useState('');
  const [detailOptionId, setDetailOptionId] = useState('');
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => { if (detailOptionId) detailRef.current?.scrollIntoView({ block: 'nearest' }); }, [detailOptionId]);
  const pending = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => window.clearInterval(timer); }, [poll.id]);
  useEffect(() => { setConfirmingClose(false); setWinner(''); setError(''); setDetailOptionId(''); }, [poll.id]);
  const group = state.groups.find(item => item.id === poll.groupId);
  const allowed = Boolean(group && userId && state.members.some(item => item.id === userId) && group.memberIds.includes(userId) && !group.blockedMemberIds?.includes(userId)
    && (!poll.activityId || state.activities.some(item => item.id === poll.activityId && item.groupId === poll.groupId)));
  if (!allowed) return <p className="room-poll-note">현재 볼 수 없는 투표예요.</p>;
  const closed = isPollClosed(poll, now), voting = canVotePoll(state, userId, poll, now), managing = canManagePoll(state, userId, poll, now);
  const members = new Set(group!.memberIds.filter(id => !group!.blockedMemberIds?.includes(id) && state.members.some(item => item.id === id)));
  const voters = new Set(poll.options.flatMap(option => option.voterIds.filter(id => members.has(id))));
  const voted = poll.options.some(option => option.voterIds.includes(userId));
  const responsesExist = poll.options.some(option => option.voterIds.length);
  const detailPlace = detailOptionId ? resolveScopedPollPlace(state, userId, poll, detailOptionId, places) : undefined;
  let application: PollActivityApplicationPreview | undefined, applicationNote = '';
  if (poll.confirmedOptionId && onApplyToActivity) {
    if (!poll.activityId) applicationNote = '모임 전체 투표예요. 특정 약속의 날짜·장소는 해당 약속에서 정해요.';
    else {
      try { application = previewPollActivityApplication(state, userId, { groupId: poll.groupId, activityId: poll.activityId, pollId: poll.id }, places, now); }
      catch (cause) { applicationNote = cause instanceof Error ? cause.message : '일정에서 확정안을 다시 확인해 주세요.'; }
    }
  }
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
      const place = resolveScopedPollPlace(state, userId, poll, option.id, places);
      return <div className="room-poll-answer" key={option.id}><button type="button" aria-pressed={selected} aria-label={`${option.label} · ${count}표${selected ? ' · 내 선택' : ''}${confirmed ? ' · 확정' : ''}`} disabled={busy || !voting} className={`room-poll-vote${selected ? ' is-selected' : ''}${confirmed ? ' is-confirmed' : ''}`} onClick={() => void run(() => onVote(option.id))}><Icon size={18}/><span>{option.label}{confirmed && <small>확정한 후보</small>}</span><strong>{count}</strong></button>{place ? <button type="button" className="room-poll-place-open" title="장소 상세" aria-label={`${place.name} · ${place.address || place.area} 장소 상세`} onClick={() => onOpenPlace ? onOpenPlace(place) : setDetailOptionId(option.id)}><MapPin size={18} aria-hidden="true"/></button> : option.placeId && <small className="room-poll-note">이 장소의 현재 정보를 찾을 수 없어요.</small>}</div>;
    })}</div>
    <div className="room-poll-foot"><span>{voters.size}명 참여</span>{voting && voted && <button type="button" disabled={busy} onClick={() => void run(() => onVote(null))}>내 투표 취소</button>}</div>
    {managing && !poll.confirmedOptionId && <div className="room-poll-manage">
      {!closed && onEdit && !responsesExist && <button type="button" disabled={busy} onClick={onEdit}>투표 수정</button>}
      {!closed && onClosePoll && (confirmingClose ? <div className="room-poll-close-check"><span>투표를 마감할까요?</span><button type="button" disabled={busy} onClick={() => void run(onClosePoll)}>마감하기</button><button type="button" disabled={busy} onClick={() => setConfirmingClose(false)}>계속 받기</button></div> : <button type="button" disabled={busy} onClick={() => setConfirmingClose(true)}>투표 마감</button>)}
      {onConfirm && <div className="room-poll-confirm"><label><span className="room-poll-sr-only">확정할 후보</span><select aria-label="확정할 투표 후보" value={winner} disabled={busy} onChange={event => setWinner(event.target.value)}><option value="">결과 확인 후 후보 선택</option>{poll.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button type="button" disabled={busy || !winner} onClick={() => void run(() => onConfirm(winner))}>선택 확정</button></div>}
    </div>}
    {poll.confirmedOptionId && <div className="room-poll-application">{application && onApplyToActivity ? <><p className="room-poll-note">후보를 확정했어요. 현재 일정과 비교한 뒤 반영할 수 있어요.</p><button type="button" className="room-poll-apply" disabled={busy} onClick={() => onApplyToActivity(poll.id)}>확정안을 일정에 반영</button></> : <p className="room-poll-note">{applicationNote || '후보를 확정했어요. 일정·참석·예약 변경은 별도로 확인해요.'}</p>}</div>}
    {!voting && !closed && <p className="room-poll-note">현재 이 모임·약속의 투표는 읽기만 가능해요.</p>}
    {detailPlace && <section ref={detailRef} className="room-poll-place-detail" aria-label={`${detailPlace.name} 장소 상세`}><div className="activity-picker-title"><h3>장소 상세</h3><button type="button" aria-label="장소 상세 닫기" onClick={() => setDetailOptionId('')}><X size={18}/></button></div><ActivityPlaceDetail place={detailPlace}/></section>}
    {error && <p className="room-poll-error" role="alert">{error}</p>}
  </section>;
}
