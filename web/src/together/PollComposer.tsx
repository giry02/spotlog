import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Plus, Trash2, Type } from 'lucide-react';
import { togetherId } from './model';
import { POLL_OPTION_LIMIT, type PollInput, type PollOptionInput } from './polls';
import './polls.css';

export interface PollComposerProps {
  initial?: PollInput;
  onCreate: (input: PollInput) => boolean | Promise<boolean>;
  onCancel?: () => void;
  submitLabel?: string;
}
const dateTimeForInput = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16) : '';
const emptyOption = (): PollOptionInput => ({ label: '', date: '', time: '' });

export default function PollComposer({ initial, onCreate, onCancel, submitLabel = '이 대화방에 투표 올리기' }: PollComposerProps) {
  const [id] = useState(() => initial?.id || togetherId('poll'));
  const [question, setQuestion] = useState(initial?.question || '');
  const [kind, setKind] = useState<'TEXT' | 'DATE'>(initial?.kind || 'TEXT');
  const [options, setOptions] = useState<PollOptionInput[]>(() => initial?.options.map(item => ({ ...item })) || [emptyOption(), emptyOption()]);
  const [multiple, setMultiple] = useState(initial?.multiple === true);
  const [anonymous, setAnonymous] = useState(initial?.anonymous === true);
  const [closesAt, setClosesAt] = useState(() => dateTimeForInput(initial?.closesAt));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const running = useRef(false);
  const patchOption = (index: number, patch: Partial<PollOptionInput>) => { setOptions(current => current.map((item, at) => at === index ? { ...item, ...patch } : item)); setError(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (running.current) return;
    setError('');
    if (!question.trim() || options.length < 2 || options.some(item => kind === 'DATE' ? !item.date : !item.label?.trim())) { setError('투표 제목과 후보를 두 개 이상 입력해 주세요.'); return; }
    let deadline: string | undefined;
    if (closesAt) {
      const time = Date.parse(`${closesAt}:00+09:00`);
      if (!Number.isFinite(time)) { setError('마감 시각을 다시 확인해 주세요.'); return; }
      deadline = new Date(time).toISOString();
    }
    const input: PollInput = { id, question, kind, options: options.map(item => kind === 'DATE' ? { date: item.date, ...(item.time ? { time: item.time } : {}) } : { label: item.label }), multiple, anonymous, ...(deadline ? { closesAt: deadline } : {}) };
    running.current = true; setBusy(true);
    try { if (!await onCreate(input)) setError('투표를 저장하지 못했어요. 입력한 내용을 유지하고 있어요.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '투표를 저장하지 못했어요. 다시 확인해 주세요.'); }
    finally { running.current = false; setBusy(false); }
  };
  return <form className="room-poll-composer" onSubmit={event => void submit(event)}>
    <div className="room-poll-kind" role="group" aria-label="투표 종류"><button type="button" aria-pressed={kind === 'TEXT'} disabled={busy} onClick={() => { setKind('TEXT'); setError(''); }}><Type size={18}/>텍스트</button><button type="button" aria-pressed={kind === 'DATE'} disabled={busy} onClick={() => { setKind('DATE'); setError(''); }}><CalendarDays size={18}/>날짜</button></div>
    <label>투표 제목<input aria-label="투표 제목" value={question} maxLength={160} disabled={busy} placeholder="무엇을 함께 고를까요?" onChange={event => { setQuestion(event.target.value); setError(''); }}/></label>
    <fieldset className="room-poll-options"><legend>{kind === 'DATE' ? '가능한 날짜 후보' : '선택할 후보'}</legend>{options.map((option, index) => <div className="room-poll-option-edit" key={index}><div>{kind === 'DATE' ? <><label>후보 {index + 1} 날짜<input type="date" aria-label={`투표 후보 ${index + 1} 날짜`} value={option.date || ''} disabled={busy} onChange={event => patchOption(index, { date: event.target.value })}/></label><label>시각 · 선택<input type="time" aria-label={`투표 후보 ${index + 1} 시각`} value={option.time || ''} disabled={busy} onChange={event => patchOption(index, { time: event.target.value })}/></label></> : <label>후보 {index + 1}<input aria-label={`투표 후보 ${index + 1}`} value={option.label || ''} maxLength={160} disabled={busy} placeholder={`후보 ${index + 1}`} onChange={event => patchOption(index, { label: event.target.value })}/></label>}</div><button type="button" className="room-poll-icon" aria-label={`투표 후보 ${index + 1} 삭제`} disabled={busy || options.length <= 2} onClick={() => setOptions(current => current.filter((_, at) => at !== index))}><Trash2 size={18}/></button></div>)}</fieldset>
    <button type="button" className="room-poll-add" disabled={busy || options.length >= POLL_OPTION_LIMIT} onClick={() => setOptions(current => [...current, emptyOption()])}><Plus size={18}/>후보 추가<span>{options.length}/{POLL_OPTION_LIMIT}</span></button>
    <div className="room-poll-settings"><label className="room-poll-check"><input type="checkbox" checked={multiple} disabled={busy} onChange={event => setMultiple(event.target.checked)}/><span>복수 선택<small>가능한 후보를 여러 개 고를 수 있어요.</small></span></label><label className="room-poll-check"><input type="checkbox" checked={anonymous} disabled={busy} onChange={event => setAnonymous(event.target.checked)}/><span>투표자 이름 숨기기<small>결과 화면에 투표자 이름을 표시하지 않아요.</small></span></label><label>마감 시각 · 한국 시각, 선택<input type="datetime-local" aria-label="투표 마감 시각" value={closesAt} disabled={busy} onChange={event => setClosesAt(event.target.value)}/></label></div>
    <p className="room-poll-note">투표 결과만으로 일정·예약·참석은 바뀌지 않아요.</p>
    {error && <p className="room-poll-error" role="alert">{error}</p>}
    <button type="submit" className="room-poll-primary" disabled={busy}>{busy ? '저장 중…' : submitLabel}</button>{onCancel && <button type="button" className="room-poll-cancel" disabled={busy} onClick={onCancel}>취소</button>}
  </form>;
}
