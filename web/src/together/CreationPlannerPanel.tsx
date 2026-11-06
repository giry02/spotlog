import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImageOff, MapPin, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { Place } from '../data';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { PhotoCredit } from '../PublicTourismCredit';
import { naverDirectionsUrl } from '../placeDirections';
import { topicOptions } from './discovery';
import { buildCreationGroupDraft, buildCreationPlans, creationBriefTopics, creationCatalogPlaces, creationCatalogRegions, interpretCreationPrompt, refreshCreationPlan, validateCreationBrief, validateCreationPlan, type CreationBrief, type CreationGroupDraft, type CreationPlan, type CreationPurpose } from './creationPlanner';
import { completeCreationReview, creationPreviewCatalog, restoreCreationPreview, type CreationPreviewDraft } from './creationPreview';
import type { GroupTopic } from './model';
import './creation-planner.css';

export interface CreationPlannerPanelProps {
  places: Place[];
  initial?: Partial<CreationBrief>;
  initialPrompt?: string;
  allowedPurposes?: CreationPurpose[];
  submitLabel?: string;
  reviewOptions?: ReactNode;
  cancelLabel?: string;
  /** Public catalog + page-memory input only. The final action requests login instead of saving. */
  previewOnly?: boolean;
  onLoginRequired?: (draft: CreationPreviewDraft) => void;
  /** Explicit guest-to-member handoff; confirmations are never restored. */
  resumeDraft?: CreationPreviewDraft;
  onReview: (brief: CreationBrief, plan: CreationPlan | null, groupDraft?: CreationGroupDraft) => boolean | Promise<boolean>;
  onCancel?: () => void;
}

const purposes: Array<{ id: CreationPurpose; label: string }> = [
  { id: 'MEETUP', label: '식사·만남' }, { id: 'OUTING', label: '나들이' }, { id: 'TRIP', label: '여행' }, { id: 'GROUP', label: '새 모임' },
];
const presetOptions: Array<{ label: string; purpose: CreationPurpose; prompt: string }> = [
  { label: '🍽️ 맛집 탐방', purpose: 'MEETUP', prompt: '부산에서 친구 4명이 맛집을 탐방하고 카페에서 이야기하고 싶어.' },
  { label: '🌿 자연·산책', purpose: 'OUTING', prompt: '부산에서 부모님과 자연을 보고 산책한 뒤 밥도 먹고 싶어. 많이 걷기는 어려워.' },
  { label: '🏸 운동 약속', purpose: 'MEETUP', prompt: '부산에서 친구들과 배드민턴을 치고 함께 저녁을 먹고 싶어.' },
  { label: '📚 독서·카페', purpose: 'MEETUP', prompt: '부산에서 친구 3명과 카페에서 독서하고 책 이야기를 나누고 싶어.' },
  { label: '🎲 보드게임', purpose: 'MEETUP', prompt: '부산에서 보드게임을 처음 하는 친구들과 함께 놀고 싶어.' },
  { label: '🎨 전시 관람', purpose: 'OUTING', prompt: '부산에서 전시를 보고 카페에서 이야기하고 싶어.' },
  { label: '🧳 가족여행', purpose: 'TRIP', prompt: '부산으로 가족 4명이 2박 3일 여행하고 싶어. 음식점과 카페, 숙소도 찾아줘.' },
  { label: '👋 새 모임 개설', purpose: 'GROUP', prompt: '부산에서 주말마다 카페와 맛집을 함께 찾는 취미 모임을 만들고 싶어.' },
];
const placeKinds: Record<Place['kind'], string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const transportNames: Record<CreationBrief['transport'], string> = { UNSET: '미정', WALK: '도보', PUBLIC: '대중교통', CAR: '자동차' };
const kindNames: Record<CreationGroupDraft['kind'], string> = { FAMILY: '가족', FRIENDS: '친구', HOBBY: '취미·지역', GUIDE: '가이드' };
const numberValue = (value: string) => value.trim() === '' ? undefined : Number(value);

