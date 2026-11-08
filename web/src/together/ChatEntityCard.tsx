import { useState } from 'react';
import { Bell, CalendarDays, Check, CheckSquare, MapPin, Dices, Trophy } from 'lucide-react';
import { memberName, type TogetherState } from './model';
import type { ChatEntityProjection } from './chatEntities';
import PollView from './PollView';
import { challengeIsFinished } from './challenges';

interface Props {
  entity: ChatEntityProjection | null;
  state: TogetherState;
  userId: string;
  onVotePoll?: (pollId: string, optionId: string | null) => boolean;
  onClosePoll?: (pollId: string) => boolean;
  onConfirmPoll?: (pollId: string, optionId: string) => boolean;
  onEditPoll?: (pollId: string) => void;
  onToggleTask?: (taskId: string) => boolean;
  onOpenEntity?: (type: 'GAME' | 'CHALLENGE', id: string) => void;
  onNavigate: (route: string) => void;
}

/** Live references only: the room selector checks visibility before anything is rendered. */
export default function ChatEntityCard({ entity, state, userId, onVotePoll, onClosePoll, onConfirmPoll, onEditPoll, onToggleTask, onOpenEntity, onNavigate }: Props) {
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
    content = <PollView state={state} userId={userId} poll={poll} compact onVote={optionId => onVotePoll ? onVotePoll(poll.id, optionId) : false} onClosePoll={onClosePoll ? () => onClosePoll(poll.id) : undefined} onConfirm={onConfirmPoll ? optionId => onConfirmPoll(poll.id, optionId) : undefined} onEdit={onEditPoll ? () => onEditPoll(poll.id) : undefined}/>;
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
  } else if (entity.type === 'GAME') {
    const game = entity.value;
    const kind = game.type === 'WHEEL' ? '돌림판' : game.type === 'DRAW' ? '당첨 뽑기' : '사다리';
    const winnerId = 'optionId' in game.result ? game.result.optionId : 'memberId' in game.result ? game.result.memberId : '';
    const winner = game.type === 'WHEEL' ? game.options.find(item => item.id === winnerId)?.label : game.members.find(item => item.id === winnerId)?.name;
    content = <>
      <div className="tg-chat-entity-heading"><Dices size={17}/><span>{kind}</span><small>{game.round}회차</small></div>
      <strong className="tg-chat-entity-title">{game.title}</strong>
      {winner && <div className="tg-chat-entity-line"><Check size={16}/><strong>{winner}</strong></div>}
      {'assignments' in game.result && <div className="tg-chat-entity-footnote">{game.result.assignments.map(pair => `${game.members.find(item => item.id === pair.memberId)?.name} · ${game.options.find(item => item.id === pair.optionId)?.label}`).join(' / ')}</div>}
      <div className="tg-chat-entity-footnote">결과를 저장했어요. 다시 열어도 같은 결과를 볼 수 있어요.</div>
      <button type="button" className="tg-chat-entity-open" onClick={() => onOpenEntity?.('GAME', game.id)}>결과 보기</button>
    </>;
  } else if (entity.type === 'CHALLENGE') {
    const challenge = entity.value;
    const mine = challenge.certifications.filter(item => item.userId === userId).length;
    content = <>
      <div className="tg-chat-entity-heading"><Trophy size={17}/><span>챌린지</span><small>{challengeIsFinished(challenge) ? '종료' : '함께 도전'}</small></div>
      <strong className="tg-chat-entity-title">{challenge.title}</strong>
      <div className="tg-chat-entity-line"><CalendarDays size={15}/><span>{challenge.startDate} ~ {challenge.endDate}</span></div>
      <div className="tg-chat-entity-footnote">{challenge.participantIds.length}명 참여 · 주 {challenge.weeklyTarget}회{mine ? ` · 내 인증 ${mine}회` : ''}</div>
      <button type="button" className="tg-chat-entity-open" onClick={() => onOpenEntity?.('CHALLENGE', challenge.id)}>{entity.canInteract ? '참여·인증하기' : '기록 보기'}</button>
    </>;
  } else {
    const notice = entity.value;
    content = <>
      <div className="tg-chat-entity-heading"><Bell size={17}/><span>공지</span></div>
      <strong className="tg-chat-entity-title">{notice.title}</strong>
      <details className="tg-chat-notice-detail"><summary>내용 보기</summary><div>{notice.body}</div></details>
    </>;
  }
  return <section className={`tg-chat-entity tg-chat-entity-${entity.type.toLowerCase()}`} aria-label={`${entity.type === 'POLL' ? '투표' : entity.type === 'TASK' ? '준비할 일' : entity.type === 'ACTIVITY' ? '일정' : entity.type === 'GAME' ? '함께 놀기' : entity.type === 'CHALLENGE' ? '챌린지' : '공지'} 공유 카드`} data-entity-id={value.id}>
    {content}{error && <div className="tg-chat-entity-error" role="alert">{error}</div>}
  </section>;
}
