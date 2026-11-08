import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { TogetherGroup, TogetherState } from './model';
interface Props { state: TogetherState; group: TogetherGroup; onAction: (action:'introduction'|'join-settings'|'notice'|'invite'|'create-activity'|'promotion')=>void }
/** Optional owner shortcuts, never a gate to private family/friend use. */
export default function GroupSetupChecklist({state,group,onAction}:Props) {
  const items=[{id:'introduction',label:'모임 소개·관심사 정리',done:Boolean(group.introduction.trim()&&group.discovery?.topics.length)},
    {id:'join-settings',label:'새 멤버 환영·가입 질문',done:Boolean(group.joinFields?.welcome||group.joinFields?.questions.length)},
    {id:'notice',label:'함께 지킬 안내 남기기',done:state.notices.some(item=>item.groupId===group.id&&!item.activityId)},
    {id:'invite',label:'가족·친구·멤버 초대',done:group.memberIds.length>1},
    {id:'create-activity',label:'첫 약속·여행 만들기',done:state.activities.some(item=>item.groupId===group.id)}] as const;
  const completed=items.filter(item=>item.done).length;
  return <details className="tg-group-setup"><summary><span>모임 시작하기 <small>{completed}/{items.length}</small></span><ChevronDown size={16}/></summary><div><p>필요한 것부터 준비해요. 모두 채우지 않아도 모임을 이용할 수 있어요.</p>{items.map(item=><button type="button" key={item.id} onClick={()=>onAction(item.id)}><span className={item.done?'is-done':''}>{item.done?<Check size={14}/>:<span/>}</span><span>{item.label}</span><ChevronRight size={15}/></button>)}<button className="tg-text-button" type="button" onClick={()=>onAction('promotion')}>새 멤버를 공개 모집하고 싶다면<ChevronRight size={15}/></button></div></details>;
}
