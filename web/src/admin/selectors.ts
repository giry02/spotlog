import type { AdminPlace, AdminState, AdminKind, PlaceContent } from './types';
import { contentInRegion, makeRegionSeed } from './regions.ts';

/** Shared by the local repository and the visible place list. Region filters include descendants. */
export function matchesPlaceFilters(place: AdminPlace, state: AdminState, filters: Record<string,string> = {}): boolean {
  return Object.entries(filters).every(([key,value]) => {
    if (!value) return true;
    if (key === 'regionId') return contentInRegion(place.draft,state.regions ?? makeRegionSeed(),value);
    if (key === 'assignedToId') return (place.meta?.assignedToId ?? '') === value;
    if (key === 'createdById') return (place.meta?.createdById ?? '') === value;
    if (key === 'reviewStatus') return (place.meta?.reviewStatus ?? 'DRAFT') === value;
    return String((place.draft as unknown as Record<string,unknown>)[key] ?? (place as unknown as Record<string,unknown>)[key] ?? '') === value;
  });
}

export function placeRegionCounts(state: AdminState): Record<string,number> {
  const regions = state.regions ?? makeRegionSeed();
  return Object.fromEntries(regions.map(region => [region.regionId,state.places.filter(place => contentInRegion(place.draft,regions,region.regionId)).length]));
}

export function safeSourceUrl(value: string): string {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !value.includes('\\') ? url.href : ''; } catch { return ''; }
}
export function safeAssetUrl(value: string): string { return safeSourceUrl(value) || (/^\/(?!\/)/.test(value) && !value.includes('\\') || /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value) ? value : ''); }
export function validCheckDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }

export function validLocation(content: PlaceContent): boolean {
  const { lat, lng, verified } = content.location;
  return verified && typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
export function eligiblePublished(place: AdminPlace): PlaceContent | null {
  const value = place.published;
  return place.state === 'PUBLISHED' && !place.revoked && value && value.operation === 'OPEN' && value.rights.display && value.rights.store && validLocation(value) ? value : null;
}
export function aiEligiblePublished(place: AdminPlace): PlaceContent | null {
  const value = eligiblePublished(place);
  return value && value.rights.ai && value.ai.allowed && value.ai.text.trim() && safeSourceUrl(value.ai.sourceUrl) && validCheckDate(value.ai.checkedAt) ? value : null;
}
export function distanceKm(a: PlaceContent, b: PlaceContent): number {
  const radians = (v: number) => v * Math.PI / 180;
  const lat = radians(b.location.lat! - a.location.lat!), lng = radians(b.location.lng! - a.location.lng!);
  const x = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.location.lat!)) * Math.cos(radians(b.location.lat!)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function nearbyPlaces(state: AdminState, anchorId: string, kind: AdminKind, radius: 3 | 15, includeExcluded = false) {
  const anchorRecord = state.places.find(p => p.placeId === anchorId), anchor = anchorRecord && eligiblePublished(anchorRecord);
  if (!anchor || anchor.kind !== 'LANDMARK') return [];
  return state.places.flatMap(record => {
    const content = eligiblePublished(record);
    if (!content || record.placeId === anchorId || content.kind !== kind) return [];
    const distance = distanceKm(anchor, content);
    const override = state.nearbyOverrides.find(v => v.anchorPlaceId === anchorId && v.businessPlaceId === record.placeId);
    if (distance > radius || (!includeExcluded && override?.mode === 'EXCLUDED')) return [];
    return [{ record, content, distance, override }];
  }).sort((a, b) => Number(b.override?.mode === 'FEATURED') - Number(a.override?.mode === 'FEATURED') || (a.override?.mode === 'FEATURED' && b.override?.mode === 'FEATURED' ? a.override.order - b.override.order : 0) || a.distance - b.distance);
}
export function publicationIssues(content: PlaceContent): string[] {
  const issues: string[] = [];
  if (content.provenance && content.provenance.origin !== 'SYNTHETIC' && !content.regionId) issues.push('등록 지역을 선택해 주세요.');
  for (const [key, label] of [['name', '장소명'], ['area', '지역'], ['address', '주소'], ['description', '소개'], ['provider', '자료 제공자'], ['sourceUrl', '자료 출처'], ['checkedAt', '자료 확인일']] as const) if (!content[key].trim()) issues.push(label + '을 확인해 주세요.');
  if (!validLocation(content) || !content.location.reference.trim() || !content.location.checkedAt) issues.push('좌표와 확인 근거·확인일을 검수해 주세요.');
  if (!content.rights.display || !content.rights.store) issues.push('자료 표시·보관 허용을 확인해 주세요.');
  if (!safeSourceUrl(content.sourceUrl) || !validCheckDate(content.checkedAt)) issues.push('자료 출처 URL·확인일 형식을 확인해 주세요.');
  if (!safeSourceUrl(content.location.sourceUrl) || !validCheckDate(content.location.checkedAt)) issues.push('좌표 출처 URL·확인일을 확인해 주세요.');
  if ([content.guide.hours,content.guide.bestTime,content.guide.facilities,content.guide.menu,content.guide.lodging,content.guide.access,content.guide.english].some(v => v.trim()) && (!safeSourceUrl(content.guide.sourceUrl) || !validCheckDate(content.guide.checkedAt))) issues.push('방문 안내·번역의 출처와 확인일을 확인해 주세요.');
  if (content.ai.allowed && (!content.rights.ai || !content.ai.text.trim() || !content.ai.provider.trim() || !safeSourceUrl(content.ai.sourceUrl) || !validCheckDate(content.ai.checkedAt))) issues.push('승인할 AI 설명과 활용 허용·출처·확인일을 확인해 주세요.');
  for (const media of content.media.filter(m => !m.withdrawn)) {
    if (!media.rights.display || !media.rights.store || !media.provider || !media.sourceUrl || !media.license || !media.checkedAt || !media.alt) issues.push('사진·영상의 출처·사용 조건·대체텍스트를 확인해 주세요.');
    if (media.type === 'MOTION' && !media.rights.modify) issues.push('사진 모션은 변형 허용이 필요해요.');
    if (!safeSourceUrl(media.sourceUrl) || !validCheckDate(media.checkedAt) || !safeAssetUrl(media.url)) issues.push('미디어 파일·출처 URL·확인일을 확인해 주세요.');
  }
  return [...new Set(issues)];
}
export function duplicatePlaces(state: AdminState, content: PlaceContent, except?: string) {
  return state.places.filter(p => p.placeId !== except && ((p.draft.name.trim() && p.draft.name.trim() === content.name.trim()) || (p.draft.address.trim() && p.draft.address.trim() === content.address.trim())));
}
