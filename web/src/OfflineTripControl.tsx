import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, RefreshCw, WifiOff } from 'lucide-react';
import type { Journey } from './data';
import { useLocale } from './locale';
import { Button } from './ui';
import { getOfflineTripStatus, offlineTripFingerprint, removeOfflineTrip, saveOfflineTrip, subscribeOfflineChanges } from './offlineTrips';
import './offline-trips.css';

export function useConnectivity() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener('online', changed); window.addEventListener('offline', changed);
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); };
  }, []);
  return online;
}
type TripStatus = Awaited<ReturnType<typeof getOfflineTripStatus>>;
export function useOfflineTrip(journey: Journey) {
  const key = offlineTripFingerprint(journey);
  const latest = useRef(journey); latest.current = journey;
  const request = useRef<AbortController | null>(null), alive = useRef(false), sequence = useRef(0), locked = useRef(false);
  const [status, setStatus] = useState<TripStatus | null>(null), [busy, setBusy] = useState<'save' | 'remove' | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const online = useConnectivity();
  const refresh = useCallback(async () => {
    const turn = ++sequence.current;
    try { const result = await getOfflineTripStatus(latest.current); if (alive.current && turn === sequence.current) setStatus(result); }
    catch { if (alive.current && turn === sequence.current) setStatus({ state: 'unavailable', message: '오프라인 저장 상태를 확인하지 못했어요.' }); }
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); ++sequence.current; };
  }, []);
  useEffect(() => {
    request.current?.abort(); locked.current = false; setBusy(null); setError(''); setNotice('');
    void refresh(); const stop = subscribeOfflineChanges(() => void refresh());
    return () => { request.current?.abort(); ++sequence.current; stop(); };
  }, [key, refresh]);
  useEffect(() => { void refresh(); }, [online, refresh]);
  const run = async (kind: 'save' | 'remove') => {
    if (locked.current) return;
    const target = latest.current, targetKey = offlineTripFingerprint(target), controller = new AbortController();
    request.current = controller; locked.current = true; setBusy(kind); setError(''); setNotice('');
    try {
      if (kind === 'save') {
        const saved = await saveOfflineTrip(target, { signal: controller.signal });
        if (alive.current && !controller.signal.aborted && targetKey === offlineTripFingerprint(latest.current)) { setStatus(saved); setNotice(saved.missingImages ? `일정은 저장했어요. 사진 ${saved.missingImages}장은 포함하지 못했어요.` : '오프라인 저장을 마쳤어요. 인터넷 없이 이 여행을 다시 열 수 있어요.'); }
      } else {
        await removeOfflineTrip(target.id);
        if (alive.current && targetKey === offlineTripFingerprint(latest.current)) { await refresh(); setNotice('오프라인 보관본만 삭제했어요. 내 여행 일정은 그대로예요.'); }
      }
    } catch (problem) {
      if (alive.current && !controller.signal.aborted && targetKey === offlineTripFingerprint(latest.current)) setError(problem instanceof Error ? problem.message : '오프라인 저장을 완료하지 못했어요. 다시 시도해 주세요.');
    } finally {
      if (request.current === controller) { locked.current = false; if (alive.current) setBusy(null); }
    }
  };
  const cancel = () => { request.current?.abort(); setNotice('저장을 취소했어요. 기존 오프라인 보관본은 유지돼요.'); };
  return { status, busy, error, notice, online, save: () => run('save'), remove: () => run('remove'), cancel };
}
export type OfflineTripState = ReturnType<typeof useOfflineTrip>;
const savedDate = (value: string | undefined, en: boolean) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(en ? 'en-US' : 'ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '';
const sizeLabel = (bytes: number | undefined) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : '';

export function OfflineTripControl({ state, onManage }: { state: OfflineTripState; onManage: () => void }) {
  const { locale } = useLocale(), en = locale === 'en';
  const ready = state.status?.state === 'saved', stale = state.status?.state === 'stale';
  const saved = ready || stale;
  const unsupported = state.status?.canSave === false;
  return <aside className={`plan-offline-control${saved ? ' is-saved' : ''}`} aria-label={en ? 'Offline trip' : '오프라인 여행'}>
    <div className="plan-offline-row"><div><strong><WifiOff size={16} aria-hidden="true"/>{state.busy ? (en ? 'Saving…' : '저장 중…') : ready ? (en ? 'Saved for offline' : '오프라인 저장됨') : stale ? (en ? 'Saved copy needs updating' : '저장한 일정이 바뀌었어요') : en ? 'Take this trip offline' : '인터넷 없이 내 여행 보기'}</strong><p>{state.busy ? (en ? 'Keep this screen open until saving finishes.' : '저장이 끝날 때까지 화면을 열어두세요.') : saved ? `${savedDate(state.status?.savedAt, en)}${en ? ' saved' : ' 저장'}` : en ? 'Itinerary, photos and visit order on this device' : '일정·사진·방문 순서를 이 기기에 보관'}</p></div>
      {state.busy === 'save' ? <Button variant="secondary" size="compact" onClick={state.cancel}>{en ? 'Cancel' : '취소'}</Button> : <Button variant="secondary" size="compact" disabled={!state.status || !!state.busy || unsupported || (!state.online && !ready)} onClick={ready ? onManage : () => void state.save()}>{ready ? (en ? 'Manage' : '저장 관리') : <><Download size={15}/>{en ? (stale ? 'Update' : 'Save offline') : (stale ? '저장 업데이트' : '오프라인 저장')}</>}</Button>}
    </div>
    {!state.online && !saved && <p className="plan-offline-message" role="status">{en ? 'Reconnect to save photos for offline use.' : '인터넷에 연결한 뒤 오프라인 저장을 해주세요.'}</p>}
    {state.status?.state === 'unavailable' && state.status.message && <p className="plan-offline-message" role="status">{state.status.message}</p>}
    {saved && !!state.status?.missingImages && <p className="plan-offline-message">{en ? `${state.status.missingImages} photos were not included.` : `사진 ${state.status.missingImages}장은 저장하지 못했어요.`}</p>}
    {state.notice && <p className="plan-offline-message" role="status">{state.notice}</p>}{state.error && <p className="plan-offline-message ui-error" role="alert">{state.error}</p>}
  </aside>;
}

export function OfflineTripManagement({ state }: { state: OfflineTripState }) {
  const { locale } = useLocale(), en = locale === 'en', saved = ['saved', 'stale'].includes(state.status?.state ?? ''), hasCopy = saved || !!state.status?.savedAt;
  return <section className="plan-offline-management"><h3><WifiOff size={17}/>{en ? 'Offline copy' : '오프라인 보관'}</h3><p>{en ? 'Saved itinerary, addresses, photos and visit order are available on this device. Live routing and updated business information require a connection.' : '저장한 일정·주소·사진·방문 순서는 이 기기에서 볼 수 있어요. 실시간 길찾기와 최신 업체 정보는 인터넷 연결이 필요해요.'}</p>
    {saved && <p>{savedDate(state.status?.savedAt, en)} · {state.status?.imageCount ?? 0}{en ? ' photos' : '장'} {sizeLabel(state.status?.bytes)}{state.status?.state === 'stale' && <><br/>{en ? 'Reconnect and update after itinerary changes.' : '일정을 바꿨다면 인터넷에 연결한 뒤 다시 저장해 주세요.'}</>}</p>}
    {!!state.status?.missingImages && <p>{en ? 'Some photos could not be stored. You can retry after reconnecting.' : '일부 사진은 포함하지 못했어요. 인터넷 연결 후 다시 저장할 수 있어요.'}</p>}
    {state.status?.state === 'unavailable' && state.status.message && <p role="status">{state.status.message}</p>}
    <Button variant="secondary" disabled={!state.status || !state.online || !!state.busy || state.status?.canSave === false} loading={state.busy === 'save'} onClick={() => void state.save()}>{hasCopy ? <RefreshCw size={16}/> : <Download size={16}/>}{en ? (hasCopy ? 'Update saved copy' : 'Save offline') : (hasCopy ? '오프라인 저장 업데이트' : '오프라인 저장')}</Button>
    {hasCopy && <Button variant="ghost" disabled={!!state.busy} onClick={() => void state.remove()}>{en ? 'Remove offline copy' : '오프라인 저장 삭제'}</Button>}
    {state.busy === 'save' && <Button variant="ghost" onClick={state.cancel}>{en ? 'Cancel saving' : '저장 취소'}</Button>}
    {state.notice && <p role="status">{state.notice}</p>}{state.error && <p className="ui-error" role="alert">{state.error}</p>}
  </section>;
}

export function OfflineSavedBadge({ journey }: { journey: Journey }) {
  const { locale } = useLocale();
  const { status } = useOfflineTrip(journey);
  if (!status || !['saved', 'stale'].includes(status.state)) return null;
  return <span className="offline-saved-badge"><Check size={14} aria-hidden="true"/>{locale === 'en' ? 'Saved offline' : '오프라인 저장됨'}{status.state === 'stale' ? (locale === 'en' ? ' · Update needed' : ' · 업데이트 필요') : ''}</span>;
}
