import { assistantSourceVersion, type ActivityAssistantAction } from './activityAssistant.ts';
import { projectChatAiRequest, type ChatAiSummarySnapshot } from './chatAiSummary.ts';
import { togetherId } from './model.ts';
import type { ChatDigestContext } from './chatDigest.ts';

export function createSummaryTaskAction(context: ChatDigestContext, snapshot: ChatAiSummarySnapshot,
  sectionIndex: number, itemIndex: number, title: string, assignSelf: boolean): Extract<ActivityAssistantAction, { type: 'CREATE_TASK' }> {
  const section = snapshot.output.sections[sectionIndex];
  const item = section?.items[itemIndex];
  if (!projectChatAiRequest(context, snapshot.request).available || !item
    || !['PREPARATION', 'OPEN_QUESTIONS'].includes(section.kind || '')) throw new Error('현재 원문과 요약을 다시 확인해 주세요.');
  if (!title.trim() || title.trim().length > 200) throw new Error('준비할 일은 1~200자로 적어 주세요.');
  const activityId = context.roomId.startsWith('activity:') ? context.roomId.slice(9) : undefined;
  const activity = activityId ? context.state.activities.find(row => row.id === activityId && row.groupId === context.groupId) : undefined;
  return { id: togetherId('summary-task'), type: 'CREATE_TASK', groupId: context.groupId, activityId,
    expectedRevision: activity?.revision, title: title.trim(), assignee: assignSelf ? 'SELF' : 'UNASSIGNED',
    sourceMessageIds: item.sourceIds.slice(), sourceVersions: Object.fromEntries(item.sourceIds.map(id => {
      const original = snapshot.request.payload.sources.find(source => source.id === id);
      if (!original) throw new Error('준비할 일의 근거 원문을 다시 확인해 주세요.');
      return [id, assistantSourceVersion(original.body)];
    })) };
}
