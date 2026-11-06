import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Folder, FolderPlus, Plus, Trash2, X } from 'lucide-react';
import type { Place, PlaceKind } from './data';
import { createInterestCollection, filterInterestPlaces, interestKindLabels, interestPlaceRegion, interestStorageKey, readInterestCollections, removeInterestCollection, renameInterestCollection, setInterestCollectionPlaces, writeInterestCollections, type InterestCollectionsState, type InterestStorage } from './interestCollectionStore';
import './interest-collections.css';

export interface InterestCollectionsProps {
  places: Place[];
  viewerId: string;
  onAddToTrip: (place: Place) => void;
  onCreateTrip: (places: Place[]) => void;
  onExplore: () => void;
  onVisiblePlaceIdsChange: (ids: string[] | null) => void;
}
function deviceStorage(): InterestStorage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }

/** Remount scoped UI at account boundaries so a previous account never flashes. */
export default function InterestCollections(props: InterestCollectionsProps) { return <InterestCollectionsPanel key={props.viewerId} {...props} />; }
function InterestCollectionsPanel({ places, viewerId, onAddToTrip, onCreateTrip, onExplore, onVisiblePlaceIdsChange }: InterestCollectionsProps) {
  const [storage] = useState(deviceStorage);
  const [loaded, setLoaded] = useState(() => readInterestCollections(storage, viewerId));
  const [selectedId, setSelectedId] = useState('');
  const [region, setRegion] = useState('');
  const [kind, setKind] = useState<PlaceKind | ''>('');
  const [panel, setPanel] = useState<'create' | 'rename' | 'places' | 'delete' | null>(null);
  const [name, setName] = useState('');
  const [folderRegion, setFolderRegion] = useState('');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = loaded.state.collections.find(item => item.id === selectedId);
  const scopedPlaces = useMemo(() => filterInterestPlaces(places, selected, region), [places, selected, region]);
  const visible = useMemo(() => filterInterestPlaces(places, selected, region, kind), [places, selected, region, kind]);
  const regions = useMemo(() => [...new Set(places.map(interestPlaceRegion))].sort((a, b) => a.localeCompare(b, 'ko')), [places]);
  const folderPlaces = selected ? places.filter(place => selected.placeIds.includes(place.id)) : [];
  const visibleKey = JSON.stringify(visible.map(place => place.id));
  useEffect(() => { onVisiblePlaceIdsChange(selected || region || kind ? JSON.parse(visibleKey) as string[] : null); }, [selectedId, Boolean(selected), region, kind, visibleKey, onVisiblePlaceIdsChange]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key !== null && event.key !== interestStorageKey(viewerId)) return;
      setLoaded(readInterestCollections(storage, viewerId)); setPanel(null); setError('');
    };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, [storage, viewerId]);
  useEffect(() => { if (selectedId && !selected) { setSelectedId(''); setPanel(null); } }, [selectedId, selected]);
  const commit = (next: InterestCollectionsState, message: string): boolean => {
    try {
      const saved = writeInterestCollections(storage, next, loaded.state.revision);
      setLoaded({ state: saved, status: 'ready', message: '' }); setError(''); setNotice(message); setPanel(null); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : '목록을 저장하지 못했어요.'); return false; }
  };
  const switchFolder = (id: string) => { setSelectedId(id); setPanel(null); setNotice(''); setError(''); };
  const create = () => {
    try {
      const next = createInterestCollection(loaded.state, name, folderRegion);
      if (commit(next, '새 목록을 만들었어요. 저장한 장소를 담아보세요.')) { setSelectedId(next.collections.at(-1)!.id); setPickedIds([]); setPickerSearch(''); setPanel('places'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '목록 이름을 확인해 주세요.'); }
  };
  const writable = loaded.status === 'ready';
  const pickerPlaces = places.filter(place => !pickerSearch.trim() || `${place.name} ${place.area} ${interestKindLabels[place.kind]}`.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()));
  return <section className="interest-collections" aria-label="관심 장소 목록 관리">
    <div className="interest-folder-strip" aria-label="내 장소 목록">
      <button type="button" className={!selected ? 'is-active' : ''} aria-pressed={!selected} onClick={() => switchFolder('')}>전체 장소 <span>{places.length}</span></button>
      {loaded.state.collections.map(folder => <button type="button" className={selected?.id === folder.id ? 'is-active' : ''} aria-pressed={selected?.id === folder.id} key={folder.id} onClick={() => switchFolder(folder.id)}><Folder size={15} aria-hidden="true" /><span className="interest-folder-name">{folder.title}</span><span>{places.filter(place => folder.placeIds.includes(place.id)).length}</span></button>)}
      <button type="button" className="interest-folder-create" disabled={!writable} onClick={() => { setPanel(panel === 'create' ? null : 'create'); setName(''); setFolderRegion(region); setError(''); }}><FolderPlus size={17} aria-hidden="true" />새 목록</button>
    </div>
    <div className="interest-filters">
      <label><span>지역</span><select value={region} onChange={event => setRegion(event.target.value)}><option value="">전체 지역</option>{regions.map(area => <option key={area} value={area}>{area}</option>)}</select></label>
    </div>
    <div className="interest-kind-filter" role="group" aria-label="관심 장소 종류">
      <button type="button" aria-pressed={!kind} aria-label={`전체 장소 ${scopedPlaces.length}곳`} onClick={() => setKind('')}>전체<span className="interest-kind-count">{scopedPlaces.length}</span></button>
      {Object.entries(interestKindLabels).map(([value, label]) => {
        const count = scopedPlaces.filter(place => place.kind === value).length;
        return <button type="button" key={value} aria-pressed={kind === value} aria-label={`${label} ${count}곳`} onClick={() => setKind(current => current === value ? '' : value as PlaceKind)}>{label}<span className="interest-kind-count">{count}</span></button>;
      })}
    </div>
    {selected && <div className="interest-folder-overview"><div><strong>{selected.title}</strong><span>{selected.region ? `${selected.region} · ` : ''}{folderPlaces.length}곳 저장</span></div><button type="button" className="interest-text-button" aria-expanded={panel === 'rename'} onClick={() => { setName(selected.title); setFolderRegion(selected.region ?? ''); setPanel(panel === 'rename' ? null : 'rename'); setError(''); }}>목록 관리{panel === 'rename' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>}
    {(panel === 'create' || panel === 'rename') && <form className="interest-edit-panel" onSubmit={event => { event.preventDefault(); if (panel === 'create') create(); else if (selected) { try { commit(renameInterestCollection(loaded.state, selected.id, name, folderRegion), '목록 정보를 저장했어요.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '이름을 확인해 주세요.'); } } }}>
      <div className="interest-panel-heading"><strong>{panel === 'create' ? '새 목록 만들기' : '목록 관리'}</strong><button type="button" className="interest-icon-button" aria-label="목록 편집 닫기" onClick={() => { setPanel(null); setError(''); }}><X size={18} /></button></div>
      <label><span>목록 이름</span><input value={name} maxLength={80} placeholder="예: 부산 부모님과 갈 곳" onChange={event => setName(event.target.value)} autoFocus /></label>
      <label><span>목록 지역 · 선택</span><input value={folderRegion} maxLength={80} placeholder="예: 부산" onChange={event => setFolderRegion(event.target.value)} /></label>
      <div className="interest-panel-actions">{panel === 'rename' && <button type="button" className="interest-danger" disabled={!writable} onClick={() => setPanel('delete')}><Trash2 size={16} />목록 삭제</button>}<button type="submit" className="interest-primary" disabled={!writable || !name.trim()}>{panel === 'create' ? '목록 만들기' : '변경 저장'}</button></div>
    </form>}
    {panel === 'delete' && selected && <div className="interest-edit-panel"><strong>‘{selected.title}’ 목록을 삭제할까요?</strong><p>목록만 삭제돼요. 저장한 장소와 여행 일정은 그대로 남아요.</p><div className="interest-panel-actions"><button type="button" onClick={() => setPanel('rename')}>취소</button><button type="button" className="interest-danger" onClick={() => { if (commit(removeInterestCollection(loaded.state, selected.id), '목록을 삭제했어요. 저장한 장소는 그대로예요.')) setSelectedId(''); }}>목록 삭제</button></div></div>}
    {selected && panel !== 'create' && <div className="interest-folder-actions"><button type="button" disabled={!writable} aria-expanded={panel === 'places'} onClick={() => { setPickedIds(folderPlaces.map(place => place.id)); setPickerSearch(''); setPanel(panel === 'places' ? null : 'places'); setError(''); }}><Plus size={16} />장소 담기·빼기</button>{folderPlaces.length === 1 ? <button type="button" onClick={() => onAddToTrip(folderPlaces[0])}>여행에 담기</button> : <button type="button" disabled={!folderPlaces.length} onClick={() => onCreateTrip(folderPlaces)}>이 목록으로 여행 만들기</button>}</div>}
    {panel === 'places' && selected && <div className="interest-edit-panel"><div className="interest-panel-heading"><strong>저장한 장소에서 선택</strong><button type="button" className="interest-icon-button" aria-label="장소 선택 닫기" onClick={() => setPanel(null)}><X size={18} /></button></div>
      {places.length ? <><input aria-label="목록에 담을 장소 검색" type="search" value={pickerSearch} placeholder="장소명·지역 검색" onChange={event => setPickerSearch(event.target.value)} /><div className="interest-place-picker">{pickerPlaces.map(place => <label key={place.id} className="interest-place-option"><input type="checkbox" checked={pickedIds.includes(place.id)} onChange={event => setPickedIds(current => event.target.checked ? [...new Set([...current, place.id])] : current.filter(id => id !== place.id))} /><span><strong>{place.name}</strong><small>{interestKindLabels[place.kind]} · {place.area}</small></span></label>)}{!pickerPlaces.length && <p>검색한 장소가 없어요.</p>}</div><button type="button" className="interest-primary interest-full-button" onClick={() => { try { commit(setInterestCollectionPlaces(loaded.state, selected.id, pickedIds, places), '목록의 장소를 저장했어요.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '장소를 확인해 주세요.'); } }}><Check size={16} />{pickedIds.length}곳 선택 완료</button></> : <><p>장소를 먼저 저장한 뒤 이 목록에 담아보세요.</p><button type="button" onClick={onExplore}>장소 둘러보기</button></>}
    </div>}
    {(loaded.message || error) && <div className="interest-error" role="alert"><p>{error || loaded.message}</p><button type="button" onClick={() => { setLoaded(readInterestCollections(storage, viewerId)); setPanel(null); setError(''); }}>다시 불러오기</button></div>}
    {notice && <p className="interest-notice" role="status">{notice}</p>}
    {selected && !visible.length && panel !== 'places' && <div className="interest-folder-empty"><Folder size={22} aria-hidden="true" /><p>{folderPlaces.length ? '조건에 맞는 장소가 없어요.' : '이 목록에 갈 곳을 담아보세요.'}</p>{folderPlaces.length ? <button type="button" onClick={() => { setRegion(''); setKind(''); }}>필터 초기화</button> : <button type="button" disabled={!writable} onClick={() => { setPickedIds([]); setPanel('places'); }}><Plus size={16} />장소 선택</button>}</div>}
  </section>;
}
