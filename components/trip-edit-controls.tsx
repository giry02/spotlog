'use client';

import { useId, useRef, useState } from 'react';
import { CalendarDays, ClipboardList, Copy, ListChecks, PencilLine, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { findFood, findPlace, findStay, period } from '@/lib/trip-data';
import { foodResults, stayResults, visitName, type SavedPlan, type TripAction, type TripSession, type TripState } from '@/lib/trip-engine';
import { libraryPlansForView } from '@/lib/trip-local-features';
import './trip-edit-controls.css';

type Act = (action: TripAction) => void;
const entityName = (id: string) => findPlace(id)?.name ?? findFood(id)?.name ?? findStay(id)?.name ?? id;
const tripTitle = (state: TripState) => state.title?.trim() || `${state.region ?? '나의'} ${period(state.days)} 여행`;
function koreanCalendarDate(value: string | undefined) {
  if (!value) return '확인 필요';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'numeric', month:'long', day:'numeric' }).format(date) : '확인 필요';
}
export function tripDayDate(startDate: string | null | undefined, day: number) {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return '';
  const date = new Date(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

function Sheet({ open, setOpen, title, description, container, children }: {
  open: boolean; setOpen: (open: boolean) => void; title: string; description: string;
  container?: HTMLElement | null; children: React.ReactNode;
}) {
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent presentation="bottom-sheet" className="tr-sheet tr-edit-sheet" portalContainer={container ?? undefined}>
      <div className="tr-sheet-handle" aria-hidden="true" />
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <div className="sheet-body">{children}</div>
    </DialogContent>
  </Dialog>;
}

export function PlanEditControls({ state, act, disabled, focusVisitId, compact=false, stayOnly=false }: { state: TripState; act: Act; disabled: boolean; focusVisitId?: string; compact?: boolean; stayOnly?: boolean }) {
  const trigger = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<'trip' | 'visit' | 'stay' | 'days' | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState(tripTitle(state));
  const [startDate, setStartDate] = useState(state.startDate ?? '');
  const [visitId, setVisitId] = useState(state.plan.find(v => v.day === state.activeDay)?.id ?? state.plan[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [sourceDay, setSourceDay] = useState(state.activeDay);
  const [targetDay, setTargetDay] = useState(state.activeDay);
  const [stayId, setStayId] = useState(state.stayId ?? state.plan.find(v => v.kind === 'stay' && v.entityId)?.entityId ?? '');
  const [nights, setNights] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const days = Array.from({length:state.days}, (_,i)=>i+1);
  const stayIds = [...new Set([state.stayId,...state.plan.filter(v=>v.kind==='stay').map(v=>v.entityId),...(state.collectedIds??[])].filter((id):id is string=>!!id&&!!findStay(id)))];
  function selectVisit(id:string){
    const visit=state.plan.find(v=>v.id===id);
    setVisitId(id);setNote(visit?.note??'');setTime(visit?.time??'');setDuration(visit?.durationMinutes===undefined?'':String(visit.durationMinutes));
  }
  function show(next:NonNullable<typeof panel>){
    setContainer(trigger.current?.closest<HTMLElement>('[data-spotlog-device]')??null);
    setTitle(tripTitle(state));setStartDate(state.startDate??'');setSourceDay(state.activeDay);setTargetDay(state.activeDay);setConfirmed(false);
    if(next==='stay'){setStayId(state.stayId??stayIds[0]??'');setSourceDay(Math.min(state.activeDay,Math.max(1,state.days-1)));setNights(1);}
    selectVisit(focusVisitId??visitId);setPanel(next);
  }
  function send(action:TripAction){setPanel(null);act(action);}
  return <div className="tr-edit-tools" ref={trigger}>
    {stayOnly?<><Button type="button" className="tr-primary" disabled={disabled||state.days<2||!stayIds.length||state.booked||state.plan.some(v=>v.kind==='stay'&&v.locked)} onClick={()=>show('stay')}><ClipboardList size={16}/>숙박일·연박 선택</Button>{state.days<2&&<p className="tr-meta">숙박하려면 DAY 관리에서 여행을 2일 이상으로 늘려 주세요. 선택만으로 여행 기간을 바꾸지 않아요.</p>}</>:compact?<button type="button" className="tr-text-link" disabled={disabled} onClick={()=>show('visit')}><PencilLine size={15}/>이 방문의 시간·메모 수정</button>:<div className="tr-edit-tool-row">
      <button type="button" disabled={disabled} onClick={()=>show('trip')}><CalendarDays size={16}/>여행명·날짜</button>
      <button type="button" disabled={disabled||!state.plan.length} onClick={()=>show('visit')}><PencilLine size={16}/>방문 시간·메모</button>
      <button type="button" disabled={disabled||state.days<2||!stayIds.length} onClick={()=>show('stay')}><ClipboardList size={16}/>숙박일·연박</button>
      <button type="button" disabled={disabled} onClick={()=>show('days')}><Copy size={16}/>DAY 관리</button>
    </div>}
    <Sheet open={panel!==null} setOpen={open=>{if(!open)setPanel(null);}} container={container}
      title={panel==='trip'?'여행명과 출발 날짜':panel==='visit'?'방문 시간과 메모':panel==='stay'?'숙박 날짜와 연박':'DAY와 방문 관리'}
      description="변경할 항목만 저장해 주세요. 예약을 고정한 숙소는 유지됩니다.">
      {panel==='trip'&&<form className="tr-edit-form" onSubmit={e=>{e.preventDefault();if(!title.trim()||title.trim().length>100)return;const currentStartDate=new FormData(e.currentTarget).get('tripStartDate');if(typeof currentStartDate!=='string')return;send({type:'trip-meta',title:title.trim(),startDate:currentStartDate||null});}}>
        <label>여행 이름<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} required aria-invalid={!title.trim()||title.trim().length>100} placeholder="예: 가을 부산 여행"/></label>
        {(!title.trim()||title.trim().length>100)&&<p className="tr-meta" role="alert">여행 이름은 공백을 제외한 글자를 포함해 100자 이내로 입력해 주세요.</p>}
        <label>출발 날짜<input type="date" name="tripStartDate" min="2000-01-01" max="2100-12-31" defaultValue={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
        <p className="tr-meta">출발 날짜를 지우면 DAY 번호로만 보관해요. 항공·숙소 예약 날짜를 변경하지는 않습니다.</p>
        <Button type="submit" className="tr-primary" disabled={!title.trim()||title.trim().length>100}>여행 정보 저장</Button>
      </form>}
      {panel==='visit'&&<form className="tr-edit-form" onSubmit={e=>{e.preventDefault();const currentTime=new FormData(e.currentTarget).get('visitTime');if(typeof currentTime!=='string')return;send({type:'visit-details',id:visitId,note,time:currentTime,durationMinutes:duration===''?0:Number(duration)});}}>
        <label>수정할 방문<select value={visitId} onChange={e=>selectVisit(e.target.value)}>{state.plan.map(v=><option key={v.id} value={v.id}>DAY {v.day} · {visitName(v)}</option>)}</select></label>
        <div className="tr-edit-two"><label>방문 시각<input key={visitId} type="time" name="visitTime" defaultValue={time} onChange={e=>setTime(e.target.value)}/></label>
        <label>체류시간 (분)<input type="number" min={0} max={1440} value={duration} onChange={e=>setDuration(e.target.value)} placeholder="미정"/></label></div>
        <label>개인 메모<textarea rows={4} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="주차 위치, 꼭 보고 싶은 것 등"/></label>
        <Button type="submit" className="tr-primary" disabled={!visitId}>이 방문에 저장</Button>
      </form>}
      {panel==='stay'&&<form className="tr-edit-form" onSubmit={e=>{e.preventDefault();send({type:'stay-placement',stayId,startDay:Math.min(sourceDay,state.days-1),nights});}}>
        <label>숙소<select value={stayId} onChange={e=>setStayId(e.target.value)}><option value="">숙소 선택</option>{stayIds.map(id=><option key={id} value={id}>{entityName(id)}</option>)}</select></label>
        <label>숙박 시작<select value={Math.min(sourceDay,state.days-1)} onChange={e=>{setSourceDay(Number(e.target.value));setNights(1);}}>{days.filter(d=>d<state.days).map(d=><option key={d} value={d}>DAY {d} {tripDayDate(state.startDate,d)}</option>)}</select></label>
        <label>숙박 박수<select value={nights} onChange={e=>setNights(Number(e.target.value))}>{Array.from({length:Math.max(1,state.days-Math.min(sourceDay,state.days-1))},(_,i)=><option key={i+1} value={i+1}>{i+1}박</option>)}</select></label>
        <p className="tr-meta">일정의 숙박일을 배치합니다. 실제 객실 예약·체크인·결제는 진행하지 않습니다.</p>
        <Button className="tr-primary" type="submit" disabled={!stayId}>숙박일 적용</Button>
      </form>}
      {panel==='days'&&<div className="tr-edit-form">
        <label>기준 DAY<select value={sourceDay} onChange={e=>setSourceDay(Number(e.target.value))}>{days.map(d=><option key={d} value={d}>DAY {d}</option>)}</select></label>
        <div className="tr-edit-tool-row"><button disabled={state.days>=30} onClick={()=>send({type:'day-add',afterDay:sourceDay})}><Plus size={16}/>다음에 빈 DAY 추가</button><button disabled={state.days>=30} onClick={()=>send({type:'day-copy',day:sourceDay})}><Copy size={16}/>이 DAY 복사</button></div>
        <label>복사할 방문<select value={visitId} onChange={e=>selectVisit(e.target.value)}>{state.plan.filter(v=>v.kind!=='stay'&&!v.locked).map(v=><option key={v.id} value={v.id}>DAY {v.day} · {visitName(v)}</option>)}</select></label>
        <label>복사할 DAY<select value={targetDay} onChange={e=>setTargetDay(Number(e.target.value))}>{days.map(d=><option key={d} value={d}>DAY {d}</option>)}</select></label>
        <Button variant="outline" disabled={!state.plan.some(v=>v.id===visitId&&v.kind!=='stay'&&!v.locked)} onClick={()=>send({type:'visit-copy',id:visitId,day:targetDay})}>선택한 방문 복사</Button>
        <div className="tr-edit-danger"><label className="tr-edit-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>DAY {sourceDay}의 방문들을 일정에서 제외할게요</label>
        <Button variant="outline" disabled={!confirmed||state.days<2} onClick={()=>send({type:'day-delete',day:sourceDay})}><Trash2 size={15}/>이 DAY 삭제</Button></div>
        <p className="tr-meta">예약한 숙소와 숙박 날짜가 달라지는 변경은 적용하지 않아요. 작성 후 DAY는 최대 30일까지 추가할 수 있어요.</p>
      </div>}
    </Sheet>
  </div>;
}

export function CandidateProposal({state,ids,act}:{state:TripState;ids:string[];act:Act}){
  const ref=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[slot,setSlot]=useState('lunch');
  const [container,setContainer]=useState<HTMLElement|null>(null);
  const first=ids.find(id=>findStay(id)||findFood(id));
  const firstFood=findFood(first??null),firstStay=findStay(first??null);
  const kind=firstStay?'stay':firstFood?.cuisine==='카페'?'cafe':firstFood?.cuisine==='상점'?'shop':'food';
  const anchorId=state.anchorId??firstFood?.placeId??firstStay?.near[0];
  const fixedSlot=kind==='cafe'?'cafe':kind==='shop'?'shop':kind==='stay'?'stay':null;
  const fixedLabel=kind==='cafe'?'카페에서 쉬기':kind==='shop'?'쇼핑':'숙박';
  const scoped=anchorId?(kind==='stay'?stayResults({...state,anchorId}):foodResults({...state,anchorId,foodKind:kind==='cafe'?'카페':kind==='shop'?'상점':'식당'})):[];
  const options=ids.filter(id=>scoped.some(item=>item.id===id)).slice(0,6);
  const day=kind==='stay'?Math.min(state.activeDay,Math.max(1,state.days-1)):state.activeDay;
  const canPropose=!!anchorId&&options.length>=2&&(kind!=='stay'||state.days>=2&&!state.booked);
  return <div ref={ref}>
    <Button variant="outline" className="tr-primary" disabled={!canPropose} onClick={()=>{setContainer(ref.current?.closest<HTMLElement>('[data-spotlog-device]')??null);setSelected(options.slice(0,2));setSlot(fixedSlot??'lunch');setOpen(true);}}><ListChecks size={16}/>여러 후보를 비교하고 결정</Button>
    {ids.length>=2&&!canPropose&&<p className="tr-meta">{kind==='stay'&&state.days<2?'숙박 후보 비교는 2일 이상 여행에서 할 수 있어요.':'같은 기준 위치 주변에 비교할 후보가 2곳 이상 있어야 해요.'}</p>}
    <Sheet open={open} setOpen={setOpen} container={container} title="같은 자리의 대안 후보" description="여러 방문을 추가하는 대신, 이 중 한 곳을 고를 후보로 보관합니다.">
      <form className="tr-edit-form" onSubmit={e=>{e.preventDefault();if(!canPropose||selected.length<2||selected.some(id=>!options.includes(id)))return;setOpen(false);act({type:'candidate-propose',ids:selected,day,anchorId,slot:fixedSlot??slot});}}>
        <p className="tr-meta">DAY {day} · {anchorId?`${entityName(anchorId)} 주변`:state.region}의 같은 종류 후보를 비교해요.</p>
        {fixedSlot?<p className="tr-meta">비교할 자리: <strong>{fixedLabel}</strong></p>:<label>비교할 식사<select value={slot} onChange={e=>setSlot(e.target.value)}>{[['아침','아침'],['lunch','점심'],['dinner','저녁'],['추가 식사','추가 식사']].map(([v,n])=><option value={v} key={v}>{n}</option>)}</select></label>}
        {options.map(id=><label className="tr-edit-check" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(e.target.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{entityName(id)}</label>)}
        <Button type="submit" className="tr-primary" disabled={!canPropose||selected.length<2||selected.some(id=>!options.includes(id))}>이 후보들을 보관</Button>
      </form>
    </Sheet>
  </div>;
}

export function CandidateReview({state,act}:{state:TripState;act:Act}){
  const instanceId=useId();
  const groups=state.pendingCandidates??[];
  const [selections,setSelections]=useState<Record<string,string>>({});
  if(!groups.length)return null;
  const chosen=(id:string)=>selections[id]??groups.find(g=>g.id===id)?.selectedId;
  return <section className="tr-unit tr-candidate-review">
    <h3><ListChecks size={18}/>후보를 골라 일정을 확정해 주세요</h3>
    {groups.map(group=><fieldset key={group.id}><legend>DAY {group.day} · {group.slot}{group.anchorId?` · ${entityName(group.anchorId)} 주변`:''}</legend>
      {group.optionIds.map(id=><label className="tr-edit-check" key={id}><input type="radio" name={`${instanceId}-${group.id}`} checked={chosen(group.id)===id} onChange={()=>setSelections({...selections,[group.id]:id})}/>{entityName(id)}</label>)}
    </fieldset>)}
    <p className="tr-meta">선택만으로 방문을 바꾸지 않습니다. 모든 자리를 고르고 적용해 주세요.</p>
    <Button className="tr-primary" disabled={groups.some(g=>!chosen(g.id))} onClick={()=>act({type:'candidate-apply',selections:groups.map(g=>({groupId:g.id,id:chosen(g.id)!}))})}>선택한 후보를 일정에 적용</Button>
    <Button variant="outline" className="tr-primary" onClick={()=>act({type:'candidate-reject'})}>후보 선택 취소</Button>
  </section>;
}

export function TripLibraryManager({session,state,act,trash=false}:{session:TripSession;state:TripState;act:Act;trash?:boolean}){
  const ref=useRef<HTMLDivElement>(null);
  const [removing,setRemoving]=useState<SavedPlan|null>(null),[confirmed,setConfirmed]=useState(false);
  const [container,setContainer]=useState<HTMLElement|null>(null);
  const plans=libraryPlansForView(session,state).filter(p=>trash?!!p.deletedAt:!p.deletedAt);
  return <div className="tr-library-manager" ref={ref}>
    {plans.map(plan=><div className="tr-library-managed-row" key={plan.id}>
      <button className="tr-library-plan" disabled={trash} onClick={()=>act({type:'open',id:plan.id})}><CalendarDays size={18}/><span><strong>{plan.title}</strong><small>{plan.status==='READY'?'작성 완료':'작성 중'} · {plan.startDate?`${plan.startDate} · `:''}{plan.days}일 · {plan.visits.length}개 방문</small>{trash&&<small>복구 기한 {koreanCalendarDate(plan.purgeAfter)} (한국시간)</small>}</span></button>
      {trash?<><button aria-label={`${plan.title} 복구`} onClick={()=>act({type:'restore',id:plan.id})}><RotateCcw size={17}/></button><button aria-label={`${plan.title} 영구삭제`} onClick={()=>{setContainer(ref.current?.closest<HTMLElement>('[data-spotlog-device]')??null);setRemoving(plan);setConfirmed(false);}}><Trash2 size={17}/></button></>:<button aria-label={`${plan.title} 휴지통으로 이동`} onClick={()=>act({type:'trash',id:plan.id})}><Trash2 size={17}/></button>}
    </div>)}
    {!plans.length&&<p className="tr-meta">{trash?'휴지통이 비어 있어요.':'아직 저장한 여행이 없어요.'}</p>}
    {!trash&&<button className="tr-text-link" onClick={()=>act({type:'trash-list'})}><Trash2 size={15}/>삭제한 여행 보기</button>}
    {trash&&<p className="tr-meta">삭제 후 6개월 이내 비공개로 복구할 수 있어요. 영구 삭제하면 복구할 수 없습니다.</p>}
    <Sheet open={!!removing} setOpen={open=>{if(!open)setRemoving(null);}} container={container} title="여행 영구 삭제" description="휴지통에서도 삭제합니다. 이 작업은 되돌릴 수 없습니다.">
      <div className="tr-edit-form"><strong>{removing?.title}</strong><label className="tr-edit-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>이 여행을 복구할 수 없다는 것을 확인했어요</label>
        <Button disabled={!confirmed} onClick={()=>{if(removing){act({type:'delete-permanent',id:removing.id,confirmed:true});setRemoving(null);}}}>영구 삭제</Button>
      </div>
    </Sheet>
  </div>;
}
