import {useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AccountSheet} from '../src/AccountSheet';
import {BottomSheet} from '../src/BottomSheet';
import {ExternalPlaceSearch} from '../src/ExternalPlaceSearch';
import {AiPlannerSheet,type AiPlannerDraft} from '../src/AiPlannerSheet';
import {createAiPlannerSampleAdapter} from '../src/aiPlanner';
import type {SocialAccountAdapter} from '../src/socialAccountService';
import {draftPolicies} from '../src/accountPolicies';
import {ServiceError} from '../src/serviceRequest';
import {LocaleProvider,LanguageControls} from '../src/locale';
import {PersonalTrip} from '../src/PersonalTrip';
import RouteMap from '../src/RouteMap';
import {buildPersonalPlan} from '../src/tripPlan';
import type {Place} from '../src/data';
import '../src/styles.css';
import '../src/theme.css';
const place=(id:string,name:string,lat:number):Place=>({id,name,lat,lng:127.04,area:'서울 성동',kind:'LANDMARK',address:'서울 성동구 검수용 주소',image:'',description:'검수용 장소',note:'',duration:'1시간'});
const places=[place('review-a','첫 랜드마크',37.54),place('review-b','위치 미확인 장소',NaN),place('review-c','세 번째 랜드마크',37.55)];
const wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
function Review(){
 const [screen,setScreen]=useState(''),[scenario,setScenario]=useState('normal'),[log,setLog]=useState(''),[trip,setTrip]=useState(()=>buildPersonalPlan(places,2,'프론트 검수 여행','검수'));
 const count=useRef(0),draft=useRef<AiPlannerDraft|null>(null);
 const ai=useMemo(()=>createAiPlannerSampleAdapter({delayMs:scenario==='slow'?5000:100,failure:scenario==='fail'?'500':scenario==='expired'?'401':undefined}),[scenario]);
 const account=useMemo<SocialAccountAdapter>(()=>({configured:true,
  async session(){return scenario==='signed'||scenario==='expired'?{state:'SIGNED_IN',user:{id:'fixture',displayName:'검수 계정',email:'qa@example.invalid',provider:'APPLE'}}:scenario==='signup'||scenario==='signup-fail'||scenario==='stale'?{state:'PENDING_SIGNUP',provider:'GOOGLE'}:{state:'GUEST'};},
  async policies(){return {...draftPolicies,status:'PUBLISHED',operator:{name:'검수 전용 운영자',address:'검수 전용 주소',email:'qa@example.invalid'},documents:draftPolicies.documents.map(d=>({...d,version:'review-fixture-1'}))};},
  async beginSignIn(p){await wait(150);if(scenario==='fail')throw new ServiceError(500,'fixture');setLog(`${p} 인증 이동 확인`);return p==='GOOGLE'?'https://accounts.google.com/o/oauth2/v2/auth':'https://appleid.apple.com/auth/authorize';},
  async completeSignup(_bundle,choices){count.current++;await wait(150);if(scenario==='signup-fail'&&count.current===1)throw new ServiceError(500,'fixture');if(scenario==='stale'&&count.current===1)throw new ServiceError(409,'fixture');setLog(`회원가입 요청 확인 · ${JSON.stringify(choices)}`);return {id:'fixture',displayName:'검수 계정',email:null,provider:'GOOGLE'};},
  async signInEmail(email){return {id:'fixture',displayName:'검수 계정',email,provider:'EMAIL'};},
  async signUpEmail(input){return {state:'VERIFICATION_REQUIRED',email:input.email};},
  async verifyEmail(email){return {id:'fixture',displayName:'검수 계정',email,provider:'EMAIL'};},
  async resendVerification(){setLog('인증번호 발송 검수');},async resetPassword(){setLog('비밀번호 안내 발송 검수');},
  async signOut(){if(scenario==='expired')throw new ServiceError(401,'expired');setLog('로그아웃 확인');},async removeAccount(){setLog('탈퇴 요청 확인');},
 }),[scenario]);
 const open=(s:string,m='normal')=>{count.current=0;setScenario(m);setScreen(s);};
 return <><div className="app-shell" style={{maxWidth:460,height:'auto',minHeight:'100dvh'}}><div className="review-controls" style={{display:'flex',gap:8,flexWrap:'wrap',padding:16}}><LanguageControls/>{[['계정','account','normal'],['계정 실패','account','fail'],['가입 동의','account','signup'],['가입 재시도','account','signup-fail'],['약관 변경','account','stale'],['가입 계정','account','signed'],['만료 계정','account','expired'],['외부 검색','external','normal'],['검색 오류','external','fail'],['검색 빈 결과','external','empty'],['검색 취소','external','slow'],['AI 초안','ai','normal'],['AI 오류','ai','fail'],['AI 취소','ai','slow'],['내 여행','trip','normal']].map(([label,s,m])=><button className="outline" key={label} onClick={()=>open(s,m)}>{label}</button>)}</div><output style={{display:'block',padding:16}}>{log}</output>
 {screen==='trip'&&<PersonalTrip journey={trip} catalog={places} savedPlaces={places} onBack={()=>setScreen('')} onChange={v=>{setTrip(v);setLog('여행 변경 저장');return true;}} onAddLandmark={()=>setLog('랜드마크 추가')} onSaveBusiness={()=>true} onCopy={()=>{}} onJournal={()=>{}} renderMap={(p,s,onSelect)=><RouteMap places={p} selectedVisitId={s} onSelectVisit={onSelect}/>}/>}</div>
 {screen==='account'&&<AccountSheet adapter={account} onClose={()=>setScreen('')} navigate={url=>setLog(`인증 이동: ${url}`)}/>}
 {screen==='external'&&<BottomSheet title="DAY 1 · 첫 랜드마크 주변" onClose={()=>setScreen('')}><ExternalPlaceSearch region="서울 성동" initialQuery="음식점" endpoint="/review-only" onBack={()=>setScreen('trip')} search={async(_endpoint,query)=>{count.current++;await wait(scenario==='slow'?5000:100);setLog(`검색 요청 ${count.current}: ${query}`);if(scenario==='fail'&&count.current===1)throw new ServiceError(500,'fixture');return {provider:'NAVER',items:scenario==='empty'?[]:[{name:'첫 번째 검색 결과',address:'서울 성동구',category:'음식점',url:'https://example.com/1'},{name:'두 번째 검색 결과',address:'서울 성동구',category:'음식점',url:'https://example.com/2'}]};}}/></BottomSheet>}
 {screen==='ai'&&<AiPlannerSheet places={places} savedPlaces={places} author="검수" draftRef={draft} initialPrompt="서울에서 1박 2일, 음식점과 숙소를 포함해줘" adapter={ai} onClose={()=>setScreen('')} onCreate={value=>{setTrip(value);setLog(`AI 저장: ${value.days.length}일 / ${value.days.flatMap(d=>d.places).length}곳`);return value.id;}}/>}
 </>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<LocaleProvider><Review/></LocaleProvider>);
