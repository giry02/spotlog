import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Place } from '../data';
import { memberName, togetherId, type GroupTopic, type TogetherState } from './model';
import { topicOptions } from './discovery';
import { selectAssistantPlaces, type ActivityAssistantAction } from './activityAssistant';
import type { CreationBrief } from './creationPlanner';
import { buildDatePollDraft, buildDepartureChecklist, buildNextActivityBrief, buildPlanningFeedback, comparePlanningPlaces, getPlanningSupportContext, planningToday, type Availability, type DatePollDraft, type PlanningDateCandidate } from './planningSupport';
import './planning-support.css';

export interface PlanningSupportProps {
  state: TogetherState; userId: string; groupId: string; activityId?: string; places: Place[];
  initialTool?: PlanningSupportTool;
  onApply: (action: ActivityAssistantAction) => boolean | Promise<boolean>;
  onPlan: (initial: Partial<CreationBrief>) => void;
  onPoll?: (question: string, options: string[], expectedRevision?: number) => boolean | Promise<boolean>;
  onFeedback?: (body: string) => boolean | Promise<boolean>;
}
export type PlanningSupportTool = 'places' | 'dates' | 'departure' | 'next';
type Tool = PlanningSupportTool;
const tools: Array<{ id: Tool; label: string }> = [{ id: 'places', label: '장소 투표' }, { id: 'dates', label: '날짜 투표' }, { id: 'departure', label: '준비 확인' }, { id: 'next', label: '다음 계획' }];
const availabilityNames: Record<Availability, string> = { YES: '가능해요', MAYBE: '아직 몰라요', NO: '어려워요' };
const checkNames = { MATCH: '조건 충족', CONFLICT: '조건 초과', UNKNOWN: '확인 필요' };
const kindNames = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const numberInput = (value: string) => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
const emptyDate = (): PlanningDateCandidate => ({ id: togetherId('date-candidate'), date: '', time: '', availability: 'MAYBE' });

export default function PlanningSupportPanel(props: PlanningSupportProps) {
  return <PlanningSupportBody key={`${props.userId}:${props.groupId}:${props.activityId ?? 'group'}:${props.initialTool || 'places'}`} {...props}/>;
}

