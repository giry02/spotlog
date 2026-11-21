import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { emptyMyRegions, readMyRegions, writeMyRegions, type MyRegionName, type MyRegionsState, type MyRegionsStorage } from './discoveryRegionStore';
import GroupLocalityFields from './together/GroupLocalityFields';
import { groupLocalityIssues } from './together/groupRegions';
import { acquireCurrentArea, CURRENT_AREA_CONSENT_VERSION, CURRENT_AREA_LOCATION_NOTICE, CURRENT_AREA_PROVIDER_ATTRIBUTION, CURRENT_AREA_PROVIDER_URL, type CurrentArea } from './currentAreaService';
import './my-regions.css';

export interface MyRegionSheetProps { ownerId: string; onClose: () => void; onSaved: (state: MyRegionsState) => void; submitLabel?: string }
type RegionDraft = { id: string; region: MyRegionName | ''; district: string; neighborhood: string };
function deviceStorage(): MyRegionsStorage | null { try { return window.localStorage; } catch { return null; } }
const regionId = () => `my-region-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const blankRegion = (): RegionDraft => ({ id: regionId(), region: '', district: '', neighborhood: '' });
const draftRegions = (state: MyRegionsState): RegionDraft[] => state.regions.map(entry => ({ ...entry, district: entry.district ?? '', neighborhood: entry.neighborhood ?? '' }));

/** Remount the editor at account boundaries; a guest's settings are never merged into a member's. */
export default function MyRegionSheet(props: MyRegionSheetProps) { return <RegionEditor key={props.ownerId} {...props}/>; }
function RegionEditor({ ownerId, onClose, onSaved, submitLabel = '내 지역 저장' }: MyRegionSheetProps) {
  const [storage, setStorage] = useState(deviceStorage);
  const [loaded, setLoaded] = useState(() => readMyRegions(storage, ownerId));
  const [entries, setEntries] = useState<RegionDraft[]>(() => loaded.state.regions.length ? draftRegions(loaded.state) : [blankRegion()]);
  const [activeId, setActiveId] = useState<string | null>(() => loaded.state.activeId ?? entries[0]?.id ?? null);
  const [error, setError] = useState('');
  const [invalidId, setInvalidId] = useState('');
  const [locationConsentOpen, setLocationConsentOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [currentArea, setCurrentArea] = useState<CurrentArea | null>(null);
  const locationRequest = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const helperId = useId(), errorId = useId();
  const writable = loaded.status === 'ready';
  const cancelLocation = () => { locationRequest.current?.abort(); locationRequest.current = null; setLocating(false); };
  const invalidateLocation = () => { cancelLocation(); setCurrentArea(null); setLocationError(''); };
  useEffect(() => () => { locationRequest.current?.abort(); locationRequest.current = null; }, []);
  const close = () => { cancelLocation(); onClose(); };
  const update = (id: string, patch: Partial<RegionDraft>) => { invalidateLocation(); setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...patch } : entry)); setError(''); setInvalidId(''); };
  const locate = async () => {
    if (!writable || locationRequest.current || saving.current) return;
    const controller = new AbortController();
    locationRequest.current = controller; setLocating(true); setLocationError(''); setCurrentArea(null);
    const targetId = entries.find(entry => entry.id === activeId)?.id ?? entries[0]?.id ?? regionId();
    const active = () => locationRequest.current === controller && !controller.signal.aborted;
    try {
      const area = await acquireCurrentArea({ consent: { accepted: true, purpose: 'GROUP_NEARBY', version: CURRENT_AREA_CONSENT_VERSION }, signal: controller.signal });
      if (!active()) return;
      const value: RegionDraft = { id: targetId, region: area.region, district: area.district, neighborhood: area.neighborhood ?? '' };
      setEntries(current => current.some(entry => entry.id === targetId) ? current.map(entry => entry.id === targetId ? value : entry) : [value, ...current]);
      setActiveId(targetId); setCurrentArea(area); setLocationConsentOpen(false); setError(''); setInvalidId('');
    } catch (cause) {
      if (active()) setLocationError(cause instanceof Error ? cause.message : '현재 동네를 확인하지 못했어요. 아래에서 직접 선택할 수 있어요.');
    } finally {
      if (active()) { locationRequest.current = null; setLocating(false); }
    }
  };
  const add = () => {
    if (entries.length >= 3) return;
    invalidateLocation();
    const entry = blankRegion(); setEntries(current => [...current, entry]);
    if (!entries.length) setActiveId(entry.id);
    setError(''); setInvalidId('');
  };
  const remove = (id: string) => {
    invalidateLocation();
    const next = entries.filter(entry => entry.id !== id); setEntries(next);
    if (id === activeId) setActiveId(next[0]?.id ?? null);
    setError(''); setInvalidId('');
  };
  const reload = () => {
    invalidateLocation();
    const currentStorage = deviceStorage(); setStorage(currentStorage);
    const next = readMyRegions(currentStorage, ownerId); setLoaded(next); setError(''); setInvalidId('');
    if (next.status === 'ready') { setEntries(draftRegions(next.state)); setActiveId(next.state.activeId); }
  };
  const save = () => {
    if (saving.current || !writable) return;
    cancelLocation();
    const missing = entries.find(entry => !entry.region);
    if (missing) {
      setInvalidId(missing.id); setError('활동할 시·도를 선택해 주세요. 사용하지 않을 항목은 삭제할 수 있어요.');
      [...(form.current?.querySelectorAll<HTMLSelectElement>('select') ?? [])].find(select => select.id === `${missing.id}-region`)?.focus(); return;
    }
    const localityError = entries.flatMap(entry => groupLocalityIssues(entry))[0];
    if (localityError) { setError(localityError); return; }
    saving.current = true;
    let saved: MyRegionsState;
    try {
      const next: MyRegionsState = { ...emptyMyRegions(ownerId), revision: loaded.state.revision, activeId: entries.length ? activeId : null,
        regions: entries.map(entry => ({ id: entry.id, region: entry.region as MyRegionName, ...(entry.district.trim() ? { district: entry.district.trim() } : {}), ...(entry.neighborhood.trim() ? { neighborhood: entry.neighborhood.trim() } : {}) })) };
      saved = writeMyRegions(storage, next, loaded.state.revision);
      setLoaded({ state: saved, status: 'ready', message: '' });
    } catch (cause) { saving.current = false; setError(cause instanceof Error ? cause.message : '지역을 저장하지 못했어요. 입력 내용은 유지했어요.'); return; }
    onSaved(saved); onClose();
  };
  return <BottomSheet title="내 동네 관리" description="현재 위치로 동네를 찾거나 직접 선택해요." onClose={close}>
    <form className="my-regions" ref={form} onSubmit={event => { event.preventDefault(); save(); }}>
      <section className="my-current-area" aria-label="현재 위치로 동네 찾기" aria-busy={locating}>
        <div className="my-current-area-heading"><LocateFixed size={20} aria-hidden="true"/><div><strong>내 근처에서 함께해요</strong><p>현재 동네를 기본 활동 지역으로 채워요.</p></div></div>
        {!locationConsentOpen && <button type="button" className="my-current-area-start" disabled={!writable || locating} onClick={() => { setLocationConsentOpen(true); setLocationError(''); }}>현재 위치 가져오기</button>}
        {locationConsentOpen && <div className="my-current-area-consent">
          <p>{CURRENT_AREA_LOCATION_NOTICE}</p><a href={CURRENT_AREA_PROVIDER_URL} target="_blank" rel="noreferrer">위치정보 제공업체 안내</a><small>동네를 찾을 때 한 번만 사용해요. 계속 추적하거나 거주지를 인증하지 않아요. 브라우저·휴대폰의 위치 허용도 필요해요.</small>
          <div className="my-current-area-actions"><button type="button" className="my-current-area-accept" disabled={!writable || locating} onClick={() => void locate()}>{locating ? '현재 동네 확인 중…' : '동의하고 위치 가져오기'}</button><button type="button" onClick={() => { cancelLocation(); setLocationConsentOpen(false); setLocationError(''); }}>{locating ? '조회 취소' : '직접 선택할게요'}</button></div>
          {locating && <p role="status">위치 권한을 허용하면 동네를 찾아요. 아래에서 직접 선택하면 조회를 취소해요.</p>}
        </div>}
        {currentArea && <div className="my-current-area-result" role="status"><small>가져온 동네 · 저장 전</small><strong>{[currentArea.region, currentArea.district, currentArea.neighborhood].filter(Boolean).join(' ')}</strong><p>{currentArea.neighborhood ? '아래에서 동네를 확인한 뒤 저장해 주세요.' : '동까지 확인되지 않아 넓은 지역으로 가져왔어요. 원하면 아래에서 동·읍·면을 직접 정해 주세요.'}</p>{currentArea.accuracyMeters > 1000 && <small>위치 오차가 커요. 확인된 지역이 맞는지 살펴봐 주세요.</small>}<small>{CURRENT_AREA_PROVIDER_ATTRIBUTION}</small></div>}
        {locationError && <p className="my-current-area-error" role="alert">{locationError}</p>}
      </section>
      <p id={helperId} className="my-regions-help">기본 활동 지역 1곳과 관심 지역 2곳까지 관리해요. 상세 주소 대신 시·구·동까지만 저장해요.</p>
      <div className="my-regions-list">
        {entries.map((entry, index) => <fieldset className="my-region-entry" key={entry.id} disabled={!writable}>
          <legend className="my-regions-sr-only">지역 {index + 1}</legend>
          <div className="my-region-heading"><strong><MapPin size={17} aria-hidden="true"/>{entry.id === activeId ? '기본 활동 지역' : `관심 지역 ${entries.slice(0, index + 1).filter(value => value.id !== activeId).length}`}</strong><button type="button" className="my-region-icon" aria-label={`지역 ${index + 1} 삭제`} onClick={() => remove(entry.id)}><Trash2 size={18} aria-hidden="true"/></button></div>
          <GroupLocalityFields label={`지역 ${index + 1}`} ariaPrefix={`지역 ${index + 1}`} idPrefix={entry.id} region={entry.region} district={entry.district} neighborhood={entry.neighborhood} onChange={value => update(entry.id, { ...value, region: value.region as MyRegionName | '' })}/>
          <label className="my-region-default"><input type="radio" name={`${helperId}-active`} value={entry.id} checked={activeId === entry.id} onChange={() => { invalidateLocation(); setActiveId(entry.id); setError(''); }}/><span>{activeId === entry.id ? '이 지역을 기본으로 사용해요' : '기본 활동 지역으로 사용'}</span></label>
        </fieldset>)}
      </div>
      {!entries.length && <p className="my-regions-empty">저장할 지역이 없어요. 지역을 추가하거나 비워 둔 상태로 저장할 수 있어요.</p>}
      <button type="button" className="my-regions-add" disabled={!writable || entries.length >= 3} onClick={add}><Plus size={18} aria-hidden="true"/>{entries.length >= 3 ? '지역은 최대 3곳까지 저장할 수 있어요' : entries.length ? '관심 지역 추가' : '활동 지역 추가'}</button>
      {!writable && <div className="my-regions-error" role="alert"><p>{loaded.message}</p><button type="button" onClick={reload}>다시 불러오기</button></div>}
      {error && <div className="my-regions-error" role="alert"><p id={errorId}>{error}</p><button type="button" onClick={reload}>저장된 설정 다시 불러오기</button></div>}
      <p className="my-regions-storage">선택한 지역 이름만 이 기기에 계정별로 저장해요. 정밀 좌표는 저장하지 않아요.{ownerId === 'guest-device' && ' 로그인 전 설정은 로그인 후 지역에 자동으로 합쳐지지 않아요.'}</p>
      <button type="submit" className="my-regions-save" disabled={!writable}>{submitLabel}</button>
    </form>
  </BottomSheet>;
}
