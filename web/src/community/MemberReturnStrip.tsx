import { useMemo } from 'react';
import { CalendarDays, ChevronRight, MessageCircle } from 'lucide-react';
import type { TogetherState } from '../together/model';
import type { Journey } from '../data';
import { koreaDay } from '../together/discovery';
import { selectMemberHomeReturn, selectMemberHomeSchedule } from './memberHomeReturn';

interface MemberHomeReturnProps {
  state: TogetherState;
  viewerId?: string;
  onOpenMyActivity?: (activityId: string) => void;
  onOpenMyChat?: (groupId: string, activityId?: string) => void;
  personalPlans?: ReadonlyArray<Journey>;
  onOpenMyPlan?: (journeyId: string) => void;
  maxRows?: 1 | 2;
}

const emptyPlans: ReadonlyArray<Journey> = [];

const shortDate = (value: string) => new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });

/** Small return links only; membership checks and private DTO selection live outside public discovery. */
export default function MemberReturnStrip({ state, viewerId = '', onOpenMyActivity, onOpenMyChat, personalPlans = emptyPlans, onOpenMyPlan, maxRows = 2 }: MemberHomeReturnProps) {
  const { unreadChat } = useMemo(() => selectMemberHomeReturn(state, viewerId), [state, viewerId]);
  const schedule = useMemo(() => selectMemberHomeSchedule(state, viewerId, onOpenMyPlan ? personalPlans : emptyPlans), [state, viewerId, personalPlans, onOpenMyPlan]);
  const openSchedule = schedule?.kind === 'PLAN' ? onOpenMyPlan : onOpenMyActivity;
  if ((!schedule || !openSchedule) && (!unreadChat || !onOpenMyChat)) return null;
  const ongoing = Boolean(schedule && schedule.date < koreaDay());
  const activityDate = schedule ? `${shortDate(schedule.date)}${schedule.endDate !== schedule.date ? `–${shortDate(schedule.endDate)}` : ''}` : '';
  const time = schedule?.kind === 'ACTIVITY' ? schedule.startTime : undefined;
  const label = schedule?.kind === 'PLAN' ? '내 여행' : '내 일정';
  return <section className="discovery-home__member-return" aria-label="내 활동 이어보기">
    {schedule && openSchedule && <button type="button" onClick={() => openSchedule(schedule.id)} aria-label={`${label} ${schedule.title} · ${activityDate}${time ? ` ${time}` : ''} 이어보기`}>
      <CalendarDays size={18} aria-hidden="true"/><span className="discovery-home__return-label">{label}</span><strong title={schedule.kind === 'ACTIVITY' ? `${schedule.groupName} · ${schedule.title}` : schedule.title}>{schedule.title}</strong><span className="discovery-home__return-meta" title={activityDate}>{ongoing ? '진행 중' : `${shortDate(schedule.date)}${time ? ` ${time}` : ''}`}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>}
    {unreadChat && onOpenMyChat && (maxRows > 1 || !schedule || !openSchedule) && <button type="button" onClick={() => onOpenMyChat(unreadChat.groupId, unreadChat.activityId)} aria-label={`${unreadChat.groupName}${unreadChat.activityTitle ? ` · ${unreadChat.activityTitle}` : ''} 안 읽은 대화 ${unreadChat.unreadCount}개 이어보기`}>
      <MessageCircle size={18} aria-hidden="true"/><span className="discovery-home__return-label">새 대화</span><strong title={unreadChat.activityTitle ? `${unreadChat.groupName} · ${unreadChat.activityTitle}` : unreadChat.groupName}>{unreadChat.activityTitle || unreadChat.groupName}</strong><span className="discovery-home__return-count" aria-hidden="true">{unreadChat.unreadCount > 99 ? '99+' : unreadChat.unreadCount}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>}
  </section>;
}
