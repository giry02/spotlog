import { BookOpen, CalendarDays, ChevronRight, ImagePlus, MapPin, MessageCircle, Route } from 'lucide-react';
import type { ActivityWorkspaceModel } from './activityWorkspace';
import './activity-workspace.css';

const labels = { UNSCHEDULED: '함께 정하는 중', UPCOMING: '다가오는 약속', TODAY: '오늘 함께하는 일정', PAST: '지난 약속', CANCELLED: '취소된 약속', ARCHIVED: '보관한 약속' };
export function ActivityPhaseHeading({ value, when, venue, onChat, onRoute, onRecords, onChooseDate }: {
  value: ActivityWorkspaceModel; when: string; venue: string; onChat: () => void; onRoute: () => void; onRecords: () => void; onChooseDate?: () => void;
}) {
  const ended = ['PAST','ARCHIVED'].includes(value.phase);
  return <section className="activity-phase-heading" data-phase={value.phase} aria-label="현재 약속 안내">
    <small>{labels[value.phase]}</small>
    <div className="activity-phase-facts"><CalendarDays size={18}/><strong>{when}</strong></div>
    <div className="activity-phase-venue"><MapPin size={16}/><span>{venue || '만나는 장소 미정'}</span></div>
    <div className="activity-phase-actions">
      {value.phase === 'TODAY' ? <><button type="button" className="is-primary" onClick={onRoute}><Route size={17}/>지도·동선 보기</button><button type="button" onClick={onChat}><MessageCircle size={17}/>약속 대화</button></>
        : ended ? <><button type="button" className="is-primary" onClick={onRecords}><BookOpen size={17}/>사진·후기 보기</button><button type="button" onClick={onRoute}><Route size={17}/>{value.phase === 'ARCHIVED' ? '보관한 동선' : '지난 동선'}</button></>
        : value.phase === 'UNSCHEDULED' && onChooseDate ? <><button type="button" className="is-primary" onClick={onChooseDate}><CalendarDays size={17}/>날짜 정하기</button><button type="button" onClick={onChat}><MessageCircle size={17}/>함께 이야기</button></>
        : <button type="button" onClick={onChat}><MessageCircle size={17}/>{value.phase === 'CANCELLED' ? '이전 대화 보기' : '약속 대화'}<ChevronRight size={15}/></button>}
    </div>
  </section>;
}

export function ActivityRecordShelf({ value, onPhoto, onPosts, onMedia, compact = false }: { value: ActivityWorkspaceModel; onPhoto: (source: 'POST'|'MEDIA', id: string) => void; onPosts: () => void; onMedia: () => void; compact?: boolean }) {
  if (!value.hasRecords) return null;
  return <section className={'activity-record-shelf' + (compact ? ' is-compact' : '')} aria-label="이 약속에 남긴 기록">
    <header><div><small>이 약속의 기억</small><h2>함께 남긴 순간</h2></div><button type="button" onClick={onPosts}>기록 보기<ChevronRight size={15}/></button></header>
    {value.photos.length > 0 && <div className="activity-record-mosaic" data-count={value.photos.length}>{value.photos.map(photo => <button type="button" key={photo.id} aria-label={`${photo.caption || '공유 사진'} · ${photo.source === 'POST' ? '게시글' : '사진첩'}에서 보기`} onClick={() => onPhoto(photo.source, photo.recordId)}><img src={photo.image} alt="" loading="lazy"/></button>)}</div>}
    <div className="activity-record-counts"><button type="button" onClick={onPosts}>이야기·후기 {value.postCount} · 여행기 {value.journalCount}<ChevronRight size={14}/></button><button type="button" onClick={onMedia}>사진·영상 {value.mediaCount}<ChevronRight size={14}/></button></div>
  </section>;
}

export function ActivityRecordActions({ canWrite, canJournal, onPost, onUpload, onJournal }: { canWrite: boolean; canJournal: boolean; onPost: () => void; onUpload: () => void; onJournal: () => void }) {
  if (!canWrite) return null;
  return <div className="activity-record-compose" aria-label="새 기록 남기기"><button type="button" className="is-primary" onClick={onPost}><BookOpen size={17}/>후기 남기기</button><button type="button" onClick={onUpload}><ImagePlus size={17}/>사진·영상 올리기</button>{canJournal && <button type="button" onClick={onJournal}>여행기 쓰기<ChevronRight size={15}/></button>}</div>;
}
