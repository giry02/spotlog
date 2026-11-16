import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, MapPin, Plus, Search, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import type { Place, PlaceKind } from '../data';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { ActivityPlaceDetail } from './ActivityPlacesRoute';
import { memberName, togetherId, type TogetherState } from './model';
import { planningPlaceRegion, selectPlanningPlaceCatalogue } from './planningPlaces';
import { previewMeetingDecisionApplication, selectMeetingDecision } from './meetingDecision';
import type { DecisionApplicationPreview, DecisionCreateInput, DecisionDateOption, DecisionResponseInput } from './decisionTypes';
import './together-decision-panel.css';

type ActionResult = boolean | Promise<boolean>;
export interface TogetherDecisionPanelProps {
  state: TogetherState; userId: string; groupId: string; activityId: string; places: Place[];
  onCreate: (input: DecisionCreateInput) => ActionResult;
  onRespond: (decisionId: string, input: DecisionResponseInput) => ActionResult;
  onConfirm: (preview: DecisionApplicationPreview) => ActionResult;
  renderPlaceDetail?: (place: Place) => ReactNode;
}
type DecisionContext = ReturnType<typeof selectMeetingDecision>;
const kindNames: Record<PlaceKind, string> = { FOOD: '음식점', CAFE: '카페', STAY: '숙소', LANDMARK: '명소', LEISURE: '레저', SHOP: '쇼핑' };
const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const kilometers = (value: number | undefined) => value === undefined ? '미확인' : `${value.toFixed(1)}km`;

/** All exclusion notes stay in this keyed component's memory, outside the shared response contract. */
export default function TogetherDecisionPanel(props: TogetherDecisionPanelProps) {
  let context: DecisionContext;
  try { context = selectMeetingDecision(props.state, props.userId, { groupId: props.groupId, activityId: props.activityId }, props.places); }
  catch { return <section className="together-decision"><p role="alert">현재 이 약속의 장소·날짜 비교를 볼 수 없어요.</p></section>; }
  return <DecisionPanelBody key={`${props.userId}:${props.groupId}:${props.activityId}:${context.decision?.id || 'new'}`} {...props} context={context}/>;
}

