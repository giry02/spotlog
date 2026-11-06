import { canReadChatDigest, selectChatDigestMessages, type ChatDigestContext, type ChatDigestSource } from './chatDigest.ts';

export type ChatSummaryExampleCategory = 'DECISION' | 'CHANGED' | 'PENDING' | 'PREPARATION';
export interface ChatSummaryExampleFilters { scope: 'unread' | 'all'; authorId?: string }
export interface ChatSummaryExampleSource { readonly id: string; readonly roomId: string; readonly authorId: string; readonly body: string }
export interface ChatSummaryExampleItem {
  id: string; category: ChatSummaryExampleCategory; title: string; text: string;
  facts: string[]; sourceIds: string[]; ownerId?: string; taskTitle?: string;
}
export interface ChatSummaryExampleProjection {
  exampleId: string; groupId: string; roomId: string; filters: ChatSummaryExampleFilters;
  items: ChatSummaryExampleItem[]; sources: ChatDigestSource[]; sourceCount: number; excludedItemCount: number;
}
export interface ChatSummaryExampleApplyRequest {
  kind: 'TASK' | 'NOTICE_DRAFT'; itemIds: string[]; roomId: string; filters?: ChatSummaryExampleFilters;
}
export type ChatSummaryExampleSelection = { ok: true; items: ChatSummaryExampleItem[]; sourceIds: string[] }
  | { ok: false; reason: string };

const self = 'spotlog-local-review-member', parent = 'example-parent', sibling = 'example-sibling';
const activityRoom = 'activity:family-next', groupRoom = 'group:family-busan';
/** Fictional originals for the isolated DEV review fixture. Never match arbitrary customer text by keywords. */
export const MOA_CHAT_EXAMPLE_MESSAGES: readonly ChatSummaryExampleSource[] = Object.freeze([
  { id: 'moa-example-a01', roomId: activityRoom, authorId: sibling, body: '처음에는 부산역 1번 출구에서 오전 10시에 만나는 걸로 제안할게요. 기차 시간을 보고 다시 정해요.' },
  { id: 'moa-example-a02', roomId: activityRoom, authorId: self, body: '기차 시간을 확인했어요. 집합은 부산역 2번 출구, 오전 10시 30분으로 변경해서 확정해요. 앞서 나온 10시와 1번 출구 제안은 쓰지 않아요.' },
  { id: 'moa-example-a03', roomId: activityRoom, authorId: sibling, body: '변경 확인했어요. 부산역 2번 출구에서 10시 30분에 만날게요. 옛 10시 메모는 지웠어요.' },
  { id: 'moa-example-a04', roomId: activityRoom, authorId: sibling, body: '점심은 식당 A와 식당 B를 두고 투표 중이에요. 아직 식당을 결정하지 않았고 예약도 하지 않았어요.' },
  { id: 'moa-example-a05', roomId: activityRoom, authorId: self, body: '점심 식당의 예약 가능 여부는 제가 확인할게요. 답을 기다리는 중이고, 예약 완료나 결제 완료가 아니에요.' },
  { id: 'moa-example-a06', roomId: activityRoom, authorId: parent, body: '제 약과 개인 물병은 제가 챙길게요. 다른 사람 약은 각자 준비해 주세요.' },
  { id: 'moa-example-a07', roomId: activityRoom, authorId: sibling, body: '공용으로 쓸 충전 케이블과 보조배터리는 지우인 제가 챙길게요. 충전해서 가져갈게요.' },
  { id: 'moa-example-a08', roomId: activityRoom, authorId: parent, body: '한 번에 20분 정도 걷고 중간에 쉬고 싶어요. 계단이 많은 길은 피할 수 있는지 확인해 주세요. 동선을 바꿨다는 뜻은 아니에요.' },
  { id: 'moa-example-a09', roomId: activityRoom, authorId: sibling, body: '쉬어 갈 카페는 바다가 보이는 곳과 역 근처 중에서 아직 고르지 않았어요. 두 후보를 더 비교해요.' },
  { id: 'moa-example-a10', roomId: activityRoom, authorId: self, body: '숙소는 두 곳을 비교 중이에요. 오늘 대화에서는 숙소 예약도 결제도 하지 않았어요. 취소 조건을 더 확인할게요.' },
  { id: 'moa-example-a11', roomId: activityRoom, authorId: self, body: '출발 전날 날씨 확인은 제가 할게요. 비가 올 때의 산책 대안은 아직 정하지 않았어요.' },
  { id: 'moa-example-g01', roomId: groupRoom, authorId: sibling, body: '다음 가족 모임은 토요일 오전에 하는 건 어때요? 아직 제안이고 날짜는 확정하지 않았어요.' },
  { id: 'moa-example-g02', roomId: groupRoom, authorId: self, body: '다음 가족 모임은 일요일 오후로 정했어요. 토요일 오전 제안은 취소해요. 정확한 날짜와 장소는 다음 공지에서 확인해요.' },
  { id: 'moa-example-g03', roomId: groupRoom, authorId: self, body: '모임 사진은 가족에게만 보여요. 외부에 공유하기 전에는 사진에 나온 사람에게 먼저 확인해 주세요.' },
  { id: 'moa-example-g04', roomId: groupRoom, authorId: sibling, body: '지난 여행 사진 정리는 지우인 제가 맡을게요. 아직 사진첩에는 올리지 않았어요.' },
  { id: 'moa-example-g05', roomId: groupRoom, authorId: parent, body: '다음 모임에서 먹을 음식은 아직 미정이에요. 못 먹는 음식이 있는지 먼저 물어봐요.' },
  { id: 'moa-example-g06', roomId: groupRoom, authorId: parent, body: '다음 모임에는 제가 개인 컵과 물을 챙길게요. 음식은 메뉴를 정한 다음에 준비해요.' },
].map(source => Object.freeze(source)));

