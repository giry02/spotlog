import { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Download, TriangleAlert } from 'lucide-react';
import type { Journey } from '../data';
import type { TogetherState } from './model';
import { koreaDay } from './discovery';
import { calendarIncludes, calendarMonthIntersects, calendarRange, normalizeCalendarView, selectPersonalCalendarPlans, type CalendarView } from './calendarPlans';
import { calendarActivityInterval, calendarToneLabels, createCalendarExport, findCalendarConflicts, selectCalendarActivities, type CalendarActivity, type CalendarTone } from './calendarInsights';
import './calendar-insights.css';

interface Props {
  state: TogetherState; userId: string; journeys: readonly Journey[]; view: CalendarView;
  onViewChange: (view: CalendarView) => void; onActivity: (id: string) => void;
  onPlan: (id: string) => void; onAllPlans: () => void;
}
const tones = Object.keys(calendarToneLabels) as CalendarTone[];
const dateLabel = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
const clockLabel = (time: number) => new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(time));
const conflictLabel = (start: number, end: number) => {
  const startDay = koreaDay(new Date(start)), endDay = koreaDay(new Date(end));
  return `${dateLabel(startDay)} · ${clockLabel(start)}–${startDay === endDay ? '' : `${dateLabel(endDay)} `}${clockLabel(end)}`;
};

export default function CalendarPanel(props: Props) {
  return <CalendarBody key={props.userId} {...props}/>;
}

