import { useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Plus, Search } from 'lucide-react';
import type { Place, PlaceKind } from '../data';
import type { TogetherState } from './model';
import { selectAssistantPlaces } from './activityAssistant';
import { getPlanningSupportContext } from './planningSupport';
import { planningPlaceRegion, selectPlanningPlaceCatalogue } from './planningPlaces';
import { ActivityPlaceDetail } from './ActivityPlacesRoute';
import './planning-place-picker.css';

export interface PlanningPlacePickerProps {
  state: TogetherState; userId: string; groupId: string; activityId?: string; places: Place[];
  onAdd: (placeId: string, expectedRevision?: number) => boolean | Promise<boolean>;
  onDone: () => void;
}
const kindNames: Record<PlaceKind, string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };

/** Remains in the host's original planning scope; the host preserves the hidden planning form. */
export default function PlanningPlacePicker(props: PlanningPlacePickerProps) {
  return <PlanningPlacePickerBody key={`${props.userId}:${props.groupId}:${props.activityId ?? 'group'}`} {...props}/>;
}
function PlanningPlacePickerBody({ state, userId, groupId, activityId, places, onAdd, onDone }: PlanningPlacePickerProps) {
  const [query, setQuery] = useState(''), [kind, setKind] = useState<PlaceKind | 'ALL'>('ALL'), [region, setRegion] = useState('');
  const [limit, setLimit] = useState(12), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef(false);
  const scope = { groupId, activityId };
  let context: ReturnType<typeof getPlanningSupportContext>;
  try { context = getPlanningSupportContext(state, userId, scope); }
  catch { return <section className="planning-place-picker"><p role="alert">이 공간의 현재 접근 권한을 다시 확인해 주세요.</p><button type="button" onClick={onDone}>이전 화면으로</button></section>; }
  const { group, activity, canWrite } = context;
  const preferredRegion = group.region.trim().split(/[·,\s]+/)[0] || '';
  const sharedIds = new Set(selectAssistantPlaces(state, userId, scope, places).map(item => item.id));
  const catalog = selectPlanningPlaceCatalogue(places, '', 'ALL', '', '', [...sharedIds]);
  const regions = [...new Set(catalog.map(planningPlaceRegion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const matching = selectPlanningPlaceCatalogue(places, query, kind, region, preferredRegion, [...sharedIds]), results = matching.slice(0, limit);
  const add = async (place: Place) => {
    if (pending.current || !canWrite || sharedIds.has(place.id)) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try { if (await onAdd(place.id, activity?.revision)) setStatus(`${place.name}을 이 ${activity ? '약속' : '모임'}의 후보에 담았어요.`); else setError('담지 못했어요. 입력은 유지했으니 현재 후보를 확인하고 다시 시도해 주세요.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '담지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="planning-place-picker" aria-label="장소 투표 후보 담기">
    <header><h3>함께 고를 장소를 담아요</h3><p>{activity?.title || group.name} · {activity ? '이 약속' : '모임 전체'}에만 담아요. 만나는 곳·동선·참석은 바뀌지 않아요.</p></header>
    {!canWrite && <p role="status">지난 약속·취소·보관된 공간은 후보를 확인할 수만 있어요.</p>}
    <label className="planning-picker-search"><Search size={18} aria-hidden="true"/><input autoFocus type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(12); }} placeholder="장소 이름·지역·주소 검색" aria-label="후보 장소 검색"/></label>
    <label className="planning-picker-region">지역<select value={region} onChange={event => { setRegion(event.target.value); setLimit(12); }}><option value="">전체 지역{preferredRegion ? ` · ${preferredRegion} 우선` : ''}</option>{regions.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    <div className="planning-picker-kinds" role="group" aria-label="후보 장소 종류">{(['ALL', 'FOOD', 'CAFE', 'STAY', 'LANDMARK', 'SHOP', 'LEISURE'] as const).map(value => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setLimit(12); }}>{value === 'ALL' ? '전체' : kindNames[value]}</button>)}</div>
    <div className="planning-picker-results-count"><strong>검색 결과 {matching.length}곳</strong><span>현재 후보 {sharedIds.size}곳</span></div>
    <div className="planning-picker-results">{results.map(place => { const added = sharedIds.has(place.id); return <article className="planning-picker-result" key={place.id}>
      <details><summary><span><small>{kindNames[place.kind]} · {place.area}</small><strong>{place.name}</strong><span>{place.address || '주소 확인 전'}</span></span><ChevronDown size={17} aria-hidden="true"/></summary><div className="planning-picker-detail"><ActivityPlaceDetail place={place}/></div></details>
      <button className="planning-picker-add" type="button" disabled={busy || !canWrite || added} aria-label={`${place.name} ${added ? '담은 후보' : '후보에 담기'}`} onClick={() => void add(place)}>{added ? <Check size={17} aria-hidden="true"/> : <Plus size={17} aria-hidden="true"/>}{added ? '담음' : '담기'}</button>
    </article>; })}</div>
    {!matching.length && <div className="planning-picker-empty"><strong>조건에 맞는 장소가 없어요</strong><p>다른 지역이나 종류를 선택하거나 검색어를 바꿔 보세요.</p><button type="button" onClick={() => { setQuery(''); setRegion(''); setKind('ALL'); setLimit(12); }}>검색 조건 지우기</button></div>}
    {matching.length > results.length && <button type="button" onClick={() => setLimit(value => value + 12)}>장소 더 보기 · {results.length}/{matching.length}</button>}
    {error && <p className="planning-picker-error" role="alert">{error}</p>}{status && <p className="planning-picker-status" role="status">{status}</p>}
    <footer><small>담은 후보에서 2~8곳을 골라 투표를 만들어요. 작성 중인 제목·조건·날짜는 유지해요.</small><button className="planning-picker-return" type="button" disabled={busy} onClick={onDone}><ArrowLeft size={17} aria-hidden="true"/>후보 선택으로 돌아가기 · {sharedIds.size}곳</button></footer>
  </section>;
}
