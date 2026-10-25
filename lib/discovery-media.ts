import { registeredEntities, type RegisteredKind, type RegisteredRegion, type RegisteredPhoto } from './registered-catalog';
import legacyPhotos from './discovery-legacy-photos';
import { places } from './trip-data';

export type MediaFilters = { mediaRegion?:RegisteredRegion|null;mediaKind?:RegisteredKind|'all';mediaQuery?:string };
const mediaPlaces=[...registeredEntities,...places.filter(place=>legacyPhotos.some(photo=>photo.placeId===place.id)).map(place=>({
  id:place.id,name:place.name,region:place.region as RegisteredRegion,kind:'LANDMARK' as const,
  address:place.address??`${place.region} ${place.district}`,area:place.district,description:place.description,tags:place.tags,
  photos:legacyPhotos.filter(photo=>photo.placeId===place.id) as RegisteredPhoto[],
}))];
/** Only individually approved, place-matched photos from the registered snapshot. */
export function discoveryMediaResults(filters:MediaFilters={}){
  const query=filters.mediaQuery?.trim().toLocaleLowerCase('ko-KR')??'';
  return mediaPlaces.filter(entity=>entity.photos.length>0
    &&(!filters.mediaRegion||entity.region===filters.mediaRegion)
    &&(!filters.mediaKind||filters.mediaKind==='all'||entity.kind===filters.mediaKind)
    &&(!query||`${entity.name} ${entity.area} ${entity.tags.join(' ')}`.toLocaleLowerCase('ko-KR').includes(query)));
}
export const MEDIA_KIND_LABELS:Record<RegisteredKind|'all',string>={all:'전체 종류',LANDMARK:'관광지',FOOD:'식당',CAFE:'카페',SHOP:'쇼핑',STAY:'숙소'};
export const mediaCatalogSummary=()=>({
  places:mediaPlaces.filter(entity=>entity.photos.length>0).length,
  photos:mediaPlaces.reduce((n,entity)=>n+entity.photos.length,0),
  videos:0,
  note:'개별 출처가 확인된 등록 사진입니다. 실제 영상은 포함하지 않으며 포토모션은 사진에 움직임을 더한 보기입니다.',
});
export function mediaModelCandidates(filters:MediaFilters={}){
  return discoveryMediaResults(filters).map(entity=>({id:entity.id,name:entity.name,kind:entity.kind,region:entity.region,photoCount:entity.photos.length}));
}
