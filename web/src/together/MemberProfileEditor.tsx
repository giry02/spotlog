import { useId, useState } from 'react';
import { Check, ChevronDown, UserRound } from 'lucide-react';
import type { TogetherState } from './model';
import { MemberAvatar } from './GroupMembersPanel';
import { TogetherPhotoPicker } from './ReviewPostComposer';
import { selectMemberProfile, type MemberPresentationInput } from './memberProfile';
import { getOwnRoomProfilePresets } from './roomIdentity';
import './member-profile.css';

interface Props {
  state: TogetherState; viewerId: string; groupId: string; activityId?: string;
  onSave: (input: MemberPresentationInput) => boolean; onCancel: () => void;
}
export default function MemberProfileEditor(props: Props) {
  return <MemberProfileForm key={`${props.viewerId}:${props.groupId}:${props.activityId || ''}`} {...props}/>;
}
function MemberProfileForm({ state, viewerId, groupId, activityId, onSave, onCancel }: Props) {
  const profile = selectMemberProfile(state, viewerId, groupId, viewerId, activityId);
  const [nickname, setNickname] = useState(profile?.editablePresentation?.nickname ?? '');
  const [introduction, setIntroduction] = useState(profile?.editablePresentation?.introduction ?? '');
  const [avatar, setAvatar] = useState(profile?.editablePresentation?.avatar ?? '');
  const [error, setError] = useState('');
  const [reused, setReused] = useState(false);
  const fieldId = useId();
  if (!profile?.canEdit) return <div className="tg-member-profile-editor"><p>참여 중인 모임에서 멀티프로필을 설정할 수 있어요. 가족·친구는 내 계정 기본 프로필이 표시돼요.</p><button type="button" onClick={onCancel}>돌아가기</button></div>;
  const presets = getOwnRoomProfilePresets(state, viewerId);
  const roomName = profile.activityName || profile.groupName;
  const roomContext = profile.activityName ? `${profile.groupName} · 약속 대화` : '모임 전체 프로필';
  return <form className="tg-form tg-member-profile-editor" onSubmit={event => {
    event.preventDefault(); setError('');
    if (!onSave({ nickname, introduction, avatar })) setError('저장하지 못했어요. 입력한 내용을 유지했으니 확인 후 다시 저장해 주세요.');
  }}>
    <div className="tg-member-profile-editor__context"><UserRound size={18}/><div><strong>{roomName}</strong><span>{roomContext}</span></div></div>
    {presets.length > 0 && <details className="tg-profile-presets">
      <summary>이전에 쓴 프로필<ChevronDown size={17} aria-hidden="true"/></summary>
      <ul>{presets.map((preset, index) => <li key={index}>
        <button type="button" aria-label={`${preset.nickname || '사진만 있는 프로필'} 불러오기`} onClick={() => { setNickname(preset.nickname); setAvatar(preset.avatar); setReused(true); }}>
          <MemberAvatar name={preset.nickname || '사진 프로필'} avatar={preset.avatar}/>
          <span>{preset.nickname || '사진만 있는 프로필'}</span>
          {preset.nickname === nickname && preset.avatar === avatar && <Check size={17} aria-hidden="true"/>}
        </button>
      </li>)}</ul>
    </details>}
    {reused && <p role="status" className="tg-profile-presets__status">닉네임과 사진을 불러왔어요. 저장하면 이 방에 적용돼요.</p>}
    <section className="tg-member-profile-editor__photo">
      <MemberAvatar name={nickname || profile.identity.name} avatar={avatar} large/>
      <div><TogetherPhotoPicker purpose="AVATAR" label={avatar ? '사진 바꾸기' : '내 사진 등록'} onSelect={value => { setAvatar(value); setReused(false); }}/>{avatar && <button type="button" className="tg-text-button" onClick={() => { setAvatar(''); setReused(false); }}>사진 빼기</button>}</div>
    </section>
    <label><span id={`${fieldId}-name`}>이 방에서 쓸 닉네임</span><input aria-labelledby={`${fieldId}-name`} aria-describedby={`${fieldId}-name-description`} value={nickname} onChange={event => { setNickname(event.target.value); setReused(false); }} maxLength={40} placeholder="닉네임을 입력해 주세요"/><small id={`${fieldId}-name-description`}>선택한 방의 대화와 기록에 표시돼요.</small></label>
    <label>멤버에게 보여줄 소개<textarea value={introduction} onChange={event => setIntroduction(event.target.value)} maxLength={600} rows={3} placeholder="함께하고 싶은 활동을 적어 주세요."/><small aria-hidden="true">{introduction.length}/600</small></label>
    {error && <p className="tg-error" role="alert">{error}</p>}
    <div className="tg-member-profile-editor__actions"><button type="button" onClick={onCancel}>취소</button><button type="submit" className="tg-primary"><Check size={17}/>프로필 저장</button></div>
  </form>;
}
