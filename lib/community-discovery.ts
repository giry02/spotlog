import { communityTrips, type CommunityTrip } from './community-trips';
import { registeredEntities } from './registered-catalog';

export const COMMUNITY_TYPES = ['all','traveler','ai'] as const;
export type CommunityFilters = {
  communityRegion?: string | null; communityTheme?: 'all'|'sea'|'green';
  communityQuery?: string; communityType?: (typeof COMMUNITY_TYPES)[number];
  communityDays?: number | null; communityAuthorId?: string | null;
};
const compact=(text:string)=>text.toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
export const communityAuthorId=(trip:CommunityTrip)=>trip.authorId??`demo-author-${trip.id}`;
export function hasCommunityAuthor(id:string){return communityTrips.some(trip=>communityAuthorId(trip)===id);}
export function filterCommunityTrips(filters:CommunityFilters):CommunityTrip[]{
  const query=compact(filters.communityQuery?.trim()??'');
  return communityTrips.filter(trip=>(!filters.communityRegion||trip.region===filters.communityRegion)
    &&(!filters.communityTheme||filters.communityTheme==='all'||trip.theme===filters.communityTheme)
    &&(!filters.communityType||filters.communityType==='all'||trip.contentType===filters.communityType)
    &&(!filters.communityDays||trip.days===filters.communityDays)
    &&(!filters.communityAuthorId||communityAuthorId(trip)===filters.communityAuthorId)
    &&(!query||compact(`${trip.title} ${trip.author} ${trip.description} ${trip.region} ${trip.days}일 ${trip.days-1}박${trip.days}일 ${trip.days===1?'당일 당일치기':''}`).includes(query)));
}
export function communityTypeLabel(trip:CommunityTrip){return trip.contentType==='ai'?'AI 추천 기획 샘플':'여행자 코스 형식 데모';}
export function communityAuthorProfile(id:string){
  const trips=communityTrips.filter(trip=>communityAuthorId(trip)===id);
  if(!trips.length)return undefined;
  const first=trips[0],editorial=id==='spotlog-public-editorial';
  return{id,name:first.author,kind:editorial?'public-editorial' as const:'demo-profile' as const,
    introduction:editorial?'Spotlog 앱의 공공 관광자료 가이드에 포함된 기획 샘플입니다. 실제 회원의 프로필이 아닙니다.':'공개 코스 탐색과 복사 흐름을 설명하기 위한 데모 프로필입니다. 실제 회원의 자기소개나 방문 이력이 아닙니다.',
    gradeLabel:editorial?'공공자료 기획':'등급 미연동',gradeNote:'실제 회원 등급·담김 수·반응 수는 연결하지 않았습니다.',trips};
}
export function communityPhoto(photoId:string){
  for(const entity of registeredEntities){const photo=entity.photos.find(photo=>photo.id===photoId);if(photo)return photo;}
  return undefined;
}
/** Compact tool candidates; long editorial paragraphs remain in the local reader. */
export function communityModelCandidates(filters:CommunityFilters={}){
  return filterCommunityTrips(filters).map(trip=>({id:trip.id,title:trip.title,author:trip.author,authorId:communityAuthorId(trip),contentType:trip.contentType??'traveler',sourceKind:trip.sourceKind,
    region:trip.region,days:trip.days,theme:trip.theme,description:trip.description,sourceAppId:trip.sourceAppId??null,
    visits:trip.visits.map(visit=>({day:visit.day,kind:visit.kind,entityId:visit.entityId})),
  }));
}
