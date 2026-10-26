'use client';

import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { PhotoSource } from '@/lib/photo-source';
import { PhotoSourceButton } from './photo-source-modal';
import './registered-photo-gallery.css';

export function RegisteredPhotoGallery({ photos, name }: { photos: readonly PhotoSource[]; name: string }) {
  const [viewportRef, carousel] = useEmblaCarousel({ align: 'start', loop: false, watchDrag: photos.length > 1 });
  const [active, setActive] = useState(0);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const selected = Math.min(active, Math.max(0, photos.length - 1));
  const photo = photos[selected];

  useEffect(() => {
    if (!carousel) return;
    const update = () => setActive(carousel.selectedScrollSnap());
    update();
    carousel.on('select', update);
    carousel.on('reInit', update);
    return () => {
      carousel.off('select', update);
      carousel.off('reInit', update);
    };
  }, [carousel]);

  if (!photo) return <p className="tr-meta">등록된 실제 사진이 없어요. 다른 장소의 사진으로 대신하지 않습니다.</p>;
  return <div className="tr-registered-gallery">
    <figure className="tr-detail-photo">
      <div className="tr-photo-swipe-frame">
        <div ref={viewportRef} className="tr-photo-swipe-viewport" role="region" aria-roledescription="carousel" aria-label={`${name} 사진 · 좌우로 넘겨 보세요`} tabIndex={photos.length > 1 ? 0 : -1}
          onKeyDown={event => {
            if (event.target !== event.currentTarget || photos.length < 2) return;
            if (event.key === 'ArrowLeft') { event.preventDefault(); carousel?.scrollPrev(); }
            if (event.key === 'ArrowRight') { event.preventDefault(); carousel?.scrollNext(); }
            if (event.key === 'Home') { event.preventDefault(); carousel?.scrollTo(0); }
            if (event.key === 'End') { event.preventDefault(); carousel?.scrollTo(photos.length - 1); }
          }}>
          <div className="tr-photo-swipe-track">
            {photos.map((item, index) => <div className="tr-photo-swipe-slide" key={item.id} role="group" aria-roledescription="slide" aria-label={`${photos.length}장 중 ${index + 1}번째 사진`} aria-hidden={index !== selected}>
              {!failedIds.includes(item.id) ? <img src={item.image} alt={item.title || name} width={600} height={320} loading="lazy" draggable={false}
                onError={() => setFailedIds(ids => ids.includes(item.id) ? ids : [...ids, item.id])}/>
                : <div className="tr-photo-swipe-error"><span>사진을 불러오지 못했어요.</span><button type="button" tabIndex={index === selected ? 0 : -1} onClick={() => setFailedIds(ids => ids.filter(id => id !== item.id))}>다시 보기</button></div>}
            </div>)}
          </div>
        </div>
        {photos.length > 1 && <div className="tr-photo-swipe-pagination" aria-hidden="true">{photos.map((item, index) => <span key={item.id} className={index === selected ? 'is-active' : undefined}/>)}</div>}
      </div>
      <figcaption>{photo.title} · {photo.author || photo.owner}</figcaption>
    </figure>
    {photos.length > 1 && <span className="tr-photo-swipe-status" role="status" aria-live="polite">{photos.length}장 중 {selected + 1}번째 사진</span>}
    <PhotoSourceButton key={photo.id} photo={photo} name={name}/>
  </div>;
}