export const chatSummaryExampleCategories: ReadonlyArray<{ id: ChatSummaryExampleCategory; label: string }> = [
  { id: 'DECISION', label: '결정된 내용' }, { id: 'CHANGED', label: '변경된 이전 의견' },
  { id: 'PENDING', label: '미정·확인할 내용' }, { id: 'PREPARATION', label: '준비물·담당자' },
];
interface ExampleSpec { id: string; groupId: string; roomId: string; items: ChatSummaryExampleItem[] }
/** Curated output, not live inference. Every claim cites the exact originals above. */
const specs: readonly ExampleSpec[] = [
  { id: 'moa-family-activity-v1', groupId: 'family-busan', roomId: activityRoom, items: [
    { id: 'activity-meeting', category: 'DECISION', title: '집합 시간·출구', text: '부산역 2번 출구 · 오전 10시 30분으로 변경 확정.', facts: ['집합 시간 10:30', '집합 위치 부산역 2번 출구'], sourceIds: ['moa-example-a02'] },
    { id: 'activity-old-meeting', category: 'CHANGED', title: '10시 · 1번 출구는 이전 제안', text: '처음 제안한 오전 10시·1번 출구는 취소. 최신 안내는 10시 30분·2번 출구.', facts: ['10:00·1번 출구 제안은 폐기', '최신 결정은 10:30·2번 출구'], sourceIds: ['moa-example-a01', 'moa-example-a02'] },
    { id: 'activity-lunch', category: 'PENDING', title: '점심 식당 A / B · 투표 중', text: '식당 선택 미정. 예약도 하지 않은 상태.', facts: ['점심 후보 A/B', '투표 중', '미예약'], sourceIds: ['moa-example-a04'] },
    { id: 'activity-reservation', category: 'PENDING', title: '식당 예약 가능 여부 확인', text: '예약 가능 여부를 확인하고 답을 기다리는 중. 예약·결제 완료 아님.', facts: ['예약 가능 여부 확인', '답변 대기', '예약·결제 미완료'], sourceIds: ['moa-example-a05'], ownerId: self, taskTitle: '점심 식당 예약 가능 여부 확인 · 예약 완료 아님' },
    { id: 'activity-walk', category: 'PENDING', title: '걷기·휴식·계단 요청 확인', text: '엄마가 약 20분 걷고 쉬기와 계단 회피를 요청. 동선 변경이 적용된 상태는 아님.', facts: ['엄마의 20분 걷기·휴식 요청', '계단 회피 확인 요청', '일정 변경 미적용'], sourceIds: ['moa-example-a08'], taskTitle: '20분 걷기·휴식과 계단 회피 요청을 동선에서 확인' },
    { id: 'activity-cafe', category: 'PENDING', title: '휴식 카페 · 두 후보 비교', text: '바다가 보이는 곳 / 역 근처 중 미정.', facts: ['카페 후보 비교 중', '선택 미정'], sourceIds: ['moa-example-a09'] },
    { id: 'activity-stay', category: 'PENDING', title: '숙소 · 비교 중', text: '두 숙소와 취소 조건을 비교. 예약·결제는 하지 않음.', facts: ['숙소 후보 비교', '예약·결제 미완료'], sourceIds: ['moa-example-a10'], taskTitle: '숙소 두 후보와 취소 조건 비교 · 예약·결제 전' },
    { id: 'activity-weather', category: 'PENDING', title: '날씨 확인과 우천 대안', text: '출발 전날 날씨를 확인할 담당은 있음. 비가 올 때의 산책 대안은 미정.', facts: ['출발 전날 날씨 확인 예정', '우천 대안 미정'], sourceIds: ['moa-example-a11'], ownerId: self, taskTitle: '출발 전날 날씨 확인 · 우천 산책 대안은 별도 결정' },
    { id: 'activity-medicine', category: 'PREPARATION', title: '엄마 · 본인 약과 물병', text: '엄마가 본인 약과 개인 물병을 준비. 다른 사람 약은 각자 준비.', facts: ['엄마 본인 약·물병 준비', '다른 사람 약은 각자'], sourceIds: ['moa-example-a06'], ownerId: parent, taskTitle: '본인 약과 개인 물병 챙기기' },
    { id: 'activity-battery', category: 'PREPARATION', title: '지우 · 케이블과 보조배터리', text: '지우가 공용 충전 케이블과 보조배터리를 충전해 준비.', facts: ['지우 케이블·보조배터리 준비'], sourceIds: ['moa-example-a07'], ownerId: sibling, taskTitle: '공용 충전 케이블과 보조배터리 충전해서 챙기기' },
  ] },
  { id: 'moa-family-group-v1', groupId: 'family-busan', roomId: groupRoom, items: [
    { id: 'group-next-meeting', category: 'DECISION', title: '다음 모임 · 일요일 오후', text: '일요일 오후로 정함. 정확한 날짜와 장소는 다음 공지에서 확인.', facts: ['일요일 오후로 결정', '정확한 날짜·장소는 추후 안내'], sourceIds: ['moa-example-g02'] },
    { id: 'group-photo-privacy', category: 'DECISION', title: '모임 사진 · 가족 공개', text: '외부 공유 전 사진 속 당사자에게 먼저 확인.', facts: ['가족에게만 공개', '외부 공유 전 당사자 확인'], sourceIds: ['moa-example-g03'] },
    { id: 'group-old-meeting', category: 'CHANGED', title: '토요일 오전은 취소된 제안', text: '처음의 토요일 오전 제안은 취소. 최신 의견은 일요일 오후.', facts: ['토요일 오전 제안 취소', '일요일 오후로 변경'], sourceIds: ['moa-example-g01', 'moa-example-g02'] },
    { id: 'group-food', category: 'PENDING', title: '다음 모임 음식 · 미정', text: '메뉴를 정하기 전 못 먹는 음식부터 확인.', facts: ['메뉴 미정', '먹지 못하는 음식 확인 필요'], sourceIds: ['moa-example-g05'], taskTitle: '다음 모임 메뉴를 정하기 전 못 먹는 음식 확인' },
    { id: 'group-photo-task', category: 'PREPARATION', title: '지우 · 지난 여행 사진 정리', text: '지우가 사진 정리를 맡음. 사진첩 업로드는 아직 하지 않음.', facts: ['지우 사진 정리 담당', '업로드 전'], sourceIds: ['moa-example-g04'], ownerId: sibling, taskTitle: '지난 여행 사진 정리 후 가족 사진첩에 올리기' },
    { id: 'group-cup-task', category: 'PREPARATION', title: '엄마 · 개인 컵과 물', text: '엄마가 개인 컵과 물을 준비. 음식 준비는 메뉴 결정 후.', facts: ['엄마 개인 컵·물 준비', '음식 준비는 메뉴 결정 후'], sourceIds: ['moa-example-g06'], ownerId: parent, taskTitle: '개인 컵과 물 챙기기' },
  ] },
];
const sourceById = new Map(MOA_CHAT_EXAMPLE_MESSAGES.map(source => [source.id, source]));
const copyItem = (item: ChatSummaryExampleItem): ChatSummaryExampleItem => ({ ...item, facts: [...item.facts], sourceIds: [...item.sourceIds] });

