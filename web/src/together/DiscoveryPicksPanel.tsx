import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { GroupTopic, TogetherState } from './model';
import type { GroupDiscoveryFilters } from './groupDiscoveryModel';
import { topicOptions } from './discovery';
import GroupLocalityFields from './GroupLocalityFields';
import { groupSubtopicsFor } from './groupTaxonomy';
import { acknowledgeDiscoveryMatches, conditionDiscoveryFilters, DISCOVERY_PICKS_CHANGED, readDiscoveryPicks, removeDiscoveryCondition,
  saveDiscoveryCondition, selectConditionMatches, selectNewDiscoveryMatches, selectSavedPublicAppointments, toggleSavedPublicAppointment,
  type DiscoveryConditionInput, type DiscoveryTimeBand, type DiscoveryWeekday, type PicksStorage, type PublicDiscoveryEvent } from './discoveryPicks';
import './discovery-picks.css';

const weekdays: Array<[DiscoveryWeekday, string]> = [['ALL', '모든 요일'], ['WEEKEND', '주말'], ['WEEKDAY', '평일'], ['0', '일요일'], ['1', '월요일'], ['2', '화요일'], ['3', '수요일'], ['4', '목요일'], ['5', '금요일'], ['6', '토요일']];
const timeBands: Array<[DiscoveryTimeBand, string]> = [['ALL', '모든 시간'], ['MORNING', '오전 06–12시'], ['AFTERNOON', '오후 12–18시'], ['EVENING', '저녁 18–24시'], ['NIGHT', '새벽 00–06시']];
const dateLabel = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
const defaultStorage = () => { try { return window.localStorage; } catch { return null; } };
const notify = () => window.dispatchEvent(new Event(DISCOVERY_PICKS_CHANGED));

