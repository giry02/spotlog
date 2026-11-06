import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, WifiOff, X } from 'lucide-react';
import type { Place } from './data';
import { useLocale } from './locale';
import { projectOfflineRoute } from './offlineRouteProjection';
import { draftPolicies, policyDocument, type PolicyBundle } from './accountPolicies';
import { LocationAccessError, requestCurrentLocation } from './locationConsent';
import { PolicyDocumentView } from './PolicyDocumentView';
import { distanceBetween } from './tripPlan';
import './offline-route-map.css';

export function OfflineRouteMap({ places, selectedVisitId, onSelectVisit, reason = 'offline', locationPolicy = draftPolicies }: { places: Place[]; selectedVisitId?: string; onSelectVisit?: (id: string) => void; reason?: 'offline' | 'unavailable'; locationPolicy?: PolicyBundle }) {
  const { locale } = useLocale(), en = locale === 'en';
  const projection = useMemo(() => projectOfflineRoute(places), [places]);
  const gridId = useId().replace(/:/g, '');
  const scopeKey = JSON.stringify(places.map(place => [place.visitId, place.id, place.lat, place.lng, place.locationVerified]));
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number; measuredAt: number } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const ready = locationPolicy.status === 'PUBLISHED' && locationPolicy.locationEnabled;
  const clearLocation = () => { pending.current?.abort(); pending.current = null; setBusy(false); setPosition(null); setAccepted(false); setError(''); setConsentOpen(false); };
  useEffect(() => { clearLocation(); return () => pending.current?.abort(); }, [scopeKey, locationPolicy]);
  useEffect(() => {
    const foreground = () => { if (document.visibilityState === 'hidden') clearLocation(); };
    document.addEventListener('visibilitychange', foreground);
    return () => { document.removeEventListener('visibilitychange', foreground); pending.current?.abort(); };
  }, []);
  const [focusedNumber, setFocusedNumber] = useState<number | null>(null);
  useEffect(() => { setFocusedNumber(null); }, [scopeKey]);
  const active = (selectedVisitId ? projection.points.find(point => point.place.visitId === selectedVisitId) : undefined) ?? projection.points.find(point => point.number === focusedNumber);
  const currentPoint = position ? projection.project(position) : null;
  const closest = position ? projection.points.map(point => ({ point, distance: distanceBetween(point.place, { ...point.place, lat: position.lat, lng: position.lng, locationVerified: true })! })).sort((a, b) => a.distance - b.distance)[0] : undefined;
  const locate = async () => {
    if (!ready || !accepted || pending.current || document.visibilityState === 'hidden') return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      const value = await requestCurrentLocation(locationPolicy, { version: policyDocument(locationPolicy, 'location').version, accepted: true, purpose: 'OFFLINE_ROUTE_DISPLAY' }, window.isSecureContext ? navigator.geolocation : undefined, controller.signal, 'OFFLINE_ROUTE_DISPLAY');
      if (!controller.signal.aborted) { setPosition(value); setConsentOpen(false); }
    } catch (failure) {
      if (controller.signal.aborted) return;
      const code = failure instanceof LocationAccessError ? failure.code : 'UNAVAILABLE';
      const ko = code === 'DENIED' ? '위치 권한이 꺼져 있어요. 기기나 브라우저에서 허용한 뒤 다시 눌러주세요.' : code === 'TIMEOUT' ? '위치를 확인하는 데 시간이 걸려요. GPS가 잘 잡히는 곳에서 다시 눌러주세요.' : code === 'UNSUPPORTED' ? '이 환경에서는 GPS를 사용할 수 없어요. 저장된 장소 위치는 계속 볼 수 있어요.' : '현재 위치를 확인하지 못했어요. 잠시 후 다시 눌러주세요.';
      const english = code === 'DENIED' ? 'Location permission is off. Allow it in your device or browser and try again.' : code === 'TIMEOUT' ? 'Location timed out. Try again where GPS reception is better.' : code === 'UNSUPPORTED' ? 'GPS is unavailable here. Saved place positions remain available.' : 'Could not determine your position. Please try again.';
      setError(en ? english : ko);
    } finally { if (!controller.signal.aborted) { pending.current = null; setBusy(false); } }
  };
  return <div className="offline-route" data-testid="offline-route">
    <div className="offline-route-heading"><WifiOff size={16} aria-hidden="true"/><strong>{en ? 'Saved place positions' : '저장된 장소 위치'}</strong><span>{reason === 'offline' ? (en ? 'Offline' : '오프라인') : (en ? 'Map unavailable' : '지도 연결 불가')}</span></div>
    {projection.points.length ? <div className="offline-route-canvas">
      <svg viewBox={`0 0 ${projection.width} ${projection.height}`} role="img" aria-label={en ? 'A coordinate diagram of places in visit order. No road map.' : '방문 순서에 따른 장소 위치도. 도로 지도가 아니에요.'}>
        <defs><pattern id={gridId} width="36" height="35" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 35" fill="none" stroke="#dfe5df" strokeWidth="1"/></pattern></defs>
        <rect width="360" height="280" fill={`url(#${gridId})`}/>
        <text x="340" y="23" textAnchor="middle" className="offline-route-north">N ↑</text>
        {projection.segments.map(([from, to]) => <line key={`${from.key}:${to.key}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ff4f35" strokeWidth="3" strokeDasharray="6 5"/>) }
        {projection.points.map(point => <g key={point.key}><line x1={point.x} y1={point.y} x2={point.labelX} y2={point.labelY} stroke="#7b8278" strokeWidth="1.2"/><circle cx={point.x} cy={point.y} r="3" fill="#252521"/></g>)}
        {currentPoint?.within && <g className="offline-route-current"><title>{en ? 'Current position' : '현재 위치'}</title><circle cx={currentPoint.x} cy={currentPoint.y} r="12" fill="#3273c4" opacity="0.18"/><circle cx={currentPoint.x} cy={currentPoint.y} r="6" fill="#3273c4" stroke="white" strokeWidth="2"/></g>}
      </svg>
      {projection.points.map(point => <button key={point.key} type="button" className="offline-route-marker" style={{ left: `${point.labelX / projection.width * 100}%`, top: `${point.labelY / projection.height * 100}%` }} aria-label={`${point.number}. ${point.place.name}`} aria-pressed={point.key === active?.key} onClick={() => { setFocusedNumber(point.number); if (point.place.visitId) onSelectVisit?.(point.place.visitId); }}><span>{point.number}</span></button>)}
    </div> : <div className="offline-route-empty"><MapPin size={24} aria-hidden="true"/><strong>{en ? 'No verified coordinates' : '확인된 위치가 없어요'}</strong><p>{en ? 'Place names and addresses remain in your itinerary.' : '장소 이름과 주소는 일정에서 볼 수 있어요.'}</p></div>}
    {active && <div className="offline-route-selection" aria-live="polite"><span>{active.number}</span><div><strong>{active.place.name}</strong><p>{active.place.address || (en ? 'Address not confirmed' : '주소 확인 필요')}</p></div></div>}
    <p className="offline-route-explanation">{en ? 'Positions and visit order only. Streets, road directions and live traffic are unavailable.' : '장소 위치와 방문 순서만 보여줘요. 도로·길찾기·실시간 교통은 제공하지 않아요.'}</p>
    {projection.segments.length > 0 && <p className="offline-route-distance">{en ? 'Straight-line total' : '직선 연결 합계'} <strong>{projection.straightDistanceKm.toFixed(1)}km</strong>{projection.missing.length > 0 && (en ? ' · Known adjacent positions only' : ' · 위치가 확인된 연속 구간만')}</p>}
    {projection.missing.length > 0 && <p className="offline-route-missing">{en ? 'Unverified positions: ' : '위치 미확인: '}{projection.missing.map(item => `${item.number}. ${item.place.name}`).join(', ')}</p>}
    {projection.points.length > 0 && <div className="offline-route-location">
      <button type="button" className="outline" onClick={() => { setConsentOpen(true); setError(''); }}><LocateFixed size={16} aria-hidden="true"/>{en ? 'Check current position' : '현재 위치 확인'}</button>
      {position && <div className="offline-route-position" role="status"><div><strong>{currentPoint?.within ? (en ? 'Blue dot: current position' : '파란 점: 현재 위치') : (en ? 'Your position is outside this diagram' : '현재 위치가 위치도 밖에 있어요')}</strong><p>{closest && `${closest.point.place.name} · ${en ? 'straight-line ' : '직선거리 '}${closest.distance < 1 ? `${Math.round(closest.distance * 1000)}m` : `${closest.distance.toFixed(1)}km`}`}<br/>{en ? 'Position accuracy' : '위치 오차'} ±{Math.round(position.accuracy)}m · {new Date(position.measuredAt).toLocaleTimeString(en ? 'en' : 'ko', { hour: '2-digit', minute: '2-digit' })}</p></div><button type="button" className="offline-route-location-close" onClick={clearLocation} aria-label={en ? 'Clear current position' : '현재 위치 지우기'}><X size={18}/></button></div>}
      {consentOpen && <section className="offline-route-consent" aria-label={en ? 'Current position consent' : '현재 위치 이용 동의'}>
        <div className="offline-route-consent-head"><strong>{en ? 'Show current position here' : '이 위치도에서 현재 위치 확인'}</strong><button type="button" className="offline-route-location-close" onClick={() => { pending.current?.abort(); pending.current = null; setBusy(false); setConsentOpen(false); setAccepted(false); }} aria-label={en ? 'Close position consent' : '위치 동의 닫기'}><X size={18}/></button></div>
        <p>{en ? 'Use latitude, longitude, accuracy and measurement time once, only on this screen. No server transfer, saved location or background tracking. Opening another DAY or leaving the screen clears it.' : '위도·경도·정확도·측정 시각을 이 화면에서 한 번만 사용해요. 서버 전송·위치 저장·백그라운드 추적은 하지 않아요. 다른 DAY를 열거나 화면을 떠나면 지워져요.'}</p>
        {ready ? <label><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)}/><span>{en ? '[Optional] Agree to use my position in this diagram' : '[선택] 이 위치도에서 현재 위치 이용 동의'}</span></label> : <p role="status">{en ? 'Position access will be available after location terms and service settings are ready. No GPS permission is requested now.' : '위치 이용 약관과 서비스 설정이 준비되면 사용할 수 있어요. 지금은 GPS 권한을 요청하지 않아요.'}</p>}
        <details><summary>{en ? 'Location terms' : '위치 이용 약관 보기'}</summary><PolicyDocumentView id="location" bundle={locationPolicy}/></details>
        <button type="button" className="outline" disabled={!ready || !accepted || busy} onClick={() => void locate()}>{busy ? (en ? 'Finding position…' : '위치 확인 중…') : (en ? 'Agree and check position' : '동의하고 위치 확인')}</button>
        {error && <p className="ui-error" role="alert">{error}</p>}
      </section>}
    </div>}
  </div>;
}
