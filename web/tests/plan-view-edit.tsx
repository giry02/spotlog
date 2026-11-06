// DEV-only, isolated itinerary. Customer/admin repositories are never read or changed.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {placeCatalog,type Journey} from '../src/data';
import {appendPlanPlace,buildPersonalPlan,makeJournalFromPlan,setPlanStay} from '../src/tripPlan';
import {addTripCandidate} from '../src/tripCandidates';
import {rememberTravelPosition} from '../src/tripProgress';
import {PersonalTrip} from '../src/PersonalTrip';
import {LocaleProvider} from '../src/locale';
import {PublicReviewProvider,usePublicReview} from '../src/publicReview';
import {BottomSheet} from '../src/BottomSheet';
import '../src/styles.css';
import '../src/theme.css';
import '../src/phase-one.css';
import '../src/phase-three-integration.css';
import '../src/product-ux-refinement.css';

const params=new URLSearchParams(location.search);
const mode=params.get('mode')||'ready';
const key=`spotlog.review.plan-view-edit:${mode}`;
const catalog=placeCatalog.filter(place=>place.area.startsWith('부산'));
function seed():Journey{
  const ready=['ready','traveling'].includes(mode);
  const landmark=catalog.find(place=>place.id==='public-busan-jagalchi')!;
  const second=catalog.find(place=>place.id==='public-busan-gukje')!;
  const food=catalog.find(place=>place.kind==='FOOD'&&place.image)!;
  const cafe=catalog.find(place=>place.kind==='CAFE'&&place.image)!;
  const stay=catalog.find(place=>place.id==='catalog-busan-westin')!;
  let trip=buildPersonalPlan(mode==='empty'?[]:[landmark,second],2,'부산 1박 2일 내 여행','기기 여행자');
  trip={...trip,id:'trip-view-edit-qa',region:'부산',planStage:ready?'READY':'DRAFT'};
  if(mode==='empty')return trip;
  trip=appendPlanPlace(trip,trip.days[0].dayId!,food,'lunch');
  trip=appendPlanPlace(trip,trip.days[0].dayId!,cafe,'afternoon');
  trip=setPlanStay(trip,{...stay,note:'예약 번호는 비공개'},trip.days[0].dayId!,1,true);
  trip={...trip,planStage:ready?'READY':'DRAFT',days:trip.days.map((day,index)=>({...day,story:index?'둘째 날 개인 메모':'첫날 개인 메모',places:day.places.map(place=>({...place,note:place.kind==='STAY'?'예약 번호는 비공개':place.note,time:place.kind==='FOOD'?'12:00':place.time}))}))};
  if(mode==='traveling')trip=rememberTravelPosition({...trip,status:'TRAVELING'},trip.days[0].dayId!,trip.days[0].places[0].visitId);
  if(mode==='candidate'){
    const alternatives=catalog.filter(place=>place.kind==='FOOD'&&place.id!==food.id).slice(0,2);
    const context={dayId:trip.days[0].dayId!,anchorVisitId:trip.days[0].places[0].visitId!,slot:'dinner' as const};
    for(const place of alternatives)trip=addTripCandidate(trip,place,context);
  }
  return trip;
}
type QaWindow=Window & {planViewQa?:{journey:Journey;journal?:Journey;baseline:Journey;storageKey:string;guideCalls:number;backCalls:number};planViewQaFail?:boolean;planViewQaUpdate?:(next:Journey)=>void};
const qaWindow=window as QaWindow;
function Review(){
  const live=usePublicReview().catalog;
  const [baseline]=useState(seed);
  const [journey,setJourney]=useState<Journey>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null')??baseline;}catch{return baseline;}});
  const [journal,setJournal]=useState<Journey>();
  const [guide,setGuide]=useState<number>();
  const [guideCalls,setGuideCalls]=useState(0);
  const [backCalls,setBackCalls]=useState(0);
  qaWindow.planViewQa={journey,journal,baseline,storageKey:key,guideCalls,backCalls};
  qaWindow.planViewQaUpdate=next=>{localStorage.setItem(key,JSON.stringify(next));setJourney(next);};
  return <main className="app-shell tab-trips detail-open"><section className="content"><PersonalTrip journey={journey} catalog={live} savedPlaces={live} onBack={()=>setBackCalls(value=>value+1)} onSaveBusiness={()=>true} onChange={next=>{if(qaWindow.planViewQaFail)return false;localStorage.setItem(key,JSON.stringify(next));setJourney(next);return true;}} onAddLandmark={()=>{}} onCopy={()=>{}} onGuide={day=>{setGuideCalls(value=>value+1);setGuide(day);}} onJournal={options=>setJournal(makeJournalFromPlan(journey,'기기 여행자',options))} renderMap={(places,_selected,_onSelect,onResolve)=><div className="qa-route-preview" aria-label="일정 경로 확인">{places.map(place=><p key={place.visitId}>{place.name}</p>)}<button onClick={()=>{const target=places.find(place=>place.kind==='FOOD')!,previous=places[Math.max(0,places.indexOf(target)-1)];onResolve?.({id:'qa-time-warning',code:'ESTIMATED_TIME_CONFLICT',visitId:target.visitId!,fromVisitId:previous.visitId,evidence:'estimate',source:'STRAIGHT_LINE',shortfallMinutes:15,actions:['edit-time']});}}>경로 경고 확인</button></div>}/></section>{guide!==undefined&&<BottomSheet title={`DAY ${guide} 여행 안내`} onClose={()=>setGuide(undefined)}><p>현재 일정의 장소 안내</p></BottomSheet>}</main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<LocaleProvider><PublicReviewProvider baseline={catalog}><Review/></PublicReviewProvider></LocaleProvider>);
