import { ArrowDown, ArrowUp, Bookmark, ChevronLeft, ChevronRight, ImageOff, MapPin, Share2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Place } from './data';
import { BottomSheet, hasActiveSheet } from './BottomSheet';
import { getPlacePhotos, type PlacePhoto } from './PhotoPlaceCard';
import './photo-landmark-feed.css';

// Discovery position is ephemeral UI state, separate from saved places and journeys.
// Keep it while switching tabs without modifying the user's travel data.
let rememberedPlaceId: string | null = null;
const rememberedPhotoIndices = new Map<string, number>();
const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

interface PhotoLandmarkFeedProps {
  places: Place[];
  savedIds: string[];
  onToggle: (id: string) => void;
  onShare: (place: Place) => void;
}

export function PhotoLandmarkFeed({ places, savedIds, onToggle, onShare }: PhotoLandmarkFeedProps) {
  const entries = useMemo(() => places.map((place) => ({ place, photos: getPlacePhotos(place) })).filter((entry) => entry.photos.length > 0), [places]);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, entries.findIndex(({ place }) => place.id === rememberedPlaceId)));
  const [photoIndices, setPhotoIndices] = useState(() => new Map(rememberedPhotoIndices));
  const [storyPlace, setStoryPlace] = useState<Place | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);
  const placeSignature = entries.map(({ place }) => place.id).join('|');

  const updateActivePlace = (index: number) => {
    const next = Math.max(0, Math.min(entries.length - 1, index));
    activeIndexRef.current = next;
    rememberedPlaceId = entries[next]?.place.id ?? null;
    setActiveIndex(next);
  };

  const goToPlace = (index: number) => {
    const feed = feedRef.current;
    if (!feed || !entries.length) return;
    const next = Math.max(0, Math.min(entries.length - 1, index));
    updateActivePlace(next);
    feed.scrollTo({ top: next * feed.clientHeight, behavior: scrollBehavior() });
  };

  const updatePhoto = (placeId: string, index: number) => {
    rememberedPhotoIndices.set(placeId, index);
    setPhotoIndices((current) => current.get(placeId) === index ? current : new Map(current).set(placeId, index));
  };

  const goToPhoto = (index: number) => {
    const entry = entries[activeIndexRef.current];
    const track = feedRef.current?.children[activeIndexRef.current]?.querySelector<HTMLDivElement>('.photo-reel-track');
    if (!entry || !track) return;
    const next = Math.max(0, Math.min(entry.photos.length - 1, index));
    updatePhoto(entry.place.id, next);
    track.scrollTo({ left: next * track.clientWidth, behavior: scrollBehavior() });
  };

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const rememberedIndex = Math.max(0, entries.findIndex(({ place }) => place.id === rememberedPlaceId));
    updateActivePlace(rememberedIndex);
    feed.scrollTo({ top: rememberedIndex * feed.clientHeight, behavior: 'instant' });
    // A viewport resize must not leave the reader halfway between landmarks.
    let width = feed.clientWidth;
    let height = feed.clientHeight;
    let wasHidden = false;
    const observer = new ResizeObserver(() => {
      if (!feed.clientWidth || !feed.clientHeight) { wasHidden = true; return; }
      if (!wasHidden && width === feed.clientWidth && height === feed.clientHeight) return;
      wasHidden = false;
      width = feed.clientWidth;
      height = feed.clientHeight;
      feed.scrollTo({ top: activeIndexRef.current * height, behavior: 'instant' });
    });
    observer.observe(feed);
    return () => observer.disconnect();
  }, [placeSignature]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const feed = feedRef.current;
      if (!feed?.clientHeight || !feed.getClientRects().length || hasActiveSheet() || target?.closest('input,textarea,select,[contenteditable="true"]') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const entry = entries[activeIndexRef.current];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') goToPlace(activeIndexRef.current + (event.key === 'ArrowDown' ? 1 : -1));
      else if (entry) goToPhoto((photoIndices.get(entry.place.id) ?? 0) + (event.key === 'ArrowRight' ? 1 : -1));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [entries, photoIndices]);

  if (!entries.length) return <div className="photo-reel-empty"><ImageOff size={28} /><h2>사진을 준비하고 있어요</h2><p>장소 사진이 준비되면 여기서 바로 넘겨볼 수 있어요.</p></div>;

  return <>
    <div ref={feedRef} className="photo-landmark-feed" role="region" aria-label="사진으로 랜드마크 둘러보기. 위아래로 장소, 좌우로 사진 이동" tabIndex={0}
      onScroll={(event) => { if (event.currentTarget.clientHeight) updateActivePlace(Math.round(event.currentTarget.scrollTop / event.currentTarget.clientHeight)); }}>
      {entries.map(({ place, photos }, index) => <PhotoLandmarkReel key={place.id} place={place} photos={photos}
        index={index} total={entries.length} active={index === activeIndex} nearby={Math.abs(index - activeIndex) <= 1}
        photoIndex={Math.min(photoIndices.get(place.id) ?? 0, photos.length - 1)}
        saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)}
        onPhotoChange={(next) => updatePhoto(place.id, next)} onOpenStory={() => setStoryPlace(place)}
        onPreviousPlace={() => goToPlace(index - 1)} onNextPlace={() => goToPlace(index + 1)} />)}
    </div>
    {storyPlace && <BottomSheet title={storyPlace.name} description={storyPlace.area} onClose={() => setStoryPlace(null)}>
      <div className="photo-reel-story">
        <p>{storyPlace.description}</p>
        {storyPlace.note && <blockquote>{storyPlace.note}</blockquote>}
        <dl><dt>주소</dt><dd>{storyPlace.address || '주소 확인 중'}</dd><dt>추천 체류</dt><dd>{storyPlace.duration || '방문 계획에 맞게 조정'}</dd>{storyPlace.bestTime && <><dt>방문 참고</dt><dd>{storyPlace.bestTime}</dd></>}</dl>
        <p className="photo-reel-disclaimer">장소를 소개하기 위한 샘플 이미지입니다. 운영 정보는 방문 전에 확인해 주세요.</p>
        <button type="button" className="primary wide" aria-pressed={savedIds.includes(storyPlace.id)} onClick={() => onToggle(storyPlace.id)}><Bookmark size={18} fill={savedIds.includes(storyPlace.id) ? 'currentColor' : 'none'} />{savedIds.includes(storyPlace.id) ? '저장 해제' : '빠른 저장'}</button>
      </div>
    </BottomSheet>}
  </>;
}

