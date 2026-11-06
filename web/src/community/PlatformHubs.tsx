import { useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Clock3, MapPin, Plus, Trash2, Users } from 'lucide-react';
import type { Journey, Place } from '../data';
import { ScreenHeader, ScreenTabs } from '../ScreenHeader';
import { AppMenuButton } from '../AppMenu';
import { BottomSheet } from '../BottomSheet';
import type { TogetherState, TogetherActivity } from '../together/model';
import { appointmentRequests, memberAppointments, personalPlansForRange, type AppointmentInput, type AppointmentRange } from './platformModel';
import { selectAppointmentPlace } from './appointmentPlaceSelection';
import './platform-hubs.css';

interface HubProps {
  state: TogetherState;
  userId: string;
  plans: Journey[];
  onActivity: (id: string) => void;
  onPlan: (id: string) => void;
  onLogin: () => void;
  onInvites: () => void;
}

function DateTile({ date }: { date: string }) {
  return <span className="platform-date">{date ? <><small>{new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'short', weekday: 'short', timeZone: 'Asia/Seoul' })}</small><strong>{Number(date.slice(8, 10))}</strong></> : <><CalendarDays size={22}/><small>날짜 미정</small></>}</span>;
}

function ActivityRow({ activity, state, onOpen }: { activity: TogetherActivity; state: TogetherState; onOpen: () => void }) {
  const group = state.groups.find(item => item.id === activity.groupId);
  const travel = activity.kind === 'TRIP' || !activity.kind && Boolean(activity.journey);
  return <button type="button" className="platform-activity-row" onClick={onOpen}>
    <DateTile date={activity.date}/><span className="platform-row-copy"><strong>{activity.title}</strong>
      <span>{[activity.startTime, activity.meetingPoint || (travel ? activity.journey?.region : '')].filter(Boolean).join(' · ') || '시간·장소를 함께 정해요'}</span>
      <small>{group?.spaceType === 'ACTIVITY' ? '친구·가족 약속' : group?.name}{travel && ' · 여행'}{activity.status === 'CANCELLED' ? ' · 취소됨' : activity.status === 'COMPLETED' ? ' · 완료' : ''}</small>
    </span><ChevronRight size={18}/>
  </button>;
}

function PlanRow({ plan, onOpen }: { plan: Journey; onOpen: () => void }) {
  return <button type="button" className="platform-activity-row" onClick={onOpen}><DateTile date={plan.startDate || plan.days.find(day => day.date)?.date || ''}/>
    <span className="platform-row-copy"><strong>{plan.title}</strong><span>{plan.region || '지역 미정'} · {plan.duration || `${plan.days.length}일`}</span><small>개인 여행 · {plan.planStage === 'DRAFT' ? '작성 중' : '비공개 일정'}</small></span><ChevronRight size={18}/></button>;
}

