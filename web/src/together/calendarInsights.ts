import type { GroupKind, TogetherState } from './model.ts';
import { isMember } from './model.ts';
import { calendarRange, type CalendarRange, type PersonalCalendarPlan } from './calendarPlans.ts';

export type CalendarTone = GroupKind | 'PERSONAL';
export const calendarToneLabels: Record<CalendarTone, string> = {
  FAMILY: '가족', FRIENDS: '친구', HOBBY: '취미·지역', GUIDE: '가이드', PERSONAL: '내 여행',
};
export interface CalendarActivity {
  id: string; groupId: string; groupName: string; title: string; meetingPoint: string;
  tone: GroupKind; range: CalendarRange | null; startTime: string; endTime: string;
  attending: boolean; status: 'PLANNED' | 'CANCELLED' | 'COMPLETED';
}
export interface CalendarConflict { leftId: string; rightId: string; start: number; end: number }

const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Member-only calendar projection. Private messages, member details and joining answers never leave the source state. */
export function selectCalendarActivities(state: TogetherState, userId: string): CalendarActivity[] {
  if (!userId || !state.members.some(member => member.id === userId)) return [];
  const groups = new Map(state.groups.filter(group => isMember(state, userId, group.id)
    && !group.blockedMemberIds?.includes(userId)).map(group => [group.id, group]));
  return state.activities.flatMap(activity => {
    const group = groups.get(activity.groupId);
    if (!group) return [];
    const range = calendarRange(activity.date, activity.endDate);
    const endTime = activity.endTime;
    return [{
      id: activity.id, groupId: group.id, groupName: group.name, title: activity.title, meetingPoint: activity.meetingPoint,
      tone: group.kind, range, startTime: range && validTime(activity.startTime) ? activity.startTime : '',
      endTime: range && validTime(endTime) ? endTime : '',
      attending: activity.participants[userId] === 'JOINED', status: activity.status,
    }];
  }).sort((left, right) => (left.range?.startDate || '9999-12-31').localeCompare(right.range?.startDate || '9999-12-31')
    || left.startTime.localeCompare(right.startTime) || left.id.localeCompare(right.id));
}

export function calendarActivityInterval(activity: CalendarActivity): { start: number; end: number } | null {
  if (!activity.range || !validTime(activity.startTime) || !validTime(activity.endTime)) return null;
  const start = Date.parse(`${activity.range.startDate}T${activity.startTime}:00+09:00`);
  const end = Date.parse(`${activity.range.endDate}T${activity.endTime}:00+09:00`);
  return end > start ? { start, end } : null;
}

/** Only explicitly attending, planned events with both real clock times can conflict. */
export function findCalendarConflicts(activities: readonly CalendarActivity[]): CalendarConflict[] {
  const timed = activities.filter(activity => activity.attending && activity.status === 'PLANNED')
    .flatMap(activity => {
      const interval = calendarActivityInterval(activity);
      return interval ? [{ id: activity.id, ...interval }] : [];
    }).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const conflicts: CalendarConflict[] = [];
  for (let left = 0; left < timed.length; left++) {
    for (let right = left + 1; right < timed.length && timed[right].start < timed[left].end; right++) {
      if (timed[left].id !== timed[right].id) conflicts.push({
        leftId: timed[left].id, rightId: timed[right].id,
        start: Math.max(timed[left].start, timed[right].start), end: Math.min(timed[left].end, timed[right].end),
      });
    }
  }
  return conflicts;
}

const compactDate = (date: string) => date.replaceAll('-', '');
const utcDateTime = (value: number) => new Date(value).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
const icalText = (value: string) => value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
const icalId = (value: string) => encodeURIComponent(value).replaceAll("'", '%27');
function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** RFC5545 limits content lines to 75 octets. Never split a UTF-8 character. */
function foldedLine(value: string): string {
  const encoder = new TextEncoder();
  let line = '', bytes = 0;
  const lines: string[] = [];
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { lines.push(line); line = ' '; bytes = 1; }
    line += character;
    bytes += size;
  }
  lines.push(line);
  return lines.join('\r\n');
}

export interface CalendarExport { text: string; count: number }

/** Explicit local export of attendance and own travel dates. Missing end clocks remain absent. */
export function createCalendarExport(activities: readonly CalendarActivity[], plans: readonly PersonalCalendarPlan[], at = new Date()): CalendarExport {
  if (!Number.isFinite(at.getTime())) throw new Error('캘린더 파일을 만들 날짜를 확인해 주세요.');
  const stamp = utcDateTime(at.getTime());
  const events: string[][] = [];
  for (const activity of activities) {
    if (!activity.attending || activity.status === 'CANCELLED' || !activity.range) continue;
    const interval = calendarActivityInterval(activity);
    const lines = ['BEGIN:VEVENT', `UID:activity-${icalId(activity.groupId)}-${icalId(activity.id)}@spotlog.local`, `DTSTAMP:${stamp}`,
      `SUMMARY:${icalText(activity.title)}`, `CATEGORIES:${icalText(calendarToneLabels[activity.tone])}`, 'CLASS:PRIVATE'];
    if (validTime(activity.startTime)) {
      lines.push(`DTSTART:${utcDateTime(Date.parse(`${activity.range.startDate}T${activity.startTime}:00+09:00`))}`);
      if (interval) lines.push(`DTEND:${utcDateTime(interval.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(activity.range.startDate)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDay(activity.range.endDate))}`);
    }
    lines.push(`TRANSP:${interval ? 'OPAQUE' : 'TRANSPARENT'}`);
    if (activity.meetingPoint) lines.push(`LOCATION:${icalText(activity.meetingPoint)}`);
    const timeNote = !activity.startTime ? '시작·종료 시각 미정' : !interval ? '종료 시각 미정' : '';
    lines.push(`DESCRIPTION:${icalText([activity.groupName, timeNote].filter(Boolean).join('\n'))}`, 'END:VEVENT');
    events.push(lines);
  }
  for (const plan of plans) {
    if (!plan.range) continue;
    events.push(['BEGIN:VEVENT', `UID:plan-${icalId(plan.id)}@spotlog.local`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(plan.range.startDate)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(plan.range.endDate))}`,
      `SUMMARY:${icalText(plan.title)}`, 'CATEGORIES:내 여행', 'CLASS:PRIVATE', 'TRANSP:OPAQUE', 'END:VEVENT']);
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Spotlog//Personal Calendar//KO', 'CALSCALE:GREGORIAN',
    ...events.flat(), 'END:VCALENDAR'];
  return { text: lines.map(foldedLine).join('\r\n') + '\r\n', count: events.length };
}
