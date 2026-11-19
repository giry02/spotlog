import { useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import type { TogetherState } from '../together/model';
import type { MemberPresentationInput } from '../together/memberProfile';
import MemberProfileEditor from '../together/MemberProfileEditor';
import { ownGroupProfileChoices } from './ownGroupProfiles';
import './own-group-profiles.css';

interface Props {
  state: TogetherState; viewerId: string; onClose: () => void;
  onSave: (groupId: string, input: MemberPresentationInput) => boolean;
  onFindGroups: () => void;
}

/** The My screen stays mounted underneath this account-keyed, route-free self-service sheet. */
export default function OwnGroupProfilesSheet({ state, viewerId, onClose, onSave, onFindGroups }: Props) {
  const choices = ownGroupProfileChoices(state, viewerId);
  const [selectedId, setSelectedId] = useState(() => choices.length === 1 ? choices[0].id : '');
  const selected = choices.find(group => group.id === selectedId);
  return <BottomSheet title="내 멀티프로필" onClose={onClose}><div className="own-group-profiles">
    <p className="own-group-profiles__intro">가족·친구는 내 계정 기본 프로필을 사용해요. 약속 대화의 프로필은 해당 방에서 정할 수 있어요.</p>
    {selected ? <>
      {choices.length > 1 && <div className="own-group-profiles__scope"><button type="button" onClick={() => setSelectedId('')}><ChevronLeft size={16}/>다른 모임 고르기</button></div>}
      <MemberProfileEditor key={`${viewerId}:${selected.id}`} state={state} viewerId={viewerId} groupId={selected.id} onSave={input => onSave(selected.id, input)} onCancel={onClose}/>
    </> : <>
      {choices.length > 0 && <p>프로필을 편집할 모임을 골라 주세요.</p>}
      {selectedId && <p className="own-group-profiles__unavailable" role="status">선택한 모임의 가입 상태가 바뀌었어요. 지금 편집할 수 있는 모임을 다시 골라 주세요.</p>}
      {choices.length ? <div className="own-group-profiles__choices">{choices.map(group => <button type="button" key={group.id} onClick={() => setSelectedId(group.id)}><span className="own-group-profiles__cover">{group.cover ? <img src={group.cover} alt="" loading="lazy"/> : <Users size={24}/>}</span><span><strong>{group.name}</strong><small>{group.nickname} · {group.role}</small></span><ChevronRight size={17}/></button>)}</div> : <div className="own-group-profiles__empty"><Users size={28}/><strong>편집할 멀티프로필이 없어요</strong><button type="button" onClick={onFindGroups}>모임 둘러보기<ChevronRight size={16}/></button></div>}
    </>}
  </div></BottomSheet>;
}
