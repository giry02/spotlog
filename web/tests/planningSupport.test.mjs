import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { applyActivityAssistantAction } from '../src/together/activityAssistant.ts';
import { buildDatePollDraft, buildDepartureChecklist, buildNextActivityBrief, buildPlanningFeedback, comparePlanningPlaces, getPlanningSupportContext, planningToday } from '../src/together/planningSupport.ts';

const at = new Date('2026-11-04T20:00:00+09:00');
const scope = { groupId: 'g', activityId: 'activity' };
const place = (id, extra = {}) => ({ id, kind: 'FOOD', name: `식당 ${id}`, area: '부산', address: `부산 ${id} 지점`, lat: 35, lng: 129, image: '', description: '', duration: '', note: '가져오면 안 되는 개인 메모', ...extra });
const places = [place('a'), place('b'), place('personal', { personal: true }), place('unshared')];
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'host', name: '모임장' });
  state.groups.push({ id: 'g', name: '가족 모임', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'host', memberIds: ['me', 'host'], managerIds: [], archived: false, promotionPublished: false, interestPlaceIds: ['a', 'b', 'personal', 'withdrawn'] });
  state.activities.push({ id: 'activity', groupId: 'g', title: '가족 식사', date: '2026-11-07', endDate: '', meetingPoint: '', startTime: '', description: '', status: 'PLANNED', leadId: 'host', editorIds: [], participants: { me: 'MAYBE' }, arrivedIds: [], revision: 4 });
  return state;
}

test('scope checks block outsiders, blocked members and cross-group activity IDs, without relying on RSVP', () => {
  const state = fixture(); state.activities[0].participants.outsider = 'JOINED';
  assert.throws(() => getPlanningSupportContext(state, 'outsider', scope, at));
  assert.throws(() => getPlanningSupportContext(state, 'me', { ...scope, activityId: 'foreign' }, at));
  state.groups[0].blockedMemberIds = ['me'];
  assert.throws(() => buildDepartureChecklist(state, 'me', scope));
});

test('group preparation includes only its own unfinished group-level tasks', () => {
  const state = fixture();
  state.tasks.push(
    { id: 'group-open', groupId: 'g', title: '모임 준비', completed: false },
    { id: 'group-done', groupId: 'g', title: '끝난 준비', completed: true },
    { id: 'activity-task', groupId: 'g', activityId: 'activity', title: '약속 준비', completed: false },
    { id: 'other-group', groupId: 'other', title: '다른 모임 준비', completed: false },
  );
  const result = buildDepartureChecklist(state, 'me', { groupId: 'g' });
  assert.deepEqual(result.tasks.map(task => task.id), ['group-open']);
  assert.equal(result.activity, undefined); assert.deepEqual(result.fixedBookings, []);
});

test('next-plan explicit multiple interests survive handoff while invalid topics are rejected', () => {
  const input = { region: '부산', feedback: '', wish: '보드게임과 독서 약속', purpose: 'MEETUP', theme: 'OTHER', topics: ['GAME', 'BOOK', 'GAME'] };
  const draft = buildNextActivityBrief(input);
  assert.deepEqual(draft.topics, ['GAME', 'BOOK']); assert.deepEqual(input.topics, ['GAME', 'BOOK', 'GAME']);
  assert.deepEqual(buildNextActivityBrief({ ...input, topics: [] }).topics, []);
  assert.throws(() => buildNextActivityBrief({ ...input, topics: ['INVENTED'] }), /관심사/);
});

test('past KST dates, completed/cancelled/archived states disable writes; completed activities may seed a new explicit plan', () => {
  const state = fixture();
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canWrite, true);
  assert.equal(planningToday(new Date('2026-11-04T15:00:00Z')), '2026-11-05');
  state.activities[0].date = '2026-11-01';
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canWrite, false);
  state.activities[0].endDate = '2026-11-04';
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canWrite, true);
  state.activities[0].status = 'COMPLETED';
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canWrite, false);
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canPlanNext, true);
  state.activities[0].status = 'CANCELLED';
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canPlanNext, false);
  state.activities[0].status = 'PLANNED'; state.groups[0].archived = true;
  assert.equal(getPlanningSupportContext(state, 'me', scope, at).canPlanNext, false);
});

test('place comparison admits only shared public identities and treats missing evidence as unknown, never inferred from distance', () => {
  const state = fixture(), before = structuredClone(state);
  const rows = comparePlanningPlaces(state, 'me', scope, places, ['a', 'b'], { budgetCap: 20000, walkingLimit: 10 }, [{ placeId: 'a', costPerPerson: 0, walkingMinutes: 10 }, { placeId: 'b', costPerPerson: 20001 }]);
  assert.deepEqual(rows.map(row => row.checks), [{ budget: 'MATCH', walking: 'MATCH' }, { budget: 'CONFLICT', walking: 'UNKNOWN' }]);
  assert.equal('note' in rows[0].place, false);
  for (const id of ['personal', 'unshared', 'withdrawn']) assert.throws(() => comparePlanningPlaces(state, 'me', scope, places, ['a', id], {}, []));
  assert.deepEqual(state, before);
});

