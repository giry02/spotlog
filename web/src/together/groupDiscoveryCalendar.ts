import { koreaDay, shiftDay, type PublicDiscoveryActivity } from './discovery.ts';

export type DiscoveryCalendarPreset = 'ALL' | 'TODAY' | 'WEEKEND' | 'WEEK';
interface CalendarWindow { from: string; to: string }

/** Round-trip in KST so impossible dates never become a different calendar day. */
export function validDiscoveryCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T12:00:00+09:00`);
  return Number.isFinite(time) && koreaDay(new Date(time)) === value;
}

function activityWindow(activity: Pick<PublicDiscoveryActivity, 'date' | 'endDate'>): CalendarWindow | null {
  if (!validDiscoveryCalendarDate(activity.date)) return null;
  return { from: activity.date, to: validDiscoveryCalendarDate(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date };
}

/** false is an invalid/excluded window; null is an explicit date-independent search. */
function calendarWindow(preset: DiscoveryCalendarPreset | undefined, selectedDate: string | undefined, at: Date): CalendarWindow | null | false {
  if (!Number.isFinite(at.getTime())) return false;
  const today = koreaDay(at);
  let range: CalendarWindow | null = null;
  if (preset === 'TODAY') range = { from: today, to: today };
  if (preset === 'WEEK') range = { from: today, to: shiftDay(today, 6) };
  if (preset === 'WEEKEND') {
    const weekday = new Date(`${today}T12:00:00+09:00`).getUTCDay();
    const from = shiftDay(today, weekday === 0 ? -1 : (6 - weekday + 7) % 7);
    range = { from, to: shiftDay(from, 1) };
  }
  if (selectedDate) {
    if (!validDiscoveryCalendarDate(selectedDate)) return false;
    if (range && (selectedDate < range.from || selectedDate > range.to)) return false;
    return { from: selectedDate, to: selectedDate };
  }
  return range;
}

export function matchesDiscoveryCalendarDate(activity: Pick<PublicDiscoveryActivity, 'date' | 'endDate'>, preset?: DiscoveryCalendarPreset, selectedDate?: string, at = new Date()): boolean {
  const activityRange = activityWindow(activity), range = calendarWindow(preset, selectedDate, at);
  return Boolean(activityRange && range !== false && (!range || activityRange.from <= range.to && activityRange.to >= range.from));
}

export function discoveryCalendarDays(at = new Date()) {
  if (!Number.isFinite(at.getTime())) return [];
  const today = koreaDay(at);
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(today, index);
    return { date, day: Number(date.slice(8)), weekday: index === 0 ? '오늘' : new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`)), label: discoveryCalendarDateLabel(date) };
  });
}

export function discoveryCalendarDateLabel(date: string): string {
  return validDiscoveryCalendarDate(date) ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`)) : '날짜 다시 선택';
}

/** This is presentation grouping of the already-filtered public projection, never another result query. */
export function groupDiscoveryScheduleByDate<T extends { activity: PublicDiscoveryActivity }>(events: readonly T[], preset?: DiscoveryCalendarPreset, selectedDate?: string, at = new Date()) {
  const range = calendarWindow(preset, selectedDate, at);
  if (range === false) return [];
  const today = koreaDay(at), groups = new Map<string, T[]>();
  for (const event of events) {
    if (!matchesDiscoveryCalendarDate(event.activity, preset, selectedDate, at)) continue;
    const date = selectedDate || [event.activity.date, range?.from || today, today].sort().at(-1)!;
    const rows = groups.get(date) || [];
    rows.push(event); groups.set(date, rows);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => ({ date, items }));
}
