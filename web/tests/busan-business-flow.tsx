// DEV-only, disposable itinerary. It never reads or changes the customer repository.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Journey} from '../src/data';
import {placeCatalog} from '../src/data';
import {plannerBusinessPlaces} from '../src/plannerBusinessCatalog';
import {buildPersonalPlan,setPlanStay} from '../src/tripPlan';
import {PersonalTrip} from '../src/PersonalTrip';
import {LocaleProvider} from '../src/locale';
import {PublicReviewProvider,usePublicReview} from '../src/publicReview';
import '../src/styles.css';
import '../src/theme.css';
import '../src/phase-one.css';
import '../src/phase-three-integration.css';

const params=new URLSearchParams(location.search);
const key=`spotlog.review.busan-business-flow:${encodeURIComponent(params.get('anchor')||'standalone')}:${params.get('locked')==='1'?'locked':'open'}`;
const catalog=placeCatalog.filter(place=>place.area.startsWith('부산'));
const baseline=JSON.stringify(catalog);
function seed(){
  const anchor=params.get('anchor');
  const selected=catalog.find(place=>place.id===anchor&&place.kind==='LANDMARK');
  let journey=buildPersonalPlan(selected?[selected]:[],2,selected?`${selected.name} 주변 일정`:'부산 식사와 카페 여행','확인');
  journey={...journey,region:'부산'};
  const locked=params.get('locked')==='1',stay=plannerBusinessPlaces.find(place=>place.kind==='STAY'&&place.area.startsWith('부산'));
  if(locked&&stay)journey=setPlanStay(journey,stay,journey.days[0].dayId!,1,true);
  return journey;
}
const qaWindow=window as Window & {busanQa?:{journey:Journey;catalog:typeof catalog;baseline:string;storageKey:string};busanQaFail?:boolean};
function Review(){
  const live=usePublicReview().catalog;
  const [journey,setJourney]=useState<Journey>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null')??seed();}catch{return seed();}});
  qaWindow.busanQa={journey,catalog:live,baseline,storageKey:key};
  return <main className="app-shell tab-trips detail-open"><section className="content"><PersonalTrip journey={journey} catalog={live} savedPlaces={live} onBack={()=>{}} onSaveBusiness={()=>true} onChange={next=>{if(qaWindow.busanQaFail)return false;localStorage.setItem(key,JSON.stringify(next));setJourney(next);return true;}} onAddLandmark={()=>{}} onCopy={()=>{}} onJournal={()=>{}} renderMap={()=>null}/></section></main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<LocaleProvider><PublicReviewProvider baseline={catalog}><Review/></PublicReviewProvider></LocaleProvider>);