function CalendarBody({ state, userId, journeys, view, onViewChange, onActivity, onPlan, onAllPlans }: Props) {
  const { month, date } = normalizeCalendarView(view, koreaDay(new Date()).slice(0, 7));
  const [tone, setTone] = useState<CalendarTone | 'ALL'>('ALL');
  const [attendingOnly, setAttendingOnly] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const activities = selectCalendarActivities(state, userId);
  const plans = selectPersonalCalendarPlans(journeys);
  const filtered = activities.filter(item => (tone === 'ALL' || item.tone === tone) && (!attendingOnly || item.attending));
  const filteredPlans = tone === 'ALL' || tone === 'PERSONAL' ? plans : [];
  const inRange = (range: ReturnType<typeof calendarRange>) => date ? calendarIncludes(range, date) : calendarMonthIntersects(range, month);
  const selected = filtered.filter(item => inRange(item.range));
  const selectedPlans = filteredPlans.filter(item => inRange(item.range));
  const undated = filtered.filter(item => !item.range);
  const byId = new Map(selected.map(item => [item.id, item]));
  const conflicts = findCalendarConflicts(selected);
  const unknownTime = selected.filter(item => item.attending && item.status === 'PLANNED' && !calendarActivityInterval(item));
  const exportable = activities.filter(item => item.attending && item.status !== 'CANCELLED' && item.range).length + plans.filter(item => item.range).length;
  const change = (next: CalendarView) => { setExportStatus(''); onViewChange(next); };
  const changeMonth = (offset: number) => {
    const next = new Date(`${month}-15T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + offset);
    change({ month: next.toISOString().slice(0, 7), date: '' });
  };
  const exportCalendar = () => {
    try {
      const output = createCalendarExport(selectCalendarActivities(state, userId), selectPersonalCalendarPlans(journeys));
      if (!output.count) { setExportStatus('참석한 약속이나 날짜를 정한 내 여행을 먼저 선택해 주세요.'); return; }
      const url = URL.createObjectURL(new Blob([output.text], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spotlog-calendar.ics';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus(`일정 ${output.count}개를 캘린더 파일로 준비했어요.`);
    } catch { setExportStatus('캘린더 파일을 준비하지 못했어요. 다시 시도해 주세요.'); }
  };
  const activityCard = (activity: CalendarActivity) => <button type="button" className="calendar-event" data-tone={activity.tone} key={activity.id} onClick={() => onActivity(activity.id)}>
    <span className="calendar-event__mark" aria-hidden="true"><CalendarDays size={19}/></span>
    <span className="calendar-event__copy"><small>{calendarToneLabels[activity.tone]} · {activity.groupName}{activity.attending ? ' · 참석 중' : ''}</small>
      <strong className={activity.status === 'CANCELLED' ? 'is-cancelled' : undefined}>{activity.title}</strong>
      <span>{activity.range ? `${dateLabel(activity.range.startDate)}${activity.range.endDate !== activity.range.startDate ? ` ~ ${dateLabel(activity.range.endDate)}` : ''}` : '날짜 미정'}{activity.startTime ? ` · ${activity.startTime}${calendarActivityInterval(activity) ? `–${activity.endTime}` : ' · 종료 미정'}` : ' · 시간 미정'}</span>
      {activity.status !== 'PLANNED' && <small>{activity.status === 'CANCELLED' ? '취소된 약속' : '완료한 약속'}</small>}
    </span><ChevronRight size={17} aria-hidden="true"/>
  </button>;
  const planCard = (plan: typeof plans[number]) => <button type="button" className="calendar-event" data-tone="PERSONAL" key={plan.id} onClick={() => onPlan(plan.id)}>
    <span className="calendar-event__mark" aria-hidden="true"><CalendarDays size={19}/></span><span className="calendar-event__copy"><small>내 여행</small><strong>{plan.title}</strong>
      <span>{plan.range ? `${dateLabel(plan.range.startDate)}${plan.range.endDate !== plan.range.startDate ? ` ~ ${dateLabel(plan.range.endDate)}` : ''}` : '날짜 미정'}</span></span><ChevronRight size={17} aria-hidden="true"/>
  </button>;

  return <div className="tg-pad calendar-panel">
    <div className="calendar-panel__tools"><label><span className="ui-sr-only">일정 종류</span><select aria-label="일정 종류" value={tone} onChange={event => setTone(event.target.value as CalendarTone | 'ALL')}>
      <option value="ALL">모든 종류</option>{tones.map(key => <option key={key} value={key}>{calendarToneLabels[key]}</option>)}</select></label>
      <button type="button" className="calendar-panel__export" onClick={exportCalendar} disabled={!exportable}><Download size={16}/>캘린더 저장</button>
    </div>
    <div className="calendar-panel__scope" role="group" aria-label="참석 일정 범위"><button type="button" aria-pressed={!attendingOnly} onClick={() => setAttendingOnly(false)}>전체 일정</button><button type="button" aria-pressed={attendingOnly} onClick={() => setAttendingOnly(true)}>내 참석 일정</button></div>
    <p className="calendar-panel__hint">파일에는 필터와 관계없이 참석한 약속과 날짜를 정한 내 여행 {exportable}개가 들어가요.</p>
    {exportStatus && <p className="calendar-panel__status" role="status">{exportStatus}</p>}
    <div className="calendar-panel__month"><button type="button" aria-label="이전 달" onClick={() => changeMonth(-1)}><ArrowLeft size={18}/></button><h2>{month.slice(0, 4)}년 {Number(month.slice(5))}월</h2><button type="button" aria-label="다음 달" onClick={() => changeMonth(1)}><ArrowRight size={18}/></button></div>
    <div className="calendar-panel__legend" aria-label="일정 색상 안내">{tones.map(key => <span key={key} data-tone={key}><i aria-hidden="true"/>{calendarToneLabels[key]}</span>)}</div>
    <div className="calendar-panel__grid" role="group" aria-label={`${month} 일정 날짜`}>
      {['일', '월', '화', '수', '목', '금', '토'].map(day => <small key={day}>{day}</small>)}
      {Array.from({ length: new Date(`${month}-01T00:00:00Z`).getUTCDay() }, (_, index) => <span key={`blank-${index}`}/>)}
      {Array.from({ length: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate() }, (_, index) => {
        const day = `${month}-${String(index + 1).padStart(2, '0')}`;
        const dayActivities = filtered.filter(item => item.status !== 'CANCELLED' && calendarIncludes(item.range, day));
        const dayPlans = filteredPlans.filter(item => calendarIncludes(item.range, day));
        const dayTones = [...new Set<CalendarTone>([...dayActivities.map(item => item.tone), ...(dayPlans.length ? ['PERSONAL' as const] : [])])];
        const count = dayActivities.length + dayPlans.length;
        return <button type="button" key={day} aria-pressed={date === day} aria-label={`${day}${count ? ` · 일정 ${count}개 · ${dayTones.map(key => calendarToneLabels[key]).join(', ')}` : ''}`} onClick={() => change({ month, date: date === day ? '' : day })}>
          <span>{index + 1}</span><span className="calendar-panel__dots" aria-hidden="true">{dayTones.map(key => <i data-tone={key} key={key}/>)}</span>
        </button>;
      })}
    </div>
    <div className="calendar-panel__date"><label>날짜로 찾기<input type="date" value={date} onChange={event => { const day = event.target.value; change({ month: calendarRange(day) ? day.slice(0, 7) : month, date: day }); }}/></label>{date && <button type="button" onClick={() => change({ month, date: '' })}>이번 달 전체</button>}</div>
    {conflicts.length > 0 && <section className="calendar-panel__conflicts" aria-label="시간이 겹치는 참석 일정"><h3><TriangleAlert size={17}/>시간이 겹치는 약속 {conflicts.length}건</h3>{conflicts.map(pair => {
      const left = byId.get(pair.leftId)!, right = byId.get(pair.rightId)!;
      return <div key={`${pair.leftId}:${pair.rightId}`}><small>{conflictLabel(pair.start, pair.end)}</small><button type="button" onClick={() => onActivity(left.id)}>{left.title}<ChevronRight size={15}/></button><button type="button" onClick={() => onActivity(right.id)}>{right.title}<ChevronRight size={15}/></button></div>;
    })}</section>}
    {unknownTime.length > 0 && <p className="calendar-panel__hint">참석 일정 {unknownTime.length}개는 시작·종료 시각이 모두 정해지지 않아 시간 겹침을 확인할 수 없어요.</p>}
    {selected.length > 0 && <section className="calendar-panel__list" aria-label="모임·약속 일정"><h3>모임·약속 {selected.length}개</h3>{selected.map(activityCard)}</section>}
    <section className="calendar-panel__list" aria-label="개인 여행 일정"><header><h3>내 여행</h3><button type="button" onClick={onAllPlans}>전체 보기<ChevronRight size={15}/></button></header>{selectedPlans.map(planCard)}{!date && filteredPlans.some(item => !item.range) && <><h4>날짜 미정</h4>{filteredPlans.filter(item => !item.range).map(planCard)}</>}{!selectedPlans.length && <p className="calendar-panel__hint">{date ? '선택한 날짜의 여행이 없어요.' : '이번 달에는 날짜가 정해진 내 여행이 없어요.'}</p>}</section>
    {!date && undated.length > 0 && <section className="calendar-panel__list" aria-label="날짜 미정 모임·약속"><h3>날짜 미정 모임·약속</h3>{undated.map(activityCard)}</section>}
    {!selected.length && !selectedPlans.length && <p className="calendar-panel__empty">{date ? '이 날짜에는 일정이 없어요.' : '이번 달에는 일정이 없어요.'} 다른 날짜나 종류를 선택해 보세요.</p>}
  </div>;
}
