import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LockKeyhole, MapPin, Sparkles } from 'lucide-react';
import type { Journey } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { applyRevision, validateRevisionResult, protectedRevisionVisits, journeyVersion, localAiPlannerAdapter, revisionScopeVisits, type AiPlannerAdapter, type RevisionRequest, type RevisionResult } from './aiPlanner';
import './ai-planner.css';
import './ai-revision.css';
import { useLocale } from './locale';
import { withRequestDeadline } from './requestDeadline';
import { plannerText } from './aiPlanner';

export interface AiPlanRevisionSheetProps { journey:Journey; initialDay?:number; onClose:()=>void; onApply:(next:Journey,sourceVersion:string)=>boolean; adapter?:AiPlannerAdapter }
export function AiPlanRevisionSheet({journey,initialDay=1,onClose,onApply,adapter=localAiPlannerAdapter}:AiPlanRevisionSheetProps) {
  const { locale }=useLocale();
  const say=(text:string)=>plannerText(locale,text);
  const [dayId,setDayId]=useState(journey.days.find(d=>d.day===initialDay)?.dayId??journey.days[0]?.dayId??'');
  const [scope,setScope]=useState<RevisionRequest['scope']>('day'),[lessWalking,setLessWalking]=useState(true),[excluded,setExcluded]=useState<string[]>([]);
  const [fromVisitId,setFromVisitId]=useState(''),[preview,setPreview]=useState<RevisionResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef<AbortController|null>(null),sequence=useRef(0),applying=useRef(false),latestJourney=useRef(journey);latestJourney.current=journey;
  const previewRequest=useRef<RevisionRequest|null>(null);
  const version=journeyVersion(journey);
  const day=journey.days.find(d=>d.dayId===dayId);
  useEffect(()=>()=>{sequence.current++;pending.current?.abort();},[]);
  const cancel=()=>{pending.current?.abort();pending.current=null;sequence.current++;setBusy(false);};
  // Changing the automatic reduction option must not erase hand-picked exclusions.
  // Only a change of scope invalidates which visits the user can exclude.
  const change=(resetExcluded=false)=>{cancel();previewRequest.current=null;setPreview(null);setError('');if(resetExcluded)setExcluded([]);};
  const close=()=>{cancel();onClose();};
  const request:RevisionRequest={requestId:'',sourceVersion:version,language:locale,selectedPlaceIds:journey.days.flatMap(d=>d.places.map(p=>p.id)),dayIds:[dayId],lockedVisitIds:journey.days.flatMap(d=>d.places.filter(p=>p.bookingFixed||p.kind==='STAY').map(p=>p.visitId!)),journey,dayId,scope,fromVisitId,lessWalking,excludedVisitIds:excluded};
  let scoped=new Set<string>(),protectedIds=new Set<string>();try{scoped=revisionScopeVisits(request);protectedIds=protectedRevisionVisits(request);}catch{/* A start visit has not been selected yet. */}
  const scopedPlaces=journey.days.flatMap(d=>d.places).filter(p=>scoped.has(p.visitId!));
  const propose=async()=>{
    if(pending.current||applying.current)return;
    const controller=new AbortController(),token=++sequence.current,requestId=crypto.randomUUID();pending.current=controller;setBusy(true);setError('');
    try {const sentRequest={...request,requestId,journey:structuredClone(journey)};
      const response=await withRequestDeadline(signal=>adapter.revise(sentRequest,signal),controller.signal);
      if(controller.signal.aborted||token!==sequence.current)return;
      const result=validateRevisionResult(sentRequest,response);
      if(controller.signal.aborted||token!==sequence.current)return;
      if(result.requestId!==requestId||result.sourceVersion!==journeyVersion(latestJourney.current)){setError('여행이 바뀌었어요. 최신 내용으로 다시 제안해 주세요.');return;}
      previewRequest.current=sentRequest;setPreview(result);
    }catch(cause){if(!controller.signal.aborted&&token===sequence.current)setError(cause instanceof Error?cause.message:'변경안을 만들지 못했어요. 다시 시도해 주세요.');}
    finally{if(token===sequence.current){pending.current=null;setBusy(false);}}
  };
  const apply=()=>{
    if(!preview||!previewRequest.current||applying.current)return;
    applying.current=true;setError('');
    try {const next=applyRevision(latestJourney.current,preview,previewRequest.current);if(onApply(next,preview.sourceVersion))close();else{applying.current=false;setError('현재 일정이 바뀌었거나 저장하지 못했어요. 최신 내용으로 다시 제안해 주세요.');}}
    catch(cause){applying.current=false;setError(cause instanceof Error?cause.message:'변경하지 못했어요. 원래 일정은 그대로예요.');}
  };
  return <BottomSheet title={locale==='en'?'Reduce visits':'방문 수 줄이기'} description={say("등록 자료 변경 제안 · 실제 AI 연결 전")} onClose={close}><div className="ai-planner ai-revision ui-stack">
    <p className="ai-revision-help">{locale==='en'?'Choose stops to remove or reduce visits automatically. Review the changes before applying them.':'방문할 곳을 직접 빼거나 자동으로 줄여요. 변경 전후를 확인한 뒤 적용해 주세요.'}</p>
    <div className="ai-travel-conditions"><Field label={say("기준 DAY")}><select value={dayId} onChange={e=>{change(true);setDayId(e.target.value);setFromVisitId('');}}>{journey.days.map(d=><option key={d.dayId} value={d.dayId}>DAY {d.day}</option>)}</select></Field>
    <Field label={say("변경 범위")}><select value={scope} onChange={e=>{change(true);setScope(e.target.value as RevisionRequest['scope']);}}><option value="day">{say("이 DAY만")}</option><option value="afternoon">{say("이 DAY 오후만")}</option><option value="remaining">{say("지정 장소부터 남은 일정")}</option></select></Field></div>
    {scope==='remaining'&&<Field label={say("이 장소부터")}><select value={fromVisitId} onChange={e=>{change(true);setFromVisitId(e.target.value);}}><option value="">{say("시작할 장소 선택")}</option>{day?.places.map(p=><option key={p.visitId} value={p.visitId}>{p.name}</option>)}</select></Field>}
    {scope==='afternoon'&&<p className="ai-planner-note">{locale==='en'?'Change afternoon and evening stops, using their time or suggested slot. Reserved stays are kept.':'방문 시간이나 추천 시간대가 오후·저녁인 장소를 바꿔요. 예약한 숙소는 유지해요.'}</p>}
    <label className="ai-planner-check"><input type="checkbox" checked={lessWalking} onChange={e=>{change();setLessWalking(e.target.checked);}}/>{locale==='en'?'Automatically reduce daily visits':'하루 방문 수 자동으로 줄이기'}</label>
    <details className="ai-planner-details"><summary><MapPin size={16}/><span>{say('제외할 방문 선택')} · {scopedPlaces.length} {say('곳')}</span><ChevronDown className="ai-planner-chevron" size={16}/></summary><div className="ai-planner-disclosure-body ui-stack"><p className="ai-planner-note"><LockKeyhole size={12}/>{say(" 고정한 장소·숙소와 연결된 예약은 유지해요.")}</p>
    {scopedPlaces.map(p=><label key={p.visitId} className="ai-planner-check"><input type="checkbox" disabled={protectedIds.has(p.visitId!)} checked={excluded.includes(p.visitId!)} onChange={()=>{change();setExcluded(current=>current.includes(p.visitId!)?current.filter(id=>id!==p.visitId):[...current,p.visitId!]);}}/>{p.name}{protectedIds.has(p.visitId!)?(locale==='en'?' · fixed':' · 고정'):''}</label>)}</div></details>
    {preview?<><div aria-live="polite">{preview.data.changedDayIds.map(id=>{const before=journey.days.find(d=>d.dayId===id),after=preview.data.journey.days.find(d=>d.dayId===id);return <section className="ai-planner-diff" key={id}><strong>DAY {before?.day} · {say('변경 비교')}</strong><p>{say('변경 전')} · {before?.places.map(p=>p.name).join(' → ')||say('빈 일정')}</p><p>{say('변경 후')} · {after?.places.map(p=>p.name).join(' → ')||say('빈 일정')}</p></section>;})}</div>
      <ul className="ai-planner-note">{preview.warnings.map(warning=><li key={warning}>{say(warning)}</li>)}</ul>
      {preview.sourceVersion!==version&&<p className="ui-error" role="alert">{say("이후 여행이 수정됐어요. 이 변경안은 적용할 수 없어요.")}</p>}
      <Button disabled={!preview.data.changedDayIds.length||preview.sourceVersion!==version} onClick={apply}><Check size={16}/>{say("확인한 변경만 적용")}</Button><Button variant="secondary" onClick={()=>change()}>{say("원래 일정 유지 · 다시 제안")}</Button>
    </>:<Button loading={busy} onClick={propose}><Sparkles size={16}/>{say("변경안 비교하기")}</Button>}
    {busy&&<button className="ai-planner-cancel" onClick={cancel}>{say("제안 취소")}</button>}
    {error&&<p className="ui-error" role="alert">{say(error)}</p>}
  </div></BottomSheet>;
}
