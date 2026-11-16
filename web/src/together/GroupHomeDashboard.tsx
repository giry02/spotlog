import { useId, useState } from 'react';
import { BarChart3, Bell, BookOpen, CalendarDays, ChevronDown, ChevronRight, Dices, Image as ImageIcon, MapPin, MessageCircle, Plus, Route, Users, ClipboardList, Trophy } from 'lucide-react';
import { MemberAvatar } from './GroupMembersPanel';
import type { GroupHomeDashboardModel } from './groupHomeDashboardModel';
import './group-home-dashboard.css';

interface Props {
  value: GroupHomeDashboardModel;
  onIntroduction: () => void; onChat: () => void; onActivities: () => void; onCreateActivity: () => void;
  onActivity: (id: string) => void; onPlaces: () => void; onPlace: (id: string) => void;
  onMembers: () => void; onMemberRecords: (id?: string) => void;
  onBoard: () => void; onPost: (id: string) => void; onWritePost: () => void; onWriteReview: () => void;
  onAlbum: () => void; onPhoto: (source: 'MEDIA' | 'POST', id: string) => void; onUpload: () => void; onJournals: () => void;
  onNotice: (id: string) => void; onPlanning: () => void; onApplications: () => void;
  onParticipation: (tool: 'poll' | 'games' | 'challenges', id?: string) => void;
  onTasteMap?: () => void;
}

function HubPhoto({ src, alt, icon = 'image' }: { src?: string; alt: string; icon?: 'image' | 'place' | 'calendar' }) {
  const [failed, setFailed] = useState('');
  const Icon = icon === 'place' ? MapPin : icon === 'calendar' ? CalendarDays : ImageIcon;
  return <span className="ghd-photo">{src && failed !== src ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(src)}/> : <Icon size={24} aria-hidden="true"/>}</span>;
}
const placeNames = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const postNames = { REVIEW: '후기', QUESTION: '질문', FREE: '이야기', NOTICE: '공지' };

