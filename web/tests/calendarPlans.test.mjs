import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarIncludes, calendarMonthIntersects, calendarRange, normalizeCalendarView, selectPersonalCalendarPlans, validCalendarDay } from '../src/together/calendarPlans.ts';

const plan = (id, extra = {}) => ({ id, title: id, isMine: true, purpose: 'PLAN', visibility: 'PRIVATE',
  days: [{ date: '2026-11-06' }, { date: '2026-11-07' }, { date: '2026-11-08' }], ...extra });

test('calendar selects only current own private plans and returns no personal original fields', () => {
  const items = [plan('mine', { planningPreferences: { prompt: '개인 요청' }, story: '비공개 메모', editorDraft: { value: { title: '미완성 수정' } } }),
    plan('journal', { purpose: 'JOURNAL' }), plan('legacy-journal', { purpose: undefined }), plan('stranger', { isMine: false }),
    plan('published', { visibility: 'PUBLIC' }), plan('trash', { trash: { deletedAt: '2026-11-01' } })];
  const before = structuredClone(items);
  assert.deepEqual(selectPersonalCalendarPlans(items), [{ id: 'mine', title: 'mine', range: { startDate: '2026-11-06', endDate: '2026-11-08' } }]);
  assert.deepEqual(items, before);
});

test('dated own DAY visits define an inclusive multiday range, independent of stale start metadata', () => {
  const [item] = selectPersonalCalendarPlans([plan('trip', { startDate: '2026-10-01', days: [
    { date: '2026-11-08', places: [{ visitId: 'visit-b', bookingFixed: true }] },
    { date: '2026-11-06', places: [{ visitId: 'visit-a', note: 'private' }] }, { date: 'DAY 3', places: [] },
  ] })]);
  assert.deepEqual(item.range, { startDate: '2026-11-06', endDate: '2026-11-08' });
  assert.equal(calendarIncludes(item.range, '2026-11-05'), false);
  assert.equal(calendarIncludes(item.range, '2026-11-06'), true);
  assert.equal(calendarIncludes(item.range, '2026-11-07'), true);
  assert.equal(calendarIncludes(item.range, '2026-11-08'), true);
  assert.equal(calendarIncludes(item.range, '2026-11-09'), false);
  assert.equal(calendarIncludes(item.range, '2026-10-01'), false);
});

test('legacy startDate plus existing DAY count covers month and leap-day boundaries without counting places', () => {
  const [item] = selectPersonalCalendarPlans([plan('leap', { startDate: '2028-02-28', days: [
    { date: 'DAY 1', places: [{ id: 'one' }, { id: 'two' }] }, { date: 'DAY 2', places: [] }, { date: 'DAY 3', places: [] },
  ] })]);
  assert.deepEqual(item.range, { startDate: '2028-02-28', endDate: '2028-03-01' });
  assert.equal(calendarIncludes(item.range, '2028-02-29'), true);
  assert.equal(calendarIncludes(item.range, '2028-03-02'), false);
});

test('undated plans remain undated and never gain dots from human duration, dates in private drafts or invalid dates', () => {
  const items = selectPersonalCalendarPlans([plan('unknown', { startDate: '2026-02-30', dateRange: '2026.11.06 ~ 11.08',
    duration: '2박 3일', editorDraft: { value: { startDate: '2026-11-06' } }, days: [{ date: 'DAY 1' }, { date: '2026-02-30' }] })]);
  assert.equal(items[0].range, null);
  assert.equal(calendarIncludes(items[0].range, '2026-11-06'), false);
});

test('calendar validates exact days and does not extend reversed or invalid group ranges', () => {
  for (const value of ['2026-02-30', '2026-2-06', '2026-11-06T12:00:00Z', '', undefined, '2026-13-01']) assert.equal(validCalendarDay(value), false);
  assert.equal(validCalendarDay('2028-02-29'), true);
  assert.equal(calendarRange('2026-02-30', '2026-11-10'), null);
  assert.deepEqual(calendarRange('2026-11-06', '2026-11-05'), { startDate: '2026-11-06', endDate: '2026-11-06' });
  assert.deepEqual(calendarRange('2026-11-06', '2026-11-99'), { startDate: '2026-11-06', endDate: '2026-11-06' });
  assert.equal(calendarIncludes(calendarRange('2026-11-06', '2026-11-08'), '2026-11-07'), true);
  assert.equal(calendarIncludes(calendarRange('2026-11-06', '2026-11-08'), '2026-11-99'), false);
});

test('calendar selection sorts dated plans first and preserves exact distinct journey identities', () => {
  const items = selectPersonalCalendarPlans([plan('unknown', { startDate: undefined, days: [] }),
    plan('same-name-second', { title: '같은 여행', days: [{ date: '2026-12-01' }] }),
    plan('same-name-first', { title: '같은 여행', days: [{ date: '2026-11-06' }] })]);
  assert.deepEqual(items.map(item => item.id), ['same-name-first', 'same-name-second', 'unknown']);
  assert.deepEqual(items.filter(item => calendarIncludes(item.range, '2026-11-06')).map(item => item.id), ['same-name-first']);
});

test('default month list includes inclusive cross-month trips and excludes schedules outside the displayed month', () => {
  const range = calendarRange('2026-10-31', '2026-11-02');
  assert.equal(calendarMonthIntersects(range, '2026-10'), true);
  assert.equal(calendarMonthIntersects(range, '2026-11'), true);
  assert.equal(calendarMonthIntersects(range, '2026-09'), false);
  assert.equal(calendarMonthIntersects(range, '2026-12'), false);
  assert.equal(calendarMonthIntersects(calendarRange('2026-10-23'), '2026-11'), false);
  assert.equal(calendarMonthIntersects(calendarRange('2026-11-30'), '2026-11'), true);
  assert.equal(calendarMonthIntersects(calendarRange('2028-02-29'), '2028-02'), true);
  assert.equal(calendarMonthIntersects(calendarRange('2026-12-31', '2027-01-01'), '2027-01'), true);
});

test('month filtering cannot invent schedules for undated entries or malformed month values', () => {
  assert.equal(calendarMonthIntersects(null, '2026-11'), false);
  for (const month of ['', '2026-1', '2026-00', '2026-13', '2026-11-01']) {
    assert.equal(calendarMonthIntersects(calendarRange('2026-01-01', '2026-12-31'), month), false);
  }
});

test('calendar route input restores exact month and day while rejecting impossible or cross-month selections', () => {
  const selected = { month: '2026-12', date: '2026-12-31' };
  assert.deepEqual(normalizeCalendarView(selected, '2026-11'), selected);
  assert.deepEqual(selected, { month: '2026-12', date: '2026-12-31' });
  assert.deepEqual(normalizeCalendarView({ month: '2026-11', date: '2026-12-01' }, '2026-10'), { month: '2026-11', date: '' });
  assert.deepEqual(normalizeCalendarView({ month: '2026-02', date: '2026-02-30' }, '2026-10'), { month: '2026-02', date: '' });
  assert.deepEqual(normalizeCalendarView({ month: '2026-13', date: '' }, '2026-11'), { month: '2026-11', date: '' });
  assert.deepEqual(normalizeCalendarView(undefined, '2026-11'), { month: '2026-11', date: '' });
});
