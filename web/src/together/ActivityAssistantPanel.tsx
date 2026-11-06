import { useState } from 'react';
import type { Place } from '../data';
import { canEditActivity, memberName, togetherId, type TogetherState } from './model';
import { activityAssistantFeatures, compareAssistantConditions, compareAssistantTime, getAssistantContext, prepareAssistantRequest, selectAssistantMessages, selectAssistantPlaces, unconnectedAssistantResponse, type ActivityAssistantAction, type ActivityAssistantFeature, type ActivityAssistantRequestV1 } from './activityAssistant';
import './activity-assistant.css';

export interface ActivityAssistantProps {
  state: TogetherState;
  userId: string;
  groupId: string;
  activityId?: string;
  places: Place[];
  onApply: (action: ActivityAssistantAction) => boolean | Promise<boolean>;
  onSource?: (roomId: string, messageId: string) => void;
  lockScope?: boolean;
  features?: ActivityAssistantFeature[];
}
export default function ActivityAssistant(props: ActivityAssistantProps) {
  return <AssistantBody key={`${props.userId}:${props.groupId}:${props.activityId ?? 'group'}`} {...props} />;
}
const amount = (value: string) => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
const checkLabel = { MATCH: '충족', CONFLICT: '충돌', UNKNOWN: '정보 없음' };

