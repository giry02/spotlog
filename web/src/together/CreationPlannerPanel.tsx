import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ImageOff, MapPin, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { Place } from '../data';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { PhotoCredit } from '../PublicTourismCredit';
import { naverDirectionsUrl } from '../placeDirections';
import { configuredPlanningAiEndpoint, PLANNING_AI_CANDIDATE_LIMIT, requestGroupDraftAi, requestTripDraftAi } from '../planningAiService';
import { topicOptions } from './discovery';
import { creationBriefTopics, creationCatalogPlaces, creationCatalogRegions, interpretCreationPrompt, refreshCreationPlan, validateCreationBrief, validateCreationPlan, type CreationBrief, type CreationGroupDraft, type CreationPlan, type CreationPurpose } from './creationPlanner';
import { completeCreationReview, creationPreviewCatalog, restoreCreationPreview, type CreationPreviewDraft } from './creationPreview';
import { prepareQuickCreation, quickCreationStartDatePatch } from './quickCreation';
import { selectCreationAiCandidates } from './creationAiCandidates';
import GroupLocalityFields from './GroupLocalityFields';
import { groupLocalityIssues, parseGroupLocality } from './groupRegions';
import type { GroupTopic } from './model';
import './creation-planner.css';

export interface CreationPlannerLocalDraft extends CreationPreviewDraft { phase: 'INPUT' | 'DRAFT'; prompt: string }
export interface CreationPlannerPanelProps {
  places: Place[];
  initial?: Partial<CreationBrief>;
  initialPrompt?: string;
  allowedPurposes?: CreationPurpose[];
  submitLabel?: string;
  reviewOptions?: ReactNode;
  cancelLabel?: string;
  previewOnly?: boolean;
  onLoginRequired?: (draft: CreationPreviewDraft) => void;
  resumeDraft?: CreationPreviewDraft;
  resumeLocalDraft?: CreationPlannerLocalDraft;
  onDraftChange?: (draft: CreationPlannerLocalDraft) => void;
  onReview: (brief: CreationBrief, plan: CreationPlan | null, groupDraft?: CreationGroupDraft) => boolean | Promise<boolean>;
  onCancel?: () => void;
}

