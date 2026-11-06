import { useRef, useState } from 'react';
import { CalendarDays, ChevronRight, MapPin, Route, Users } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import type { Place } from './data';
import type { TogetherState } from './together/model';
import { togetherId } from './together/model';
import { placeProposalBody, placeProposalDestinations, placeProposalVersion, type PlaceProposalTarget } from './together/placeProposal';
import './saved-place-use.css';

interface Props {
  place: Place; state: TogetherState; actorId: string; hasPlacement: boolean;
  onClose: () => void; onTrip: () => void; onAppointment: () => void; onLogin: () => void;
  onPropose: (target: PlaceProposalTarget, expectedVersion: string, requestId: string) => string | null;
}
export default function SavedPlaceUseSheet({ place, state, actorId, hasPlacement, onClose, onTrip, onAppointment, onLogin, onPropose }: Props) {
  const [sharing, setSharing] = useState(false);
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const requestId = useRef(togetherId('proposal'));
  const [expectedVersion, setExpectedVersion] = useState(() => placeProposalVersion(place));
  const sourceChanged = expectedVersion !== placeProposalVersion(place);
  const destinations = placeProposalDestinations(state, actorId);
  const key = (target: PlaceProposalTarget) => JSON.stringify([target.groupId, target.activityId ?? '']);
  const selected = destinations.find(target => key(target) === destination);
  const share = () => {
    if (pending.current) return;
    if (sourceChanged) { setError('장소 정보가 바뀌었어요. 변경된 내용을 먼저 확인해 주세요.'); return; }
    if (!selected) { setError('제안할 모임이나 약속을 선택해 주세요.'); return; }
    pending.current = true;
    const issue = onPropose(selected, expectedVersion, requestId.current);
    if (issue) { pending.current = false; setError(issue); }
  };
  return <BottomSheet title={sharing ? '함께 갈 장소 제안' : '이 장소 활용'} description={place.name} onClose={onClose}>
    <div className="saved-place-use">
      {!sharing ? <div className="saved-place-use-actions">
        <button type="button" onClick={onAppointment}><CalendarDays size={22}/><span><strong>여기서 약속 만들기</strong><small>친구·가족과 만날 비공개 약속</small></span><ChevronRight size={18}/></button>
        <button type="button" onClick={() => actorId ? setSharing(true) : onLogin()}><Users size={22}/><span><strong>모임·약속에 장소 제안</strong><small>선택한 대화방에 장소 정보 공유</small></span><ChevronRight size={18}/></button>
        <button type="button" onClick={onTrip}><Route size={22}/><span><strong>{hasPlacement ? '내 여행 담김 관리' : '내 여행에 담기'}</strong><small>개인 여행의 DAY에 넣거나 변경</small></span><ChevronRight size={18}/></button>
      </div> : <>
        <button type="button" className="saved-place-use-back" onClick={() => { setSharing(false); setError(''); }}>활용 방법 다시 선택</button>
        {destinations.length ? <>
          <label>어디에 제안할까요?<select aria-label="장소를 제안할 대화" value={destination} onChange={event => { setDestination(event.target.value); setError(''); requestId.current = togetherId('proposal'); }}><option value="">모임·약속 선택</option>{destinations.map(target => <option key={key(target)} value={key(target)}>{target.label}</option>)}</select></label>
          <div className="saved-place-proposal-preview"><MapPin size={18}/><div><strong>공유할 장소 정보</strong><p>{placeProposalBody(place)}</p></div></div>
          {sourceChanged && <div role="status"><p>장소 정보가 변경됐어요. 위 내용을 확인해 주세요.</p><button type="button" className="saved-place-use-back" onClick={() => { setExpectedVersion(placeProposalVersion(place)); requestId.current = togetherId('proposal'); setError(''); }}>변경된 장소 정보 확인</button></div>}
          <p className="saved-place-use-note">선택한 대화방 멤버에게 장소명·주소·소개를 제안해요. 약속 장소와 참석 여부는 바뀌지 않아요.</p>
          {selected && !selected.activityId && !place.personal && <p className="saved-place-use-note">등록된 장소는 이 모임의 함께 고를 장소에도 추가돼요.</p>}
          {error && <p className="saved-place-use-error" role="alert">{error}</p>}
          <button type="button" className="saved-place-use-primary" disabled={!selected || sourceChanged} onClick={share}>이 대화에 장소 제안하기</button>
        </> : <div className="saved-place-use-empty"><Users size={24}/><h3>제안할 모임이나 약속이 없어요</h3><p>이 장소에서 새 약속을 만들고 친구를 초대할 수 있어요.</p><button type="button" className="saved-place-use-primary" onClick={onAppointment}>여기서 약속 만들기</button></div>}
      </>}
    </div>
  </BottomSheet>;
}
