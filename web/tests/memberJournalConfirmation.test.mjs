import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMemberJournalConfirmation, isMemberJournalConfirmationCurrent } from '../src/together/memberJournalConfirmation.ts';

const journal = () => ({ id: 'own-journal', title: '내 여행기', purpose: 'JOURNAL', status: 'PUBLISHED', visibility: 'PRIVATE', isMine: true,
  region: '부산', dateRange: '', duration: '하루', cover: '', summary: '확인한 요약', story: '확인한 본문', author: '나', tags: [], saves: 0,
  days: [{ day: 1, date: '', title: '첫날', story: '', places: [], blocks: [{ id: 'text', type: 'TEXT', body: '확인한 글' }] }] });

test('consent remains valid only for the same unchanged own published journal and destination', () => {
  const source = journal(), before = structuredClone(source), confirmation = captureMemberJournalConfirmation(source, '모임A · 전체');
  assert.ok(confirmation); assert.equal(isMemberJournalConfirmationCurrent(confirmation, source, '모임A · 전체'), true);
  assert.equal(isMemberJournalConfirmationCurrent(confirmation, structuredClone(source), '모임A · 전체'), true);
  for (const scope of ['모임B · 전체', '모임A › 약속', '']) assert.equal(isMemberJournalConfirmationCurrent(confirmation, source, scope), false);
  assert.deepEqual(source, before);
});

test('same-ID body, photo, route and visibility edits require renewed consent without changing the source', () => {
  for (const change of [s => s.story = '새로 쓴 본문', s => s.cover = '/new-photo.jpg', s => s.days[0].blocks[0].body = '새로 쓴 글', s => s.days[0].places.push({ id: 'new-place', name: '새 장소' }), s => s.visibility = 'PUBLIC']) {
    const source = journal(), confirmation = captureMemberJournalConfirmation(source, '모임A'); change(source); const before = structuredClone(source);
    assert.equal(isMemberJournalConfirmationCurrent(confirmation, source, '모임A'), false); assert.deepEqual(source, before);
    assert.equal(isMemberJournalConfirmationCurrent(captureMemberJournalConfirmation(source, '모임A'), source, '모임A'), true);
  }
});

test('deleted, unfinished, trashed, other-author and nonjournal sources cannot reuse or acquire share consent', () => {
  const confirmation = captureMemberJournalConfirmation(journal(), '모임A');
  assert.equal(isMemberJournalConfirmationCurrent(confirmation, undefined, '모임A'), false);
  assert.equal(isMemberJournalConfirmationCurrent(null, journal(), '모임A'), false);
  for (const extra of [{ isMine: false }, { status: 'PLANNING' }, { trash: {} }, { purpose: 'PLAN' }]) {
    const source = { ...journal(), ...extra };
    assert.equal(captureMemberJournalConfirmation(source, '모임A'), null); assert.equal(isMemberJournalConfirmationCurrent(confirmation, source, '모임A'), false);
  }
  assert.equal(captureMemberJournalConfirmation(journal(), ''), null);
});

test('in-place same-ID edits invalidate a captured version and malformed cyclic input fails closed', () => {
  const source = journal(), confirmation = captureMemberJournalConfirmation(source, '모임A');
  source.story += ' 나중에 덧붙인 글'; assert.equal(isMemberJournalConfirmationCurrent(confirmation, source, '모임A'), false);
  source.cycle = source;
  assert.equal(captureMemberJournalConfirmation(source, '모임A'), null); assert.equal(isMemberJournalConfirmationCurrent(confirmation, source, '모임A'), false);
});
