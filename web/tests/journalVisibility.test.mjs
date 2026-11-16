import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicJournal, journalVisibilityLabel, publicJournalCopyCount } from '../src/journalVisibility.ts';
import { completeJournal } from '../src/together/journalOrigin.ts';
import { isPublicHomeJournal, selectTravelHomeContent } from '../src/community/travelHomeModel.ts';
import { resolveChatbotSocialSelection } from '../src/chatbotHostBridge.ts';

const journal = (extra = {}) => ({ id: 'j', title: '내 기록', purpose: 'JOURNAL', status: 'PUBLISHED', visibility: 'PUBLIC', isMine: true,
  region: '부산', dateRange: '', duration: '하루', cover: '', summary: '', story: '', author: '나', tags: [], saves: 7, days: [], ...extra });

test('public eligibility requires publication and visibility together, excluding personal plans and trash', () => {
  assert.equal(isPublicJournal(journal()), true);
  assert.equal(isPublicJournal(journal({ purpose: undefined })), true); // Existing published legacy journals remain supported.
  for (const patch of [{ visibility: 'PRIVATE' }, { status: 'PLANNING' }, { status: 'TRAVELING' }, { purpose: 'PLAN' }, { trash: {} }]) assert.equal(isPublicJournal(journal(patch)), false);
});

test('private completed journals have a completed label rather than a public or draft label', () => {
  assert.equal(journalVisibilityLabel(journal()), '공개 여행기');
  assert.equal(journalVisibilityLabel(journal({ visibility: 'PRIVATE' })), '비공개 여행기');
  assert.equal(journalVisibilityLabel(journal({ visibility: 'PRIVATE', status: 'PLANNING' })), '비공개 초안');
  assert.equal(journalVisibilityLabel(journal({ status: 'PLANNING' })), '공개 전 초안');
  assert.notEqual(journalVisibilityLabel(journal({ visibility: 'PRIVATE', trash: {} })), '비공개 여행기');
});

test('public author counts never include private completion, drafts, plans or removed records', () => {
  const values = [journal(), journal({ visibility: 'PRIVATE', saves: 1000 }), journal({ status: 'PLANNING', saves: 1000 }), journal({ purpose: 'PLAN', saves: 1000 }), journal({ trash: {}, saves: 1000 }), journal({ id: 'public-two', saves: 3 })];
  const before = structuredClone(values);
  assert.equal(publicJournalCopyCount(values), 10);
  assert.deepEqual(values, before);
});

test('finishing privately does not admit the record to Home, Travel or chatbot public entry points', () => {
  const completed = completeJournal(journal({ status: 'PLANNING', visibility: 'PRIVATE' }));
  assert.equal(completed.status, 'PUBLISHED');
  assert.equal(isPublicJournal(completed), false);
  assert.equal(isPublicHomeJournal(completed), false);
  assert.equal(isPublicHomeJournal({ ...completed, isMine: false }), false);
  assert.deepEqual(selectTravelHomeContent([], [completed], [], [], { region: '', query: '' }).journals, []);
  assert.throws(() => resolveChatbotSocialSelection({ type: 'open_spotlog', target: 'community', entry: 'journey-comment' }, [completed], completed.id, 1, ''), /앱에 있는 공개 여행기/);
});
