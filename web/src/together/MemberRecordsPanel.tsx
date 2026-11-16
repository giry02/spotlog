import { useState, type ReactNode } from 'react';
import { BookOpen, CalendarDays, ChevronDown, ChevronRight, ImageOff, ImagePlus, MessageSquareText, Plus, PenLine, X, ZoomIn } from 'lucide-react';
import type { Journey } from '../data';
import { memberName, type TogetherMedia, type TogetherState } from './model';
import { initialMemberRecordTab, ownShareableJournals, selectMemberRecords, type MemberRecordTab } from './memberRecords';
import { MemberAvatar } from './GroupMembersPanel';
import { selectMemberProfile } from './memberProfile';
import { captureMemberJournalConfirmation, isMemberJournalConfirmationCurrent, type MemberJournalConfirmation } from './memberJournalConfirmation';
import './member-records.css';

type RecordTab = MemberRecordTab;
export function MemberRecordMedia({ item }: { item: TogetherMedia }) {
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  const label = item.caption || (item.kind === 'VIDEO' ? '공유한 영상' : '공유한 사진');
  if (failed === item.url) return <div className="tg-member-records__media-error"><ImageOff size={24} aria-hidden="true"/><span>{item.kind === 'VIDEO' ? '영상을' : '사진을'} 불러오지 못했어요.</span><button type="button" onClick={() => { setFailed(''); setAttempt(value => value + 1); }}>다시 불러오기</button></div>;
  return item.kind === 'VIDEO' ? <video key={`${item.url}:${attempt}`} src={item.url} controls preload="metadata" aria-label={label} onError={() => setFailed(item.url)}/> : <a href={item.url} target="_blank" rel="noreferrer"><img key={`${item.url}:${attempt}`} src={item.url} alt={label} loading="lazy" onError={() => setFailed(item.url)}/></a>;
}
function MemberPostPhoto({ photo, onOpenRecord }: { photo: { id: string; recordId: string; url: string; caption: string }; onOpenRecord?: (type: 'POST' | 'MEDIA', id: string) => void }) {
  const [failed, setFailed] = useState(''), [attempt, setAttempt] = useState(0);
  const photoImage = <img key={`${photo.url}:${attempt}`} src={photo.url} alt={onOpenRecord ? '' : photo.caption} loading="lazy" onError={() => setFailed(photo.url)}/>;
  return <figure>{failed === photo.url ? <><div className="tg-member-records__media-error"><ImageOff size={24} aria-hidden="true"/><span>사진을 불러오지 못했어요.</span><button type="button" onClick={() => { setFailed(''); setAttempt(value => value + 1); }}>다시 불러오기</button></div>{onOpenRecord && <button type="button" className="tg-member-profile__photo-source" onClick={() => onOpenRecord('POST', photo.recordId)}>게시글 원문 보기<ChevronRight size={14}/></button>}</> : onOpenRecord ? <button type="button" aria-label={`${photo.caption} 게시글 원문 보기`} onClick={() => onOpenRecord('POST', photo.recordId)}>{photoImage}</button> : <a href={photo.url} target="_blank" rel="noreferrer">{photoImage}</a>}<figcaption>{photo.caption}</figcaption></figure>;
}
interface Props {
  state: TogetherState; viewerId: string; groupId: string; activityId?: string; initialAuthorId?: string; initialTab?: RecordTab;
  onShare: () => void; onScopeChange: (activityId: string, authorId: string, tab: RecordTab) => void; renderRecords: (authorId: string, tab: RecordTab) => ReactNode;
  onOpenComment: (authorId: string, postId: string, commentId: string) => void;
  onOpenActivity: (authorId: string, activityId: string) => void;
  onEditProfile?: () => void;
  onOpenRecord?: (type: 'POST' | 'MEDIA', id: string) => void;
}
export default function MemberRecordsPanel({ state, viewerId, groupId, activityId, initialAuthorId, initialTab, onShare, onScopeChange, renderRecords, onOpenComment, onOpenActivity, onEditProfile, onOpenRecord }: Props) {
  const [authorId, setAuthorId] = useState(initialAuthorId || viewerId);
  const [chosenTab, setTab] = useState<RecordTab | undefined>(initialTab);
  const [expandedAvatar, setExpandedAvatar] = useState('');
  const [failedAvatar, setFailedAvatar] = useState('');
  const group = state.groups.find(item => item.id === groupId);
  const records = selectMemberRecords(state, viewerId, groupId, authorId, activityId);
  const profile = selectMemberProfile(state, viewerId, groupId, authorId, activityId);
  if (!group || !records || !profile) return <p>현재 모임원만 이 공간에 공유한 기록을 볼 수 있어요.</p>;
  const tab = chosenTab || (profile.counts.media > 0 ? 'media' : initialMemberRecordTab(records));
  const tabs: [RecordTab, string][] = [['journals', '여행기'], ['media', '앨범'], ['posts', '게시글'], ['comments', '댓글'], ['activities', '참여']];
  const avatarKey = `${authorId}:${profile.identity.avatar}`;
  const hasPhoto = Boolean(profile.identity.avatar && failedAvatar !== profile.identity.avatar);
  const dateLabel = (date: string) => date ? new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : '날짜 미정';
  return <div className="tg-member-records">
    <section className="tg-member-profile tg-member-profile--records" aria-label={`${profile.identity.name}님의 모임 프로필`}>
      <div className="tg-member-profile__photo">{hasPhoto ? <button type="button" aria-label={`${profile.identity.name}님의 프로필 사진 크게 보기`} aria-expanded={expandedAvatar === avatarKey} onClick={() => setExpandedAvatar(expandedAvatar === avatarKey ? '' : avatarKey)}><MemberAvatar name={profile.identity.name} avatar={profile.identity.avatar} large onImageError={() => { setFailedAvatar(profile.identity.avatar); setExpandedAvatar(''); }}/><span><ZoomIn size={13}/></span></button> : <MemberAvatar name={profile.identity.name} large/>}</div>
      <div className="tg-member-profile__name"><span>{profile.identity.role}{profile.isOwn && ' · 나'}</span><h3>{profile.identity.name}</h3><p>{group.name}</p></div>
      {profile.canEdit && onEditProfile && <button type="button" className="tg-member-profile__edit" aria-label="내 모임 프로필 편집" onClick={onEditProfile}><PenLine size={18}/></button>}
      {profile.identity.introduction && <details className="tg-member-profile__introduction"><summary>함께 나누는 소개<ChevronDown size={16}/></summary><p>{profile.identity.introduction}</p></details>}
    </section>
    {hasPhoto && expandedAvatar === avatarKey && <section className="tg-member-profile__expanded-photo" aria-label="확대한 프로필 사진"><div><strong>{profile.identity.name}</strong><button type="button" aria-label="프로필 사진 접기" onClick={() => setExpandedAvatar('')}><X size={18}/></button></div><img src={profile.identity.avatar} alt={`${profile.identity.name}님의 공유 프로필 사진`} onError={() => { setFailedAvatar(profile.identity.avatar); setExpandedAvatar(''); }}/></section>}
    <details className="tg-member-records__filters"><summary><span>{activityId ? state.activities.find(item => item.id === activityId)?.title : '모임 전체'} · 범위·멤버 변경</span><ChevronDown size={16}/></summary><div>
    <label className="tg-member-records__person">공유 기록 범위<select aria-label="멤버 기록 범위" value={activityId || ''} onChange={event => onScopeChange(event.target.value, authorId, tab)}>{group.spaceType !== 'ACTIVITY' && <option value="">모임 전체</option>}{state.activities.filter(item => item.groupId === groupId).map(item => <option key={item.id} value={item.id}>{item.title} · {item.date || '날짜 미정'}{item.status === 'CANCELLED' ? ' · 취소' : item.status === 'COMPLETED' ? ' · 지난 약속' : ''}</option>)}</select></label>
    <label className="tg-member-records__person">기록을 볼 멤버<select aria-label="기록을 볼 멤버" value={authorId} onChange={event => setAuthorId(event.target.value)}>{group.memberIds.filter(id => !group.blockedMemberIds?.includes(id) && state.members.some(item => item.id === id)).map(id => <option key={id} value={id}>{memberName(state, id, groupId)}{id === viewerId ? ' (나)' : ''}</option>)}</select></label>
    </div></details>
    <div className="tg-member-records__tabs" role="group" aria-label="멤버 기록 종류">{tabs.map(([id, label]) => <button key={id} type="button" aria-label={`${id === 'activities' ? '참여 약속' : label} ${profile.counts[id]}개`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}<span>{profile.counts[id]}</span></button>)}</div>
    {tab === 'activities' && <p className="tg-member-records__hint">{activityId ? '이 약속에서' : '이 모임에서'} 참석으로 선택한 약속이에요.</p>}
    {profile.counts[tab] ? tab === 'comments' ? <div className="tg-member-records__comments">{records.comments.map(comment => <button type="button" key={`${comment.postId}:${comment.id}`} onClick={() => onOpenComment(authorId, comment.postId, comment.id)}><span className="tg-member-records__comment-source"><MessageSquareText size={15}/>{comment.postTitle}<ChevronRight size={15}/></span><strong>{comment.body}</strong><small>{dateLabel(comment.createdAt.slice(0, 10))} · 원문과 댓글 보기</small></button>)}</div> : tab === 'activities' ? <div className="tg-member-records__activities">{records.activities.map(item => <button type="button" key={item.id} onClick={() => onOpenActivity(authorId, item.id)}><span className="tg-member-records__activity-photo">{item.cover ? <img src={item.cover} alt="" loading="lazy"/> : <CalendarDays size={24}/>}</span><span><small>{dateLabel(item.date)}{item.startTime ? ` · ${item.startTime}` : ''}</small><strong>{item.title}</strong><small>{item.status === 'CANCELLED' ? '취소된 약속' : item.status === 'COMPLETED' ? '완료된 약속' : '참석 선택'}</small></span><ChevronRight size={17}/></button>)}</div> : tab === 'media' ? <>{records.media.length > 0 && renderRecords(authorId, tab)}{profile.postPhotos.length > 0 && <section className="tg-member-profile__post-photos"><h4>게시글에 올린 사진</h4><div>{profile.postPhotos.map(photo => <MemberPostPhoto key={photo.id} photo={photo} onOpenRecord={onOpenRecord}/>)}</div></section>}</> : renderRecords(authorId, tab) : <div className="tg-member-records__empty"><strong>{memberName(state, authorId, groupId)}님의 {tabs.find(([id]) => id === tab)?.[1]} 기록이 없어요.</strong><p>{tab === 'activities' ? '이 범위에서 참석으로 선택한 약속이 없어요.' : tab === 'comments' ? '이 범위의 게시글에 남긴 댓글이 없어요.' : '개인 비공개 기록은 여기에 자동으로 표시되지 않아요.'}</p></div>}
    {profile.isOwn && profile.canEdit && <button type="button" className="tg-primary tg-member-records__share" onClick={onShare}><Plus size={17}/>이 공간에 내 기록 공유하기</button>}
    {!profile.isOwn && <button type="button" className="tg-member-records__own-link" onClick={() => { setAuthorId(viewerId); setTab(undefined); }}>이 공간의 내 기록 보기<ChevronRight size={16}/></button>}
  </div>;
}

