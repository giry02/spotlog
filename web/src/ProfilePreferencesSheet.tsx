import { useId, useRef, useState } from 'react';
import { Bookmark, CalendarDays, ChevronDown, CircleHelp, Globe2, MapPin, UserRound } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { Field } from './ui';
import { LanguageControls, useLocale } from './locale';
import './phase-three-integration.css';

export function ProfilePreferencesSheet({ name, onSave, onClose }: { name: string; onSave: (name: string) => boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<'empty' | 'save' | null>(null);
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const save = () => {
    if (saving.current) return;
    const next = draft.trim();
    if (!next) { setError('empty'); input.current?.focus(); return; }
    saving.current = true;
    try { if (onSave(next)) onClose(); else setError('save'); }
    catch { setError('save'); }
    finally { saving.current = false; }
  };
  return <BottomSheet title={en ? 'Profile & preferences' : '프로필 · 이용 설정'} onClose={onClose}>
    <div className="phase-three-settings">
      <LanguageControls />
      <form onSubmit={event => { event.preventDefault(); save(); }}>
        <Field label={en ? 'Display name' : '활동 이름'}><input ref={input} aria-label={en ? 'Display name' : '활동 이름'} aria-invalid={error === 'empty'} aria-describedby={error ? errorId : undefined} autoComplete="nickname" value={draft} maxLength={30} onChange={event => { setDraft(event.target.value); setError(null); }} /></Field>
        <p>{en ? 'Your current name and profile image appear on your place comments, including earlier comments.' : '현재 활동 이름과 프로필 사진이 이전에 작성한 장소 댓글에도 표시됩니다.'}</p>
        {error && <p id={errorId} className="ui-error" role="alert">{error === 'empty' ? en ? 'Enter a display name.' : '활동 이름을 입력해 주세요.' : en ? 'Could not save. Your name is unchanged.' : '저장하지 못했어요. 기존 이름은 유지됩니다.'}</p>}
        <button className="primary wide" type="submit"><UserRound size={16} />{en ? 'Save profile' : '프로필 저장'}</button>
      </form>
      <details><summary><CircleHelp size={16}/><span>{en ? 'Using Spotlog' : 'Spotlog 이용 안내'}</span><ChevronDown size={16}/></summary><ol>
        <li><Bookmark size={17}/><span>{en ? 'Save landmarks from Places. Swipe sideways for photos and vertically for the next place.' : '장소에서 랜드마크를 저장하세요. 사진은 좌우로, 다음 장소는 위아래로 넘길 수 있어요.'}</span></li>
        <li><CalendarDays size={17}/><span>{en ? 'In Saved, choose a duration and create a trip, or assign places to each DAY first.' : '저장에서 기간만 정해 바로 만들거나, DAY별로 장소를 담아 여행을 만드세요.'}</span></li>
        <li><MapPin size={17}/><span>{en ? 'In My trips, add nearby restaurants or stays to each landmark and adjust your route.' : '내 여행에서 랜드마크 주변 식당·숙소를 추가하고 동선을 조정하세요.'}</span></li>
        <li><Globe2 size={17}/><span>{en ? 'A private trip is your itinerary. Write a separate journal when you want to share your experience.' : '내 여행은 나를 위한 동선이에요. 경험을 공유하고 싶을 때 별도로 여행기를 작성하세요.'}</span></li>
      </ol></details>
      <p className="phase-three-storage-note">{en ? 'This preview stores your profile and trips on this device. Account sign-in and cross-device sync will use the connected service.' : '현재 미리보기의 프로필과 여행은 이 기기에 저장됩니다. 계정 로그인·기기 간 동기화는 서버 연결 단계에 적용됩니다.'}</p>
    </div>
  </BottomSheet>;
}
