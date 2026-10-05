import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TravelGuideSheet, { clearTravelGuideSessions } from '../src/TravelGuideSheet';
import { ProfilePreferencesSheet } from '../src/ProfilePreferencesSheet';
import { TranslationText } from '../src/TranslationText';
import { LocaleProvider } from '../src/locale';
import { answerGuide } from '../src/travelGuide';
import type { GuideAdapter } from '../src/aiPlanner';
import { buildPersonalPlan } from '../src/tripPlan';
import type { Place } from '../src/data';
import '../src/styles.css';
import '../src/theme.css';

const spot=(id:string,name:string):Place=>({id,kind:'LANDMARK',name,area:'서울',address:'서울 성동구 뚝섬로 273',image:'',lat:37.5444,lng:127.0374,description:'퇴근 뒤에도 충분한 산책. 성수의 작은 가게와 이어 한나절 여행으로 만들기 좋습니다.',note:'',duration:''});
const trip=buildPersonalPlan([spot('qa-a','서울숲 첫 방문'),spot('qa-b','두 번째 장소'),spot('qa-c','셋째 장소'),spot('qa-d','다음 날 장소')],2,'안내 선택 검수','검수');
function Review(){
  const [sheet,setSheet]=useState<'guide'|'profile'|null>(null),[mode,setMode]=useState<'normal'|'retry'|'throw-save'>('normal'),[width,setWidth]=useState(390),[calls,setCalls]=useState<string[]>([]),[saved,setSaved]=useState('검수 이름');
  const count=useRef(0);
  const adapter:GuideAdapter={async answer(request){count.current++;setCalls(values=>[...values,request.question]);if(mode==='retry'&&count.current===1)throw new Error('Sample failure');return answerGuide(request);}};
  return <LocaleProvider><style>{`.phase-sheet{max-width:${width}px!important} .review-controls{padding:12px;display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:1}.review-controls button{font-size:14px;padding:8px;background:white;border:1px solid #ddd;border-radius:8px}.review-content{max-width:${width}px;margin:20px auto;padding:16px;background:#fff}.review-log{white-space:pre-wrap;font-size:14px;padding:12px}`}</style>
    <div className="review-controls">{[320,390,460].map(size=><button key={size} onClick={()=>setWidth(size)}>{size}px</button>)}<button onClick={()=>{setMode('normal');setSheet('guide');}}>안내 열기</button><button onClick={()=>{clearTravelGuideSessions();count.current=0;setCalls([]);setMode('retry');setSheet('guide');}}>첫 질문 실패 검수</button><button onClick={()=>{setMode('normal');setSheet('profile');}}>프로필 열기</button><button onClick={()=>{setMode('throw-save');setSheet('profile');}}>프로필 저장 실패 검수</button></div>
    <section className="review-content"><p>원문은 계속 보입니다.</p><TranslationText sourceId="qa-comment" sourceVersion="v1" text="좋은 장소네요." kind="comment" showOriginal={false}/><p>현재 프로필: {saved}</p></section><output className="review-log">요청 기록: {calls.join(' → ')}</output>
    {sheet==='guide'&&<TravelGuideSheet journey={trip} initialDay={1} adapter={adapter} onClose={()=>setSheet(null)}/>}
    {sheet==='profile'&&<ProfilePreferencesSheet name={saved} onClose={()=>setSheet(null)} onSave={name=>{if(mode==='throw-save')throw new Error('storage fail');setSaved(name);return true;}}/>}
  </LocaleProvider>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
