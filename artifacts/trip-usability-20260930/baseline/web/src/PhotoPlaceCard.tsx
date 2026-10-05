import { Bookmark, Check, ChevronLeft, ChevronRight, ImageOff, MapPin, Share2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Place } from './data';
import { resolvePlacePhotos, type PlacePhoto, type PhotoPlace } from './placePhotos';
import { getPhotoSource, photoSources } from './photoSources';
export type { PlacePhoto } from './placePhotos';
import './photo-places.css';

export function getPlacePhotos(place: PhotoPlace, coverFallback = false): PlacePhoto[] {
  const verifiedPhotos = photoSources.filter((source) => source.placeId === place.id)
    .sort((a, b) => Number(b.image === place.image) - Number(a.image === place.image))
    .map((source) => ({ mediaId: `${source.license === '공공누리 제1유형' ? 'public' : 'licensed'}:${source.id}`, placeId: place.id, sourceId: source.id, image: source.image,
      alt: source.title, objectPosition: source.objectPosition, caption: source.caption ?? (source.id === 'busan-dongbaek-camellia'
        ? '동백섬 자료에 수록된 동백꽃. 방문 시기의 개화 상태는 다를 수 있어요.' : source.title) }));
  return resolvePlacePhotos(place, verifiedPhotos, coverFallback).map((photo) => ({
    ...photo, sourceId: photo.sourceId ?? getPhotoSource(photo.image)?.id,
  }));
}

interface PhotoPlaceCardProps {
  place: Place;
  saved: boolean;
  onToggle: () => void;
  onShare: () => void;
}

export function PhotoPlaceCard({ place, saved, onToggle, onShare }: PhotoPlaceCardProps) {
  const photos = useMemo(() => getPlacePhotos(place), [place]);
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
        <span className="photo-place-provenance">{currentPhoto?.sourceId ? '장소 사진' : '샘플 이미지'}</span>
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
