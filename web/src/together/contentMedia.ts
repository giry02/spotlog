import type { TogetherPhotoAttachment } from './model.ts';

export const MAX_PHOTO_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_STORED_PHOTO_BYTES = 768 * 1024;
export const MAX_POST_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_POST_PHOTOS = 4;
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function imageHeaderMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  return mime === 'image/webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

export function storedImageBytes(url: string): number {
  const payload = url.startsWith('data:') ? url.slice(url.indexOf(',') + 1) : '';
  return payload ? Math.floor(payload.length * 3 / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0) : 0;
}

/** Raster data and explicit HTTPS/root-relative image resources only; never SVG, blob or executable URLs. */
export function isSafeTogetherImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  if (value.startsWith('data:')) {
    if (value.length > Math.ceil(MAX_STORED_PHOTO_BYTES / 3) * 4 + 40) return false;
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0 || storedImageBytes(value) > MAX_STORED_PHOTO_BYTES) return false;
    try { return imageHeaderMatches(Uint8Array.from(atob(match[2].slice(0, 32)), char => char.charCodeAt(0)), match[1]); } catch { return false; }
  }
  if (value.length > 2048 || value.includes('\\')) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return !/[<>]/.test(value) && !value.includes('..');
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
}

export function isTogetherPhotoAttachments(value: unknown): value is TogetherPhotoAttachment[] {
  if (!Array.isArray(value) || value.length > MAX_POST_PHOTOS) return false;
  const ids = new Set<string>(); let bytes = 0;
  return value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['id', 'url', 'caption'].includes(key))) return false;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id.trim() || row.id.length > 160 || ids.has(row.id) || typeof row.caption !== 'string' || row.caption.length > 300 || !isSafeTogetherImageUrl(row.url)) return false;
    ids.add(row.id); bytes += storedImageBytes(row.url);
    return bytes <= MAX_POST_PHOTO_BYTES;
  });
}

export function isPublicReviewPreview(value: unknown): value is { title: string; excerpt: string; publishedAt: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 3 && typeof row.title === 'string' && Boolean(row.title.trim()) && row.title.length <= 120
    && typeof row.excerpt === 'string' && Boolean(row.excerpt.trim()) && row.excerpt.length <= 240
    && typeof row.publishedAt === 'string' && Number.isFinite(Date.parse(row.publishedAt));
}

/** Decode and re-encode local raster uploads so metadata and oversized source bytes are not persisted. */
export async function readTogetherPhoto(file: File, purpose: 'POST' | 'AVATAR' | 'COVER' = 'POST'): Promise<string> {
  if (!imageMimeTypes.has(file.type)) throw new Error('JPG, PNG, WebP 사진을 선택해 주세요.');
  if (!file.size || file.size > MAX_PHOTO_FILE_BYTES) throw new Error('5MB 이하의 사진을 선택해 주세요.');
  if (!imageHeaderMatches(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.type)) throw new Error('사진 형식과 파일 내용이 일치하지 않아요.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.decoding = 'async';
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.')); image.src = objectUrl; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 80_000_000) throw new Error('사진 크기가 너무 커요. 작은 사진을 선택해 주세요.');
    const bound = purpose === 'AVATAR' ? 480 : 1600;
    const scale = Math.min(1, bound / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('이 브라우저에서 사진을 준비하지 못했어요.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.84, .7, .55, .4]) {
      const result = canvas.toDataURL('image/webp', quality);
      if (isSafeTogetherImageUrl(result)) return result;
    }
    throw new Error('사진을 저장 가능한 크기로 줄이지 못했어요. 다른 사진을 선택해 주세요.');
  } finally { URL.revokeObjectURL(objectUrl); }
}
