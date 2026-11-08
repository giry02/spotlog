import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { GroupJoinMode, TogetherGroup } from './model';
import { discoveryProfile } from './discovery';
import { groupAvailabilityOptions, isGroupJoinFields, normalizeGroupJoinDraft, normalizeGroupJoinFields, validateGroupJoinDraft, type GroupJoinDraft, type GroupJoinFields } from './groupJoining';
import './group-creation.css';

export interface GroupJoinFormProps {
  group: TogetherGroup; accountName: string; initial?: Partial<GroupJoinDraft>;
  joinMode?: GroupJoinMode; fields?: GroupJoinFields; context?: ReactNode;
  onSubmit: (draft: GroupJoinDraft) => boolean | Promise<boolean>;
  onDraftChange?: (draft: GroupJoinDraft) => void;
}
export default function GroupJoinForm(props: GroupJoinFormProps) {
  return <GroupJoinBody key={props.group.id} {...props}/>;
}
function GroupJoinBody({group,accountName,initial,joinMode,fields:givenFields,context,onSubmit,onDraftChange}:GroupJoinFormProps) {
  const profile=discoveryProfile(group);
  const stored=(group as TogetherGroup & {joinFields?:GroupJoinFields}).joinFields;
  const fields=givenFields || (isGroupJoinFields(stored)?stored:normalizeGroupJoinFields());
  const mode=joinMode || profile.joinMode || 'APPROVAL';
  const direct=mode==='DIRECT';
  const [draft,setDraft]=useState(()=>normalizeGroupJoinDraft(initial,accountName,fields));
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const lock=useRef(false),notify=useRef(onDraftChange);notify.current=onDraftChange;
  useEffect(()=>{notify.current?.(draft);},[draft]);
  const update=(value:Partial<GroupJoinDraft>)=>{setDraft(current=>({...current,...value}));setError('');};
  const submit=async()=>{
    if(lock.current)return;let value:GroupJoinDraft;
    try{value=validateGroupJoinDraft(draft,fields);}catch(cause){setError(cause instanceof Error?cause.message:'가입 내용을 확인해 주세요.');return;}
    lock.current=true;setBusy(true);setError('');
    try{if(!await onSubmit(value))setError('완료하지 못했어요. 입력을 유지했으니 가입 안내를 다시 확인해 주세요.');}
    catch(cause){setError(cause instanceof Error?cause.message:'완료하지 못했어요. 잠시 후 다시 시도해 주세요.');}
    finally{lock.current=false;setBusy(false);}
  };
  return <form className="group-join-form" onSubmit={event=>{event.preventDefault();void submit();}}><div className="group-join-heading"><span className="group-join-mode">{direct?'바로 가입':'운영진 승인 후 가입'}</span><h2>{group.name}</h2><p>{fields.welcome||profile.welcome}</p><small>{direct?'안내를 확인하고 가입하면 모임을 이용할 수 있어요.':'신청을 보내면 운영진이 확인해요. 승인 후 모임을 이용할 수 있어요.'} 약속 참가는 별도로 선택해요.</small></div>{context}
    <div className="group-form-fields"><label>이 모임에서 사용할 이름 <small>선택</small><input aria-label="모임에서 사용할 이름" value={draft.nickname} maxLength={30} autoComplete="nickname" onChange={event=>update({nickname:event.target.value})}/><small>계정 이름은 바뀌지 않아요.</small></label><details className="group-join-options" open={!direct}><summary>자기소개·활동 시간 <small>선택{fields.questions.length ? ` · 질문 ${fields.questions.length}개` : ''}</small><ChevronDown size={16}/></summary><div className="group-form-fields"><label>자기소개 <small>선택</small><textarea aria-label="가입 인사" value={draft.introduction} maxLength={500} rows={3} placeholder="함께하고 싶은 활동이나 편한 인사를 남겨주세요." onChange={event=>update({introduction:event.target.value})}/></label>
      {fields.questions.map(question=><label key={question.id}>{question.label} <small>선택</small><textarea value={draft.answers.find(item=>item.questionId===question.id)?.answer || ''} maxLength={500} rows={2} onChange={event=>{const value=event.target.value;update({answers:[...draft.answers.filter(item=>item.questionId!==question.id),{questionId:question.id,answer:value}]});}}/></label>)}
      <fieldset><legend>함께하기 편한 시간 <small>선택</small></legend>{fields.availableTimes.length>0 && <p className="group-form-hint">이 모임은 주로 {fields.availableTimes.map(id=>groupAvailabilityOptions.find(item=>item.id===id)?.label).filter(Boolean).join(' · ')}에 활동해요.</p>}<div className="group-form-chips">{groupAvailabilityOptions.map(item=><button type="button" key={item.id} aria-pressed={draft.availableTimes.includes(item.id)} onClick={()=>update({availableTimes:draft.availableTimes.includes(item.id)?draft.availableTimes.filter(id=>id!==item.id):[...draft.availableTimes,item.id]})}>{draft.availableTimes.includes(item.id)&&<Check size={14}/>} {item.label}</button>)}</div></fieldset>
    </div></details></div><details className="group-join-guide" open><summary>모임 가입 안내</summary><p>{profile.joinGuide}</p></details><label className="group-rule-check"><input type="checkbox" checked={draft.rulesAccepted} onChange={event=>update({rulesAccepted:event.target.checked})}/><span>모임 소개와 가입 안내를 확인했어요.</span></label>{error&&<p role="alert" className="group-form-error">{error}</p>}<button className="tg-primary" type="submit" disabled={busy}>{busy?'처리 중…':direct?'확인하고 가입하기':'가입 신청 보내기'}</button>
  </form>;
}
