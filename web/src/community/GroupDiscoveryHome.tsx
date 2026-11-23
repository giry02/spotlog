import { useId, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, ChevronRight, Grid3X3, ImageOff, MapPin, Users, X } from 'lucide-react';
import type { GroupTopic } from '../together/model';
import { topicOptions, validPublicStartTime } from '../together/discovery';
import type { GroupDiscoveryFilters } from '../together/groupDiscoveryModel';
import type { DiscoveryGroupCard, DiscoveryMeetupCard } from './discoveryHomeModel';
import { groupHomeListingFilters, type GroupDiscoveryHomeProjection } from './groupDiscoveryHomeModel';
import type { GroupInterestsRead } from '../groupInterestStore';
import './group-discovery-home.css';

const areaLabel = (group: DiscoveryGroupCard) => [group.region, group.district, group.neighborhood].filter(Boolean).join(' · ');
const membershipLabel = (group: DiscoveryGroupCard) => group.joined ? '가입 중' : group.joinMode === 'DIRECT' ? '바로 가입' : '승인 후 가입';
const dateLabel = (date: string) => new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
const weekdayLabel = (date: string) => new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' });

function GroupPhoto({ group }: { group: DiscoveryGroupCard }) {
  const [failed, setFailed] = useState('');
  return group.cover && failed !== group.cover ? <img src={group.cover} alt="" loading="lazy" onError={() => setFailed(group.cover)}/>
    : <span className="gdh-photo-fallback" aria-hidden="true"><ImageOff size={25}/></span>;
}

function PhotoGroupCard({ group, meetup, onOpen }: { group: DiscoveryGroupCard; meetup?: DiscoveryMeetupCard; onOpen: (groupId: string) => void }) {
  return <article className="gdh-photo-card"><button type="button" onClick={() => onOpen(group.id)} aria-label={`${group.name} 모임 소개 보기`}>
    <span className="gdh-photo-card__photo"><GroupPhoto group={group}/>{group.example && <span className="gdh-photo-card__badge">모임 예시</span>}</span>
    <span className="gdh-photo-card__copy"><span className="gdh-meta">{group.category} · {areaLabel(group)}</span><strong>{group.name}</strong><span className="gdh-photo-card__welcome">{group.welcome}</span><span className="gdh-photo-card__footer">{meetup ? `${dateLabel(meetup.activity.date)} · ${meetup.activity.title}` : membershipLabel(group)}<ChevronRight size={15} aria-hidden="true"/></span></span>
  </button></article>;
}

function GroupComparisonRow({ group, meetup, onOpen, matchingTopics }: { group: DiscoveryGroupCard; meetup?: DiscoveryMeetupCard; onOpen: (groupId: string) => void; matchingTopics?: readonly GroupTopic[] }) {
  const match = group.topics.find(topic => matchingTopics?.includes(topic));
  const matchLabel = topicOptions.find(topic => topic.id === match)?.label;
  return <article className="gdh-topic-row"><button type="button" onClick={() => onOpen(group.id)} aria-label={`${group.name} 모임 소개 보기`}><span className="gdh-topic-row__photo"><GroupPhoto group={group}/></span><span className="gdh-topic-row__copy"><strong>{group.name}</strong><span>{meetup ? `${dateLabel(meetup.activity.date)} · ${meetup.activity.title}` : group.welcome}</span><small>{[matchLabel, areaLabel(group), membershipLabel(group), group.example ? '모임 예시' : ''].filter(Boolean).join(' · ')}</small></span><ChevronRight size={16} aria-hidden="true"/></button></article>;
}

