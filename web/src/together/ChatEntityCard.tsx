import { useState } from 'react';
import { BarChart3, Bell, CalendarDays, Check, CheckSquare, Circle, MapPin } from 'lucide-react';
import { memberName, type TogetherState } from './model';
import type { ChatEntityProjection } from './chatEntities';

interface Props {
  entity: ChatEntityProjection | null;
  state: TogetherState;
  userId: string;
  onVotePoll?: (pollId: string, optionId: string) => boolean;
  onToggleTask?: (taskId: string) => boolean;
  onNavigate: (route: string) => void;
}

/** Live references only: the room selector checks visibility before anything is rendered. */
export default function ChatEntityCard({ entity, state, userId, onVotePoll, onToggleTask, onNavigate }: Props) {
  const [error, setError] = useState('');
  const apply = (action: () => boolean) => {
    try { setError(action() ? '' : '반영하지 못했어요. 현재 상태를 확인한 뒤 다시 시도해 주세요.'); }
    catch { setError('반영하지 못했어요. 현재 상태를 확인한 뒤 다시 시도해 주세요.'); }
  };
  if (!entity) return <div className="tg-chat-entity tg-chat-entity-unavailable" role="note"><strong>이 항목을 확인할 수 없어요</strong><div>삭제되었거나 이 방에서 볼 수 없는 항목이에요.</div></div>;

  const { value } = entity;
  let content;
  if (entity.type === 'POLL') {
    const poll = entity.value;
    const participants = state.groups.find(group => group.id === poll.groupId)?.memberIds ?? [];
    const voters = new Set(poll.options.flatMap(option => option.voterIds.filter(id => participants.includes(id))));
    content = <>
      <div className="tg-chat-entity-heading"><BarChart3 size={17}/><span>투표</span><small>{poll.closed ? '마감' : '진행 중'}</small></div>
      <strong className="tg-chat-entity-title">{poll.question}</strong>
      <div className="tg-chat-poll-options" role="group" aria-label={poll.question}>
        {poll.options.map(option => {
          const count = option.voterIds.filter(id => participants.includes(id)).length;
          const chosen = option.voterIds.includes(userId);
          const confirmed = option.id === poll.confirmedOptionId;
          return <button type="button" key={option.id} className={chosen ? 'is-chosen' : ''} aria-pressed={chosen} aria-label={`${option.label} · ${count}표${chosen ? ' · 내 선택' : ''}${confirmed ? ' · 확정' : ''}`} disabled={!entity.canInteract || !onVotePoll} onClick={() => onVotePoll && apply(() => onVotePoll(poll.id, option.id))}>
            <span className="tg-chat-poll-marker" aria-hidden="true">{chosen || confirmed ? <Check size={15}/> : <Circle size={15}/>}</span><span>{option.label}{confirmed && <small>확정</small>}</span><strong>{count}</strong>
          </button>;
        })}
      </div>
      <div className="tg-chat-entity-footnote">{voters.size}명 참여{!poll.closed && entity.canInteract ? ' · 후보를 눌러 투표해요' : poll.closed ? ' · 마감된 투표예요' : ' · 현재는 투표할 수 없어요'}</div>
    </>;
  } else if (entity.type === 'TASK') {
    const task = entity.value;
    content = <>
      <div className="tg-chat-entity-heading"><CheckSquare size={17}/><span>준비할 일</span><small>{task.completed ? '완료' : '준비 중'}</small></div>
      <strong className="tg-chat-entity-title">{task.title}</strong>
      <dl className="tg-chat-entity-info"><div><dt>담당</dt><dd>{task.assigneeId ? memberName(state, task.assigneeId) : '미정'}</dd></div>{task.dueDate && <div><dt>기한</dt><dd>{task.dueDate}</dd></div>}</dl>
      <button type="button" className="tg-chat-task-toggle" aria-pressed={task.completed} disabled={!entity.canInteract || !onToggleTask} onClick={() => onToggleTask && apply(() => onToggleTask(task.id))}><span className={task.completed ? 'is-complete' : ''} aria-hidden="true">{task.completed && <Check size={15}/>}</span>{task.completed ? '완료했어요' : '완료로 표시'}</button>
      {!entity.canInteract && !task.completed && <div className="tg-chat-entity-footnote">현재는 완료 상태를 바꿀 수 없어요.</div>}
    </>;
  } else if (entity.type === 'ACTIVITY') {
    const activity = entity.value;
    const isTrip = activity.kind ? activity.kind === 'TRIP' : Boolean(activity.journey);
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    const ended = Boolean((activity.endDate || activity.date) && (activity.endDate || activity.date) < today);
    const status = activity.status === 'CANCELLED' ? '취소' : activity.status === 'COMPLETED' || ended ? '지난 일정' : '예정';
    const date = activity.date ? `${activity.date}${activity.endDate && activity.endDate !== activity.date ? ` ~ ${activity.endDate}` : ''}${activity.startTime ? ` · ${activity.startTime}` : ''}` : '날짜 미정';
    content = <>
      <div className="tg-chat-entity-heading"><CalendarDays size={17}/><span>{isTrip ? '여행 일정' : '약속'}</span><small>{status}</small></div>
      <strong className="tg-chat-entity-title">{activity.title}</strong>
      <div className="tg-chat-entity-line"><CalendarDays size={15}/><span>{date}</span></div>
      <div className="tg-chat-entity-line"><MapPin size={15}/><span>{activity.meetingPoint || '만날 장소 미정'}</span></div>
      <button type="button" className="tg-chat-entity-open" onClick={() => onNavigate(`activity-${activity.id}`)}>일정 보기</button>
    </>;
  } else {
    const notice = entity.value;
    content = <>
      <div className="tg-chat-entity-heading"><Bell size={17}/><span>공지</span></div>
      <strong className="tg-chat-entity-title">{notice.title}</strong>
      <details className="tg-chat-notice-detail"><summary>내용 보기</summary><div>{notice.body}</div></details>
    </>;
  }
  return <section className={`tg-chat-entity tg-chat-entity-${entity.type.toLowerCase()}`} aria-label={`${entity.type === 'POLL' ? '투표' : entity.type === 'TASK' ? '준비할 일' : entity.type === 'ACTIVITY' ? '일정' : '공지'} 공유 카드`} data-entity-id={value.id}>
    {content}{error && <div className="tg-chat-entity-error" role="alert">{error}</div>}
  </section>;
}
