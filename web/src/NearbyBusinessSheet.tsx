import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Journey, Place, PlaceKind } from './data';
import { BottomSheet } from './BottomSheet';
import { PhotoCredit } from './PublicTourismCredit';
import { distanceBetween, nearbyCandidates } from './tripPlan';

export function NearbyBusinessSheet({ journey, dayId, anchor, catalog, onClose, onAdd }: { journey: Journey; dayId: string; anchor: Place; catalog: Place[]; onClose: () => void; onAdd: (place: Place) => boolean }) {
  const [kind, setKind] = useState<PlaceKind>('FOOD');
  const [error, setError] = useState('');
  const results = useMemo(() => nearbyCandidates(anchor, catalog, kind), [anchor, catalog, kind]);
  const day = journey.days.find(day => day.dayId === dayId);
  return <BottomSheet title={`${anchor.name} 주변`} description={`DAY ${day?.day ?? ''} · 고른 곳은 이 장소 다음에 담겨요.`} onClose={onClose}>
    <div className="plan-form">
      <div className="saved-region-chips" role="group" aria-label="주변 업체 종류">{(['FOOD', 'CAFE'] as const).map(value => <button key={value} aria-pressed={kind === value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{value === 'FOOD' ? '맛집' : '카페'}</button>)}</div>
      <p className="plan-help">가까운 장소 예시 · 직선거리 기준, 최신 운영 정보는 확인이 필요해요.</p>
      {!results.length && <div className="empty"><MapPin size={24} /><strong>아직 준비된 주변 업체가 없어요</strong><p>다른 종류를 살펴보거나 나중에 추가해도 좋아요.</p></div>}
      <div className="nearby-results">{results.map(place => { const added = day?.places.some(visit => visit.id === place.id && visit.anchorVisitId === anchor.visitId); const distance = distanceBetween(anchor, place); return <article key={place.id} className="nearby-business">
        <div className="nearby-row">{place.image ? <img src={place.image} alt={place.name} /> : <span className="plan-image-empty"><MapPin size={22} /></span>}<div><h3>{place.name}</h3><p>{distance === null ? '위치 미확인' : `직선 ${distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}`}</p><p>{place.address}</p></div><button className="outline" disabled={added} onClick={() => { if (!onAdd(place)) setError('담지 못했어요. 다시 시도해 주세요.'); }}>{added ? '담김' : '담기'}</button></div>
        <PhotoCredit image={place.image} />
      </article>; })}</div>
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div>
  </BottomSheet>;
}