export function AppointmentsHub({ state, userId, plans, onActivity, onPlan, onLogin, onInvites, onCreate, onCreateTrip, onExplore, range: suppliedRange, onRangeChange }: HubProps & { onCreate: () => void; onCreateTrip: () => void; onExplore?: () => void; range?: AppointmentRange; onRangeChange?: (range: AppointmentRange) => void }) {
  const [localRange, setLocalRange] = useState<AppointmentRange>('upcoming');
  const range = suppliedRange ?? localRange;
  const setRange = (next: AppointmentRange) => { setLocalRange(next); onRangeChange?.(next); };
  const activities = memberAppointments(state, userId, range);
  const personal = personalPlansForRange(plans, range);
  const requests = appointmentRequests(state, userId);
  return <div className="platform-hub"><ScreenHeader title="약속" actions={<><button type="button" aria-label="새 약속 만들기" onClick={onCreate}><Plus size={23}/></button><AppMenuButton/></>}/>
    <ScreenTabs label="약속 시기" idPrefix="appointments" value={range} onChange={value => setRange(value as AppointmentRange)} items={[{ id: 'upcoming', label: '다가오는 약속' }, { id: 'undated', label: '날짜 미정' }, { id: 'past', label: '지난 약속' }]}/>
    <div className="platform-hub-body">
      {userId && <button type="button" className="platform-invitation" onClick={onInvites}><Users size={20}/><span><strong>초대 확인</strong><small>초대 링크와 가입 신청 상태를 확인해요</small></span><ChevronRight size={18}/></button>}
      {requests > 0 && <p className="platform-hint" role="status">참석 여부를 아직 고르지 않은 약속이 {requests}개 있어요.</p>}
      <div className="platform-section-heading"><h2>{range === 'past' ? '함께한 약속' : range === 'undated' ? '함께 정할 약속' : '함께할 약속'}</h2></div>
      {!userId ? <div className="platform-empty"><Users size={27}/><h3>초대받고 함께 준비해요</h3><p>로그인하면 친구·가족·모임의 약속을 모아 볼 수 있어요.</p><button type="button" className="primary" onClick={onLogin}>로그인</button>{onExplore && <button type="button" className="outline" onClick={onExplore}>주변 모임·약속 둘러보기</button>}</div> : activities.length ? <div className="platform-row-list">{activities.map(activity => <ActivityRow key={activity.id} activity={activity} state={state} onOpen={() => onActivity(activity.id)}/>)}</div> : <div className="platform-empty"><CalendarDays size={27}/><h3>{range === 'past' ? '지난 약속이 없어요' : range === 'undated' ? '날짜를 정할 약속이 없어요' : '다음 만남을 잡아볼까요?'}</h3><p>{range === 'past' ? '함께한 약속의 사진과 이야기가 여기에 남아요.' : '식사·카페·산책처럼 짧은 약속부터 시작해요.'}</p>{range !== 'past' && <button type="button" className="outline" onClick={onCreate}>약속 만들기</button>}</div>}
      <details className="platform-device-plans" open={Boolean(userId)}><summary>이 기기의 개인 여행</summary><p className="platform-hint">이 기기에 저장한 일정이며, 계정의 여행과 자동으로 합쳐지지 않아요.</p>
      <div className="platform-section-heading"><h2>개인 여행 일정</h2><button type="button" onClick={onCreateTrip}>여행 만들기<Plus size={16}/></button></div>
      {personal.length ? <div className="platform-row-list">{personal.map(plan => <PlanRow key={plan.id} plan={plan} onOpen={() => onPlan(plan.id)}/>)}</div> : <p className="platform-hint">{range === 'past' ? '지난 개인 여행이 없어요.' : '저장한 장소로 혼자 또는 가족과 갈 여행을 만들 수 있어요.'}</p>}
      </details>
    </div>
  </div>;
}

export function RecordsHub({ state, userId, plans, journals, onActivity, onPlan, onLogin, onInvites, onTrash, onJournal, onPersonalLibrary, section: suppliedSection, onSectionChange }: HubProps & { journals: Journey[]; onTrash: () => void; onJournal: (id: string) => void; onPersonalLibrary: () => void; section?: string; onSectionChange?: (section: string) => void }) {
  const [localSection, setLocalSection] = useState('activities');
  const section = suppliedSection ?? localSection;
  const setSection = (next: string) => { setLocalSection(next); onSectionChange?.(next); };
  const activities = memberAppointments(state, userId, 'past');
  const personal = personalPlansForRange(plans, 'past');
  return <div className="platform-hub"><ScreenHeader title="내 기록" actions={<AppMenuButton/>}/><ScreenTabs label="기록 종류" idPrefix="records" value={section} onChange={setSection} items={[{ id: 'activities', label: '지난 약속' }, { id: 'journals', label: '여행기·후기' }]}/>
    <div className="platform-hub-body">{section === 'activities' ? <>
      {activities.length > 0 && <><div className="platform-section-heading"><h2>함께한 시간</h2></div>{activities.map(activity => <ActivityRow key={activity.id} activity={activity} state={state} onOpen={() => onActivity(activity.id)}/>)}</>}
      {userId && personal.length > 0 && <><div className="platform-section-heading"><h2>이 기기의 지난 개인 여행</h2></div>{personal.map(plan => <PlanRow key={plan.id} plan={plan} onOpen={() => onPlan(plan.id)}/>)}</>}
      {!activities.length && (!userId || !personal.length) && <div className="platform-empty"><Clock3 size={27}/><h3>함께한 시간이 기록이 돼요</h3><p>지난 약속과 개인 여행을 여기에서 다시 열 수 있어요.</p>{!userId && <button type="button" className="outline" onClick={onLogin}>로그인하고 약속 보기</button>}</div>}
    </> : !userId ? <div className="platform-empty"><BookOpen size={27}/><h3>이 기기의 기록은 따로 보관해요</h3><p>아래 보관함에서 직접 열어 볼 수 있어요. 로그인해도 계정 기록으로 자동 편입되지 않아요.</p></div> : journals.length ? <><p className="platform-hint">이 기기에 저장한 여행기·후기예요.</p>{journals.filter(journal => journal.isMine && !journal.trash && journal.purpose !== 'PLAN').map(journal => <button type="button" className="platform-journal-row" key={journal.id} onClick={() => onJournal(journal.id)}><BookOpen size={24}/><span className="platform-row-copy"><strong>{journal.title}</strong><small>{journal.region} · {journal.visibility === 'PUBLIC' ? '공개' : '비공개'} · {journal.days.length} DAY</small></span><ChevronRight size={18}/></button>)}</> : <div className="platform-empty"><BookOpen size={27}/><h3>아직 작성한 여행기가 없어요</h3><p>일정을 연 뒤 기록할 내용을 골라 여행기를 남겨보세요.</p><button type="button" className="outline" onClick={onPersonalLibrary}>개인 여행 보기</button></div>}
      <button type="button" className="platform-library-link" onClick={onPersonalLibrary}>이 기기의 여행·여행기 보관함<ArrowRight size={16}/></button>
      <footer className="platform-record-footer"><button type="button" onClick={onTrash}><Trash2 size={16}/>기기 휴지통</button>{userId && <button type="button" onClick={onInvites}>초대 관리</button>}</footer>
    </div></div>;
}

