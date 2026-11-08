import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectMemberHomeSchedule } from '../src/community/memberHomeReturn.ts';

const at = new Date('2026-11-06T12:00:00+09:00');
const plan = (id, date = '2026-11-07', extra = {}) => ({
  id, title: `개인 여행 ${id}`, purpose: 'PLAN', planStage: 'READY', isMine: true, status: 'PLANNING', visibility: 'PRIVATE',
  startDate: date, days: [{ date, places: [{ address: '개인 상세 주소', note: '개인 메모', bookingFixed: true }], story: '개인 기록' }],
  planningPreferences: { prompt: '개인 요청문' }, author: '개인 작성자', ...extra,
});
const fixture = () => {
  const state = createEmptyState('me', '나');
  state.groups = [{ id: 'family', name: '가족', ownerId: 'me', memberIds: ['me'], managerIds: [], archived: false }];
  state.activities = [{ id: 'appointment', groupId: 'family', title: '가족 약속', date: '2026-11-08', endDate: '2026-11-08',
    status: 'PLANNED', participants: {}, startTime: '13:00' }];
  return state;
};

test('private personal trip can be the next schedule without any group membership', () => {
  const state = createEmptyState('me', '나');
  assert.deepEqual(selectMemberHomeSchedule(state, 'me', [plan('trip')], at), {
    kind: 'PLAN', id: 'trip', title: '개인 여행 trip', date: '2026-11-07', endDate: '2026-11-07',
  });
  const projection = JSON.stringify(selectMemberHomeSchedule(state, 'me', [plan('trip')], at));
  for (const privateField of ['개인 상세 주소', '개인 메모', '개인 기록', '개인 요청문', '개인 작성자', 'bookingFixed', 'places', 'planningPreferences']) {
    assert.equal(projection.includes(privateField), false, privateField);
  }
});

test('guests and unknown accounts get no supplied personal plans or private activities', () => {
  const state = fixture();
  assert.equal(selectMemberHomeSchedule(state, '', [plan('trip')], at), null);
  assert.equal(selectMemberHomeSchedule(state, 'someone-else', [plan('trip')], at), null);
  state.members = [];
  assert.equal(selectMemberHomeSchedule(state, 'me', [plan('trip')], at), null);
});

test('the first current calendar item wins across personal trips and group or standalone appointments', () => {
  const state = fixture();
  assert.equal(selectMemberHomeSchedule(state, 'me', [plan('later', '2026-11-09')], at).kind, 'ACTIVITY');
  assert.equal(selectMemberHomeSchedule(state, 'me', [plan('nearer')], at).id, 'nearer');
  state.groups[0].spaceType = 'ACTIVITY';
  assert.equal(selectMemberHomeSchedule(state, 'me', [plan('later', '2026-11-09')], at).id, 'appointment');
  state.activities[0].participants.me = 'DECLINED';
  assert.equal(selectMemberHomeSchedule(state, 'me', [plan('later', '2026-11-09')], at).id, 'later');
});

test('only actual owned private ready plans enter the compact schedule', () => {
  const state = createEmptyState('me', '나');
  for (const change of [ { isMine: false }, { purpose: 'JOURNAL' }, { purpose: undefined }, { visibility: 'PUBLIC' },
    { trash: { deletedAt: '2026-11-01' } }, { planStage: 'DRAFT' }, { planStage: 'unknown' }, { status: 'PUBLISHED' } ]) {
    assert.equal(selectMemberHomeSchedule(state, 'me', [plan('excluded', '2026-11-07', change)], at), null, JSON.stringify(change));
  }
  assert.equal(selectMemberHomeSchedule(state, 'me', [plan('legacy', '2026-11-07', { planStage: undefined })], at).id, 'legacy');
});

test('ongoing multi-day travel remains available through its last Korea calendar day', () => {
  const state = createEmptyState('me', '나');
  const journey = plan('ongoing', '2026-11-04', { status: 'TRAVELING', days: [{ date: '2026-11-04' }, { date: '2026-11-06' }] });
  assert.deepEqual(selectMemberHomeSchedule(state, 'me', [journey], at), {
    kind: 'PLAN', id: 'ongoing', title: '개인 여행 ongoing', date: '2026-11-04', endDate: '2026-11-06',
  });
  assert.equal(selectMemberHomeSchedule(state, 'me', [journey], new Date('2026-11-06T15:00:00Z')), null);
});

test('undated and malformed calendar dates cannot masquerade as a future personal schedule', () => {
  const state = createEmptyState('me', '나');
  for (const date of ['', '2026-02-30', '2026-13-01', '11월 7일', '2026-11-05']) {
    assert.equal(selectMemberHomeSchedule(state, 'me', [plan('invalid', date)], at), null, date);
  }
  const journey = plan('day-date', '', { days: [{ date: '2026-11-09' }, { date: '' }] });
  assert.equal(selectMemberHomeSchedule(state, 'me', [journey], at).date, '2026-11-09');
  assert.throws(() => selectMemberHomeSchedule(state, 'me', [], new Date('bad')), RangeError);
});

test('selection is stable across input order and never mutates personal source or group state', () => {
  const state = fixture(); const plans = [plan('z'), plan('a')];
  const source = JSON.stringify({ state, plans });
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  freeze(state); freeze(plans);
  const selected = selectMemberHomeSchedule(state, 'me', plans, at);
  assert.equal(selected.id, 'a');
  assert.deepEqual(selectMemberHomeSchedule(state, 'me', [...plans].reverse(), at), selected);
  assert.equal(JSON.stringify({ state, plans }), source);
});
