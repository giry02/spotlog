import { useState, type FormEvent } from 'react';
import { BriefcaseBusiness, CalendarClock, Users, Utensils } from 'lucide-react';
import { TEMPORARY_ROOM_PURPOSES, temporaryRoomPurposeLabel, type TemporaryRoomInput } from './temporaryRooms';
import './temporary-rooms.css';

export default function TemporaryRoomForm({ draft, onChange, onCreate }: { draft: TemporaryRoomInput; onChange: (value: TemporaryRoomInput) => void; onCreate: (value: TemporaryRoomInput) => boolean }) {
  const [error, setError] = useState('');
  const [endInput, setEndInput] = useState(() => draft.expiresAt && Number.isFinite(Date.parse(draft.expiresAt)) ? new Date(Date.parse(draft.expiresAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 16) : '');
  const update = (value: Partial<TemporaryRoomInput>) => { onChange({ ...draft, ...value }); setError(''); };
  const changeDate = (value: string) => update({ date: value, ...(value ? {} : { startTime: '' }) });
  const changeEnd = (value: string) => {
    setEndInput(value);
    const instant = value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00+09:00`) : null;
    update({ expiresAt: instant && Number.isFinite(instant.getTime()) ? instant.toISOString() : undefined });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      let expiresAt: string | undefined;
      if (endInput) {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endInput)) throw new Error('자동 종료 시간을 다시 확인해 주세요.');
        const instant = new Date(`${endInput}:00+09:00`);
        if (!Number.isFinite(instant.getTime()) || instant.getTime() <= Date.now()) throw new Error('자동 종료 시간은 지금보다 이후로 선택해 주세요.');
        expiresAt = instant.toISOString();
      }
      if (!onCreate({ ...draft, expiresAt })) setError('저장하지 못했어요. 입력한 내용은 유지하고 있어요.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '모임 내용을 다시 확인해 주세요.'); }
  };
  return <form className="temporary-room-form" onSubmit={submit}>
    <p>계속 활동할 모임을 만들지 않고, 이번 만남에 필요한 장소·대화·투표를 함께 준비해요.</p>
    <div className="temporary-purpose" role="group" aria-label="일회성 모임 용도">{TEMPORARY_ROOM_PURPOSES.map(purpose => {
      const Icon = purpose === 'DINNER' ? Utensils : purpose === 'BUSINESS' ? BriefcaseBusiness : Users;
      return <button type="button" key={purpose} aria-pressed={draft.purpose === purpose} onClick={() => update({ purpose })}><Icon size={19}/>{temporaryRoomPurposeLabel(purpose)}</button>;
    })}</div>
    <label>모임 이름<input required maxLength={80} value={draft.title} onChange={event => update({ title: event.target.value })} placeholder={draft.purpose === 'DINNER' ? '예: 금요일 팀 회식' : draft.purpose === 'BUSINESS' ? '예: 다음 주 고객 미팅' : '예: 주말 저녁 한 끼'}/></label>
    <label>만날 지역<input maxLength={100} value={draft.region || ''} onChange={event => update({ region: event.target.value })} placeholder="예: 부산 해운대"/></label>
    <div className="temporary-room-pair"><label>날짜 · 선택<input type="date" value={draft.date || ''} onInput={event => changeDate(event.currentTarget.value)} onChange={event => changeDate(event.target.value)}/></label><label>시작 시간 · 선택<input type="time" disabled={!draft.date} value={draft.startTime || ''} onInput={event => update({ startTime: event.currentTarget.value })} onChange={event => update({ startTime: event.target.value })}/></label></div>
    <details><summary><CalendarClock size={17}/>자동 종료·안내 설정</summary><div className="temporary-room-extra"><label>자동 종료 시각 · 한국 시간<input type="datetime-local" value={endInput} onInput={event => changeEnd(event.currentTarget.value)} onChange={event => changeEnd(event.target.value)}/></label><small>비워 두면 만든 사람이 직접 종료해요. 자동 종료돼도 기록은 우선 보관하고, 만든 사람이 휴지통 이동 여부를 선택해요.</small><label>함께 볼 안내<textarea rows={3} maxLength={2000} value={draft.description || ''} onChange={event => update({ description: event.target.value })} placeholder="예산이나 만남 목적 등 필요한 내용만 적어 주세요."/></label></div></details>
    <div className="temporary-room-note">초대한 사람만 들어오는 비공개 모임이에요. 모임을 만들거나 초대를 수락하는 것만으로 참석이 확정되지는 않아요.</div>
    {error && <p className="tg-error" role="alert">{error}</p>}
    <button type="submit" className="temporary-room-primary">일회성 모임 만들기</button>
  </form>;
}
