import type { Place } from '../data';
import {
  buildCreationGroupDraft, buildCreationPlans, creationBriefTopics, creationCatalogPlaces,
  interpretCreationPrompt, refreshCreationPlan, validateCreationBrief,
  type CreationBrief, type CreationGroupDraft, type CreationPlan, type CreationPurpose,
} from './creationPlanner.ts';

export interface QuickCreationInput {
  /** The entry point decides what is created; words in the request cannot switch it. */
  purpose?: CreationPurpose;
  prompt?: string;
  /** Existing group/region context and values the person has already entered. */
  initial?: Partial<CreationBrief>;
  name?: string;
  /** On the first screen inherited home/group region is a hint, not a manual destination choice. */
  preferPromptRegion?: boolean;
}

export interface QuickCreationDraft {
  brief: CreationBrief;
  plan: CreationPlan | null;
  groupDraft?: CreationGroupDraft;
  /** Invalid explicit values require correction; unspecified optional values do not. */
  issues: string[];
}

/** Preserve the chosen number of days when a creator moves the start date. */
export function quickCreationStartDatePatch(purpose: CreationPurpose, date: string, dayCount: number): Pick<CreationBrief, 'date' | 'endDate'> {
  if (!date) return { date: '', endDate: '' };
  const at = Date.parse(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== date) throw new Error('시작 날짜를 확인해 주세요.');
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7) throw new Error('여행 일수를 확인해 주세요.');
  return { date, endDate: purpose === 'TRIP' ? new Date(at + (dayCount - 1) * 86400000).toISOString().slice(0, 10) : '' };
}

const text = (value: unknown, limit: number) => typeof value === 'string'
  ? value.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
const singleDayTrip = (prompt: string) => /(?:^|[^가-힣])(?:당일|하루)(?:\s|[,.!?]|치기|여행|나들이|종일|일정|코스|동안|만|짜리|로|에|$)/.test(prompt);

function rangeDays(start: string, end: string): number | undefined {
  if (![start, end].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value))) return undefined;
  const count = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  return Number.isInteger(count) && count >= 1 && count <= 7 ? count : undefined;
}

function draftDays(brief: CreationBrief): number {
  if (brief.purpose !== 'TRIP') return 1;
  return rangeDays(brief.date, brief.endDate)
    ?? (Number.isInteger(brief.dayCount) && brief.dayCount! >= 1 && brief.dayCount! <= 7 ? brief.dayCount! : 2);
}

function draftTitle(brief: CreationBrief, name: string): string {
  if (name) return name;
  if (nameOnly(brief.prompt) && brief.prompt !== brief.region && !/\b\d{4}[-/.년]/.test(brief.prompt)) return text(brief.prompt, 100);
  const label = brief.purpose === 'TRIP' ? '여행' : brief.purpose === 'OUTING' ? '나들이' : '약속';
  return `${brief.region ? `${brief.region} ` : ''}${label}`;
}

function emptyPlan(brief: CreationBrief, name: string, catalog: Place[]): CreationPlan {
  return refreshCreationPlan(brief, {
    id: 'catalog-quick-draft', source: 'CATALOG', title: draftTitle(brief, name), placeIds: [],
    days: Array.from({ length: draftDays(brief) }, (_, index) => ({ day: index + 1, placeIds: [] })),
    explanation: [], unknowns: [],
  }, catalog);
}

function nameOnly(prompt: string): boolean {
  return Boolean(prompt && prompt.length <= 60 && !/[\n.!?。]|만들(?:어|고|기|자)|개설|추천|찾(?:아|고|기)|하고\s*싶|(?:에서|으로).*(?:모임|함께|하)/.test(prompt));
}

function draftIssues(brief: CreationBrief): string[] {
  const issues = validateCreationBrief(brief).filter(issue => !(brief.locationUndecided && !brief.region && issue === '지역을 먼저 선택해 주세요.'));
  if (brief.purpose !== 'GROUP' && brief.startTime && !brief.date) issues.push('시작 시각을 정하려면 날짜도 함께 정해 주세요.');
  if (brief.purpose === 'TRIP' && singleDayTrip(brief.prompt) && (brief.dayCount !== 1 || (rangeDays(brief.date, brief.endDate) ?? 1) > 1)) issues.push('당일·하루 여행 요청과 여행 일수가 달라요. 일수나 요청 내용을 확인해 주세요.');
  return issues;
}

/**
 * A page-memory starter, never a save or an AI response. It uses the same public catalog
 * allowlist and refresh function as the detailed planner. No member state is accepted.
 */
export function prepareQuickCreation(input: QuickCreationInput, catalog: Place[]): QuickCreationDraft {
  const initial = input.initial ?? {};
  const prompt = text(input.prompt ?? initial.prompt, 1000);
  const name = text(input.name, input.purpose === 'GROUP' ? 60 : 100);
  const purpose = input.purpose ?? initial.purpose ?? 'MEETUP';
  // Empty contextual defaults must not hide a region or interests actually written in the request.
  const inherited: Partial<CreationBrief> = { ...initial, purpose };
  if (!initial.region?.trim()) delete inherited.region;
  const requestedRegion = input.preferPromptRegion ? interpretCreationPrompt(prompt, { purpose }).region : '';
  if (requestedRegion) inherited.region = requestedRegion;
  if (initial.topics) inherited.topics = [...initial.topics];
  const brief = interpretCreationPrompt(prompt, inherited);
  if (purpose === 'TRIP' && brief.dayCount === undefined) brief.dayCount = rangeDays(brief.date, brief.endDate) ?? (singleDayTrip(prompt) ? 1 : 2);
  if (!brief.region) brief.locationUndecided = true;

  if (purpose === 'GROUP') {
    const groupDraft = buildCreationGroupDraft(brief);
    groupDraft.name = name || (nameOnly(prompt) ? text(prompt, 60) : groupDraft.name) || '새 모임';
    return { brief, plan: null, groupDraft, issues: draftIssues(brief) };
  }

  const topics = creationBriefTopics(brief);
  const wanted = {
    food: topics.includes('FOOD'), cafe: topics.includes('CAFE'),
    stay: /숙소|숙박|호텔|리조트|펜션|게스트하우스|잠잘/.test(prompt),
  };
  // A trip request alone does not silently add meals or a hotel booking candidate.
  // Generic meetups may start from a single public venue when no activity was specified.
  const genericMeetup = purpose === 'MEETUP' && !topics.some(topic => !['FAMILY', 'SOCIAL'].includes(topic));
  const eligible = creationCatalogPlaces(brief, catalog).filter(place =>
    place.kind === 'FOOD' ? wanted.food || genericMeetup
      : place.kind === 'CAFE' ? wanted.cafe || genericMeetup
        : place.kind === 'STAY' ? wanted.stay : true);
  const plan = buildCreationPlans(brief, eligible)[0];
  if (plan?.placeIds.length) {
    const refreshed = refreshCreationPlan(brief, { ...plan, title: draftTitle(brief, name) }, catalog);
    return { brief, plan: refreshed, issues: draftIssues(brief) };
  }

  // Missing catalog data stays editable instead of guessing a city, date or unrelated venue.
  brief.locationUndecided = true;
  return { brief, plan: emptyPlan(brief, name, catalog), issues: draftIssues(brief) };
}
