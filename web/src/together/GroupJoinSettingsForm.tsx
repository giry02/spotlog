import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { togetherId } from './model';
import { groupAvailabilityOptions, isGroupJoinFields, normalizeGroupJoinFields, type GroupJoinFields } from './groupJoining';
import './group-creation.css';
export interface GroupJoinSettingsFormProps { initial?: GroupJoinFields; onSave: (fields: GroupJoinFields) => boolean | Promise<boolean> }
/** Permissions and concurrent source/version checks remain with the parent's repository mutation. */
export default function GroupJoinSettingsForm({initial,onSave}:GroupJoinSettingsFormProps) {
  const [draft,setDraft]=useState(()=>normalizeGroupJoinFields(initial));const [busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[saved,setSaved]=useState(false);const lock=useRef(false);
  const update=(value:Partial<GroupJoinFields>)=>{setDraft(current=>({...current,...value}));setError('');setSaved(false);};
  const submit=async()=>{
    if(lock.current)return;const fields=normalizeGroupJoinFields(draft);
    if(!isGroupJoinFields(fields))return setError('질문은 최대 3개, 각 120자 이내로 적어 주세요.');
    lock.current=true;setBusy(true);setError('');setSaved(false);
    try {if(await onSave(fields))setSaved(true);else setError('저장하지 못했어요. 입력은 유지했으니 다시 확인해 주세요.');}
    catch(cause){setError(cause instanceof Error?cause.message:'저장하지 못했어요. 잠시 후 다시 시도해 주세요.');}
    finally{lock.current=false;setBusy(false);}
  };
  return <form className="group-join-form" onSubmit={event=>{event.preventDefault();void submit();}}><h2>새 멤버 맞이하기</h2><p className="group-form-hint">환영 인사와 활동 시간을 안내하고 선택 질문을 준비해요.</p><div className="group-form-fields"><label>환영 인사 <small>선택</small><textarea value={draft.welcome} maxLength={500} rows={3} onChange={event=>update({welcome:event.target.value})} placeholder="새 멤버에게 전할 첫 인사"/></label><fieldset><legend>주로 활동하는 시간 <small>선택</small></legend><div className="group-form-chips">{groupAvailabilityOptions.map(item=><button type="button" key={item.id} aria-pressed={draft.availableTimes.includes(item.id)} onClick={()=>update({availableTimes:draft.availableTimes.includes(item.id)?draft.availableTimes.filter(id=>id!==item.id):[...draft.availableTimes,item.id]})}>{item.label}</button>)}</div></fieldset><fieldset><legend>새 멤버 질문 <small>선택 · 최대 3개</small></legend><p className="group-form-hint">멤버는 답변하지 않고도 가입할 수 있어요. 기존 가입 답변은 당시 질문과 함께 유지돼요.</p>{draft.questions.map((question,index)=><div className="group-question-row" key={question.id}><input aria-label={`새 멤버 질문 ${index+1}`} value={question.label} maxLength={120} onChange={event=>update({questions:draft.questions.map(item=>item.id===question.id?{...item,label:event.target.value}:item)})} placeholder="함께 해보고 싶은 활동이 있나요?"/><button type="button" aria-label={`새 멤버 질문 ${index+1} 삭제`} onClick={()=>update({questions:draft.questions.filter(item=>item.id!==question.id)})}><Trash2 size={17}/></button></div>)}{draft.questions.length<3&&<button type="button" onClick={()=>update({questions:[...draft.questions,{id:togetherId('join-question'),label:''}]})}><Plus size={17}/>질문 추가</button>}</fieldset></div>{error&&<p className="group-form-error" role="alert">{error}</p>}{saved&&<p role="status">새 멤버 안내를 저장했어요.</p>}<button type="submit" className="tg-primary" disabled={busy}>{busy?'저장 중…':'새 멤버 안내 저장'}</button></form>;
}
