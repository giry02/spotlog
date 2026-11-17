import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bookmark, ChevronRight, MapPin, Search, Sparkles } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import type { Place } from './data';
import type { HomeRegionReference } from './homeDiscovery';
import { interestKindLabels } from './interestCollectionStore';
import { configuredPlanningAiEndpoint, requestPlaceAi } from './planningAiService';
import { placeAssistantPromptLimit, placeAssistantRegions, preparePlaceAssistant, type PlaceAssistantKind } from './placeAssistantModel';
import './place-assistant.css';

interface PlaceAssistantSheetProps {
  active: boolean;
  inline?: boolean;
  places: ReadonlyArray<Place>;
  references?: ReadonlyArray<HomeRegionReference>;
  initialRegion?: string;
  initialDistrict?: string;
  initialPrompt?: string;
  savedIds: ReadonlyArray<string>;
  onToggleSave: (id: string) => void;
  onOpenPlace: (place: Place) => void;
  onClose: () => void;
}

type SearchRun = { type: 'idle' | 'busy' | 'error' }
  | { type: 'result'; mode: 'model' | 'catalog'; ids: string[] };

const endpoint = configuredPlanningAiEndpoint(import.meta.env.VITE_PLANNING_AI_ENDPOINT);
const emptyReferences: ReadonlyArray<HomeRegionReference> = [];
const resultPageSize = 8;

