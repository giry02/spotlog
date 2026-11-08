import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, Plus, X } from 'lucide-react';
import { memberName, togetherId, type TogetherState } from './model';
import { challengeCanClose, challengeIsFinished, challengeProgress, challengeTemplates, challengeToday, CHALLENGE_PHOTO_MAX_BYTES, getChallengeContext, isChallengePhoto, selectRoomChallenges } from './challenges';
import type { ChallengeCertifyInput, ChallengeCreateInput, ChallengePhoto, ChallengeTemplate, TogetherChallenge } from './challengeTypes';
import './challenges.css';

type Saved = boolean | Promise<boolean>;
export interface ChallengesPanelProps {
  state: TogetherState; userId: string; groupId: string; activityId?: string; initialId?: string;
  onCreate: (input: ChallengeCreateInput) => Saved;
  onJoin: (id: string) => Saved; onLeave: (id: string) => Saved;
  onCertify: (id: string, input: ChallengeCertifyInput) => Saved; onClose: (id: string) => Saved;
}
export default function ChallengesPanel(props: ChallengesPanelProps) {
  return <ChallengesBody key={`${props.userId}:${props.groupId}:${props.activityId || 'group'}:${props.initialId || 'list'}`} {...props}/>;
}
function ChallengesBody({ state, userId, groupId, activityId, initialId, onCreate, onJoin, onLeave, onCertify, onClose }: ChallengesPanelProps) {
  const scope = { groupId, activityId };
  const [selectedId, setSelectedId] = useState(initialId || '');
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState(false);
  const [requestId, setRequestId] = useState(() => togetherId('challenge'));
  const [template, setTemplate] = useState<ChallengeTemplate>('WALK');
  const [title, setTitle] = useState(challengeTemplates[0].title);
  const [description, setDescription] = useState(challengeTemplates[0].description);
  const activity = state.activities.find(item => item.id === activityId && item.groupId === groupId);
  const today = challengeToday();
  const defaultStart = activity?.date && activity.date > today ? activity.date : today;
  const defaultEnd = activity?.endDate || activity?.date || new Date(Date.parse(`${defaultStart}T00:00:00Z`) + 13 * 86400000).toISOString().slice(0,10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [target, setTarget] = useState(3);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<ChallengePhoto>();
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const lock = useRef(false);
  const reader = useRef<FileReader | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; reader.current?.abort(); }; }, []);
  let context: ReturnType<typeof getChallengeContext>;
  let challenges: TogetherChallenge[];
  try { context = getChallengeContext(state, userId, scope); challenges = selectRoomChallenges(state, userId, scope); }
  catch (cause) { return <section className="challenge-panel"><p role="alert">{cause instanceof Error ? cause.message : '챌린지를 다시 확인해 주세요.'}</p></section>; }
  const selected = challenges.find(item => item.id === selectedId);
  const save = async (action: () => Saved, after: () => void, message: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { const done = await action(); if (!mounted.current) return; if (done) { after(); setNotice(message); } else setError('저장하지 못했어요. 입력을 유지했으니 상태를 확인한 뒤 다시 시도해 주세요.'); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const readPhoto = (file?: File) => {
    reader.current?.abort(); setError(''); setPhoto(undefined);
    if (!file) { setReading(false); return; }
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size < 1 || file.size > CHALLENGE_PHOTO_MAX_BYTES) { setReading(false); setError('사진은 JPG·PNG·WebP·GIF 형식, 5MB 이하로 골라 주세요.'); if (fileInput.current) fileInput.current.value = ''; return; }
    const next = new FileReader(); reader.current = next; setReading(true);
    next.onload = () => {
      if (!mounted.current || reader.current !== next) return;
      const value = { name: file.name.slice(0,160), mime: file.type, size: file.size, dataUrl: String(next.result || '') };
      setReading(false);
      if (isChallengePhoto(value)) setPhoto(value); else setError('사진을 읽지 못했어요. 다른 사진을 골라 주세요.');
    };
    next.onerror = () => { if (mounted.current && reader.current === next) { setReading(false); setError('사진을 읽지 못했어요. 다시 골라 주세요.'); } };
    next.readAsDataURL(file);
  };
  const select = (id: string) => { reader.current?.abort(); setReading(false); setSelectedId(id); setBody(''); setPhoto(undefined); setError(''); setNotice(''); setConfirmClose(false); };
  const templateChoice = (value: ChallengeTemplate) => {
    const item = challengeTemplates.find(item => item.id === value)!;
    setTemplate(value); setTitle(item.title); setDescription(item.description); setTarget(item.weeklyTarget);
  };
  const feedback = <>{error && <p className="challenge-feedback error" role="alert">{error}</p>}{notice && <p className="challenge-feedback" role="status">{notice}</p>}</>;
  if (creating) return <section className="challenge-panel"><div className="challenge-title"><button type="button" className="challenge-back" aria-label="챌린지 목록으로" onClick={() => setCreating(false)}><ArrowLeft size={19}/></button><h2>챌린지 만들기</h2></div><form className="challenge-form" onSubmit={event => { event.preventDefault(); void save(() => onCreate({ id: requestId, template, title, description, startDate, endDate, frequency: 'WEEKLY', weeklyTarget: target }), () => { setCreating(false); setRequestId(togetherId('challenge')); }, '챌린지를 만들었어요. 참가 여부는 각자 선택해요.'); }}>
    <fieldset><legend>어떤 도전을 함께할까요?</legend><div className="challenge-templates">{challengeTemplates.map(item => <button type="button" aria-pressed={template === item.id} key={item.id} onClick={() => templateChoice(item.id)}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div></fieldset>
    <label>챌린지 이름<input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required/></label><label>함께할 내용<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={3}/></label>
    <div className="challenge-dates"><label>시작일<input type="date" min={today} value={startDate} onChange={event => setStartDate(event.target.value)} required/></label><label>종료일<input type="date" min={startDate || today} value={endDate} onChange={event => setEndDate(event.target.value)} required/></label></div>
    <label>주간 목표<select value={target} onChange={event => setTarget(Number(event.target.value))}>{[1,2,3,4,5,6,7].map(value => <option key={value} value={value}>주 {value}회</option>)}</select></label><p className="challenge-hint">월요일~일요일, 한국 날짜 기준이에요. 인증은 하루 한 번이며 참가와 기록은 각자 선택해요.</p>{feedback}<button type="submit" className="tg-primary" disabled={busy || !context.canWrite}>챌린지 만들기</button>
  </form></section>;
  if (selectedId && !selected) return <section className="challenge-panel"><p>현재 대화에서 이 챌린지를 볼 수 없어요.</p><button type="button" onClick={() => select('')}>챌린지 목록</button></section>;
  if (selected) {
    const finished = challengeIsFinished(selected);
    const joined = selected.participantIds.includes(userId);
    const certified = selected.certifications.some(item => item.userId === userId && item.date === today);
    const progress = challengeProgress(selected, userId);
    const writable = context.canWrite && !finished;
    const canCertify = writable && joined && selected.startDate <= today && !certified;
    const items = selected.certifications.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return <section className="challenge-panel"><div className="challenge-title"><button type="button" className="challenge-back" aria-label="챌린지 목록으로" onClick={() => select('')}><ArrowLeft size={19}/></button><h2>{selected.title}</h2></div><p>{selected.description}</p><p className="challenge-hint">{selected.startDate} ~ {selected.endDate} · 주 {selected.weeklyTarget}회 · {finished ? '종료된 도전' : today < selected.startDate ? '시작 전' : '진행 중'} · 참가 {selected.participantIds.length}명</p>
      <div className="challenge-progress"><strong>나의 인증</strong><span>이번 주 {progress.weeklyCount}/{progress.weeklyTarget}회 · 누적 {progress.totalCount}회</span><progress value={Math.min(progress.weeklyCount, progress.weeklyTarget)} max={progress.weeklyTarget} aria-label="나의 이번 주 인증"/></div>
      {!joined ? <button type="button" className="tg-primary" disabled={!writable || busy} onClick={() => void save(() => onJoin(selected.id), () => {}, '챌린지에 참가했어요.')}>챌린지 참가하기</button> : <div className="challenge-membership"><span><Check size={16}/>참가 중</span><button type="button" disabled={!context.canWrite || busy} onClick={() => void save(() => onLeave(selected.id), () => {}, '참가를 취소했어요. 기존 인증 기록은 남아 있어요.')}>참가 취소</button></div>}
      {canCertify && <form className="challenge-form challenge-certify" onSubmit={event => { event.preventDefault(); void save(() => onCertify(selected.id, { text: body, ...(photo ? { photo } : {}) }), () => { setBody(''); setPhoto(undefined); if (fileInput.current) fileInput.current.value = ''; }, '오늘 인증을 남겼어요.'); }}><h3>오늘의 인증</h3><label>오늘 한 일을 남겨주세요<textarea value={body} onChange={event => setBody(event.target.value)} maxLength={1000} rows={3} required/></label><label className="challenge-photo-input"><span><Camera size={17}/>사진 추가 · 선택</span><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => readPhoto(event.target.files?.[0])}/></label><small>5MB 이하. 선택한 사진은 이 기기의 챌린지 기록에 보관돼요.</small>{reading && <p role="status">사진을 읽고 있어요.</p>}{photo && <div className="challenge-photo-preview"><img src={photo.dataUrl} alt="인증에 첨부할 사진"/><button type="button" aria-label="첨부 사진 빼기" onClick={() => { setPhoto(undefined); if (fileInput.current) fileInput.current.value = ''; }}><X size={18}/></button></div>}<button type="submit" className="tg-primary" disabled={busy || reading}>오늘 인증 남기기</button></form>}
      {certified && !finished && <p className="challenge-hint">오늘 인증을 남겼어요. 다음 한국 날짜에 다시 남길 수 있어요.</p>}{finished && <p className="challenge-hint">도전이 종료됐어요. 남긴 인증은 계속 볼 수 있어요.</p>}{feedback}
      <section className="challenge-records"><h3>함께 남긴 인증 {items.length}개</h3>{items.length ? items.map(item => <article key={item.id}><div><strong>{memberName(state, item.userId)}</strong><small>{item.date}</small></div><p>{item.text}</p>{item.photo && <img src={item.photo.dataUrl} alt={`${memberName(state,item.userId)}의 인증 사진`} loading="lazy"/>}</article>) : <p className="challenge-hint">첫 인증을 기다리고 있어요.</p>}</section>
      {!selected.closed && context.canWrite && challengeCanClose(state, userId, selected) && <div className="challenge-close">{confirmClose && <p>지금 종료하면 새 인증은 받지 않아요. 기존 기록은 남아요.</p>}<button type="button" disabled={busy} onClick={() => { if (!confirmClose) return setConfirmClose(true); void save(() => onClose(selected.id), () => setConfirmClose(false), '챌린지를 종료했어요.'); }}>{confirmClose ? '챌린지 종료 확인' : '챌린지 종료'}</button>{confirmClose && <button type="button" onClick={() => setConfirmClose(false)}>계속 진행</button>}</div>}
    </section>;
  }
  const visible = challenges.filter(item => challengeIsFinished(item) === history);
  return <section className="challenge-panel"><div className="challenge-title"><h2>함께 도전</h2><button type="button" className="challenge-new" disabled={!context.canWrite} onClick={() => { setError(''); setNotice(''); setCreating(true); }}><Plus size={17}/>만들기</button></div><div className="challenge-tabs" role="group" aria-label="챌린지 진행 상태"><button type="button" aria-pressed={!history} onClick={() => setHistory(false)}>진행 중</button><button type="button" aria-pressed={history} onClick={() => setHistory(true)}>완료 기록</button></div>{feedback}
    {visible.length ? <div className="challenge-list">{visible.map(item => { const progress = challengeProgress(item,userId); return <button type="button" key={item.id} onClick={() => select(item.id)}><span aria-hidden="true" className="challenge-emoji">{challengeTemplates.find(template => template.id === item.template)?.emoji}</span><span><strong>{item.title}</strong><small>{item.startDate} ~ {item.endDate} · 주 {item.weeklyTarget}회</small><small>{item.participantIds.includes(userId) ? `이번 주 ${progress.weeklyCount}/${progress.weeklyTarget}회 · 누적 ${progress.totalCount}회` : `참가 ${item.participantIds.length}명 · 자율 참가`}</small></span><ChevronRight size={18}/></button>; })}</div> : <div className="challenge-empty"><p>{history ? '아직 완료한 도전이 없어요.' : '작은 도전을 함께 시작해 보세요.'}</p><small>{history ? '기간이 끝나거나 종료한 챌린지의 인증 기록이 남아요.' : '산책·독서·맛집 기록·여행 사진 등 원하는 도전을 만들 수 있어요.'}</small></div>}
  </section>;
}
