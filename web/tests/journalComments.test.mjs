import test from 'node:test';
import assert from 'node:assert/strict';
import { getJourneyCommentGroups, projectJournalComment } from '../src/journalComments.ts';

const journalId = 'beach-trip';
const local = (id, createdAt, parentId, journeyId = journalId) => ({
  id, journeyId, parentId, author: '여행자', authorId: 'actual-id', body: '여행기 댓글', createdAt, authorCopies: 3,
});
const imported = (id, parentId, extra = {}) => ({
  ...projectJournalComment(local(id, '2026-11-23T08:00:00.000Z', parentId)), ...extra,
});

test('whole-journal threads keep roots newest first and replies chronological within the parent', () => {
  const legacy = local('comment-1795420800000', '11월 23일');
  const newest = local('new', '2026-11-23T08:40:00.000Z');
  const first = local('earlier', '2026-11-23T08:05:00.000Z', legacy.id);
  const last = local('later', '2026-11-23T08:10:00.000Z', legacy.id);
  const saved = JSON.parse(JSON.stringify([legacy, newest, last, first]));
  const groups = getJourneyCommentGroups(journalId, saved, [], []);
  assert.deepEqual(groups.map(({ root, replies }) => [root.id, replies.map(item => item.id)]), [
    [newest.id, []], [legacy.id, [first.id, last.id]],
  ]);
  assert.deepEqual(saved.map(item => item.id), [legacy.id, newest.id, last.id, first.id]);
});

test('hidden children, hidden or missing roots, and comments from other journal/card scopes are excluded', () => {
  const root = local('root', '11월 21일');
  const localShadow = local('hidden-parent', '11월 22일');
  const sameJournal = local('local-reply', '11월 23일', root.id);
  const inputs = [root, localShadow, sameJournal, local('orphan', '11월 23일', 'missing'), local('misplaced', '11월 23일', root.id, 'other'), local('nested', '11월 23일', sameJournal.id)];
  const projections = [imported('public-visible', root.id), imported('hidden-parent', undefined, { moderation: 'HIDDEN' }), imported('under-hidden', localShadow.id), imported('card-reply', root.id, { cardId: 'card-1' })];
  assert.deepEqual(
    getJourneyCommentGroups(journalId, inputs, projections, [{ id: sameJournal.id, state: 'DELETED' }]).map(g => [g.root.id, g.replies.map(c => c.id)]),
    [[root.id, ['public-visible']]],
  );
});

test('public report projection keeps the author, canonical parent, and stored timestamp', () => {
  const item = local('reply', '2026-11-23T08:00:00.100Z', 'parent');
  const report = projectJournalComment(item);
  assert.deepEqual([report.commentId, report.parentId, report.authorId, report.createdAt], [item.id, item.parentId, item.authorId, item.createdAt]);
});
