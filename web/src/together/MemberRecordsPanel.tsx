import { useState, type ReactNode } from 'react';
import { BookOpen, ChevronRight, ImageOff, ImagePlus, Plus, PenLine } from 'lucide-react';
import type { Journey } from '../data';
import { memberName, type TogetherMedia, type TogetherState } from './model';
import { ownShareableJournals, selectMemberRecords } from './memberRecords';
import './member-records.css';

type RecordTab = 'journals' | 'media' | 'posts';
export function MemberRecordMedia({ item }: { item: TogetherMedia }) {
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  const label = item.caption || (item.kind === 'VIDEO' ? '공유한 영상' : '공유한 사진');
  if (failed === item.url) return <div className="tg-member-records__media-error"><ImageOff size={24} aria-hidden="true"/><span>{item.kind === 'VIDEO' ? '영상을' : '사진을'} 불러오지 못했어요.</span><button type="button" onClick={() => { setFailed(''); setAttempt(value => value + 1); }}>다시 불러오기</button></div>;
  return item.kind === 'VIDEO' ? <video key={`${item.url}:${attempt}`} src={item.url} controls preload="metadata" aria-label={label} onError={() => setFailed(item.url)}/> : <a href={item.url} target="_blank" rel="noreferrer"><img key={`${item.url}:${attempt}`} src={item.url} alt={label} loading="lazy" onError={() => setFailed(item.url)}/></a>;
}
interface Props {
  state: TogetherState; viewerId: string; groupId: string; activityId?: string; initialAuthorId?: string; initialTab?: RecordTab;
  onShare: () => void; onScopeChange: (activityId: string, authorId: string, tab: RecordTab) => void; renderRecords: (authorId: string, tab: RecordTab) => ReactNode;
}
export default function MemberRecordsPanel({ state, viewerId, groupId, activityId, initialAuthorId, initialTab = 'journals', onShare, onScopeChange, renderRecords }: Props) {
  const [authorId, setAuthorId] = useState(initialAuthorId || viewerId);
  const [tab, setTab] = useState<RecordTab>(initialTab);
  const group = state.groups.find(item => item.id === groupId);
  const records = selectMemberRecords(state, viewerId, groupId, authorId, activityId);
  if (!group || !records) return <p>현재 모임원만 이 공간에 공유한 기록을 볼 수 있어요.</p>;
  const tabs: [RecordTab, string][] = [['journals', '여행기'], ['media', '앨범'], ['posts', '게시글']];
  return <div className="tg-member-records">
    <div className="tg-member-records__scope"><strong>{activityId ? state.activities.find(item => item.id === activityId)?.title : group.name}</strong><small>{activityId ? '이 약속에 공유한 기록' : '모임 전체에 공유한 기록'}</small></div>
    <label className="tg-member-records__person">기록 범위<select aria-label="멤버 기록 범위" value={activityId || ''} onChange={event => onScopeChange(event.target.value, authorId, tab)}>{group.spaceType !== 'ACTIVITY' && <option value="">모임 전체</option>}{state.activities.filter(item => item.groupId === groupId).map(item => <option key={item.id} value={item.id}>{item.title} · {item.date || '날짜 미정'}{item.status === 'CANCELLED' ? ' · 취소' : item.status === 'COMPLETED' ? ' · 지난 약속' : ''}</option>)}</select></label>
    <label className="tg-member-records__person">기록을 볼 멤버<select aria-label="기록을 볼 멤버" value={authorId} onChange={event => setAuthorId(event.target.value)}>{group.memberIds.filter(id => !group.blockedMemberIds?.includes(id) && state.members.some(item => item.id === id)).map(id => <option key={id} value={id}>{memberName(state, id, groupId)}{id === viewerId ? ' (나)' : ''}</option>)}</select></label>
    <div className="tg-member-records__tabs" role="group" aria-label="멤버 기록 종류">{tabs.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}<span>{records[id].length}</span></button>)}</div>
    {records[tab].length ? renderRecords(authorId, tab) : <div className="tg-member-records__empty"><strong>{memberName(state, authorId, groupId)}님의 공유된 {tabs.find(([id]) => id === tab)?.[1]} 기록이 없어요.</strong><p>개인 비공개 기록은 여기에 자동으로 표시되지 않아요.</p></div>}
    {!group.archived && (!activityId || state.activities.find(item => item.id === activityId)?.status !== 'CANCELLED') && <button type="button" className="tg-primary tg-member-records__share" onClick={onShare}><Plus size={17}/>내 기록 공유하기</button>}
  </div>;
}

interface ShareProps {
  journeys: ReadonlyArray<Journey>; scopeLabel: string; onShare: (journey: Journey) => boolean;
  sharedSourceIds: ReadonlyArray<string>;
  onPost: () => void; onUpload: () => void; onBack: () => void;
}
export function MemberRecordSharePanel({ journeys, scopeLabel, sharedSourceIds, onShare, onPost, onUpload, onBack }: ShareProps) {
  const candidates = ownShareableJournals(journeys);
  const [selectedId, setSelectedId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const selected = candidates.find(item => item.id === selectedId);
  const alreadyShared = Boolean(selected && sharedSourceIds.includes(selected.id));
  return <div className="tg-member-records tg-member-records-share">
    <div className="tg-member-records__scope"><strong>{scopeLabel}</strong><small>공유할 공간을 확인해 주세요.</small></div>
    <div className="tg-member-records__create"><button type="button" onClick={onUpload}><ImagePlus size={19}/><span>사진·영상 올리기</span><ChevronRight size={17}/></button><button type="button" onClick={onPost}><PenLine size={19}/><span>게시글 쓰기</span><ChevronRight size={17}/></button></div>
    <label className="tg-member-records__person"><span><BookOpen size={17}/>내 여행기 선택</span><select aria-label="공유할 내 여행기" value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirmed(false); }}><option value="">완료한 여행기를 선택해 주세요</option>{candidates.map(item => <option key={item.id} value={item.id}>{item.title}{sharedSourceIds.includes(item.id) ? ' · 이미 공유됨' : item.visibility === 'PRIVATE' ? ' · 비공개 원본' : ''}</option>)}</select></label>
    {!candidates.length && <p className="tg-muted">아직 완료한 내 여행기가 없어요. 작성한 여행기를 완료하면 선택할 수 있어요.</p>}
    {selected && <><article className="tg-member-records__preview">{selected.cover && <img src={selected.cover} alt=""/>}<div><strong>{selected.title}</strong><small>{selected.region} · {selected.duration}</small><small>원본: {selected.visibility === 'PRIVATE' ? '비공개' : '공개'} 유지</small></div></article>{alreadyShared ? <><p className="tg-muted">이미 공유한 여행기예요. 기존 공유본을 확인해 주세요. 원본을 수정해도 공유본은 자동으로 바뀌지 않아요.</p><button type="button" onClick={onBack}>공유한 여행기 보기</button></> : <><p className="tg-muted">선택한 여행기의 글·사진·동선을 별도 사본으로 공유해요. 개인 메모·예약 정보는 공유하지 않으며 원본 공개 범위는 바뀌지 않아요.</p><label className="tg-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>이 공간의 모임원에게 선택한 버전을 공유할게요.</span></label><button type="button" className="tg-primary" disabled={!confirmed} onClick={() => { if (confirmed) onShare(selected); }}>확인하고 여행기 공유</button></>}</>}
    <button type="button" className="tg-text-button" onClick={onBack}>멤버별 기록으로</button>
  </div>;
}
