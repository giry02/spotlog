import type { Journey } from '../data.ts';

export interface CalendarRange { startDate: string; endDate: string }
export interface CalendarView { month: string; date: string }
export interface PersonalCalendarPlan {
  id: string;
  title: string;
  range: CalendarRange | null;
}

export function validCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function calendarRange(startDate: string, endDate?: string): CalendarRange | null {
  if (!validCalendarDay(startDate)) return null;
  return { startDate, endDate: validCalendarDay(endDate) && endDate >= startDate ? endDate : startDate };
}

export function calendarIncludes(range: CalendarRange | null, date: string): boolean {
  return Boolean(range && validCalendarDay(date) && range.startDate <= date && range.endDate >= date);
}

export function calendarMonthIntersects(range: CalendarRange | null, month: string): boolean {
  if (!range || !/^\d{4}-\d{2}$/.test(month) || !validCalendarDay(`${month}-01`)) return false;
  const startDate = `${month}-01`;
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  const endDate = date.toISOString().slice(0, 10);
  return range.startDate <= endDate && range.endDate >= startDate;
}

/** Route/history input is UI state only; mismatched or impossible selections are dropped. */
export function normalizeCalendarView(view: CalendarView | undefined, fallbackMonth: string): CalendarView {
  const month = view && /^\d{4}-\d{2}$/.test(view.month) && validCalendarDay(`${view.month}-01`) ? view.month : fallbackMonth;
  const date = view && validCalendarDay(view.date) && view.date.slice(0, 7) === month ? view.date : '';
  return { month, date };
}

/** Account-owned private plans only. Human dateRange labels and editor drafts are never interpreted. */
export function selectPersonalCalendarPlans(journeys: ReadonlyArray<Journey>): PersonalCalendarPlan[] {
  return journeys.filter(journey => journey.isMine && journey.purpose === 'PLAN'
    && journey.visibility === 'PRIVATE' && !journey.trash).map(journey => {
    const dates = journey.days.map(day => day.date).filter(validCalendarDay).sort();
    let range = dates.length ? calendarRange(dates[0], dates.at(-1)) : calendarRange(journey.startDate || '');
    // Older plans can have a start date and DAY labels instead of dated days.
    // Use the existing DAY count, never the number of places or a text duration.
    if (!dates.length && range && journey.days.length > 1 && journey.days.length <= 30) {
      const last = new Date(Date.parse(`${range.startDate}T00:00:00Z`) + (journey.days.length - 1) * 86400000).toISOString().slice(0, 10);
      range = calendarRange(range.startDate, last);
    }
    return { id: journey.id, title: journey.title, range };
  }).sort((a, b) => (a.range?.startDate || '9999-12-31').localeCompare(b.range?.startDate || '9999-12-31')
    || a.title.localeCompare(b.title, 'ko-KR') || a.id.localeCompare(b.id));
}
