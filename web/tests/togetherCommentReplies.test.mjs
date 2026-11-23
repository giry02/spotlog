import test from 'node:test';
import assert from 'node:assert/strict';
import { addAlbumMediaComment } from '../src/together/albumComments.ts';
import { getTogetherCommentGroups } from '../src/together/commentThreads.ts';
import { createEmptyState } from '../src/together/model.ts';
import { addTogetherPostComment } from '../src/together/postComments.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';

const date = '2025-01-20T09:00:00.000Z';
const comment = (id, at = date) => ({ id, authorId: 'former-member', body: '\n 이전에 쓴 댓글 ', createdAt: at });
const group = (id, memberIds) => ({
  id, name: id, kind: 'FAMILY', region: '', introduction: '', cover: '', visibility: 'PRIVATE',
  ownerId: memberIds[0], memberIds, managerIds: [], archived: false, promotionPublished: false,
});
const activity = (id, groupId) => ({
  id, groupId, title: id, date: '', endDate: '', meetingPoint: '', description: '', leadId: 'viewer',
  status: 'COMPLETED', editorIds: [], participants: {}, arrivedIds: [], revision: 1,
});
const post = (id, groupId, activityId) => ({
  id, groupId, activityId, authorId: 'viewer', title: id, body: '후기', category: 'REVIEW',
  createdAt: date, comments: [comment(id + '-root')], likes: [],
});
const media = (id, groupId, activityId) => ({
  id, groupId, activityId, authorId: 'viewer', url: '/album.jpg', kind: 'PHOTO',
  caption: '', createdAt: date, comments: [comment(id + '-root')],
});

function fixture() {
  const state = createEmptyState('viewer', '작성자');
  state.members.push({ id: 'blocked', name: '차단된 회원' }, { id: 'outsider', name: '다른 모임 회원' });
  state.groups.push({ ...group('family', ['viewer', 'blocked']), blockedMemberIds: ['blocked'] },
    group('other-group', ['outsider']), { ...group('standalone', ['viewer']), spaceType: 'ACTIVITY' });
  state.activities.push(activity('first', 'family'), activity('second', 'family'),
    activity('outside', 'other-group'), activity('standalone-activity', 'standalone'));
  state.posts.push(post('story', 'family', 'first'), post('other-story', 'family', 'second'),
    post('room-story', 'family'), post('foreign', 'other-group', 'outside'),
    post('wrong-activity', 'family', 'outside'), post('one-story', 'standalone', 'standalone-activity'));
  state.media.push(media('photo', 'family', 'first'), media('other-photo', 'family', 'second'));
  return state;
}

test('post and album replies bind to a root in the same record and membership is checked on every write', () => {
  const state = fixture();
  const initial = structuredClone(state);
  const addPost = (parentId, activityId = 'first') => addTogetherPostComment(state, 'viewer', 'family', 'story', '  새 답글\n내용  ', parentId, activityId);
  const addPhoto = (parentId, activityId = 'first') => addAlbumMediaComment(state, 'viewer', 'family', 'photo', '  새 답글\n내용  ', activityId, parentId);
  for (const add of [addPost, addPhoto]) {
    assert.throws(() => add('other-story-root'), /다시 선택/);
    assert.throws(() => add('other-photo-root'), /다시 선택/);
    assert.throws(() => add(''), /다시 선택/);
    assert.throws(() => add(undefined, 'second'), /다시 선택/);
  }
  assert.throws(() => addTogetherPostComment(state, 'blocked', 'family', 'story', '댓글'), /다시 선택/);
  assert.throws(() => addTogetherPostComment(state, 'viewer', 'family', 'wrong-activity', '댓글'), /다시 선택/);
  assert.throws(() => addTogetherPostComment(state, 'viewer', 'standalone', 'one-story', '댓글'), /다시 선택/);
  assert.deepEqual(state, initial);

  const postReply = addPost('story-root');
  const photoReply = addPhoto('photo-root');
  assert.equal(postReply.parentId, 'story-root');
  assert.equal(photoReply.parentId, 'photo-root');
  assert.equal(postReply.body, '새 답글\n내용');
  assert.equal(photoReply.authorId, 'viewer');
  assert.throws(() => addPost(postReply.id), /다시 선택/);
  assert.throws(() => addPhoto(photoReply.id), /다시 선택/);
  assert.equal(addTogetherPostComment(state, 'viewer', 'family', 'story', '모임 게시판에서 작성').parentId, undefined);
  assert.equal(addTogetherPostComment(state, 'viewer', 'standalone', 'one-story', '약속 화면에서 작성', undefined, 'standalone-activity').authorId, 'viewer');

  state.groups[0].archived = true;
  assert.throws(() => addPost('story-root'), /읽기만/);
  assert.throws(() => addPhoto('photo-root'), /읽기만/);
  assert.equal(state.posts[0].comments.length, 3);
  assert.equal(state.media[0].comments.length, 2);
});

test('old roots are preserved and scoped post and album replies survive reopening storage', () => {
  const state = fixture();
  const historicalRoot = { ...comment('legacy-post'), createdAt: 'historical date label' };
  state.posts[0].comments = [historicalRoot];
  const key = togetherStorageKey('viewer');
  const values = new Map([[key, JSON.stringify(state)]]);
  const disk = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const open = () => createTogetherRepository('viewer', '작성자', [], disk, null);
  const repo = open();
  assert.equal(repo.getError(), null);
  const saved = repo.update(draft => {
    addTogetherPostComment(draft, 'viewer', 'family', 'story', '후기 답글', 'legacy-post', 'first');
    addAlbumMediaComment(draft, 'viewer', 'family', 'photo', '앨범 답글', 'first', 'photo-root');
  });
  assert.equal(saved, true);

  const reloaded = open();
  assert.equal(reloaded.getError(), null);
  const result = reloaded.getSnapshot();
  assert.deepEqual(result.posts[0].comments[0], historicalRoot);
  assert.equal(result.posts[0].comments[1].parentId, 'legacy-post');
  assert.equal(result.media[0].comments[1].parentId, 'photo-root');
});

test('storage rejects dangling, foreign, malformed, ambiguous and nested reply references', () => {
  for (const kind of ['posts', 'media']) {
    for (const parentId of ['missing', '', null, 3]) {
      const state = fixture();
      state[kind][0].comments.push({ ...comment('reply'), parentId });
      assert.equal(isTogetherState(state), false);
    }
    const state = fixture();
    const comments = state[kind][0].comments;
    const [root] = comments;
    comments.push({ ...comment('child'), parentId: root.id });
    assert.equal(isTogetherState(state), true);
    comments.push({ ...comment('nested'), parentId: 'child' });
    assert.equal(isTogetherState(state), false);
    comments.pop();
    comments.push({ ...root });
    assert.equal(isTogetherState(state), false);
  }
});

test('comment groups use newest roots first and chronological replies with stable source order on ties', () => {
  const items = [
    comment('first', '2025-01-20T08:00:00.000Z'), comment('second'),
    { ...comment('reply-late', '2025-01-20T10:00:00.000Z'), parentId: 'second' },
    { ...comment('reply-first'), parentId: 'second' },
    { ...comment('reply-next'), parentId: 'second' },
    comment('third'),
  ];
  const groups = getTogetherCommentGroups(items);
  assert.deepEqual(groups.map(({ root, replies }) => [root.id, replies.map(item => item.id)]), [
    ['second', ['reply-first', 'reply-next', 'reply-late']], ['third', []], ['first', []],
  ]);
  assert.equal(items[0].id, 'first');
});
