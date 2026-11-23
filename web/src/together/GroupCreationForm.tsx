import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, MapPin, Plus, Sparkles, Trash2 } from 'lucide-react';
import { togetherId, type GroupKind, type GroupTopic } from './model';
import { topicOptions } from './discovery';
import { getGroupSubtopic, groupSubtopicsFor } from './groupTaxonomy';
import GroupLocalityFields from './GroupLocalityFields';
import { groupAvailabilityOptions } from './groupJoining';
import { applyGroupIntroductionDraft, buildGroupIntroductionDraft, groupCreationResumePhase, groupCreationSubtopicLimit, normalizeGroupCreationDraft, validateGroupCreationBasics, validateGroupCreationDraft, type GroupCreationDraft, type GroupCreationInitial, type GroupCreationPhase, type GroupIntroductionAnswers } from './groupCreation';
import { configuredPlanningAiEndpoint, requestGroupDraftAi, type GroupAiCopy } from '../planningAiService';
import { interpretCreationPrompt } from './creationPlanner';
import { groupRegionNeedsDistrict, parseGroupLocality } from './groupRegions';
import './group-creation.css';

export interface GroupCreationFormProps {
  initial?: GroupCreationInitial;
  onSubmit: (draft: GroupCreationDraft) => boolean | Promise<boolean>;
  onDraftChange?: (draft: GroupCreationDraft, phase?: GroupCreationPhase) => void;
  resumePhase?: GroupCreationPhase;
  onAssist?: (draft: GroupCreationDraft) => void;
  mode?: 'CREATE' | 'EDIT';
}
const kinds: Array<{id:GroupKind;label:string}> = [{id:'HOBBY',label:'취미·지역'},{id:'FAMILY',label:'가족'},{id:'FRIENDS',label:'친구'},{id:'GUIDE',label:'가이드'}];
const planningEndpoint = configuredPlanningAiEndpoint(import.meta.env.VITE_PLANNING_AI_ENDPOINT);

/** Creation is one editable private draft; existing group editing keeps its current contract. */
export default function GroupCreationForm(props: GroupCreationFormProps) {
  return props.mode === 'EDIT' ? <DetailedGroupCreationForm {...props}/> : <QuickGroupCreationForm {...props}/>;
}