export function GroupMeetupSchedule({ meetups, title, filters, onOpenGroup, onFindGroups, limit = 3, showEmpty = false }: {
  meetups: ReadonlyArray<DiscoveryMeetupCard>; title: string; filters: GroupDiscoveryFilters; limit?: number; showEmpty?: boolean;
  onOpenGroup: (groupId: string, activityId?: string) => void; onFindGroups: (filters?: GroupDiscoveryFilters) => void;
}) {
  const uid = useId();
  if (!meetups.length && !showEmpty) return null;
  const scheduled = meetups.filter(item => validPublicStartTime(item.activity.startTime)).slice(0, limit);
  const undecided = meetups.filter(item => !validPublicStartTime(item.activity.startTime)).slice(0, limit - scheduled.length);
  const renderMeetup = ({ group, activity }: DiscoveryMeetupCard) => <article className="gdh-meetup" key={`${group.id}:${activity.id}`}><button type="button" onClick={() => onOpenGroup(group.id, activity.id)} aria-label={`${activity.title} · ${dateLabel(activity.date)} ${validPublicStartTime(activity.startTime) ? activity.startTime : '시간 미정'} · ${group.name} 공개 약속 보기`}>
    <span className="gdh-meetup__date" aria-hidden="true"><small>{Number(activity.date.slice(5, 7))}월</small><strong>{Number(activity.date.slice(8, 10))}</strong><span>{weekdayLabel(activity.date)}</span></span>
    <span className="gdh-meetup__copy"><span className="gdh-meta">{activity.endDate && activity.endDate !== activity.date ? `${dateLabel(activity.endDate)}까지 · ` : ''}{validPublicStartTime(activity.startTime) ? activity.startTime : '시간 미정'}</span><strong>{activity.title}</strong><span className="gdh-meta">{group.category} · {areaLabel(group)}</span><span className="gdh-meetup__host">{group.name}{group.example ? ' · 모임 예시' : ''}</span></span><ChevronRight size={17} aria-hidden="true"/>
  </button></article>;
  return <section className="group-discovery-home gdh-meetups-section" aria-labelledby={`${uid}-title`}>
    <div className="gdh-heading"><h2 id={`${uid}-title`}>{title}</h2><button type="button" aria-label="같은 조건의 번개·정모 더 보기" onClick={() => onFindGroups(groupHomeListingFilters(filters, { kind: 'MEETUPS' }))}>더 보기<ChevronRight size={16}/></button></div>
    {meetups.length ? <div className="gdh-meetups">{scheduled.map(renderMeetup)}{undecided.length > 0 && <><p className="gdh-time-pending">시간 미정인 약속</p>{undecided.map(renderMeetup)}</>}</div> : <div className="gdh-empty"><CalendarDays size={24} aria-hidden="true"/><p>이 조건의 공개 번개·정모를 기다리고 있어요.</p><button type="button" onClick={() => onFindGroups(groupHomeListingFilters(filters, { kind: 'MEETUPS' }))}>번개·정모 찾아보기<ArrowRight size={16}/></button></div>}
  </section>;
}

interface Props {
  projection: GroupDiscoveryHomeProjection; variant?: 'full' | 'preview'; region: string; district?: string; neighborhood?: string;
  onOpenGroup: (groupId: string, activityId?: string) => void; onFindGroups: (filters?: GroupDiscoveryFilters) => void;
  onBrowse?: () => void;
  savedInterests?: GroupInterestsRead; savedInterestGroups?: DiscoveryGroupCard[]; onManageInterests?: () => void;
}