function usePicks(owner: string, givenStorage?: PicksStorage) {
  const storage = useMemo(() => givenStorage ?? defaultStorage(), [givenStorage]);
  const [read, setRead] = useState(() => readDiscoveryPicks(storage, owner));
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => setRead(readDiscoveryPicks(storage, owner));
    refresh();
    window.addEventListener(DISCOVERY_PICKS_CHANGED, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener(DISCOVERY_PICKS_CHANGED, refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
  }, [owner, storage]);
  const perform = (operation: () => unknown) => {
    try { operation(); setRead(readDiscoveryPicks(storage, owner)); setError(''); notify(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.'); return false; }
  };
  const current = read.state.owner === owner ? read : readDiscoveryPicks(storage, owner);
  return { ...current, error, storage, perform };
}

export interface DiscoveryPicksPanelProps {
  state: TogetherState; viewerId: string; initialFilters?: GroupDiscoveryFilters; storage?: PicksStorage;
  onOpenActivity: (groupId: string, activityId: string) => void;
  onApplyFilters?: (filters: GroupDiscoveryFilters) => void;
}
export default function DiscoveryPicksPanel(props: DiscoveryPicksPanelProps) {
  return <PicksBody key={props.viewerId} {...props}/>;
}
function PicksBody({ state, viewerId, initialFilters, storage: givenStorage, onOpenActivity, onApplyFilters }: DiscoveryPicksPanelProps) {
  const picks = usePicks(viewerId, givenStorage);
  const [tab, setTab] = useState<'saved' | 'conditions' | 'new'>('saved');
  const [creating, setCreating] = useState(false), [selectedId, setSelectedId] = useState('');
  const [input, setInput] = useState<DiscoveryConditionInput>({ name: '', region: initialFilters?.region || '', district: initialFilters?.district || '', neighborhood: initialFilters?.neighborhood || '',
    topic: initialFilters?.topic || '', subtopic: initialFilters?.subtopic === 'ALL' ? '' : initialFilters?.subtopic || '', query: initialFilters?.query || '', weekday: 'ALL', timeBand: 'ALL' });
  const current = picks.state.conditions.find(item => item.id === selectedId);
  const matches = current ? selectConditionMatches(state, viewerId, current) : [];
  const newMatches = picks.state.conditions.map(condition => ({ condition, matches: selectNewDiscoveryMatches(state, viewerId, condition) }));
  const count = newMatches.reduce((sum, item) => sum + item.matches.length, 0);
  const saved = selectSavedPublicAppointments(state, viewerId, picks.state.appointments);
  const update = (next: Partial<DiscoveryConditionInput>) => setInput(value => ({ ...value, ...next }));
  const open = (event: PublicDiscoveryEvent) => {
    const fresh = selectSavedPublicAppointments(state, viewerId, [{ groupId: event.group.id, activityId: event.activity.id }])[0]?.event;
    if (fresh) onOpenActivity(fresh.group.id, fresh.activity.id);
  };
  const row = (event: PublicDiscoveryEvent) => <article className="discovery-pick" key={`${event.group.id}:${event.activity.id}`}>
    <button type="button" className="discovery-pick__open" onClick={() => open(event)} aria-label={`${event.activity.title} 공개 약속 보기`}>
      <span className="discovery-pick__date">{dateLabel(event.activity.date)}<small>{event.activity.startTime || '시간 미정'}</small></span>
      <span><strong>{event.activity.title}</strong><small>{event.group.name} · {[event.group.region, event.group.district, event.group.neighborhood].filter(Boolean).join(' ')}</small><small>{event.group.joined ? '가입한 모임' : event.group.joinMode === 'DIRECT' ? '모임 가입 후 참여' : '모임 가입 승인 후 참여'}</small></span><ChevronRight size={17}/>
    </button>
    <SavePublicActivityButton state={state} viewerId={viewerId} groupId={event.group.id} activityId={event.activity.id} storage={picks.storage ?? undefined}/>
  </article>;
  return <div className="discovery-picks">
    <p className="discovery-picks__intro">가고 싶은 약속과 발견 조건을 모아두세요. 참석은 약속에서 따로 선택해요.</p>
    <div className="discovery-picks__tabs" role="tablist" aria-label="관심 약속과 발견 조건">
      {([['saved', `관심 약속 ${saved.length}`], ['conditions', `발견 조건 ${picks.state.conditions.length}`], ['new', `새 매칭 ${count}`]] as const).map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={tab === id} onClick={() => { setTab(id); setSelectedId(''); setCreating(false); }}>{label}</button>)}
    </div>
    {(picks.message || picks.error) && <p role="alert" className="discovery-picks__error">{picks.error || picks.message}</p>}
    {tab === 'saved' && <>
      {saved.length ? <div className="discovery-picks__list">{saved.map(({ reference, event }) => event ? row(event) : <article className="discovery-picks__unavailable" key={`${reference.groupId}:${reference.activityId}`}><span>공개 안내가 끝난 약속</span><button type="button" aria-label="공개 안내가 끝난 약속 저장 해제" onClick={() => picks.perform(() => toggleSavedPublicAppointment(picks.storage, viewerId, state, reference, false))}><Trash2 size={17}/>삭제</button></article>)}</div>
        : <div className="discovery-picks__empty"><Bookmark size={27}/><strong>다음에 보고 싶은 약속을 저장하세요</strong><p>공개 약속의 저장 버튼을 누르면 여기서 비교할 수 있어요.</p></div>}
      <button type="button" className="discovery-picks__secondary" onClick={() => { setTab('conditions'); setCreating(true); }}><SlidersHorizontal size={17}/>발견 조건 만들기</button>
    </>}
    {tab === 'conditions' && <>
      {!creating && !current && <>
        <button type="button" className="discovery-picks__primary" disabled={picks.status !== 'ready'} onClick={() => setCreating(true)}><Plus size={17}/>현재 조건으로 발견 조건 만들기</button>
        {picks.state.conditions.length ? <div className="discovery-picks__conditions">{picks.state.conditions.map(condition => <article key={condition.id}>
          <button type="button" onClick={() => setSelectedId(condition.id)}><Search size={19}/><span><strong>{condition.name}</strong><small>{[condition.region, condition.district, condition.neighborhood, topicOptions.find(item => item.id === condition.topic)?.label, weekdays.find(item => item[0] === condition.weekday)?.[1], timeBands.find(item => item[0] === condition.timeBand)?.[1]].filter(Boolean).join(' · ')}</small></span><ChevronRight size={17}/></button>
          <button type="button" className="discovery-picks__delete" aria-label={`${condition.name} 조건 삭제`} onClick={() => picks.perform(() => removeDiscoveryCondition(picks.storage, viewerId, condition.id))}><Trash2 size={16}/></button>
        </article>)}</div> : <p className="discovery-picks__hint">지역·활동·요일·시간을 저장하면 다음에 다시 찾기 편해요.</p>}
      </>}
      {current && <section className="discovery-picks__matches"><button type="button" className="discovery-picks__back" onClick={() => setSelectedId('')}><ChevronLeft size={17}/>발견 조건 목록</button><h3>{current.name}</h3><p className="discovery-picks__hint">현재 조건에 맞는 공개 약속 {matches.length}개</p>{matches.map(row)}{!matches.length && <p>지금 맞는 공개 약속이 없어요. 새로 맞는 약속은 새 매칭에서 확인할 수 있어요.</p>}{onApplyFilters && <button type="button" className="discovery-picks__secondary" onClick={() => onApplyFilters(conditionDiscoveryFilters(current))}>지역·관심사로 더 보기<ChevronRight size={16}/></button>}</section>}
      {creating && <form className="discovery-picks__form" onSubmit={event => { event.preventDefault(); if (picks.perform(() => saveDiscoveryCondition(picks.storage, viewerId, state, { ...input, name: input.name.trim(), query: input.query.trim() }))) setCreating(false); }}>
        <label>조건 이름<input value={input.name} maxLength={50} required placeholder="예: 부산 주말 오전 산책" onChange={event => update({ name: event.target.value })}/></label>
        <GroupLocalityFields region={input.region} district={input.district} neighborhood={input.neighborhood} onChange={update} label="발견할 지역" ariaPrefix="발견 조건" mode="FILTER" neighborhoodMaxLength={80}/>
        <div className="discovery-picks__fields"><label>관심사<select value={input.topic} onChange={event => update({ topic: event.target.value as GroupTopic | '', subtopic: '' })}><option value="">모든 관심사</option>{topicOptions.map(topic => <option key={topic.id} value={topic.id}>{topic.emoji} {topic.label}</option>)}</select></label><label>세부 활동<select value={input.subtopic} disabled={!input.topic} onChange={event => update({ subtopic: event.target.value })}><option value="">모든 세부 활동</option>{groupSubtopicsFor(input.topic || undefined).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
        <div className="discovery-picks__fields"><label>요일<select value={input.weekday} onChange={event => update({ weekday: event.target.value as DiscoveryWeekday })}>{weekdays.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>시작 시간대<select value={input.timeBand} onChange={event => update({ timeBand: event.target.value as DiscoveryTimeBand })}>{timeBands.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        <label>검색어 · 선택<input value={input.query} maxLength={120} onChange={event => update({ query: event.target.value })}/></label>
        <p className="discovery-picks__hint">조건을 저장한 뒤 새로 공개되거나 안내가 바뀐 약속을 새 매칭에 모아요. 시간대는 공개한 시작 시각으로 비교해요.</p>
        <div className="discovery-picks__actions"><button type="button" onClick={() => setCreating(false)}>취소</button><button type="submit" className="discovery-picks__primary" disabled={picks.status !== 'ready'}><Check size={17}/>발견 조건 저장</button></div>
      </form>}
    </>}
    {tab === 'new' && <>
      <p className="discovery-picks__hint">이 기기에서 저장한 조건을 현재 공개 약속과 비교해요.</p>
      {count ? newMatches.filter(item => item.matches.length > 0).map(({ condition, matches: added }) => <section className="discovery-picks__matches" key={condition.id}><header><h3>{condition.name} <small>{added.length}개</small></h3><button type="button" onClick={() => picks.perform(() => acknowledgeDiscoveryMatches(picks.storage, viewerId, state, condition.id))}>확인했어요<Check size={15}/></button></header>{added.map(row)}</section>) : <div className="discovery-picks__empty"><Search size={27}/><strong>새로 맞는 약속을 기다리고 있어요</strong><p>발견 조건을 저장하면 조건에 맞는 새 안내를 모아볼 수 있어요.</p></div>}
    </>}
  </div>;
}

export function SavePublicActivityButton({ state, viewerId, groupId, activityId, storage }: { state: TogetherState; viewerId: string; groupId: string; activityId: string; storage?: PicksStorage }) {
  const picks = usePicks(viewerId, storage);
  const saved = picks.state.appointments.some(item => item.groupId === groupId && item.activityId === activityId);
  const available = selectSavedPublicAppointments(state, viewerId, [{ groupId, activityId }])[0]?.event;
  if (!available && !saved) return null;
  return <span className="discovery-pick-save"><button type="button" className="discovery-pick-save__button" aria-label={`${available?.activity.title || '공개 안내가 끝난 약속'} 관심 약속 ${saved ? '저장 해제' : '저장'}`} aria-pressed={saved} disabled={picks.status !== 'ready'} onClick={() => picks.perform(() => toggleSavedPublicAppointment(picks.storage, viewerId, state, { groupId, activityId }, !saved))}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'}/><span>{saved ? '저장됨' : '저장'}</span></button>{picks.error && <span role="alert" className="discovery-pick-save__error">{picks.error}</span>}</span>;
}
