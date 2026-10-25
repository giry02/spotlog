import { appendTrip, type TripSession } from './trip-engine';
import { parseTripAction, parseTripSession, validateActionContext } from './chat-contract';

/** An explicit favorite reference opens its own saved DAY. Existing model open
 * and day contracts stay unchanged; this read-only navigation creates one turn. */
export function openSavedTripReferenceDay(session:TripSession,planId:string,day:number,placeId:string):TripSession {
  const current=parseTripSession(session);
  const saved=current.library.find(plan=>plan.id===planId&&!plan.deletedAt);
  if(!saved||!Number.isInteger(day)||day<1||day>saved.days||!saved.visits.some(visit=>visit.day===day&&visit.entityId===placeId))throw new Error('이 장소가 포함된 활성 저장 여행의 DAY를 다시 선택해 주세요.');
  const open=parseTripAction({type:'open',id:planId});
  validateActionContext(open,current,false);
  const opened=appendTrip(current,open),selectDay=parseTripAction({type:'day',day});
  validateActionContext(selectDay,opened,false);
  const selected=appendTrip(opened,selectDay),turn=selected.turns.at(-1)!;
  return parseTripSession({...selected,turns:[...current.turns,{...turn,id:current.nextId,source:'local-action',state:{...turn.state,question:`${saved.title} · DAY ${day}에서 이어가기`}}],nextId:current.nextId+1});
}
