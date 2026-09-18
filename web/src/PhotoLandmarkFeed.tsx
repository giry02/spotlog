import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, ImageOff, MapPin, Share2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Place } from './data';
import { BottomSheet, hasActiveSheet } from './BottomSheet';
import { getPlacePhotos, type PlacePhoto } from './PhotoPlaceCard';
import { activePhotoIndex } from './placePhotos';
import { PhotoCredit } from './PublicTourismCredit';
import { realSlot, wrapPlace } from './photoFeedNavigation';
import { usePhotoFeedGesture } from './usePhotoFeedGesture';
import { MediaRegionButton } from './MediaRegionButton';
import './photo-landmark-feed.css';

// Discovery position is ephemeral UI state, separate from saved places and journeys.
// Keep it while switching tabs without modifying the user's travel data.
let rememberedPlaceId: string | null = null;
const rememberedPhotoIds = new Map<string, string>();
const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

interface PhotoLandmarkFeedProps {
  places: Place[];
  savedIds: string[];
  onToggle: (id: string) => void;
  onShare: (place: Place) => void;
  region?: string;
  onChooseRegion?: (trigger: HTMLButtonElement) => void;
}

export function PhotoLandmarkFeed({ places, savedIds, onToggle, onShare, region = '', onChooseRegion }: PhotoLandmarkFeedProps) {
  const entries = useMemo(() => places.map((place) => ({ place, photos: getPlacePhotos(place) })).filter((entry) => entry.photos.length > 0), [places]);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, entries.findIndex(({ place }) => place.id === rememberedPlaceId)));
  const [photoIds, setPhotoIds] = useState(() => new Map(rememberedPhotoIds));
  const [storyPlace, setStoryPlace] = useState<Place | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);
  const loop = entries.length > 1;
  const [activeSlot, setActiveSlot] = useState(activeIndex + (loop ? 1 : 0));
  const activeSlotRef = useRef(activeSlot);
  const slots = loop ? [entries[entries.length - 1], ...entries, entries[0]] : entries;
  const placeSignature = entries.map(({ place }) => place.id).join('|');

  const updateActivePlace = (index: number) => {
    const next = wrapPlace(index, entries.length);
    activeIndexRef.current = next;
    rememberedPlaceId = entries[next]?.place.id ?? null;
    setActiveIndex(next);
  };

  const updateSlot = (slot: number) => {
    activeSlotRef.current = slot;
    setActiveSlot(slot);
    updateActivePlace(loop ? slot - 1 : slot);
  };

  const goToPlace = (index: number) => {
    const feed = feedRef.current;
    if (!feed || !entries.length) return;
    const next = loop ? Math.max(0, Math.min(entries.length + 1, index + 1)) : 0;
    updateSlot(next);
    feed.scrollTo({ top: next * feed.clientHeight, behavior: scrollBehavior() });
  };

  const updatePhoto = (placeId: string, index: number) => {
    const id = entries.find((entry) => entry.place.id === placeId)?.photos[index]?.mediaId;
    if (!id) return;
    rememberedPhotoIds.set(placeId, id);
    setPhotoIds((current) => current.get(placeId) === id ? current : new Map(current).set(placeId, id));
  };

  const goToPhoto = (index: number) => {
    const entry = entries[activeIndexRef.current];
    const track = feedRef.current?.children[activeSlotRef.current]?.querySelector<HTMLDivElement>('.photo-reel-track');
    if (!entry || !track) return;
    const next = Math.max(0, Math.min(entry.photos.length - 1, index));
    updatePhoto(entry.place.id, next);
    track.scrollTo({ left: next * track.clientWidth, behavior: scrollBehavior() });
  };

  const prepareGesture = () => {
    const slot = realSlot(activeSlotRef.current, entries.length);
    if (slot !== activeSlotRef.current) {
      updateSlot(slot);
      feedRef.current?.scrollTo({ top: slot * feedRef.current.clientHeight, behavior: 'instant' });
    }
  };
  const gesture = usePhotoFeedGesture(feedRef, (step) => goToPlace(activeIndexRef.current + step), goToPhoto, hasActiveSheet, prepareGesture);

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const rememberedIndex = Math.max(0, entries.findIndex(({ place }) => place.id === rememberedPlaceId));
    updateSlot(rememberedIndex + (loop ? 1 : 0));
    feed.scrollTo({ top: activeSlotRef.current * feed.clientHeight, behavior: 'instant' });
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
      feed.scrollTo({ top: activeSlotRef.current * height, behavior: 'instant' });
    });
    observer.observe(feed);
    return () => observer.disconnect();
  }, [placeSignature]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !loop) return;
    let settleTimer = 0;
    const settle = () => {
      if (feed.dataset.gestureAxis || !feed.clientHeight) return;
      const slot = Math.round(feed.scrollTop / feed.clientHeight);
      const normalized = realSlot(slot, entries.length);
      if (Math.abs(feed.scrollTop - slot * feed.clientHeight) > 1 || slot === normalized) return;
      updateSlot(normalized);
      feed.scrollTo({ top: normalized * feed.clientHeight, behavior: 'instant' });
    };
    const schedule = () => { window.clearTimeout(settleTimer); settleTimer = window.setTimeout(settle, 140); };
    feed.addEventListener('scrollend', settle);
    feed.addEventListener('scroll', schedule, { passive: true });
    return () => { window.clearTimeout(settleTimer); feed.removeEventListener('scrollend', settle); feed.removeEventListener('scroll', schedule); };
  }, [placeSignature]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const feed = feedRef.current;
      if (!feed?.clientHeight || !feed.getClientRects().length || hasActiveSheet() || target?.closest('input,textarea,select,[contenteditable="true"]') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      prepareGesture();
      const entry = entries[activeIndexRef.current];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') goToPlace(activeIndexRef.current + (event.key === 'ArrowDown' ? 1 : -1));
      else if (entry) goToPhoto(activePhotoIndex(entry.photos, photoIds.get(entry.place.id) ?? null) + (event.key === 'ArrowRight' ? 1 : -1));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [entries, photoIds]);

  if (!entries.length) return <div className="photo-reel-empty"><ImageOff size={28} /><h2>{region ? `${region} 사진을 준비하고 있어요` : '사진을 준비하고 있어요'}</h2><p>다른 지역의 장소 사진을 먼저 살펴보세요.</p>{onChooseRegion && <button type="button" className="photo-region-button" onClick={(event) => onChooseRegion(event.currentTarget)}><MapPin size={16} />지역 선택<ChevronDown size={16} /></button>}</div>;

  return <>
    <div ref={feedRef} className="photo-landmark-feed" role="region" aria-label="사진으로 랜드마크 둘러보기. 위아래로 장소, 좌우로 사진 이동" tabIndex={0} {...gesture}
      onScroll={(event) => { if (!event.currentTarget.dataset.gestureAxis && event.currentTarget.clientHeight) updateSlot(Math.round(event.currentTarget.scrollTop / event.currentTarget.clientHeight)); }}>
      {slots.map(({ place, photos }, slot) => <PhotoLandmarkReel key={`${slot}:${place.id}`} place={place} photos={photos}
        index={loop ? wrapPlace(slot - 1, entries.length) : slot} total={entries.length} active={slot === activeSlot} nearby={Math.abs(slot - activeSlot) <= 1}
        photoIndex={activePhotoIndex(photos, photoIds.get(place.id) ?? null)}
        saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)}
        onPhotoChange={(next) => updatePhoto(place.id, next)} onOpenStory={() => setStoryPlace(place)}
        region={region} onChooseRegion={onChooseRegion} />)}
    </div>
    {storyPlace && <BottomSheet title={storyPlace.name} description={storyPlace.area} onClose={() => setStoryPlace(null)}>
      <div className="photo-reel-story">
        <p>{storyPlace.description}</p>
        {storyPlace.note && <blockquote>{storyPlace.note}</blockquote>}
        <dl><dt>주소</dt><dd>{storyPlace.address || '주소 확인 중'}</dd><dt>추천 체류</dt><dd>{storyPlace.duration || '방문 계획에 맞게 조정'}</dd>{storyPlace.bestTime && <><dt>방문 참고</dt><dd>{storyPlace.bestTime}</dd></>}</dl>
        <p className="photo-reel-disclaimer">{getPlacePhotos(storyPlace).some((photo) => photo.sourceId) ? '사진 출처와 운영 정보는 방문 전에 확인해 주세요.' : '장소를 소개하기 위한 샘플 이미지입니다. 운영 정보는 방문 전에 확인해 주세요.'}</p>
        <button type="button" className="primary wide" aria-pressed={savedIds.includes(storyPlace.id)} onClick={() => onToggle(storyPlace.id)}><Bookmark size={18} fill={savedIds.includes(storyPlace.id) ? 'currentColor' : 'none'} />{savedIds.includes(storyPlace.id) ? '저장 해제' : '빠른 저장'}</button>
      </div>
    </BottomSheet>}
  </>;
}

