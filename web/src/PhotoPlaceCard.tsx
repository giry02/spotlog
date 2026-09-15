import { Bookmark, Check, ChevronLeft, ChevronRight, ImageOff, MapPin, Share2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Place } from './data';
import jejuGuideCover from '../../assets/spotlog/jeju-west-guide-cover.jpg';
import jejuHyeopjaeTidepool from '../../assets/spotlog/jeju-hyeopjae-tidepool.webp';
import jejuOsullocTeaField from '../../assets/spotlog/jeju-osulloc-tea-field.jpg';
import jejuOsullocMorningDew from '../../assets/spotlog/jeju-osulloc-morning-dew.webp';
import jejuSagyeCoast from '../../assets/spotlog/jeju-sagye-coast.jpg';
import jejuSagyeTidepool from '../../assets/spotlog/jeju-sagye-tidepool.webp';
import jejuSaebyeolOreum from '../../assets/spotlog/jeju-saebyeol-oreum.jpg';
import jejuSaebyeolTrail from '../../assets/spotlog/jeju-saebyeol-trail.webp';
import gangwonEastSeaCover from '../../assets/spotlog/gangwon-east-sea-sunrise.webp';
import seoulForestCover from '../../assets/spotlog/seoul-forest-evening.webp';
import './photo-places.css';

export interface PlacePhoto {
  image: string;
  alt: string;
  caption: string;
}

// These are existing place-specific demonstration assets, not verified visitor photos.
// Do not reuse a region's photo for another landmark just to fill a carousel.
const placePhotoSamples: Record<string, PlacePhoto[]> = {
  'jeju-hyeopjae': [
    { image: jejuGuideCover, alt: '협재해변과 비양도를 표현한 샘플 이미지', caption: '비양도를 바라보는 해변의 넓은 풍경.' },
    { image: jejuHyeopjaeTidepool, alt: '협재의 현무암과 물웅덩이를 표현한 샘플 이미지', caption: '바다 가까이에서 보는 현무암과 작은 물웅덩이. 젖은 바위는 조심해서 걸어요.' },
  ],
  'jeju-osulloc': [
    { image: jejuOsullocTeaField, alt: '오설록 차밭을 표현한 샘플 이미지', caption: '초록이 이어지는 차밭 풍경. 관람 가능한 길을 따라 천천히 둘러보세요.' },
    { image: jejuOsullocMorningDew, alt: '차밭의 잎과 돌담을 표현한 샘플 이미지', caption: '가까이에서 보는 찻잎과 돌담의 다른 표정.' },
  ],
  'jeju-sagye': [
    { image: jejuSagyeCoast, alt: '제주 사계해안을 표현한 샘플 이미지', caption: '산방산 아래로 이어지는 사계의 해안 풍경.' },
    { image: jejuSagyeTidepool, alt: '사계해안의 물웅덩이를 표현한 샘플 이미지', caption: '물이 빠진 자리의 작은 풍경. 물때와 현장 통제 안내를 먼저 확인하세요.' },
  ],
  'jeju-saebyeol': [
    { image: jejuSaebyeolOreum, alt: '새별오름의 능선을 표현한 샘플 이미지', caption: '제주의 중산간을 바라보는 오름의 능선.' },
    { image: jejuSaebyeolTrail, alt: '새별오름 산책길을 표현한 샘플 이미지', caption: '억새 사이로 이어지는 길. 그늘이 적으니 물과 모자를 준비하세요.' },
  ],
  'gangneung-anmok': [
    { image: gangwonEastSeaCover, alt: '안목해변의 아침 분위기를 표현한 샘플 이미지', caption: '커피 한 잔과 함께 시작하는 동해의 아침 산책.' },
  ],
  'seoul-seoulforest': [
    { image: seoulForestCover, alt: '서울숲 저녁 산책을 표현한 샘플 이미지', caption: '도심에서 초록을 만나는 저녁. 성수 골목과 이어 걸어보세요.' },
  ],
};

export function getPlacePhotos(place: Pick<Place, 'id'>): PlacePhoto[] {
  return (placePhotoSamples[place.id] ?? []).slice(0, 5);
}

interface PhotoPlaceCardProps {
  place: Place;
  saved: boolean;
  onToggle: () => void;
  onShare: () => void;
}

