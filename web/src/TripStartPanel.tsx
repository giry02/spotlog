import { useRef, useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { EmptyPersonalTripRequest } from './emptyPersonalTrip';
import './trip-start.css';

export default function TripStartPanel({ onCreate, onRecommend, onCancel }: {
  onCreate: (request: EmptyPersonalTripRequest) => boolean;
  onRecommend: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
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
    <div className="trip-start-heading"><h2>여행부터 만들어 볼까요?</h2><p>먼저 만들고, 열린 여행에서 날짜와 가고 싶은 곳을 정해요.</p></div>
    <label>여행 이름 <small>선택</small><input aria-label="여행 이름" value={title} maxLength={100} placeholder="예: 부산 가족 여행" autoComplete="off" onChange={event => { setTitle(event.target.value); setError(''); }}/></label>
    <p className="trip-start-note">이름을 비워 두면 ‘새 여행’으로 시작해요. 나중에 바꿀 수 있어요.</p>
    {error && <p className="trip-start-error" role="alert">{error}</p>}
    <button type="submit" className="trip-start-create" disabled={completed}>{completed ? '여행을 열고 있어요…' : '여행 만들기'}<ArrowRight size={18}/></button>
    <div className="trip-start-secondary"><button type="button" onClick={onCancel}>나가기</button><button type="button" onClick={onRecommend}>추천 코스로 시작하기<ChevronRight size={16}/></button></div>
  </form>;
}
