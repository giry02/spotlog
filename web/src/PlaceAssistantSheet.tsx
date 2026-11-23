import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDownWideNarrow, Bookmark, Check, ChevronDown, ChevronRight, List, Map, MapPin, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import type { Place } from './data';
import { publicPlaceRegion, type HomeRegionReference } from './homeDiscovery';
import { interestKindLabels } from './interestCollectionStore';
import { configuredPlanningAiEndpoint, requestPlaceAi } from './planningAiService';
import { placeAssistantPromptLimit, placeAssistantRegions, preparePlaceAssistant, type PlaceAssistantKind } from './placeAssistantModel';
import { buildPlaceSearchPresentation, formatPlaceSearchDistance, placeSearchOriginOptions, type PlaceSearchSort } from './placeSearchPresentation';
import './place-assistant.css';

export interface PlaceAssistantSelection {
  /** Actor/room or trip/DAY identity. A late completion cannot update another selection context. */
  scopeKey: string; contextLabel: string; label: string;
  selectedIds?: ReadonlyArray<string>;
  actionLabel?: (place: Place) => string;
  onSelect: (place: Place) => string | null | Promise<string | null>;
}
export interface PlaceAssistantSheetProps {
  active: boolean; inline?: boolean;
  places: ReadonlyArray<Place>; references?: ReadonlyArray<HomeRegionReference>;
  initialRegion?: string; initialDistrict?: string; initialPrompt?: string; initialOriginId?: string; initialKind?: PlaceAssistantKind;
  savedIds?: ReadonlyArray<string>; onToggleSave?: (id: string) => void;
  onOpenPlace: (place: Place) => void; onClose: () => void;
  selection?: PlaceAssistantSelection;
}
type SearchRun = { type: 'idle' | 'busy' } | { type: 'error'; message: string }
  | { type: 'result'; mode: 'model' | 'catalog'; ids: string[]; criteriaKey: string };
const endpoint = configuredPlanningAiEndpoint(import.meta.env.VITE_PLANNING_AI_ENDPOINT);
const emptyReferences: ReadonlyArray<HomeRegionReference> = [];
const pageSize = 8;
const sorts: Array<[PlaceSearchSort, string]> = [['RECOMMENDED', '추천순'], ['MATCH', '조건 맞는순'], ['DISTANCE', '가까운순'], ['NAME', '이름순']];
const PlacesMap = lazy(() => import('./InterestPlacesMap'));

