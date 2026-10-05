// DEV-only isolated fixture; no production/user repository access.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Home,Globe,Compass,Map,Bookmark} from 'lucide-react';
import type {Journey,Place} from '../src/data';
import {buildPersonalPlan,insertNearby,setPlanStay} from '../src/tripPlan';
import {PersonalTrip} from '../src/PersonalTrip';
import RouteMap from '../src/RouteMap';
import {LocaleProvider} from '../src/locale';
import '../src/styles.css';
import '../src/theme.css';
import '../src/phase-one.css';
import '../src/phase-three-integration.css';

const key='spotlog.review.trip-usability';
const picture=`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="230"><rect width="400" height="230" fill="#8cb9b7"/><path d="M0 170L120 70L230 145L320 55L400 140V230H0" fill="#497573"/></svg>')}`;
const place=(id:string,name:string,kind:Place['kind']='LANDMARK',lng=127.04):Place=>({id,name,kind,area:'서울 성동',address:'서울 성동구 · 격리 검수용 주소',lat:37.54,lng,image:kind==='LANDMARK'?picture:'',description:'실제 업체 정보가 아닌 격리 검수용 데이터',note:'',duration:kind==='STAY'?'숙박':'1시간'});
const park=place('park','첫 랜드마크'),landmark=place('landmark','두 번째 랜드마크'),food=place('food','점심 식당','FOOD',127.048),cafe=place('cafe','오후 카페','CAFE',127.046),stay=place('stay','예약한 숙소','STAY',127.046);
const catalog=[park,landmark,food,cafe,stay,place('other-food','다른 점심 식당','FOOD',127.042),place('used-food','이미 담긴 식당','FOOD',127.049),place('other-cafe','다른 카페','CAFE',127.041)];
const seed=()=>{
  let trip=buildPersonalPlan([park,landmark],3,'여행 사용 흐름 검수','검수');
  const day=trip.days[0];
  trip=insertNearby(trip,day.dayId!,day.places[0].visitId!,food);
  trip=insertNearby(trip,day.dayId!,day.places[0].visitId!,catalog[6]);
  trip=insertNearby(trip,day.dayId!,day.places[0].visitId!,cafe);
  trip=setPlanStay(trip,stay,day.dayId!,1,true);
  trip.days[0].places[0].time='10:00';trip.days[0].places[1].time='10:15';trip.days[0].places[1].planningSlot='lunch';trip.days[0].places[1].note='이전 식당 메모';
  trip.days[0].places[2].time='13:00';trip.days[0].places[3].time='15:00';
  return trip;
};
const reviewWindow=window as Window & {reviewTrip?:Journey;reviewFail?:boolean};
function Review(){
  const [trip,setTrip]=useState<Journey>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null')??seed();}catch{return seed();}});
  reviewWindow.reviewTrip=trip;
  return <main className="app-shell tab-trips detail-open"><section className="content"><PersonalTrip journey={trip} catalog={catalog} savedPlaces={catalog} onBack={()=>{}} onSaveBusiness={()=>true} onChange={next=>{if(reviewWindow.reviewFail)return false;localStorage.setItem(key,JSON.stringify(next));setTrip(next);return true;}} onAddLandmark={()=>{}} onCopy={()=>{}} onJournal={()=>{}} renderMap={(places,selected,onSelect,onResolve)=><RouteMap places={places} selectedVisitId={selected} onSelectVisit={onSelect} onResolveWarning={onResolve}/>}/></section><nav className="tabbar" aria-label="검수용 하단 메뉴">{[[Home,'홈'],[Globe,'여행기'],[Compass,'장소'],[Map,'내 여행'],[Bookmark,'저장']].map(([Icon,label])=>{const Component=Icon as typeof Home;return <button key={String(label)} className={label==='내 여행'?'active':''}><Component size={20}/><span>{String(label)}</span></button>;})}</nav></main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<LocaleProvider><Review/></LocaleProvider>);
