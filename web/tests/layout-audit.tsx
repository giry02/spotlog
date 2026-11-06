/** DEV-only memory fixture. No customer, account or administrator storage. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CreatePlanSheet } from '../src/CreatePlanSheet';
import { PersonalTrip } from '../src/PersonalTrip';
import { LocaleProvider } from '../src/locale';
import { buildPersonalPlan } from '../src/tripPlan';
import type { PlanCreationDraft } from '../src/planCreationDraft';
import type { Journey, Place } from '../src/data';
import '../src/styles.css';
import '../src/theme.css';
import '../src/product-ux-refinement.css';
import '../src/navigation-spacing.css';

const places: Place[] = [
  { id:'layout-food',name:'부산 음식점 · 화면 확인용',kind:'FOOD',area:'부산 해운대',address:'부산 · 검수용 주소',lat:35.16,lng:129.16,image:'',description:'화면 검수를 위한 예시 장소',duration:'1시간',note:'' },
  { id:'layout-leisure',name:'부산 레저 · 화면 확인용',kind:'LEISURE',area:'부산 수영',address:'부산 · 검수용 주소',lat:35.15,lng:129.12,image:'',description:'랜드마크 없이 레저·식당으로 만드는 일정 확인',duration:'1시간',note:'' },
  { id:'layout-cafe',name:'서울 카페 · 화면 확인용',kind:'CAFE',area:'서울 성동',address:'서울 · 검수용 주소',lat:37.54,lng:127.04,image:'',description:'지역 변경 확인용 예시 장소',duration:'1시간',note:'' },
];
function Review() {
  const [draft,setDraft] = useState<PlanCreationDraft|null>(null);
  const [open,setOpen] = useState(true);
  const [trip,setTrip] = useState<Journey>(()=>({...buildPersonalPlan(places.slice(0,2),2,'음식점·레저 일정 확인','검수 여행자'),planStage:'DRAFT'}));
  const view=new URLSearchParams(location.search).get('view');
  return <main className="app-shell tab-trips detail-open"><section className="content">{view==='plan' ? <PersonalTrip journey={trip} catalog={places} savedPlaces={places} onBack={()=>{}} onChange={next=>{setTrip(next);return true;}} onCopy={()=>{}} onJournal={()=>{}} renderMap={()=>null}/> : <><button style={{minHeight:44}} onClick={()=>setOpen(true)}>일정 입력 열기</button>{open&&<CreatePlanSheet places={places} author="검수 여행자" draft={draft} onDraftChange={next=>{setDraft(next);return true;}} onClose={()=>setOpen(false)} onCreate={next=>{setTrip(next);setOpen(false);return true;}}/>}</>}</section></main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<LocaleProvider><Review/></LocaleProvider>);