function QuickGroupCreationForm({ initial, onSubmit, onDraftChange, resumePhase }: GroupCreationFormProps) {
  const [draft, setDraft] = useState(() => normalizeGroupCreationDraft(initial));
  const [ready, setReady] = useState(() => groupCreationResumePhase(initial, resumePhase) === 'DRAFT');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [aiPending, setAiPending] = useState(false), [aiError, setAiError] = useState(''), [aiIntroduction, setAiIntroduction] = useState('');
  const [aiPromptOpen,setAiPromptOpen] = useState(false), [aiPrompt,setAiPrompt] = useState(''), [aiGroupProposal,setAiGroupProposal] = useState<(GroupAiCopy&{region:string})|null>(null);
  const [aiApplied,setAiApplied] = useState(false);
  const aiRequest = useRef<AbortController | null>(null);
  const notify = useRef(onDraftChange), lock = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const locationDetails = useRef<HTMLDetailsElement>(null);
  const needsParent = Boolean(draft.region.trim() && draft.neighborhood?.trim() && groupRegionNeedsDistrict(draft.region) && !draft.district.trim());
  const maxSubtopics = groupCreationSubtopicLimit(initial, 'CREATE');
  notify.current = onDraftChange;
  useEffect(() => { notify.current?.(draft, ready ? 'DRAFT' : 'INPUT'); }, [draft, ready]);
  useEffect(() => { if (ready) heading.current?.focus({preventScroll:true}); }, [ready]);
  useEffect(() => {
    if (!ready || !needsParent || !locationDetails.current) return;
    locationDetails.current.open=true;
    locationDetails.current.querySelector<HTMLSelectElement>('select[aria-label="모임 시·군·구"]')?.focus();
  }, [ready,needsParent,draft.neighborhood]);
  useEffect(() => () => { aiRequest.current?.abort(); aiRequest.current = null; }, []);
  const cancelAi = () => { aiRequest.current?.abort(); aiRequest.current = null; setAiPending(false); };
  const update = (value: Partial<GroupCreationDraft>) => {
    cancelAi(); setAiIntroduction(''); setAiGroupProposal(null); setAiError('');
    setDraft(current => ({...current,...value})); setError('');
  };
  const updateLocality = (value: {region:string;district:string;neighborhood:string}) => {
    // The person supplies the missing parent; keep the town they already wrote instead of clearing it.
    update({...value,neighborhood:needsParent&&value.region===draft.region&&value.district.trim()?draft.neighborhood:value.neighborhood});
  };
  const aiRegion = [draft.region.trim(), draft.district.trim(), draft.neighborhood?.trim()].filter(Boolean).join(' ');
  const aiUnavailable = !planningEndpoint ? 'AI 연결 후 사용할 수 있어요.'
    : !aiRegion ? '활동 지역을 정하면 소개 다듬기를 사용할 수 있어요.'
      : aiRegion.length > 80 ? '활동 지역을 80자 이내로 정리해 주세요.' : '';
  const refineIntroduction = async () => {
    if (lock.current || aiRequest.current || aiUnavailable) return;
    try { validateGroupCreationBasics(draft, maxSubtopics); }
    catch (cause) { setAiError(cause instanceof Error ? cause.message : '모임 이름을 확인해 주세요.'); return; }
    const controller = new AbortController();
    aiRequest.current = controller; setAiPending(true); setAiError(''); setAiIntroduction('');
    const active = () => aiRequest.current === controller && !controller.signal.aborted;
    try {
      const head = `모임 이름: ${draft.name.trim()}\n관계: ${kinds.find(item => item.id === draft.kind)?.label || draft.kind}\n관심사: ${draft.topics.map(id => topicOptions.find(item => item.id === id)?.label || id).join(', ')}\n현재 소개: `;
      const instruction = '\n이름과 관계를 유지하며 제공한 내용으로 소개만 다듬어 주세요. 새로운 일정, 정원, 규칙이나 장소는 만들지 마세요.';
      // The existing group endpoint accepts 600 characters and needs no place catalogue.
      const prompt = `${head}${draft.introduction.slice(0, Math.max(0, 600 - head.length - instruction.length))}${instruction}`;
      const brief = interpretCreationPrompt(prompt, { purpose:'GROUP', region:aiRegion, topics:[...draft.topics] });
      const result = await requestGroupDraftAi(planningEndpoint, brief, controller.signal);
      if (!active()) return;
      if (!result) throw new Error('소개 제안을 받지 못했어요. 내용을 조금 더 적거나 직접 고쳐 주세요.');
      setAiIntroduction(result.introduction);
    } catch (cause) {
      if (active()) setAiError(cause instanceof Error ? cause.message : '소개를 다듬지 못했어요. 작성한 내용은 그대로예요.');
    } finally {
      if (active()) { aiRequest.current = null; setAiPending(false); }
    }
  };
  const proposeGroup = async () => {
    if (lock.current || aiRequest.current || !planningEndpoint) return;
    if (!aiPrompt.trim()) { setAiError('함께하고 싶은 활동을 한 줄로 적어 주세요.'); return; }
    const inferred=interpretCreationPrompt(aiPrompt.trim(),{purpose:'GROUP'});
    const instruction='\n제공하지 않은 날짜·인원·장소는 확정하지 말고 첫 활동 아이디어로만 제안해 주세요.';
    const header=draft.name.trim()?`모임 이름 유지: ${draft.name.trim()}\n`:'';
    const brief=interpretCreationPrompt(`${header}${aiPrompt.trim().slice(0,600-header.length-instruction.length)}${instruction}`, {purpose:'GROUP',region:inferred.region||aiRegion,topics:[...draft.topics]});
    if (!brief.region.trim()) { setAiError('문장에 지역을 적거나 활동 지역을 먼저 정해 주세요.'); return; }
    const controller=new AbortController();aiRequest.current=controller;setAiPending(true);setAiError('');setAiGroupProposal(null);
    const active=()=>aiRequest.current===controller&&!controller.signal.aborted;
    try {
      const result=await requestGroupDraftAi(planningEndpoint,brief,controller.signal);
      if(!active())return;
      if(!result)throw new Error('조건에 맞는 제안을 받지 못했어요. 한 줄을 고치거나 기본 초안으로 시작해 주세요.');
      const suffix=result.firstActivityIdea?.trim()?`\n\n첫 활동 아이디어 · 일정 미정\n${result.firstActivityIdea.trim()}`:'';
      setAiGroupProposal({...result,name:draft.name.trim()||result.name.slice(0,60),introduction:result.introduction.slice(0,2000-suffix.length),region:brief.region});
    } catch(cause){if(active())setAiError(cause instanceof Error?cause.message:'AI 제안을 받지 못했어요. 입력은 그대로예요.');}
    finally{if(active()){aiRequest.current=null;setAiPending(false);}}
  };
  const applyGroupProposal = () => {
    if(!aiGroupProposal)return;
    const idea=aiGroupProposal.firstActivityIdea?.trim();
    const suffix=idea?`\n\n첫 활동 아이디어 · 일정 미정\n${idea}`:'';
    const area=parseGroupLocality(aiGroupProposal.region);
    update({name:aiGroupProposal.name,introduction:aiGroupProposal.introduction+suffix,region:area.region,district:area.district,neighborhood:area.neighborhood??''});
    setAiPromptOpen(false);setReady(true);setAiApplied(true);
  };
  const introduction = () => draft.kind === 'FAMILY' ? '가족끼리 약속과 사진을 모으고, 함께할 일정을 나눠요.'
    : draft.kind === 'FRIENDS' ? '친구들과 약속을 정하고 함께한 사진과 이야기를 모아요.'
      : draft.kind === 'GUIDE' ? '함께할 일정을 준비하고 참여 안내와 기록을 나눠요.'
        : `${draft.name.trim()}에서 함께할 이야기를 나누고, 약속과 사진을 모아요.`;
  const makeDraft = () => {
    try {
      // Only the visible name belongs to this first action. Other fields can be fixed in the draft.
      if (!draft.name.trim() || draft.name.length > 60) throw new Error('모임 이름을 60자 이내로 적어 주세요.');
      cancelAi(); setAiPromptOpen(false); setAiGroupProposal(null); setAiError('');
      setDraft(current => ({...current,name:current.name.trim(),introduction:current.introduction.trim() || introduction()}));
      setReady(true); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '모임 이름을 확인해 주세요.'); }
  };
  const save = async () => {
    if (lock.current) return;
    cancelAi();
    let value: GroupCreationDraft;
    try { value = validateGroupCreationDraft(draft, maxSubtopics); }
    catch (cause) {
      setError(needsParent?`${draft.neighborhood}의 시·군·구만 선택해 주세요. 이름과 소개는 그대로예요.`:cause instanceof Error ? cause.message : '입력을 확인해 주세요.');
      if(needsParent&&locationDetails.current){locationDetails.current.open=true;locationDetails.current.querySelector<HTMLSelectElement>('select[aria-label="모임 시·군·구"]')?.focus();}
      return;
    }
    lock.current = true; setBusy(true); setError('');
    try { if (!await onSubmit(value)) setError('저장하지 못했어요. 초안은 유지했으니 다시 시도해 주세요.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 초안은 유지했어요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <form className="group-creation-form group-quick-create" data-draft-ready={ready} aria-label="모임 만들기" onSubmit={event => { event.preventDefault(); if (ready) void save(); else makeDraft(); }}>
    <fieldset className="group-quick-create__body" disabled={busy}>
      <header className="group-quick-create__heading"><h2 ref={heading} tabIndex={-1}>{ready ? '모임 초안' : '이름부터 정해요'}</h2>{ready ? aiApplied && <small>AI 제안 적용 · 저장 전</small> : <p>소개와 운영 설정은 초안에서 정해요.</p>}</header>
      <label className="group-quick-create__label">모임 이름<input aria-label="모임 이름" value={draft.name} maxLength={60} onChange={event => update({name:event.target.value})} placeholder="예: 우리 가족, 주말 산책 친구들" required/></label>
      {planningEndpoint && (!ready || aiPromptOpen) && <button type="button" className="group-quick-create__ai-entry" aria-expanded={aiPromptOpen} onClick={()=>{cancelAi();setAiPromptOpen(value=>!value);setAiError('');}}><Sparkles size={17}/><span>한 줄로 AI 모임 초안 받기</span><ChevronDown size={17}/></button>}
      {!planningEndpoint && !ready && <p className="group-form-hint">AI 제안은 연결 후 사용할 수 있어요.</p>}
      {planningEndpoint && aiPromptOpen && <section className="group-quick-create__ai-brief" aria-label="한 줄로 모임 초안 제안" aria-busy={aiPending}>
        <small>이름을 정하지 않아도 돼요. 지역과 함께하고 싶은 활동을 적어 주세요.</small>
        <label className="group-quick-create__label">어떤 모임을 함께하고 싶나요?<textarea aria-label="AI 모임 요청" value={aiPrompt} maxLength={500} rows={2} placeholder="예: 인천 주안동에서 주말에 산책하고 카페에 갈 친구 모임" onChange={event=>{cancelAi();setAiPrompt(event.target.value);setAiGroupProposal(null);setAiError('');}}/></label>
        <button type="button" className="group-quick-create__assist" disabled={aiPending||busy} onClick={()=>void proposeGroup()}><Sparkles size={16}/>{aiPending?'AI 초안 준비 중…':'AI 초안 제안받기'}</button>
        <small>이름·소개와 첫 활동 아이디어를 제안해요. 제안을 적용해도 모임은 아직 저장되지 않아요.</small>
        {aiPending&&<button type="button" onClick={cancelAi}>요청 취소</button>}
        {aiError&&<p role="alert" className="group-form-error">{aiError}</p>}
        {aiGroupProposal&&<section className="group-quick-create__ai-preview" aria-label="적용 전 AI 모임 초안"><strong>{aiGroupProposal.name}</strong><small>{aiGroupProposal.region}</small><p>{aiGroupProposal.introduction}</p>{aiGroupProposal.firstActivityIdea&&<p><small>첫 활동 아이디어 · 일정 미정</small><br/>{aiGroupProposal.firstActivityIdea}</p>}<div><button type="button" onClick={applyGroupProposal}>이 초안으로 계속</button><button type="button" onClick={()=>setAiGroupProposal(null)}>지금 입력 유지</button></div></section>}
      </section>}
      {ready && <>
        <details ref={locationDetails} open={needsParent||undefined} className="group-quick-create__location"><summary><MapPin size={17}/><span><small>활동 지역</small><strong>{[draft.region,draft.district,draft.neighborhood].filter(Boolean).join(' ') || '미정 · 나중에 정해도 돼요'}</strong></span><span>변경</span><ChevronDown size={16}/></summary>{needsParent&&<p className="group-form-hint" role="status">{draft.neighborhood}의 시·군·구만 선택해 주세요. 이름과 소개는 그대로예요.</p>}<GroupLocalityFields region={draft.region} district={draft.district} neighborhood={draft.neighborhood} onChange={updateLocality}/></details>
        <section className="group-quick-create__draft" aria-label="수정할 모임 초안">
          <label className="group-quick-create__label">누구와 함께하나요?<select aria-label="모임 관계" value={draft.kind} onChange={event => update({kind:event.target.value as GroupKind})}>{kinds.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="group-quick-create__label">모임 소개<textarea aria-label="모임 소개" value={draft.introduction} maxLength={2000} rows={3} onChange={event => update({introduction:event.target.value})}/></label>
          {planningEndpoint && !aiPromptOpen && <details className="group-quick-create__ai-options"><summary><Sparkles size={16}/>AI로 소개 다듬기 <small>선택</small><ChevronDown size={16}/></summary><div className="group-quick-create__ai" aria-busy={aiPending}>
            <button type="button" className="group-quick-create__assist" disabled={aiPending || busy || Boolean(aiUnavailable)} onClick={() => void refineIntroduction()}><Sparkles size={16}/><span>{aiPending ? '소개를 다듬는 중…' : 'AI로 소개 다듬기'}</span></button>
            <small>{aiUnavailable || '이름·관계·활동 지역과 소개로 제안해요. 적용 전에는 내용을 바꾸지 않아요.'}</small>
            {aiPending && <p role="status">계속 수정해도 돼요. 내용을 바꾸면 현재 요청은 취소돼요.</p>}
            {aiError && <p role="alert" className="group-form-error">{aiError}</p>}
            {aiIntroduction && <section className="group-quick-create__ai-preview" aria-label="AI 소개 제안">
              <label className="group-quick-create__label">AI가 제안한 소개<textarea aria-label="적용할 AI 소개" value={aiIntroduction} rows={4} maxLength={2000} onChange={event => setAiIntroduction(event.target.value)}/></label>
              <small>소개만 바꿔요. 이름·관계·가입 설정은 그대로 유지해요.</small>
              <div><button type="button" disabled={!aiIntroduction.trim()} onClick={() => update({introduction:aiIntroduction.trim()})}>이 소개 적용</button><button type="button" onClick={() => { setAiIntroduction(''); setAiError(''); }}>제안 닫기</button></div>
            </section>}
          </div></details>}
        </section>
        <details className="group-quick-create__options"><summary>관심사 더 정하기 <small>선택</small><ChevronDown size={17}/></summary><div className="group-form-fields">
          <label>주요 관심사<select aria-label="모임 주요 관심사" value={draft.categoryId} onChange={event => { const categoryId = event.target.value as GroupTopic; update({categoryId,topics:[categoryId],subcategoryIds:[]}); }}>{topicOptions.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}</select></label>
          <fieldset><legend>세부 관심사 <small>선택 · 최대 {maxSubtopics}개</small></legend><div className="group-form-chips">{groupSubtopicsFor(draft.categoryId).map(item => <button type="button" key={item.id} aria-pressed={draft.subcategoryIds.includes(item.id)} onClick={() => {
            if (!draft.subcategoryIds.includes(item.id) && draft.subcategoryIds.length >= maxSubtopics) return setError(`세부 관심사는 최대 ${maxSubtopics}개 선택할 수 있어요.`);
            update({subcategoryIds:draft.subcategoryIds.includes(item.id) ? draft.subcategoryIds.filter(id => id !== item.id) : [...draft.subcategoryIds,item.id]});
          }}>{item.emoji} {item.label}</button>)}</div></fieldset>
          {draft.subcategoryIds.some(id => getGroupSubtopic(id)?.parent !== draft.categoryId) && <div className="group-form-chips" aria-label="다른 관심사에서 고른 항목">{draft.subcategoryIds.flatMap(id => { const item = getGroupSubtopic(id); return item && item.parent !== draft.categoryId ? [<button type="button" key={id} aria-pressed="true" onClick={() => update({subcategoryIds:draft.subcategoryIds.filter(value => value !== id)})}>{item.emoji} {item.label} · 해제</button>] : []; })}</div>}
        </div></details>
        <details className="group-quick-create__options"><summary>가입·운영 설정 <small>선택</small><ChevronDown size={17}/></summary><div className="group-form-fields">
          <label>가입 방식<select aria-label="새 모임 가입 방식" value={draft.joinMode} onChange={event => update({joinMode:event.target.value as GroupCreationDraft['joinMode']})}><option value="DIRECT">바로 가입</option><option value="APPROVAL">승인 후 가입</option></select><small>나중에 공개 모집을 시작할 때 사용할 방식이에요.</small></label>
          <label>환영 인사<textarea aria-label="환영 인사" value={draft.joinFields.welcome} maxLength={500} rows={2} onChange={event => update({joinFields:{...draft.joinFields,welcome:event.target.value}})} placeholder="새 멤버에게 전할 인사"/></label>
          <fieldset><legend>주로 활동하는 시간 <small>선택</small></legend><div className="group-form-chips">{groupAvailabilityOptions.map(item => <button type="button" key={item.id} aria-pressed={draft.joinFields.availableTimes.includes(item.id)} onClick={() => update({joinFields:{...draft.joinFields,availableTimes:draft.joinFields.availableTimes.includes(item.id) ? draft.joinFields.availableTimes.filter(id => id !== item.id) : [...draft.joinFields.availableTimes,item.id]}})}>{item.label}</button>)}</div></fieldset>
          <fieldset><legend>새 멤버에게 물어볼 질문 <small>선택 · 최대 3개</small></legend>{draft.joinFields.questions.map((question,index) => <div className="group-question-row" key={question.id}><input aria-label={`새 멤버 질문 ${index+1}`} value={question.label} maxLength={120} onChange={event => update({joinFields:{...draft.joinFields,questions:draft.joinFields.questions.map(item => item.id === question.id ? {...item,label:event.target.value} : item)}})}/><button type="button" aria-label={`새 멤버 질문 ${index+1} 삭제`} onClick={() => update({joinFields:{...draft.joinFields,questions:draft.joinFields.questions.filter(item => item.id !== question.id)}})}><Trash2 size={17}/></button></div>)}{draft.joinFields.questions.length < 3 && <button type="button" onClick={() => update({joinFields:{...draft.joinFields,questions:[...draft.joinFields.questions,{id:togetherId('join-question'),label:''}]}})}><Plus size={16}/>질문 추가</button>}</fieldset>
        </div></details>
      </>}
      {error && <p role="alert" className="group-form-error">{error}</p>}
    </fieldset>
    <div className="group-quick-create__save">
      {ready && <p className="group-quick-create__privacy"><Check size={16}/><span>비공개로 만들어요. 초대와 공개 모집은 만든 뒤 선택해요.</span></p>}
      <button type="submit" className="tg-primary" disabled={busy}>{busy ? '저장 중…' : ready ? '모임 만들기' : '초안 만들기'}</button>
    </div>
  </form>;
}

function DetailedGroupCreationForm({ initial, onSubmit, onDraftChange, onAssist, mode = 'EDIT' }: GroupCreationFormProps) {
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
    {step===0 && <div className="group-form-fields">
      {mode==='CREATE' && onAssist && <button type="button" className="tg-creation-entry" onClick={()=>onAssist(draft)}><Sparkles size={18} aria-hidden="true"/><span><strong>AI로 모임 초안 만들기</strong><small>하고 싶은 활동을 적고 모임 소개와 첫 활동을 검토해요.</small></span><ChevronRight size={17} aria-hidden="true"/></button>}
      <label>모임 이름<input aria-label="모임 이름" value={draft.name} maxLength={60} onChange={event=>update({name:event.target.value})} placeholder="우리 모임의 이름" required/></label>
      <div className="group-form-two"><label>모임 관계<select value={draft.kind} onChange={event=>update({kind:event.target.value as GroupKind})}>{kinds.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>가입 방식<select aria-label="새 모임 가입 방식" value={draft.joinMode} onChange={event=>update({joinMode:event.target.value as GroupCreationDraft['joinMode']})}><option value="DIRECT">바로 가입</option><option value="APPROVAL">승인 후 가입</option></select></label></div>
      <label>주요 관심사<select aria-label="모임 주요 관심사" value={draft.categoryId} onChange={event=>changeCategory(event.target.value as GroupTopic)}>{topicOptions.map(item=><option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}</select></label>
      {groupSubtopicsFor(draft.categoryId).length>0 && <fieldset><legend>세부 관심사 <small>선택 · 최대 {maxSubtopics}개</small></legend><div className="group-form-chips">{groupSubtopicsFor(draft.categoryId).map(item=><button type="button" aria-pressed={draft.subcategoryIds.includes(item.id)} key={item.id} onClick={()=>{if(!draft.subcategoryIds.includes(item.id)&&draft.subcategoryIds.length>=maxSubtopics)return setError(`세부 관심사는 최대 ${maxSubtopics}개 선택할 수 있어요.`);update({subcategoryIds:draft.subcategoryIds.includes(item.id)?draft.subcategoryIds.filter(id=>id!==item.id):[...draft.subcategoryIds,item.id]});}}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div>{draft.subcategoryIds.some(id=>getGroupSubtopic(id)?.parent!==draft.categoryId)&&<><small>다른 관심사에서 선택한 항목 · 누르면 해제해요</small><div className="group-form-chips">{draft.subcategoryIds.map(id=>getGroupSubtopic(id)).filter(item=>item&&item.parent!==draft.categoryId).map(item=>item&&<button type="button" aria-pressed="true" key={item.id} onClick={()=>update({subcategoryIds:draft.subcategoryIds.filter(id=>id!==item.id)})}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div></>}</fieldset>}
      <GroupLocalityFields region={draft.region} district={draft.district} neighborhood={draft.neighborhood} onChange={update}/>
    </div>}
    {step===1 && <div className="group-form-fields"><label>모임 소개 <small>선택 · 직접 작성할 수 있어요</small><textarea aria-label="모임 소개" value={draft.introduction} maxLength={2000} rows={5} onChange={event=>update({introduction:event.target.value})} placeholder="어떤 사람들과 무엇을 함께하고 싶으세요?"/></label>
      <details className="group-intro-helper"><summary>소개 작성 도움<ChevronDown size={17}/></summary><div className="group-form-fields"><p>적은 답변을 소개 문장으로 모아요. 초안을 고친 뒤 직접 적용할 수 있어요.</p>{([{id:'who',label:'누구와 함께하고 싶나요?',placeholder:'함께하고 싶은 사람'}, {id:'activities',label:'언제, 무엇을 함께하나요?',placeholder:'하고 싶은 일과 만나는 때'}, {id:'atmosphere',label:'어떤 분위기를 원하나요?',placeholder:'서로 어떻게 함께하면 좋을까요?'}, {id:'purpose',label:'이 모임을 만든 이유는요?',placeholder:'개설 목적'}] as const).map(item=><label key={item.id}>{item.label}<textarea value={answers[item.id]} maxLength={400} rows={2} placeholder={item.placeholder} onChange={event=>{const value=event.target.value;setAnswers(current=>({...current,[item.id]:value}));if(item.id==='purpose')update({purpose:value});}}/></label>)}<button type="button" onClick={()=>{try{setPreview(buildGroupIntroductionDraft(answers));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'답변을 확인해 주세요.');}}}>답변으로 초안 정리</button>{preview && <div className="group-intro-preview"><label>적용할 소개 초안<textarea value={preview} maxLength={2000} rows={7} onChange={event=>setPreview(event.target.value)}/></label><button type="button" className="tg-primary" onClick={()=>{setDraft(current=>applyGroupIntroductionDraft(current,preview));setError('');setPreview('');}}>이 소개 적용</button><small>기존 모임 이름·종류·가입 방식은 그대로 유지해요.</small></div>}</div></details>
      <details className="group-join-settings"><summary>새 멤버 맞이하기 <span>선택</span><ChevronDown size={17}/></summary><div className="group-form-fields"><label>환영 인사<textarea value={draft.joinFields.welcome} maxLength={500} rows={2} onChange={event=>update({joinFields:{...draft.joinFields,welcome:event.target.value}})} placeholder="새 멤버에게 전할 첫 인사"/></label><fieldset><legend>주로 활동하는 시간 <small>선택</small></legend><div className="group-form-chips">{groupAvailabilityOptions.map(item=><button type="button" key={item.id} aria-pressed={draft.joinFields.availableTimes.includes(item.id)} onClick={()=>update({joinFields:{...draft.joinFields,availableTimes:draft.joinFields.availableTimes.includes(item.id)?draft.joinFields.availableTimes.filter(id=>id!==item.id):[...draft.joinFields.availableTimes,item.id]}})}>{item.label}</button>)}</div></fieldset><fieldset><legend>새 멤버에게 물어볼 질문 <small>선택 · 최대 3개</small></legend><p className="group-form-hint">답변은 모두 선택이에요. 함께할 활동을 알아가는 질문을 적어 주세요.</p>{draft.joinFields.questions.map((question,index)=><div className="group-question-row" key={question.id}><input aria-label={`새 멤버 질문 ${index+1}`} value={question.label} maxLength={120} placeholder="예: 함께 해보고 싶은 활동이 있나요?" onChange={event=>update({joinFields:{...draft.joinFields,questions:draft.joinFields.questions.map(item=>item.id===question.id?{...item,label:event.target.value}:item)}})}/><button type="button" aria-label={`새 멤버 질문 ${index+1} 삭제`} onClick={()=>update({joinFields:{...draft.joinFields,questions:draft.joinFields.questions.filter(item=>item.id!==question.id)}})}><Trash2 size={17}/></button></div>)}{draft.joinFields.questions.length<3 && <button type="button" onClick={()=>update({joinFields:{...draft.joinFields,questions:[...draft.joinFields.questions,{id:togetherId('join-question'),label:''}]}})}><Plus size={16}/>질문 추가</button>}</fieldset></div></details>
    </div>}
    {step===2 && <div className="group-form-review"><h3>{draft.name}</h3><dl><div><dt>관계</dt><dd>{kinds.find(item=>item.id===draft.kind)?.label}</dd></div><div><dt>관심사</dt><dd>{category?.label}{draft.subcategoryIds.length?` · ${draft.subcategoryIds.map(id=>getGroupSubtopic(id)?.label).filter(Boolean).join(' · ')}`:''}</dd></div><div><dt>지역</dt><dd>{[draft.region,draft.district,draft.neighborhood].filter(Boolean).join(' · ')||'나중에 정하기'}</dd></div><div><dt>가입</dt><dd>{draft.joinMode==='DIRECT'?'바로 가입':'운영진 승인 후 가입'}</dd></div></dl><p>{draft.introduction||'소개를 나중에 작성할 수 있어요.'}</p><small>새 멤버 질문 {draft.joinFields.questions.filter(item=>item.label.trim()).length}개 · {draft.joinFields.welcome?'환영 인사 있음':'환영 인사 미작성'}</small><div className="group-form-notice"><Check size={17}/><p>{mode==='EDIT'?'최종 저장한 내용이 모임에 반영돼요. 공개 중인 모임은 공개 소개에도 반영돼요.':'처음에는 비공개로 만들어요. 공개 모집은 모임 설정에서 직접 선택해요.'}</p></div></div>}
    {error && <p role="alert" className="group-form-error">{error}</p>}<div className="group-form-footer">{step>0 && <button type="button" aria-label="이전 단계" disabled={busy} onClick={()=>{setError('');setStep(current=>current-1);}}><ArrowLeft size={18}/></button>}<button type="button" className="tg-primary" disabled={busy} onClick={()=>step===2?void submit():next()}>{step===2?busy?'저장 중…':mode==='EDIT'?'변경 저장':'모임 만들기':'다음'}</button></div>
  </div>;
}
