import { useRef, useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { EmptyPersonalTripRequest } from './emptyPersonalTrip';
import { planningAiAvailable } from './planningAiAvailability';
import './trip-start.css';

export default function TripStartPanel({ title, onTitleChange, onCreate, onRecommend, onCancel }: {
  title: string;
  onTitleChange: (title: string) => void;
  onCreate: (request: EmptyPersonalTripRequest) => boolean;
  onRecommend: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const submitting = useRef(false);
  const request = useRef({ title: '', requestId: crypto.randomUUID() });
  const create = () => {
    if (submitting.current || completed) return;
    submitting.current = true; setError('');
    if (request.current.title !== title) request.current = { title, requestId: crypto.randomUUID() };
    try {
      if (onCreate(request.current)) setCompleted(true);
      else setError('저장하지 못했어요. 이름은 그대로이니 다시 눌러 주세요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '여행을 만들지 못했어요. 다시 눌러 주세요.'); }
    finally { submitting.current = false; }
  };
  return <form className="trip-start" onSubmit={event => { event.preventDefault(); create(); }}>
    <p className="trip-start-intro">날짜와 장소는 여행을 만든 뒤 정할 수 있어요.</p>
    <label>여행 이름 <small>선택</small><input aria-label="여행 이름" value={title} maxLength={100} placeholder="예: 부산 가족 여행" autoComplete="off" onChange={event => { onTitleChange(event.target.value); setError(''); }}/></label>
    <p className="trip-start-note">이름을 비우면 ‘새 여행’으로 저장돼요.</p>
    {error && <p className="trip-start-error" role="alert">{error}</p>}
    <button type="submit" className="trip-start-create" disabled={completed}>{completed ? '여행을 열고 있어요…' : '여행 만들기'}<ArrowRight size={18}/></button>
    <div className="trip-start-secondary"><button type="button" onClick={onCancel}>나가기</button><button type="button" onClick={onRecommend}>{planningAiAvailable ? 'AI로 여행 일정 짜기' : '여행 일정 자동으로 짜기'}<ChevronRight size={16}/></button></div>
  </form>;
}
