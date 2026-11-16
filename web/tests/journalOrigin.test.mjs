import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { captureJournalOrigin, completeJournal, resolveJournalOrigin } from '../src/together/journalOrigin.ts';
import { shareMemberJournal, ownShareableJournals } from '../src/together/memberRecords.ts';
import { stashJournalDraft } from '../src/journalDraft.ts';

function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'owner', name: '모임장' }, { id: 'other', name: '다른 사람' });
  state.groups.push({ id: 'g', name: '우리 가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', promotionPublished: false, ownerId: 'owner', memberIds: ['owner', 'me'], managerIds: [], archived: false });
  state.activities.push({ id: 'a', groupId: 'g', title: '주말 나들이', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  return state;
}
const journal = () => ({ id: 'mine', title: '  우리 나들이  ', purpose: 'JOURNAL', status: 'PLANNING', visibility: 'PRIVATE', isMine: true,
  region: '부산', dateRange: '', duration: '하루', cover: '', summary: '우리의 하루', story: '기억할 순간', author: '나', tags: [], saves: 0,
  planningPreferences: { prompt: '개인 요청' }, editorDraft: { value: { story: '초안' } },
  days: [{ day: 1, date: '', title: '', story: '', places: [{ id: 'p', name: '식당', kind: 'FOOD', area: '부산', address: '', image: '', description: '', duration: '', note: '개인 메모', booking: { confirmation: '예약번호' } }], blocks: [{ id: 'text', type: 'TEXT', body: '본문' }] }] });

test('origin captures only exact IDs without copying private source or mutating a room', () => {
  const state = fixture(), before = structuredClone(state);
  const origin = captureJournalOrigin(state, 'me', 'g', 'a', 'mine');
  assert.deepEqual(origin, { actorId: 'me', groupId: 'g', activityId: 'a', journeyId: 'mine' });
  assert.deepEqual(state, before);
  for (const ids of [['', 'g', 'a', 'mine'], ['other', 'g', 'a', 'mine'], ['me', 'g', '', 'mine'], ['me', 'g', 'a', '']]) assert.equal(captureJournalOrigin(state, ...ids), null);
});

test('return resolves the fresh exact appointment and never crosses account or sibling scope', () => {
  const state = fixture(), origin = captureJournalOrigin(state, 'me', 'g', 'a', 'mine');
  state.activities[0].title = '변경한 이름'; state.activities[0].revision += 1;
  assert.equal(resolveJournalOrigin(state, 'me', origin).activityTitle, '변경한 이름');
  assert.equal(resolveJournalOrigin(state, 'other', origin), null);
  assert.equal(resolveJournalOrigin(state, '', origin), null);
  for (const extra of [{ groupId: 'other-group' }, { activityId: 'missing' }, { journeyId: '' }]) assert.equal(resolveJournalOrigin(state, 'me', { ...origin, ...extra }), null);
});

test('departing, blocking, archiving, cancelling or moving the original closes the return handoff', () => {
  for (const change of [s => s.groups[0].memberIds = ['owner'], s => s.groups[0].blockedMemberIds = ['me'], s => s.groups[0].archived = true, s => s.activities[0].status = 'CANCELLED', s => s.activities[0].groupId = 'elsewhere', s => s.activities = [], s => s.members = s.members.filter(m => m.id !== 'me')]) {
    const state = fixture(), origin = captureJournalOrigin(state, 'me', 'g', 'a', 'mine'); change(state);
    assert.equal(resolveJournalOrigin(state, 'me', origin), null);
  }
});

test('explicit completion makes a private journal shareable without publishing its original', () => {
  const source = journal(), before = structuredClone(source), completed = completeJournal(source);
  assert.equal(completed.status, 'PUBLISHED'); assert.equal(completed.visibility, 'PRIVATE');
  assert.equal(completed.title, '우리 나들이'); assert.equal(completed.editorDraft, undefined);
  assert.equal(ownShareableJournals([completed]).length, 1); assert.deepEqual(source, before);
  assert.equal(completeJournal({ ...source, visibility: 'PUBLIC' }).visibility, 'PUBLIC');
});

test('autosaving an unfinished origin journal keeps a draft and never enables the completion handoff', () => {
  const state = fixture(), source = journal(), origin = captureJournalOrigin(state, 'me', 'g', 'a', source.id);
  const saved = stashJournalDraft(source, { ...source, story: '계속 쓰는 내용' });
  assert.equal(saved.status, 'PLANNING'); assert.equal(saved.visibility, 'PRIVATE');
  assert.equal(resolveJournalOrigin(state, 'me', origin, [saved]), null);
  assert.ok(resolveJournalOrigin(state, 'me', origin, [completeJournal(source)]));
  for (const other of [[], [{ ...completeJournal(source), id: 'sibling' }], [{ ...completeJournal(source), isMine: false }], [{ ...completeJournal(source), trash: {} }]]) assert.equal(resolveJournalOrigin(state, 'me', origin, other), null);
});

test('completion and return do not share; an explicit final share creates one sanitized exact-room snapshot', () => {
  const state = fixture(), source = completeJournal(journal()), before = structuredClone(source), origin = captureJournalOrigin(state, 'me', 'g', 'a', source.id);
  assert.ok(resolveJournalOrigin(state, 'me', origin, [source])); assert.equal(state.sharedJournals.length, 0);
  shareMemberJournal(state, 'me', origin.groupId, source, origin.activityId);
  const shared = state.sharedJournals[0];
  assert.equal(shared.groupId, 'g'); assert.equal(shared.activityId, 'a'); assert.equal(shared.sourceJourneyId, 'mine');
  assert.equal(shared.journey.planningPreferences, undefined); assert.equal(shared.journey.days[0].places[0].booking, undefined); assert.equal(shared.journey.days[0].places[0].note, '');
  assert.deepEqual(source, before); assert.equal(source.visibility, 'PRIVATE');
  assert.throws(() => shareMemberJournal(state, 'me', 'g', source, 'a'), /이미 공유/); assert.equal(state.sharedJournals.length, 1);
});

test('non-own, plan, trash and untitled records cannot be completed through the origin flow', () => {
  for (const patch of [{ isMine: false }, { purpose: 'PLAN' }, { trash: {} }, { title: '   ' }]) assert.throws(() => completeJournal({ ...journal(), ...patch }));
});