/** Re-evaluate on every render/apply; edits, deletions, duplicate IDs and foreign rooms never reuse cached output. */
export function getChatSummaryExample(context: ChatDigestContext, filters: ChatSummaryExampleFilters = { scope: 'all' }, cutoff = Date.now()): ChatSummaryExampleProjection | null {
  if (!canReadChatDigest(context)) return null;
  if (!filters || !['unread', 'all'].includes(filters.scope) || (filters.authorId !== undefined && (typeof filters.authorId !== 'string' || !filters.authorId))) throw new Error('대화 범위와 참여자를 다시 선택해 주세요.');
  const spec = specs.find(item => item.groupId === context.groupId && item.roomId === context.roomId);
  if (!spec) return null;
  const all = selectChatDigestMessages(context, { scope: 'all' }, cutoff);
  const exact = all.filter(message => {
    const expected = sourceById.get(message.id);
    return expected && expected.roomId === message.roomId && expected.authorId === message.authorId && expected.body === message.body;
  });
  if (!exact.length) return null;
  const validIds = new Set(exact.map(message => message.id));
  const selected = selectChatDigestMessages(context, filters, cutoff);
  const selectedIds = new Set(selected.map(message => message.id));
  // All supporting originals must be in scope: a person's excerpt never inherits somebody else's decision.
  const items = spec.items.filter(item => item.sourceIds.every(id => validIds.has(id) && selectedIds.has(id))).map(copyItem);
  const used = new Set(items.flatMap(item => item.sourceIds));
  return { exampleId: spec.id, groupId: spec.groupId, roomId: spec.roomId, filters: { ...filters }, items,
    sources: exact.filter(source => used.has(source.id)), sourceCount: selected.length, excludedItemCount: spec.items.length - items.length };
}

