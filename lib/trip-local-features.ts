import { findFood, findPlace, findStay, places, period, type Region } from './trip-data';
import { getTripMapData } from './trip-map-data';
import type { SavedPlan, TripAction, TripSession, TripState, Visit } from './trip-engine';

export type PlanStatus = 'DRAFT' | 'READY';
export type OfflineVisit = Omit<Visit,'knowledge'> & { name:string; address?:string };
export type OfflineRoutePoint = { visitId:string; entityId:string; day:number; sequence:number; name:string; latitude:number; longitude:number; sourceTitle:string; checkedAt:string };
export type OfflineTripPackage = { id:string; sourcePlanId:string; title:string; region:Region; days:number; startDate?:string|null; status:'READY'; capturedAt:string; visits:OfflineVisit[]; points:OfflineRoutePoint[] };
export type TripLocalAction =
  | { type:'saved-filter'; region:Region|null }
  | { type:'plan-status'; status:PlanStatus }
  | { type:'continue-trip' }
  | { type:'offline-save'; id?:string }
  | { type:'offline-open'|'offline-remove'; id:string }
  | { type:'offline-library' };
export const MAX_OFFLINE_PACKAGES=5;
export const MAX_OFFLINE_BYTES=256_000;
const types=new Set(['saved-filter','plan-status','continue-trip','offline-save','offline-open','offline-remove','offline-library']);
export const isTripLocalAction=(action:{type:string}):action is TripLocalAction=>types.has(action.type);
export const offlineStorageBytes=(packages:OfflineTripPackage[])=>new TextEncoder().encode(JSON.stringify(packages)).byteLength;
export const activeSavedTrips=(session:Pick<TripSession,'library'>)=>session.library.filter(plan=>!plan.deletedAt);
export function libraryPlansForView(session:TripSession,state:TripState){return state===session.turns.at(-1)?.state?session.library:state.librarySnapshot??session.library;}
export function recentActiveTrip(session:TripSession):SavedPlan|undefined {
  const active=activeSavedTrips(session);
  return session.recentPlanIds?.map(id=>active.find(plan=>plan.id===id)).find(Boolean)??active.at(-1);
}
export function savedFavoritePlaces(state:Pick<TripState,'savedIds'|'savedRegion'>) {
  return state.savedIds.flatMap(id=>{const place=findPlace(id);return place&&(!state.savedRegion||place.region===state.savedRegion)?[place]:[];});
}
export function favoriteReferences(session:Pick<TripSession,'library'>,placeId:string) {
  return activeSavedTrips(session).flatMap(plan=>{const days=[...new Set(plan.visits.filter(visit=>visit.entityId===placeId).map(visit=>visit.day))].sort((a,b)=>a-b);return days.length?[{planId:plan.id,title:plan.title,status:plan.status??'DRAFT' as PlanStatus,days}]:[];});
}
export function planCompletionIssue(state:TripState) {
  if(!state.plan.length||!state.region)return '먼저 여행 일정을 만들어 주세요.';
  if(state.pendingCandidates?.length)return '비교 중인 후보를 적용하거나 취소한 다음 작성 완료해 주세요.';
  if(state.plan.some(visit=>!visit.entityId&&!visit.locked))return '미정인 방문을 고르거나 제외한 다음 작성 완료해 주세요.';
}
export function workingTripMatchesSaved(state:TripState,saved:SavedPlan) {
  const snapshot={title:state.title?.trim()||`${state.region} ${period(state.days)} 여행`,region:state.region,days:state.days,startDate:state.startDate??null,booked:state.booked,visits:state.plan};
  return JSON.stringify(snapshot)===JSON.stringify({title:saved.title,region:saved.region,days:saved.days,startDate:saved.startDate??null,booked:saved.booked,visits:saved.visits});
}
/** Current-view saves must represent the exact completed version on screen.
 * Explicit saved-plan selections may independently refresh that stored version. */