function PhotoLandmarkReel({ place, photos, index, total, active, nearby, photoIndex, saved, onToggle, onShare, onPhotoChange, onOpenStory, onPreviousPlace, onNextPlace }: {
  place: Place; photos: PlacePhoto[]; index: number; total: number; active: boolean; nearby: boolean; photoIndex: number; saved: boolean;
  onToggle: () => void; onShare: () => void; onPhotoChange: (index: number) => void; onOpenStory: () => void; onPreviousPlace: () => void; onNextPlace: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedPhotoRef = useRef(photoIndex);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  selectedPhotoRef.current = photoIndex;

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: selectedPhotoRef.current * track.clientWidth, behavior: 'instant' });
    let width = track.clientWidth;
    let wasHidden = false;
    const observer = new ResizeObserver(() => {
      if (!track.clientWidth) { wasHidden = true; return; }
      if (!wasHidden && width === track.clientWidth) return;
      wasHidden = false;
      width = track.clientWidth;
      track.scrollTo({ left: selectedPhotoRef.current * width, behavior: 'instant' });
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [place.id]);

  const selectPhoto = (requested: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(photos.length - 1, requested));
    onPhotoChange(next);
    track.scrollTo({ left: next * track.clientWidth, behavior: scrollBehavior() });
  };

  return <article className="photo-landmark-reel" data-place-id={place.id} data-active={active} aria-label={`${place.name}, ${index + 1}번째 장소`} aria-hidden={!active} inert={!active}>
    <div ref={trackRef} className="photo-reel-track" data-photo-index={photoIndex} role="group" aria-roledescription="사진 슬라이드" aria-label={`${place.name} 사진 ${photos.length}장`}
      onScroll={(event) => { if (event.currentTarget.clientWidth) onPhotoChange(Math.max(0, Math.min(photos.length - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)))); }}>
      {photos.map((photo, imageIndex) => <figure key={photo.image} aria-hidden={imageIndex !== photoIndex}>
        {failedImages.includes(photo.image) ? <div className="photo-reel-image-error"><ImageOff size={28} aria-hidden="true" /><span>사진을 불러오지 못했어요</span><small>옆 사진이나 다음 장소를 살펴보세요</small></div>
          : nearby && Math.abs(imageIndex - photoIndex) <= 1 ? <img src={photo.image} alt={photo.alt} draggable={false} decoding="async" loading={active && imageIndex === photoIndex ? 'eager' : 'lazy'} onError={() => setFailedImages((current) => [...current, photo.image])} /> : null}
      </figure>)}
    </div>
    <div className="photo-reel-shade" />
    <div className="photo-reel-meta"><span className="photo-reel-place-count">장소 {index + 1} / {total}</span><span className="photo-reel-count" aria-live={active ? 'polite' : 'off'}>사진 {photoIndex + 1} / {photos.length}</span></div>
    <div className="photo-reel-place-navigation">
      <button type="button" aria-label="이전 랜드마크" disabled={index === 0} onClick={onPreviousPlace}><ArrowUp size={19} /></button>
      <button type="button" aria-label="다음 랜드마크" disabled={index === total - 1} onClick={onNextPlace}><ArrowDown size={19} /></button>
    </div>
    {photos.length > 1 && <div className="photo-reel-side-navigation">
      <button type="button" aria-label={`${place.name} 이전 사진`} disabled={photoIndex === 0} onClick={() => selectPhoto(photoIndex - 1)}><ChevronLeft size={26} /></button>
      <button type="button" aria-label={`${place.name} 다음 사진`} disabled={photoIndex === photos.length - 1} onClick={() => selectPhoto(photoIndex + 1)}><ChevronRight size={26} /></button>
    </div>}
    <div className="photo-reel-copy">
      <span className="photo-reel-area"><MapPin size={14} aria-hidden="true" />{place.area}<i />샘플 이미지</span>
      <h2>{place.name}</h2>
      <p className="photo-reel-caption" aria-live={active ? 'polite' : 'off'}>{photos[photoIndex].caption}</p>
      <button type="button" className="photo-reel-story-button" aria-label={`${place.name} 장소 이야기`} onClick={onOpenStory}>장소 이야기<ChevronRight size={15} /></button>
      <div className="photo-reel-pagination" aria-label={`${place.name} 사진 선택`}>
        {photos.length > 1 ? <div className="photo-reel-dots">{photos.map((photo, imageIndex) => <button type="button" key={photo.image} className={imageIndex === photoIndex ? 'is-active' : ''} aria-current={imageIndex === photoIndex ? 'true' : undefined} aria-label={`${place.name} ${imageIndex + 1}번째 사진`} onClick={() => selectPhoto(imageIndex)}><span /></button>)}</div> : <span className="photo-reel-single-label">이 장소의 한 장</span>}
        <span className="photo-reel-swipe-hint">{photos.length > 1 ? '옆으로 사진 · ' : ''}{index === total - 1 ? '아래로 넘겨 이전 장소' : '위로 넘겨 다음 장소'}</span>
      </div>
    </div>
    <div className="photo-reel-actions">
      <div><button type="button" className={saved ? 'is-saved' : ''} onClick={onToggle} aria-pressed={saved} aria-label={`${place.name} ${saved ? '저장 해제' : '저장'}`}><Bookmark size={25} fill={saved ? 'currentColor' : 'none'} /></button><span>{saved ? '저장됨' : '저장'}</span></div>
      <div><button type="button" onClick={onShare} aria-label={`${place.name} 공유`}><Share2 size={24} /></button><span>공유</span></div>
    </div>
  </article>;
}