test('date poll validates exact dates/time and distinct candidates, counts only manually stated own responses', () => {
  const rows = [{ id: 'one', date: '2026-11-07', time: '12:30', availability: 'YES' }, { id: 'two', date: '2026-11-08', time: '', availability: 'NO' }];
  const before = structuredClone(rows), draft = buildDatePollDraft(rows, '  함께할 날  ', at);
  assert.deepEqual(draft, { question: '함께할 날', options: ['2026-11-07 12:30 (한국 시각)', '2026-11-08 · 시각 미정 (한국 시각)'], availabilityCounts: { YES: 1, MAYBE: 0, NO: 1 } });
  assert.deepEqual(rows, before);
  for (const changes of [{ date: '2026-02-30' }, { date: '2026-11-03' }, { time: '24:00' }, { availability: 'ASSUMED' }]) assert.throws(() => buildDatePollDraft([{ ...rows[0], ...changes }, rows[1]], '후보', at));
  assert.throws(() => buildDatePollDraft([rows[0], rows[0]], '후보', at));
  assert.throws(() => buildDatePollDraft([rows[0]], '후보', at));
});

test('departure checks preserve exact activity tasks and booking protection without exposing notes or treating reservations as complete', () => {
  const state = fixture(); state.activities[0].journey = { days: [{ day: 1, places: [place('stay', { name: '숙소', bookingFixed: true, visitId: 'visit', time: '18:00', booking: { number: 'PRIVATE-NUMBER' } })] }] };
  state.tasks = [
    { id: 'one', groupId: 'g', activityId: 'activity', title: '예약 조건 확인', completed: false },
    { id: 'done', groupId: 'g', activityId: 'activity', title: '완료 항목', completed: true },
    { id: 'foreign', groupId: 'other', activityId: 'activity', title: '다른 모임', completed: false },
    { id: 'group', groupId: 'g', title: '모임 전체', completed: false },
  ];
  const before = structuredClone(state), result = buildDepartureChecklist(state, 'me', scope);
  assert.deepEqual(result.tasks.map(item => item.id), ['one']);
  assert.deepEqual(result.checks.filter(item => item.state === 'MISSING').map(item => item.id), ['time', 'meeting']);
  assert.equal(result.fixedBookings[0].id, 'visit');
  assert.match(result.checks.find(item => item.state === 'FIXED').value, /예약 완료 여부는 별도 확인/);
  const visible = JSON.stringify({ checks: result.checks, fixedBookings: result.fixedBookings });
  assert.equal(visible.includes('PRIVATE-NUMBER'), false); assert.equal(visible.includes('개인 메모'), false);
  assert.deepEqual(buildDepartureChecklist(state, 'me', { groupId: 'g' }).checks, []);
  assert.deepEqual(state, before);
});

test('next-plan brief carries only actor-entered feedback and wish; it copies no old dates, attendance, bookings or title', () => {
  const input = { region: '부산', previousTitle: '이전 개인 기록', feedback: '걷기가 길었어요', wish: '실내 전시와 카페', purpose: 'OUTING', theme: 'CULTURE' };
  assert.deepEqual(buildNextActivityBrief(input), { prompt: '실내 전시와 카페', region: '부산', purpose: 'OUTING', theme: 'CULTURE', notes: '직접 남긴 후기: 걷기가 길었어요' });
  assert.equal('notes' in buildNextActivityBrief({ ...input, feedback: '' }), false);
  assert.equal('region' in buildNextActivityBrief({ ...input, region: '' }), false);
  assert.throws(() => buildNextActivityBrief({ ...input, wish: '' }));
  assert.throws(() => buildPlanningFeedback({ ...input, feedback: '' }));
  assert.match(buildPlanningFeedback(input), /다음에 하고 싶은 일: 실내 전시와 카페/);
});

test('explicit place-vote/task handoff uses existing latest-version domain and never edits itinerary, RSVP or private source', t => {
  // The chat-share boundary reads its own clock; keep it aligned with this fixed fixture.
  t.mock.timers.enable({ apis: ['Date'], now: at.getTime() });
  const state = fixture(), original = structuredClone(state.activities[0]);
  applyActivityAssistantAction(state, 'me', { ...scope, id: 'poll', expectedRevision: 4, type: 'CREATE_POLL', question: '식당 선택', placeIds: ['a', 'b'] }, places);
  applyActivityAssistantAction(state, 'me', { ...scope, id: 'task', expectedRevision: 4, type: 'CREATE_TASK', title: '영업 시간 확인', sourceMessageIds: [], sourceVersions: {}, assignee: 'SELF' }, places);
  assert.deepEqual(state.activities[0], original);
  assert.equal(state.tasks[0].assigneeId, 'me');
  assert.deepEqual(state.polls[0].options.map(item => item.voterIds), [[], []]);
  state.activities[0].revision = 5;
  const before = structuredClone(state);
  assert.throws(() => applyActivityAssistantAction(state, 'me', { ...scope, id: 'stale', expectedRevision: 4, type: 'CREATE_POLL', question: '다른 식당', placeIds: ['a', 'b'] }, places));
  assert.deepEqual(state, before);
});
