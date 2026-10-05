import type {Journey,JourneyDay,StoryBlock} from './data';
export function patchJournalDay(journey:Journey,dayNumber:number,patch:Partial<JourneyDay>):Journey {
  return {...journey,days:journey.days.map(day=>{
    if(day.day!==dayNumber)return day;
    const next={...day,...patch},order=new Map(next.blocks.filter(block=>block.type==='PLACE').map((block,index)=>[block.visitId,index]));
    return {...next,places:[...next.places].sort((a,b)=>(order.get(a.visitId)??Infinity)-(order.get(b.visitId)??Infinity))};
  })};
}
export function journalDraftValue(journey:Journey):Journey {
  const {editorDraft,...value}=(journey.editorDraft?.value??journey) as Journey;
  return structuredClone(value);
}
export function stashJournalDraft(original:Journey,draft:Journey,view?:{selectedDay:number;scrollTop:number}):Journey {
  if(!original.isMine||original.id!==draft.id)throw new Error('다른 여행기의 초안은 저장할 수 없어요.');
  const {editorDraft,...value}=draft;
  return {...original,editorDraft:{...original.editorDraft,...view,updatedAt:new Date().toISOString(),value}};
}
export function finishJournalDraft(draft:Journey):Journey {
  if(!draft.title.trim())throw new Error('여행기 제목을 입력해 주세요.');
  const {editorDraft,...value}=draft;
  return {...value,title:value.title.trim(),purpose:'JOURNAL'};
}
export function moveJournalBlock(journey:Journey,sourceDayId:string,blockId:string,targetDayId:string,copy:boolean):Journey {
  const source=journey.days.find(day=>day.dayId===sourceDayId),target=journey.days.find(day=>day.dayId===targetDayId),block=source?.blocks.find(block=>block.id===blockId);
  if(!journey.isMine||!source||!target||!block||block.type==='PLACE')throw new Error('이 기록을 옮길 수 없어요.');
  if(sourceDayId===targetDayId&&!copy)return journey;
  const next:StoryBlock={...structuredClone(block),id:copy?crypto.randomUUID():block.id,visitId:target.places.some(place=>place.visitId===block.visitId)?block.visitId:undefined,images:block.images?.map(photo=>({...photo,id:copy?crypto.randomUUID():photo.id}))};
  return {...journey,days:journey.days.map(day=>({...day,blocks:[...day.blocks.filter(item=>copy||day.dayId!==sourceDayId||item.id!==blockId),...(day.dayId===targetDayId?[next]:[])]}))};
}
