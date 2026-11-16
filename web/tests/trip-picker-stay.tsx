// DEV-only memory fixture: no customer data or browser storage.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Journey, Place } from '../src/data';
import { TripPlacePicker } from '../src/TripPlacePicker';
import { appendPlanPlace, setPlanStay } from '../src/tripPlan';
import '../src/styles.css';
import '../src/theme.css';

const hotel = (id:string):Place => ({ id, kind:'STAY', name:id === 'original' ? '기존 숙소' : '새 숙소', area:'부산', address:`부산 ${id} 주소`, lat:35, lng:129, image:'', description:'숙박일 선택 확인용 장소', note:'', duration:'숙박' });
const catalog = [hotel('new'),hotel('original')];
const seed = (fixed=false):Journey => setPlanStay({ id:'stay-fixture', title:'숙소만 있는 여행', purpose:'PLAN', planStage:'READY', region:'부산', dateRange:'', duration:'3일', status:'PLANNING', visibility:'PRIVATE', cover:'', summary:'', story:'', tags:[], saves:0, author:'나', isMine:true, days:[1,2,3].map(day=>({ dayId:`d${day}`, day, date:'', title:'', story:'', places:[], blocks:[] })) }, hotel('original'),'d1',1,fixed);
function Review(){
  const [trip,setTrip]=useState(seed()),[open,setOpen]=useState(false);
  return <main className="app-shell"><section className="page" style={{padding:20}}><h1>숙소 담기 확인</h1><button onClick={()=>setOpen(true)}>장소 담기</button><button onClick={()=>{setTrip(seed(true));setOpen(true);}}>예약 고정 상태 확인</button><p>선택한 숙박일만 바뀌고, 교체 확인 전에는 아래 일정이 유지됩니다.</p>{trip.days.map(day=><p key={day.dayId}>DAY {day.day}: {day.places.map(place=>`${place.name}${place.bookingFixed?' (예약 고정)':''}`).join(', ')||'숙소 없음'}</p>)}</section>{open&&<TripPlacePicker journey={trip} dayId="d1" catalog={catalog} savedPlaces={catalog} initialKind="STAY" onClose={()=>setOpen(false)} onAdd={(place,slot)=>{setTrip(appendPlanPlace(trip,'d1',place,slot));return null;}} onAddStay={(place,choice)=>{try{setTrip(setPlanStay(trip,place,choice.dayId,choice.nights,choice.fixed));return null;}catch(reason){return reason instanceof Error?reason.message:'저장하지 못했어요.';}}}/>}</main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<Review/>);