/** Interest navigation, photo recommendations and dated public events have separate presentation roles. */
export default function GroupDiscoveryHome({ projection, variant = 'full', region, district, neighborhood, onOpenGroup, onFindGroups, onBrowse, savedInterests, savedInterestGroups = [], onManageInterests }: Props) {
  const uid = useId(), [openTopic, setOpenTopic] = useState<GroupTopic>(), [expandedTopics, setExpandedTopics] = useState(false), [expandedInterests, setExpandedInterests] = useState(false);
  const full = variant === 'full', activeInterest = projection.interests.find(item => item.id === openTopic);
  const featured = full ? projection.featured : projection.groups.slice(0, 2);
  const featuredGroup = featured[0];
  const nextMeetup = (id: string) => projection.meetups.find(item => item.group.id === id);
  const quickInterests = projection.interests.filter(item => projection.groups.some(group => group.topics.includes(item.id))).slice(0, 4);
  const interestList = full ? expandedInterests ? projection.interests : projection.interests.slice(0, 9) : quickInterests;
  const openInterest = (topic: GroupTopic, subtopic?: string) => onFindGroups(groupHomeListingFilters(projection.filters, { kind: 'TOPIC', topic, subtopic }));
  const [savedVisibleCount, setSavedVisibleCount] = useState(3);
  const selectedInterests = savedInterests?.status === 'ready' ? savedInterests.state : undefined;
  return <div className={`group-discovery-home gdh-${variant}`}>
    {full && <section className="gdh-interest-section" aria-labelledby={`${uid}-interests`}><div className="gdh-interest-intro"><div className="gdh-heading"><h2 id={`${uid}-interests`}>좋아하는 일로 만나요</h2>{onManageInterests && <button type="button" className="gdh-saved-settings" onClick={onManageInterests}>내 관심사<ChevronRight size={16}/></button>}</div><p>관심사를 고르고, 함께할 세부 활동을 찾아보세요.</p></div>
      <div className="gdh-interest-grid" id={`${uid}-all-interests`} role="group" aria-label="모든 모임 관심사">{interestList.map(item => <button key={item.id} type="button" aria-expanded={openTopic === item.id} aria-controls={`${uid}-subtopics`} onClick={() => setOpenTopic(openTopic === item.id ? undefined : item.id)}><span aria-hidden="true">{item.emoji}</span><strong>{item.label}</strong></button>)}{projection.interests.length > 9 && <button type="button" className="gdh-interest-grid__expand" aria-expanded={expandedInterests} aria-controls={`${uid}-all-interests`} aria-label={expandedInterests ? '전체 관심사 접기' : `전체 관심사 ${projection.interests.length}개 펼치기`} onClick={() => setExpandedInterests(value => !value)}><span aria-hidden="true">{expandedInterests ? <ChevronDown size={24}/> : <Grid3X3 size={24}/>}</span><strong>{expandedInterests ? '접기' : `전체 ${projection.interests.length}`}</strong></button>}</div>
      {activeInterest && <div className="gdh-subtopics" id={`${uid}-subtopics`}><div className="gdh-subtopics__heading"><h3>{activeInterest.emoji} {activeInterest.label}</h3><button type="button" aria-label="세부 관심사 닫기" onClick={() => setOpenTopic(undefined)}><X size={17}/></button></div><button type="button" className="gdh-subtopics__all" onClick={() => openInterest(activeInterest.id)}>{activeInterest.label} 전체 모임 보기<ArrowRight size={16}/></button><div className="gdh-subtopics__links" role="group" aria-label={`${activeInterest.label} 세부 관심사`}>{activeInterest.subtopics.map(item => <button type="button" key={item.id} onClick={() => openInterest(activeInterest.id, item.id)}><span aria-hidden="true">{item.emoji}</span>{item.label}<ChevronRight size={14} aria-hidden="true"/></button>)}</div></div>}
    </section>}
    {savedInterests && savedInterests.status !== 'ready' && <p className="gdh-saved-note" role="status">{savedInterests.message} 내 관심사에서 다시 불러올 수 있어요.</p>}
    {selectedInterests && selectedInterests.topics.length === 0 && full && <p className="gdh-saved-note">내 관심사를 저장하면 선택한 분야의 모임을 따로 모아볼 수 있어요.</p>}
    <section className="gdh-featured" aria-labelledby={`${uid}-featured`}><div className="gdh-heading"><h2 id={`${uid}-featured`}>{full ? region ? `${neighborhood || district || region}에서 둘러볼 모임` : '함께할 모임을 골라보세요' : region ? `${neighborhood || district || region}에서 함께하는 모임` : '관심사로 만나는 모임'}</h2><button type="button" aria-label="같은 조건의 모임 더 보기" onClick={() => onFindGroups(groupHomeListingFilters(projection.filters, { kind: 'GROUPS' }))}>더 보기<ChevronRight size={16}/></button></div>
      {featuredGroup ? <><PhotoGroupCard group={featuredGroup} meetup={nextMeetup(featuredGroup.id)} onOpen={onOpenGroup}/><div className="gdh-topic-rows">{featured.slice(1).map(group => <GroupComparisonRow key={group.id} group={group} meetup={nextMeetup(group.id)} onOpen={onOpenGroup}/>)}</div></> : <div className="gdh-empty"><Users size={24} aria-hidden="true"/><p>선택한 지역·조건에 맞는 공개 모임이 없어요.</p><button type="button" onClick={() => onFindGroups(groupHomeListingFilters(projection.filters, { kind: 'GROUPS' }))}>조건을 바꾸어 모임 찾기<ArrowRight size={16}/></button></div>}
    </section>
    {!full && <div className="gdh-preview-interests" aria-label="관심사로 모임 찾기">{interestList.slice(0, 3).map(item => <button key={item.id} type="button" onClick={() => openInterest(item.id)}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}<button type="button" className="gdh-preview-interests__all" onClick={onBrowse || (() => onFindGroups(groupHomeListingFilters(projection.filters, { kind: 'GROUPS' })))}>관심사별<ArrowRight size={16}/></button>{onManageInterests && <button type="button" onClick={onManageInterests}>내 관심사{selectedInterests?.topics.length ? ` ${selectedInterests.topics.length}` : ''}<ChevronRight size={15}/></button>}</div>}
    {full && selectedInterests && selectedInterests.topics.length > 0 && <details className="gdh-saved-section"><summary><strong>내 관심사 모임 <small>{savedInterestGroups.length}</small></strong><ChevronDown size={17} aria-hidden="true"/></summary><div className="gdh-heading"><h2 id={`${uid}-saved`}>저장한 관심사로 모아보기</h2>{onManageInterests && <button type="button" onClick={onManageInterests}>관심사 수정<ChevronRight size={16}/></button>}</div><p className="gdh-saved-note">저장한 분야·세부 활동과 현재 지역·검색 조건이 맞는 모임이에요.</p>
      {savedInterestGroups.length ? <><div className="gdh-topic-rows">{savedInterestGroups.slice(0, savedVisibleCount).map(group => <GroupComparisonRow key={group.id} group={group} meetup={nextMeetup(group.id)} onOpen={onOpenGroup}/>)}</div>{savedInterestGroups.length > savedVisibleCount && <button type="button" className="gdh-saved-more" onClick={() => setSavedVisibleCount(value => value + 3)}>내 관심사 모임 더 보기<ChevronDown size={16}/></button>}</> : <p className="gdh-saved-empty">지금 조건에 맞는 공개 모임이 없어요. 관심사를 수정하거나 지역 모임을 둘러보세요.</p>}
    </details>}
    {full && <>
      <GroupMeetupSchedule meetups={projection.meetups} title={region ? `${neighborhood || district || region}에서 잡힌 약속` : '다가오는 번개·정모'} filters={projection.filters} onOpenGroup={onOpenGroup} onFindGroups={onFindGroups}/>
      {projection.topics.length > 0 && <div className="gdh-topic-sections">{projection.topics.slice(0, expandedTopics ? projection.topics.length : 4).map(section => <section className="gdh-topic-section" key={section.id} aria-labelledby={`${uid}-${section.id}`}><div className="gdh-heading"><h2 id={`${uid}-${section.id}`}><span aria-hidden="true">{section.emoji}</span>{section.title}</h2><button type="button" aria-label={`${section.title} 더 보기`} onClick={() => onFindGroups(groupHomeListingFilters(projection.filters, { kind: 'COLLECTION', id: section.id }))}>더 보기<ChevronRight size={16}/></button></div><div className="gdh-topic-rows">{section.groups.map(group => <GroupComparisonRow key={group.id} group={group} meetup={nextMeetup(group.id)} onOpen={onOpenGroup} matchingTopics={section.topics}/>)}</div></section>)}</div>}
      {projection.topics.length > 4 && <button type="button" className="gdh-more-topics" aria-expanded={expandedTopics} onClick={() => setExpandedTopics(value => !value)}>{expandedTopics ? '관심사별 모임 접기' : '다른 관심사의 모임도 보기'}<ChevronDown size={17} aria-hidden="true"/></button>}
      <button type="button" className="gdh-all-groups" onClick={() => onFindGroups(groupHomeListingFilters(projection.filters, { kind: 'GROUPS' }))}><MapPin size={17} aria-hidden="true"/>현재 조건의 모임 모두 보기<ArrowRight size={17} aria-hidden="true"/></button>
    </>}
  </div>;
}
