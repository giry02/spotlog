import { useId, type ReactNode } from 'react';
import type { GroupDiscoveryFilters, selectGroupDiscovery } from './groupDiscoveryModel';
import { discoveryCalendarDateLabel, discoveryCalendarDays, groupDiscoveryScheduleByDate, validDiscoveryCalendarDate } from './groupDiscoveryCalendar';
import './group-discovery-calendar.css';

interface CalendarProps {
  selectedDate?: string;
  onChange: (date?: string) => void;
  showDays?: boolean;
  at?: Date;
  dateFilter?: GroupDiscoveryFilters['dateFilter'];
}
export default function DiscoveryDatePicker({ selectedDate, onChange, showDays = true, at, dateFilter }: CalendarProps) {
  const inputId = useId();
  const valid = !selectedDate || validDiscoveryCalendarDate(selectedDate);
  return <section className="gd-discovery-calendar" aria-label="공개 약속 날짜 선택">
    {showDays && <div className="gd-calendar-heading"><strong>언제 만날까요?</strong><span>오늘부터 7일</span></div>}
    {showDays && <div className="gd-calendar-days" role="group" aria-label="앞으로 7일의 약속 날짜">{discoveryCalendarDays(at).map(day => <button type="button" key={day.date} aria-label={`${day.label} 약속 보기`} aria-pressed={selectedDate === day.date} onClick={() => onChange(day.date)}><small>{day.weekday}</small><strong>{day.day}</strong></button>)}</div>}
    <div className="gd-calendar-direct"><label htmlFor={inputId}>날짜 직접 선택<input id={inputId} type="date" aria-label="공개 약속 날짜 직접 선택" aria-invalid={!valid} value={valid ? selectedDate || '' : ''} onChange={event => onChange(event.target.value || undefined)}/></label><button type="button" onClick={() => onChange(undefined)} disabled={!selectedDate && (!dateFilter || dateFilter === 'ALL')}>날짜 해제</button></div>
    {!valid && <p role="alert">선택한 날짜를 다시 확인하거나 날짜 조건을 해제해 주세요.</p>}
  </section>;
}

type PublicEvent = ReturnType<typeof selectGroupDiscovery>['events'][number];
export function GroupDiscoverySchedule({ events, filters, renderEvent, at }: { events: PublicEvent[]; filters: GroupDiscoveryFilters; renderEvent: (event: PublicEvent) => ReactNode; at?: Date }) {
  const days = groupDiscoveryScheduleByDate(events, filters.dateFilter, filters.selectedDate, at);
  return <div className="gd-calendar-schedule">{days.map(day => <section className="gd-calendar-schedule-day" key={day.date}><header><h3>{discoveryCalendarDateLabel(day.date)}</h3><span>{day.items.length}개 약속</span></header><div className="gd-meetup-list">{day.items.map(renderEvent)}</div></section>)}</div>;
}