function AssistantBody({ state, userId, groupId, activityId: initialActivityId, places, onApply, onSource, lockScope, features }: ActivityAssistantProps) {
  const visibleFeatures = features?.length ? activityAssistantFeatures.filter(item => features.includes(item.id)) : activityAssistantFeatures;
  const [feature, setFeature] = useState<ActivityAssistantFeature>(visibleFeatures[0]?.id || 'places');
  const [activityId, setActivityId] = useState(initialActivityId ?? '');
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedSourceVersions, setSelectedSourceVersions] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState('어디에서 만날까요?');
  const [taskTitle, setTaskTitle] = useState('');
  const [takeTask, setTakeTask] = useState(false);
  const [budget, setBudget] = useState('');
  const [walking, setWalking] = useState('');
  const [evidence, setEvidence] = useState<Record<string, { cost: string; walk: string }>>({});
  const [proposedTime, setProposedTime] = useState('');
  const [comparison, setComparison] = useState<ReturnType<typeof compareAssistantTime> | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [locale, setLocale] = useState('en');
  const [timeZone, setTimeZone] = useState('Asia/Seoul');
  const [instruction, setInstruction] = useState('');
  const [request, setRequest] = useState<ActivityAssistantRequestV1 | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const scope = { groupId, activityId: activityId || undefined };
  let context: ReturnType<typeof getAssistantContext>;
  try { context = getAssistantContext(state, userId, scope); }
  catch (cause) { return <div className="activity-assistant"><p role="alert">{cause instanceof Error ? cause.message : '이 공간을 볼 수 없어요.'}</p></div>; }
  const { group, activity, roomId } = context;
  const candidates = selectAssistantPlaces(state, userId, scope, places);
  const sources = selectAssistantMessages(state, userId, scope);
  const canWrite = !group.archived && activity?.status !== 'CANCELLED' && activity?.status !== 'COMPLETED';
  const base = () => ({ ...scope, id: togetherId('assistant'), expectedRevision: activity?.revision });
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  const apply = async (action: ActivityAssistantAction) => {
    setError(''); setStatus(''); setBusy(true);
    try {
      if (await onApply(action)) { setStatus(action.type === 'UPDATE_ACTIVITY_TIME' ? '약속 시간을 반영했어요. 참석과 예약은 그대로예요.' : action.type === 'CREATE_ACTIVITY_DRAFT' ? '날짜 미정의 새 약속을 만들었어요. 약속 목록에서 이어서 정해 주세요.' : action.type === 'CREATE_POLL' ? '후보 투표를 만들었어요. 투표 결과가 일정에 자동 적용되지는 않아요.' : '준비 항목을 등록했어요.'); if (action.type === 'CREATE_TASK') { setTaskTitle(''); setSelectedSources([]); setTakeTask(false); } }
      else setError('반영하지 못했어요. 입력은 유지했으니 다시 확인해 주세요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '반영하지 못했어요.'); }
    finally { setBusy(false); }
  };
  const sourceVersions = () => Object.fromEntries(selectedSources.map(id => [id, selectedSourceVersions[id]]));
  const staleSources = selectedSources.some(id => !sources.some(item => item.id === id && item.version === selectedSourceVersions[id]));
  const prepareRequest = () => {
    try {
      const next = prepareAssistantRequest(state, userId, { ...scope, requestId: togetherId('assistant-request'), feature, activityRevision: activity?.revision, roomId,
        sourceMessageIds: selectedSources, sourceVersions: sourceVersions(), placeIds: selectedPlaces, locale, timeZone, instruction }, places);
      setRequest(next); setStatus(unconnectedAssistantResponse(next).explanation); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청 조건을 확인해 주세요.'); }
  };
  const sourcePicker = <details className="assistant-sources"><summary>근거 원문 직접 선택 · {selectedSources.length}개</summary><p>자동 해석한 결과가 아닌, 현재 방의 원문이에요. 질문과 제안을 직접 확인해 주세요.</p>{staleSources && <><p role="status">선택한 원문이 수정·삭제됐어요. 다시 선택해 주세요.</p><button type="button" onClick={() => { setSelectedSources([]); setSelectedSourceVersions({}); setRequest(null); }}>원문 선택 초기화</button></>}{sources.length ? sources.slice(0, 30).map(item => <div className="assistant-source" key={item.id}><label><input type="checkbox" checked={selectedSources.includes(item.id)} disabled={busy || (!selectedSources.includes(item.id) && selectedSources.length >= 12)} onChange={() => { setSelectedSources(current => toggle(current, item.id)); setSelectedSourceVersions(current => ({ ...current, [item.id]: item.version })); setRequest(null); }}/><span><small>{memberName(state, item.authorId)}</small><span>{item.body}</span></span></label>{onSource && <button type="button" onClick={() => onSource(roomId, item.id)}>원문 보기</button>}</div>) : <p>이 방에는 확인할 원문이 없어요. 준비할 일을 직접 입력할 수 있어요.</p>}</details>;
  const placePicker = candidates.length ? <div className="assistant-place-list">{candidates.map(place => <label className="assistant-check" key={place.id}><input type="checkbox" checked={selectedPlaces.includes(place.id)} disabled={busy || (!selectedPlaces.includes(place.id) && selectedPlaces.length >= 8)} onChange={() => setSelectedPlaces(current => toggle(current, place.id))}/><span><strong>{place.name}</strong><small>{place.area} · {place.kind === 'FOOD' ? '음식점' : place.kind === 'CAFE' ? '카페' : place.kind === 'STAY' ? '숙소' : '공유 장소'}</small></span></label>)}</div> : <p className="assistant-empty">현재 공개 자료와 연결되는 공유 장소가 없어요. 모임의 ‘공동 관심 장소’에서 먼저 공유해 주세요. 개인 관심 장소 전체를 가져오지는 않아요.</p>;
  const exactTasks = state.tasks.filter(item => item.groupId === groupId && item.activityId === scope.activityId);
  const notices = state.notices.filter(item => item.groupId === groupId && (!item.activityId || item.activityId === activity?.id));
  const changeScope = (id: string) => { setActivityId(id); setSelectedSources([]); setSelectedSourceVersions({}); setSelectedPlaces([]); setComparison(null); setRequest(null); setTaskTitle(''); setTakeTask(false); setEvidence({}); setError(''); setStatus(''); };

  return <section className="activity-assistant">
    {!lockScope && <p className="assistant-intro">공유한 자료와 직접 확인한 조건을 사용해요.</p>}
    {!initialActivityId && !lockScope && <label>어느 공간에서 정할까요?<select value={activityId} onChange={event => changeScope(event.target.value)}><option value="">{group.name} · 모임 전체</option>{state.activities.filter(item => item.groupId === groupId).map(item => <option key={item.id} value={item.id}>{item.title}{item.status === 'COMPLETED' ? ' · 지난 약속' : item.status === 'CANCELLED' ? ' · 취소' : ''}</option>)}</select></label>}
    <label>무엇을 도와드릴까요?<select value={feature} onChange={event => { setFeature(event.target.value as ActivityAssistantFeature); setError(''); setStatus(''); setRequest(null); }}>{visibleFeatures.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
    <h3>{activityAssistantFeatures.find(item => item.id === feature)?.description}</h3>
    {feature === 'places' && <><p>이 모임에 직접 공유한 장소예요. 같은 취향이라는 추정이나 인기 점수는 붙이지 않아요.</p>{placePicker}<label>투표 제목<input value={question} maxLength={160} onChange={event => setQuestion(event.target.value)}/></label><button className="assistant-primary" type="button" disabled={busy || !canWrite || selectedPlaces.length < 2 || !question.trim()} onClick={() => void apply({ ...base(), type: 'CREATE_POLL', question, placeIds: selectedPlaces })}>선택한 장소로 투표 만들기</button><small>일정 추가·참석 확정·예약은 실행하지 않아요.</small></>}
    {feature === 'conditions' && <><p>가격과 걷는 시간은 직접 확인해 입력하세요. 좌표의 직선거리를 도보 시간으로 바꾸거나 가격을 추측하지 않아요.</p><div className="assistant-two"><label>1인 예산 상한 · 원<input type="number" min="0" inputMode="numeric" value={budget} onChange={event => setBudget(event.target.value)}/></label><label>걷기 상한 · 분<input type="number" min="0" inputMode="numeric" value={walking} onChange={event => setWalking(event.target.value)}/></label></div>{candidates.length ? candidates.map(place => { const input = evidence[place.id] ?? { cost: '', walk: '' }; const result = compareAssistantConditions({ budgetCap: amount(budget), walkingLimit: amount(walking) }, { placeId: place.id, costPerPerson: amount(input.cost), walkingMinutes: amount(input.walk) }); return <div className="assistant-evidence" key={place.id}><strong>{place.name}</strong><div className="assistant-two"><label>확인한 1인 비용 · 원<input aria-label={`${place.name} 확인한 비용`} type="number" min="0" value={input.cost} onChange={event => setEvidence(current => ({ ...current, [place.id]: { ...input, cost: event.target.value } }))}/></label><label>확인한 걷기 · 분<input aria-label={`${place.name} 확인한 걷기 시간`} type="number" min="0" value={input.walk} onChange={event => setEvidence(current => ({ ...current, [place.id]: { ...input, walk: event.target.value } }))}/></label></div><p>예산: <b>{checkLabel[result.budget]}</b> · 걷기: <b>{checkLabel[result.walking]}</b></p></div>; }) : placePicker}<p>시간 조건은 ‘바뀐 점 확인’에서 현재 약속과 직접 비교할 수 있어요. 개인 캘린더는 읽지 않아요.</p><small>입력값은 이 화면의 비교용이며 장소 DB와 다른 사람의 선호를 수정하지 않아요.</small></>}
    {feature === 'changes' && (activity ? <><p>현재 저장된 날짜: {activity.date || '미정'} · 시각: {activity.startTime || '미정'}</p><label>직접 확인한 변경 제안 · 한국 시각<input type="time" value={proposedTime} onChange={event => { setProposedTime(event.target.value); setComparison(null); }}/></label>{sourcePicker}<button type="button" disabled={!proposedTime} onClick={() => { try { setComparison(compareAssistantTime(state, userId, scope, proposedTime)); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '시각을 확인해 주세요.'); } }}>현재 시간과 비교하기</button>{comparison && <><div className="assistant-diff"><div><small>현재 확정</small><strong>{comparison.current || '미정'}</strong></div><div><small>직접 입력한 제안 · 미반영</small><strong>{comparison.proposed}</strong></div></div>{comparison.revision !== activity.revision && <p role="status">약속이 바뀌었어요. 다시 비교해 주세요.</p>}<button className="assistant-primary" type="button" disabled={busy || !canWrite || !comparison.changed || comparison.revision !== activity.revision || !canEditActivity(state, userId, activity)} onClick={() => void apply({ ...base(), expectedRevision: comparison.revision, type: 'UPDATE_ACTIVITY_TIME', startTime: comparison.proposed })}>확인한 시각으로 변경</button><small>편집 권한이 있어야 반영해요. 고정 예약이 있으면 기존 일정 편집에서 먼저 확인해야 해요. 참석은 바꾸지 않아요.</small></>}</> : <p>비교할 약속을 위에서 선택해 주세요.</p>)}
    {feature === 'preparation' && <>{sourcePicker}<label>직접 확인한 준비할 일<input value={taskTitle} maxLength={200} placeholder="예: B카페 운영 시간 확인" onChange={event => setTaskTitle(event.target.value)}/></label><label className="assistant-check"><input type="checkbox" checked={takeTask} onChange={event => setTakeTask(event.target.checked)}/><span>제가 맡을게요 · 내 담당으로 등록</span></label><p>선택하지 않으면 담당 미정이에요. 다른 사람에게 부탁한 대화만으로 그 사람을 담당자로 지정하지 않아요.</p><button className="assistant-primary" type="button" disabled={busy || !canWrite || staleSources || !taskTitle.trim()} onClick={() => void apply({ ...base(), type: 'CREATE_TASK', title: taskTitle, sourceMessageIds: selectedSources, sourceVersions: sourceVersions(), assignee: takeTask ? 'SELF' : 'UNASSIGNED' })}>확인한 항목을 준비에 추가</button>{exactTasks.length > 0 && <details><summary>이미 등록한 준비 · {exactTasks.length}개</summary><ul>{exactTasks.map(item => <li key={item.id}>{item.title} · {item.assigneeId ? memberName(state, item.assigneeId) : '담당 미정'} · {item.completed ? '완료' : '준비 중'}</li>)}</ul></details>}</>}
    {feature === 'first' && <><p>자동 요약 대신 현재 저장된 안내를 그대로 확인해요. 옛 대화를 추론하거나 가입 전 비공개 내용을 보여주지 않아요.</p>{activity && <dl><dt>언제</dt><dd>{activity.date || '날짜 미정'} {activity.startTime || '시각 미정'}</dd><dt>어디서</dt><dd>{activity.meetingPoint || '장소 미정'}</dd><dt>함께할 내용</dt><dd>{activity.description || '안내 미등록'}</dd></dl>}{notices.map(item => <div className="assistant-evidence" key={item.id}><small>{item.activityId ? '이 약속 공지' : '모임 전체 공지'}</small><strong>{item.title}</strong><p>{item.body}</p></div>)}{!notices.length && <p>아직 등록한 공지가 없어요. 확인할 질문은 ‘준비할 일’에서 직접 남길 수 있어요.</p>}<ul>{exactTasks.map(item => <li key={item.id}>{item.title} · {item.completed ? '완료' : '확인 필요'}</li>)}</ul><small>모임 가입은 참석 확정이 아니에요. 참석은 약속 화면에서 직접 선택해 주세요.</small></>}
    {feature === 'plan-b' && <><p>날씨·영업·경로의 실시간 연결은 없어요. 확인한 상황과 공유 장소에서 대안을 직접 정해요.</p><label>대안 투표 제목<input value={question} maxLength={160} placeholder="예: 비가 오면 어느 곳으로 갈까요?" onChange={event => setQuestion(event.target.value)}/></label>{placePicker}<button className="assistant-primary" type="button" disabled={busy || !canWrite || selectedPlaces.length < 2 || !question.trim()} onClick={() => void apply({ ...base(), type: 'CREATE_POLL', question, placeIds: selectedPlaces })}>대안 후보로 투표 만들기</button><small>투표만 만들어요. 기존 방문·예약·일정은 삭제하거나 교체하지 않아요.</small></>}
    {feature === 'again' && <><p>{activity ? `‘${activity.title}’에서 새로운 만남을 시작해요.` : '이 모임의 새 약속을 시작해요.'} 이전 날짜·참석·예약·준비 완료·개인 메모는 복사하지 않아요.</p><label>새 약속 이름<input value={newTitle} maxLength={100} placeholder="예: 다음 달 커피와 산책" onChange={event => setNewTitle(event.target.value)}/></label><button className="assistant-primary" type="button" disabled={busy || group.archived || activity?.status === 'CANCELLED' || !newTitle.trim()} onClick={() => void apply({ ...base(), type: 'CREATE_ACTIVITY_DRAFT', title: newTitle })}>날짜 미정의 새 약속 만들기</button><small>{group.spaceType === 'ACTIVITY' ? '나만 포함된 새 비공개 약속이에요. 함께할 사람은 다시 초대해 주세요.' : '현재 모임 내부의 새 약속이에요.'} 외부 공개·초대·참석은 실행하지 않으며 여행 DAY와 동선은 새 약속에서 직접 정해요.</small></>}
    {feature === 'language' && <>{sourcePicker}<div className="assistant-two"><label>요청할 언어<select value={locale} onChange={event => { setLocale(event.target.value); setRequest(null); }}><option value="en">English</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="zh">中文</option></select></label><label>약속 시간대<select value={timeZone} onChange={event => { setTimeZone(event.target.value); setRequest(null); }}><option value="Asia/Seoul">한국 · Asia/Seoul</option><option value="UTC">UTC</option><option value="Asia/Tokyo">일본 · Asia/Tokyo</option><option value="America/New_York">뉴욕 · America/New_York</option></select></label></div><label>번역 시 확인할 점<textarea maxLength={1000} value={instruction} onChange={event => { setInstruction(event.target.value); setRequest(null); }} placeholder="예: 토요일이 정확히 어느 날짜인지 확인해 주세요."/></label><p>현재 자동 번역은 제공하지 않아요. 원문·날짜·시간대를 선택해 요청 규격을 확인할 수 있어요. 선택한 언어로 번역됐다고 표시하지 않아요.</p><button type="button" onClick={prepareRequest}>AI 연결 상태·요청 범위 확인</button>{request && <details><summary>백엔드 연결용 요청 정보</summary><pre>{JSON.stringify(request, null, 2)}</pre></details>}</>}
    {!canWrite && feature !== 'again' && <p className="assistant-empty">보관·취소·종료된 공간은 읽기만 가능해요.</p>}
    {error && <p className="assistant-error" role="alert">{error}</p>}{status && <p className="assistant-status" role="status">{status}</p>}
  </section>;
}