/** Parent must call against its latest repository state before explicitly applying the selected examples. */
export function validateChatSummaryExampleSelection(context: ChatDigestContext, request: ChatSummaryExampleApplyRequest, cutoff = Date.now()): ChatSummaryExampleSelection {
  if (!request || request.roomId !== context.roomId || !['TASK', 'NOTICE_DRAFT'].includes(request.kind)) return { ok: false, reason: '대화방과 적용할 항목을 다시 확인해 주세요.' };
  if (!Array.isArray(request.itemIds) || !request.itemIds.length || request.itemIds.length > 20 || new Set(request.itemIds).size !== request.itemIds.length) return { ok: false, reason: '적용할 항목을 중복 없이 선택해 주세요.' };
  let result: ChatSummaryExampleProjection | null;
  try { result = getChatSummaryExample(context, request.filters ?? { scope: 'all' }, cutoff); }
  catch { return { ok: false, reason: '대화 범위를 다시 확인해 주세요.' }; }
  if (!result) return { ok: false, reason: '예시 원문이 바뀌었거나 대화를 볼 권한이 없어요.' };
  const items = request.itemIds.map(id => result.items.find(item => item.id === id));
  if (items.some(item => !item)) return { ok: false, reason: '수정·삭제되었거나 현재 범위 밖인 항목이 있어요. 다시 선택해 주세요.' };
  const selected = items as ChatSummaryExampleItem[];
  if (selected.some(item => request.kind === 'TASK' ? !item.taskTitle : item.category === 'CHANGED')) return { ok: false, reason: '이전 의견은 공지에 반영할 수 없고, 확인할 일만 준비 목록에 담을 수 있어요.' };
  const group = context.state.groups.find(item => item.id === context.groupId);
  if (group?.archived) return { ok: false, reason: '보관된 모임에는 새 내용을 반영할 수 없어요.' };
  if (request.kind === 'TASK' && selected.some(item => item.ownerId && (!group?.memberIds.includes(item.ownerId) || group.blockedMemberIds?.includes(item.ownerId)))) return { ok: false, reason: '담당자가 현재 모임원인지 다시 확인해 주세요.' };
  return { ok: true, items: selected, sourceIds: [...new Set(selected.flatMap(item => item.sourceIds))] };
}