function PhotoLandmarkReel({ place, photos, index, total, active, nearby, photoIndex, saved, onToggle, onShare, onPhotoChange, onOpenStory, region, onChooseRegion }: {
  place: Place; photos: PlacePhoto[]; index: number; total: number; active: boolean; nearby: boolean; photoIndex: number; saved: boolean;
  onToggle: () => void; onShare: () => void; onPhotoChange: (index: number) => void; onOpenStory: () => void;
  region: string; onChooseRegion?: (trigger: HTMLButtonElement) => void;
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
  }, [place.id, JSON.stringify(photos.map((photo) => photo.mediaId))]);

  // The wrap copies must show the same remembered photo as their original reel.
  useLayoutEffect(() => {
    if (!active) trackRef.current?.scrollTo({ left: photoIndex * trackRef.current.clientWidth, behavior: 'instant' });
  }, [active, photoIndex]);

  const selectPhoto = (requested: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(photos.length - 1, requested));
    onPhotoChange(next);
    track.scrollTo({ left: next * track.clientWidth, behavior: scrollBehavior() });
  };

  return <article className="photo-landmark-reel" data-place-id={place.id} data-active={active} aria-label={`${place.name}, ${index + 1}번째 장소`} aria-hidden={!active} inert={!active}>
    <div ref={trackRef} className="photo-reel-track" data-photo-index={photoIndex} role="group" aria-roledescription="사진 슬라이드" aria-label={`${place.name} 사진 ${photos.length}장`}
      onScroll={(event) => { if (active && !event.currentTarget.closest('[data-gesture-axis]') && event.currentTarget.clientWidth) onPhotoChange(Math.max(0, Math.min(photos.length - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)))); }}>
      {photos.map((photo, imageIndex) => <figure key={photo.mediaId} aria-hidden={imageIndex !== photoIndex}>
        {failedImages.includes(photo.image) ? <div className="photo-reel-image-error"><ImageOff size={28} aria-hidden="true" /><span>사진을 불러오지 못했어요</span><small>옆 사진이나 다음 장소를 살펴보세요</small></div>
          : nearby && Math.abs(imageIndex - photoIndex) <= 1 ? <img src={photo.image} alt={photo.alt} style={{ objectPosition: photo.objectPosition }} draggable={false} decoding="async" loading={active && imageIndex === photoIndex ? 'eager' : 'lazy'} onError={() => setFailedImages((current) => [...current, photo.image])} /> : null}
      </figure>)}
    </div>
    <div className="photo-reel-shade" />
    {photos.length > 1 && <div className="photo-reel-meta"><span className="photo-reel-count" aria-live={active ? 'polite' : 'off'}>사진 {photoIndex + 1} / {photos.length}</span></div>}
    {photos.length > 1 && <div className="photo-reel-side-navigation">
      <button type="button" aria-label={`${place.name} 이전 사진`} disabled={photoIndex === 0} onClick={() => selectPhoto(photoIndex - 1)}><ChevronLeft size={26} /></button>
      <button type="button" aria-label={`${place.name} 다음 사진`} disabled={photoIndex === photos.length - 1} onClick={() => selectPhoto(photoIndex + 1)}><ChevronRight size={26} /></button>
    </div>}
    <div className="photo-reel-copy">
      <span className="photo-reel-area"><MapPin size={14} aria-hidden="true" />{place.area}<i />{photos[photoIndex].sourceId ? '장소 사진' : '샘플 이미지'}</span>
      <h2>{place.name}</h2>
      <p className="photo-reel-caption" aria-live={active ? 'polite' : 'off'}>{photos[photoIndex].caption}</p>
      <PhotoCredit image={photos[photoIndex].image} sourceId={photos[photoIndex].sourceId} />
      <button type="button" className="photo-reel-story-button" aria-label={`${place.name} 장소 이야기`} onClick={onOpenStory}>장소 이야기<ChevronRight size={15} /></button>
      <div className="photo-reel-pagination" aria-label={`${place.name} 사진 선택`}>
        {photos.length > 1 ? <div className="photo-reel-dots">{photos.map((photo, imageIndex) => <button type="button" key={photo.mediaId} className={imageIndex === photoIndex ? 'is-active' : ''} aria-current={imageIndex === photoIndex ? 'true' : undefined} aria-label={`${place.name} ${imageIndex + 1}번째 사진`} onClick={() => selectPhoto(imageIndex)}><span /></button>)}</div> : <span className="photo-reel-single-label">이 장소의 한 장</span>}
        {total > 1 && <span className="photo-reel-swipe-hint">{photos.length > 1 ? '옆으로 사진 · ' : ''}위로 넘겨 다음 장소</span>}
      </div>
    </div>
    <div className="photo-reel-actions">
      <div><button type="button" className={saved ? 'is-saved' : ''} onClick={onToggle} aria-pressed={saved} aria-label={`${place.name} ${saved ? '저장 해제' : '저장'}`}><Bookmark size={25} fill={saved ? 'currentColor' : 'none'} /></button><span>{saved ? '저장됨' : '저장'}</span></div>
      <div><button type="button" onClick={onShare} aria-label={`${place.name} 공유`}><Share2 size={24} /></button><span>공유</span></div>
      {onChooseRegion && <MediaRegionButton region={region} onChoose={onChooseRegion} />}
    </div>
  </article>;
}
