import { useState } from 'react';
import { CalendarPlus, Check, Clock3 } from 'lucide-react';
import { memberName, type TogetherState } from './model';
import { previewActivityRepeats, selectActivityParticipation, type ActivityRepeatPreview, type ActivityRepeatRule } from './activityParticipation';
import './activity-participation-tools.css';

interface ScopeProps { state: TogetherState; userId: string; groupId: string; activityId: string }

export function ActivityWaitlistPanel({ state, userId, groupId, activityId, onWaitlist, onConfirm }: ScopeProps & {
  onWaitlist: (join: boolean) => boolean; onConfirm: () => boolean;
}) {
  const value = selectActivityParticipation(state, userId, groupId, activityId);
  if (!value || value.capacity === undefined || !value.waitingCount && value.joinedCount < value.capacity) return null;
  return <section className="activity-waitlist" aria-label="약속 참가 대기">
    <div className="activity-waitlist__heading"><Clock3 size={18} aria-hidden="true"/><strong>참가 대기</strong><span>{value.waitingCount}명</span></div>
    {!value.writable ? <p>종료된 약속의 참가 대기 기록이에요.</p> : value.waitingPosition !== undefined ? <p>{value.seatOffered ? '참가 가능한 자리가 생겼어요. 참석할 수 있는지 확인해 주세요.' : '현재 대기 ' + value.waitingPosition + '번째예요.'}</p>
      : <p>{value.isJoined ? '나는 참가로 선택했어요.' : '정원이 찼을 때 대기를 신청하면 순서대로 참가를 확인할 수 있어요.'}</p>}
    {value.waitingCount > 0 && <details><summary>대기 순서 보기</summary><ol>{value.waitingIds.map(id => <li key={id}>
      <span>{memberName(state, id, groupId, activityId)}{id === userId ? ' · 나' : ''}</span>
      {value.writable && value.offeredIds.includes(id) && <small>참가 확인 차례</small>}
    </li>)}</ol></details>}
    <div className="activity-waitlist__actions">
      {value.canJoinWaitlist && <button type="button" onClick={() => onWaitlist(true)}>대기 신청</button>}
      {value.waitingPosition !== undefined && value.writable && <button type="button" onClick={() => onWaitlist(false)}>대기 취소</button>}
      {value.seatOffered && <button type="button" className="tg-primary" onClick={onConfirm}><Check size={16}/>확인하고 참가</button>}
    </div>
  </section>;
}

export function ActivityRepeatPanel({ state, userId, groupId, activityId, onCreate }: ScopeProps & {
  onCreate: (preview: ActivityRepeatPreview) => boolean;
}) {
  const value = selectActivityParticipation(state, userId, groupId, activityId);
  const [intervalDays, setIntervalDays] = useState<ActivityRepeatRule['intervalDays']>(7);
  const [count, setCount] = useState(4);
  const [preview, setPreview] = useState<ActivityRepeatPreview | null>(null);
  const [checked, setChecked] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(0);
  if (!value?.canRepeat) return <p>담당자가 날짜가 있는 하루 약속에서 반복 일정을 만들 수 있어요.</p>;
  const reset = () => { setPreview(null); setChecked(false); setError(''); setDone(0); };
  const showPreview = () => {
    try { setPreview(previewActivityRepeats(state, userId, groupId, activityId, { intervalDays, count })); setError(''); setDone(0); setChecked(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '반복할 날짜를 확인해 주세요.'); }
  };
  return <div className="activity-repeat">
    <p>이 약속의 제목·장소·설명을 사용해 다음 회차를 만들어요. 회차마다 참가 여부를 따로 선택해요.</p>
    <div className="activity-repeat__fields">
      <label>반복 간격<select value={intervalDays} onChange={event => { reset(); setIntervalDays(Number(event.target.value) as ActivityRepeatRule['intervalDays']); }}>
        <option value={7}>매주</option><option value={14}>2주마다</option><option value={28}>4주마다</option>
      </select></label>
      <label>추가할 회차<select value={count} onChange={event => { reset(); setCount(Number(event.target.value)); }}>
        {Array.from({ length: 7 }, (_, index) => index + 2).map(item => <option key={item} value={item}>{item}회 추가</option>)}
      </select></label>
    </div>
    <button type="button" onClick={showPreview}><CalendarPlus size={17}/>추가할 날짜 확인</button>
    {preview && <section className="activity-repeat__preview"><h3>추가할 약속 {preview.dates.length}개</h3>
      <ol>{preview.dates.map((day, index) => <li key={day.date}><span>{index + 1}회차</span><time dateTime={day.date}>{day.date.replaceAll('-', '. ')}</time></li>)}</ol>
      <label className="activity-repeat__check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/><span>날짜를 확인했고, 각 회차의 참가 여부는 따로 받을게요.</span></label>
      <button type="button" className="tg-primary" disabled={!checked || done > 0} onClick={() => {
        if (onCreate(preview)) { setDone(preview.count); setError(''); }
        else setError('저장하지 못했어요. 원래 약속이 바뀌었다면 날짜를 다시 확인해 주세요.');
      }}>확인하고 {preview.dates.length}개 약속 만들기</button>
    </section>}
    {done > 0 && <p role="status">{done}개 약속을 만들었어요. 모임의 약속 목록에서 확인할 수 있어요.</p>}
    {error && <p role="alert" className="tg-error">{error}</p>}
  </div>;
}
