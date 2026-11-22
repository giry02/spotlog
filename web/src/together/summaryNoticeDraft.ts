import { memberName } from './model.ts';
import { projectChatAiRequest, type ChatAiSummarySnapshot } from './chatAiSummary.ts';
import type { ChatDigestContext, ChatDigestFilters } from './chatDigest.ts';

/** An editable draft only. Publishing still goes through the room's existing notice form. */
export function createChatSummaryNoticeDraft(context: ChatDigestContext, snapshot: ChatAiSummarySnapshot,
  sectionIndex: number, filters: ChatDigestFilters, purpose = snapshot.request.payload.purpose): { title: string; body: string } {
  if (!projectChatAiRequest(context, snapshot.request, filters, purpose).available) throw new Error('원문이나 정리 조건이 바뀌었어요. 다시 요약한 뒤 공지로 편집해 주세요.');
  const section = snapshot.output.sections[sectionIndex];
  if (!section) throw new Error('공지로 편집할 내용을 다시 확인해 주세요.');
  if (section.kind === 'TIME_PLACE' && snapshot.output.sections.some(row => row.kind === 'CHANGED')) {
    throw new Error('시간·장소 변경 대화가 있어요. 현재 약속의 일정과 변경 원문을 먼저 확인해 주세요.');
  }
  const activityId = context.roomId.startsWith('activity:') ? context.roomId.slice(9) : undefined;
  const sources = snapshot.request.payload.sources;
  const items = section.items;
  const body = items.map(item => {
    const references = item.sourceIds.map(id => {
      const source = sources.find(row => row.id === id);
      if (!source) throw new Error('공지로 편집할 원문 근거를 다시 확인해 주세요.');
      const at = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(source.createdAt));
      return `${memberName(context.state, source.authorId, context.groupId, activityId)} · ${at}`;
    });
    const speaker = 'speakerId' in item && item.speakerId ? `\n관련 발언자: ${memberName(context.state, item.speakerId, context.groupId, activityId)}` : '';
    return `• ${item.text}${speaker}\n근거: ${[...new Set(references)].join(' / ')}`;
  }).join('\n\n');
  if (body.length > 4000) throw new Error('공지에 담을 내용이 길어요. 필요한 부분을 준비 목록에 담거나 원문을 확인해 주세요.');
  return { title: `대화 정리 · ${section.heading}`.slice(0, 80), body };
}
