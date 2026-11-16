import { useState } from 'react';
import { BookOpen, ChevronRight, ImageOff, MessageSquareText, Play, Users } from 'lucide-react';
import type { MyOwnGroupRecords, MyOwnRecordEntry, MyOwnRecordTarget } from './myHubModel';
import './my-own-records.css';

const labels = { POST: '게시글', MEDIA: '사진·영상', JOURNAL: '여행기', COMMENT: '댓글' };
const scopeKey = (groupId: string, activityId?: string) => JSON.stringify([groupId, activityId || null]);
const dateLabel = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }) : '공유 날짜 미기록';

function RecordPhoto({ photo, record, onOpen }: { photo: MyOwnRecordEntry['photos'][number]; record: MyOwnRecordEntry; onOpen: (entry: MyOwnRecordEntry) => void }) {
  const [failed, setFailed] = useState('');
  return <button type="button" className="my-record-photo" aria-label={`${record.groupName} · ${record.scopeTitle} · ${photo.caption} 원문 보기`} onClick={() => onOpen(record)}>
    {failed === photo.url ? <span><ImageOff size={22}/><small>원문에서 확인</small></span> : <img src={photo.url} alt={photo.caption} loading="lazy" onError={() => setFailed(photo.url)}/>}
  </button>;
}

/** A content collection; empty memberships remain a secondary scope picker instead of the landing content. */
export function MyOwnRecordCollection({ entries, groups, onOpen, onScope }: {
  entries: MyOwnRecordEntry[]; groups: MyOwnGroupRecords[];
  onOpen: (target: MyOwnRecordTarget) => void; onScope: (groupId: string, activityId?: string) => void;
}) {
  const [scope, setScope] = useState('');
  const [view, setView] = useState<'all' | 'photos' | 'writing' | 'journals'>('all');
  const [photoLimit, setPhotoLimit] = useState(6);
  const scopeOptions = groups.flatMap(group => group.scopes.map(item => ({ value: scopeKey(group.groupId, item.activityId), label: `${group.groupName} · ${item.title}`, groupId: group.groupId, activityId: item.activityId })));
  const activeScope = scopeOptions.some(item => item.value === scope) ? scope : '';
  const inScope = entries.filter(entry => !activeScope || scopeKey(entry.groupId, entry.activityId) === activeScope);
  const photos = inScope.flatMap(record => record.photos.map(photo => ({ photo, record })));
  const timeline = inScope.filter(entry => view === 'journals' ? entry.type === 'JOURNAL' : view === 'writing' ? entry.type === 'POST' || entry.type === 'COMMENT' : entry.type !== 'MEDIA' || entry.video || !entry.photos.length);
  const open = (entry: MyOwnRecordEntry) => onOpen({ groupId: entry.groupId, activityId: entry.activityId, type: entry.type, id: entry.id, ...(entry.commentId ? { commentId: entry.commentId } : {}) });
  const hasResults = view === 'photos' ? photos.length > 0 : view === 'all' ? photos.length > 0 || timeline.length > 0 : timeline.length > 0;
  return <div className="my-own-records">
    <div className="my-own-records__filters"><label><span>공유한 공간</span><select aria-label="내 기록의 모임·약속 범위" value={activeScope} onChange={event => { setScope(event.target.value); setPhotoLimit(6); }}><option value="">모든 모임·약속</option>{scopeOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
    <div className="my-own-records__tabs" role="group" aria-label="공유 기록 종류">{([['all', '전체'], ['photos', '사진'], ['writing', '글·댓글'], ['journals', '여행기']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => { setView(id); setPhotoLimit(6); }}>{label}</button>)}</div>
    {hasResults ? <>
      {(view === 'all' || view === 'photos') && photos.length > 0 && <section aria-label="내가 공유한 사진"><div className="my-own-records__section"><h3>사진으로 돌아보기</h3><small>{photos.length}장</small></div><div className="my-own-records__mosaic">{photos.slice(0, photoLimit).map(({ photo, record }) => <RecordPhoto key={`${record.key}:${photo.id}`} photo={photo} record={record} onOpen={open}/>)}</div>{photos.length > photoLimit && <button type="button" className="my-own-records__more" onClick={() => setPhotoLimit(value => value + 12)}>사진 더 보기 · {photoLimit}/{photos.length}</button>}</section>}
      {view !== 'photos' && timeline.length > 0 && <section aria-label="내 공유 기록 시간순 목록"><div className="my-own-records__section"><h3>{view === 'journals' ? '공유한 여행기' : '남긴 이야기'}</h3><small>{timeline.length}개</small></div><div className="my-own-records__timeline">{timeline.map(entry => <button type="button" key={entry.key} onClick={() => open(entry)}><span className="my-own-records__mark">{entry.type === 'JOURNAL' ? <BookOpen size={18}/> : entry.video ? <Play size={18}/> : <MessageSquareText size={18}/>}</span><span className="my-own-records__copy"><small>{labels[entry.type]} · {dateLabel(entry.createdAt)}</small><strong>{entry.title}</strong>{entry.excerpt && <span>{entry.excerpt}</span>}<small>{entry.groupName} · {entry.scopeTitle}</small></span><ChevronRight size={17}/></button>)}</div></section>}
    </> : <div className="my-own-records__empty"><strong>{entries.length ? '이 조건에 맞는 내 기록이 없어요' : '아직 모임에 공유한 기록이 없어요'}</strong><p>개인 보관함의 글과 사진은 자동으로 공유되지 않아요.</p>{(activeScope || view !== 'all') && <button type="button" onClick={() => { setScope(''); setView('all'); }}>전체 공유 기록 보기</button>}</div>}
    {groups.length > 0 && <details className="my-own-records__spaces"><summary><Users size={17}/>모임별 기록·내 프로필<ChevronRight size={16}/></summary><div>{scopeOptions.map(item => <button type="button" key={item.value} onClick={() => onScope(item.groupId, item.activityId)}><span>{item.label}</span><ChevronRight size={16}/></button>)}</div></details>}
  </div>;
}
