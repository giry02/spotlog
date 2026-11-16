import { useId, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { topicOptions } from './together/discovery';
import { getGroupSubtopic, groupSubtopicsFor } from './together/groupTaxonomy';
import type { GroupTopic } from './together/model';
import { MAX_SAVED_GROUP_SUBTOPICS, readGroupInterests, writeGroupInterests, type GroupInterestsState } from './groupInterestStore';
import { groupInterestsDeviceStorage } from './useGroupInterests';
import './group-interests.css';

export interface GroupInterestSheetProps { ownerId: string; onClose: () => void; onSaved: (state: GroupInterestsState) => void }
/** Reference patterns: KakaoTalk_20261110_093430419_01..03,05.jpg. No private reference content is copied. */
export default function GroupInterestSheet(props: GroupInterestSheetProps) { return <InterestEditor key={props.ownerId} {...props}/>; }
function InterestEditor({ ownerId, onClose, onSaved }: GroupInterestSheetProps) {
  const [storage, setStorage] = useState(groupInterestsDeviceStorage), [loaded, setLoaded] = useState(() => readGroupInterests(storage, ownerId));
  const [topics, setTopics] = useState<GroupTopic[]>(loaded.state.topics), [subtopics, setSubtopics] = useState<string[]>(loaded.state.subtopics);
  const [step, setStep] = useState<'topics' | 'details'>('topics'), [activeTopic, setActiveTopic] = useState<GroupTopic | undefined>(loaded.state.topics[0]);
  const [error, setError] = useState(''); const saving = useRef(false), uid = useId();
  const writable = loaded.status === 'ready';
  const chooseTopic = (topic: GroupTopic) => {
    setError('');
    if (topics.includes(topic)) { const next = topics.filter(id => id !== topic); setTopics(next); setSubtopics(items => items.filter(id => getGroupSubtopic(id)?.parent !== topic)); if (activeTopic === topic) setActiveTopic(next[0]); }
    else { setTopics(items => [...items, topic]); if (!activeTopic) setActiveTopic(topic); }
  };
  const chooseChild = (id: string) => {
    setError('');
    if (subtopics.includes(id)) setSubtopics(items => items.filter(value => value !== id));
    else if (subtopics.length >= MAX_SAVED_GROUP_SUBTOPICS) setError('세부 활동은 32개까지 선택할 수 있어요. 다른 선택을 해제한 뒤 더해 주세요.');
    else setSubtopics(items => [...items, id]);
  };
  const clear = () => { setTopics([]); setSubtopics([]); setActiveTopic(undefined); setStep('topics'); setError(''); };
  const reload = () => { const currentStorage = groupInterestsDeviceStorage(), next = readGroupInterests(currentStorage, ownerId); setStorage(currentStorage); setLoaded(next); setError(''); if (next.status === 'ready') { setTopics([...next.state.topics]); setSubtopics([...next.state.subtopics]); setActiveTopic(next.state.topics[0]); setStep('topics'); } };
  const save = () => {
    if (saving.current || !writable) return; saving.current = true;
    try { const saved = writeGroupInterests(storage, ownerId, { topics, subtopics }, loaded.state.revision); onSaved(saved); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '관심사를 저장하지 못했어요. 선택은 유지했어요.'); }
    finally { saving.current = false; }
  };
  const active = topics.includes(activeTopic!) ? activeTopic : topics[0];
  const activeLabel = topicOptions.find(item => item.id === active);
  return <BottomSheet title="내 관심사" description="관심 있는 분야와 세부 활동을 여러 개 고를 수 있어요." onClose={onClose}>
    <div className="group-interest-editor">
      <div className="gie-steps" aria-label="관심사 편집 단계"><button type="button" aria-pressed={step === 'topics'} onClick={() => setStep('topics')}>1 분야 선택</button><button type="button" aria-pressed={step === 'details'} disabled={!topics.length} onClick={() => setStep('details')}>2 세부 활동</button></div>
      <p className="gie-intro">{step === 'topics' ? '좋아하는 분야를 골라 주세요. 분야만 저장해도 사용할 수 있어요.' : '세부 활동을 고르면 그 활동을 직접 등록한 모임으로 좁혀 보여요. 선택하지 않은 분야는 전체 활동을 봐요.'}</p>
      {step === 'topics' ? <div className="gie-topic-grid" role="group" aria-label="저장할 모임 관심 분야">{topicOptions.map(topic => <button type="button" key={topic.id} disabled={!writable} aria-pressed={topics.includes(topic.id)} onClick={() => chooseTopic(topic.id)}><span className="gie-topic-icon" aria-hidden="true">{topic.emoji}</span><span>{topic.label}</span>{topics.includes(topic.id) && <Check className="gie-topic-check" size={14} aria-hidden="true"/>}</button>)}</div> : <>
        <div className="gie-parents" role="group" aria-label="세부 활동을 고를 분야">{topics.map(id => { const topic = topicOptions.find(item => item.id === id)!; return <button type="button" key={id} aria-pressed={active === id} onClick={() => setActiveTopic(id)}><span aria-hidden="true">{topic.emoji}</span>{topic.label}</button>; })}</div>
        {active && <section className="gie-children" aria-labelledby={`${uid}-children`}><h3 id={`${uid}-children`}>{activeLabel?.label} 세부 활동</h3><button type="button" className="gie-all-child" disabled={!writable} aria-pressed={!subtopics.some(id => getGroupSubtopic(id)?.parent === active)} onClick={() => setSubtopics(items => items.filter(id => getGroupSubtopic(id)?.parent !== active))}><Check size={16} aria-hidden="true"/><span>이 분야 전체 보기</span></button><div className="gie-child-grid">{groupSubtopicsFor(active).map(item => <button type="button" key={item.id} disabled={!writable} aria-pressed={subtopics.includes(item.id)} onClick={() => chooseChild(item.id)}><span aria-hidden="true">{item.emoji}</span><span>{item.label}</span><span className="gie-child-check" aria-hidden="true">{subtopics.includes(item.id) && <Check size={14}/>}</span></button>)}</div></section>}
      </>}
      <details className="gie-selection"><summary>선택한 분야 {topics.length}개 · 세부 활동 {subtopics.length}/{MAX_SAVED_GROUP_SUBTOPICS}개</summary><div>{topics.map(id => <button type="button" key={id} disabled={!writable} aria-label={`${topicOptions.find(item => item.id === id)?.label} 분야 해제`} onClick={() => chooseTopic(id)}>{topicOptions.find(item => item.id === id)?.label}<X size={14}/></button>)}{subtopics.map(id => <button type="button" key={id} disabled={!writable} aria-label={`${getGroupSubtopic(id)?.label} 세부 활동 해제`} onClick={() => chooseChild(id)}>{getGroupSubtopic(id)?.label}<X size={14}/></button>)}</div></details>
      {!topics.length && <p className="gie-empty">관심사를 선택하면 홈 모임의 ‘내 관심사 모임’에 따로 보여요. 비워서 저장하면 지역 모임을 계속 둘러볼 수 있어요.</p>}
      <p className="gie-storage">{ownerId ? '현재 계정의 이 기기에 저장해요.' : '로그인 전 이 기기에 따로 저장해요. 로그인 계정으로 자동 합쳐지지 않아요.'} 지역·검색 조건과 모임 가입 상태는 바꾸지 않아요.</p>
      {!writable && <div className="gie-error" role="alert"><p>{loaded.message}</p><button type="button" onClick={reload}><RotateCcw size={16}/>다시 불러오기</button></div>}
      {error && <div className="gie-error" role="alert"><p>{error}</p><button type="button" onClick={reload}><RotateCcw size={16}/>저장한 관심사 다시 불러오기</button></div>}
      <div className="gie-footer"><div><button type="button" onClick={onClose}>취소</button><button type="button" disabled={!writable || !topics.length && !subtopics.length} onClick={clear}>모두 해제</button></div><div>{step === 'details' && <button type="button" onClick={() => setStep('topics')}><ChevronLeft size={16}/>분야</button>}{step === 'topics' && topics.length > 0 && <button type="button" onClick={() => setStep('details')}>세부 활동<ChevronRight size={16}/></button>}<button type="button" className="gie-save" disabled={!writable} onClick={save}>관심사 저장</button></div></div>
    </div>
  </BottomSheet>;
}
