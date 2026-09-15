import { useState, type ReactNode } from 'react';
import { Bookmark, ImageOff, Share2 } from 'lucide-react';
import { placeKindLabel, type Place } from './data';
import { getPlacePhotos } from './PhotoPlaceCard';
import { Button } from './ui';
import { PhotoCredit } from './PublicTourismCredit';
import './landmark-guide-card.css';

type LandmarkGuideCardProps = {
  place: Place;
  primaryAction?: ReactNode;
  footer?: ReactNode;
} & ({
  saved: boolean;
  onToggle: () => void;
  onShare: () => void;
  actions?: undefined;
} | {
  /** Preview/placement reuses the card body with its own truthful actions. */
  actions: ReactNode;
  saved?: never;
  onToggle?: never;
  onShare?: never;
});

/** Large discovery/confirmation card. Saved's outer list keeps its small horizontal card. */
export function LandmarkGuideCard({ place, saved, onToggle, onShare, primaryAction, footer, actions }: LandmarkGuideCardProps) {
  const photo = getPlacePhotos(place)[0];
  const image = photo?.image ?? place.image;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return <article className="landmark-guide-card" data-place-id={place.id}>
    <div className="landmark-guide-image">{image && failedImage !== image
      ? <img src={image} alt={photo?.alt ?? `${place.name} 여행 사진`} loading="lazy" onError={() => setFailedImage(image)} />
      : <div className="landmark-guide-image-error" role="img" aria-label={`${place.name} 사진 ${image ? '불러오기 실패' : '준비 중'}`}><ImageOff size={26} aria-hidden="true" /><p>{image ? '사진을 불러오지 못했어요' : '장소 사진 준비 중'}</p></div>}
      <span>{place.area.split(/\s+/)[0]} · {placeKindLabel[place.kind]}</span></div>
    <div className="landmark-guide-copy">
      <small>{place.area} · {place.bestTime ?? place.duration}</small><h3>{place.name}</h3>
      <strong>{place.hook ?? `${place.area} 일정에 담기 좋은 장소`}</strong><p>{place.description}</p>
      {place.note && <blockquote>{place.tags?.includes('공공자료') ? '자료 안내' : '여행자 메모'} · {place.note}</blockquote>}
      <PhotoCredit image={image} />
      <div className="landmark-guide-tags">{place.tags?.map(tag => <span key={tag}>#{tag}</span>)}</div>
      {actions !== null && <div className="landmark-guide-actions">{actions !== undefined ? actions : <>{primaryAction ?? <Button size="card" onClick={onToggle} aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? '저장됨' : '이 장소 저장'}</Button>}<Button size="card" variant="secondary" onClick={onShare}><Share2 size={16} />공유</Button></>}</div>}
      {footer}
    </div>
  </article>;
}
