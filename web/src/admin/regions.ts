import type { AdminRegion, PlaceContent } from './types';

const provinces = [
  ['seoul','서울'], ['busan','부산'], ['daegu','대구'], ['incheon','인천'], ['gwangju','광주'], ['daejeon','대전'], ['ulsan','울산'], ['sejong','세종'], ['gyeonggi','경기'], ['gangwon','강원'], ['chungbuk','충북'], ['chungnam','충남'], ['jeonbuk','전북'], ['jeonnam','전남'], ['gyeongbuk','경북'], ['gyeongnam','경남'], ['jeju','제주'],
] as const;
// These IDs describe known catalog geography. Unknown text is left for staff review.
const children: Record<string, readonly (readonly [string, string])[]> = {
  seoul: [['seongdong','성동'],['gwangjin','광진']],
  busan: [['haeundae','해운대'],['saha','사하'],['gijang','기장'],['suyeong','수영'],['jung','중구'],['yeongdo','영도'],['seo','서구'],['busanjin','부산진'],['geumjeong','금정'],['nam','남구']],
  daegu: [['nam','남구'],['jung','중구']], incheon: [['yeonsu','연수'],['jung','중구']],
  gwangju: [['dong','동구'],['nam','남구']], daejeon: [['seo','서구'],['dong','동구']], ulsan: [['dong','동구'],['jung','중구']],
  gyeonggi: [['suwon','수원'],['yangpyeong','양평']], gangwon: [['gangneung','강릉'],['jeongseon','정선'],['yangyang','양양'],['sokcho','속초'],['goseong','고성']],
  chungbuk: [['danyang','단양'],['cheongju','청주']], chungnam: [['gongju','공주'],['taean','태안']],
  jeonbuk: [['gunsan','군산'],['jeonju','전주']], jeonnam: [['damyang','담양'],['suncheon','순천'],['yeosu','여수']],
  gyeongbuk: [['gyeongju','경주'],['andong','안동']], gyeongnam: [['jinju','진주'],['tongyeong','통영']],
  jeju: [['jeju-city','제주시'],['seogwipo','서귀포시']],
};
const metro = new Set(['seoul','busan','daegu','incheon','gwangju','daejeon','ulsan']);
export function makeRegionSeed(): AdminRegion[] {
  const regions: AdminRegion[] = [{regionId:'kr',name:'대한민국',level:'COUNTRY',enabled:true,revision:1}];
  for (const [code,name] of provinces) {
    regions.push({regionId:'kr-'+code,name,parentId:'kr',level:'PROVINCE',enabled:true,revision:1});
    for (const [child,label] of children[code] ?? []) regions.push({regionId:`kr-${code}-${child}`,name:label,parentId:'kr-'+code,level:metro.has(code) ? 'DISTRICT' : 'CITY',enabled:true,revision:1});
  }
  for (const [code,name,parent] of [['hallim','한림','jeju-city'],['aewol','애월','jeju-city'],['andeok','안덕','seogwipo']] as const) regions.push({regionId:'kr-jeju-'+code,name,parentId:'kr-jeju-'+parent,level:'DISTRICT',enabled:true,revision:1});
  return regions;
}
const provinceAliases: Record<string,string> = { 서울특별시:'서울',부산광역시:'부산',대구광역시:'대구',인천광역시:'인천',광주광역시:'광주',대전광역시:'대전',울산광역시:'울산',세종특별자치시:'세종',경기도:'경기',강원특별자치도:'강원',강원도:'강원',충청북도:'충북',충청남도:'충남',전북특별자치도:'전북',전라북도:'전북',전라남도:'전남',경상북도:'경북',경상남도:'경남',제주특별자치도:'제주' };
export function inferRegionId(area: string, address = ''): string {
  const tokens = (area.trim() || address.trim()).split(/\s+/), first = provinceAliases[tokens[0]] ?? tokens[0];
  const province = provinces.find(([,name]) => name === first);
  if (!province) return '';
  const [code] = province, provinceId = 'kr-'+code;
  if (code === 'jeju') {
    const combined = area+' '+address;
    if (/한림/.test(combined)) return 'kr-jeju-hallim';
    if (/애월/.test(combined)) return 'kr-jeju-aewol';
    if (/안덕/.test(combined)) return 'kr-jeju-andeok';
    if (/서귀포/.test(combined)) return 'kr-jeju-seogwipo';
    if (/제주시/.test(combined)) return 'kr-jeju-jeju-city';
  }
  const label = tokens[1]?.replace(/[시군구]$/, ''), child = (children[code] ?? []).find(([,name]) => name.replace(/[시군구]$/, '') === label);
  return child ? `${provinceId}-${child[0]}` : provinceId;
}
export function regionDescendantIds(regions: AdminRegion[], regionId: string): Set<string> {
  const ids = new Set([regionId]); let changed = true;
  while (changed) { changed = false; for (const region of regions) if (region.parentId && ids.has(region.parentId) && !ids.has(region.regionId)) { ids.add(region.regionId); changed = true; } }
  return ids;
}
export function regionLabel(regions: AdminRegion[], regionId: string): string {
  const labels: string[] = [], seen = new Set<string>(); let current = regions.find(region => region.regionId === regionId);
  while (current && !seen.has(current.regionId)) { seen.add(current.regionId); labels.unshift(current.name); current = regions.find(region => region.regionId === current!.parentId); }
  return labels.join(' · ') || '지역 미지정';
}
export function contentInRegion(content: PlaceContent, regions: AdminRegion[], regionId: string): boolean {
  return !regionId || regionDescendantIds(regions,regionId).has(content.regionId || inferRegionId(content.area,content.address));
}
