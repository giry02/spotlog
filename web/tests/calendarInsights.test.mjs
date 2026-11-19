import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { calendarActivityInterval, createCalendarExport, findCalendarConflicts, selectCalendarActivities } from '../src/together/calendarInsights.ts';

const date = '2026-11-19';
const makeGroup = (id, kind = 'HOBBY', extra = {}) => ({ id, name: id, kind, region: '부산', introduction: '', cover: '', memberIds: ['self', 'friend'],
  ownerId: 'self', managerIds: [], visibility: 'PRIVATE', archived: false, promotionPublished: false, ...extra });
const makeActivity = (id, groupId, extra = {}) => ({ id, groupId, title: id, date, endDate: date, startTime: '10:00', endTime: '11:00',
  meetingPoint: '만남 장소', description: '이 내용은 내보내지 않음', status: 'PLANNED', leadId: 'self', editorIds: [], arrivedIds: [],
  participants: { self: 'JOINED' }, revision: 1, ...extra });
function state() {
  const value = createEmptyState('self', '내 계정');
  value.members.push({ id: 'friend', name: '친구 계정' });
  value.groups.push(makeGroup('family', 'FAMILY'), makeGroup('friends', 'FRIENDS'), makeGroup('hobby'), makeGroup('guide', 'GUIDE'));
  value.activities.push(makeActivity('first', 'hobby'), makeActivity('second', 'friends', { startTime: '10:30', endTime: '12:00' }));
  return value;
}

test('calendar projections require current membership and return group kinds without private records', () => {
  const value = state();
  value.groups.push(makeGroup('stranger', 'HOBBY', { memberIds: ['friend'] }), makeGroup('blocked', 'HOBBY', { blockedMemberIds: ['self'] }),
    makeGroup('trashed', 'FRIENDS', { spaceType: 'ACTIVITY', temporaryRoom: { disposition: 'TRASH' } }));
  value.activities.push(makeActivity('hidden', 'stranger'), makeActivity('blocked-event', 'blocked'), makeActivity('removed-event', 'trashed'));
  const projected = selectCalendarActivities(value, 'self');
  assert.deepEqual(projected.map(item => item.id), ['first', 'second']);
  assert.deepEqual(projected.map(item => item.tone), ['HOBBY', 'FRIENDS']);
  assert.equal(JSON.stringify(projected).includes('이 내용은 내보내지 않음'), false);
  assert.deepEqual(selectCalendarActivities(value, ''), []);
  assert.deepEqual(selectCalendarActivities(value, 'missing'), []);
});

test('time conflicts require real ends and overlap, while adjacent events do not conflict', () => {
  const value = state();
  value.activities.push(makeActivity('adjacent', 'family', { startTime: '12:00', endTime: '13:00' }));
  const rows = selectCalendarActivities(value, 'self');
  const conflicts = findCalendarConflicts(rows);
  assert.equal(conflicts.length, 1);
  assert.deepEqual([conflicts[0].leftId, conflicts[0].rightId], ['first', 'second']);
  assert.equal(new Date(conflicts[0].start).toISOString(), '2026-11-19T01:30:00.000Z');
  assert.equal(new Date(conflicts[0].end).toISOString(), '2026-11-19T02:00:00.000Z');
});

test('undecided, reversed, invalid, declined and cancelled event times do not invent conflicts', () => {
  const value = state();
  value.activities = [
    makeActivity('known', 'hobby'), makeActivity('unknown-end', 'hobby', { endTime: undefined }),
    makeActivity('unknown-start', 'hobby', { startTime: undefined }), makeActivity('reversed', 'hobby', { endTime: '09:00' }),
    makeActivity('invalid', 'hobby', { startTime: '25:00' }), makeActivity('declined', 'hobby', { participants: { self: 'DECLINED' } }),
    makeActivity('cancelled', 'hobby', { status: 'CANCELLED' }), makeActivity('completed', 'hobby', { status: 'COMPLETED' }),
  ];
  const rows = selectCalendarActivities(value, 'self');
  assert.deepEqual(findCalendarConflicts(rows), []);
  for (const id of ['unknown-end', 'unknown-start', 'reversed', 'invalid']) {
    assert.equal(calendarActivityInterval(rows.find(row => row.id === id)), null);
  }
});

