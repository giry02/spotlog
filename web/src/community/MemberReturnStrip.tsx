import { useMemo } from 'react';
import { CalendarDays, ChevronRight, MessageCircle } from 'lucide-react';
import type { TogetherState } from '../together/model';
import { koreaDay } from '../together/discovery';
import { selectMemberHomeReturn } from './memberHomeReturn';

interface MemberHomeReturnProps {
  state: TogetherState;
  viewerId?: string;
  onOpenMyActivity?: (activityId: string) => void;
  onOpenMyChat?: (groupId: string, activityId?: string) => void;
}

const shortDate = (value: string) => new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });

/** Small return links only; membership checks and private DTO selection live outside public discovery. */
export default function MemberReturnStrip({ state, viewerId = '', onOpenMyActivity, onOpenMyChat }: MemberHomeReturnProps) {
  const { nextActivity, unreadChat } = useMemo(() => selectMemberHomeReturn(state, viewerId), [state, viewerId]);
  if ((!nextActivity || !onOpenMyActivity) && (!unreadChat || !onOpenMyChat)) return null;
  const ongoing = Boolean(nextActivity && nextActivity.date < koreaDay());
  const activityDate = nextActivity ? `${shortDate(nextActivity.date)}${nextActivity.endDate !== nextActivity.date ? `–${shortDate(nextActivity.endDate)}` : ''}` : '';
  return <section className="discovery-home__member-return" aria-label="내 활동 이어보기">
    {nextActivity && onOpenMyActivity && <button type="button" onClick={() => onOpenMyActivity(nextActivity.id)} aria-label={`내 약속 ${nextActivity.title} · ${activityDate}${nextActivity.startTime ? ` ${nextActivity.startTime}` : ''} 이어보기`}>
      <CalendarDays size={18} aria-hidden="true"/><span className="discovery-home__return-label">내 약속</span><strong title={`${nextActivity.groupName} · ${nextActivity.title}`}>{nextActivity.title}</strong><span className="discovery-home__return-meta" title={activityDate}>{ongoing ? '진행 중' : `${shortDate(nextActivity.date)}${nextActivity.startTime ? ` ${nextActivity.startTime}` : ''}`}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>}
    {unreadChat && onOpenMyChat && <button type="button" onClick={() => onOpenMyChat(unreadChat.groupId, unreadChat.activityId)} aria-label={`${unreadChat.groupName}${unreadChat.activityTitle ? ` · ${unreadChat.activityTitle}` : ''} 안 읽은 대화 ${unreadChat.unreadCount}개 이어보기`}>
      <MessageCircle size={18} aria-hidden="true"/><span className="discovery-home__return-label">새 대화</span><strong title={unreadChat.activityTitle ? `${unreadChat.groupName} · ${unreadChat.activityTitle}` : unreadChat.groupName}>{unreadChat.activityTitle || unreadChat.groupName}</strong><span className="discovery-home__return-count" aria-hidden="true">{unreadChat.unreadCount > 99 ? '99+' : unreadChat.unreadCount}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>}
  </section>;
}