export function currentTripOfflineSaveIssue(state:TripState,saved:SavedPlan|undefined) {
  if(!saved||saved.status!=='READY')return '활성 저장 여행을 작성 완료한 다음 오프라인 사본으로 보관해 주세요.';
  if(state.planStatus!=='READY'||!workingTripMatchesSaved(state,saved))return '현재 화면과 완료 저장본의 내용이 달라요. 현재 내용을 저장하고 작성 완료한 뒤 오프라인 사본으로 보관해 주세요.';
}
export function packageForSavedPlan(saved:SavedPlan,now=new Date()):OfflineTripPackage {
  const visits=saved.visits.map(visit=>{
    const {knowledge:_knowledge,...fields}=visit;
    const entity=findPlace(visit.entityId)??findFood(visit.entityId)??findStay(visit.entityId);
    return {...fields,name:entity?.name??(visit.locked?'예약한 숙소':`${visit.label} 미정`),...(entity&&'address'in entity&&entity.address?{address:entity.address}:{})};
  });
  const map=getTripMapData({plan:saved.visits,activeDay:1},{allDays:true});
  return {id:`offline-${saved.id}`,sourcePlanId:saved.id,title:saved.title,region:saved.region,days:saved.days,startDate:saved.startDate??null,status:'READY',capturedAt:now.toISOString(),visits,points:map.points.map(point=>({visitId:point.visitId,entityId:point.placeId,day:point.day,sequence:visits.findIndex(visit=>visit.id===point.visitId)+1,name:point.name,latitude:point.latitude,longitude:point.longitude,sourceTitle:point.sourceTitle,checkedAt:point.checkedAt}))};
}
export function offlineCoordinateLayout(points:OfflineRoutePoint[],width=480,height=300) {
  if(!points.length)return [];
  const latitude=points.reduce((sum,point)=>sum+point.latitude,0)/points.length;
  const scaleX=Math.max(.05,Math.cos(latitude*Math.PI/180));
  const xs=points.map(point=>point.longitude*scaleX),ys=points.map(point=>point.latitude);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const spanX=Math.max(.001,maxX-minX),spanY=Math.max(.001,maxY-minY),padding=32;
  const ratio=Math.min((width-padding*2)/spanX,(height-padding*2)/spanY),centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  return points.map((point,index)=>({...point,x:width/2+(xs[index]-centerX)*ratio,y:height/2-(ys[index]-centerY)*ratio}));
}
const planShape=(state:TripState)=>JSON.stringify({plan:state.plan.map(({status:_status,...visit})=>visit),days:state.days,title:state.title,startDate:state.startDate});
/** Editing a ready draft never silently marks the changed version complete. */
export function demoteEditedTrip(before:TripSession,after:TripSession,action:TripAction):TripSession {
  if(before===after||['open','continue-trip','resume','undo','reset','plan-status'].includes(action.type))return after;
  const latest=after.turns.at(-1)!;
  if(planShape(before.turns.at(-1)!.state)===planShape(latest.state))return after;
  return {...after,turns:[...after.turns.slice(0,-1),{...latest,state:{...latest.state,planStatus:'DRAFT'}}]};
}
export function applyLocalTripAction(session:TripSession,action:{type:string},now=new Date()):TripSession|undefined {
  if(!isTripLocalAction(action))return;
  if(action.type==='continue-trip'&&recentActiveTrip(session))return;
  const before=session.turns.at(-1)!.state,state:TripState={...before,notice:'',question:''};
  let library=session.library,offlineTrips=session.offlineTrips;
  if(action.type==='saved-filter'){state.savedRegion=action.region;state.stage='saved';state.question=`${action.region??'전체 지역'} 찜한 장소 보여줘`;state.notice='찜한 장소의 표시 지역만 바꿨어요. 만들던 여행은 그대로예요.';}
  else if(action.type==='plan-status') {
    const issue=action.status==='READY'?planCompletionIssue(state):undefined;
    const saved=library.find(plan=>plan.id===state.savedPlanId&&!plan.deletedAt);
    if(issue)state.notice=issue;
    else if(!saved)state.notice='먼저 이 일정을 내 여행에 저장한 다음 작성 상태를 바꿔 주세요.';
    else {state.planStatus=action.status;library=library.map(plan=>plan.id===saved.id?{...plan,title:state.title?.trim()||`${state.region} ${period(state.days)} 여행`,region:state.region??plan.region,days:state.days,startDate:state.startDate??null,booked:state.booked,status:action.status,activeDay:state.activeDay,visits:state.plan.map(visit=>({...visit}))}:plan);state.notice=action.status==='READY'?'이 기기의 저장 여행을 작성 완료로 보관했어요. 공개 게시나 실제 예약은 진행하지 않았어요.':'저장 여행을 작성 중으로 되돌렸어요. 기존 일정과 예약은 유지돼요.';}
    state.question=action.status==='READY'?'여행 작성 완료':'여행을 초안으로 되돌리기';state.stage='plan';
  } else if(action.type==='continue-trip'){state.question='최근 저장 여행 이어가기';state.notice='이어갈 저장 여행이 없어요. 휴지통 여행과 공개 코스는 제외해요.';state.stage='library';state.librarySnapshot=library.map(plan=>({...plan,visits:plan.visits.map(visit=>({...visit}))}));}
  else if(action.type==='offline-save') {
    const saved=library.find(plan=>plan.id===(action.id??state.savedPlanId)&&!plan.deletedAt);
    const issue=action.id===undefined?currentTripOfflineSaveIssue(state,saved):undefined;
    if(!saved||saved.status!=='READY')state.notice='활성 저장 여행을 작성 완료한 다음 오프라인 사본으로 보관해 주세요.';
    else if(issue)state.notice=issue;
    else {
      const pack=packageForSavedPlan(saved,now),next=[...(offlineTrips??[]).filter(item=>item.sourcePlanId!==saved.id),pack];
      if(next.length>MAX_OFFLINE_PACKAGES)state.notice=`오프라인 사본은 ${MAX_OFFLINE_PACKAGES}개까지 보관해요. 필요 없는 사본을 먼저 삭제해 주세요.`;
      else if(offlineStorageBytes(next)>MAX_OFFLINE_BYTES)state.notice='오프라인 사본의 저장 크기를 넘었어요. 필요 없는 사본을 먼저 정리해 주세요.';
      else {offlineTrips=next;state.offlinePackageId=pack.id;state.notice='저장 여행의 일정·메모·대표 좌표 사본을 이 기기에 보관했어요. 열려 있는 화면에서 네트워크 없이 볼 수 있어요. 앱 재시작용 화면·사진·도로 지도는 저장하지 않았어요.';}
    }
    state.question='여행 오프라인 사본 저장·갱신';state.stage='offline';
  } else if(action.type==='offline-open') {const pack=offlineTrips?.find(item=>item.id===action.id);state.offlinePackageId=pack?.id??null;state.question='저장한 오프라인 여행 사본 보기';state.notice=pack?'저장 당시의 사본을 보고 있어요. 현재 편집 중인 여행은 바꾸지 않았어요.':'이 기기에 해당 오프라인 사본이 없어요.';state.stage='offline';}
  else if(action.type==='offline-remove') {offlineTrips=(offlineTrips??[]).filter(item=>item.id!==action.id);if(state.offlinePackageId===action.id)state.offlinePackageId=null;state.question='오프라인 여행 사본 삭제';state.notice='오프라인 사본만 삭제했어요. 저장 여행과 현재 일정은 유지돼요.';state.stage='offline';}
  else if(action.type==='offline-library'){state.stage='offline';state.offlinePackageId=null;state.question='오프라인 여행 사본 목록';state.notice='이 기기에 따로 저장한 여행 사본이에요. 목록을 열어도 현재 여행은 바뀌지 않아요.';}
  return {...session,turns:[...session.turns,{id:session.nextId,state}],nextId:session.nextId+1,library,...(offlineTrips?{offlineTrips}: {})};
}
