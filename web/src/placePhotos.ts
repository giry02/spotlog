/** Optional identity fields allow older local records to remain readable. */
export interface PlacePhotoInput {
  mediaId?: string;
  placeId?: string;
  sourceId?: string;
  image: string;
  alt: string;
  caption: string;
  /** Framing only; the downloaded photo file remains unchanged. */
  objectPosition?: string;
  availability?: 'available' | 'withdrawn';
}

export interface PlacePhoto extends PlacePhotoInput {
  mediaId: string;
  placeId: string;
}

export interface PhotoPlace {
  id: string;
  name?: string;
  image?: string;
  photos?: PlacePhotoInput[];
}

/** An explicit empty/withdrawn gallery must never resurrect an old cover. */
export function resolvePlacePhotos(place: PhotoPlace, samples: PlacePhotoInput[] = [], coverFallback = false): PlacePhoto[] {
  const candidates = place.photos ?? (samples.length ? samples : coverFallback && place.image
    ? [{ image: place.image, alt: `${place.name ?? '장소'} 여행 사진`, caption: '' }]
    : []);
  const seen = new Set<string>();
  return candidates.flatMap((photo): PlacePhoto[] => {
    if (!photo.image || photo.availability === 'withdrawn' || (photo.placeId && photo.placeId !== place.id)) return [];
    const mediaId = photo.mediaId || `${place.id}:${photo.image}`;
    if (seen.has(mediaId)) return [];
    seen.add(mediaId);
    return [{ ...photo, mediaId, placeId: place.id }];
  }).slice(0, 5);
}

export function activePhotoIndex(photos: PlacePhoto[], selectedId: string | null): number {
  return Math.max(0, photos.findIndex((photo) => photo.mediaId === selectedId));
}