test('explicit overnight and multiday time ranges use the stated end date', () => {
  const value = state();
  value.activities = [makeActivity('overnight', 'friends', { startTime: '23:00', endDate: '2026-11-20', endTime: '01:00' }),
    makeActivity('early', 'family', { date: '2026-11-20', endDate: '2026-11-20', startTime: '00:30', endTime: '02:00' })];
  const pair = findCalendarConflicts(selectCalendarActivities(value, 'self'))[0];
  assert.equal(new Date(pair.start).toISOString(), '2026-11-19T15:30:00.000Z');
  assert.equal(new Date(pair.end).toISOString(), '2026-11-19T16:00:00.000Z');
});

test('ICS uses only joined, dated events, exact Korea clocks and escaped titles with private classification', () => {
  const value = state();
  value.activities[0].title = '제목, 쉼표; 세미콜론\\줄\nEND:VEVENT\nBEGIN:VEVENT';
  value.activities[0].meetingPoint = '장소, 입구; 앞';
  value.activities.push(makeActivity('cancelled', 'hobby', { status: 'CANCELLED' }),
    makeActivity('undated', 'hobby', { date: '', endDate: '' }), makeActivity('maybe', 'hobby', { participants: { self: 'MAYBE' } }));
  const output = createCalendarExport(selectCalendarActivities(value, 'self'), [], new Date('2026-11-01T00:00:00Z'));
  assert.equal(output.count, 2);
  assert.match(output.text, /DTSTART:20261119T010000Z\r\nDTEND:20261119T020000Z/);
  assert.match(output.text, /CLASS:PRIVATE/);
  assert.match(output.text, /LOCATION:장소\\, 입구\\; 앞/);
  const unfolded = output.text.replaceAll('\r\n ', '');
  assert.match(unfolded, /SUMMARY:제목\\, 쉼표\\; 세미콜론\\\\줄\\nEND:VEVENT\\nBEGIN:VEVENT/);
  assert.equal((output.text.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length, 2);
  assert.equal(output.text.includes('이 내용은 내보내지 않음'), false);
  assert.equal(output.text.includes('ATTENDEE:'), false);
});

test('ICS preserves unknown duration without fabricated DTEND, and uses exclusive ends for all-day dates', () => {
  const value = state();
  value.activities = [makeActivity('start-only', 'hobby', { endTime: undefined }),
    makeActivity('day-only', 'family', { date: '2028-02-29', endDate: '2028-03-01', startTime: undefined, endTime: undefined })];
  const rows = selectCalendarActivities(value, 'self');
  const output = createCalendarExport(rows, [{ id: 'my-trip', title: '나의 여행', range: { startDate: '2026-12-31', endDate: '2027-01-02' } }]);
  const first = output.text.slice(output.text.indexOf('BEGIN:VEVENT'), output.text.indexOf('END:VEVENT'));
  assert.equal(first.includes('DTEND:'), false);
  assert.match(first, /TRANSP:TRANSPARENT/);
  assert.match(first, /종료 시각 미정/);
  assert.match(output.text, /DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280302/);
  assert.match(output.text, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270103/);
  assert.equal(output.count, 3);
});

test('ICS folds UTF-8 at 75 bytes without splitting Korean and keeps deterministic UIDs', () => {
  const value = state();
  value.activities[0].title = '가나다라마바사'.repeat(20);
  const rows = selectCalendarActivities(value, 'self');
  const first = createCalendarExport(rows, []), again = createCalendarExport(rows, []);
  const encoder = new TextEncoder();
  for (const line of first.text.split('\r\n')) assert.ok(encoder.encode(line).length <= 75, line);
  assert.equal(first.text.includes('�'), false);
  assert.ok(first.text.replaceAll('\r\n ', '').includes(value.activities[0].title));
  assert.deepEqual(first.text.match(/^UID:.+$/gm), again.text.match(/^UID:.+$/gm));
  assert.throws(() => createCalendarExport(rows, [], new Date('invalid')));
});
