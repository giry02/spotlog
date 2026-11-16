import { useState } from 'react';
import { Check, UserRound } from 'lucide-react';
import type { TogetherState } from './model';
import { MemberAvatar } from './GroupMembersPanel';
import { TogetherPhotoPicker } from './ReviewPostComposer';
import { selectMemberProfile, type MemberPresentationInput } from './memberProfile';
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
  const group = state.groups.find(item => item.id === groupId);
  const [nickname, setNickname] = useState(group?.memberPresentations?.[viewerId]?.nickname ?? group?.memberProfiles?.[viewerId]?.nickname ?? '');
  // Never prefill the private joining introduction into the shared presentation field.
  const [introduction, setIntroduction] = useState(profile?.identity.introduction || '');
  const [avatar, setAvatar] = useState(profile?.identity.avatar || ''), [error, setError] = useState('');
  if (!profile?.canEdit) return <div className="tg-member-profile-editor"><p>현재 참여 중인 모임에서 내 프로필을 수정할 수 있어요.</p><button type="button" onClick={onCancel}>돌아가기</button></div>;
  return <form className="tg-form tg-member-profile-editor" onSubmit={event => {
    event.preventDefault(); setError('');
    if (!onSave({ nickname, introduction, avatar })) setError('저장하지 못했어요. 입력한 내용을 유지했으니 확인 후 다시 저장해 주세요.');
  }}>
    <div className="tg-member-profile-editor__context"><UserRound size={18}/><div><strong>{profile.groupName}</strong><span>내 모임 프로필</span></div></div>
    <section className="tg-member-profile-editor__photo"><MemberAvatar name={nickname || profile.identity.name} avatar={avatar} large/><div><TogetherPhotoPicker purpose="AVATAR" label={avatar ? '사진 바꾸기' : '내 사진 등록'} onSelect={setAvatar}/>{avatar && <button type="button" className="tg-text-button" onClick={() => setAvatar('')}>사진 삭제</button>}</div><p>사진은 내가 참여한 모임과 대화방에서 공통으로 사용해요.</p></section>
    <label>이 모임에서 쓸 닉네임<input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={40} placeholder={state.members.find(item => item.id === viewerId)?.name || '모임 닉네임'}/><small>이 모임의 글·댓글·대화에 표시돼요.</small></label>
    <label>모임원에게 보여줄 소개<textarea value={introduction} onChange={event => setIntroduction(event.target.value)} maxLength={600} rows={4} placeholder="함께하고 싶은 활동이나 나누고 싶은 이야기를 적어 주세요."/><small>{introduction.length}/600 · 비워 두면 소개를 표시하지 않아요.</small></label>
    <p className="tg-member-profile-editor__notice">저장하면 닉네임과 소개를 이 모임원에게 보여줘요. 가입 때 운영진에게 남긴 소개와 질문 답변은 그대로 유지돼요.</p>
    {error && <p className="tg-error" role="alert">{error}</p>}
    <div className="tg-member-profile-editor__actions"><button type="button" onClick={onCancel}>취소</button><button type="submit" className="tg-primary"><Check size={17}/>프로필 저장</button></div>
  </form>;
}