export default function PlaceAssistantSheet({ active, inline, places, references = emptyReferences, initialRegion, initialDistrict, initialPrompt, savedIds, onToggleSave, onOpenPlace, onClose }: PlaceAssistantSheetProps) {
  const promptId = useId();
  const [prompt, setPrompt] = useState(initialPrompt?.slice(0, placeAssistantPromptLimit) ?? '');
  const [region, setRegion] = useState('');
  const [kind, setKind] = useState<PlaceAssistantKind>('ALL');
  const [run, setRun] = useState<SearchRun>({ type: 'idle' });
  const [attempted, setAttempted] = useState(false);
  const [visible, setVisible] = useState(resultPageSize);
  const request = useRef<AbortController | null>(null);
  const status = useRef<HTMLElement>(null);
  const regions = useMemo(() => placeAssistantRegions(places, references), [places, references]);
  const prepared = useMemo(() => preparePlaceAssistant({ prompt, region, initialRegion, initialDistrict, kind }, places, references), [prompt, region, initialRegion, initialDistrict, kind, places, references]);
  const displayPlaces = useMemo(() => {
    if (run.type !== 'result') return [];
    const byId = new Map(prepared.eligiblePlaces.map(place => [place.id, place]));
    return [...new Set(run.ids)].flatMap(id => {
      const place = byId.get(id);
      return place ? [place] : [];
    });
  }, [prepared.eligiblePlaces, run]);

  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => {
    if (run.type === 'result' || run.type === 'error') status.current?.scrollIntoView({ block: 'nearest' });
  }, [run]);

  function resetSearch() {
    request.current?.abort();
    request.current = null;
    setRun({ type: 'idle' });
    setAttempted(false);
    setVisible(resultPageSize);
  }

  function changePrompt(value: string) {
    resetSearch();
    setPrompt(value);
  }

  function searchCatalog() {
    request.current?.abort();
    request.current = null;
    setAttempted(true);
    setVisible(resultPageSize);
    if (!prepared.issue) setRun({ type: 'result', mode: 'catalog', ids: prepared.localPlaceIds });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    setAttempted(true);
    if (prepared.issue) return;
    if (!endpoint || prepared.candidateIds.length === 0) {
      searchCatalog();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setVisible(resultPageSize);
    setRun({ type: 'busy' });
    try {
      const response = await requestPlaceAi(endpoint, {
        prompt: prepared.prompt,
        region: prepared.region,
        eligiblePlaceIds: prepared.candidateIds,
      }, controller.signal);
      if (request.current === controller && !controller.signal.aborted) {
        setRun({ type: 'result', mode: 'model', ids: response.placeIds });
      }
    } catch {
      if (request.current === controller && !controller.signal.aborted) setRun({ type: 'error' });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  const scopeLabel = [prepared.region, prepared.district].filter(Boolean).join(' ');
  const initialScopeLabel = [initialRegion, initialDistrict].filter(Boolean).join(' ');
  const appliedScope = [scopeLabel, ...prepared.requestedKinds.map(item => interestKindLabels[item])].filter(Boolean).join(' · ');
  const useModel = Boolean(endpoint && prepared.candidateIds.length);
  const submitLabel = run.type === 'busy' ? '장소 찾는 중…' : run.type === 'error' ? 'AI 다시 시도' : useModel ? 'AI 추천 받기' : '등록 장소로 찾기';
  const SearchIcon = useModel ? Sparkles : Search;

  if (!active) return null;
  const content = <div className="place-assistant">
      <form className="place-assistant__form" onSubmit={submit}>
        <label htmlFor={promptId}>어떤 장소를 찾고 있나요?</label>
        <textarea id={promptId} value={prompt} onChange={event => changePrompt(event.target.value)} maxLength={placeAssistantPromptLimit} rows={3}
          aria-describedby={`${promptId}-hint`} aria-invalid={attempted && Boolean(prepared.issue)}
          placeholder="예: 부산 해운대에서 바다가 보이는 카페나 가볼 만한 명소" />
        <div className="place-assistant__examples" aria-label="입력 예시">
          {[
            ['바다 전망 카페', '부산 해운대에서 바다 전망 카페를 찾아줘'],
            ['식사와 카페', '부산에서 저녁 먹을 음식점과 카페를 찾아줘'],
            ['숙소와 명소', '제주에서 숙소와 가까운 명소를 찾아줘'],
          ].map(([label, example]) => <button key={label} type="button" onClick={() => changePrompt(example)}>{label}</button>)}
        </div>
        <div className="place-assistant__filters">
          <label>지역<select value={region} onChange={event => { resetSearch(); setRegion(event.target.value); }}>
            <option value="">{initialScopeLabel ? `문장 우선 · ${initialScopeLabel}` : '문장에서 찾기'}</option>
            {regions.map(option => <option key={option} value={option}>{option}</option>)}
          </select></label>
          <label>장소 종류<select value={kind} onChange={event => { resetSearch(); setKind(event.target.value as PlaceAssistantKind); }}>
            <option value="ALL">문장에서 찾기</option>
            {Object.entries(interestKindLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select></label>
        </div>
        <p id={`${promptId}-hint`} className="place-assistant__hint">{endpoint ? '입력한 문장과 공개 장소 후보를 바탕으로 추천해요.' : 'AI 연결 전에는 스팟로그에 등록된 장소를 찾아드려요.'}</p>
        {attempted && prepared.issue && <p className="place-assistant__issue" role="alert">{prepared.issue}</p>}
        <div className="place-assistant__actions">
          <button type="submit" className="place-assistant__submit" disabled={run.type === 'busy'}><SearchIcon aria-hidden size={18} />{submitLabel}</button>
          {run.type === 'busy' && <button type="button" className="place-assistant__secondary" onClick={resetSearch}>취소</button>}
        </div>
      </form>

      <section ref={status} className="place-assistant__output" aria-label="장소 추천 결과" aria-busy={run.type === 'busy'}>
        {run.type === 'error' && <div className="place-assistant__message">
          <p role="alert">AI 추천을 불러오지 못했어요. 다시 시도하거나 등록 장소에서 찾아보세요.</p>
          <button type="button" className="place-assistant__secondary" onClick={searchCatalog}>등록 장소로 찾기</button>
        </div>}
        {run.type === 'result' && <>
          <div className="place-assistant__result-heading" role="status">
            <h3>{run.mode === 'model' ? 'AI 추천' : '등록 장소'} {displayPlaces.length}곳</h3>
            {appliedScope && <small>{appliedScope}</small>}
          </div>
          {prepared.unverified.length > 0 && <p className="place-assistant__notice">{prepared.unverified.join(' · ')} 조건은 방문 전에 확인해 주세요.</p>}
          {run.mode === 'catalog' && prepared.broadCatalog && displayPlaces.length > 0 && <p className="place-assistant__hint">지역에 등록된 장소예요. 찾는 장소의 종류나 이름을 더해 검색할 수 있어요.</p>}
          {displayPlaces.length === 0 && <div className="place-assistant__message">
            <p>{run.mode === 'catalog' && prepared.missingDescriptions
              ? '등록 정보에서 조건과 일치하는 장소를 찾지 못했어요. 특징을 빼거나 종류를 바꿔보세요.'
              : '조건에 맞는 장소를 찾지 못했어요. 지역이나 장소 종류를 바꿔보세요.'}</p>
            {run.mode === 'model' && <button type="button" className="place-assistant__secondary" onClick={searchCatalog}>등록 장소로 찾기</button>}
          </div>}
          {displayPlaces.length > 0 && <ul className="place-assistant__results">
            {displayPlaces.slice(0, visible).map(place => {
              const saved = savedIds.includes(place.id);
              return <li key={place.id}>
                <button type="button" className="place-assistant__open" aria-label={`${place.name} 상세 보기`} onClick={() => onOpenPlace(place)}>
                  <span className="place-assistant__thumbnail"><MapPin aria-hidden size={20} />{place.image && <img alt="" src={place.image} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}</span>
                  <span className="place-assistant__copy">
                    <small>{interestKindLabels[place.kind]}{place.area && ` · ${place.area}`}</small>
                    <strong>{place.name}</strong>
                    {(place.hook || place.description) && <span>{place.hook || place.description}</span>}
                  </span>
                  <ChevronRight aria-hidden size={16} />
                </button>
                <button type="button" className="place-assistant__save" aria-label={`${place.name} ${saved ? '보관함에서 제거' : '보관함에 저장'}`}
                  aria-pressed={saved} onClick={() => onToggleSave(place.id)}><Bookmark aria-hidden size={21} fill={saved ? 'currentColor' : 'none'} /></button>
              </li>;
            })}
          </ul>}
          {displayPlaces.length > visible && <button type="button" className="place-assistant__secondary" onClick={() => setVisible(count => count + resultPageSize)}>장소 더 보기</button>}
        </>}
      </section>
    </div>;
  return inline ? content : <BottomSheet title="AI로 장소 찾기" onClose={onClose}>{content}</BottomSheet>;
}