function when(item: GroupHomeDashboardModel['nextActivity']) {
  if (!item?.date) return '날짜를 함께 정해요';
  const day = new Date(item.date + 'T12:00:00+09:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
  return day + (item.endDate && item.endDate !== item.date ? ' ~ ' + Number(item.endDate.slice(5, 7)) + '/' + Number(item.endDate.slice(8, 10)) : '') + (item.startTime ? ' · ' + item.startTime : '');
}

/** A group's present job comes first; empty record shelves stay in the existing tabs. */
export default function GroupHomeDashboard({ value, onIntroduction, onChat, onActivities, onCreateActivity, onActivity, onPlaces, onPlace, onMembers, onMemberRecords, onBoard, onPost, onWritePost, onWriteReview, onAlbum, onPhoto, onUpload, onJournals, onNotice, onPlanning, onApplications, onParticipation, onTasteMap }: Props) {
  const uid = useId();
  const next = value.nextActivity;
  const starting = value.lifecycle === 'START';
  const archived = value.lifecycle === 'ARCHIVED';
  const showPlaces = value.places.length > 0 || Boolean(onTasteMap && value.taste.recordCount > 0);
  const pendingTools = value.tools.openPolls > 0 || value.tools.challenges > 0;

  return <div className="group-home-dashboard" data-lifecycle={value.lifecycle}>
    <div className="ghd-context" aria-label="모임 안내와 멤버">
      <button type="button" onClick={onIntroduction} aria-label={value.group.name + ' 모임 소개 보기'}><BookOpen size={17}/><span>모임 소개{value.group.example && <small>모임 예시</small>}</span><ChevronRight size={15}/></button>
      <button type="button" onClick={onMembers}><Users size={17}/><span>멤버 {value.memberCount}명</span><ChevronRight size={15}/></button>
    </div>
    {value.notice && <button type="button" className="ghd-notice" onClick={() => onNotice(value.notice!.id)}><Bell size={16}/><strong>공지</strong><span>{value.notice.title}</span><ChevronRight size={15}/></button>}
    {value.pendingApplicationCount > 0 && <button type="button" className="ghd-application" onClick={onApplications}><Users size={17}/><span>새 가입 신청 <strong>{value.pendingApplicationCount}건</strong></span><ChevronRight size={16}/></button>}

    {archived ? <section className="ghd-start ghd-start--archived" aria-labelledby={uid + '-start'}><h2 id={uid + '-start'}>함께 남긴 기록을 보관하고 있어요</h2><p>약속과 대화, 사진과 장소 기록을 다시 볼 수 있어요.</p><button type="button" className="ghd-start-primary" onClick={onActivities}>약속 기록 보기<ChevronRight size={17}/></button></section>
      : next ? <section className="ghd-section ghd-schedule" aria-labelledby={uid + '-next'}>
        <header className="ghd-section-heading"><h2 id={uid + '-next'}>다음 {next.kind === 'TRIP' ? '여행' : '만남'}</h2><button type="button" className="ghd-more" onClick={onActivities}>전체 {value.upcomingCount}<ChevronRight size={15}/></button></header>
        <article className="ghd-next"><button type="button" className="ghd-next-main" aria-label={next.title + ' · 약속 상세'} onClick={() => onActivity(next.id)}><span className="ghd-next-image"><HubPhoto src={next.cover} alt="" icon="calendar"/></span><span className="ghd-next-copy"><small>{when(next)}</small><strong>{next.title}</strong><span><MapPin size={14}/>{next.venue || '만나는 장소 미정'}</span><span><Users size={14}/>참가 선택 {next.participantCount}{next.capacity ? '/' + next.capacity : ''}명{next.routeCount > 0 && ' · 동선 ' + next.routeCount + '곳'}</span></span></button><footer><span>{next.ownParticipation === 'JOINED' ? '함께하기로 했어요' : next.ownParticipation === 'DECLINED' ? '불참으로 선택했어요' : '참가 여부를 확인해 주세요'}</span><button type="button" onClick={() => onActivity(next.id)}>{next.ownParticipation === 'JOINED' ? '일정·내 구간 보기' : '참가 여부 확인'}<ChevronRight size={15}/></button></footer></article>
        {value.upcoming.length > 0 && <div className="ghd-upcoming" aria-label="이어서 예정된 약속">{value.upcoming.map(item => <button type="button" key={item.id} onClick={() => onActivity(item.id)}><CalendarDays size={17}/><span><strong>{item.title}</strong><small>{when(item)}</small></span><ChevronRight size={16}/></button>)}</div>}
      </section>
      : <section className="ghd-start" aria-labelledby={uid + '-start'}><span className="ghd-start-icon"><CalendarDays size={22}/></span><h2 id={uid + '-start'}>{starting ? '첫 만남을 시작해 볼까요?' : '다음에는 어디서 만날까요?'}</h2><p>{starting ? '식사 약속부터 함께 가는 여행까지, 하나의 일정에서 준비하고 이야기해요.' : '함께 남긴 장소와 기록으로 다음 약속을 이어가요.'}</p><button type="button" className="ghd-start-primary" onClick={onCreateActivity}>{starting ? '첫 약속·여행 만들기' : '다음 약속·여행 만들기'}<Plus size={17}/></button><div className="ghd-start-links"><button type="button" onClick={onPlaces}><MapPin size={17}/>장소부터 모으기</button><button type="button" onClick={onMembers}><Users size={17}/>함께할 멤버 보기</button></div></section>}

    {!archived && pendingTools && <section className="ghd-current" aria-labelledby={uid + '-current'}><header className="ghd-section-heading"><h2 id={uid + '-current'}>지금 함께할 일</h2><button type="button" className="ghd-more" onClick={onPlanning}>함께 정하기<ChevronRight size={15}/></button></header>{value.tools.openPolls > 0 && <button type="button" className="ghd-current-row" onClick={() => onParticipation('poll')}><BarChart3 size={18}/><span>아직 열려 있는 투표 <strong>{value.tools.openPolls}개</strong></span><ChevronRight size={16}/></button>}{value.tools.challenge && <button type="button" className="ghd-current-row" onClick={() => onParticipation('challenges', value.tools.challenge!.id)}><Trophy size={18}/><span>{value.tools.challenge.title}</span><ChevronRight size={16}/></button>}</section>}



    {(value.recentPosts.length > 0 || value.journalCount > 0) && <section className="ghd-section" aria-labelledby={uid + '-board'}><header className="ghd-section-heading"><h2 id={uid + '-board'}>함께 남긴 이야기</h2><button type="button" className="ghd-more" onClick={onBoard}>게시판<ChevronRight size={15}/></button></header><div className="ghd-posts">{value.recentPosts.slice(0, 2).map(post => <button type="button" key={post.id} className={'ghd-post' + (post.photo ? ' has-photo' : '')} onClick={() => onPost(post.id)}><span><small>{postNames[post.category]}{post.activityTitle ? ' · ' + post.activityTitle : ' · 모임 전체'}</small><strong>{post.title}</strong>{!post.photo && post.preview && <p>{post.preview}</p>}<span>{post.author}<span aria-hidden="true"> · </span><MessageCircle size={12}/>{post.commentCount}</span></span>{post.photo && <HubPhoto src={post.photo} alt=""/>}</button>)}</div>{value.journalCount > 0 && <button type="button" className="ghd-text-row" onClick={onJournals}><Route size={17}/><span>공유 여행기 {value.journalCount}개</span><ChevronRight size={16}/></button>}</section>}

    {(value.photos.length > 0 || value.mediaCount > 0) && <section className="ghd-section" aria-labelledby={uid + '-album'}><header className="ghd-section-heading"><h2 id={uid + '-album'}>함께한 순간</h2><button type="button" className="ghd-more" onClick={onAlbum}>사진첩<ChevronRight size={15}/></button></header>{value.photos.length > 0 ? <div className="ghd-mosaic" data-count={value.photos.length}>{value.photos.map((photo, index) => <button type="button" key={photo.id} aria-label={(photo.caption || '공유 사진') + ' · ' + (photo.source === 'POST' ? '게시글' : '사진첩') + '에서 보기'} onClick={() => onPhoto(photo.source, photo.recordId)}><HubPhoto src={photo.image} alt=""/>{index === value.photos.length - 1 && value.photoCount > value.photos.length && <span className="ghd-mosaic-more">+{value.photoCount - value.photos.length}</span>}</button>)}</div> : <button type="button" className="ghd-text-row" onClick={onAlbum}><ImageIcon size={19}/><span>공유한 사진·영상 {value.mediaCount}개 보기</span><ChevronRight size={16}/></button>}</section>}

    <section className="ghd-personal" aria-label="멤버와 내 기록"><button type="button" className="ghd-text-row" onClick={() => onMemberRecords()}><BookOpen size={18}/><span>내 모임 프로필·기록</span><ChevronRight size={16}/></button>{value.members.length > 1 && <div className="ghd-member-strip" aria-label="멤버별 공유 기록">{value.members.map(member => <button type="button" key={member.id} aria-label={member.name + '님의 공유 기록'} onClick={() => onMemberRecords(member.id)}><MemberAvatar name={member.name} avatar={member.avatar}/><strong>{member.name}</strong><small>{member.role}</small></button>)}</div>}</section>

    {showPlaces && <section className="ghd-section" aria-labelledby={uid + '-places'}><header className="ghd-section-heading"><h2 id={uid + '-places'}>{value.placeCount ? '함께 고른 장소' : '우리 모임의 장소 경험'}</h2><button type="button" className="ghd-more" onClick={onPlaces}>{value.placeCount ? '전체 ' + value.placeCount : '장소 모으기'}<ChevronRight size={15}/></button></header>{value.places.length > 0 && <div className="ghd-place-grid">{value.places.map(place => <button type="button" key={place.id} onClick={() => onPlace(place.id)}><HubPhoto src={place.image} alt="" icon="place"/><strong>{place.name}</strong><small>{placeNames[place.kind]}</small></button>)}</div>}{onTasteMap && <button type="button" className="ghd-taste" onClick={onTasteMap}><MapPin size={20}/><span><strong>우리 취향 지도</strong><small>{value.taste.recordCount ? '직접 남긴 ' + value.taste.placeCount + '곳의 경험 · 평가 ' + value.taste.recordCount + '개' : '장소에 경험을 남기고 다음 만남에 활용해요'}</small></span><ChevronRight size={17}/></button>}</section>}

    <details className="ghd-tools"><summary>모임 도구<ChevronDown size={17}/></summary><div className="ghd-tool-list"><button type="button" onClick={onChat}><MessageCircle size={18}/>모임 대화</button><button type="button" onClick={onPlanning}><ClipboardList size={18}/>{archived ? '준비·투표 기록' : '장소·날짜 함께 정하기'}</button><button type="button" onClick={onPlaces}><MapPin size={18}/>함께 고른 장소</button>{onTasteMap && !showPlaces && <button type="button" onClick={onTasteMap}><MapPin size={18}/>우리 취향 지도</button>}<button type="button" onClick={onBoard}><BookOpen size={18}/>게시판</button><button type="button" onClick={onAlbum}><ImageIcon size={18}/>사진첩</button>{value.canWrite && <><button type="button" onClick={onCreateActivity}><CalendarDays size={18}/>새 약속·여행</button><button type="button" onClick={onWritePost}><Plus size={18}/>이야기 쓰기</button><button type="button" onClick={onWriteReview}><BookOpen size={18}/>후기 남기기</button><button type="button" onClick={onUpload}><ImageIcon size={18}/>사진·영상 올리기</button></>}<button type="button" onClick={() => onParticipation('poll')}><BarChart3 size={18}/>{archived ? '투표 기록' : '투표'}</button><button type="button" onClick={() => onParticipation('games')}><Dices size={18}/>{archived ? '놀이 기록' : '함께 놀기'}</button><button type="button" onClick={() => onParticipation('challenges')}><Trophy size={18}/>{archived ? '챌린지 기록' : '챌린지'}</button></div></details>
  </div>;
}