export function PhotoPlaceCard({ place, saved, onToggle, onShare }: PhotoPlaceCardProps) {
  const photos = useMemo(() => getPlacePhotos(place), [place.id]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  const titleId = `${uniqueId}-title`;
  const trackId = `${uniqueId}-photos`;
  const displayedPhoto = Math.min(activePhoto, Math.max(0, photos.length - 1));
  const currentPhoto = photos[displayedPhoto];

  useEffect(() => {
    setActivePhoto(0);
    setFailedPhotos([]);
    trackRef.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [place.id]);

  const goToPhoto = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(photos.length - 1, index));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: track.clientWidth * next, behavior: reduceMotion ? 'instant' : 'smooth' });
    setActivePhoto(next);
  };

  return <article className="photo-place-card" aria-labelledby={titleId} data-place-id={place.id}>
    <header className="photo-place-heading">
      <div><span><MapPin size={13} aria-hidden="true" />{place.area}</span><h2 id={titleId}>{place.name}</h2></div>
      <button type="button" className={`photo-place-bookmark ${saved ? 'is-saved' : ''}`} onClick={onToggle} aria-pressed={saved} aria-label={`${place.name} ${saved ? '저장 해제' : '빠른 저장'}`}><Bookmark size={22} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /></button>
    </header>

    {photos.length ? <>
      <div className="photo-place-media">
        <div ref={trackRef} id={trackId} className="photo-place-track" role="region" aria-roledescription="사진 슬라이드" aria-label={`${place.name} 사진 ${photos.length}장`} tabIndex={photos.length > 1 ? 0 : undefined}
          onScroll={(event) => setActivePhoto(Math.max(0, Math.min(photos.length - 1, Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth)))))}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              event.stopPropagation();
              goToPhoto(displayedPhoto + (event.key === 'ArrowLeft' ? -1 : 1));
            }
          }}>
          {photos.map((photo, index) => <figure key={photo.image} aria-label={`${index + 1} / ${photos.length}`} aria-hidden={index !== displayedPhoto}>
            {failedPhotos.includes(photo.image)
              ? <div className="photo-place-image-error"><ImageOff size={28} aria-hidden="true" /><span>사진을 불러오지 못했어요</span></div>
              : <img src={photo.image} alt={photo.alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailedPhotos((current) => current.includes(photo.image) ? current : [...current, photo.image])} />}
          </figure>)}
        </div>
        <span className="photo-place-count" aria-live="polite" aria-atomic="true">{displayedPhoto + 1} / {photos.length}</span>
        <span className="photo-place-provenance">샘플 이미지</span>
      </div>
      {photos.length > 1 && <div className="photo-place-pagination" aria-label={`${place.name} 사진 선택`}>
        <button type="button" onClick={() => goToPhoto(displayedPhoto - 1)} disabled={displayedPhoto === 0} aria-controls={trackId} aria-label={`${place.name} 이전 사진`}><ChevronLeft size={19} aria-hidden="true" /></button>
        <div className="photo-place-dots">{photos.map((photo, index) => <button type="button" key={photo.image} className={index === displayedPhoto ? 'is-active' : ''} aria-label={`${place.name} ${index + 1}번째 사진`} aria-current={index === displayedPhoto ? 'true' : undefined} aria-controls={trackId} onClick={() => goToPhoto(index)}><span /></button>)}</div>
        <button type="button" onClick={() => goToPhoto(displayedPhoto + 1)} disabled={displayedPhoto === photos.length - 1} aria-controls={trackId} aria-label={`${place.name} 다음 사진`}><ChevronRight size={19} aria-hidden="true" /></button>
      </div>}
      {currentPhoto && <p className="photo-place-caption" aria-live="polite">{currentPhoto.caption}</p>}
    </> : <div className="photo-place-unavailable"><ImageOff size={24} aria-hidden="true" /><div><strong>장소 사진 준비 중</strong><p>이 장소에 맞는 사진을 확인한 뒤 제공할게요.</p></div></div>}

    <div className="photo-place-body">
      <p>{place.description}</p>
      {place.tags?.length ? <div className="photo-place-tags">{place.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
      <div className="photo-place-actions">
        <button type="button" className={saved ? 'is-saved' : ''} onClick={onToggle} aria-pressed={saved} aria-label={`${place.name} ${saved ? '저장 해제' : '빠른 저장'}`}>{saved ? <Check size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}<span>{saved ? '저장됨' : '빠른 저장'}</span></button>
        <button type="button" onClick={onShare} aria-label={`${place.name} 공유`}><Share2 size={18} aria-hidden="true" /><span>공유</span></button>
      </div>
    </div>
  </article>;
}
