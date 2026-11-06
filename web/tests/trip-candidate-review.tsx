// DEV-only disposable candidate fixture; never accesses customer repositories.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Journey, Place } from '../src/data';
import { buildPersonalPlan, setPlanStay } from '../src/tripPlan';
import { addTripCandidate } from '../src/tripCandidates';
import { TripCandidateReview } from '../src/TripCandidateReview';
import { LocaleProvider } from '../src/locale';
import { photoSources } from '../src/photoSources';
import { PublicReviewProvider } from '../src/publicReview';
import '../src/styles.css';
import '../src/theme.css';
import '../src/phase-one.css';
const key='spotlog.review.candidate-comparison';
const picture=`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#bcd1c5"/><circle cx="32" cy="32" r="15" fill="#167567"/></svg>')}`;
const place=(id:string,name:string,kind:Place['kind']='LANDMARK'):Place=>({id,name,kind,area:'부산 해운대',address:'부산 해운대구 · 격리 시험용 주소',lat:35.16,lng:129.16,image:picture,description:'등록된 검수용 소개',note:'',duration:kind==='STAY'?'숙박':'1시간'});
const scenario=new URLSearchParams(location.search).get('scenario');
function seed(){
  let journey={...buildPersonalPlan([place('anchor','기준 랜드마크'),place('next','다음 랜드마크')],2,'후보 비교 검수','검수'),planStage:'DRAFT' as const};
  if(scenario==='empty')return journey;
  const context={dayId:journey.days[0].dayId!,anchorVisitId:journey.days[0].places[0].visitId!};
  if(scenario==='locked')journey=setPlanStay(journey,place('booked','예약한 숙소','STAY'),context.dayId,1,true) as typeof journey;
  journey=addTripCandidate(journey,{...place('food-one','해운대 가족 여행에서 비교할 긴 이름의 음식점','FOOD'),lng:129.161,tags:['바다 전망','국수','가족 식사'],image:scenario==='credit'?photoSources[0].image:picture}, {...context,slot:'lunch'}) as typeof journey;
  journey=addTripCandidate(journey,{...place('food-two','사진 없는 음식점','FOOD'),image:'',description:'부산 해운대 일정에서 확인할 음식점 후보입니다.',tags:['공식 관광정보','해운대'],locationVerified:false}, {...context,slot:'lunch'}) as typeof journey;
  journey=addTripCandidate(journey,{...place('food-three','사진 실패 음식점','FOOD'),image:'/__test_missing_candidate_photo.jpg',description:'직접 등록한 긴 소개와 확인된 특징. 설명이 길어져도 선택 영역이 화면 밖으로 나가지 않아요.'}, {...context,slot:'lunch'}) as typeof journey;
  journey=addTripCandidate(journey,{...place('stay-one','가족과 묵을 숙소','STAY'),tags:['바다 전망','조식 안내'],lng:129.162},context) as typeof journey;
  journey=addTripCandidate(journey,{...place('stay-two','사진 없는 숙소','STAY'),image:'',tags:[],description:''},context) as typeof journey;
  return journey;
}
const reviewWindow=window as Window & {reviewCandidates?:Journey;reviewCandidateFail?:boolean;reviewCandidateClosed?:boolean};
function Review(){
  const [journey,setJourney]=useState<Journey>(()=>JSON.parse(localStorage.getItem(key)??'null')??seed());
  const [open,setOpen]=useState(true);reviewWindow.reviewCandidates=journey;
  return <main className="app-shell"><div className="content"><button onClick={()=>setOpen(true)}>후보 확인 열기</button></div>{open&&<TripCandidateReview journey={journey} onClose={()=>{reviewWindow.reviewCandidateClosed=true;setOpen(false);}} onChange={next=>{if(reviewWindow.reviewCandidateFail)return false;localStorage.setItem(key,JSON.stringify(next));setJourney(next);return true;}}/>}</main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<LocaleProvider><PublicReviewProvider baseline={[]}><Review/></PublicReviewProvider></LocaleProvider>);
