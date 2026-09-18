import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, ImageOff, Share2 } from 'lucide-react';
import { placeKindLabel, type Place } from './data';
import { getPlacePhotos } from './PhotoPlaceCard';
import { activePhotoIndex } from './placePhotos';
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
  const photos = getPlacePhotos(place, true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const photoIndex = activePhotoIndex(photos, selectedId);
  const photo = photos[photoIndex];
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(photoIndex);
  indexRef.current = photoIndex;
  const photoSignature = JSON.stringify(photos.map((entry) => entry.mediaId));
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const align = () => track.scrollTo({ left: indexRef.current * track.clientWidth, behavior: 'instant' });
    align();
    const observer = new ResizeObserver(align);
    observer.observe(track);
    return () => observer.disconnect();
  }, [place.id, photoSignature]);
  const selectPhoto = (index: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, index));
    setSelectedId(photos[next]?.mediaId ?? null);
    trackRef.current?.scrollTo({ left: next * trackRef.current.clientWidth, behavior: 'instant' });
  };
  return <article className="landmark-guide-card" data-place-id={place.id}>
    <div className="landmark-guide-image">
      {photos.length ? <div ref={trackRef} className="landmark-gallery-track" role="group" aria-roledescription="사진 슬라이드" aria-label={`${place.name} 사진 ${photos.length}장`} tabIndex={photos.length > 1 ? 0 : undefined}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          selectPhoto(event.key === 'Home' ? 0 : event.key === 'End' ? photos.length - 1 : photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
        }}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (!track.clientWidth) return;
          const next = Math.max(0, Math.min(photos.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
          setSelectedId(photos[next]?.mediaId ?? null);
        }}>
        {photos.map((entry, index) => <figure key={entry.mediaId} aria-hidden={index !== photoIndex}>
          {failedImages.has(entry.image)
            ? <div className="landmark-guide-image-error" role="img" aria-label={`${place.name} 사진 불러오기 실패`}><ImageOff size={26} aria-hidden="true" /><p>사진을 불러오지 못했어요</p></div>
            : Math.abs(index - photoIndex) <= 1 && <img src={entry.image} alt={entry.alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailedImages((current) => new Set(current).add(entry.image))} />}
        </figure>)}
      </div> : <div className="landmark-guide-image-error" role="img" aria-label={`${place.name} 사진 준비 중`}><ImageOff size={26} aria-hidden="true" /><p>장소 사진 준비 중</p></div>}
      <span>{place.area.split(/\s+/)[0]} · {placeKindLabel[place.kind]}</span>
      {photos.length > 1 && <>
        <div className="landmark-gallery-controls">
          <button type="button" aria-label={`${place.name} 이전 사진`} disabled={photoIndex === 0} onClick={() => selectPhoto(photoIndex - 1)}><ChevronLeft size={22} /></button>
          <button type="button" aria-label={`${place.name} 다음 사진`} disabled={photoIndex === photos.length - 1} onClick={() => selectPhoto(photoIndex + 1)}><ChevronRight size={22} /></button>
        </div>
        <output className="landmark-gallery-count" aria-live="polite" aria-label={`${place.name} 사진 순서`}>{photoIndex + 1} / {photos.length}</output>
      </>}
    </div>
    <div className="landmark-guide-copy">
      <small>{place.area} · {place.bestTime ?? place.duration}</small><h3>{place.name}</h3>
      <strong>{place.hook ?? `${place.area} 일정에 담기 좋은 장소`}</strong><p>{place.description}</p>
      {place.note && <blockquote>{place.tags?.includes('공공자료') ? '자료 안내' : '여행자 메모'} · {place.note}</blockquote>}
      {photo?.caption && <p className="landmark-gallery-caption" aria-live="polite">{photo.caption}</p>}
      {photo && <PhotoCredit image={photo.image} sourceId={photo.sourceId} />}
      <div className="landmark-guide-tags">{place.tags?.map(tag => <span key={tag}>#{tag}</span>)}</div>
      {actions !== null && <div className="landmark-guide-actions">{actions !== undefined ? actions : <>{primaryAction ?? <Button size="card" onClick={onToggle} aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? '저장됨' : '이 장소 저장'}</Button>}<Button size="card" variant="secondary" onClick={onShare}><Share2 size={16} />공유</Button></>}</div>}
      {footer}
    </div>
  </article>;
}
