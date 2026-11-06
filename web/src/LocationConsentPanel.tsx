import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from './ui';
import { PolicyLink } from './PolicyDocumentView';
import { draftPolicies, policyDocument, type PolicyBundle } from './accountPolicies';
import { requestCurrentLocation, LocationAccessError } from './locationConsent';

export function LocationConsentPanel({ bundle = draftPolicies, onBack, onLocation }: { bundle?: PolicyBundle; onBack: () => void; onLocation?: (position: { lat: number; lng: number; accuracy: number; measuredAt: number }) => void }) {
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null), locked = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  const ready = bundle.status === 'PUBLISHED' && bundle.locationEnabled && Boolean(onLocation);
  const useLocation = async () => {
    if (!ready || !accepted || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const c = new AbortController(); pending.current = c;
    try {
      const position = await requestCurrentLocation(bundle, { accepted: true, purpose: 'NEARBY_SEARCH', version: policyDocument(bundle, 'location').version }, navigator.geolocation, c.signal);
      if (!c.signal.aborted) onLocation?.(position);
    } catch (e) {
      if (c.signal.aborted) return;
      setError(e instanceof LocationAccessError && e.code === 'DENIED' ? '기기 위치 권한이 꺼져 있어요. 지역을 직접 선택해서 이용할 수 있어요.' : '위치를 확인하지 못했어요. 다시 시도하거나 지역을 직접 선택해 주세요.');
    } finally { if (!c.signal.aborted) { locked.current = false; setBusy(false); } }
  };
  return <div className="account-form">
    <section className="privacy-summary"><MapPin size={20} aria-hidden="true" /><div><h3>내 위치 주변 장소 찾기</h3><p>현재 위치에서 가까운 장소·음식점·카페·숙소와 거리를 안내해요.</p><p>이번 요청의 위도·경도·정확도·측정 시각을 사용해요. 지속 추적이나 백그라운드 수집은 하지 않아요.</p></div></section>
    {!ready && <p className="account-notice" role="status">향후 기능의 동의 화면 미리보기예요. 현재는 GPS 권한을 요청하거나 위치를 수집하지 않아요.</p>}
    <div className="signup-consent-list"><div className="signup-consent-row"><label><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} /><span>[선택] 내 위치 주변 검색에 위치 정보 이용 동의</span></label><PolicyLink id="location" bundle={bundle} /></div></div>
    <p>동의한 뒤에도 브라우저·기기의 위치 권한을 확인해요. 거부하면 지역을 직접 선택해서 이용할 수 있어요.</p>
    <Button disabled={!accepted || !ready} loading={busy} onClick={() => void useLocation()}>현재 위치 사용</Button>
    <Button variant="secondary" disabled={busy} onClick={onBack}>위치 없이 돌아가기</Button>
    {error && <p className="ui-error" role="alert">{error}</p>}
  </div>;
}
