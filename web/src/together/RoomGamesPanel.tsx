import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Gift, ListTree, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { TogetherState } from './model';
import { togetherId } from './model';
import type { RoomGameInput, RoomGameType, TogetherGame } from './gameTypes';
import { getRoomGameContext, getRoomGames } from './roomGames';
import './room-games.css';

type SaveResult = boolean | string;
export interface RoomGamesPanelProps {
  state: TogetherState;
  userId: string;
  groupId: string;
  activityId?: string;
  initialId?: string;
  onCreate: (input: RoomGameInput) => SaveResult | Promise<SaveResult>;
  onRerun: (id: string) => SaveResult | Promise<SaveResult>;
}
const games: Array<{ type: RoomGameType; title: string; description: string }> = [
  { type: 'WHEEL', title: '돌림판', description: '메뉴나 장소 중 하나 고르기' },
  { type: 'DRAW', title: '당첨 뽑기', description: '함께하는 사람 중 한 명 뽑기' },
  { type: 'LADDER', title: '사다리', description: '사람마다 준비 역할 하나씩 나누기' },
];
export const roomGameNames: Record<RoomGameType, string> = { WHEEL: '돌림판', DRAW: '당첨 뽑기', LADDER: '사다리' };
const freshId = () => togetherId('room-game');

