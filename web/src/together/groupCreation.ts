import type { GroupJoinMode, GroupKind, GroupTopic } from './model.ts';
import { topicOptions } from './discovery.ts';
import { getGroupSubtopic, normalizeGroupSubtopics } from './groupTaxonomy.ts';
import { isGroupJoinFields, normalizeGroupJoinFields, type GroupJoinFields } from './groupJoining.ts';

export interface GroupCreationDraft {
  name: string; kind: GroupKind; region: string; district: string; categoryId: GroupTopic; subcategoryIds: string[];
  topics: GroupTopic[]; joinMode: GroupJoinMode; introduction: string; purpose: string; joinFields: GroupJoinFields;
}
export interface GroupIntroductionAnswers { who: string; activities: string; atmosphere: string; purpose: string }
export type GroupCreationInitial = Partial<Omit<GroupCreationDraft, 'joinFields'>> & { joinFields?: Partial<GroupJoinFields> };
const topic = (value: unknown): value is GroupTopic => topicOptions.some(item => item.id === value);
export function normalizeGroupCreationDraft(initial: GroupCreationInitial = {}): GroupCreationDraft {
  const topics = initial.topics?.filter(topic) || [];
  const categoryId = topic(initial.categoryId) ? initial.categoryId : topics[0] || 'SOCIAL';
  const allTopics = [...new Set([categoryId, ...topics])];
  return { name: initial.name || '', kind: ['FAMILY','FRIENDS','HOBBY','GUIDE'].includes(initial.kind || '') ? initial.kind! : 'HOBBY', region: initial.region || '', district: initial.district || '',
    categoryId, subcategoryIds: normalizeGroupSubtopics(allTopics, initial.subcategoryIds || []), topics: allTopics,
    joinMode: initial.joinMode === 'APPROVAL' ? 'APPROVAL' : 'DIRECT', introduction: initial.introduction || '', purpose: initial.purpose || '', joinFields: normalizeGroupJoinFields(initial.joinFields) };
}
export function groupCreationSubtopicLimit(initial: GroupCreationInitial | undefined, mode: 'CREATE' | 'EDIT' = 'CREATE'): number {
  return mode === 'EDIT' ? Math.max(3, Math.min(32, normalizeGroupCreationDraft(initial).subcategoryIds.length)) : 3;
}
export function validateGroupCreationBasics(input: GroupCreationDraft, maxSubtopics = 3): void {
  if (!input.name.trim() || input.name.length > 60) throw new Error('모임 이름을 60자 이내로 적어 주세요.');
  if (!['FAMILY','FRIENDS','HOBBY','GUIDE'].includes(input.kind) || !['DIRECT','APPROVAL'].includes(input.joinMode)) throw new Error('모임 종류와 가입 방식을 확인해 주세요.');
  if (!topic(input.categoryId) || !input.topics.includes(input.categoryId) || input.topics.some(value => !topic(value)) || new Set(input.topics).size !== input.topics.length) throw new Error('관심사 분류를 다시 선택해 주세요.');
  if (!Number.isInteger(maxSubtopics) || maxSubtopics < 3 || maxSubtopics > 32) throw new Error('세부 관심사 선택 범위를 다시 확인해 주세요.');
  if (input.subcategoryIds.length > maxSubtopics || new Set(input.subcategoryIds).size !== input.subcategoryIds.length || input.subcategoryIds.some(id => { const item = getGroupSubtopic(id); return !item || !input.topics.includes(item.parent); })) throw new Error(`세부 관심사를 최대 ${maxSubtopics}개 선택해 주세요.`);
  if (input.region.length > 100 || input.district.length > 100 || input.district.trim() && !input.region.trim()) throw new Error('함께할 지역과 동네를 확인해 주세요.');
}
export function validateGroupCreationDraft(input: GroupCreationDraft, maxSubtopics = 3): GroupCreationDraft {
  validateGroupCreationBasics(input, maxSubtopics);
  if (input.introduction.length > 2000 || input.purpose.length > 500) throw new Error('모임 소개는 2,000자, 개설 목적은 500자 이내로 적어 주세요.');
  const joinFields = normalizeGroupJoinFields(input.joinFields);
  if (!isGroupJoinFields(joinFields)) throw new Error('새 멤버 질문은 최대 3개, 각 120자 이내로 적어 주세요.');
  return { kind:input.kind,categoryId:input.categoryId,joinMode:input.joinMode,name: input.name.trim(), region: input.region.trim(), district: input.district.trim(), introduction: input.introduction.trim(), purpose: input.purpose.trim(),
    topics: [...input.topics], subcategoryIds: [...input.subcategoryIds], joinFields };
}
export function applyGroupIntroductionDraft(draft: GroupCreationDraft, introduction: string): GroupCreationDraft {
  if (typeof introduction!=='string' || introduction.length>2000) throw new Error('모임 소개를 2,000자 이내로 정리해 주세요.');
  return {...draft,introduction};
}
/** Formats only the four answers the creator typed. Does not invoke a model, change the draft or create a group. */
export function buildGroupIntroductionDraft(input: GroupIntroductionAnswers): string {
  const entries = [['함께할 사람',input.who],['함께할 활동',input.activities],['우리 모임 분위기',input.atmosphere],['이 모임을 만든 이유',input.purpose]] as const;
  if (entries.some(([,value]) => typeof value !== 'string' || value.length > 500)) throw new Error('답변은 각각 500자 이내로 적어 주세요.');
  const answered = entries.filter(([,value]) => value.trim());
  if (!answered.length) throw new Error('어떤 모임을 만들고 싶은지 한 가지 이상 적어 주세요.');
  return answered.map(([label,value]) => `${label}\n${value.trim()}`).join('\n\n');
}
