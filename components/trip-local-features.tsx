'use client';

import { useState } from 'react';
import { ArrowRight, Bookmark, CheckCircle2, Download, MapPin, PencilLine, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { REGIONS } from '@/lib/trip-data';
import { visitName, type TripAction, type TripSession, type TripState } from '@/lib/trip-engine';
import { activeSavedTrips, currentTripOfflineSaveIssue, favoriteReferences, offlineCoordinateLayout, planCompletionIssue, recentActiveTrip, savedFavoritePlaces, workingTripMatchesSaved, type OfflineTripPackage } from '@/lib/trip-local-features';
import './trip-local-features.css';
type Act=(action:TripAction)=>void;
export type OpenSavedTripDay=(planId:string,day:number,placeId:string)=>void;
const koreaDate=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));

export function PlanLocalTools({session,state,act}:{session:TripSession;state:TripState;act:Act}){
  const saved=activeSavedTrips(session).find(plan=>plan.id===state.savedPlanId),ready=state.planStatus==='READY';
  const offlineIssue=saved&&ready?currentTripOfflineSaveIssue(state,saved):undefined;
  const issue=planCompletionIssue(state),hasPackage=session.offlineTrips?.some(pack=>pack.sourcePlanId===saved?.id);
  return <section className="tr-local-tools" aria-label="여행 작성 상태와 오프라인 저장">
    <p><span className={`tr-plan-status ${ready?'is-ready':''}`}>{ready?'작성 완료':'작성 중'}</span><span className="tr-meta">이 기기의 비공개 여행</span></p>
    <div className="tr-local-actions">
      {!saved&&<Button variant="outline" onClick={()=>act({type:'save'})}>내 여행에 저장</Button>}
      {ready&&!offlineIssue?<Button variant="outline" onClick={()=>act({type:'plan-status',status:'DRAFT'})}><PencilLine size={16}/>다시 작성하기</Button>:<Button variant="outline" disabled={!saved||!!issue} onClick={()=>act({type:'plan-status',status:'READY'})}><CheckCircle2 size={16}/>{saved?'저장하고 작성 완료':'저장 후 작성 완료'}</Button>}
      {saved&&<Button variant="outline" onClick={()=>act({type:'library'})}><Bookmark size={16}/>저장한 여행 확인</Button>}
      <Button variant="outline" disabled={!saved||!ready||!!offlineIssue} onClick={()=>act({type:'offline-save'})}><Download size={16}/>{hasPackage?'오프라인 사본 갱신':'오프라인 사본 저장'}</Button>
      <Button variant="outline" onClick={()=>act({type:'offline-library'})}><WifiOff size={16}/>오프라인 사본</Button>
    </div>
    {saved&&<p role="status" className="tr-meta">저장본 {saved.visits.length}개 방문 · {workingTripMatchesSaved(state,saved)?'현재 내용이 저장본과 같아요.':'현재 변경 내용은 아직 저장하지 않았어요.'}</p>}
    {offlineIssue&&<p role="status" className="tr-meta">{offlineIssue}</p>}
    {!ready&&<p className="tr-meta">{!saved?'먼저 내 여행에 저장해 주세요.':issue??'작성 완료를 누르면 현재 내용을 저장한 완료본으로 보관해요.'}</p>}
    <p className="tr-meta">일정을 수정하면 현재 화면은 작성 중으로 돌아가요. 이전 저장본은 다시 저장하거나 완료하기 전까지 유지돼요. 공개 게시·예약은 진행하지 않아요.</p>
  </section>;
}
export function RecentTripEntry({session,act,disabled=false}:{session:TripSession;act:Act;disabled?:boolean}){
  const saved=recentActiveTrip(session);if(!saved)return null;
  const next=saved.visits.find(visit=>!visit.status);
  return <section className="tr-recent-trip"><div><small>최근 저장 여행</small><strong>{saved.title}</strong><p>{next?`DAY ${next.day} · 다음 방문 ${visitName(next)}`:'모든 방문을 확인한 여행이에요.'}</p></div><Button disabled={disabled} variant="outline" onClick={()=>act({type:'continue-trip'})}>이어가기<ArrowRight size={16}/></Button></section>;
}
export function SavedPlaceReference({session,placeId,onOpenDay}:{session:TripSession;placeId:string;onOpenDay:OpenSavedTripDay}){
  const refs=favoriteReferences(session,placeId);
  return refs.length?<div className="tr-favorite-references">{refs.flatMap(ref=>ref.days.map(day=><button type="button" key={`${ref.planId}-${day}`} onClick={()=>onOpenDay(ref.planId,day,placeId)}>{ref.title} · {ref.status==='READY'?'작성 완료':'작성 중'} · DAY {day}<ArrowRight size={13}/></button>))}</div>:<small className="tr-meta">활성 저장 여행에 아직 담지 않았어요.</small>;
}
export function SavedPlaceReferences({session,state,act,onEntityDetail,onOpenDay}:{session:TripSession;state:TripState;act:Act;onEntityDetail?:(id:string,state:TripState)=>void;onOpenDay:OpenSavedTripDay}){
  const places=savedFavoritePlaces(state);
  return <section className="tr-saved-place-references"><h3><Bookmark size={17}/>찜한 장소 <span>{places.length}</span></h3>
    <div className="tr-local-filter" aria-label="찜한 장소 지역"><button type="button" aria-pressed={!state.savedRegion} onClick={()=>act({type:'saved-filter',region:null})}>전체</button>{REGIONS.map(region=><button type="button" key={region} aria-pressed={state.savedRegion===region} onClick={()=>act({type:'saved-filter',region})}>{region}</button>)}</div>
    {places.map(place=><article className="tr-saved-place-row" key={place.id}><div><strong>{place.name}</strong><small>{place.region}</small></div><SavedPlaceReference session={session} placeId={place.id} onOpenDay={onOpenDay}/><div className="tr-local-actions">
      {onEntityDetail&&<button type="button" onClick={()=>onEntityDetail(place.id,state)}>상세 보기</button>}
      <button type="button" onClick={()=>act({type:'collect-entity',id:place.id})}>여행 후보에 담기</button><button type="button" onClick={()=>act({type:'bookmark',id:place.id,saved:false})}>찜 해제</button>
    </div></article>)}
    {!places.length&&<p className="tr-meta">이 지역에 찜한 장소가 없어요.</p>}
    <p className="tr-meta">지역 필터는 찜 목록만 바꿔요. 여행·DAY 표시는 이 기기의 활성 저장본 기준이며 휴지통 여행은 제외해요.</p>
  </section>;
}
function OfflineCoordinateMap({pack,day,onSelect,selected}:{pack:OfflineTripPackage;day:number|null;onSelect:(id:string)=>void;selected:string|null}){
  const points=offlineCoordinateLayout(pack.points.filter(point=>day===null||point.day===day));
  return <div className="tr-offline-map"><svg viewBox="0 0 480 300" role="img" aria-label={`${pack.title} 저장한 대표 좌표의 번호 지도`}><rect width="480" height="300" rx="14" fill="#f0f3ee"/>
    <path d="M0 75H480M0 150H480M0 225H480M120 0V300M240 0V300M360 0V300" stroke="#dfe5dc" strokeWidth="1"/>
    {points.length>1&&<polyline points={points.map(point=>`${point.x},${point.y}`).join(' ')} fill="none" stroke="#ef654f" strokeWidth="3" strokeDasharray="5 5"/>}
    {points.map(point=><g key={point.visitId} onClick={()=>onSelect(point.visitId)} role="button" tabIndex={0} aria-label={`${point.sequence}번 ${point.name}`} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(point.visitId);}}}><circle cx={point.x} cy={point.y} r={selected===point.visitId?17:14} fill={selected===point.visitId?'#242622':'#ef654f'} stroke="white" strokeWidth="2"/><text x={point.x} y={point.y+5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{point.sequence}</text></g>)}
    {!points.length&&<text x="240" y="150" textAnchor="middle" fill="#62685d" fontSize="16">저장한 대표 좌표가 없어요</text>}
    <text x="455" y="27" fill="#62685d" fontSize="13">북 ↑</text>
  </svg><p className="tr-meta">대표 좌표와 방문 순서를 잇는 직선 그림이에요. 도로·지형·이동시간을 표시한 지도는 아니며 인터넷 요청을 하지 않아요. 번호가 겹치면 아래 목록에서 방문을 선택하세요.</p></div>;
}
export function OfflineTripUnit({session,state,act}:{session:TripSession;state:TripState;act:Act}){
  const [day,setDay]=useState<number|null>(null),[selected,setSelected]=useState<string|null>(null);
  const packages=session.offlineTrips??[],pack=packages.find(item=>item.id===state.offlinePackageId);
  return <section className="tr-offline-unit"><h3><WifiOff size={18}/>오프라인 여행 사본</h3><p className="tr-meta">저장한 일정·개인 메모·번호 좌표를 열려 있는 화면에서 네트워크 없이 볼 수 있어요. 브라우저를 닫은 뒤 앱을 다시 여는 데 필요한 화면 파일과 사진·도로 지도는 저장하지 않았어요.</p>
    {packages.map(item=><div className="tr-offline-row" key={item.id}><button type="button" onClick={()=>{setDay(null);setSelected(null);act({type:'offline-open',id:item.id});}}><strong>{item.title}</strong><small>{item.days}일 · {item.visits.length}개 방문 · {koreaDate(item.capturedAt)} 저장</small>{!session.library.some(saved=>saved.id===item.sourcePlanId&&!saved.deletedAt)&&<small>원본은 휴지통에 있거나 삭제됐어요. 이 사본은 직접 삭제하기 전까지 남아요.</small>}</button><Button aria-label={`${item.title} 오프라인 사본 삭제`} variant="outline" onClick={()=>act({type:'offline-remove',id:item.id})}><Trash2 size={15}/></Button></div>)}
    {!packages.length&&<p className="tr-meta">아직 오프라인 사본이 없어요. 작성 완료한 내 여행에서 저장할 수 있어요.</p>}
    {pack&&<article className="tr-offline-preview"><h4>{pack.title}</h4><p className="tr-meta">{pack.startDate?`${pack.startDate} 출발 · `:''}{koreaDate(pack.capturedAt)} 저장 당시의 사본입니다. 현재 일정은 바꾸지 않아요.</p>
      <div className="tr-local-filter" aria-label="오프라인 여행 DAY"><button type="button" aria-pressed={day===null} onClick={()=>setDay(null)}>전체</button>{Array.from({length:pack.days},(_,index)=>index+1).map(value=><button type="button" key={value} aria-pressed={day===value} onClick={()=>setDay(value)}>DAY {value}</button>)}</div>
      <OfflineCoordinateMap pack={pack} day={day} selected={selected} onSelect={setSelected}/>
      <ol className="tr-offline-visits">{pack.visits.filter(visit=>day===null||visit.day===day).map(visit=><li key={visit.id} className={selected===visit.id?'is-selected':''}><button type="button" onClick={()=>setSelected(visit.id)}><span>{pack.visits.findIndex(row=>row.id===visit.id)+1}</span><div><small>DAY {visit.day} · {visit.label}{visit.time?` · ${visit.time}`:''}</small><strong>{visit.name}</strong>{visit.address&&<small>{visit.address}</small>}{!pack.points.some(point=>point.visitId===visit.id)&&<small>대표 좌표 미확인 · 지도에서 제외</small>}</div></button>{visit.note&&<p>{visit.note}</p>}{visit.durationMinutes? <small>예상 체류 {visit.durationMinutes}분</small>:null}</li>)}</ol>
      <p className="tr-meta"><MapPin size={13}/>좌표 확인 자료: {[...new Set(pack.points.map(point=>`${point.sourceTitle} (${point.checkedAt})`))].join(', ')||'확인된 좌표 없음'}</p>
      <Button variant="outline" disabled={!session.library.some(saved=>saved.id===pack.sourcePlanId&&!saved.deletedAt&&saved.status==='READY')} onClick={()=>act({type:'offline-save',id:pack.sourcePlanId})}><RefreshCw size={15}/>완료 저장본으로 사본 갱신</Button>
    </article>}
  </section>;
}