export function CreateAppointmentSheet({ places, initial, onChange, onClose, onCreate }: { places: Place[]; initial: AppointmentInput; onChange: (next: AppointmentInput) => void; onClose: () => void; onCreate: (input: AppointmentInput) => boolean }) {
  const [error, setError] = useState('');
  const update = (patch: Partial<AppointmentInput>) => { onChange({ ...initial, ...patch }); setError(''); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!initial.title.trim()) { setError('약속 이름을 적어 주세요.'); return; } if (!onCreate(initial)) setError('저장하지 못했어요. 입력 내용을 유지하고 있어요.'); };
  return <BottomSheet title="약속 만들기" onClose={onClose}><form className="platform-create" onSubmit={submit}>
    <label>무엇을 함께할까요?<input value={initial.title} maxLength={100} required autoFocus placeholder="금요일 저녁, 가족 나들이" onChange={event => update({ title: event.target.value })}/></label>
    <div className="platform-create-pair"><label>날짜 · 나중에 정해도 돼요<input type="date" value={initial.date} onChange={event => update({ date: event.target.value, ...(event.target.value ? {} : { startTime: '' }) })}/></label><label>시작 시간<input type="time" value={initial.startTime || ''} disabled={!initial.date} onChange={event => update({ startTime: event.target.value })}/></label></div>
    <label>누구와 만날까요?<select value={initial.kind || 'FRIENDS'} onChange={event => update({ kind: event.target.value as 'FRIENDS' | 'FAMILY' })}><option value="FRIENDS">친구·지인</option><option value="FAMILY">가족</option></select></label>
    <details open={Boolean(initial.placeId)}><summary>장소·설명 추가</summary><div className="platform-create-extra"><label>내가 저장한 장소<select value={initial.placeId || ''} onChange={event => update(selectAppointmentPlace(initial, event.target.value, places))}><option value="">나중에 함께 정하기</option>{places.map(place => <option key={place.id} value={place.id}>{place.name} · {place.area}</option>)}</select></label><label>만나는 곳<input value={initial.meetingPoint || ''} maxLength={300} placeholder="역 출구, 카페 이름" onChange={event => update({ meetingPoint: event.target.value })}/></label><label>안내<textarea value={initial.description || ''} maxLength={2000} rows={3} onChange={event => update({ description: event.target.value })}/></label></div></details>
    {error && <p className="platform-form-error" role="alert">{error}</p>}<p className="platform-hint">비공개 약속으로 만들고, 안내를 확인한 뒤 친구를 초대해요.</p><button type="submit" className="primary wide">약속 만들기</button>
  </form></BottomSheet>;
}
