import { open } from 'node:fs/promises';

const placeKinds = new Set(['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE']);
const maxCatalogBytes = 4 * 1024 * 1024;
const fields = new Set(['id', 'name', 'kind', 'area', 'region', 'description', 'tags', 'lat', 'lng']);
const validText = (value, max) => typeof value === 'string' && value.length <= max && value.length > 0 && value === value.trim();
const validCoordinate = (value, max) => Number.isFinite(value) && Math.abs(value) <= max;
const optionalText = (value, max) => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, max).trimEnd() : '';

function validateCatalog(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 20_000) throw new Error('공개 장소 목록이 비어 있거나 너무 커요.');
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(key => !fields.has(key))
      || !validText(row.id, 180) || ids.has(row.id) || !validText(row.name, 200) || !placeKinds.has(row.kind)
      || !validText(row.area, 160) || !validText(row.region, 80)
      || row.description !== undefined && !validText(row.description, 320)
      || row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.length > 8 || !row.tags.every(tag => validText(tag, 48)))
      || (row.lat !== undefined || row.lng !== undefined) && (!validCoordinate(row.lat, 90) || !validCoordinate(row.lng, 180))) {
      throw new Error('공개 장소 목록의 필드나 장소 ID를 확인해 주세요.');
    }
    ids.add(row.id);
  }
  return rows;
}

/** Receives the browser's built-in public catalogue, never local user/admin storage. */
export function projectPublicPlanningCatalog(places, regionForPlace) {
  const rows = places.filter(place => !place.personal && !place.bookingFixed).map(place => {
    const description = optionalText(place.description, 320);
    const tags = Array.isArray(place.tags) ? [...new Set(place.tags.map(tag => optionalText(tag, 48)).filter(Boolean))].slice(0, 8) : [];
    const coordinates = place.locationVerified === true && validCoordinate(place.lat, 90) && validCoordinate(place.lng, 180)
      ? { lat: place.lat, lng: place.lng } : {};
    return {
      id: place.id, name: place.name.trim(), kind: place.kind, area: place.area.trim(), region: regionForPlace(place),
      ...(description ? { description } : {}), ...(tags.length ? { tags } : {}), ...coordinates,
    };
  });
  return validateCatalog(rows);
}

export async function loadPublicPlanningCatalog(path) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('공개 장소 목록 파일 경로를 설정해 주세요.');
  const file = await open(path);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > maxCatalogBytes) throw new Error('공개 장소 목록 파일 형식이나 크기를 확인해 주세요.');
    return validateCatalog(JSON.parse(await file.readFile('utf8')));
  } finally {
    await file.close();
  }
}