function PlanningSupportBody({ state, userId, groupId, activityId, places, initialTool = 'places', onApply, onPlan, onPoll, onFeedback }: PlanningSupportProps) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [selected, setSelected] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [walking, setWalking] = useState('');
  const [evidence, setEvidence] = useState<Record<string, { cost: string; walk: string }>>({});
  const [question, setQuestion] = useState('어디에서 함께할까요?');
  const [dateQuestion, setDateQuestion] = useState('함께할 날짜를 골라 주세요');
  const [dates, setDates] = useState<PlanningDateCandidate[]>(() => [emptyDate(), emptyDate()]);
  const [dateDraft, setDateDraft] = useState<DatePollDraft | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [takeTask, setTakeTask] = useState(false);
  const [weatherNote, setWeatherNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [wish, setWish] = useState('');
  const [nextRegion, setNextRegion] = useState(() => state.groups.find(item => item.id === groupId)?.region ?? '');
  const [purpose, setPurpose] = useState<CreationBrief['purpose']>('MEETUP');
  const [theme] = useState<CreationBrief['theme']>('OTHER');
  const [topics, setTopics] = useState<GroupTopic[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [reviewedRevision, setReviewedRevision] = useState(() => state.activities.find(item => item.id === activityId && item.groupId === groupId)?.revision);
  const scope = { groupId, activityId };
  let context: ReturnType<typeof getPlanningSupportContext>;
  try { context = getPlanningSupportContext(state, userId, scope); }
  catch (cause) { return <section className="planning-support"><p role="alert">{cause instanceof Error ? cause.message : '현재 모임을 다시 확인해 주세요.'}</p></section>; }
  const { group, activity, canWrite, canPlanNext } = context;
  const stale = activity?.revision !== reviewedRevision;
  const disabled = busy || !canWrite || stale;
  const sharedPlaces = selectAssistantPlaces(state, userId, scope, places);
  const invalidSelection = selected.some(id => !sharedPlaces.some(place => place.id === id));
  const compareRows = invalidSelection ? [] : comparePlanningPlaces(state, userId, scope, places, selected, { budgetCap: numberInput(budget), walkingLimit: numberInput(walking) }, Object.entries(evidence).map(([placeId, value]) => ({ placeId, costPerPerson: numberInput(value.cost), walkingMinutes: numberInput(value.walk) })));
  const departure = buildDepartureChecklist(state, userId, scope);
  const taskSuggestions = departure.checks.flatMap(item => item.taskTitle ? [item.taskTitle] : []);
  const base = () => ({ ...scope, id: togetherId('planning'), expectedRevision: reviewedRevision });
  const run = async (callback: () => boolean | Promise<boolean>, success: string, done?: () => void) => {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try { if (await callback()) { setStatus(success); done?.(); } else setError('저장하지 못했어요. 입력을 유지했으니 다시 확인해 주세요.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '처리하지 못했어요. 잠시 후 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const changeDate = (id: string, changes: Partial<PlanningDateCandidate>) => { setDates(current => current.map(row => row.id === id ? { ...row, ...changes } : row)); setDateDraft(null); setStatus(''); };
  const nextInput = () => ({ region: nextRegion, previousTitle: activity?.title, feedback, wish, purpose, theme, topics });

  return <section className="planning-support">
    <div className="planning-support-tabs" role="tablist" aria-label="약속 도우미 도구">{tools.map(item => <button type="button" role="tab" key={item.id} aria-selected={tool === item.id} aria-controls={`planning-${item.id}`} id={`planning-tab-${item.id}`} onClick={() => { setTool(item.id); setStatus(''); setError(''); }}>{item.label}</button>)}</div>
    {stale && <div className="planning-support-update" role="status"><p>약속이 수정됐어요. 현재 날짜·장소·예약을 확인한 뒤 이어가 주세요.</p><button type="button" disabled={busy} onClick={() => { setReviewedRevision(activity?.revision); setDateDraft(null); setStatus('현재 내용을 기준으로 다시 확인했어요.'); }}>최신 내용으로 다시 확인</button></div>}
    {!canWrite && <p className="planning-support-note">{group.archived ? '보관한 모임은 읽기만 가능해요.' : activity?.status === 'CANCELLED' ? '취소한 약속은 읽기만 가능해요.' : '지난 약속은 내용을 확인하고 다음 활동으로 이어갈 수 있어요.'}</p>}

    {tool === 'places' && <div className="planning-support-body" role="tabpanel" id="planning-places" aria-labelledby="planning-tab-places">
      <header><h3>공유한 장소를 함께 골라요</h3><p>비교 후 후보 투표를 만들어요. 투표만으로 일정·예약·참석이 바뀌지는 않아요.</p></header>
      <div className="planning-support-two"><label>1인 예산 상한 · 원<input type="number" min="0" inputMode="numeric" value={budget} onChange={event => setBudget(event.target.value)} placeholder="선택"/></label><label>걷기 상한 · 분<input type="number" min="0" inputMode="numeric" value={walking} onChange={event => setWalking(event.target.value)} placeholder="선택"/></label></div>
      {sharedPlaces.length ? <div className="planning-support-options">{sharedPlaces.map(place => <label className="planning-support-check" key={place.id}><input type="checkbox" checked={selected.includes(place.id)} disabled={busy || (!selected.includes(place.id) && selected.length >= 8)} onChange={() => setSelected(current => current.includes(place.id) ? current.filter(id => id !== place.id) : [...current, place.id])}/><span><strong>{place.name}</strong><small>{kindNames[place.kind]} · {place.address || place.area}</small></span></label>)}</div> : <p className="planning-support-empty">모임의 공동 관심 장소에 음식점·카페·명소 등을 먼저 공유해 주세요. 개인 저장 목록은 자동으로 가져오지 않아요.</p>}
      {invalidSelection && <p role="alert">선택한 장소의 공유나 공개 상태가 바뀌었어요. <button type="button" onClick={() => setSelected(current => current.filter(id => sharedPlaces.some(place => place.id === id)))}>현재 후보로 다시 확인</button></p>}
      {compareRows.length > 0 && <details className="planning-support-details"><summary>비용·걷기 비교 · {compareRows.length}곳</summary><small>확인한 값만 직접 적어 주세요. 거리에서 걷기 시간이나 비용을 추정하지 않아요.</small>{compareRows.map(({ place, checks }) => { const value = evidence[place.id] ?? { cost: '', walk: '' }; return <div className="planning-support-evidence" key={place.id}><strong>{place.name}</strong><div className="planning-support-two"><label>확인한 비용 · 원<input type="number" min="0" inputMode="numeric" aria-label={`${place.name} 확인한 비용`} value={value.cost} onChange={event => setEvidence(current => ({ ...current, [place.id]: { ...value, cost: event.target.value } }))}/></label><label>확인한 걷기 · 분<input type="number" min="0" inputMode="numeric" aria-label={`${place.name} 확인한 걷기 시간`} value={value.walk} onChange={event => setEvidence(current => ({ ...current, [place.id]: { ...value, walk: event.target.value } }))}/></label></div><p>예산: {checkNames[checks.budget]} · 걷기: {checkNames[checks.walking]}</p></div>; })}</details>}
      <label>투표 제목<input value={question} maxLength={160} onChange={event => setQuestion(event.target.value)}/></label>
      <button type="button" className="planning-support-primary" disabled={disabled || invalidSelection || selected.length < 2 || !question.trim()} onClick={() => void run(() => onApply({ ...base(), type: 'CREATE_POLL', question, placeIds: selected }), '대화에 장소 투표를 올렸어요.')}>이 대화방에 장소 투표 올리기 · {selected.length}곳</button>
    </div>}

    {tool === 'dates' && <div className="planning-support-body" role="tabpanel" id="planning-dates" aria-labelledby="planning-tab-dates">
      <header><h3>가능한 날짜를 물어봐요</h3><p>내가 고른 후보와 내 가능 여부만 확인해요. 다른 사람의 일정은 읽거나 대신 입력하지 않아요.</p></header>
      <label>투표 제목<input value={dateQuestion} maxLength={160} onChange={event => { setDateQuestion(event.target.value); setDateDraft(null); }}/></label>
      <div className="planning-support-date-list">{dates.map((row, index) => <div className="planning-support-date" key={row.id}><div className="planning-support-between"><strong>후보 {index + 1}</strong><button className="planning-support-icon" type="button" aria-label={`날짜 후보 ${index + 1} 삭제`} disabled={busy || dates.length <= 2} onClick={() => { setDates(current => current.filter(item => item.id !== row.id)); setDateDraft(null); }}><Trash2 size={17} aria-hidden="true"/></button></div><div className="planning-support-two"><label>날짜<input type="date" min={planningToday()} aria-label={`후보 ${index + 1} 날짜`} value={row.date} onInput={event => changeDate(row.id, { date: event.currentTarget.value })} onChange={event => changeDate(row.id, { date: event.target.value })}/></label><label>시각 · 선택<input type="time" aria-label={`후보 ${index + 1} 시각`} value={row.time} onInput={event => changeDate(row.id, { time: event.currentTarget.value })} onChange={event => changeDate(row.id, { time: event.target.value })}/></label></div><label>내 가능 여부<select value={row.availability} aria-label={`후보 ${index + 1} 내 가능 여부`} onChange={event => changeDate(row.id, { availability: event.target.value as Availability })}>{Object.entries(availabilityNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>)}</div>
      <button type="button" disabled={busy || dates.length >= 8} onClick={() => { setDates(current => [...current, emptyDate()]); setDateDraft(null); }}><Plus size={16} aria-hidden="true"/>후보 날짜 추가</button>
      <button type="button" disabled={busy} onClick={() => { try { setDateDraft(buildDatePollDraft(dates, dateQuestion)); setError(''); setStatus(''); } catch (cause) { setDateDraft(null); setError(cause instanceof Error ? cause.message : '후보 날짜를 확인해 주세요.'); } }}>후보 확인</button>
      {dateDraft && <div className="planning-support-preview"><h3>날짜 투표 미리보기</h3><p>내 선택: 가능 {dateDraft.availabilityCounts.YES}개 · 미정 {dateDraft.availabilityCounts.MAYBE}개 · 어려움 {dateDraft.availabilityCounts.NO}개</p><ul>{dateDraft.options.map(option => <li key={option}>{option}</li>)}</ul><small>내 가능 여부는 이 화면의 비교용이에요. 투표에는 날짜 후보만 등록하고 각자 직접 응답해요. 일정과 참석은 자동 확정하지 않아요.</small><button type="button" className="planning-support-primary" disabled={disabled || !onPoll} onClick={() => void run(() => onPoll ? onPoll(dateDraft.question, dateDraft.options, reviewedRevision) : false, '날짜 투표를 만들었어요. 응답 결과를 확인한 뒤 일정을 직접 정해 주세요.', () => setDateDraft(null))}>이 대화방에 날짜 투표 올리기</button></div>}
    </div>}

    {tool === 'departure' && <div className="planning-support-body" role="tabpanel" id="planning-departure" aria-labelledby="planning-tab-departure">
      <header><h3>함께 준비할 일을 확인해요</h3><p>{activity ? '이 약속에 저장된 일정과 준비 항목이에요. 예약 고정은 예약 완료를 뜻하지 않아요.' : '모임 전체가 함께 준비할 일이에요. 개별 약속의 준비는 해당 대화방에서 확인해요.'}</p></header>
      {activity && <dl className="planning-support-facts">{departure.checks.map(item => <div key={item.id}><dt>{item.label}</dt><dd>{item.value}<small>{item.state === 'MISSING' ? '확인 필요' : item.state === 'FIXED' ? '일정 변경 시 보호되는 방문' : '현재 등록 내용'}</small></dd></div>)}</dl>}
      <div><h3>아직 준비 중 · {departure.tasks.length}개</h3>{departure.tasks.length ? <ul className="planning-support-task-list">{departure.tasks.map(task => <li key={task.id}><span>{task.title}</span><small>{task.assigneeId ? memberName(state, task.assigneeId) : '담당 미정'}{task.dueDate ? ` · ${task.dueDate}까지` : ''}</small></li>)}</ul> : <p className="planning-support-note">등록된 미완료 준비 항목이 없어요.</p>}</div>
      <details className="planning-support-details"><summary>날씨 대비·대안 직접 확인</summary><p>실시간 날씨는 연결 전이에요. 직접 확인한 예보와 실내 대안 등을 적어 두고 준비할 일로 등록할 수 있어요.</p><label>직접 확인한 내용<textarea value={weatherNote} maxLength={500} onChange={event => setWeatherNote(event.target.value)} placeholder="예: 출발 전 예보를 확인하고 비가 오면 실내 대안을 함께 정하기"/></label><button type="button" disabled={!weatherNote.trim() || busy} onClick={() => setTaskTitle(weatherNote.trim().slice(0, 200))}>준비할 일에 옮기기</button></details>
      {taskSuggestions.length > 0 && <label>빠진 내용에서 고르기<select aria-label="빠진 내용에서 고르기" value="" onChange={event => { if (event.target.value) setTaskTitle(event.target.value); }}><option value="">준비할 일 직접 선택</option>{[...new Set(taskSuggestions)].map(title => <option key={title} value={title}>{title}</option>)}</select></label>}
      <label>준비할 일<input value={taskTitle} maxLength={200} onChange={event => setTaskTitle(event.target.value)} placeholder="예: 식당 영업 시간과 예약 조건 확인"/></label><label className="planning-support-check"><input type="checkbox" checked={takeTask} onChange={event => setTakeTask(event.target.checked)}/><span>제가 맡을게요<small>선택하지 않으면 담당 미정으로 등록해요.</small></span></label>
      <button type="button" className="planning-support-primary" disabled={disabled || !taskTitle.trim()} onClick={() => void run(() => onApply({ ...base(), type: 'CREATE_TASK', title: taskTitle, sourceMessageIds: [], sourceVersions: {}, assignee: takeTask ? 'SELF' : 'UNASSIGNED' }), '대화에 준비할 일을 올렸어요.', () => { setTaskTitle(''); setTakeTask(false); })}>이 대화방에 준비할 일 올리기</button>
    </div>}

    {tool === 'next' && <div className="planning-support-body" role="tabpanel" id="planning-next" aria-labelledby="planning-tab-next">
      <header><h3>우리 의견으로 다음 활동을 만들어요</h3><p>직접 남긴 후기와 다음 희망만 새 초안에 전달해요. 예전 예약·참석·개인 메모를 복사하지 않아요.</p></header>
      <label>이번에는 어땠나요? · 선택<textarea maxLength={500} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="예: 식사는 좋았지만 걷는 구간은 길었어요."/></label>
      <label>다음에 하고 싶은 일<textarea maxLength={500} value={wish} onChange={event => setWish(event.target.value)} placeholder="예: 부산에서 덜 걷는 카페와 실내 전시를 가고 싶어요."/></label>
      <label>다음 활동 지역<input maxLength={80} value={nextRegion} onChange={event => setNextRegion(event.target.value)} placeholder="모임 지역과 다른 여행지도 가능해요"/></label>
      <label>일정 형태<select aria-label="일정 형태" value={purpose === 'TRIP' ? 'TRIP' : 'MEETUP'} onChange={event => setPurpose(event.target.value as CreationBrief['purpose'])}><option value="MEETUP">하루 약속·활동</option><option value="TRIP">여러 DAY 여행</option></select></label>
      <details className="planning-support-details"><summary>관심 활동 선택 · {topics.length ? `${topics.length}개` : '선택 사항'}</summary><div className="tg-tags">{topicOptions.map(topic => <button type="button" className="tg-topic-choice" key={topic.id} aria-pressed={topics.includes(topic.id)} onClick={() => setTopics(current => current.includes(topic.id) ? current.filter(id => id !== topic.id) : [...current, topic.id])}><span aria-hidden="true">{topic.emoji}</span>{topic.label}</button>)}</div></details>
      <button type="button" className="planning-support-primary" disabled={busy || !canPlanNext || stale || !wish.trim()} onClick={() => { try { const initial = buildNextActivityBrief(nextInput()); setError(''); onPlan(initial); } catch (cause) { setError(cause instanceof Error ? cause.message : '다음 희망을 확인해 주세요.'); } }}>이 의견으로 다음 활동 초안 만들기</button>
      {onFeedback && <details className="planning-support-details"><summary>후기를 모임에 공유하기</summary><p>작성한 후기를 이 모임 게시판에 남겨요. 입력만으로 저장하거나 개인 기록을 가져오지는 않아요.</p><button type="button" disabled={busy || !canPlanNext || stale || !feedback.trim()} onClick={() => { try { const body = buildPlanningFeedback(nextInput()); void run(() => onFeedback(body), '후기를 모임 게시판에 남겼어요.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '후기를 확인해 주세요.'); } }}><Check size={16} aria-hidden="true"/>작성한 후기 공유</button></details>}
    </div>}
    {error && <p className="planning-support-error" role="alert">{error}</p>}{status && <p className="planning-support-status" role="status">{status}</p>}
  </section>;
}
