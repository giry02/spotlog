import { lazy, Suspense, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import type { Place } from '../data';
import GoogleDirectionsButton from '../GoogleDirectionsButton';
import './public-place-facts.css';

const InterestPlacesMap = lazy(() => import('../InterestPlacesMap'));

/** Public catalogue facts only. Room experiences and private saved notes stay in their own scope. */
export default function PublicPlaceFacts({ place }: { place: Place }) {
  const [mapOpen, setMapOpen] = useState(false);
  return <section className="public-place-facts" aria-label="장소 주소와 지도">
    <div className="public-place-facts__address"><MapPin size={18} aria-hidden="true"/><div><small>주소</small><p>{place.address || '등록된 주소가 없어요.'}</p></div></div>
    {(place.duration || place.bestTime) && <dl className="public-place-facts__planning">{place.duration && <div><dt>{place.kind === 'STAY' ? '숙박 참고' : '체류 참고'}</dt><dd>{place.duration}</dd></div>}{place.bestTime && <div><dt>방문 참고</dt><dd>{place.bestTime}</dd></div>}</dl>}
    <div className="public-place-facts__actions"><button type="button" aria-expanded={mapOpen} onClick={() => setMapOpen(value => !value)}><MapPin size={17}/>지도 {mapOpen ? '접기' : '보기'}<ChevronDown size={16}/></button><GoogleDirectionsButton place={place}/></div>
    {mapOpen && <Suspense fallback={<p role="status">지도를 불러오고 있어요.</p>}><InterestPlacesMap places={[place]} heading="장소 위치" ariaLabel={`${place.name} 위치`} mapLabel={`${place.name} 위치 지도`} interactiveMarkers={false} onSelectPlace={() => {}}/></Suspense>}
    {['FOOD','CAFE','STAY','SHOP','LEISURE'].includes(place.kind) && <p className="public-place-facts__verification">운영 시간·메뉴·요금은 방문·예약 전에 업체에서 확인해 주세요.</p>}
  </section>;
}
