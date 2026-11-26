import { useState, type MouseEvent } from 'react';
import { ArrowUpRight, Car, LocateFixed, Navigation, TrainFront, Footprints } from 'lucide-react';
import { BottomSheet, useBottomSheetDetail } from './BottomSheet';
import { isNativeShell, openExternal } from './nativeBridge';
import { googleDirectionsUrl, naverDirectionsUrl, type DirectionsPlace, type GoogleTravelMode } from './placeDirections';
import './google-directions.css';

const modes = [
  { value: 'walking', ko: '도보', en: 'Walking', icon: Footprints },
  { value: 'driving', ko: '자동차', en: 'Driving', icon: Car },
  { value: 'transit', ko: '대중교통', en: 'Public transit', icon: TrainFront },
] as const;

type Props = {
  place: DirectionsPlace;
  className?: string;
  iconOnly?: boolean;
  label?: string;
  en?: boolean;
  beforeLaunch?: () => boolean | void;
};

function DirectionsOptions({ place, en, beforeLaunch }: Pick<Props, 'place' | 'en' | 'beforeLaunch'>) {
  const handleLaunch = (event: MouseEvent<HTMLAnchorElement>) => {
    if (beforeLaunch?.() === false) {
      event.preventDefault();
    } else if (isNativeShell()) {
      event.preventDefault();
      openExternal(event.currentTarget.href);
    }
  };
  const routeUrl = (mode: GoogleTravelMode) => googleDirectionsUrl(place, mode);
  return <div className="google-directions-options">
    <div className="google-directions-origin">
      <LocateFixed size={19} aria-hidden="true" />
      <span><strong>{en ? 'From your current location' : '현재 위치에서 출발'}</strong>
        <small>{en ? 'Allow location access in Google Maps or enter a starting point there.' : '구글 지도에서 위치를 허용하거나 출발지를 직접 입력할 수 있어요.'}</small></span>
    </div>
    <div className="google-directions-modes" role="group" aria-label={en ? 'Travel mode' : '이동수단'}>
      {modes.map(({ value, ko, en: english, icon: Icon }) => <a key={value} href={routeUrl(value) ?? undefined} target="_blank" rel="noopener noreferrer" onClick={handleLaunch}>
        <Icon size={20} aria-hidden="true" />{en ? english : ko}<ArrowUpRight size={16} aria-hidden="true" />
      </a>)}
    </div>
    <div className="google-directions-fallback">
      <p>{en ? 'Google Maps may limit walking and driving directions in South Korea.' : '국내 일부 지역은 구글 지도의 도보·자동차 경로가 제한될 수 있어요.'}</p>
      <a href={naverDirectionsUrl(place)} target="_blank" rel="noopener noreferrer" onClick={handleLaunch}>
        {en ? 'Open NAVER Map' : '네이버 지도에서 찾기'}<ArrowUpRight size={16} aria-hidden="true" />
      </a>
    </div>
  </div>;
}

export default function GoogleDirectionsButton({ place, className, iconOnly, label, en, beforeLaunch }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inlineOpen, setInlineOpen] = useState(false);
  const openDetail = useBottomSheetDetail();
  if (!googleDirectionsUrl(place, 'transit')) return null;

  const title = en ? 'Google Maps directions' : '구글 지도 길찾기';
  const action = label || (en ? 'Directions' : '길찾기');
  const destination = place.name.trim() || place.address?.trim();
  const options = <DirectionsOptions place={place} en={en} beforeLaunch={beforeLaunch} />;
  return <>
    <button type="button" className={['google-directions-trigger', className].filter(Boolean).join(' ')}
      aria-label={destination ? `${destination} · ${action}` : action} aria-haspopup="dialog" aria-expanded={sheetOpen || inlineOpen}
      title={iconOnly ? action : undefined} onClick={event => {
        if (!openDetail) { setSheetOpen(true); return; }
        if (event.currentTarget.closest('[data-spotlog-sheet-detail]')) { setInlineOpen(value => !value); return; }
        openDetail({ title, description: destination, children: options });
      }}><Navigation size={17} aria-hidden="true" />{!iconOnly && action}</button>
    {inlineOpen && <section className="google-directions-inline" aria-label={title}>{options}</section>}
    {sheetOpen && <BottomSheet title={title} description={destination} onClose={() => setSheetOpen(false)}>{options}</BottomSheet>}
  </>;
}