/** Temporary choices stay in this panel. Saving only happens through the final parent callback. */
export default function CreationPlannerPanel({ places, initial, initialPrompt = '', allowedPurposes, submitLabel, reviewOptions, cancelLabel = '닫기', previewOnly = false, onLoginRequired, resumeDraft, onReview, onCancel }: CreationPlannerPanelProps) {
  const availablePlaces = useMemo(() => previewOnly ? creationPreviewCatalog(places) : places, [places, previewOnly]);
  const [restored] = useState(() => resumeDraft ? restoreCreationPreview(resumeDraft, availablePlaces) : null);
  const availablePurposes = purposes.filter(item => !allowedPurposes || allowedPurposes.includes(item.id));
  const initialHints = Object.fromEntries(Object.entries(initial ?? {}).filter(([, value]) => value !== '' && value !== undefined)) as Partial<CreationBrief>;
  const [step, setStep] = useState(restored ? restored.ready ? 3 : 1 : 0);
  const [prompt, setPrompt] = useState(restored?.brief.prompt ?? (initialPrompt || initial?.prompt || ''));
  const [brief, setBrief] = useState(() => restored?.brief ?? interpretCreationPrompt(initialPrompt || initial?.prompt || '', initialHints));
  const [purposeTouched, setPurposeTouched] = useState(Boolean(restored || initial?.purpose));
  const [plans, setPlans] = useState<CreationPlan[]>(restored?.ready && restored.plan ? [restored.plan] : []);
  const [plan, setPlan] = useState<CreationPlan | null>(restored?.ready ? restored.plan : null);
  const [groupDraft, setGroupDraft] = useState<CreationGroupDraft | null>(restored?.groupDraft ?? null);
  const [picker, setPicker] = useState<{ day: number; replaceId?: string } | null>(null);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(false);
  const [dateUnconfirmed, setDateUnconfirmed] = useState(false);
  const [error, setError] = useState(restored && !restored.ready ? `공개 자료나 조건이 바뀌었어요. ${restored.issues.join(' ')}` : '');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const inFlight = useRef(false);
  const manuallyEdited = useRef<Partial<CreationBrief>>({});
  const regionId = useId();
  const headingRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLElement>(null);
  const regionOptions = useMemo(() => creationCatalogRegions(availablePlaces), [availablePlaces]);
  const catalog = useMemo(() => creationCatalogPlaces(brief, availablePlaces), [brief.region, availablePlaces]);
  const catalogById = new Map(catalog.map(place => [place.id, place]));
  const isGroup = brief.purpose === 'GROUP';
  const selectedTopics = creationBriefTopics(brief);
  const canGroup = availablePurposes.some(item => item.id === 'GROUP');
  const canPlan = availablePurposes.some(item => item.id !== 'GROUP');
  const canTrip = availablePurposes.some(item => item.id === 'TRIP');
  const canDay = availablePurposes.some(item => item.id === 'MEETUP' || item.id === 'OUTING');
  const titles = ['하고 싶은 일', '조건 확인', isGroup ? '모임 초안' : '후보 비교', '마지막 확인'];
  const locked = busy || completed;
  useEffect(() => { setChecked(false); setDateUnconfirmed(false); setCompleted(false); }, [previewOnly]);
  useEffect(() => { if (picker) pickerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [picker]);
  const nextStep = (value: number) => { setStep(value); setError(''); setChecked(false); setPicker(null); headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); };
  const updateBrief = <K extends keyof CreationBrief>(key: K, value: CreationBrief[K]) => {
    manuallyEdited.current = { ...manuallyEdited.current, [key]: value };
    setBrief(current => ({ ...current, [key]: value })); setPlans([]); setPlan(null); setChecked(false); setError('');
  };
  const updateTopics = (topic: GroupTopic, selected: boolean) => {
    const topics = selected ? [...selectedTopics, topic] : selectedTopics.filter(id => id !== topic);
    updateBrief('topics', [...new Set(topics)]);
    setGroupDraft(current => current && ({ ...current, topics: [...new Set(topics)] }));
    const theme: CreationBrief['theme'] = topics.includes('OUTDOOR') || topics.includes('WALK') ? 'FOLIAGE' : topics.includes('FOOD') ? 'FOOD' : topics.includes('CAFE') ? 'CAFE' : topics.includes('CULTURE') ? 'CULTURE' : topics.includes('TRAVEL') ? 'TRAVEL' : 'OTHER';
    updateBrief('theme', theme);
  };
  const selectTarget = (group: boolean) => {
    updateBrief('purpose', group ? 'GROUP' : canTrip && (brief.dayCount ?? 1) > 1 ? 'TRIP' : canDay ? 'MEETUP' : 'TRIP');
    setPurposeTouched(true); setGroupDraft(null);
  };
  const useUndecidedDraft = () => {
    const next = { ...brief, locationUndecided: true };
    updateBrief('locationUndecided', true);
    const drafts = buildCreationPlans(next, availablePlaces);
    setPlans(drafts); setPlan(drafts[0] ?? null); setError('');
  };
  const parsePrompt = () => {
    if (!prompt.trim()) { setError('하고 싶은 일을 한 문장으로 적어주세요.'); return; }
    const next = prompt.trim() === brief.prompt ? { ...brief } : interpretCreationPrompt(prompt.trim(), { ...initialHints, ...manuallyEdited.current });
    const purpose = purposeTouched ? brief.purpose : next.purpose;
    setBrief({ ...next, prompt: prompt.trim(), purpose: availablePurposes.some(item => item.id === purpose) ? purpose : availablePurposes[0]?.id || 'MEETUP' });
    setPlan(null); setPlans([]); nextStep(1);
  };
  const build = () => {
    setError('');
    if (!brief.region.trim()) { setError(isGroup ? '모임의 활동 지역을 선택해 주세요.' : '찾아볼 지역을 먼저 선택해 주세요.'); return; }
    if (brief.people !== undefined && (!Number.isInteger(brief.people) || brief.people < 1 || brief.people > 300)) { setError('인원은 1~300명으로 입력해 주세요.'); return; }
    if ([brief.budgetPerPerson, brief.walkingLimitMinutes].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) { setError('예산과 걷기 제한은 0 이상의 숫자로 입력해 주세요.'); return; }
    if (brief.endDate && !brief.date) { setError('마지막 날짜를 정했다면 시작 날짜도 입력해 주세요.'); return; }
    if (brief.date && brief.endDate && brief.endDate < brief.date) { setError('마지막 날짜는 시작 날짜보다 빠를 수 없어요.'); return; }
    if (isGroup) { setGroupDraft(current => current ? { ...current, region: brief.region } : buildCreationGroupDraft(brief)); nextStep(2); return; }
    const issues = validateCreationBrief(brief);
    if (issues.length) { setError(issues.join(' ')); return; }
    try {
      const next = buildCreationPlans(brief, availablePlaces);
      setPlans(next); setPlan(next[0] ? structuredClone(next[0]) : null); nextStep(2);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '조건을 확인하고 다시 찾아주세요.'); }
  };
  const changePlan = (next: CreationPlan) => { setPlan(refreshCreationPlan(brief, next, availablePlaces)); setChecked(false); setError(''); };
  const removePlace = (id: string) => {
    if (!plan) return;
    changePlan({ ...plan, placeIds: plan.placeIds.filter(value => value !== id), days: plan.days.map(day => ({ ...day, placeIds: day.placeIds.filter(value => value !== id) })) });
  };
  const pickPlace = (id: string) => {
    if (!plan || !picker || !catalogById.has(id) || plan.placeIds.includes(id)) return;
    const days = plan.days.map(day => day.day !== picker.day ? day : { ...day, placeIds: picker.replaceId ? day.placeIds.map(value => value === picker.replaceId ? id : value) : [...day.placeIds, id] });
    changePlan({ ...plan, days, placeIds: days.flatMap(day => day.placeIds) }); setPicker(null); setSearch('');
  };
  const review = () => {
    if (isGroup) {
      if (!groupDraft?.name.trim() || !groupDraft.introduction.trim()) { setError('모임 이름과 소개를 확인해 주세요.'); return; }
      if (!groupDraft.region.trim()) { setError('모임의 활동 지역을 선택해 주세요.'); return; }
    } else {
      if (!plan) { setError('비교할 후보를 선택해 주세요.'); return; }
      const problems = validateCreationPlan(brief, plan, availablePlaces);
      if (problems.length) { setError(problems.join(' ')); return; }
    }
    setDateUnconfirmed(false); nextStep(3);
  };
  const submit = async () => {
    if (inFlight.current || completed) return;
    if (!checked || (!isGroup && !brief.date && !dateUnconfirmed)) { setError('확인 항목을 체크해 주세요.'); return; }
    if (!isGroup) {
      const problems = plan ? validateCreationPlan(brief, plan, availablePlaces) : ['선택한 초안이 없어요. 후보를 다시 확인해 주세요.'];
      if (problems.length) { setError(problems.join(' ')); return; }
    }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await completeCreationReview({ brief, plan, groupDraft: groupDraft ?? undefined, previewOnly, checked, dateUnconfirmed }, availablePlaces, { onReview, onLoginRequired });
      if (result === 'SAVED') setCompleted(true);
      else if (result === 'REJECTED') setError('아직 저장하지 못했어요. 권한이나 다른 곳에서 변경된 내용을 확인한 뒤 다시 시도해 주세요. 입력과 선택은 유지했어요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 입력과 선택을 유지했으니 다시 시도해 주세요.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const pickerPlaces = catalog.filter(place => !plan?.placeIds.includes(place.id) && (!search.trim() || `${place.name} ${place.address} ${place.area}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const displayedDays = plan?.days.length ? plan.days : plan ? [{ day: 1, placeIds: plan.placeIds }] : [];
  const reviewEndDate = brief.endDate || (brief.date && plan && plan.days.length > 1 && Number.isFinite(Date.parse(brief.date)) ? new Date(Date.parse(brief.date + 'T12:00:00Z') + (plan.days.length - 1) * 86400000).toISOString().slice(0, 10) : '');
  const finalLabel = previewOnly ? '로그인하고 저장' : isGroup ? '확인하고 모임 만들기' : submitLabel || (brief.purpose === 'TRIP' ? '확인하고 여행 만들기' : '확인하고 약속 만들기');

  return <section className="creation-planner" aria-label="등록 장소로 모임과 일정 초안 만들기">
    <div className="cplan-top" ref={headingRef}>
      <div className="cplan-progress"><small className="cplan-status">장소 기반 초안 · AI 연결 전</small><ol className="cplan-steps" aria-label="만들기 단계">{titles.map((title, index) => <li key={index} aria-current={index === step ? 'step' : undefined} className={index < step ? 'is-complete' : ''}><span className="cplan-sr-only">{index + 1}. {title}</span></li>)}</ol><small aria-hidden="true">{step + 1} / {titles.length}</small></div>
      <div className="cplan-step">{step > 0 && <button type="button" className="cplan-icon" aria-label="이전 단계" disabled={locked} onClick={() => nextStep(step - 1)}><ArrowLeft size={18}/></button>}<div><h3>{step === 0 ? '어떤 시간을 보내고 싶나요?' : step === 1 ? '필요한 조건을 확인해요' : step === 2 ? isGroup ? '우리 모임답게 다듬어요' : '장소와 코스를 비교해요' : '만들기 전에 확인해요'}</h3></div></div>
    </div>
    <fieldset className="cplan-content cplan-stack" disabled={locked}>
      {step === 0 && <>
        <label>하고 싶은 일<textarea value={prompt} maxLength={1000} placeholder="어디에서 누구와 무엇을 하고 싶은지 적어주세요." onChange={event => { setPrompt(event.target.value); setError(''); }}/></label>
        <p className="cplan-note">식사 약속부터 운동·취미·가족여행·새 모임까지 자유롭게 적어주세요. 여러 활동을 함께 적어도 돼요.</p>
        <details className="cplan-more"><summary>어떻게 적을지 예시 보기<ChevronDown size={18}/></summary><div className="cplan-presets" aria-label="예시 문장 채우기">{presetOptions.filter(item => !allowedPurposes || allowedPurposes.includes(item.purpose)).map(item => <button type="button" key={item.label} onClick={() => { setPrompt(item.prompt); setError(''); }}>{item.label}</button>)}</div><small>문장을 채우는 예시예요. 활동 종류를 제한하지 않아요.</small></details>
      </>}
      {step === 1 && <>
        <p className="cplan-note">문장에서 찾은 조건이에요. 빠지거나 다르게 읽힌 부분을 직접 고쳐주세요.</p>
        {canGroup && canPlan && <div className="cplan-stack"><label>무엇을 만들까요?</label><div className="cplan-purpose" aria-label="만들 대상"><button type="button" aria-pressed={!isGroup} onClick={() => selectTarget(false)}>약속·일정</button><button type="button" aria-pressed={isGroup} onClick={() => selectTarget(true)}>지속 모임</button></div><small>{isGroup ? '사람들이 계속 함께할 모임을 만들어요. 개별 약속과 여행은 모임 안에서 따로 만들 수 있어요.' : '한 번의 만남이나 나들이, 여러 DAY의 여행 일정을 만들어요.'}</small></div>}
        {!isGroup && canDay && canTrip && <label>일정 형태<select aria-label="일정 형태" value={brief.purpose === 'TRIP' ? 'TRIP' : 'DAY'} onChange={event => { const trip = event.target.value === 'TRIP'; updateBrief('purpose', trip ? 'TRIP' : 'MEETUP'); updateBrief('dayCount', trip ? brief.dayCount || 2 : 1); if (!trip) updateBrief('endDate', brief.date); setPurposeTouched(true); }}><option value="DAY">하루 약속·나들이</option><option value="TRIP">여행 · 여러 DAY와 숙박</option></select></label>}
        <details className="cplan-more"><summary>활동·관심사 · {selectedTopics.length ? `${selectedTopics.length}개 선택` : '선택 사항'}<ChevronDown size={18}/></summary><div className="cplan-topic-picks">{topicOptions.map(topic => <label className="cplan-check" key={topic.id}><input type="checkbox" checked={selectedTopics.includes(topic.id)} onChange={event => updateTopics(topic.id, event.target.checked)}/><span><span aria-hidden="true">{topic.emoji} </span>{topic.label}</span></label>)}</div><small>여러 개를 함께 고를 수 있어요. 구체적인 종목·취향·계절 조건은 하고 싶은 일이나 추가 조건에 적어주세요.</small></details>
        {selectedTopics.length > 0 && <div className="cplan-topic-tags" aria-label="확인한 활동·관심사">{topicOptions.filter(topic => selectedTopics.includes(topic.id)).map(topic => <span key={topic.id}>{topic.emoji} {topic.label}</span>)}</div>}
        <label htmlFor={regionId}>{isGroup ? '활동 지역' : '찾아볼 지역'}<select id={regionId} aria-label={isGroup ? '활동 지역 선택' : '찾아볼 지역'} value={brief.region} onChange={event => updateBrief('region', event.target.value)}><option value="">지역 선택</option>{brief.region && !regionOptions.includes(brief.region) && <option value={brief.region}>{brief.region}{catalog.length ? ' · 세부 지역' : ' · 등록 자료 확인 필요'}</option>}{regionOptions.map(region => <option key={region} value={region}>{region}</option>)}</select></label>
        {!regionOptions.length && <p className="cplan-error" role="status">선택할 지역의 장소 자료가 없어요. 새 모임은 지역을 직접 입력하고 만들 수 있어요.</p>}
        {isGroup && <label>활동 지역 직접 입력<input value={brief.region} maxLength={80} placeholder="예: 부산 수영구" onChange={event => updateBrief('region', event.target.value)}/></label>}
        {!isGroup && <>
          <details className="cplan-more"><summary>동네까지 좁혀 찾기<ChevronDown size={18}/></summary><div className="cplan-stack"><label>지역·동네<input value={brief.region} maxLength={80} placeholder="예: 부산 중구" onChange={event => updateBrief('region', event.target.value)}/></label><small>선택한 지역의 주소와 일치하는 등록 장소에서 찾아요.</small></div></details>
          <div className="cplan-two"><label>시작 날짜 · 선택<input type="date" value={brief.date} onInput={event => updateBrief('date', event.currentTarget.value)} onChange={event => updateBrief('date', event.target.value)}/></label><label>시작 시각 · 선택<input type="time" value={brief.startTime} onInput={event => updateBrief('startTime', event.currentTarget.value)} onChange={event => updateBrief('startTime', event.target.value)}/></label></div>
          <div className="cplan-two"><label>함께할 인원<input type="number" min="1" max="300" inputMode="numeric" value={brief.people ?? ''} placeholder="미정" onChange={event => updateBrief('people', numberValue(event.target.value))}/></label><label>이동수단<select aria-label="이동수단" value={brief.transport} onChange={event => updateBrief('transport', event.target.value as CreationBrief['transport'])}>{Object.entries(transportNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <label className="cplan-check"><input type="checkbox" checked={brief.locationUndecided === true} onChange={event => updateBrief('locationUndecided', event.target.checked)}/><span>장소는 나중에 정할게요.</span></label>
          {brief.locationUndecided && <small>활동과 날짜를 먼저 정하는 초안이에요. 장소와 동선은 만든 뒤 직접 추가해요.</small>}
          <details className="cplan-more"><summary>예산·걷기·기간 더 정하기<ChevronDown size={18}/></summary><div className="cplan-stack"><div className="cplan-two"><label>1인 예산 상한 · 원<input type="number" min="0" max="10000000" inputMode="numeric" value={brief.budgetPerPerson ?? ''} placeholder="미정" onChange={event => updateBrief('budgetPerPerson', numberValue(event.target.value))}/></label><label>걷기 제한 · 분<input type="number" min="0" max="600" inputMode="numeric" value={brief.walkingLimitMinutes ?? ''} placeholder="미정" onChange={event => updateBrief('walkingLimitMinutes', numberValue(event.target.value))}/></label></div><div className="cplan-two"><label>마지막 날짜 · 선택<input type="date" value={brief.endDate} onInput={event => updateBrief('endDate', event.currentTarget.value)} onChange={event => updateBrief('endDate', event.target.value)}/></label><label>여행 일수 (1~7일)<input type="number" min="1" max="7" inputMode="numeric" value={brief.dayCount ?? 1} onChange={event => updateBrief('dayCount', numberValue(event.target.value))}/></label></div><label>추가 조건<textarea value={brief.notes} maxLength={1200} placeholder="예: 유모차 이동 가능 여부 확인, 식사 중 휴식 필요" onChange={event => updateBrief('notes', event.target.value)}/></label></div></details>
          <small>가격·도보 시간·계절별 풍경·영업·예약 가능 여부는 확인한 자료가 있어야 판단할 수 있어요.</small>
        </>}
      </>}
      {step === 2 && isGroup && groupDraft && <>
        <label>모임 이름<input value={groupDraft.name} maxLength={80} onChange={event => setGroupDraft(current => current && ({ ...current, name: event.target.value }))}/></label>
        <label>모임 구분<select aria-label="모임 구분" value={groupDraft.kind} onChange={event => setGroupDraft(current => current && ({ ...current, kind: event.target.value as CreationGroupDraft['kind'] }))}>{Object.entries(kindNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>활동 지역<input value={groupDraft.region} maxLength={80} onChange={event => setGroupDraft(current => current && ({ ...current, region: event.target.value }))}/></label>
        <label>모임 소개<textarea aria-label="모임 소개" value={groupDraft.introduction} maxLength={2000} onChange={event => setGroupDraft(current => current && ({ ...current, introduction: event.target.value }))}/></label>
        <details className="cplan-more"><summary>관심사 선택 · {groupDraft.topics?.length ?? 0}개<ChevronDown size={18}/></summary><div className="cplan-topic-picks">{topicOptions.map(topic => <label className="cplan-check" key={topic.id}><input type="checkbox" checked={groupDraft.topics?.includes(topic.id) ?? false} onChange={event => setGroupDraft(current => current && ({ ...current, topics: event.target.checked ? [...(current.topics ?? []), topic.id] : (current.topics ?? []).filter(id => id !== topic.id) }))}/><span><span aria-hidden="true">{topic.emoji} </span>{topic.label}</span></label>)}</div></details>
        {(groupDraft.topics?.length ?? 0) > 0 && <div className="cplan-topic-tags" aria-label="선택한 관심사">{topicOptions.filter(topic => groupDraft.topics?.includes(topic.id)).map(topic => <span key={topic.id}>{topic.emoji} {topic.label}</span>)}</div>}
        <details className="cplan-more"><summary>가입 안내·첫 활동 아이디어<ChevronDown size={18}/></summary><div className="cplan-stack"><label>환영하는 분·참여 방식<textarea aria-label="환영하는 분·참여 방식" value={groupDraft.welcome ?? ''} maxLength={500} placeholder="예: 맛집 탐방이 처음인 분도 편하게 함께해요." onChange={event => setGroupDraft(current => current && ({ ...current, welcome: event.target.value }))}/></label><label>가입 방식<select aria-label="새 모임 가입 방식" value={groupDraft.joinMode ?? 'DIRECT'} onChange={event => setGroupDraft(current => current && ({ ...current, joinMode: event.target.value as 'DIRECT' | 'APPROVAL' }))}><option value="DIRECT">바로 가입 · 기본</option><option value="APPROVAL">운영진 승인 후 가입</option></select><small>처음에는 비공개로 만들고, 공개 모집 시 이 방식을 적용해요.</small></label><label>가입 안내·인사 질문<textarea aria-label="가입 안내·인사 질문" value={groupDraft.joinGuide ?? ''} maxLength={1000} placeholder="예: 좋아하는 음식과 주로 활동하는 지역을 알려주세요." onChange={event => setGroupDraft(current => current && ({ ...current, joinGuide: event.target.value }))}/></label><label>첫 활동 아이디어 · 날짜 미정<textarea aria-label="첫 활동 아이디어 · 날짜 미정" value={groupDraft.firstActivityIdea ?? ''} maxLength={500} placeholder="예: 첫 모임에서 가고 싶은 카페 후보를 함께 골라요." onChange={event => setGroupDraft(current => current && ({ ...current, firstActivityIdea: event.target.value }))}/></label><small>첫 활동은 소개에 남기는 아이디어예요. 실제 일정과 참석·예약은 만든 뒤 따로 정해요.</small></div></details>
        <p className="cplan-note">새 모임은 비공개로 만들어요. 만든 뒤 첫 만남을 정하고 사람들을 초대할 수 있어요.</p>
      </>}
      {step === 2 && !isGroup && <>
        {!plans.length ? <div className="cplan-empty"><MapPin size={28}/><h4>활동에 맞는 등록 장소가 부족해요</h4><p>다른 종류의 장소를 임의로 추천하지 않아요. 장소 없이 활동 초안을 먼저 만들거나 조건을 바꿀 수 있어요.</p><button type="button" className="cplan-primary" onClick={useUndecidedDraft}>장소는 나중에 정하기</button><button type="button" onClick={() => nextStep(1)}>조건 바꾸기</button></div> : <>
          <div className="cplan-plans" aria-label="등록 장소 코스 비교">{plans.map((item, index) => <button className="cplan-plan" type="button" key={item.id} aria-pressed={plan?.id === item.id} onClick={() => { changePlan(structuredClone(item)); setPicker(null); }}><span aria-hidden="true">{plan?.id === item.id ? <Check size={14}/> : index + 1}</span><div><strong>{item.title}</strong><span>{item.placeIds.map(id => catalogById.get(id)?.name).filter(Boolean).join(' → ')}</span><small>{item.explanation[0] || '등록 자료의 장소로 구성한 비교 후보'}</small></div></button>)}</div>
          {plan && <><div className="cplan-stack">{displayedDays.map(day => <div className="cplan-stack" key={day.day}><h4>{displayedDays.length > 1 ? `DAY ${day.day}` : brief.locationUndecided ? '활동 초안 · 장소 미정' : '선택한 장소 · 순서 초안'}</h4>{brief.locationUndecided ? <p className="cplan-note">만날 장소와 동선은 아직 정하지 않았어요. 만든 뒤 장소를 추가할 수 있어요.</p> : <><div className="cplan-places">{day.placeIds.map(id => { const place = catalogById.get(id); return place ? <PlannerPlace key={id} place={place} tools={<><button type="button" onClick={() => { setPicker({ day: day.day, replaceId: id }); setSearch(''); }}><RefreshCw size={15}/>다른 곳 선택</button><button type="button" className="cplan-icon" aria-label={`${place.name} 후보에서 빼기`} onClick={() => removePlace(id)}><Trash2 size={17}/></button></>}/> : <p className="cplan-error" key={id}>이 장소의 공개 정보가 바뀌었어요. 조건으로 돌아가 다시 찾아주세요.</p>; })}</div><button type="button" onClick={() => { setPicker({ day: day.day }); setSearch(''); }}><Plus size={17}/>이 DAY에 장소 추가</button></>}</div>)}</div>
          {picker && <section className="cplan-replace" ref={pickerRef} aria-label="다른 등록 장소 선택"><div className="cplan-replace-head"><div><h4>{picker.replaceId ? '대신 갈 장소' : '함께 갈 장소'} 선택</h4><small>{brief.region}의 등록 장소 · 선택한 장소 제외</small></div><button type="button" className="cplan-icon" aria-label="장소 선택 닫기" onClick={() => setPicker(null)}><X size={18}/></button></div><label>이름·주소 검색<input value={search} onChange={event => setSearch(event.target.value)} placeholder="음식점, 숙소 이름이나 주소"/></label><div className="cplan-catalog-list">{pickerPlaces.length ? pickerPlaces.map(place => <PlannerPlace key={place.id} place={place} tools={<button type="button" onClick={() => pickPlace(place.id)}><Plus size={15}/>{picker.replaceId ? '이 장소로 바꾸기' : '후보에 담기'}</button>}/>) : <p className="cplan-note">선택할 장소가 없어요. 검색어를 바꾸거나 다른 지역을 확인해 주세요.</p>}</div></section>}
          {plan.unknowns.length > 0 && <details className="cplan-unknowns" open><summary>직접 확인할 내용 · {plan.unknowns.length}개<ChevronDown size={17}/></summary><ul>{plan.unknowns.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
          <small>{brief.locationUndecided ? '장소를 정할 준비가 되면 조건으로 돌아가 장소 미정 선택을 해제해 주세요.' : '방문 순서는 편집 가능한 초안이에요. 경로와 이동 시간은 아직 계산하지 않았어요.'}</small></>}
        </>}
      </>}
      {step === 3 && <>
        {isGroup && groupDraft ? <><h4>{groupDraft.name}</h4><dl className="cplan-review"><dt>모임 구분</dt><dd>{kindNames[groupDraft.kind]}</dd><dt>활동 지역</dt><dd>{groupDraft.region}</dd><dt>소개</dt><dd>{groupDraft.introduction}</dd><dt>관심사</dt><dd>{topicOptions.filter(topic => groupDraft.topics?.includes(topic.id)).map(topic => topic.label).join(' · ') || '아직 선택하지 않았어요.'}</dd>{groupDraft.welcome?.trim() && <><dt>환영 안내</dt><dd>{groupDraft.welcome}</dd></>}{groupDraft.joinGuide?.trim() && <><dt>가입 안내</dt><dd>{groupDraft.joinGuide}</dd></>}{groupDraft.firstActivityIdea?.trim() && <><dt>첫 활동</dt><dd>{groupDraft.firstActivityIdea}<small>날짜 미정의 아이디어 · 실제 약속은 따로 만들어요.</small></dd></>}<dt>공개 범위</dt><dd>비공개</dd></dl></> : plan && <><h4>{plan.title}</h4><dl className="cplan-review"><dt>하고 싶은 일</dt><dd>{brief.prompt}</dd><dt>활동·관심사</dt><dd>{topicOptions.filter(topic => selectedTopics.includes(topic.id)).map(topic => topic.label).join(' · ') || '미정'}</dd><dt>지역</dt><dd>{brief.region}</dd><dt>날짜</dt><dd>{brief.date || '미정'}{reviewEndDate && reviewEndDate !== brief.date ? ` ~ ${reviewEndDate}` : ''}{brief.startTime ? ` · ${brief.startTime}` : ''}</dd><dt>인원·이동</dt><dd>{brief.people ? `${brief.people}명` : '인원 미정'} · {transportNames[brief.transport]}</dd><dt>선택 장소</dt><dd>{displayedDays.map(day => `${displayedDays.length > 1 ? `DAY ${day.day} · ` : ''}${(day.placeIds.length ? day.placeIds.map(id => catalogById.get(id)?.name || '공개 정보 확인 필요').join(' → ') : '장소 미정')}`).join('\n')}</dd>{brief.budgetPerPerson !== undefined && <><dt>희망 예산</dt><dd>1인 {brief.budgetPerPerson.toLocaleString()}원 이하 · 충족 여부 미확인</dd></>}{brief.walkingLimitMinutes !== undefined && <><dt>희망 걷기</dt><dd>{brief.walkingLimitMinutes}분 이하 · 충족 여부 미확인</dd></>}{brief.notes.trim() && <><dt>추가 조건</dt><dd>{brief.notes}</dd></>}</dl>{plan.unknowns.length > 0 && <details className="cplan-unknowns"><summary>만들기 전 확인할 내용<ChevronDown size={17}/></summary><ul>{plan.unknowns.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}{!brief.date && <label className="cplan-check"><input type="checkbox" checked={dateUnconfirmed} onChange={event => setDateUnconfirmed(event.target.checked)}/><span>날짜 미정의 초안으로 만들게요.</span></label>}</>}
        {!previewOnly && !isGroup && reviewOptions}
        <label className="cplan-check"><input type="checkbox" checked={checked} onChange={event => { setChecked(event.target.checked); setError(''); }}/><span>{isGroup ? '이름·지역·소개를 확인했어요.' : brief.locationUndecided ? '장소 미정의 활동 초안과 조건을 확인했어요.' : '선택한 장소와 확인이 필요한 조건을 살펴봤어요.'}</span></label>
        <small>{previewOnly ? '아직 저장하거나 공유하지 않았어요. 로그인한 뒤 초안을 다시 확인하고 저장해요.' : restored ? '로그인 전에 고른 초안이에요. 내용을 다시 확인한 뒤 직접 저장해 주세요.' : isGroup ? '모임을 만든 뒤 초대와 홍보는 직접 진행해요.' : '새 초안을 만들어요. 초대·참석 확정·예약은 별도로 진행해요.'}</small>
      </>}
    </fieldset>
    {error && <p className="cplan-error" role="alert">{error}</p>}
    {completed && <p className="cplan-success" role="status">새 초안을 만들었어요.</p>}
    <div className={`cplan-actions${step === 0 && onCancel ? ' cplan-actions--with-cancel' : ''}`}>
      {step === 0 && <button type="button" className="cplan-primary" disabled={locked || !prompt.trim()} onClick={parsePrompt}>조건 확인하기<ArrowRight size={17}/></button>}
      {step === 1 && <button type="button" className="cplan-primary" disabled={locked} onClick={build}>{isGroup ? '모임 초안 구성하기' : brief.locationUndecided ? '장소 미정으로 초안 만들기' : '등록 장소로 후보 찾기'}<ArrowRight size={17}/></button>}
      {step === 2 && (isGroup || plan) && <button type="button" className="cplan-primary" disabled={locked || (!isGroup && !brief.locationUndecided && !plan?.placeIds.length)} onClick={review}>이 초안 확인하기<ArrowRight size={17}/></button>}
      {step === 3 && <button type="button" className="cplan-primary" disabled={locked || !checked || (!isGroup && !brief.date && !dateUnconfirmed)} onClick={() => void submit()}>{completed ? '만들기 완료' : busy ? '저장 중…' : finalLabel}{!busy && !completed && <Check size={17}/>}</button>}
      {step === 0 && onCancel && <button type="button" disabled={locked} onClick={onCancel}>{cancelLabel}</button>}
    </div>
  </section>;
}

function PlannerPlace({ place, tools }: { place: Place; tools?: ReactNode }) {
  const photo = getPlacePhotos(place, true)[0];
  const [failed, setFailed] = useState(false);
  return <article className="cplan-place"><details><summary>{photo && !failed ? <img className="cplan-place-thumb" src={photo.image} alt="" loading="lazy" onError={() => setFailed(true)}/> : <span className="cplan-place-thumb"><ImageOff size={21} aria-hidden="true"/></span>}<span className="cplan-place-title"><small>{placeKinds[place.kind]}</small><strong>{place.name}</strong><small>{place.area}</small></span><ChevronDown size={17}/></summary><div className="cplan-place-content">{photo && !failed && <><img src={photo.image} alt={photo.alt || place.name} loading="lazy" onError={() => setFailed(true)}/><small>{photo.sourceId ? '등록 장소 사진' : '참고 이미지 · 해당 장소의 실제 모습과 다를 수 있어요.'}</small><PhotoCredit image={photo.image} sourceId={photo.sourceId}/></>}{failed && <small>사진을 불러오지 못했어요.</small>}<p>{place.description || '등록된 소개가 없어요.'}</p><small>{place.address || '주소 확인 필요'}</small><a href={naverDirectionsUrl(place)} target="_blank" rel="noreferrer"><MapPin size={15}/>네이버 지도에서 위치 확인</a></div></details>{tools && <div className="cplan-place-tools">{tools}</div>}</article>;
}
