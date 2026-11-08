import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { togetherId, type GroupKind, type GroupTopic } from './model';
import { topicOptions } from './discovery';
import { getGroupSubtopic, groupSubtopicsFor } from './groupTaxonomy';
import { groupDistrictOptions, groupRegionOptions } from './groupRegions';
import { groupAvailabilityOptions } from './groupJoining';
import { applyGroupIntroductionDraft, buildGroupIntroductionDraft, groupCreationSubtopicLimit, normalizeGroupCreationDraft, validateGroupCreationBasics, validateGroupCreationDraft, type GroupCreationDraft, type GroupCreationInitial, type GroupIntroductionAnswers } from './groupCreation';
import './group-creation.css';

export interface GroupCreationFormProps {
  initial?: GroupCreationInitial;
  onSubmit: (draft: GroupCreationDraft) => boolean | Promise<boolean>;
  onDraftChange?: (draft: GroupCreationDraft) => void;
  mode?: 'CREATE' | 'EDIT';
}
const kinds: Array<{id:GroupKind;label:string}> = [{id:'HOBBY',label:'취미·지역'},{id:'FAMILY',label:'가족'},{id:'FRIENDS',label:'친구'},{id:'GUIDE',label:'가이드'}];
export default function GroupCreationForm({ initial, onSubmit, onDraftChange, mode = 'CREATE' }: GroupCreationFormProps) {
  const [draft,setDraft] = useState(() => normalizeGroupCreationDraft(initial));
  const [maxSubtopics] = useState(() => groupCreationSubtopicLimit(initial, mode));
  const [step,setStep] = useState(0);
  const [answers,setAnswers] = useState<GroupIntroductionAnswers>(()=>({who:'',activities:'',atmosphere:'',purpose:initial?.purpose || ''}));
  const [preview,setPreview] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const lock=useRef(false), notify=useRef(onDraftChange), titleRef=useRef<HTMLHeadingElement>(null);
  notify.current=onDraftChange;
  useEffect(()=>{notify.current?.(draft);},[draft]);
  useEffect(()=>{titleRef.current?.focus();},[step]);
  const update = (value: Partial<GroupCreationDraft>) => { setDraft(current=>({...current,...value}));setError(''); };
  const category = topicOptions.find(item=>item.id===draft.categoryId);
  const regions = groupRegionOptions(draft.region ? [draft.region] : []);
  const districts = groupDistrictOptions(draft.region,draft.district ? [draft.district] : []);
  const changeCategory = (value:GroupTopic) => update({categoryId:value,topics:[value],subcategoryIds:[]});
  const next = () => {try {validateGroupCreationBasics(draft,maxSubtopics);if(step===1)validateGroupCreationDraft(draft,maxSubtopics);setError('');setStep(current=>Math.min(2,current+1));}catch(cause){setError(cause instanceof Error?cause.message:'입력을 확인해 주세요.');}};
  const submit = async () => {
    if(lock.current)return;
    let value:GroupCreationDraft;try{value=validateGroupCreationDraft(draft,maxSubtopics);}catch(cause){setError(cause instanceof Error?cause.message:'입력을 확인해 주세요.');return;}
    lock.current=true;setBusy(true);setError('');
    try {if(!await onSubmit(value))setError('만들지 못했어요. 입력은 유지했으니 다시 확인해 주세요.');}
    catch(cause){setError(cause instanceof Error?cause.message:'만들지 못했어요. 잠시 후 다시 시도해 주세요.');}
    finally {lock.current=false;setBusy(false);}
  };
  return <div className="group-creation-form"><ol className="group-form-progress" aria-label="모임 만들기 단계">{['기본 정보','소개 작성','확인'].map((label,index)=><li key={label} aria-current={step===index?'step':undefined}><span>{index+1}</span>{label}</li>)}</ol>
    <h2 ref={titleRef} tabIndex={-1}>{step===0?mode==='EDIT'?'모임 정보를 정리해요':'어떤 모임을 만들까요?':step===1?'어떤 시간을 함께할까요?':mode==='EDIT'?'이 내용으로 저장할까요?':'이 내용으로 만들까요?'}</h2>
    {step===0 && <div className="group-form-fields"><label>모임 이름<input aria-label="모임 이름" value={draft.name} maxLength={60} onChange={event=>update({name:event.target.value})} placeholder="우리 모임의 이름" required/></label>
      <div className="group-form-two"><label>모임 관계<select value={draft.kind} onChange={event=>update({kind:event.target.value as GroupKind})}>{kinds.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>가입 방식<select aria-label="새 모임 가입 방식" value={draft.joinMode} onChange={event=>update({joinMode:event.target.value as GroupCreationDraft['joinMode']})}><option value="DIRECT">바로 가입</option><option value="APPROVAL">승인 후 가입</option></select></label></div>
      <label>주요 관심사<select aria-label="모임 주요 관심사" value={draft.categoryId} onChange={event=>changeCategory(event.target.value as GroupTopic)}>{topicOptions.map(item=><option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}</select></label>
      {groupSubtopicsFor(draft.categoryId).length>0 && <fieldset><legend>세부 관심사 <small>선택 · 최대 {maxSubtopics}개</small></legend><div className="group-form-chips">{groupSubtopicsFor(draft.categoryId).map(item=><button type="button" aria-pressed={draft.subcategoryIds.includes(item.id)} key={item.id} onClick={()=>{if(!draft.subcategoryIds.includes(item.id)&&draft.subcategoryIds.length>=maxSubtopics)return setError(`세부 관심사는 최대 ${maxSubtopics}개 선택할 수 있어요.`);update({subcategoryIds:draft.subcategoryIds.includes(item.id)?draft.subcategoryIds.filter(id=>id!==item.id):[...draft.subcategoryIds,item.id]});}}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div>{draft.subcategoryIds.some(id=>getGroupSubtopic(id)?.parent!==draft.categoryId)&&<><small>다른 관심사에서 선택한 항목 · 누르면 해제해요</small><div className="group-form-chips">{draft.subcategoryIds.map(id=>getGroupSubtopic(id)).filter(item=>item&&item.parent!==draft.categoryId).map(item=>item&&<button type="button" aria-pressed="true" key={item.id} onClick={()=>update({subcategoryIds:draft.subcategoryIds.filter(id=>id!==item.id)})}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div></>}</fieldset>}
      <div className="group-form-two"><label>함께할 지역<select aria-label="모임 지역" value={draft.region} onChange={event=>update({region:event.target.value,district:''})}><option value="">나중에 정하기</option>{regions.map(region=><option key={region} value={region}>{region}</option>)}</select></label><label>동네·구·군 <small>선택</small><select aria-label="모임 동네·구·군" value={draft.district} disabled={!draft.region} onChange={event=>update({district:event.target.value})}><option value="">지역 전체</option>{districts.map(district=><option key={district} value={district}>{district}</option>)}</select></label></div>
    </div>}
    {step===1 && <div className="group-form-fields"><label>모임 소개 <small>선택 · 직접 작성할 수 있어요</small><textarea aria-label="모임 소개" value={draft.introduction} maxLength={2000} rows={5} onChange={event=>update({introduction:event.target.value})} placeholder="어떤 사람들과 무엇을 함께하고 싶으세요?"/></label>
      <details className="group-intro-helper"><summary>소개 작성 도움<ChevronDown size={17}/></summary><div className="group-form-fields"><p>적은 답변을 소개 문장으로 모아요. 초안을 고친 뒤 직접 적용할 수 있어요.</p>{([{id:'who',label:'누구와 함께하고 싶나요?',placeholder:'함께하고 싶은 사람'}, {id:'activities',label:'언제, 무엇을 함께하나요?',placeholder:'하고 싶은 일과 만나는 때'}, {id:'atmosphere',label:'어떤 분위기를 원하나요?',placeholder:'서로 어떻게 함께하면 좋을까요?'}, {id:'purpose',label:'이 모임을 만든 이유는요?',placeholder:'개설 목적'}] as const).map(item=><label key={item.id}>{item.label}<textarea value={answers[item.id]} maxLength={400} rows={2} placeholder={item.placeholder} onChange={event=>{const value=event.target.value;setAnswers(current=>({...current,[item.id]:value}));if(item.id==='purpose')update({purpose:value});}}/></label>)}<button type="button" onClick={()=>{try{setPreview(buildGroupIntroductionDraft(answers));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'답변을 확인해 주세요.');}}}>답변으로 초안 정리</button>{preview && <div className="group-intro-preview"><label>적용할 소개 초안<textarea value={preview} maxLength={2000} rows={7} onChange={event=>setPreview(event.target.value)}/></label><button type="button" className="tg-primary" onClick={()=>{setDraft(current=>applyGroupIntroductionDraft(current,preview));setError('');setPreview('');}}>이 소개 적용</button><small>기존 모임 이름·종류·가입 방식은 그대로 유지해요.</small></div>}</div></details>
      <details className="group-join-settings"><summary>새 멤버 맞이하기 <span>선택</span><ChevronDown size={17}/></summary><div className="group-form-fields"><label>환영 인사<textarea value={draft.joinFields.welcome} maxLength={500} rows={2} onChange={event=>update({joinFields:{...draft.joinFields,welcome:event.target.value}})} placeholder="새 멤버에게 전할 첫 인사"/></label><fieldset><legend>주로 활동하는 시간 <small>선택</small></legend><div className="group-form-chips">{groupAvailabilityOptions.map(item=><button type="button" key={item.id} aria-pressed={draft.joinFields.availableTimes.includes(item.id)} onClick={()=>update({joinFields:{...draft.joinFields,availableTimes:draft.joinFields.availableTimes.includes(item.id)?draft.joinFields.availableTimes.filter(id=>id!==item.id):[...draft.joinFields.availableTimes,item.id]}})}>{item.label}</button>)}</div></fieldset><fieldset><legend>새 멤버에게 물어볼 질문 <small>선택 · 최대 3개</small></legend><p className="group-form-hint">답변은 모두 선택이에요. 함께할 활동을 알아가는 질문을 적어 주세요.</p>{draft.joinFields.questions.map((question,index)=><div className="group-question-row" key={question.id}><input aria-label={`새 멤버 질문 ${index+1}`} value={question.label} maxLength={120} placeholder="예: 함께 해보고 싶은 활동이 있나요?" onChange={event=>update({joinFields:{...draft.joinFields,questions:draft.joinFields.questions.map(item=>item.id===question.id?{...item,label:event.target.value}:item)}})}/><button type="button" aria-label={`새 멤버 질문 ${index+1} 삭제`} onClick={()=>update({joinFields:{...draft.joinFields,questions:draft.joinFields.questions.filter(item=>item.id!==question.id)}})}><Trash2 size={17}/></button></div>)}{draft.joinFields.questions.length<3 && <button type="button" onClick={()=>update({joinFields:{...draft.joinFields,questions:[...draft.joinFields.questions,{id:togetherId('join-question'),label:''}]}})}><Plus size={16}/>질문 추가</button>}</fieldset></div></details>
    </div>}
    {step===2 && <div className="group-form-review"><h3>{draft.name}</h3><dl><div><dt>관계</dt><dd>{kinds.find(item=>item.id===draft.kind)?.label}</dd></div><div><dt>관심사</dt><dd>{category?.label}{draft.subcategoryIds.length?` · ${draft.subcategoryIds.map(id=>getGroupSubtopic(id)?.label).filter(Boolean).join(' · ')}`:''}</dd></div><div><dt>지역</dt><dd>{[draft.region,draft.district].filter(Boolean).join(' · ')||'나중에 정하기'}</dd></div><div><dt>가입</dt><dd>{draft.joinMode==='DIRECT'?'바로 가입':'운영진 승인 후 가입'}</dd></div></dl><p>{draft.introduction||'소개를 나중에 작성할 수 있어요.'}</p><small>새 멤버 질문 {draft.joinFields.questions.filter(item=>item.label.trim()).length}개 · {draft.joinFields.welcome?'환영 인사 있음':'환영 인사 미작성'}</small><div className="group-form-notice"><Check size={17}/><p>{mode==='EDIT'?'최종 저장한 내용이 모임에 반영돼요. 공개 중인 모임은 공개 소개에도 반영돼요.':'처음에는 비공개로 만들어요. 공개 모집은 모임 설정에서 직접 선택해요.'}</p></div></div>}
    {error && <p role="alert" className="group-form-error">{error}</p>}<div className="group-form-footer">{step>0 && <button type="button" aria-label="이전 단계" disabled={busy} onClick={()=>{setError('');setStep(current=>current-1);}}><ArrowLeft size={18}/></button>}<button type="button" className="tg-primary" disabled={busy} onClick={()=>step===2?void submit():next()}>{step===2?busy?'저장 중…':mode==='EDIT'?'변경 저장':'모임 만들기':'다음'}</button></div>
  </div>;
}