export default function PlaceAssistantSheet({ active, inline, places, references = emptyReferences, initialRegion, initialDistrict, initialPrompt, initialOriginId, initialKind='ALL', savedIds = [], onToggleSave, onOpenPlace, onClose, selection }: PlaceAssistantSheetProps) {
  const promptId = useId();
  const [prompt, setPrompt] = useState(initialPrompt?.slice(0, placeAssistantPromptLimit) ?? '');
  const [region, setRegion] = useState(''), [kind, setKind] = useState<PlaceAssistantKind>(initialKind);
  const [run, setRun] = useState<SearchRun>({ type: 'idle' });
  const [attempted, setAttempted] = useState(false), [editing, setEditing] = useState(true), [visible, setVisible] = useState(pageSize);
  const [sort, setSort] = useState<PlaceSearchSort>('RECOMMENDED');
  const [originId, setOriginId] = useState(initialOriginId || ''), [originQuery, setOriginQuery] = useState(''), [originOpen, setOriginOpen] = useState(false);
  const [selectingId, setSelectingId] = useState(''), [selectionError,setSelectionError] = useState('');
  const selectionLock = useRef<object|null>(null), selectionRef = useRef(selection), selectionEpoch = useRef(0);
  selectionRef.current = selection;
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [comparing, setComparing] = useState(false), [mapOpen, setMapOpen] = useState(false), [feedback, setFeedback] = useState('');
  const pending = useRef<{controller: AbortController; key: string} | null>(null);
  const outputRef = useRef<HTMLElement>(null), comparisonRef = useRef<HTMLElement>(null), contentRef = useRef<HTMLDivElement>(null), queryRef = useRef<HTMLDivElement>(null);
  const returnScroll = useRef<{id:string;top:number} | null>(null);
  const regions = useMemo(() => placeAssistantRegions(places, references), [places, references]);
  const input = useMemo(() => ({ prompt, region, initialRegion, initialDistrict, kind }), [prompt, region, initialRegion, initialDistrict, kind]);
  const prepared = useMemo(() => preparePlaceAssistant(input, places, references), [input, places, references]);
  const criteriaKey = useMemo(() => JSON.stringify([prepared.prompt, prepared.region, prepared.district, prepared.requestedKinds, prepared.eligiblePlaces.map(place => [place.id, place.name, place.area, place.hook, place.description, place.tags, place.lat, place.lng, place.locationVerified])]), [prepared]);
  const latest = useRef({ active, criteriaKey }); latest.current = { active, criteriaKey };
  const result = run.type === 'result' && run.criteriaKey === criteriaKey ? run : null;
  const origins = useMemo(() => placeSearchOriginOptions(places).filter(place => publicPlaceRegion(place, references) === prepared.region), [places, references, prepared.region]);
  const availableOrigin = origins.find(place => place.id === originId);
  const presentation = useMemo(() => buildPlaceSearchPresentation({ input, places, references, resultIds: result?.ids ?? [], sort, originId:availableOrigin?.id || '', mode: result?.mode ?? 'catalog' }), [input, places, references, result, sort, availableOrigin?.id]);
  const rows = presentation.rows;
  const filteredOrigins = origins.filter(place => !originQuery.trim() || `${place.name} ${place.area}`.toLowerCase().includes(originQuery.trim().toLowerCase())).slice(0, 12);
  const selectedRows = selectedIds.flatMap(id => { const row = rows.find(item => item.place.id === id); return row ? [row] : []; });
  const scopeLabel = [prepared.region, prepared.district].filter(Boolean).join(' ');
  const appliedKinds = prepared.requestedKinds.map(item => interestKindLabels[item]);

  useEffect(() => () => { pending.current?.controller.abort(); pending.current = null; }, []);
  useEffect(() => { selectionEpoch.current += 1; selectionLock.current=null; setSelectingId(''); setSelectionError(''); setFeedback(''); return () => { selectionEpoch.current += 1; selectionLock.current=null; }; }, [selection?.scopeKey]);
  useEffect(() => {
    if (pending.current && (!active || pending.current.key !== criteriaKey)) {
      pending.current.controller.abort(); pending.current = null; setRun({ type: 'idle' }); setEditing(true);
    }
    if (run.type === 'result' && run.criteriaKey !== criteriaKey) {
      setRun({ type: 'idle' }); setEditing(true); setSelectedIds([]); setComparing(false); setMapOpen(false);
      setFeedback('장소 정보나 조건이 바뀌었어요. 현재 조건으로 다시 찾아주세요.');
    }
  }, [active, criteriaKey, run]);
  useEffect(() => { if (result && active) queryRef.current?.scrollIntoView({block:'start'}); }, [result]);
  useEffect(() => {
    if (!active || !returnScroll.current) return;
    const saved = returnScroll.current; returnScroll.current = null;
    const frame = requestAnimationFrame(() => {
      const container = contentRef.current?.closest<HTMLElement>('.phase-sheet-body, .content');
      if (container) container.scrollTop = saved.top;
      contentRef.current?.querySelector<HTMLElement>(`[data-place-open="${CSS.escape(saved.id)}"]`)?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  useEffect(() => { if (comparing) comparisonRef.current?.scrollIntoView({block:'nearest'}); }, [comparing]);

  function resetSearch() {
    pending.current?.controller.abort(); pending.current = null;
    setRun({type:'idle'}); setAttempted(false); setEditing(true); setVisible(pageSize); setSelectedIds([]); setComparing(false); setMapOpen(false); setFeedback('');
  }
  function changePrompt(value: string) { resetSearch(); setPrompt(value); }
  function searchCatalog() {
    pending.current?.controller.abort(); pending.current = null; setAttempted(true); setVisible(pageSize);
    if (!prepared.issue) { setRun({type:'result', mode:'catalog', ids:prepared.localPlaceIds, criteriaKey}); setEditing(false); setSort('RECOMMENDED'); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return; setAttempted(true); setFeedback('');
    if (prepared.issue) return;
    if (!endpoint || !prepared.candidateIds.length) { searchCatalog(); return; }
    const controller = new AbortController(), key = criteriaKey;
    pending.current = {controller, key}; setVisible(pageSize); setRun({type:'busy'});
    try {
      const response = await requestPlaceAi(endpoint, {prompt:prepared.prompt, region:prepared.region, eligiblePlaceIds:prepared.candidateIds}, controller.signal);
      if (pending.current?.controller === controller && !controller.signal.aborted && latest.current.active && latest.current.criteriaKey === key) {
        setRun({type:'result', mode:'model', ids:response.placeIds, criteriaKey:key}); setEditing(false); setSort('RECOMMENDED');
      }
    } catch (cause) {
      if (pending.current?.controller === controller && !controller.signal.aborted) setRun({type:'error', message:cause instanceof Error ? cause.message : 'AI 추천을 불러오지 못했어요.'});
    } finally { if (pending.current?.controller === controller) pending.current = null; }
  }
  function chooseSort(value: PlaceSearchSort) {
    setVisible(pageSize); setFeedback('');
    if (value === 'DISTANCE' && !availableOrigin) { setOriginOpen(true); setSort(value); return; }
    setSort(value);
  }
  function openPlace(place: Place) {
    const current = places.find(item => item.id === place.id && !item.personal);
    if (!current) { setFeedback('현재 공개된 장소를 다시 확인해 주세요.'); return; }
    const container = contentRef.current?.closest<HTMLElement>('.phase-sheet-body, .content');
    returnScroll.current = {id:place.id, top:container?.scrollTop || 0};
    onOpenPlace(current);
  }
  function toggleCompare(id: string) {
    setFeedback('');
    if (selectedIds.includes(id)) { setSelectedIds(ids => ids.filter(value => value !== id)); return; }
    if (selectedRows.length >= 3) { setFeedback('한 번에 3곳까지 비교할 수 있어요. 먼저 선택한 장소를 빼주세요.'); return; }
    setSelectedIds(ids => [...ids.filter(value => rows.some(item => item.place.id === value)), id]);
  }
  async function selectPlace(place: Place) {
    if (selectionLock.current || !active || !selection) return;
    const current = places.find(item => item.id === place.id && !item.personal);
    if (!current || !rows.some(row => row.place.id === current.id)) { setFeedback('현재 조건에서 사용할 장소를 다시 확인해 주세요.'); return; }
    if (selection.selectedIds?.includes(current.id)) return;
    const epoch = selectionEpoch.current, scope = selection.scopeKey, operation={};
    selectionLock.current = operation; setSelectingId(current.id); setFeedback(''); setSelectionError('');
    try {
      const problem = await selection.onSelect(current);
      if (selectionEpoch.current !== epoch || selectionRef.current?.scopeKey !== scope) return;
      if(problem)setSelectionError(problem);else setFeedback(`${current.name} 선택을 반영했어요.`);
    } catch (cause) {
      if (selectionEpoch.current === epoch && selectionRef.current?.scopeKey === scope) setSelectionError(cause instanceof Error ? cause.message : '담지 못했어요. 장소와 선택은 그대로예요.');
    } finally { if(selectionLock.current===operation)selectionLock.current=null; if (selectionEpoch.current === epoch) setSelectingId(''); }
  }
  const selectionAction = (place: Place) => selection && <button type="button" className="place-assistant__select" aria-label={`${place.name} · ${selection.selectedIds?.includes(place.id)?'담김':selection.actionLabel?.(place)||selection.label}`} disabled={Boolean(selectingId) || selection.selectedIds?.includes(place.id)} onClick={() => void selectPlace(place)}>{selection.selectedIds?.includes(place.id) ? <><Check size={15}/>담김</> : selectingId === place.id ? '담는 중…' : selection.actionLabel?.(place) || selection.label}</button>;
  const useModel = Boolean(endpoint && prepared.candidateIds.length);
  const submitLabel = run.type === 'busy' ? '장소 찾는 중…' : useModel ? 'AI 추천 받기' : '등록 장소로 찾기';
  if (!active) return null;
  const content = <div ref={contentRef} className="place-assistant" data-has-results={Boolean(result)}>
    {selection && <p className="place-assistant__context"><MapPin size={16}/>{selection.contextLabel}<small>직접 고른 장소만 담아요.</small></p>}
    {!result && <p className="place-assistant__intro">{endpoint ? '지역과 원하는 조건을 적으면 AI가 등록 장소에서 후보를 골라줘요.' : '지역과 원하는 조건을 문장으로 적으면 등록 장소에서 찾아요.'}</p>}
    {result && <div ref={queryRef} className="place-assistant__query"><Search size={18}/><div><strong>{prompt}</strong><small>{[scopeLabel, ...appliedKinds].filter(Boolean).join(' · ')}</small></div><button type="button" aria-expanded={editing} aria-controls={`${promptId}-form`} onClick={() => setEditing(value => !value)}><SlidersHorizontal size={17}/>{editing ? '접기' : '조건 수정'}</button></div>}
    <form id={`${promptId}-form`} className="place-assistant__form" hidden={!editing} onSubmit={submit}>
      <label htmlFor={promptId}>어떤 장소를 찾고 있나요?</label>
      <textarea id={promptId} value={prompt} onChange={event => changePrompt(event.target.value)} maxLength={placeAssistantPromptLimit} rows={2} aria-describedby={`${promptId}-hint`} aria-invalid={attempted && Boolean(prepared.issue)} placeholder="예: 해운대에서 바다가 보이는 카페와 산책할 곳"/>
      <div className="place-assistant__examples" aria-label="입력 예시">{[['카페·산책', '카페와 산책할 명소를 찾아줘'], ['함께 식사', '함께 식사할 음식점을 찾아줘'], ['가볼 명소', '이번에 가볼 명소를 찾아줘']].map(([label, text]) => <button key={label} type="button" onClick={() => changePrompt(`${region || initialRegion || ''} ${text}`.trim())}>{label}</button>)}</div>
      <div className="place-assistant__filters"><label>지역<select aria-label="검색 지역" value={region} onChange={event => { resetSearch(); setOriginId(''); setRegion(event.target.value); }}><option value="">{initialRegion ? `자동 · ${initialRegion}` : '문장에서 찾기'}</option>{regions.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>장소 종류<select aria-label="검색 장소 종류" value={kind} onChange={event => { resetSearch(); setKind(event.target.value as PlaceAssistantKind); }}><option value="ALL">문장에서 찾기</option>{Object.entries(interestKindLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></div>
      <p id={`${promptId}-hint`} className="place-assistant__hint">후보의 조건과 거리를 비교할 수 있어요.</p>
      {attempted && prepared.issue && <p className="place-assistant__issue" role="alert">{prepared.issue}</p>}
      <div className="place-assistant__actions"><button type="submit" className="place-assistant__submit" disabled={run.type === 'busy'}>{useModel ? <Sparkles size={17}/> : <Search size={17}/>} {submitLabel}</button>{run.type === 'busy' && <button type="button" onClick={resetSearch}>취소</button>}</div>
    </form>
    {feedback && <p className="place-assistant__hint" role="status">{feedback}</p>}
    {selectionError && <p className="place-assistant__issue" role="alert">{selectionError}</p>}
    <section ref={outputRef} className="place-assistant__output" aria-label="장소 추천 결과" aria-busy={run.type === 'busy'}>
      {run.type === 'busy' && <div className="place-assistant__message" role="status">지역과 요청에 맞는 장소를 찾고 있어요.</div>}
      {run.type === 'error' && <div className="place-assistant__message"><p role="alert">{run.message}</p><button type="button" onClick={searchCatalog}>등록 장소로 찾기</button></div>}
      {result && <>
        <div className="place-assistant__result-heading" role="status"><div><small>{result.mode === 'model' ? 'AI가 고른 후보' : '조건에 맞는 등록 장소'}</small><h3>{scopeLabel || '검색한 지역'} · {rows.length}곳</h3></div>{rows.length > 0 && <button type="button" aria-pressed={mapOpen} onClick={() => setMapOpen(value => !value)}>{mapOpen ? <List size={17}/> : <Map size={17}/>} {mapOpen ? '목록 보기' : '지도 보기'}</button>}</div>
        {rows.length > 0 && <>
        <div className="place-assistant__sort" role="group" aria-label="장소 정렬">{sorts.map(([id, label]) => <button type="button" aria-pressed={sort === id} key={id} onClick={() => chooseSort(id)}>{id === 'RECOMMENDED' && <ArrowDownWideNarrow size={15}/>} {label}</button>)}</div>
        {presentation.requestedCount && rows.length < presentation.requestedCount && <p className="place-assistant__hint">{presentation.requestedCount}곳을 요청했지만 현재 조건에서 확인한 후보는 {rows.length}곳이에요.</p>}
        <p className="place-assistant__sort-note">{sort === 'DISTANCE' ? availableOrigin ? `${availableOrigin.name}에서의 직선거리순이에요. 도보·차량 이동 거리와는 달라요.` : '가까운순으로 보려면 아래에서 기준 장소를 골라주세요.' : sort === 'MATCH' ? '등록 설명에서 확인한 조건이 많이 맞는 순서예요.' : sort === 'NAME' ? '장소 이름의 가나다순이에요.' : result.mode === 'model' ? '요청 문장에 따라 AI가 선택한 순서예요. 실제 인기·별점 순위는 아니에요.' : '등록된 설명에서 찾는 조건을 확인한 순서예요.'}</p>
        <button type="button" className="place-assistant__origin-toggle" aria-expanded={originOpen} onClick={() => setOriginOpen(value => !value)}><MapPin size={17}/><span>{availableOrigin ? `거리 기준 · ${availableOrigin.name}` : '거리 기준 장소 선택'}</span><ChevronDown size={16}/></button>
        {originOpen && <section className="place-assistant__origin" aria-label="거리 기준 장소 고르기"><label>기준 장소 검색<input type="search" value={originQuery} onChange={event => setOriginQuery(event.target.value)} placeholder="랜드마크·카페·식당 이름"/></label><div role="group" aria-label="선택할 거리 기준 장소">{filteredOrigins.map(place => <button type="button" aria-pressed={originId === place.id} key={place.id} onClick={() => { setOriginId(place.id); setOriginOpen(false); if (sort === 'DISTANCE') setVisible(pageSize); }}><MapPin size={15}/><span><strong>{place.name}</strong><small>{place.area}</small></span>{originId === place.id && <Check size={16}/>}</button>)}{!filteredOrigins.length && <p>이 지역에서 좌표를 확인한 기준 장소가 없어요.</p>}</div>{originId && <button type="button" onClick={() => { setOriginId(''); setSort('RECOMMENDED'); }}>거리 기준 해제</button>}</section>}
        {originId && !availableOrigin && <p role="status" className="place-assistant__notice">기준 장소가 바뀌었어요. 현재 공개된 장소를 다시 선택해 주세요.</p>}
        {prepared.unverified.length > 0 && <details className="place-assistant__verification"><summary>방문 전 확인할 조건 <span>{prepared.unverified.length}</span><ChevronDown size={14}/></summary><p>{prepared.unverified.join(' · ')} 정보는 업체 안내에서 확인해 주세요. 거리 표시는 등록 좌표 사이의 직선거리예요.</p></details>}
        {selectedRows.length > 0 && <div className="place-assistant__compare-bar"><span>비교할 후보 <strong>{selectedRows.length}/3</strong></span><button type="button" disabled={selectedRows.length < 2} aria-expanded={comparing} onClick={() => setComparing(value => !value)}>{comparing ? '비교 접기' : '선택한 장소 비교'}</button><button type="button" aria-label="비교 선택 초기화" onClick={() => { setSelectedIds([]); setComparing(false); }}><X size={18}/></button></div>}
        {mapOpen && <Suspense fallback={<p role="status">지도를 불러오고 있어요.</p>}><PlacesMap places={rows.map(row => row.place)} onSelectPlace={openPlace} heading="추천 장소의 위치" ariaLabel="추천 장소 지도" mapLabel="검색한 장소 위치 지도"/></Suspense>}
        </>}
        {!rows.length && <div className="place-assistant__message"><strong>조건에 맞는 장소가 없어요</strong><p>검색 조건을 바꾸거나 특징을 줄여 다시 찾아보세요.</p><button type="button" onClick={() => setEditing(true)}>조건 수정</button>{result.mode === 'model' && <button type="button" onClick={searchCatalog}>등록 장소로 찾기</button>}</div>}
        <ol className="place-assistant__results" aria-label={`${sorts.find(([id]) => id === presentation.sort)?.[1] || '추천순'} 장소 목록`}>
          {rows.slice(0, visible).map((row, index) => { const place = row.place, saved = savedIds.includes(place.id), comparingPlace = selectedRows.some(item => item.place.id === place.id); return <li className="place-assistant__card" key={place.id}>
            <div className="place-assistant__card-heading">
              <button type="button" className="place-assistant__open" data-place-open={place.id} aria-label={`${place.name} 상세 보기`} onClick={() => openPlace(place)}>
                <span className="place-assistant__thumbnail"><MapPin size={24}/>{place.image && <img src={place.image} loading="lazy" alt="" onError={event => { event.currentTarget.hidden = true; }}/>}<span className="place-assistant__rank" aria-label={`결과 순서 ${index + 1}번째`}>{index + 1}</span></span>
                <span className="place-assistant__copy"><small>{interestKindLabels[place.kind]} · {place.area}</small><strong>{place.name}</strong>{row.distanceKm !== null && <span className="place-assistant__distance">{formatPlaceSearchDistance(row.distanceKm)}</span>}{availableOrigin && row.distanceKm === null && <span>거리 확인 전</span>}</span>
                <ChevronRight size={16} aria-hidden="true"/>
              </button>
              {onToggleSave && <button type="button" className="place-assistant__save" aria-label={`${place.name} ${saved ? '보관함에서 제거' : '보관함에 저장'}`} aria-pressed={saved} onClick={() => onToggleSave(place.id)}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'}/></button>}
            </div>
            {row.matchedConditions.length > 0 && <div className="place-assistant__matches">{row.matchedConditions.slice(0, 4).map(term => <span key={term}><Check size={12}/>{term}</span>)}</div>}
            <p className="place-assistant__reason">{row.matchedConditions.some(term => term !== interestKindLabels[place.kind]) ? row.reason : place.hook || place.description || row.reason}</p>
            <div className="place-assistant__card-actions">{selectionAction(place)}<button type="button" aria-pressed={comparingPlace} onClick={() => toggleCompare(place.id)}>{comparingPlace ? <Check size={15}/> : <PlusCompare/>}{comparingPlace ? '비교에 담음' : '후보 비교'}</button></div>
          </li>; })}
        </ol>
        {rows.length > visible && <button type="button" className="place-assistant__more" onClick={() => setVisible(value => value + pageSize)}>장소 {Math.min(pageSize, rows.length - visible)}곳 더 보기<ChevronDown size={16}/></button>}

        {comparing && selectedRows.length > 0 && <section className="place-assistant__comparison" ref={comparisonRef} aria-label="선택한 장소 비교"><h3>우리에게 맞는 곳 비교하기</h3>{selectedRows.map(row => <article key={row.place.id}><div><strong>{row.place.name}</strong><button type="button" aria-label={`${row.place.name} 비교에서 빼기`} onClick={() => toggleCompare(row.place.id)}><X size={16}/></button></div><dl><dt>종류·지역</dt><dd>{interestKindLabels[row.place.kind]} · {row.place.area}</dd><dt>맞는 조건</dt><dd>{row.matchedConditions.join(' · ') || '등록 설명에서 추가 확인'}</dd><dt>기준과 거리</dt><dd>{availableOrigin ? row.distanceKm === null ? '좌표 확인 전' : `${availableOrigin.name}에서 ${formatPlaceSearchDistance(row.distanceKm)}` : '기준 장소를 선택해 주세요'}</dd><dt>주소</dt><dd>{row.place.address || '등록 주소 확인 전'}</dd></dl><div className="place-assistant__card-actions">{selectionAction(row.place)}<button type="button" onClick={() => openPlace(row.place)}>장소 자세히 보기</button>{onToggleSave && <button type="button" aria-pressed={savedIds.includes(row.place.id)} onClick={() => onToggleSave(row.place.id)}>{savedIds.includes(row.place.id) ? '보관함에 저장됨' : '보관함에 저장'}</button>}</div></article>)}<p className="place-assistant__hint">{selection ? `${selection.contextLabel}에 쓸 장소를 직접 골라 담으세요.` : '마음에 드는 곳을 보관함에 담아 모임 약속이나 내 여행에 사용할 수 있어요.'}</p></section>}
      </>}
    </section>
  </div>;
  return inline ? content : <BottomSheet title="장소 찾기·비교" onClose={onClose}>{content}</BottomSheet>;
}
function PlusCompare() { return <span aria-hidden="true">＋</span>; }