function DecisionPanelBody({ state, userId, groupId, activityId, places, onCreate, onRespond, onConfirm, renderPlaceDetail, context }: TogetherDecisionPanelProps & { context: DecisionContext }) {
  const { decision, comparison, ownResponse, canManage, canRespond, writable } = context;
  const activity = state.activities.find(item => item.id === activityId && item.groupId === groupId)!;
  const group = state.groups.find(item => item.id === groupId)!;
  const [step, setStep] = useState<1 | 2 | 3>(decision?.status === 'APPLIED' ? 3 : decision ? ownResponse ? 3 : 2 : 1);
  const [editingCandidates, setEditingCandidates] = useState(!decision);
  const [title, setTitle] = useState(decision?.title || '함께 갈 장소와 날짜 정하기');
  const [selectedIds, setSelectedIds] = useState<string[]>(decision?.candidates.map(item => item.placeId) || []);
  const [costs, setCosts] = useState<Record<string, string>>(Object.fromEntries(decision?.candidates.map(item => [item.placeId, item.referenceCostKrw === undefined ? '' : String(item.referenceCostKrw)]) || []));
  const [dates, setDates] = useState<DecisionDateOption[]>(decision?.dateOptions.map(item => ({ ...item })) || []);
  const [activityRevision, setActivityRevision] = useState(activity.revision), [restartAcknowledged, setRestartAcknowledged] = useState(false);
  const [query, setQuery] = useState(''), [region, setRegion] = useState(''), [kind, setKind] = useState<PlaceKind | 'ALL'>('ALL'), [limit, setLimit] = useState(8);
  const [detailId, setDetailId] = useState('');
  const [availableIds, setAvailableIds] = useState<string[]>(ownResponse?.availablePlaceIds || []);
  const [preferredId, setPreferredId] = useState(ownResponse?.preferredPlaceId || '');
  const [dateIds, setDateIds] = useState<string[]>(ownResponse?.availableDateIds || []);
  const [budget, setBudget] = useState(ownResponse?.budgetMaxKrw === undefined ? '' : String(ownResponse.budgetMaxKrw));
  const [originId, setOriginId] = useState(ownResponse?.originPlaceId || ''), [originQuery, setOriginQuery] = useState('');
  const [responseRevision, setResponseRevision] = useState(decision?.revision || 0);
  const [privateReasons, setPrivateReasons] = useState<Record<string, string>>({});
  const [noneAcknowledged, setNoneAcknowledged] = useState(false);
  const [choice, setChoice] = useState(''), [dateChoice, setDateChoice] = useState(''), [missingAcknowledged, setMissingAcknowledged] = useState(false);
  const [preview, setPreview] = useState<{ value: DecisionApplicationPreview; comparisonKey: string; activityRevision: number } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef(false);
  const scope = { groupId, activityId };
  const catalogue = selectPlanningPlaceCatalogue(places, '', 'ALL', '', '', decision?.candidates.map(item => item.placeId) || selectedIds);
  const placeById = new Map(places.filter(item => !item.personal).map(item => [item.id, item]));
  const regionNames = [...new Set(catalogue.map(planningPlaceRegion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const preferredRegion = group.region.trim().split(/[·,\s]+/)[0] || '';
  const results = selectPlanningPlaceCatalogue(places, query, kind, region, preferredRegion, selectedIds).slice(0, limit);
  const detail = detailId ? placeById.get(detailId) : undefined;
  const editable = canManage && writable;
  const open = decision?.status === 'OPEN';
  const applied = decision?.status === 'APPLIED' ? decision.applied : undefined;
  const displayedPlaceId = decision?.status === 'APPLIED' ? applied?.placeId || '' : choice;
  const displayedDateId = decision?.status === 'APPLIED' ? applied?.dateOptionId || '' : dateChoice;
  const appliedDate = decision?.dateOptions.find(item => item.id === applied?.dateOptionId);
  const appliedDateLabel = !applied ? '적용 날짜 확인 불가' : applied.dateOptionId ? appliedDate ? `${appliedDate.date}${appliedDate.time ? ` · ${appliedDate.time}` : ''}` : '적용 날짜 확인 불가' : '기존 날짜 유지';
  const responseStale = Boolean(decision && responseRevision !== decision.revision);
  const noAvailableAnswer = !availableIds.length || Boolean(decision?.dateOptions.length && !dateIds.length);
  const selectionRow = comparison?.rows.find(item => item.placeId === choice);
  const selectionDate = comparison?.dates.find(item => item.id === dateChoice);
  const previewCurrent = Boolean(preview && preview.comparisonKey === comparison?.key && preview.activityRevision === activity.revision);
  const compatibleCount = comparison?.responseCount ? comparison.rows.filter(row => row.sourceAvailable && row.blockedCount === 0).length : 0;
  const go = (value: 1 | 2 | 3) => { setStep(value); setError(''); setStatus(''); };
  const run = async (action: () => ActionResult, success: string, done?: () => void) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try { if (await action()) { setStatus(success); done?.(); } else setError('저장하지 못했어요. 입력은 유지했으니 현재 내용을 확인하고 다시 시도해 주세요.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했어요. 입력은 유지해요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const toggleCandidate = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(values => values.filter(value => value !== id));
    else if (selectedIds.length < 8) setSelectedIds(values => [...values, id]);
    else setError('후보는 8곳까지 선택할 수 있어요. 담은 후보를 먼저 확인해 주세요.');
  };
  const reloadCandidateDraft = () => {
    setTitle(decision?.title || '함께 갈 장소와 날짜 정하기');
    setSelectedIds(decision?.candidates.map(item => item.placeId) || []);
    setCosts(Object.fromEntries(decision?.candidates.map(item => [item.placeId, item.referenceCostKrw === undefined ? '' : String(item.referenceCostKrw)]) || []));
    setDates(decision?.dateOptions.map(item => ({ ...item })) || []); setActivityRevision(activity.revision); setRestartAcknowledged(false); setEditingCandidates(true);
  };
  const saveCandidates = () => {
    if (selectedIds.length < 2 || selectedIds.length > 8) return setError('비교할 장소를 2~8곳 골라 주세요.');
    if (dates.some(item => !item.date)) return setError('날짜를 입력하거나 사용하지 않는 날짜 칸을 지워 주세요.');
    if (open && !restartAcknowledged) return setError('기존 답변을 이전 비교에 남기고 새로 시작하는 내용을 확인해 주세요.');
    const input: DecisionCreateInput = { title, candidates: selectedIds.map(placeId => ({ placeId, ...(costs[placeId]?.trim() ? { referenceCostKrw: Number(costs[placeId]) } : {}) })), dateOptions: dates.map(item => ({ id: item.id, date: item.date, ...(item.time ? { time: item.time } : {}) })), expectedActivityRevision: activityRevision,
      ...(decision && open ? { replaceDecisionId: decision.id, expectedDecisionRevision: decision.revision } : {}) };
    void run(() => onCreate(input), '후보를 공유했어요. 각자 가능한 곳과 날짜를 답변해 주세요.', () => { setEditingCandidates(false); setStep(2); });
  };
  const saveResponse = () => {
    if (!decision || noAvailableAnswer && !noneAcknowledged) return setError('선택하지 않은 후보는 불가로 공유되는 내용을 확인해 주세요.');
    const input: DecisionResponseInput = { availablePlaceIds: [...availableIds], availableDateIds: [...dateIds], expectedRevision: responseRevision,
      ...(preferredId ? { preferredPlaceId: preferredId } : {}), ...(budget.trim() ? { budgetMaxKrw: Number(budget) } : {}), ...(originId ? { originPlaceId: originId } : {}) };
    void run(() => onRespond(decision.id, input), '내 조건을 공유했어요. 제외 이유 메모는 공유하지 않았어요.', () => { setStep(3); setPreview(null); });
  };
  const preparePreview = () => {
    if (!decision || !comparison) return;
    try { const value = previewMeetingDecisionApplication(state, userId, scope, decision.id, { placeId: choice, ...(dateChoice ? { dateOptionId: dateChoice } : {}), acknowledgeMissing: missingAcknowledged }, places); setPreview({ value, comparisonKey: comparison.key, activityRevision: activity.revision }); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '확정할 조건을 다시 확인해 주세요.'); setPreview(null); }
  };
  const changeDate = (id: string, field: 'date' | 'time', value: string) => setDates(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));

  return <section className="together-decision" aria-label="함께 장소와 날짜 정하기">
    <header className="td-intro"><h3>각자 가능한 조건에서 함께 골라요</h3><p>{activity.title}</p></header>
    <nav className="td-steps" aria-label="장소·날짜 정하기 단계">{([{ id: 1, label: '장소 후보' }, { id: 2, label: '내 조건' }, { id: 3, label: '비교·확정' }] as const).map(item => <button type="button" key={item.id} aria-current={step === item.id ? 'step' : undefined} onClick={() => go(item.id)}><span>{item.id}</span>{item.label}</button>)}</nav>
    {!writable && <p className="td-notice">종료되거나 보관된 약속이에요. 기존 비교와 답변을 확인할 수 있어요.</p>}
    {decision?.status === 'APPLIED' && <p className="td-notice"><Check size={17}/><span><strong>{placeById.get(applied?.placeId || '')?.name || '적용 장소 확인 불가'} · {appliedDateLabel}</strong><br/>선택안을 약속에 반영했어요. 참가·예약·기존 방문 동선은 따로 확인해 주세요.</span></p>}
    {step === 1 && <div className="td-section">
      <div className="td-heading"><h4>{editingCandidates ? '비교할 후보를 골라요' : decision?.title || '장소 후보'}</h4>{editable && decision && !editingCandidates && <button type="button" className="td-text-action" onClick={reloadCandidateDraft}>후보 다시 정하기</button>}</div>
      {!editable && !decision && <div className="td-empty"><MapPin size={26}/><strong>아직 비교할 후보가 없어요</strong><p>방장·약속 편집자가 장소 후보를 공유하면 내 조건을 답변할 수 있어요.</p></div>}
      {editingCandidates && editable ? <>
        <div className="td-stage-summary"><strong>비교 후보 {selectedIds.length}곳</strong><p>{selectedIds.length < 2 ? `장소 ${2 - selectedIds.length}곳을 더 고르면 함께 비교할 수 있어요.` : '후보를 공유하면 멤버가 가능한 장소와 날짜를 답해요.'}</p>{selectedIds.length > 0 && <div className="td-picked-names">{selectedIds.map(id => <span key={id}>{placeById.get(id)?.name || '현재 정보 미확인'}</span>)}</div>}</div>
        <details className="td-selected"><summary><strong>담은 후보 관리 {selectedIds.length}/8</strong><span>제외·참고 비용<ChevronRight size={16}/></span></summary>{!selectedIds.length && <p className="td-muted">아래에서 음식점·카페·숙소 등을 골라 주세요.</p>}<p className="td-muted">참고 비용은 직접 입력한 예상액이에요. 공식 가격·예약 가능 여부가 아니에요.</p>{selectedIds.map((id, index) => { const place = placeById.get(id); return <article key={id} className="td-selected-place"><div><span className="td-order">{index + 1}</span><strong>{place?.name || '현재 확인할 수 없는 장소'}</strong><button type="button" className="td-icon" aria-label={`${place?.name || '장소'} 후보에서 빼기`} onClick={() => toggleCandidate(id)}><X size={18}/></button></div><label className="td-field">참고 1인 비용 · 원, 선택<input type="number" min="0" step="100" inputMode="numeric" value={costs[id] || ''} onChange={event => setCosts(current => ({ ...current, [id]: event.target.value }))} placeholder="직접 확인한 예상액, 모르면 비워두기"/></label></article>; })}</details>
        {detail ? <section className="td-place-detail"><button type="button" className="td-text-action" onClick={() => setDetailId('')}><ArrowLeft size={17}/>후보 찾기로</button>{renderPlaceDetail ? renderPlaceDetail(detail) : <ActivityPlaceDetail place={detail}/>}<button type="button" className={selectedIds.includes(detail.id) ? 'td-secondary' : 'td-primary'} onClick={() => toggleCandidate(detail.id)}>{selectedIds.includes(detail.id) ? <X size={17}/> : <Plus size={17}/>}이 장소 {selectedIds.includes(detail.id) ? '후보에서 빼기' : '후보로 선택'}</button></section> : <>
          <label className="td-search"><Search size={18}/><input type="search" aria-label="비교할 장소 검색" value={query} onChange={event => { setQuery(event.target.value); setLimit(8); }} placeholder="장소 이름·지역·주소"/></label>
          <label className="td-region">지역<select value={region} onChange={event => { setRegion(event.target.value); setLimit(8); }}><option value="">전체{preferredRegion ? ` · ${preferredRegion} 우선` : ''}</option>{regionNames.map(value => <option key={value}>{value}</option>)}</select></label>
          <div className="td-kinds" role="group" aria-label="비교 장소 종류">{(['ALL', 'FOOD', 'CAFE', 'STAY', 'LANDMARK', 'LEISURE', 'SHOP'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setLimit(8); }}>{value === 'ALL' ? '전체' : kindNames[value]}</button>)}</div>
          <div className="td-catalogue">{results.map(place => { const photo = getPlacePhotos(place, true)[0], selected = selectedIds.includes(place.id); return <article className="td-place-row" key={place.id}><button type="button" className="td-place-info" onClick={() => setDetailId(place.id)} aria-label={`${place.name} 상세 보기`}>{photo ? <img src={photo.image} alt="" loading="lazy"/> : <span className="td-no-photo"><MapPin size={20}/></span>}<span><small>{kindNames[place.kind]} · {place.area}</small><strong>{place.name}</strong><small>{place.address || '주소 확인 전'}</small></span><ChevronRight size={16}/></button><button type="button" className="td-pick" aria-label={`${place.name} ${selected ? '후보 선택 해제' : '후보로 선택'}`} aria-pressed={selected} disabled={!selected && selectedIds.length >= 8} onClick={() => toggleCandidate(place.id)}>{selected ? <Check size={18}/> : <Plus size={18}/>}</button></article>; })}</div>
          {!results.length && <div className="td-empty"><strong>맞는 장소가 없어요</strong><button type="button" className="td-secondary" onClick={() => { setQuery(''); setRegion(''); setKind('ALL'); }}>검색 조건 지우기</button></div>}
          {results.length >= limit && <button type="button" className="td-secondary" onClick={() => setLimit(value => value + 8)}>장소 더 보기</button>}
        </>}
        <details className="td-optional-settings"><summary><span>비교 제목·날짜 옵션 <small>{dates.length ? `날짜 후보 ${dates.length}개` : '현재 약속 날짜 유지'}</small></span><ChevronDown size={17}/></summary><div><label className="td-field">비교 제목<input maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="예: 회식 장소와 날짜 정하기"/></label><section className="td-date-setup"><div className="td-heading"><h4>날짜 후보 · 선택</h4><button type="button" className="td-text-action" disabled={dates.length >= 8} onClick={() => setDates(current => [...current, { id: togetherId('decision-date'), date: '' }])}><Plus size={17}/>날짜 추가</button></div><p className="td-muted">등록하지 않으면 현재 약속 날짜를 유지해요. 후보는 8개까지예요.</p>{dates.map((item, index) => <div className="td-date-row" key={item.id}><label className="td-field">날짜 {index + 1}<input type="date" value={item.date} onInput={event => changeDate(item.id, 'date', event.currentTarget.value)} onChange={event => changeDate(item.id, 'date', event.target.value)}/></label><label className="td-field">시각 · 선택<input type="time" value={item.time || ''} onInput={event => changeDate(item.id, 'time', event.currentTarget.value)} onChange={event => changeDate(item.id, 'time', event.target.value)}/></label><button type="button" className="td-icon" aria-label={`날짜 후보 ${index + 1} 삭제`} onClick={() => setDates(current => current.filter(value => value.id !== item.id))}><Trash2 size={17}/></button></div>)}</section></div></details>
        {activityRevision !== activity.revision && <aside className="td-notice"><p>약속이 바뀌었어요. 현재 날짜·장소를 확인한 뒤 계속해 주세요.</p><button type="button" className="td-secondary" onClick={() => setActivityRevision(activity.revision)}>현재 약속 확인 · 입력 유지</button></aside>}
        {open && <label className="td-check"><input type="checkbox" checked={restartAcknowledged} onChange={event => setRestartAcknowledged(event.target.checked)}/><span>새 비교를 시작하면 기존 답변은 이전 비교에 남고, 새 후보에는 다시 답변해야 함을 확인했어요.</span></label>}
        <button type="button" className="td-primary" disabled={busy || selectedIds.length < 2 || activityRevision !== activity.revision || Boolean(open && !restartAcknowledged)} onClick={saveCandidates}>{open ? '새 후보로 다시 시작' : '후보 공유하고 조건 받기'}<ArrowRight size={17}/></button>
      </> : decision && <>
        <div className="td-configured-places">{decision.candidates.map(item => <article key={item.placeId}><button type="button" className="td-text-action" onClick={() => setDetailId(detailId === item.placeId ? '' : item.placeId)}><MapPin size={17}/>{placeById.get(item.placeId)?.name || '현재 확인할 수 없는 후보'}<ChevronRight size={16}/></button><small>{item.referenceCostKrw === undefined ? '참고 비용 미입력' : `참고 1인 ${money(item.referenceCostKrw)}`}</small>{detailId === item.placeId && placeById.has(item.placeId) && <ActivityPlaceDetail place={placeById.get(item.placeId)!}/>}</article>)}</div>
        {decision.dateOptions.length > 0 && <div className="td-date-tags">{decision.dateOptions.map(item => <span key={item.id}><CalendarDays size={15}/>{item.date}{item.time ? ` ${item.time}` : ''}</span>)}</div>}
        {open && <button type="button" className="td-primary" onClick={() => go(2)}>내 조건 답변하기<ArrowRight size={17}/></button>}
      </>}
    </div>}

    {step === 2 && <div className="td-section">
      {!decision ? <div className="td-empty"><CircleHelp size={26}/><strong>장소 후보가 먼저 필요해요</strong><p>공유된 후보가 생기면 가능한 곳과 날짜를 골라 주세요.</p>{editable && <button type="button" className="td-primary" onClick={() => go(1)}>장소 후보 고르기</button>}</div> : <>
        <div className="td-heading"><h4>내가 갈 수 있는 곳</h4><small>{ownResponse ? '저장된 내 답변 있음' : '아직 답변 전'}</small></div><div className="td-response-summary"><strong>가능한 장소 {availableIds.length}/{decision.candidates.length}곳</strong>{decision.dateOptions.length > 0 && <span>가능한 날짜 {dateIds.length}/{decision.dateOptions.length}개</span>}</div><p className="td-muted">가능한 곳을 모두 선택해 주세요. 선택하지 않은 장소·날짜는 불가로 공유해요. 선호는 가능한 장소 중 한 곳만 표시할 수 있어요.</p>
        <div className="td-availability">{decision.candidates.map(item => { const place = placeById.get(item.placeId), available = availableIds.includes(item.placeId); return <article key={item.placeId} className="td-availability-row"><label className="td-check"><input type="checkbox" checked={available} disabled={!canRespond || busy} onChange={event => { const checked = event.target.checked; setAvailableIds(current => checked ? [...current, item.placeId] : current.filter(value => value !== item.placeId)); if (!checked && preferredId === item.placeId) setPreferredId(''); setNoneAcknowledged(false); }}/><span><strong>{place?.name || '현재 확인할 수 없는 후보'}</strong><small>{item.referenceCostKrw === undefined ? '참고 비용 미입력' : `참고 1인 ${money(item.referenceCostKrw)}`}</small></span></label><button type="button" className="td-prefer" aria-label={`${place?.name || '후보'} 가장 선호`} aria-pressed={preferredId === item.placeId} disabled={!canRespond || !available || busy} onClick={() => setPreferredId(current => current === item.placeId ? '' : item.placeId)}><Star size={17} fill={preferredId === item.placeId ? 'currentColor' : 'none'}/>선호</button>{!available && canRespond && <details className="td-private-disclosure"><summary><ShieldCheck size={14}/><span>나만 보는 제외 이유 · 선택{privateReasons[item.placeId] ? ' · 메모 있음' : ''}</span><ChevronRight size={15}/></summary><label className="td-private-reason">내 화면에서만 볼 메모<input value={privateReasons[item.placeId] || ''} maxLength={200} onChange={event => setPrivateReasons(current => ({ ...current, [item.placeId]: event.target.value }))} placeholder="필요할 때만 적어 주세요"/></label></details>}</article>; })}</div>
        <p className="td-private-note"><ShieldCheck size={16}/>제외 이유는 내 화면 메모리에만 남고, 답변·대화·다른 멤버에게 보내지 않아요. 화면을 닫으면 없어져요.</p>
        {decision.dateOptions.length > 0 && <fieldset className="td-date-answer"><legend>가능한 날짜 모두 선택</legend>{decision.dateOptions.map(item => <label key={item.id} className="td-check"><input type="checkbox" disabled={!canRespond || busy} checked={dateIds.includes(item.id)} onChange={event => { const checked = event.target.checked; setDateIds(current => checked ? [...current, item.id] : current.filter(value => value !== item.id)); setNoneAcknowledged(false); }}/><span>{item.date}{item.time ? ` · ${item.time}` : ''}</span></label>)}</fieldset>}
        <details className="td-extra-conditions"><summary><span>예산·출발 기준 <small>선택 정보 {Number(Boolean(budget.trim())) + Number(Boolean(originId))}개</small></span><ChevronDown size={17}/></summary><div><label className="td-field">참고 예산 상한 · 1인 원, 선택<input type="number" min="0" step="100" inputMode="numeric" disabled={!canRespond || busy} value={budget} onChange={event => setBudget(event.target.value)} placeholder="모르면 비워두기"/><small>예상 비용과 비교하는 참고 조건이에요. 정확한 지출·결제·예약 금액을 뜻하지 않아요.</small></label>
        <details className="td-origin-picker"><summary><span><strong>출발 기준 장소 · 선택</strong><small>{originId ? placeById.get(originId)?.name || '이전에 선택한 장소 · 현재 정보 미확인' : '직선거리 비교에 사용할 공개 장소를 선택해요'}</small></span><MapPin size={18}/></summary><p className="td-muted">선택한 장소와 좌표가 이 비교의 멤버에게 공유돼요. 정밀한 집 주소나 기기 GPS는 수집하지 않아요.</p><label className="td-search"><Search size={17}/><input type="search" disabled={!canRespond || busy} aria-label="출발 기준 장소 검색" value={originQuery} onChange={event => setOriginQuery(event.target.value)} placeholder="역·장소 이름 검색"/></label>{originId && <button type="button" className="td-secondary" disabled={!canRespond || busy} onClick={() => setOriginId('')}>출발 기준 선택 해제</button>}<div>{selectPlanningPlaceCatalogue(places, originQuery, 'ALL', '', preferredRegion).slice(0, 8).map(place => <button type="button" className="td-origin-option" key={place.id} aria-pressed={originId === place.id} disabled={!canRespond || busy} onClick={() => setOriginId(place.id)}><span><strong>{place.name}</strong><small>{place.area}</small></span>{originId === place.id && <Check size={17}/>}</button>)}</div></details>
        </div></details>
        {canRespond && noAvailableAnswer && <label className="td-check td-notice"><input type="checkbox" checked={noneAcknowledged} onChange={event => setNoneAcknowledged(event.target.checked)}/><span>선택하지 않은 장소 또는 날짜는 불가로 공유됨을 확인했어요.</span></label>}
        {canRespond && responseStale && <aside className="td-notice"><p>비교 내용이나 멤버 답변이 바뀌었어요. 최신 결과를 확인한 뒤 입력을 유지하고 저장할 수 있어요.</p><button type="button" className="td-secondary" onClick={() => { setResponseRevision(decision.revision); setPreview(null); setStatus('현재 비교를 확인했어요. 작성 중인 내 조건은 유지했어요.'); }}>최신 내용 확인 · 내 입력 유지</button></aside>}
        {canRespond ? <button type="button" className="td-primary" disabled={busy || responseStale || noAvailableAnswer && !noneAcknowledged} onClick={saveResponse}>내 조건 공유하고 비교<ArrowRight size={17}/></button> : <p className="td-notice">지금은 답변을 바꿀 수 없어요. 기존 답변과 비교 결과를 확인해 주세요.</p>}
      </>}
    </div>}

    {step === 3 && <div className="td-section">
      {!decision || !comparison ? <div className="td-empty"><CircleHelp size={26}/><strong>아직 비교할 답변이 없어요</strong><p>장소 후보를 공유하고 각자 조건을 답변해 주세요.</p><button type="button" className="td-secondary" onClick={() => go(decision ? 2 : 1)}>{decision ? '내 조건 답변하기' : '후보 확인하기'}</button></div> : <>
        <section className="td-comparison-summary"><div className="td-result-primary"><span>답변 {comparison.responseCount}/{comparison.expectedMemberCount}명</span><strong>{comparison.responseCount ? `불가 응답 없는 후보 ${compatibleCount}곳` : '멤버의 답변을 기다리고 있어요'}</strong>{comparison.missingMemberIds.length > 0 && <p>미응답 {comparison.missingMemberIds.length}명 · {comparison.missingMemberIds.map(id => memberName(state, id, groupId)).join(', ')}</p>}</div><details className="td-comparison-reference"><summary>비교 기준·참고 예산<ChevronDown size={16}/></summary><p>선택한 조건을 비교한 결과예요. AI 판단·방문 인증·실제 도로 이동 시간은 포함하지 않아요.</p>{comparison.budgetKnownCount > 0 ? <small>참고 예산 입력 {comparison.budgetKnownCount}명{comparison.budgetMinKrw !== undefined ? ` · ${money(comparison.budgetMinKrw)}` : ''}{comparison.budgetMaxKrw !== undefined && comparison.budgetMaxKrw !== comparison.budgetMinKrw ? `~${money(comparison.budgetMaxKrw)}` : ''}</small> : <small>참고 예산은 아직 입력된 내용이 없어요.</small>}</details></section>
        {comparison.membershipChanged && <aside className="td-notice"><p>멤버 구성이 바뀌었어요. 기존 멤버의 답변은 유지하고 현재 멤버의 미응답을 표시해요. 최신 내용으로 마지막 확인을 다시 진행해 주세요.</p></aside>}
        <fieldset className="td-comparison-list"><legend>장소 비교</legend>{comparison.rows.map(row => { const place = placeById.get(row.placeId), selected = row.placeId === displayedPlaceId; return <article className="td-comparison-card" key={row.placeId} data-selected={selected}><label className="td-check"><input type="radio" name="decision-place" value={row.placeId} checked={selected} disabled={!editable || !open || !row.sourceAvailable || row.blockedCount > 0 || !comparison.responseCount} onChange={() => { setChoice(row.placeId); setPreview(null); }}/><span><strong>{place?.name || '현재 확인할 수 없는 장소'}</strong><small>{!row.sourceAvailable ? '현재 장소 정보 확인 불가' : row.blockedCount ? `응답 중 ${row.blockedCount}명 불가 · 선택할 수 없어요` : comparison.responseCount ? `답변한 ${row.availableCount}명 가능 · 선호 ${row.preferredCount}명` : '아직 답변 없음'}</small></span></label><div className="td-comparison-votes"><span>가능 <strong>{row.availableCount}명</strong></span><span>불가 <strong>{row.blockedCount}명</strong></span><span>선호 <strong>{row.preferredCount}명</strong></span></div><details className="td-comparison-reference"><summary>비용·직선거리 참고<ChevronDown size={16}/></summary><dl><div><dt>참고 비용</dt><dd>{row.referenceCostKrw === undefined ? '미입력 · 예산 비교 미확인' : `1인 ${money(row.referenceCostKrw)}`}</dd></div>{row.referenceCostKrw !== undefined && <div><dt>참고 예산 비교</dt><dd>범위 내 {row.withinBudgetCount}명 · 초과 {row.overBudgetCount}명 · 미입력 {row.unknownBudgetCount}명</dd></div>}<div><dt>직선거리 참고</dt><dd>{row.distance.knownOriginCount ? `평균 ${kilometers(row.distance.meanKm)} · 최장 ${kilometers(row.distance.maxKm)}` : '출발 기준 입력이 없어 비교할 수 없어요'}</dd></div>{row.distance.knownOriginCount > 0 && <div><dt>거리 편차</dt><dd>{kilometers(row.distance.spreadKm)} · 최단 {kilometers(row.distance.minKm)}</dd></div>}<div><dt>거리 기준</dt><dd>확인 {row.distance.knownOriginCount}명 · 미확인 {row.distance.unknownOriginCount}명</dd></div></dl></details>{place && <button type="button" className="td-text-action" onClick={() => setDetailId(detailId === row.placeId ? '' : row.placeId)}>사진·장소 정보<ChevronRight size={16}/></button>}{detailId === row.placeId && place && <ActivityPlaceDetail place={place}/>}</article>; })}</fieldset>
        {comparison.dates.length > 0 && <fieldset className="td-date-comparison"><legend>날짜 비교</legend>{comparison.dates.map(item => <label className="td-check" key={item.id}><input type="radio" name="decision-date" checked={displayedDateId === item.id} disabled={!editable || !open || item.blockedCount > 0 || !comparison.responseCount} onChange={() => { setDateChoice(item.id); setPreview(null); }}/><span><strong>{item.date}{item.time ? ` · ${item.time}` : ''}</strong><small>{item.blockedCount ? `응답 중 ${item.blockedCount}명 불가 · 선택할 수 없어요` : comparison.responseCount ? `답변한 ${item.availableCount}명 가능` : '아직 답변 없음'}</small></span></label>)}</fieldset>}
        {open && editable && comparison.missingMemberIds.length > 0 && <label className="td-check td-notice"><input type="checkbox" checked={missingAcknowledged} onChange={event => { setMissingAcknowledged(event.target.checked); setPreview(null); }}/><span>미응답 {comparison.missingMemberIds.length}명의 가능 여부는 확인되지 않았어요. 답변한 멤버 조건으로 진행함을 확인했어요.</span></label>}
        <p className="td-muted">명시한 장소·날짜 불가 조건은 무시하고 확정할 수 없어요. 참고 예산 초과는 별도 경고로 확인해요. 거리와 비용이 미확인인 항목은 빈 값을 0으로 계산하지 않아요.</p>
        {open && editable && <button type="button" className="td-primary" disabled={busy || !selectionRow || selectionRow.blockedCount > 0 || !selectionRow.sourceAvailable || !comparison.responseCount || comparison.dates.length > 0 && !selectionDate || Boolean(selectionDate?.blockedCount) || comparison.missingMemberIds.length > 0 && !missingAcknowledged} onClick={preparePreview}>변경 내용 확인<ArrowRight size={17}/></button>}
        {preview && <section className="td-final-review"><div className="td-heading"><h4>약속에 반영하기 전 마지막 확인</h4><button type="button" className="td-icon" aria-label="확정 내용 닫기" onClick={() => setPreview(null)}><X size={18}/></button></div><div className="td-before-after"><div><small>현재 약속</small><strong>{preview.value.before.venueLabel}</strong><p>{preview.value.before.dateLabel}</p></div><ArrowRight size={20}/><div><small>바꿀 내용</small><strong>{preview.value.after.venueLabel}</strong><p>{preview.value.after.dateLabel}</p></div></div><ul>{preview.value.notes.map((note, index) => <li key={`${index}:${note}`}>{note}</li>)}</ul>{!previewCurrent && <p role="alert" className="td-notice">내용이 바뀌었어요. 마지막 확인을 닫고 최신 비교에서 다시 선택해 주세요.</p>}<button type="button" className="td-primary" disabled={busy || !previewCurrent || !editable || !open} onClick={() => void run(() => onConfirm(preview.value), '선택한 장소·날짜를 약속에 반영했어요.', () => setPreview(null))}>확인한 내용으로 약속 변경<Check size={17}/></button></section>}
      </>}
    </div>}
    {error && <p className="td-error" role="alert">{error}</p>}{status && <p className="td-status" role="status">{status}</p>}
  </section>;
}
