import snapshot from './registered-spotlog-snapshot';
import legacyPhotos from './discovery-legacy-photos';

/** Existing, individually checked metadata only. Missing values are never inferred. */
export type PhotoSource = {
  id: string;
  placeId: string;
  title: string;
  image: string;
  originalTitle?: string;
  author?: string;
  owner?: string;
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
  imageSourceUrl?: string;
  verifiedAt?: string;
  publishedAt?: string;
  changes?: string;
  reuseNote?: string;
};

const sources: readonly PhotoSource[] = [
  ...snapshot.entries.flatMap(entry => entry.photos),
  ...legacyPhotos,
];

/** Match both the place and the exact displayed asset; never borrow another photo's rights. */
export function photoSourceForImage(entityId: string, image: string): PhotoSource | undefined {
  return sources.find(photo => photo.placeId === entityId && photo.image === image);
}

export function photoSourceForId(photoId: string): PhotoSource | undefined {
  return sources.find(photo => photo.id === photoId);
}

export function photoSourceLink(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? value : null;
  } catch { return null; }
}

export function photoSourceFacts(photo: PhotoSource) {
  const value = (text: string | undefined) => text?.trim() || '등록 자료에 없음';
  return [
    ['등록 제목', value(photo.title)],
    ['원문 제목', value(photo.originalTitle)],
    ['저작자', value(photo.author)],
    ['보유·제공 기관', value(photo.owner)],
    ['이용 허락', value(photo.license)],
    ['권리 자료 확인일', value(photo.verifiedAt)],
    ['원문 제작·게시 시점', value(photo.publishedAt)],
    ['수정·가공 기록', value(photo.changes)],
    ['추가 이용 조건', value(photo.reuseNote)],
  ] as const;
}
