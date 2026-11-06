import { useId, useRef, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { MY_REGION_OPTIONS, emptyMyRegions, readMyRegions, writeMyRegions, type MyRegionName, type MyRegionsState, type MyRegionsStorage } from './discoveryRegionStore';
import './my-regions.css';

export interface MyRegionSheetProps { ownerId: string; onClose: () => void; onSaved: (state: MyRegionsState) => void }
type RegionDraft = { id: string; region: MyRegionName | ''; district: string };
function deviceStorage(): MyRegionsStorage | null { try { return window.localStorage; } catch { return null; } }
const regionId = () => `my-region-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const blankRegion = (): RegionDraft => ({ id: regionId(), region: '', district: '' });
const draftRegions = (state: MyRegionsState): RegionDraft[] => state.regions.map(entry => ({ ...entry, district: entry.district ?? '' }));

/** Remount the editor at account boundaries; a guest's settings are never merged into a member's. */
export default function MyRegionSheet(props: MyRegionSheetProps) { return <RegionEditor key={props.ownerId} {...props}/>; }
function RegionEditor({ ownerId, onClose, onSaved }: MyRegionSheetProps) {
  const [storage, setStorage] = useState(deviceStorage);
  const [loaded, setLoaded] = useState(() => readMyRegions(storage, ownerId));
  const [entries, setEntries] = useState<RegionDraft[]>(() => loaded.state.regions.length ? draftRegions(loaded.state) : [blankRegion()]);
  const [activeId, setActiveId] = useState<string | null>(() => loaded.state.activeId ?? entries[0]?.id ?? null);
  const [error, setError] = useState('');
  const [invalidId, setInvalidId] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const helperId = useId(), errorId = useId();
  const writable = loaded.status === 'ready';
  const update = (id: string, patch: Partial<RegionDraft>) => { setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...patch } : entry)); setError(''); setInvalidId(''); };
  const add = () => {
    if (entries.length >= 3) return;
    const entry = blankRegion(); setEntries(current => [...current, entry]);
    if (!entries.length) setActiveId(entry.id);
    setError(''); setInvalidId('');
  };
  const remove = (id: string) => {
    const next = entries.filter(entry => entry.id !== id); setEntries(next);
    if (id === activeId) setActiveId(next[0]?.id ?? null);
    setError(''); setInvalidId('');
  };
  const reload = () => {
    const currentStorage = deviceStorage(); setStorage(currentStorage);
    const next = readMyRegions(currentStorage, ownerId); setLoaded(next); setError(''); setInvalidId('');
    if (next.status === 'ready') { setEntries(draftRegions(next.state)); setActiveId(next.state.activeId); }
  };
  const save = () => {
    if (saving.current || !writable) return;
    const missing = entries.find(entry => !entry.region);
    if (missing) {
      setInvalidId(missing.id); setError('활동할 시·도를 선택해 주세요. 사용하지 않을 항목은 삭제할 수 있어요.');
      [...(form.current?.querySelectorAll<HTMLSelectElement>('select[data-my-region]') ?? [])].find(select => select.dataset.myRegion === missing.id)?.focus(); return;
    }
    saving.current = true;
    let saved: MyRegionsState;
    try {
      const next: MyRegionsState = { ...emptyMyRegions(ownerId), revision: loaded.state.revision, activeId: entries.length ? activeId : null,
        regions: entries.map(entry => ({ id: entry.id, region: entry.region as MyRegionName, ...(entry.district.trim() ? { district: entry.district.trim() } : {}) })) };
      saved = writeMyRegions(storage, next, loaded.state.revision);
      setLoaded({ state: saved, status: 'ready', message: '' });
    } catch (cause) { saving.current = false; setError(cause instanceof Error ? cause.message : '지역을 저장하지 못했어요. 입력 내용은 유지했어요.'); return; }
    onSaved(saved); onClose();
  };
  return <BottomSheet title="내 지역 설정" description="기본 활동 지역 1곳과 관심 지역 2곳까지 저장해요." onClose={onClose}>
    <form className="my-regions" ref={form} onSubmit={event => { event.preventDefault(); save(); }}>
      <p id={helperId} className="my-regions-help">활동하거나 찾아보고 싶은 지역을 직접 선택해 주세요. 동네는 시·군·구·동까지만 적고 상세 주소는 입력하지 마세요.</p>
      <div className="my-regions-list">
        {entries.map((entry, index) => <fieldset className="my-region-entry" key={entry.id} disabled={!writable}>
          <legend className="my-regions-sr-only">지역 {index + 1}</legend>
          <div className="my-region-heading"><strong><MapPin size={17} aria-hidden="true"/>{entry.id === activeId ? '기본 활동 지역' : `관심 지역 ${entries.slice(0, index + 1).filter(value => value.id !== activeId).length}`}</strong><button type="button" className="my-region-icon" aria-label={`지역 ${index + 1} 삭제`} onClick={() => remove(entry.id)}><Trash2 size={18} aria-hidden="true"/></button></div>
          <div className="my-region-fields"><label>시·도<select data-my-region={entry.id} aria-label={`지역 ${index + 1} 시·도`} aria-invalid={invalidId === entry.id} aria-describedby={invalidId === entry.id ? errorId : helperId} value={entry.region} onChange={event => update(entry.id, { region: event.target.value as MyRegionName | '', district: '' })}><option value="">시·도 선택</option>{MY_REGION_OPTIONS.map(region => <option key={region} value={region}>{region}</option>)}</select></label><label>시·군·구·동 · 선택<input aria-label={`지역 ${index + 1} 동네`} value={entry.district} disabled={!entry.region} maxLength={40} autoComplete="off" spellCheck={false} placeholder="예: 해운대구 / 성수동" aria-describedby={helperId} onChange={event => update(entry.id, { district: event.target.value })}/></label></div>
          <label className="my-region-default"><input type="radio" name={`${helperId}-active`} value={entry.id} checked={activeId === entry.id} onChange={() => { setActiveId(entry.id); setError(''); }}/><span>{activeId === entry.id ? '이 지역을 기본으로 사용해요' : '기본 활동 지역으로 사용'}</span></label>
        </fieldset>)}
      </div>
      {!entries.length && <p className="my-regions-empty">저장할 지역이 없어요. 지역을 추가하거나 비워 둔 상태로 저장할 수 있어요.</p>}
      <button type="button" className="my-regions-add" disabled={!writable || entries.length >= 3} onClick={add}><Plus size={18} aria-hidden="true"/>{entries.length >= 3 ? '지역은 최대 3곳까지 저장할 수 있어요' : entries.length ? '관심 지역 추가' : '활동 지역 추가'}</button>
      {!writable && <div className="my-regions-error" role="alert"><p>{loaded.message}</p><button type="button" onClick={reload}>다시 불러오기</button></div>}
      {error && <div className="my-regions-error" role="alert"><p id={errorId}>{error}</p><button type="button" onClick={reload}>저장된 설정 다시 불러오기</button></div>}
      <p className="my-regions-storage">이 기기에 계정별로 저장돼요. 다른 기기와의 동기화는 아직 제공하지 않아요.{ownerId === 'guest-device' && ' 로그인 전 설정은 로그인 후 지역에 자동으로 합쳐지지 않아요.'} 현재 위치를 조회하거나 저장하지 않아요.</p>
      <button type="submit" className="my-regions-save" disabled={!writable}>내 지역 저장</button>
    </form>
  </BottomSheet>;
}
