import Image from 'next/image';
import type { Place } from '@/lib/connected-data';
import legacyPhotos from '@/lib/discovery-legacy-photos';
import type { PhotoSource } from '@/lib/photo-source';
import { RegisteredPhotoGallery } from './registered-photo-gallery';
import './business-content.css';

/** Same place-matched gallery in course rows, chat cards and detail sheets. */
export function PlacePhotoSection({ place, compact = false }: { place: Place; compact?: boolean }) {
  const photos: PhotoSource[] = [...(place.photos ?? []), ...legacyPhotos]
    .filter((photo, index, all) => photo.placeId === place.id && all.findIndex(other => other.id === photo.id) === index)
    .sort((a, b) => Number(b.image === place.image) - Number(a.image === place.image));
  return <div className={`tr-business-media${compact ? ' is-compact' : ''}`}>
    {photos.length > 0 ? <RegisteredPhotoGallery key={place.id} photos={photos} name={place.name}/> : <figure>
      <Image src={place.image} alt={place.imageKind === 'illustration' ? `${place.name} 안내용 일러스트 · 실제 장소 사진 아님` : place.name} width={600} height={320} loading="lazy" unoptimized/>
      <figcaption>{place.imageKind === 'illustration' ? '장소 안내용 공통 일러스트 · 실제 장소 사진이 아닙니다' : `${place.name} 대표 이미지`}</figcaption>
    </figure>}
  </div>;
}
