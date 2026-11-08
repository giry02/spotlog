export const groupAvailabilityOptions = [
  { id: 'WEEKDAY_DAY', label: '평일 낮' }, { id: 'WEEKDAY_EVENING', label: '평일 저녁' },
  { id: 'WEEKEND_DAY', label: '주말 낮' }, { id: 'WEEKEND_EVENING', label: '주말 저녁' },
  { id: 'FLEXIBLE', label: '그때그때 함께 정해요' },
] as const;
export type GroupAvailability = typeof groupAvailabilityOptions[number]['id'];
export interface GroupJoinQuestion { id: string; label: string }
export interface GroupJoinFields { questions: GroupJoinQuestion[]; welcome: string; availableTimes: GroupAvailability[] }
export interface GroupJoinDraft {
  nickname: string; introduction: string; answers: Array<{ questionId: string; question?: string; answer: string }>;
  availableTimes: GroupAvailability[]; rulesAccepted: boolean;
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const times = (value: unknown): value is GroupAvailability[] => Array.isArray(value) && value.length <= groupAvailabilityOptions.length && value.every(item => groupAvailabilityOptions.some(option => option.id === item)) && new Set(value).size === value.length;
export function isGroupJoinFields(value: unknown): value is GroupJoinFields {
  return record(value) && Object.keys(value).every(key => ['questions','welcome','availableTimes'].includes(key))
    && text(value.welcome, 500) && times(value.availableTimes) && Array.isArray(value.questions) && value.questions.length <= 3
    && value.questions.every(item => record(item) && Object.keys(item).every(key => ['id','label'].includes(key)) && text(item.id, 180) && /^[A-Za-z0-9_-]+$/.test(item.id) && text(item.label, 120) && Boolean(item.label.trim()))
    && new Set(value.questions.map(item => (item as GroupJoinQuestion).id)).size === value.questions.length;
}
export function normalizeGroupJoinFields(input?: Partial<GroupJoinFields>): GroupJoinFields {
  return { questions: (input?.questions || []).filter(item => item.label.trim()).map(item => ({ id: item.id, label: item.label.trim() })),
    welcome: input?.welcome?.trim() || '', availableTimes: [...(input?.availableTimes || [])] };
}
export function normalizeGroupJoinDraft(input: Partial<GroupJoinDraft> = {}, accountName = '', fields: GroupJoinFields = normalizeGroupJoinFields()): GroupJoinDraft {
  return { nickname: input.nickname ?? accountName, introduction: input.introduction || '',
    answers: fields.questions.map(question => ({ questionId: question.id, answer: input.answers?.find(item => item.questionId === question.id)?.answer || '' })),
    availableTimes: [...(input.availableTimes || [])], rulesAccepted: input.rulesAccepted === true };
}
export function isGroupJoinDraft(value: unknown): value is GroupJoinDraft {
  return record(value) && Object.keys(value).every(key => ['nickname','introduction','answers','availableTimes','rulesAccepted'].includes(key))
    && text(value.nickname,30) && text(value.introduction,500) && typeof value.rulesAccepted === 'boolean' && times(value.availableTimes)
    && Array.isArray(value.answers) && value.answers.length <= 3 && value.answers.every(item => record(item)
      && Object.keys(item).every(key => ['questionId','question','answer'].includes(key)) && text(item.questionId,180) && /^[A-Za-z0-9_-]+$/.test(item.questionId)
      && text(item.answer,500) && (item.question === undefined || text(item.question,120)))
    && new Set(value.answers.map(item=>(item as {questionId:string}).questionId)).size === value.answers.length;
}
export function validateGroupJoinDraft(input: GroupJoinDraft, fields: GroupJoinFields): GroupJoinDraft {
  if (!isGroupJoinFields(fields)) throw new Error('모임 가입 질문이 바뀌었어요. 가입 안내를 다시 열어 주세요.');
  if (!isGroupJoinDraft(input) || !text(input.nickname, 30) || !text(input.introduction, 500) || !times(input.availableTimes) || !Array.isArray(input.answers) || input.answers.length > 3
    || input.answers.some(item => !fields.questions.some(question => question.id === item.questionId) || !text(item.answer, 500)) || new Set(input.answers.map(item => item.questionId)).size !== input.answers.length) throw new Error('모임 이름표·자기소개·답변 길이를 확인해 주세요.');
  if (input.rulesAccepted !== true) throw new Error('모임 소개와 가입 안내를 확인해 주세요.');
  return { nickname: input.nickname.trim(), introduction: input.introduction.trim(), answers: input.answers.filter(item => item.answer.trim()).map(item => ({ questionId: item.questionId, question: fields.questions.find(question=>question.id===item.questionId)!.label, answer: item.answer.trim() })), availableTimes: [...input.availableTimes], rulesAccepted: true };
}
/** An explicit member-supplied introduction for the existing approval review; no inferred personal fields. */
export function groupJoinMessage(input: GroupJoinDraft, fields: GroupJoinFields): string {
  const draft = validateGroupJoinDraft(input, fields);
  return [draft.introduction, ...draft.answers.map(item => `${fields.questions.find(question => question.id === item.questionId)!.label}: ${item.answer}`)]
    .filter(Boolean).join('\n\n');
}