const purposes: { id: CreationPurpose; label: string }[] = [
  { id: 'MEETUP', label: '약속' }, { id: 'OUTING', label: '나들이' }, { id: 'TRIP', label: '여행' }, { id: 'GROUP', label: '모임' },
];
const placeKinds: Record<Place['kind'], string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const kindNames: Record<CreationGroupDraft['kind'], string> = { FAMILY: '가족', FRIENDS: '친구', HOBBY: '취미·지역', GUIDE: '가이드' };
const numberValue = (value: string) => value.trim() === '' ? undefined : Number(value);
const planningEndpoint = configuredPlanningAiEndpoint(import.meta.env.VITE_PLANNING_AI_ENDPOINT);
const validCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= 7;
function dateCount(start: string, end: string): number | undefined {
  if (!start || !end) return undefined;
  const value = (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000 + 1;
  return validCount(value) ? value : undefined;
}
type AiSuggestion = { brief: CreationBrief; plan: CreationPlan | null; groupDraft?: CreationGroupDraft };
type DayChange = { count: number; patch: Partial<CreationBrief> };

/** One click produces a page-memory draft. Only the explicit final save invokes the parent. */
export default function CreationPlannerPanel({ places, initial, initialPrompt = '', allowedPurposes, submitLabel, reviewOptions, cancelLabel = '취소', previewOnly = false, onLoginRequired, resumeDraft, resumeLocalDraft, onDraftChange, onReview, onCancel }: CreationPlannerPanelProps) {
  const availablePlaces = useMemo(() => previewOnly ? creationPreviewCatalog(places) : places, [places, previewOnly]);
  const choices = purposes.filter(item => !allowedPurposes || allowedPurposes.includes(item.id));
  const [context] = useState(() => Object.fromEntries(Object.entries(initial ?? {}).filter(([, value]) => value !== '' && value !== undefined)) as Partial<CreationBrief>);
  const [restored] = useState(() => {
    if (resumeDraft) return restoreCreationPreview(resumeDraft, availablePlaces);
    if (resumeLocalDraft?.phase !== 'DRAFT') return null;
    const checked = restoreCreationPreview(resumeLocalDraft, availablePlaces);
    // The same-account editor keeps even invalid values for correction and the full 2,000-character note.
    return { ...checked, brief: structuredClone(resumeLocalDraft.brief), groupDraft: resumeLocalDraft.groupDraft && structuredClone(resumeLocalDraft.groupDraft) };
  });
  const [phase, setPhase] = useState<'INPUT' | 'DRAFT'>(restored ? 'DRAFT' : resumeLocalDraft?.phase ?? 'INPUT');
  const [prompt, setPrompt] = useState(restored?.brief.prompt ?? resumeLocalDraft?.prompt ?? (initialPrompt || initial?.prompt || ''));
  const [brief, setBrief] = useState<CreationBrief>(() => restored?.brief ?? resumeLocalDraft?.brief ?? interpretCreationPrompt(initialPrompt || initial?.prompt || '', {
    ...context, purpose: choices.some(item => item.id === context.purpose) ? context.purpose : choices[0]?.id ?? 'MEETUP',
  }));
  const [plan, setPlan] = useState<CreationPlan | null>(restored?.plan ?? null);
  const [groupDraft, setGroupDraft] = useState<CreationGroupDraft | undefined>(restored?.groupDraft);
  const [activeDay, setActiveDay] = useState(1);
  const [pendingDays, setPendingDays] = useState<DayChange | null>(null);
  const [picker, setPicker] = useState<{ day: number; replaceId?: string } | null>(null);
  const [search, setSearch] = useState('');
  const [placeKind, setPlaceKind] = useState<Place['kind'] | 'ALL'>('ALL');
  const [error, setError] = useState(restored && !restored.ready ? `공개 자료나 조건이 바뀌었어요. ${restored.issues.join(' ')}` : '');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [modelPending, setModelPending] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [modelApplied, setModelApplied] = useState(false);
  const [startWithAi, setStartWithAi] = useState(Boolean(planningEndpoint));
  const requestRef = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const draftCallback = useRef(onDraftChange);
  draftCallback.current = onDraftChange;
  useEffect(() => {
    const value = phase === 'INPUT' ? { brief: { ...brief, prompt }, plan: null } : structuredClone({ brief, plan, ...(groupDraft ? { groupDraft } : {}) });
    draftCallback.current?.({ ...value, phase, prompt });
  }, [phase, prompt, brief, plan, groupDraft]);
  const currentPlaces = useRef(availablePlaces);
  currentPlaces.current = availablePlaces;
  const headingRef = useRef<HTMLDivElement>(null);
  const regionId = useId();
  const locked = busy || completed;
  const isGroup = brief.purpose === 'GROUP';
  const regionOptions = useMemo(() => creationCatalogRegions(availablePlaces), [availablePlaces]);
  const catalog = useMemo(() => creationCatalogPlaces(brief, availablePlaces), [brief.region, availablePlaces]);
  const publicPlaces = useMemo(() => creationPreviewCatalog(availablePlaces), [availablePlaces]);
  const publicById = useMemo(() => new Map(publicPlaces.map(place => [place.id, place])), [publicPlaces]);
  const catalogById = new Map(catalog.map(place => [place.id, place]));
  const selectedTopics = creationBriefTopics(brief);
  const day = plan?.days.find(row => row.day === activeDay) ?? plan?.days[0];
  const issues = phase !== 'DRAFT' ? [] : isGroup
    ? [...validateCreationBrief(brief), ...groupLocalityIssues(parseGroupLocality(groupDraft?.region || brief.region)), ...(!groupDraft?.name.trim() ? ['모임 이름을 입력해 주세요.'] : []), ...(!groupDraft?.introduction.trim() ? ['모임 소개를 입력해 주세요.'] : [])]
    : [...(plan ? validateCreationPlan(brief, plan, availablePlaces) : ['일정 초안을 다시 확인해 주세요.']), ...(brief.startTime && !brief.date ? ['시작 시각을 정하려면 날짜도 함께 정해 주세요.'] : [])];
  const uniqueIssues = [...new Set(issues)];
  const cancelModel = () => { requestRef.current?.abort(); requestRef.current = null; setModelPending(false); };
  const invalidateModel = () => { cancelModel(); setSuggestion(null); setError(''); };
  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, []);
  useEffect(() => { requestRef.current?.abort(); requestRef.current = null; setModelPending(false); setSuggestion(null); }, [availablePlaces]);

  const makeDraft = () => {
    invalidateModel();
    const next = prepareQuickCreation({ purpose: brief.purpose, prompt, initial: context, preferPromptRegion: true }, availablePlaces);
    setBrief(next.brief); setPlan(next.plan); setGroupDraft(next.groupDraft);
    setActiveDay(1); setPicker(null); setPendingDays(null); setModelApplied(false); setPhase('DRAFT');
    setError(next.issues.join(' '));
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    return next;
  };

  const updateBrief = (patch: Partial<CreationBrief>) => {
    invalidateModel();
    const next = { ...brief, ...patch };
    if (patch.region !== undefined) next.locationUndecided = !isGroup && plan?.placeIds.length ? false : !patch.region.trim() || Boolean(brief.locationUndecided);
    setBrief(next);
    if (plan) setPlan(refreshCreationPlan(next, plan, availablePlaces));
    if (groupDraft && patch.region !== undefined) setGroupDraft({ ...groupDraft, region: patch.region });
  };
  const updateGroup = (patch: Partial<CreationGroupDraft>) => { invalidateModel(); setGroupDraft(current => current ? { ...current, ...patch } : current); };
  const updatePlan = (next: CreationPlan, nextBrief = brief) => {
    invalidateModel();
    const withLocation = { ...nextBrief, locationUndecided: !next.placeIds.length };
    setBrief(withLocation); setPlan(refreshCreationPlan(withLocation, next, availablePlaces));
  };
  const updateTopics = (topic: GroupTopic, selected: boolean) => {
    const topics = [...new Set(selected ? [...selectedTopics, topic] : selectedTopics.filter(id => id !== topic))];
    const theme: CreationBrief['theme'] = topics.includes('OUTDOOR') || topics.includes('WALK') ? 'FOLIAGE' : topics.includes('FOOD') ? 'FOOD' : topics.includes('CAFE') ? 'CAFE' : topics.includes('CULTURE') ? 'CULTURE' : topics.includes('TRAVEL') ? 'TRAVEL' : 'OTHER';
    updateBrief({ topics, theme });
    if (groupDraft) setGroupDraft({ ...groupDraft, topics });
  };

  const applyDays = ({ count, patch }: DayChange) => {
    if (!plan) return;
    const days = Array.from({ length: count }, (_, index) => ({ day: index + 1, placeIds: [...(plan.days[index]?.placeIds ?? [])] }));
    const overflow = plan.days.slice(count).flatMap(row => row.placeIds);
    days[count - 1].placeIds.push(...overflow);
    const nextBrief = { ...brief, ...patch };
    if (nextBrief.purpose === 'TRIP') nextBrief.dayCount = count;
    else nextBrief.dayCount = undefined;
    if (nextBrief.date) Object.assign(nextBrief, quickCreationStartDatePatch(nextBrief.purpose, nextBrief.date, count));
    updatePlan({ ...plan, days, placeIds: days.flatMap(row => row.placeIds) }, nextBrief);
    setActiveDay(current => Math.min(current, count)); setPendingDays(null); setPicker(null);
  };
  const requestDays = (count: number, patch: Partial<CreationBrief> = {}) => {
    if (!plan || !validCount(count)) return;
    invalidateModel();
    const next = { count, patch };
    if (plan.days.slice(count).some(row => row.placeIds.length)) { setPendingDays(next); return; }
    applyDays(next);
  };
  const changeDuration = (count: number) => {
    const patch: Partial<CreationBrief> = {};
    if (brief.date && brief.endDate && Number.isFinite(Date.parse(brief.date))) patch.endDate = new Date(Date.parse(`${brief.date}T12:00:00Z`) + (count - 1) * 86400000).toISOString().slice(0, 10);
    requestDays(count, patch);
  };
  const changeStartDate = (date: string) => {
    try {
      const patch = quickCreationStartDatePatch(brief.purpose, date, plan?.days.length ?? brief.dayCount ?? 1);
      if (patch.date !== brief.date || patch.endDate !== brief.endDate) updateBrief(patch);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '날짜를 확인해 주세요.'); }
  };
  const changeEndDate = (value: string) => {
    if (value === brief.endDate) return;
    const count = dateCount(brief.date, value);
    if (count) requestDays(count, { endDate: value });
    else updateBrief({ endDate: value });
  };
  const changePurpose = (purpose: CreationPurpose) => {
    if (purpose === brief.purpose || purpose === 'GROUP') return;
    requestDays(purpose === 'TRIP' ? Math.max(2, plan?.days.length ?? 2) : 1, { purpose, endDate: purpose === 'TRIP' ? brief.endDate : '' });
  };
  const removePlace = (id: string) => {
    if (!plan) return;
    const days = plan.days.map(row => ({ ...row, placeIds: row.placeIds.filter(value => value !== id) }));
    updatePlan({ ...plan, days, placeIds: days.flatMap(row => row.placeIds) });
  };
  const reorderPlace = (id: string, offset: number) => {
    if (!plan || !day) return;
    const ids = [...day.placeIds], index = ids.indexOf(id), target = index + offset;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const days = plan.days.map(row => row.day === day.day ? { ...row, placeIds: ids } : row);
    updatePlan({ ...plan, days, placeIds: days.flatMap(row => row.placeIds) });
  };
  const movePlace = (id: string, target: number) => {
    if (!plan) return;
    const days = plan.days.map(row => ({ ...row, placeIds: [...row.placeIds.filter(value => value !== id), ...(row.day === target ? [id] : [])] }));
    updatePlan({ ...plan, days, placeIds: days.flatMap(row => row.placeIds) });
  };
  const pickPlace = (id: string) => {
    if (!plan || !picker || !catalogById.has(id) || plan.placeIds.includes(id)) return;
    if (!picker.replaceId && plan.placeIds.length >= 35) { setError('한 일정에는 장소를 35곳까지 담을 수 있어요.'); return; }
    const days = plan.days.map(row => row.day !== picker.day ? row : { ...row, placeIds: picker.replaceId ? row.placeIds.map(value => value === picker.replaceId ? id : value) : [...row.placeIds, id] });
    updatePlan({ ...plan, days, placeIds: days.flatMap(row => row.placeIds) }); setPicker(null); setSearch('');
  };
  const clearPlaces = () => {
    if (!plan) return;
    updatePlan({ ...plan, placeIds: [], days: plan.days.map(row => ({ ...row, placeIds: [] })) });
    setPicker(null);
  };

  const askModel = async (draft?: { brief: CreationBrief; plan: CreationPlan | null; groupDraft?: CreationGroupDraft }) => {
    if (requestRef.current || locked) return;
    if (!planningEndpoint) { setError('AI 서버가 연결되어 있지 않아요. 지금 초안은 그대로 수정하고 저장할 수 있어요.'); return; }
    const currentBrief = draft?.brief ?? brief;
    const currentPlan = draft ? draft.plan : plan;
    const currentGroup = draft ? draft.groupDraft : groupDraft;
    const groupPurpose = currentBrief.purpose === 'GROUP';
    const currentCatalog = selectCreationAiCandidates(currentBrief, currentPlaces.current);
    const currentIds = new Set(currentCatalog.map(place => place.id));
    if (!currentBrief.region.trim()) { setError('어느 지역에서 만날까요? 초안에서 지역을 정하면 AI 제안을 받을 수 있어요.'); return; }
    const controller = new AbortController();
    requestRef.current = controller; setModelPending(true); setSuggestion(null); setError('');
    const active = () => requestRef.current === controller && !controller.signal.aborted;
    const modelPrompt = groupPurpose && currentGroup
      ? ['모임 이름은 유지하고 소개와 첫 활동 아이디어를 다듬어 주세요.', `모임 이름: ${currentGroup.name}`, `현재 소개: ${currentGroup.introduction}`, currentBrief.prompt ? `하고 싶은 일: ${currentBrief.prompt}` : ''].filter(Boolean).join('\n')
      : currentBrief.prompt || currentPlan?.title || '함께할 시간을 계획해 주세요.';
    const modelBrief = { ...currentBrief, prompt: modelPrompt.slice(0, 600), notes: currentBrief.notes.slice(0, 1500) };
    try {
      if (groupPurpose) {
        const response = await requestGroupDraftAi(planningEndpoint, modelBrief, controller.signal);
        if (!active()) return;
        if (!response || !currentGroup) throw new Error('AI 제안을 받지 못했어요. 지금 모임 초안은 그대로예요.');
        setSuggestion({ brief: modelBrief, plan: null, groupDraft: {
          ...currentGroup, introduction: response.introduction,
          ...(response.firstActivityIdea !== undefined ? { firstActivityIdea: response.firstActivityIdea } : {}),
        } });
      } else {
        const ids = [...new Set([...(currentPlan?.placeIds.filter(id => currentIds.has(id)) ?? []), ...currentCatalog.map(place => place.id)])].slice(0, PLANNING_AI_CANDIDATE_LIMIT);
        if (!ids.length) throw new Error('이 지역에 제안할 등록 장소가 없어요. 지금 초안은 장소 미정으로 저장할 수 있어요.');
        const aiBrief = { ...modelBrief, locationUndecided: false };
        const response = await requestTripDraftAi(planningEndpoint, aiBrief, currentPlan?.days.length ?? 1, ids, controller.signal);
        if (!active()) return;
        if (!response) throw new Error('조건에 맞는 AI 제안을 받지 못했어요. 지금 초안은 그대로예요.');
        const proposed = refreshCreationPlan(aiBrief, { id: 'catalog-ai-proposal', source: 'CATALOG', title: response.title, days: response.days, placeIds: response.days.flatMap(row => row.placeIds), explanation: [], unknowns: [] }, currentPlaces.current);
        const problems = validateCreationPlan(aiBrief, proposed, currentPlaces.current);
        if (problems.length) throw new Error(problems.join(' '));
        setSuggestion({ brief: { ...currentBrief, locationUndecided: false }, plan: proposed });
      }
    } catch (cause) { if (active()) setError(cause instanceof Error ? cause.message : 'AI 제안을 받지 못했어요. 지금 초안은 그대로예요.'); }
    finally { if (active()) { requestRef.current = null; setModelPending(false); } }
  };
  const applySuggestion = () => {
    if (!suggestion) return;
    if (suggestion.plan) {
      const problems = validateCreationPlan(suggestion.brief, suggestion.plan, currentPlaces.current);
      if (problems.length) { setError(problems.join(' ')); setSuggestion(null); return; }
      setBrief(suggestion.brief); setPlan(refreshCreationPlan(suggestion.brief, suggestion.plan, currentPlaces.current)); setActiveDay(1);
    } else if (suggestion.groupDraft) setGroupDraft(suggestion.groupDraft);
    setSuggestion(null); setModelApplied(true); setPicker(null); setError('');
  };
  const submit = async () => {
    if (inFlight.current || completed || phase !== 'DRAFT') return;
    if (pendingDays) { setError('일수를 줄일 때 장소를 어떻게 옮길지 먼저 확인해 주세요.'); return; }
    if (uniqueIssues.length) {
      if (isGroup) headingRef.current?.parentElement?.querySelector<HTMLDetailsElement>('details.cplan-locality')?.setAttribute('open', '');
      setError(uniqueIssues.join(' ')); return;
    }
    cancelModel(); setSuggestion(null); inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await completeCreationReview({ brief, plan, groupDraft, previewOnly, checked: true, dateUnconfirmed: !brief.date }, availablePlaces, { onReview, onLoginRequired });
      if (result === 'SAVED') setCompleted(true);
      else if (result === 'REJECTED') setError('저장하지 못했어요. 입력과 선택을 유지했으니 다시 시도해 주세요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 지금 초안은 그대로예요.'); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const pickerPlaces = catalog.filter(place => !plan?.placeIds.includes(place.id) && (placeKind === 'ALL' || place.kind === placeKind) && (!search.trim() || `${place.name} ${place.address} ${place.area}`.toLowerCase().includes(search.trim().toLowerCase())));
  const finalLabel = previewOnly ? '로그인하고 저장' : isGroup ? '모임 만들기' : submitLabel || (brief.purpose === 'TRIP' ? '여행 만들기' : '약속 만들기');
  const examples = isGroup ? ['주말에 함께 책 읽는 모임', '우리 가족', '동네 맛집 탐방 모임'] : brief.purpose === 'TRIP' ? ['가족과 2박 3일 여행, 음식점과 숙소도', '친구들과 당일 바다 여행'] : ['친구들과 저녁 식사', '주말에 산책하고 커피 한 잔', '회사 회식'];

  const aiTools = <details className="cplan-more cplan-ai" open={modelPending || Boolean(suggestion) || undefined}><summary><span><Sparkles size={17}/>AI로 더 다듬기 · 선택</span><ChevronDown size={17}/></summary><div className="cplan-stack"><p className="cplan-note">{isGroup ? '모임 소개와 첫 활동 아이디어를 제안받아요.' : '입력한 조건과 공개 장소로 방문 순서를 제안받아요.'} 지금 초안은 제안을 직접 적용할 때까지 유지돼요.</p>{planningEndpoint ? <><small>입력한 조건{isGroup ? '' : '과 공개 장소 후보'}만 AI 서버에 보내요.</small><button type="button" disabled={modelPending} onClick={() => void askModel()}><Sparkles size={17}/>{modelPending ? 'AI 제안 준비 중…' : isGroup ? 'AI 소개 제안받기' : 'AI 동선 제안받기'}</button></> : <p className="cplan-note">AI 서버 연결 후 사용할 수 있어요. 지금은 이 초안을 직접 수정해 주세요.</p>}{modelPending && <button type="button" onClick={cancelModel}>AI 요청 취소</button>}
          {suggestion && <section className="cplan-ai-proposal" aria-label="적용 전 AI 제안"><strong>AI 제안 · 아직 적용하지 않았어요</strong>{suggestion.groupDraft ? <><h4>{suggestion.groupDraft.name}</h4><p>{suggestion.groupDraft.introduction}</p>{suggestion.groupDraft.firstActivityIdea && <small>{suggestion.groupDraft.firstActivityIdea}</small>}</> : suggestion.plan && <><h4>{suggestion.plan.title}</h4><ol>{suggestion.plan.days.map(row => <li key={row.day}><strong>DAY {row.day}</strong><p>{row.placeIds.map(id => publicById.get(id)?.name ?? '공개 정보 확인 필요').join(' → ') || '장소 미정'}</p></li>)}</ol><small>실제 경로·영업 시간·요금·예약은 확인이 필요해요.</small></>}<div className="cplan-proposal-actions"><button type="button" onClick={() => setSuggestion(null)}>지금 초안 유지</button><button type="button" onClick={applySuggestion}>이 제안 적용</button></div></section>}
        </div></details>;

  return <section className="creation-planner cplan-quick" aria-label="간단하게 모임과 일정 만들기">
    <div className="cplan-top" ref={headingRef}>
      <div className="cplan-quick-heading"><div><h3>{phase === 'INPUT' ? isGroup ? '어떤 모임을 만들까요?' : brief.purpose === 'TRIP' ? '어떤 여행을 떠날까요?' : '어떤 약속을 만들까요?' : '초안에서 바로 고쳐요'}</h3><small>{phase === 'INPUT' ? '한 줄만 적거나, 비워 두고 시작해도 돼요.' : isGroup ? '이름과 소개를 확인하고 모임을 만들어요.' : '이름·장소·날짜를 원하는 만큼만 바꾸세요.'}</small></div><span className="cplan-phase-label">{phase === 'INPUT' ? '시작' : modelApplied ? 'AI 제안 적용' : '기본 초안'}</span></div>
      {restored && phase === 'DRAFT' && <p className="cplan-note">{resumeDraft ? '로그인 전에 만든 초안이에요. 내용을 확인한 뒤 저장해 주세요.' : '작성하던 초안을 이어서 고칠 수 있어요.'}</p>}
    </div>
    <datalist id={regionId}>{regionOptions.map(region => <option value={region} key={region}/>)}</datalist>
    <fieldset className="cplan-content cplan-stack" disabled={locked}>
      {phase === 'INPUT' ? <>
        <label>{isGroup ? '모임 이름이나 하고 싶은 일' : '이름이나 하고 싶은 일'}<textarea value={prompt} maxLength={1000} rows={3} placeholder={isGroup ? '예: 주말에 함께 책 읽는 모임' : brief.purpose === 'TRIP' ? '예: 부산으로 가족과 2박 3일 여행' : '예: 친구들과 저녁 식사'} onChange={event => { setPrompt(event.target.value); setError(''); }}/></label>
        <div className="cplan-quick-examples" aria-label="입력 예시">{examples.map(example => <button type="button" key={example} onClick={() => setPrompt(example)}>{example}</button>)}</div>
        <p className="cplan-note">{brief.region ? `${brief.region}에서 시작해요. ` : ''}지역·날짜·장소는 초안에서 정해도 돼요.</p>
        {planningEndpoint && <label className="cplan-check"><input type="checkbox" checked={startWithAi} onChange={event => setStartWithAi(event.target.checked)}/><span>AI로 초안 제안받기<small>적은 내용과 공개 장소 후보로 제안해요. 저장 전에 직접 확인할 수 있어요.</small></span></label>}
      </> : <>
        {(modelPending || suggestion) && aiTools}
        <section className="cplan-editor-section" aria-label={isGroup ? '모임 기본 정보' : '일정 기본 정보'}>
          {isGroup && groupDraft ? <>
            <label>모임 이름<input value={groupDraft.name} maxLength={100} onChange={event => updateGroup({ name: event.target.value })}/></label>
            <label>모임 소개<textarea value={groupDraft.introduction} maxLength={3000} rows={3} onChange={event => updateGroup({ introduction: event.target.value })}/></label>
          </> : plan && <label>일정 이름<input value={plan.title} maxLength={100} onChange={event => updatePlan({ ...plan, title: event.target.value })}/></label>}
          {isGroup && groupDraft && <details className="cplan-locality"><summary><MapPin size={17}/><span><small>활동 지역</small><strong>{groupDraft.region || '미정 · 나중에 정해도 돼요'}</strong></span><span>변경</span><ChevronDown size={16}/></summary><GroupLocalityFields {...parseGroupLocality(groupDraft.region)} onChange={value => updateBrief({ region: [value.region, value.district, value.neighborhood].filter(Boolean).join(' ') })}/></details>}
          <div className={isGroup ? undefined : 'cplan-two'}>
            {!isGroup && <label>활동 지역<input list={regionId} value={brief.region} maxLength={80} placeholder="미정 · 나중에 선택" onChange={event => updateBrief({ region: event.target.value })}/></label>}
            {isGroup && groupDraft ? <label>모임 구분<select value={groupDraft.kind} onChange={event => updateGroup({ kind: event.target.value as CreationGroupDraft['kind'] })}>{Object.entries(kindNames).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
              : brief.purpose === 'TRIP' ? <label>여행 일수<select value={plan?.days.length ?? brief.dayCount ?? 2} onChange={event => changeDuration(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => <option value={index + 1} key={index}>{index === 0 ? '당일' : `${index}박 ${index + 1}일`}</option>)}</select></label>
                : <label>날짜 · 선택<input type="date" value={brief.date} onInput={event => changeStartDate(event.currentTarget.value)} onChange={event => changeStartDate(event.currentTarget.value)} onBlur={event => changeStartDate(event.currentTarget.value)}/></label>}
          </div>
          {!isGroup && <details className="cplan-more"><summary>날짜·인원 등 더 정하기<ChevronDown size={17}/></summary><div className="cplan-stack">
            {brief.purpose === 'TRIP' && <div className="cplan-two"><label>시작 날짜 · 선택<input type="date" value={brief.date} onInput={event => changeStartDate(event.currentTarget.value)} onChange={event => changeStartDate(event.currentTarget.value)} onBlur={event => changeStartDate(event.currentTarget.value)}/></label><label>마지막 날짜 · 선택<input type="date" value={brief.endDate} onInput={event => changeEndDate(event.currentTarget.value)} onChange={event => changeEndDate(event.currentTarget.value)} onBlur={event => changeEndDate(event.currentTarget.value)}/></label></div>}
            <div className="cplan-two"><label>시작 시각 · 선택<input type="time" value={brief.startTime} onChange={event => updateBrief({ startTime: event.target.value })}/></label><label>예상 인원 · 선택<input type="number" min="1" max="300" value={brief.people ?? ''} placeholder="미정" onChange={event => updateBrief({ people: numberValue(event.target.value) })}/></label></div>
            <div className="cplan-two"><label>이동 수단<select value={brief.transport} onChange={event => updateBrief({ transport: event.target.value as CreationBrief['transport'] })}><option value="UNSET">미정</option><option value="WALK">도보</option><option value="PUBLIC">대중교통</option><option value="CAR">자동차</option></select></label>{choices.filter(item => item.id !== 'GROUP').length > 1 && <label>일정 종류<select value={brief.purpose} onChange={event => changePurpose(event.target.value as CreationPurpose)}>{choices.filter(item => item.id !== 'GROUP').map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>}</div>
          </div></details>}
        </section>

        {!isGroup && plan && <section className="cplan-editor-section cplan-itinerary" aria-label="방문할 장소 편집">
          <div className="cplan-section-heading"><h4>{brief.purpose === 'TRIP' ? '우리 여행 동선' : '함께 갈 장소'}</h4><small>{plan.placeIds.length ? `${plan.placeIds.length}곳` : '장소 미정'}</small></div>
          {plan.days.length > 1 && <div className="cplan-day-tabs" role="tablist" aria-label="여행 날짜">{plan.days.map(row => <button type="button" role="tab" aria-selected={row.day === (day?.day ?? 1)} key={row.day} onClick={() => { setActiveDay(row.day); setPicker(null); }}>DAY {row.day}<small>{row.placeIds.length}곳</small></button>)}</div>}
          {pendingDays && <div className="cplan-change-confirm" role="alert"><strong>{pendingDays.count}일로 줄이면 뒤쪽 DAY가 없어져요.</strong><p>담아 둔 장소는 DAY {pendingDays.count}로 모두 옮겨 보관할까요?</p><div><button type="button" onClick={() => setPendingDays(null)}>변경 취소</button><button type="button" onClick={() => applyDays(pendingDays)}>장소 옮기고 줄이기</button></div></div>}
          <div className="cplan-places">{day?.placeIds.length ? day.placeIds.map((id, index) => {
            const place = publicById.get(id);
            return place ? <PlannerPlace key={id} place={place} invalid={!catalogById.has(id)} tools={<>
              <span className="cplan-order">{index + 1}</span><button type="button" className="cplan-icon" aria-label={`${place.name} 위로 이동`} disabled={index === 0} onClick={() => reorderPlace(id, -1)}><ArrowUp size={16}/></button><button type="button" className="cplan-icon" aria-label={`${place.name} 아래로 이동`} disabled={index === day.placeIds.length - 1} onClick={() => reorderPlace(id, 1)}><ArrowDown size={16}/></button>
              <details className="cplan-place-options"><summary aria-label={`${place.name} 편집`}>편집<ChevronDown size={15}/></summary><div><button type="button" onClick={() => { setPicker({ day: day.day, replaceId: id }); setSearch(''); }}>다른 장소</button>{plan.days.length > 1 && <label className="cplan-sr-only" htmlFor={`${regionId}-${id}`}>옮길 DAY</label>}{plan.days.length > 1 && <select id={`${regionId}-${id}`} aria-label={`${place.name} 옮길 DAY`} value={day.day} onChange={event => movePlace(id, Number(event.target.value))}>{plan.days.map(row => <option value={row.day} key={row.day}>DAY {row.day}</option>)}</select>}<button type="button" aria-label={`${place.name} 빼기`} onClick={() => removePlace(id)}><Trash2 size={16}/></button></div></details>
            </>}/> : <article key={id} className="cplan-invalid-place"><p>공개 정보가 바뀐 장소가 있어요. 다시 선택하거나 빼 주세요.</p><button type="button" onClick={() => removePlace(id)}>이 장소 빼기</button></article>;
          }) : <div className="cplan-empty"><MapPin size={24}/><strong>장소는 나중에 정해도 괜찮아요.</strong><p>음식점·카페·숙소를 담으면 방문 순서로 이어져요.</p></div>}</div>
          <button type="button" className="cplan-add-place" onClick={() => { setPicker({ day: day?.day ?? 1 }); setSearch(''); }}><Plus size={17}/>장소 추가</button>
          {plan.placeIds.some(id => !catalogById.has(id)) && <div className="cplan-change-confirm"><p>지역이나 공개 정보가 바뀌었어요. 담은 장소를 유지한 채 확인 중이에요.</p><button type="button" onClick={clearPlaces}>담은 장소 비우고 장소 미정으로</button></div>}
          {picker && <section className="cplan-replace" aria-label="등록 장소 선택"><div className="cplan-replace-head"><div><h4>{picker.replaceId ? '바꿀 장소' : '함께 갈 장소'}</h4><small>DAY {picker.day} · {brief.region || '활동 지역을 먼저 선택해 주세요.'}</small></div><button type="button" className="cplan-icon" aria-label="장소 선택 닫기" onClick={() => setPicker(null)}><X size={18}/></button></div>{!brief.region && <label>찾아볼 지역<input list={regionId} value={brief.region} placeholder="예: 부산" onChange={event => updateBrief({ region: event.target.value })}/></label>}<div className="cplan-picker-search"><label>이름·주소 검색<input value={search} onChange={event => setSearch(event.target.value)} placeholder="장소 이름이나 주소"/></label><label>종류<select aria-label="담을 장소 종류" value={placeKind} onChange={event => setPlaceKind(event.target.value as Place['kind'] | 'ALL')}><option value="ALL">전체</option>{Object.entries(placeKinds).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><small>바로 담거나, 사진을 눌러 상세 정보를 확인하세요.</small><div className="cplan-catalog-list">{pickerPlaces.length ? pickerPlaces.map(place => <PlannerCandidate key={place.id} place={place} label={picker.replaceId ? '바꾸기' : '담기'} onPick={() => pickPlace(place.id)}/>) : <p className="cplan-note">{brief.region ? '조건에 맞는 등록 장소가 없어요. 검색어나 지역을 바꿔 보세요.' : '지역을 정하면 등록 장소를 보여드려요.'}</p>}</div></section>}
          <small>방문 순서는 자유롭게 바꿀 수 있어요. 실제 이동 경로·시간과 예약은 따로 확인해 주세요.</small>
        </section>}

        <details className="cplan-more cplan-editor-advanced"><summary>{isGroup ? '관심사·가입 방식 등 더 정하기' : '관심사·예산·요청 더 정하기'}<ChevronDown size={17}/></summary><div className="cplan-stack">
          <div className="cplan-topic-picks">{topicOptions.map(topic => <label className="cplan-check" key={topic.id}><input type="checkbox" checked={selectedTopics.includes(topic.id)} onChange={event => updateTopics(topic.id, event.target.checked)}/><span>{topic.label}</span></label>)}</div>
          {isGroup && groupDraft ? <>
            <label>가입 방식<select value={groupDraft.joinMode ?? 'DIRECT'} onChange={event => updateGroup({ joinMode: event.target.value as 'DIRECT' | 'APPROVAL' })}><option value="DIRECT">바로 가입</option><option value="APPROVAL">모임장 승인 후 가입</option></select></label>
            <label>환영 안내<input value={groupDraft.welcome ?? ''} maxLength={500} onChange={event => updateGroup({ welcome: event.target.value })}/></label><label>가입 안내<textarea value={groupDraft.joinGuide ?? ''} maxLength={1000} rows={2} onChange={event => updateGroup({ joinGuide: event.target.value })}/></label><label>첫 활동 아이디어<textarea value={groupDraft.firstActivityIdea ?? ''} maxLength={500} rows={2} onChange={event => updateGroup({ firstActivityIdea: event.target.value })}/></label><small>아이디어를 적어도 실제 약속이나 채팅방을 자동으로 만들지 않아요.</small>
          </> : <div className="cplan-two"><label>희망 예산 · 1인<input type="number" min="0" value={brief.budgetPerPerson ?? ''} placeholder="미정" onChange={event => updateBrief({ budgetPerPerson: numberValue(event.target.value) })}/></label><label>희망 걷기 · 분<input type="number" min="0" max="600" value={brief.walkingLimitMinutes ?? ''} placeholder="미정" onChange={event => updateBrief({ walkingLimitMinutes: numberValue(event.target.value) })}/></label></div>}
          <label>하고 싶은 일<textarea value={brief.prompt} maxLength={1000} rows={2} onChange={event => { setPrompt(event.target.value); updateBrief({ prompt: event.target.value }); }}/></label>
          <label>추가 조건<textarea value={brief.notes} maxLength={2000} rows={2} onChange={event => updateBrief({ notes: event.target.value })}/></label><small>조건을 바꿔도 담은 장소는 유지돼요.</small>
        </div></details>

        {!modelPending && !suggestion && aiTools}

        {plan && <details className="cplan-unknowns"><summary>방문 전에 확인할 내용<ChevronDown size={17}/></summary><ul>{plan.unknowns.map((value, index) => <li key={index}>{value}</li>)}</ul></details>}
        {!previewOnly && !isGroup && reviewOptions}
        <div className="cplan-save-summary"><strong>{isGroup ? '비공개 모임으로 시작해요.' : `${brief.date || '날짜 미정'}${brief.startTime ? ` · ${brief.startTime}` : ''} · ${brief.region || '지역 미정'}${!plan?.placeIds.length ? ' · 장소 미정' : ` · ${plan.placeIds.length}곳`}`}</strong><small>{previewOnly ? '로그인한 뒤 이 초안을 다시 확인하고 저장해요.' : isGroup ? '만든 뒤 필요한 사람을 초대하거나 홍보할 수 있어요.' : '아래 버튼을 누르면 이 내용으로 저장해요. 초대·참석·예약은 따로 진행해요.'}</small>{modelApplied && <small>AI 제안을 적용한 뒤 직접 확인 중이에요.</small>}</div>
        {uniqueIssues.length > 0 && <div className="cplan-validation" role="status"><strong>저장 전에 확인해 주세요.</strong><ul>{uniqueIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      </>}
    </fieldset>
    {error && <p className="cplan-error" role="alert">{error}</p>}
    {completed && <p className="cplan-success" role="status">저장했어요.</p>}
    <div className="cplan-actions cplan-quick-actions">
      {onCancel && <button type="button" disabled={locked} onClick={() => { cancelModel(); onCancel(); }}>{cancelLabel}</button>}
      <button type="button" className="cplan-primary" disabled={locked || modelPending || Boolean(pendingDays)} onClick={() => { if (phase === 'INPUT') { const next = makeDraft(); if (startWithAi && prompt.trim()) void askModel(next); } else void submit(); }}>{phase === 'INPUT' ? startWithAi && prompt.trim() ? 'AI로 초안 만들기' : '초안 만들기' : modelPending ? 'AI 제안 준비 중…' : completed ? '저장 완료' : busy ? '저장 중…' : finalLabel}{phase === 'DRAFT' && !busy && !completed && !modelPending && <Check size={17}/>}</button>
    </div>
  </section>;
}

function PlannerCandidate({ place, label, onPick }: { place: Place; label: string; onPick: () => void }) {
  const photo = getPlacePhotos(place, true)[0];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo?.image]);
  return <article className="cplan-candidate"><details><summary>{photo && !failed ? <img src={photo.image} alt="" loading="lazy" onError={() => setFailed(true)}/> : <span className="cplan-candidate-fallback"><ImageOff size={18}/></span>}<span><strong>{place.name}</strong><small>{placeKinds[place.kind]} · {place.area}</small></span><ChevronDown size={15}/></summary><div className="cplan-place-content">{photo && !failed && <><img src={photo.image} alt={photo.alt || place.name} loading="lazy" onError={() => setFailed(true)}/><small>{photo.sourceId ? '등록 장소 사진' : '참고 이미지 · 해당 장소의 실제 모습과 다를 수 있어요.'}</small><PhotoCredit image={photo.image} sourceId={photo.sourceId}/></>}<p>{place.description || '등록된 소개가 없어요.'}</p><small>{place.address}</small><a href={naverDirectionsUrl(place)} target="_blank" rel="noreferrer"><MapPin size={15}/>지도에서 확인</a></div></details><button type="button" onClick={onPick} aria-label={`${place.name} ${label}`}><Plus size={15}/>{label}</button></article>;
}

function PlannerPlace({ place, tools, invalid }: { place: Place; tools?: ReactNode; invalid?: boolean }) {
  const photo = getPlacePhotos(place, true)[0];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo?.image]);
  return <article className={`cplan-place${invalid ? ' cplan-place--invalid' : ''}`}><details><summary>{photo && !failed ? <img className="cplan-place-thumb" src={photo.image} alt="" loading="lazy" onError={() => setFailed(true)}/> : <span className="cplan-place-thumb"><ImageOff size={21} aria-hidden="true"/></span>}<span className="cplan-place-title"><small>{placeKinds[place.kind]}</small><strong>{place.name}</strong><small>{invalid ? '현재 지역 조건 확인 필요' : place.area}</small></span><ChevronDown size={17}/></summary><div className="cplan-place-content">{photo && !failed && <><img src={photo.image} alt={photo.alt || place.name} loading="lazy" onError={() => setFailed(true)}/><small>{photo.sourceId ? '등록 장소 사진' : '참고 이미지 · 해당 장소의 실제 모습과 다를 수 있어요.'}</small><PhotoCredit image={photo.image} sourceId={photo.sourceId}/></>}{failed && <small>사진을 불러오지 못했어요.</small>}<p>{place.description || '등록된 소개가 없어요.'}</p><small>{place.address || '주소 확인 필요'}</small><a href={naverDirectionsUrl(place)} target="_blank" rel="noreferrer"><MapPin size={15}/>네이버 지도에서 위치 확인</a></div></details>{tools && <div className="cplan-place-tools">{tools}</div>}</article>;
}
