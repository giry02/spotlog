import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import type { TogetherState } from './model';
import { topicOptions } from './discovery';
import { selectPublicGroupIntroduction } from './groupContent';
import { PhotoCredit } from '../PublicTourismCredit';
import './content-panels.css';
import './public-group-introduction.css';

export default function PublicGroupIntroduction({ state, groupId, viewerId = '', mode = 'public', onJoin, joinLabel, joinDisabled = false, activityPreview, children }: {
  state: TogetherState; groupId: string; viewerId?: string; mode?: 'public' | 'member'; onJoin?: () => void; joinLabel?: string; joinDisabled?: boolean; activityPreview?: ReactNode; children?: ReactNode;
}) {
  const info = selectPublicGroupIntroduction(state, groupId, viewerId);
  const [failedCover, setFailedCover] = useState('');
  if (!info) return <p>지금 공개된 모임 소개가 없어요.</p>;
  return <div className="tg-public-intro tg-public-intro--decision">
    <section className="tg-public-intro__identity"><div className="tg-public-intro__cover">{info.cover && failedCover !== info.cover ? <><img src={info.cover} alt="" onError={() => setFailedCover(info.cover)}/><PhotoCredit image={info.cover}/></> : <Users size={28} aria-hidden="true"/>}</div><div className="tg-public-intro__identity-copy"><small>{[info.region, info.district].filter(Boolean).join(' · ')}</small><h2>{info.name}</h2><div className="tg-public-intro__tags">{info.example && <span>모임 예시</span>}{info.topics.map(id => { const item = topicOptions.find(topic => topic.id === id); return item ? <span key={id}>{item.emoji} {item.label}</span> : null; })}</div><small>멤버 {info.memberCount}명 · {info.recruitment === 'OPEN' ? info.joinMode === 'DIRECT' ? '바로 가입' : '승인 후 가입' : '모집 쉬는 중'}</small></div></section>
    {activityPreview && <div className="tg-public-intro__activity-preview">{activityPreview}</div>}
    <section className="tg-public-intro__joining" aria-label={mode === 'member' ? '모임 이용 안내' : '가입 안내'}><details><summary><strong>{mode === 'member' ? '모임 이용 안내' : '가입 전에 확인해 주세요'}</strong><ChevronDown size={17} aria-hidden="true"/></summary><p>{info.joinGuide}</p></details>{mode === 'public' && <><p>{info.joinMode === 'DIRECT' ? '안내를 확인하고 가입해요. 약속 참가는 가입 후 따로 선택해요.' : '가입 인사를 남기면 운영진이 확인해요. 약속 참가는 승인 후 따로 선택해요.'}</p>{onJoin && <button type="button" className="tg-primary tg-public-intro__join" disabled={joinDisabled || info.recruitment !== 'OPEN'} onClick={onJoin}>{joinLabel || (info.joinMode === 'DIRECT' ? '이 모임 함께하기' : '가입 인사 남기기')}<ChevronRight size={18} aria-hidden="true"/></button>}</>}</section>
    <section className="tg-public-intro__section"><h3>우리 모임을 소개해요</h3><p>{info.introduction || '아직 모임 소개를 준비하고 있어요.'}</p>{info.welcome && <blockquote>{info.welcome}</blockquote>}</section>
    {info.reviews.length > 0 && <section className="tg-public-intro__section"><h3>함께 남긴 공개 후기 <small>{info.publicReviewCount}개</small></h3><div className="tg-public-intro__reviews">{info.reviews.map((review, index) => <article key={`${review.publishedAt}:${index}`}><small>모임원이 공개한 후기 · {review.publishedAt.slice(0, 10)}</small><h4>{review.title}</h4><p>{review.excerpt}</p></article>)}</div></section>}
    {children}
  </div>;
}