interface ShareProps {
  journeys: ReadonlyArray<Journey>; scopeLabel: string; onShare: (journey: Journey) => boolean;
  initialJourneyId?: string;
  sharedSourceIds: ReadonlyArray<string>;
  onPost: () => void; onUpload: () => void; onBack: () => void;
}
export function MemberRecordSharePanel({ journeys, scopeLabel, sharedSourceIds, initialJourneyId, onShare, onPost, onUpload, onBack }: ShareProps) {
  const candidates = ownShareableJournals(journeys);
  const [selectedId, setSelectedId] = useState(() => candidates.some(item => item.id === initialJourneyId) ? initialJourneyId! : '');
  const [confirmation, setConfirmation] = useState<MemberJournalConfirmation | null>(null);
  const selected = candidates.find(item => item.id === selectedId);
  const confirmed = isMemberJournalConfirmationCurrent(confirmation, selected, scopeLabel);
  const alreadyShared = Boolean(selected && sharedSourceIds.includes(selected.id));
  return <div className="tg-member-records tg-member-records-share">
    <div className="tg-member-records__scope"><strong>{scopeLabel}</strong><small>공유할 공간을 확인해 주세요.</small></div>
    <div className="tg-member-records__create"><button type="button" onClick={onUpload}><ImagePlus size={19}/><span>사진·영상 올리기</span><ChevronRight size={17}/></button><button type="button" onClick={onPost}><PenLine size={19}/><span>게시글 쓰기</span><ChevronRight size={17}/></button></div>
    <label className="tg-member-records__person"><span><BookOpen size={17}/>내 여행기 선택</span><select aria-label="공유할 내 여행기" value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirmation(null); }}><option value="">완료한 여행기를 선택해 주세요</option>{candidates.map(item => <option key={item.id} value={item.id}>{item.title}{sharedSourceIds.includes(item.id) ? ' · 이미 공유됨' : item.visibility === 'PRIVATE' ? ' · 비공개 원본' : ''}</option>)}</select></label>
    {!candidates.length && <p className="tg-muted">아직 완료한 내 여행기가 없어요. 작성한 여행기를 완료하면 선택할 수 있어요.</p>}
    {selected && <><article className="tg-member-records__preview">{selected.cover && <img src={selected.cover} alt=""/>}<div><strong>{selected.title}</strong><small>{selected.region} · {selected.duration}</small><small>원본: {selected.visibility === 'PRIVATE' ? '비공개' : '공개'} 유지</small></div></article>{alreadyShared ? <><p className="tg-muted">이미 공유한 여행기예요. 기존 공유본을 확인해 주세요. 원본을 수정해도 공유본은 자동으로 바뀌지 않아요.</p><button type="button" onClick={onBack}>공유한 여행기 보기</button></> : <><p className="tg-muted">선택한 여행기의 글·사진·동선을 별도 사본으로 공유해요. 개인 메모·예약 정보는 공유하지 않으며 원본 공개 범위는 바뀌지 않아요.</p>{confirmation && !confirmed && <p className="tg-muted" role="status">선택한 여행기나 공유할 공간이 바뀌었어요. 내용을 확인하고 다시 선택해 주세요.</p>}<label className="tg-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmation(event.target.checked ? captureMemberJournalConfirmation(selected, scopeLabel) : null)}/><span>이 공간의 모임원에게 선택한 버전을 공유할게요.</span></label><button type="button" className="tg-primary" disabled={!confirmed} onClick={() => { if (isMemberJournalConfirmationCurrent(confirmation, selected, scopeLabel)) onShare(selected); }}>확인하고 여행기 공유</button></>}</>}
    <button type="button" className="tg-text-button" onClick={onBack}>멤버별 기록으로</button>
  </div>;
}