export default function RoomGamesPanel(props: RoomGamesPanelProps) {
  return <RoomGamesBody key={`${props.userId}:${props.groupId}:${props.activityId || 'group'}:${props.initialId || 'list'}`} {...props}/>;
}
function RoomGamesBody({ state, userId, groupId, activityId, initialId, onCreate, onRerun }: RoomGamesPanelProps) {
  const uid = useId();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(initialId ?? '');
  const [type, setType] = useState<RoomGameType>('WHEEL');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<'OPTIONS' | 'MEMBERS'>('OPTIONS');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [options, setOptions] = useState(['', '']);
  const [roles, setRoles] = useState<string[]>([]);
  const [requestId, setRequestId] = useState(freshId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState<{ previousId: string; knownIds: string[] } | null>(null);
  const inFlight = useRef(false);
  const scope = { groupId, activityId };
  const rows = getRoomGames(state, userId, scope);
  useEffect(() => {
    if (!waiting) return;
    const result = rows.find(game => game.previousGameId === waiting.previousId && game.createdBy === userId && !waiting.knownIds.includes(game.id));
    if (result) { setSelectedId(result.id); setWaiting(null); }
  }, [rows, waiting, userId]);
  let context: ReturnType<typeof getRoomGameContext>;
  try { context = getRoomGameContext(state, userId, scope); }
  catch (cause) { return <section className="room-games"><p role="alert">{cause instanceof Error ? cause.message : '현재 모임을 다시 확인해 주세요.'}</p></section>; }
  const { members, canWrite, readOnlyReason } = context;
  const selected = selectedId ? rows.find(game => game.id === selectedId) : undefined;
  const memberSelection = type !== 'WHEEL' || source === 'MEMBERS';
  const invalidMembers = memberIds.some(id => !members.some(member => member.id === id));
  const directOptions = type === 'LADDER' ? Array.from({ length: memberIds.length }, (_, index) => roles[index] || '') : options;
  const canSubmit = Boolean(title.trim()) && !invalidMembers && (memberSelection ? memberIds.length >= 2 && memberIds.length <= 12 : true)
    && (type === 'DRAW' || type === 'WHEEL' && source === 'MEMBERS' || directOptions.length >= 2 && directOptions.every(option => option.trim()));
  const start = (next: RoomGameType) => {
    setType(next); setTitle(''); setSource('OPTIONS'); setMemberIds([]); setOptions(['', '']); setRoles([]);
    setRequestId(freshId()); setSelectedId(''); setCreating(true); setError(''); setWaiting(null);
  };
  const submit = async () => {
    if (inFlight.current || !canWrite || !canSubmit) return;
    inFlight.current = true; setBusy(true); setError('');
    const input: RoomGameInput = { id: requestId, type, title, ...(memberSelection ? { memberIds: [...memberIds] } : {}),
      ...(type === 'LADDER' || type === 'WHEEL' && source === 'OPTIONS' ? { options: [...directOptions] } : {}) };
    try {
      const result = await onCreate(input);
      if (!result) { setError('저장하지 못했어요. 입력은 그대로 있으니 다시 시도해 주세요.'); return; }
      setSelectedId(typeof result === 'string' ? result : input.id); setCreating(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '놀이를 저장하지 못했어요.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const rerun = async (game: TogetherGame) => {
    if (inFlight.current || !canWrite) return;
    inFlight.current = true; setBusy(true); setError('');
    const knownIds = rows.map(row => row.id);
    try {
      const result = await onRerun(game.id);
      if (!result) { setError('새 결과를 저장하지 못했어요. 이전 결과를 그대로 보여드려요.'); return; }
      if (typeof result === 'string') setSelectedId(result);
      else setWaiting({ previousId: game.id, knownIds });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '다시 추첨하지 못했어요. 이전 결과는 그대로예요.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section className="room-games">
    {error && <p className="room-games__error" role="alert">{error}</p>}
    {!canWrite && <p className="room-games__hint">{readOnlyReason}</p>}
    {creating ? <>
      <div className="room-games__heading"><button type="button" className="room-games__back" disabled={busy} onClick={() => { setCreating(false); setError(''); }}><ArrowLeft size={18}/>놀이 목록</button><strong>{roomGameNames[type]}</strong></div>
      <label className="room-games__field">놀이 제목<input maxLength={100} disabled={busy || !canWrite} value={title} onChange={event => setTitle(event.target.value)} placeholder={type === 'WHEEL' ? '오늘 어디에서 먹을까요?' : type === 'DRAW' ? '오늘의 주인공은?' : '준비 역할을 나눠요'}/></label>
      {type === 'WHEEL' && <div className="room-games__source" role="group" aria-label="돌림판 항목 방식"><button type="button" aria-pressed={source === 'OPTIONS'} disabled={busy || !canWrite} onClick={() => setSource('OPTIONS')}>직접 항목</button><button type="button" aria-pressed={source === 'MEMBERS'} disabled={busy || !canWrite} onClick={() => setSource('MEMBERS')}>모임원 선택</button></div>}
      {memberSelection && <fieldset className="room-games__members"><legend>함께할 모임원 · {memberIds.length}/12명</legend><p className="room-games__hint">직접 고른 사람만 포함해요. 약속 참석 여부는 바뀌지 않아요.</p>{members.map((member, index) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} disabled={busy || !canWrite || !memberIds.includes(member.id) && memberIds.length >= 12} onChange={() => setMemberIds(current => current.includes(member.id) ? current.filter(id => id !== member.id) : [...current, member.id])}/><span>{member.name}</span><small>{index + 1}</small></label>)}{invalidMembers && <p className="room-games__error" role="alert">참여자의 가입 상태가 바뀌었어요. <button type="button" disabled={busy} onClick={() => setMemberIds(current => current.filter(id => members.some(member => member.id === id)))}>현재 모임원으로 다시 확인</button></p>}</fieldset>}
      {type === 'WHEEL' && source === 'OPTIONS' && <fieldset className="room-games__options"><legend>돌림판 항목 · {options.length}/12개</legend>{options.map((option, index) => <div className="room-games__option" key={index}><label className="room-games__field" htmlFor={`${uid}-option-${index}`}>항목 {index + 1}<input id={`${uid}-option-${index}`} maxLength={80} disabled={busy || !canWrite} value={option} onChange={event => setOptions(current => current.map((item, row) => row === index ? event.target.value : item))}/></label><button type="button" aria-label={`항목 ${index + 1} 삭제`} disabled={busy || !canWrite || options.length <= 2} onClick={() => setOptions(current => current.filter((_, row) => row !== index))}><Trash2 size={18}/></button></div>)}<button type="button" className="room-games__add" disabled={busy || !canWrite || options.length >= 12} onClick={() => setOptions(current => [...current, ''])}><Plus size={18}/>항목 추가</button></fieldset>}
      {type === 'LADDER' && memberIds.length > 0 && <fieldset className="room-games__options"><legend>준비 역할 · 참여자와 같은 {memberIds.length}개</legend><p className="room-games__hint">역할을 한 사람당 하나씩 나눠요. 할 일 담당자는 자동으로 바뀌지 않아요.</p>{memberIds.map((_, index) => <label className="room-games__field" key={index}>역할 {index + 1}<input maxLength={80} disabled={busy || !canWrite} value={roles[index] || ''} onChange={event => setRoles(current => { const next = [...current]; next[index] = event.target.value; return next; })}/></label>)}</fieldset>}
      <p className="room-games__hint">결과는 이 방에 저장돼요. 일정·참석·준비 담당을 자동으로 변경하지 않아요.</p>
      <button type="button" className="room-games__primary" disabled={busy || !canWrite || !canSubmit} onClick={() => void submit()}>{busy ? '결과 저장 중…' : '추첨하고 이 방에 결과 올리기'}<ArrowRight size={18}/></button>
    </> : selected ? <>
      <div className="room-games__heading"><button type="button" className="room-games__back" disabled={busy} onClick={() => { setSelectedId(''); setError(''); setWaiting(null); }}><ArrowLeft size={18}/>놀이 목록</button><span className="room-games__hint">{roomGameNames[selected.type]} · {selected.round}회차</span></div>
      <h3 className="room-games__title">{selected.title}</h3><GameResult key={selected.id} game={selected}/>
      <p className="room-games__hint">{new Date(selected.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}에 저장한 결과예요. 다시 열어도 결과는 같아요.</p>
      {canWrite && <button type="button" className="room-games__rerun" disabled={busy || Boolean(waiting)} onClick={() => void rerun(selected)}><RotateCcw size={18}/>{busy || waiting ? '새 결과 저장 중…' : '새 회차로 다시 추첨'}</button>}
      {canWrite && <p className="room-games__hint">이전 결과를 남기고 새 회차를 만들어요.</p>}
    </> : selectedId ? <><p role="status">이 방에서 확인할 수 있는 놀이 결과를 찾지 못했어요.</p><button type="button" className="room-games__back" onClick={() => setSelectedId('')}><ArrowLeft size={18}/>놀이 목록</button></> : <>
      {canWrite && <div className="room-games__picker" aria-label="새 놀이 고르기">{games.map(item => <button key={item.type} type="button" onClick={() => start(item.type)}>{item.type === 'DRAW' ? <Gift size={22}/> : item.type === 'LADDER' ? <ListTree size={22}/> : <span className="room-games__wheel-icon" aria-hidden="true"/>}<span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={18}/></button>)}</div>}
      <div className="room-games__heading"><h3>이 방의 놀이 결과</h3><span className="room-games__hint">{rows.length}개</span></div>
      {rows.length ? <div className="room-games__history">{rows.map(game => <button key={game.id} type="button" onClick={() => setSelectedId(game.id)}><span><strong>{game.title}</strong><small>{roomGameNames[game.type]} · {game.round}회차</small></span><ChevronRight size={18}/></button>)}</div> : <p className="room-games__hint">아직 저장한 놀이가 없어요.</p>}
    </>}
  </section>;
}

function GameResult({ game }: { game: TogetherGame }) {
  const [highlighted, setHighlighted] = useState(0);
  if (game.type === 'DRAW') {
    const winner = game.members.find(member => member.id === game.result.memberId);
    return <div className="room-games__result"><Gift size={34} aria-hidden="true"/><span>이번에 뽑힌 사람</span><strong>{winner?.name}</strong><details><summary>함께한 사람 {game.members.length}명</summary><ul>{game.members.map(member => <li key={member.id}>{member.name}</li>)}</ul></details></div>;
  }
  if (game.type === 'WHEEL') {
    const index = game.options.findIndex(option => option.id === game.result.optionId);
    const angle = 360 / game.options.length;
    const point = (degree: number) => [100 + 84 * Math.cos(degree * Math.PI / 180), 100 + 84 * Math.sin(degree * Math.PI / 180)];
    return <div className="room-games__result"><svg className="room-games__wheel" viewBox="0 0 200 200" aria-hidden="true"><g transform={`rotate(${-90 - angle * (index + .5)} 100 100)`}>{game.options.map((option, row) => { const from = point(angle * row), to = point(angle * (row + 1)); return <path className={row === index ? 'is-picked' : row % 2 ? 'is-even' : ''} key={option.id} d={`M100 100 L${from[0]} ${from[1]} A84 84 0 ${angle > 180 ? 1 : 0} 1 ${to[0]} ${to[1]} Z`}/>; })}</g><circle cx="100" cy="100" r="25"/><path className="room-games__pointer" d="M90 5 H110 L100 24 Z"/><text x="100" y="105" textAnchor="middle">결과</text></svg><span>이번에 고른 항목</span><strong>{game.options[index]?.label}</strong><details><summary>돌림판 항목 {game.options.length}개</summary><ul>{game.options.map(option => <li key={option.id}>{option.id === game.result.optionId && <Check size={16} aria-label="선택됨"/>}{option.label}</li>)}</ul></details></div>;
  }
  const count = game.members.length;
  const width = Math.max(100, (count - 1) * 32 + 32), height = Math.max(70, (game.result.bars.length + 3) * 8);
  const x = (index: number) => 16 + index * (width - 32) / (count - 1);
  let position = Math.min(highlighted, count - 1);
  let trace = `M${x(position)} 8`;
  for (const bar of game.result.bars) {
    const y = 16 + bar.level * 8;
    trace += ` V${y}`;
    if (position === bar.left || position === bar.left + 1) { position = position === bar.left ? position + 1 : position - 1; trace += ` H${x(position)}`; }
  }
  trace += ` V${height - 8}`;
  return <div className="room-games__ladder-result"><svg className="room-games__ladder" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">{game.members.map((member, index) => <path key={member.id} d={`M${x(index)} 8 V${height - 8}`}/>)}{game.result.bars.map(bar => <path key={bar.level} d={`M${x(bar.left)} ${16 + bar.level * 8} H${x(bar.left + 1)}`}/>)}<path className="is-picked" d={trace}/></svg><p className="room-games__hint">이름을 누르면 해당 사다리 길을 볼 수 있어요.</p><div className="room-games__assignments">{game.members.map((member, index) => { const pair = game.result.assignments.find(item => item.memberId === member.id); return <button type="button" key={member.id} aria-pressed={highlighted === index} onClick={() => setHighlighted(index)}><span>{index + 1}. {member.name}</span><ArrowRight size={16}/><strong>{game.options.find(option => option.id === pair?.optionId)?.label}</strong></button>; })}</div></div>;
}
