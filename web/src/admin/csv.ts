import type { AdminRegion, PlaceContent } from './types';
import { emptyContent } from './content.ts';
import { inferRegionId, makeRegionSeed } from './regions.ts';

export interface ImportRow { line: number; content: PlaceContent; issues: string[]; duplicate: boolean }
const regionIssue = '등록 지역이 없거나 사용 중지됐어요. 지역을 다시 선택해 주세요.';
function importRegionIssues(regionId: string | undefined, regions: AdminRegion[]): string[] {
  return regionId && !regions.some(region => region.regionId === regionId && region.enabled) ? [regionIssue] : [];
}
export function updateImportRegion(row: ImportRow, regionId: string, regions: AdminRegion[]): ImportRow {
  return { ...row, content: { ...row.content, regionId }, issues: [...row.issues.filter(issue => issue !== regionIssue), ...importRegionIssues(regionId, regions)] };
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [], row: string[] = []; let cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (char === ',' || char === '\n' || char === undefined)) { row.push(cell); cell = ''; if (char !== ',') { if (row.some(v => v.trim())) rows.push(row.splice(0)); else row.splice(0); } }
    else if (char !== '\r' || quoted) cell += char ?? '';
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았어요.');
  return rows;
}
export function previewImport(text: string, existing: PlaceContent[], selectedRegionId = '', regions: AdminRegion[] = makeRegionSeed()): ImportRow[] {
  const [rawHeaders, ...rows] = parseCsv(text), headers = rawHeaders?.map(key => key.trim());
  if (!headers || !['name', 'kind', 'area', 'address'].every(key => headers.includes(key))) throw new Error('name, kind, area, address 열이 필요해요.');
  if (new Set(headers).size !== headers.length) throw new Error('같은 이름의 CSV 열이 중복됐어요. 열 이름을 확인해 주세요.');
  if (!rows.length) throw new Error('가져올 장소 행이 없어요. 양식 아래에 자료를 입력해 주세요.');
  if (rows.length > 200) throw new Error('한 번에 200개까지 가져올 수 있어요.');
  const seen = new Set<string>();
  return rows.map((values, index) => {
    const item = Object.fromEntries(headers.map((key, col) => [key.trim(), values[col]?.trim() ?? ''])), content = emptyContent(), issues: string[] = [];
    for (const key of ['name', 'area', 'address', 'description', 'provider', 'sourceUrl', 'checkedAt'] as const) content[key] = item[key] ?? '';
    content.regionId = item.regionId || selectedRegionId || inferRegionId(content.area,content.address);
    issues.push(...importRegionIssues(content.regionId,regions));
    content.visitDuration = item.visitDuration ?? ''; content.hook = item.hook ?? ''; content.creatorLabel = item.creatorLabel ?? '';
    content.provenance = { origin: 'CSV', sourceRecordId: item.sourceRecordId || undefined, note: item.note || undefined };
    if (['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP'].includes(item.kind)) content.kind = item.kind as PlaceContent['kind']; else issues.push('종류 확인 필요');
    for (const key of ['name', 'area', 'address'] as const) if (!content[key]) issues.push(key + ' 누락');
    for (const key of ['lat', 'lng'] as const) {
      const value = item[key]; content.location[key] = value ? Number(value) : null;
      if (value && (!Number.isFinite(content.location[key]) || Math.abs(content.location[key]!) > (key === 'lat' ? 90 : 180))) issues.push(key + ' 범위 오류');
    }
    const identity = content.name + '\u0000' + content.address;
    const duplicate = seen.has(identity) || existing.some(p => p.name.trim() === content.name && p.address.trim() === content.address);
    seen.add(identity); if (duplicate) issues.push('기존 또는 파일 내 중복 — 비교 필요');
    return { line: index + 2, content, issues, duplicate };
  });
}
export const CSV_TEMPLATE = 'name,kind,area,regionId,address,lat,lng,visitDuration,hook,description,provider,sourceRecordId,sourceUrl,checkedAt\n';
