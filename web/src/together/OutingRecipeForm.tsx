import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Route, Users } from 'lucide-react';
import { OUTING_RECIPE_TITLE_LIMIT, type OutingRecipeInput, type OutingRecipePreview } from './outingRecipe';
import './outing-recipe.css';

export interface OutingRecipeFormProps {
  preview: OutingRecipePreview; requestId: string; signedIn: boolean;
  groups: Array<{ id: string; name: string }>;
  initial?: Pick<OutingRecipeInput, 'title' | 'date'>;
  onCreate: (input: OutingRecipeInput) => boolean;
  onLogin: (draft: Pick<OutingRecipeInput, 'title' | 'date'>) => void;
}
export default function OutingRecipeForm({ preview, requestId, signedIn, groups, initial, onCreate, onLogin }: OutingRecipeFormProps) {
  const [title, setTitle] = useState(() => initial?.title ?? `${preview.title} 함께하기`.slice(0, OUTING_RECIPE_TITLE_LIMIT));
  const [date, setDate] = useState(initial?.date ?? ''), [groupId, setGroupId] = useState(''), [consent, setConsent] = useState(false), [error, setError] = useState('');
  const destination = groupId ? groups.find(group => group.id === groupId) : null;
  const destinationLabel = groupId ? destination?.name || '선택한 모임을 다시 확인해 주세요' : '새 비공개 일회성 모임';
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!signedIn) return onLogin({ title, date });
    try { if (!onCreate({ requestId, title, date, groupId: groupId || undefined, consent })) setError('저장하지 못했어요. 입력한 내용은 유지돼요.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '코스를 다시 확인해 주세요.'); }
  };
  return <form className="outing-recipe" onSubmit={submit}>
    <header><Route size={22}/><div><h3>{preview.title}</h3><p>{preview.region} · {preview.dayCount}일 · {preview.placeCount}곳</p></div></header>
    <p>가고 싶은 코스를 우리 약속으로 만들어요. 멤버를 초대한 뒤 가능한 장소와 날짜를 함께 결정할 수 있어요.</p>
    <details><summary>가져올 장소와 방문 순서<ArrowRight size={16}/></summary><ol>{preview.placeNames.map((names, index) => <li key={index}><strong>DAY {index + 1}</strong><span>{names.join(' → ') || '장소 미정'}</span></li>)}</ol></details>
    <div className="outing-recipe-destination"><Users size={18}/><label>함께할 공간<select value={groupId} onChange={event => { setGroupId(event.target.value); setConsent(false); }}><option value="">새 일회성 모임 · 초대할 사람끼리</option>{groupId && !destination && <option value={groupId} disabled>선택한 모임의 접근 상태가 바뀌었어요</option>}{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
    <label>약속 이름<input required maxLength={OUTING_RECIPE_TITLE_LIMIT} value={title} onChange={event => setTitle(event.target.value)}/></label>
    <div className="outing-recipe-date"><CalendarDays size={18}/><label>시작 날짜 · 선택<input type="date" value={date} min={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })} onInput={event => setDate(event.currentTarget.value)} onChange={event => setDate(event.target.value)}/></label></div>
    <small>날짜를 비우면 멤버들과 정할 수 있어요. 코스의 과거 날짜와 참석 상태는 가져오지 않아요.</small>
    <section className="outing-recipe-review" aria-label="만들어질 약속 확인"><h4>만들어질 약속</h4><dl><div><dt>함께할 공간</dt><dd>{destinationLabel}</dd></div><div><dt>시작 날짜</dt><dd>{date || '멤버들과 정하기'}</dd></div><div><dt>가져올 내용</dt><dd>{preview.dayCount}개 DAY · 장소 {preview.placeCount}곳의 방문 순서</dd></div></dl></section>
    <label className="outing-recipe-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>장소와 방문 순서 사본을 {groupId ? '선택한 모임에' : '새 비공개 방에'} 담을게요.<small>원본의 글·개인 사진·메모·예약은 복사하지 않아요. 원본 공개 범위도 유지돼요.</small></span></label>
    {error && <p className="outing-recipe-error" role="alert">{error}</p>}
    <button type="submit" className="outing-recipe-primary" disabled={signedIn && (!consent || Boolean(groupId && !destination))}>{signedIn ? '이 동선으로 약속 만들기' : '로그인하고 이어서 만들기'}<ArrowRight size={18}/></button>
  </form>;
}
