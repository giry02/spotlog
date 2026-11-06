import { useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, MessageCircle, Sparkles, Users } from 'lucide-react';
import type { Place } from '../data';
import type { GroupDiscoveryFilters } from './GroupDiscovery';
import { createTogetherRepository, type TogetherRepository } from './repository';
import { discoveryProfile, isDiscoverableGroup } from './discovery';
import { createPublicActivityIntent, resolvePublicActivityIntent } from './publicActivityIntent';
import { canOpenHomeMemberTarget, selectHomeCommunity, type HomePublicGroup } from './homeCommunityModel';
import './home-community.css';

export interface HomeCommunityProps {
  viewer: { id: string; name: string } | null;
  places: Place[];
  region: string;
  query?: string;
  showContinuation?: boolean;
  mode?: 'all' | 'groups';
  onNavigate: (route: string, filters?: GroupDiscoveryFilters) => void;
  onExplore: (filters?: GroupDiscoveryFilters) => void;
  onResetFilters?: () => void;
  reviewRepository?: TogetherRepository;
}
const dayLabel = (value: string) => new Date(value + 'T12:00:00+09:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
const whenLabel = (activity: { date: string; endDate: string; startTime?: string }) => `${dayLabel(activity.date)}${activity.endDate && activity.endDate !== activity.date ? ` ~ ${dayLabel(activity.endDate)}` : ''}${activity.startTime ? ` · ${activity.startTime}` : ''}`;
const areaLabel = (group: HomePublicGroup) => [group.region, group.district].filter(Boolean).join(' · ');

function Cover({ group }: { group: HomePublicGroup }) {
  const [failed, setFailed] = useState('');
  return group.cover && failed !== group.cover ? <img src={group.cover} alt="" loading="lazy" onError={() => setFailed(group.cover)} />
    : <span className="hcm-cover-fallback" aria-hidden="true"><span>{group.emoji}</span><small>{group.category}</small></span>;
}

/** Public promotion and member continuation share a surface, never a privacy projection. */
export default function HomeCommunity({ viewer, places, region, query = '', showContinuation = true, mode = 'all', onNavigate, onExplore, onResetFilters, reviewRepository }: HomeCommunityProps) {
  const id = useId();
  const repository = useMemo(() => reviewRepository || createTogetherRepository(viewer?.id || '', viewer?.name || '', places), [reviewRepository, viewer?.id, viewer?.name, places]);
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  const viewerId = useRef(viewer?.id || '');
  viewerId.current = viewer?.id || '';
  const [notice, setNotice] = useState('');
  const projection = selectHomeCommunity(state, viewer?.id || '', region, query);
  const continuation = showContinuation ? projection.continuation : null;
  const explore = (view: 'GROUPS' | 'MEETUPS') => onExplore({ ...projection.filters, view });
  const openGroup = (groupId: string) => {
    const latest = repository.getSnapshot().groups.find(group => group.id === groupId);
    if (!latest || !isDiscoverableGroup(latest) || discoveryProfile(latest).recruitment !== 'OPEN') { setNotice('공개 안내가 바뀌었어요. 다른 모임을 선택해 주세요.'); return; }
    setNotice(''); onNavigate(`group-${groupId}`, { ...projection.filters, view: 'GROUPS', publicActivityIntent: undefined });
  };
  const openMeetup = (groupId: string, activityId: string) => {
    const latest = repository.getSnapshot();
    const intent = createPublicActivityIntent(latest, groupId, activityId);
    if (!intent || !resolvePublicActivityIntent(latest, intent, viewerId.current)) { setNotice('이 정모의 공개 안내가 바뀌었어요. 다른 정모를 선택해 주세요.'); return; }
    setNotice(''); onNavigate(`group-${groupId}`, { ...projection.filters, view: 'MEETUPS', publicActivityIntent: intent });
  };
  const openMember = (groupId: string, route: string, activityId?: string) => {
    if (!viewer?.id || viewerId.current !== viewer.id || !canOpenHomeMemberTarget(repository.getSnapshot(), viewerId.current, groupId, activityId)) { setNotice('모임 이용 권한이 바뀌었어요. 내 모임에서 다시 확인해 주세요.'); return; }
    setNotice(''); onNavigate(route);
  };
  const noPublicContent = !projection.groups.length && (mode === 'groups' || !projection.meetups.length);
  return <div className="hcm">
    {(notice || repository.getError()) && <p className="hcm-status" role="status">{notice || repository.getError()}</p>}
    {continuation && <section className="hcm-continuation" aria-label="내 모임 이어보기">
      <div className="hcm-continuation-heading"><span>내 모임 이어보기</span><button type="button" onClick={() => onNavigate('together')}>내 모임<ChevronRight size={15}/></button></div>
      <button type="button" className="hcm-continue-open" onClick={() => openMember(continuation.groupId, continuation.activity ? `activity-${continuation.activity.id}` : `group-${continuation.groupId}`, continuation.activity?.id)}>
        <span className="hcm-continue-icon"><CalendarDays size={22}/></span><span className="hcm-continue-copy"><small>{continuation.activity?.participation === 'JOINED' ? '참가 선택한 일정' : continuation.activity ? '가입한 모임 일정' : '가입한 모임'} · {continuation.groupName}</small><strong>{continuation.activity?.title || continuation.groupName}</strong><span>{continuation.activity ? whenLabel(continuation.activity) : '새 대화와 모임 소식을 확인하세요.'}</span></span><ChevronRight size={19}/>
      </button>
      {continuation.chat && <div className="hcm-continue-chat"><button type="button" onClick={() => openMember(continuation.chat!.groupId, continuation.chat!.route, continuation.chat!.activityId)}><MessageCircle size={17}/><span><small>{continuation.chat.groupName} · {continuation.chat.label}</small><span>안 읽은 대화 <strong>{continuation.chat.unreadCount}개</strong></span></span></button><button type="button" className="hcm-summary-link" onClick={() => openMember(continuation.chat!.groupId, continuation.chat!.summaryRoute, continuation.chat!.activityId)}><Sparkles size={15}/>대화 정리</button></div>}
    </section>}
    {noPublicContent ? <section className="hcm-empty"><Users size={26}/><h2>조건에 맞는 공개 모임이 없어요</h2><p>다른 지역이나 모임 이름·관심사로 찾아보세요.</p><div><button type="button" onClick={() => explore('GROUPS')}>조건 바꿔 찾기<ArrowRight size={16}/></button>{onResetFilters && <button type="button" onClick={onResetFilters}>조건 초기화</button>}</div></section> : <>
      {mode === 'all' && <section className="hcm-section" aria-labelledby={`${id}-meetups`}><div className="hcm-section-heading"><h2 id={`${id}-meetups`}>다가오는 번개·정모</h2><button type="button" aria-label="같은 조건의 번개·정모 더 보기" onClick={() => explore('MEETUPS')}>더 보기<ChevronRight size={16}/></button></div>
        {projection.meetups.length ? <div className="hcm-meetup-list">{projection.meetups.map(({ group, activity }) => <article className="hcm-meetup-card" key={activity.id}><button type="button" className="hcm-meetup-open" onClick={() => openMeetup(group.id, activity.id)}><span className="hcm-meetup-image"><Cover group={group}/></span><span className="hcm-meetup-copy"><span className="hcm-card-kicker">{whenLabel(activity)}</span><strong>{activity.title}</strong><span className="hcm-card-meta">{areaLabel(group)} · {group.category}</span><span className="hcm-card-owner">{group.name}{group.example ? ' · 모임 예시' : ''}</span><span className="hcm-card-action">정모 안내 보기<ArrowRight size={14}/></span></span></button></article>)}</div> : <p className="hcm-quiet-empty">조건에 맞는 공개 예정 정모가 없어요. 아래 모임의 소개를 먼저 살펴보세요.</p>}
      </section>}
      <section className="hcm-section" aria-labelledby={`${id}-groups`}><div className="hcm-section-heading"><h2 id={`${id}-groups`}>함께할 모임을 찾아보세요</h2><button type="button" aria-label="같은 조건의 모집 중인 모임 더 보기" onClick={() => explore('GROUPS')}>더 보기<ChevronRight size={16}/></button></div>
        <div className="hcm-group-list" role="list" aria-label="공개 모집 중인 모임">{projection.groups.map(group => <article className="hcm-group-card" role="listitem" key={group.id}><button type="button" className="hcm-group-open" onClick={() => openGroup(group.id)}><span className="hcm-group-image"><Cover group={group}/><span className="hcm-category">{group.category}</span></span><span className="hcm-group-copy"><span className="hcm-card-meta">{areaLabel(group)}{group.example ? ' · 모임 예시' : ''}</span><strong>{group.name}</strong><span className="hcm-group-welcome">{group.welcome}</span><span className="hcm-card-action">모임 소개·가입 안내<ArrowRight size={14}/></span></span></button></article>)}</div>
      </section>
    </>}
  </div>;
}
