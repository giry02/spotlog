import test from 'node:test';
import assert from 'node:assert/strict';
import { addAlbumMediaComment, MAX_ALBUM_MEDIA_COMMENT_LENGTH, readAlbumMedia } from '../src/together/albumComments.ts';
import { createEmptyState } from '../src/together/model.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';

const date = '2025-01-20T09:00:00.000Z';
const group = (id, memberIds = ['viewer']) => ({
  id, name: id, kind: 'FAMILY', region: '', introduction: '', cover: '', visibility: 'PRIVATE',
  ownerId: memberIds[0], memberIds, managerIds: [], archived: false, promotionPublished: false,
});
const activity = (id, groupId, status = 'PLANNED') => ({
  id, groupId, title: id, date: '', endDate: '', meetingPoint: '', description: '', leadId: 'viewer',
  status, editorIds: [], participants: {}, arrivedIds: [], revision: 1,
});
const media = (id, groupId, activityId) => ({
  id, groupId, activityId, authorId: 'viewer', url: '/album.jpg', kind: 'PHOTO', caption: '', createdAt: date,
});
const saved = { id: 'historical', authorId: 'former-member', body: '  옛날 댓글\n사진을 다시 보니 좋네요.  ', createdAt: date };

function fixture() {
  const state = createEmptyState('viewer', '정우');
  state.members.push({ id: 'blocked', name: '차단된 회원' }, { id: 'outsider', name: '다른 모임 회원' });
  state.groups.push(
    { ...group('family', ['viewer', 'blocked', 'unknown']), blockedMemberIds: ['blocked'] },
    group('friends', ['outsider']),
    { ...group('appointment'), spaceType: 'ACTIVITY' },
  );
  state.activities.push(activity('first', 'family'), activity('second', 'family'),
    activity('other', 'friends'), activity('standalone', 'appointment'));
  state.media.push(media('group-photo', 'family'), media('first-photo', 'family', 'first'),
    { ...media('second-photo', 'family', 'second'), kind: 'VIDEO', url: '/video.webm' },
    media('group-photo', 'friends', 'other'),
    media('foreign-activity-photo', 'family', 'other'), media('orphan-photo', 'family', 'missing'),
    media('appointment-photo', 'appointment', 'standalone'));
  return state;
}

test('album details require current canonical membership and the exact group or appointment scope', () => {
  const state = fixture();
  for (const id of ['blocked', 'outsider', 'unknown', '']) {
    assert.equal(readAlbumMedia(state, id, 'family', 'group-photo'), null);
  }
  assert.equal(readAlbumMedia(state, 'viewer', 'friends', 'group-photo'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'group-photo').item.groupId, 'family');
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'group-photo', 'first'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'first-photo', 'second'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'first-photo', 'first').canComment, true);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'first-photo').canComment, true);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'second-photo').item.kind, 'VIDEO');
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'foreign-activity-photo', 'other'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'foreign-activity-photo'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'orphan-photo'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'appointment', 'appointment-photo'), null);
  assert.equal(readAlbumMedia(state, 'viewer', 'appointment', 'appointment-photo', 'standalone').canComment, true);
});

test('cancelled activities and archived or closed spaces retain readable history', () => {
  const state = fixture();
  const album = state.media.find(item => item.id === 'first-photo');
  album.comments = [saved];
  state.activities[0].status = 'COMPLETED';
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'first-photo', 'first').canComment, true);
  state.activities[0].status = 'CANCELLED';
  assert.deepEqual(readAlbumMedia(state, 'viewer', 'family', 'first-photo'), { item: album, canComment: false });
  assert.throws(() => addAlbumMediaComment(state, 'viewer', 'family', 'first-photo', '새 댓글'), /읽기만/);
  state.activities[0].status = 'COMPLETED';
  state.groups[0].archived = true;
  assert.equal(readAlbumMedia(state, 'viewer', 'family', 'first-photo', 'first').canComment, false);
  assert.deepEqual(album.comments, [saved]);

  const standalone = state.groups.find(item => item.id === 'appointment');
  standalone.temporaryRoom = { purpose: 'DINNER', expiresAt: date };
  const read = () => readAlbumMedia(state, 'viewer', 'appointment', 'appointment-photo', 'standalone');
  assert.equal(read().canComment, false);
  standalone.temporaryRoom = { purpose: 'DINNER', closedAt: date, closeReason: 'MANUAL', closedBy: 'viewer', disposition: 'ARCHIVE' };
  assert.equal(read().canComment, false);
  standalone.temporaryRoom.disposition = 'TRASH';
  assert.equal(read(), null);
});

test('adding album comments trims new text, checks current permissions and updates only the selected item', () => {
  const state = fixture();
  const before = structuredClone(state);
  assert.throws(() => addAlbumMediaComment(state, 'viewer', 'family', 'first-photo', '다른 일정', 'second'), /다시 선택/);
  assert.throws(() => addAlbumMediaComment(state, 'blocked', 'family', 'first-photo', '권한 없음'), /다시 선택/);
  assert.throws(() => addAlbumMediaComment(state, 'viewer', 'family', 'first-photo', '   \n'), /입력/);
  assert.throws(() => addAlbumMediaComment(state, 'viewer', 'family', 'first-photo', '가'.repeat(MAX_ALBUM_MEDIA_COMMENT_LENGTH + 1)), /1,000자/);
  assert.deepEqual(state, before);

  const photoId = 'first-photo';
  const allBefore = state.media.filter(item => item.id !== photoId);
  const added = addAlbumMediaComment(state, 'viewer', 'family', photoId, '  풍경이 정말 예뻐요.\n또 가고 싶어요.  ', 'first');
  assert.equal(added.body, '풍경이 정말 예뻐요.\n또 가고 싶어요.');
  assert.equal(added.authorId, 'viewer');
  assert.ok(added.id);
  assert.ok(Number.isFinite(Date.parse(added.createdAt)));
  const second = addAlbumMediaComment(state, 'viewer', 'family', photoId, '가'.repeat(MAX_ALBUM_MEDIA_COMMENT_LENGTH));
  assert.notEqual(second.id, added.id);
  assert.deepEqual(readAlbumMedia(state, 'viewer', 'family', photoId).item.comments, [added, second]);
  assert.deepEqual(state.media.filter(item => item.id !== photoId), allBefore);
});

test('storage accepts legacy media and preserves prior comment bodies after saving and reopening', () => {
  const state = fixture();
  const target = state.media.find(item => item.id === 'first-photo');
  target.comments = [saved];
  const storageKey = togetherStorageKey('viewer');
  const data = new Map([[storageKey, JSON.stringify(state)]]);
  const disk = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const makeRepo = () => createTogetherRepository('viewer', '정우', [], disk, null);
  const repo = makeRepo();
  assert.equal(repo.getError(), null);
  assert.equal(repo.getSnapshot().media[0].comments, undefined);
  let added;
  assert.equal(repo.update(draft => {
    added = addAlbumMediaComment(draft, 'viewer', 'family', 'first-photo', '  추가 댓글  ');
  }), true);

  const reopened = makeRepo();
  assert.equal(reopened.getError(), null);
  assert.deepEqual(readAlbumMedia(reopened.getSnapshot(), 'viewer', 'family', 'first-photo', 'first').item.comments, [saved, added]);
  assert.equal(reopened.getSnapshot().media[0].comments, undefined);
});

test('storage rejects malformed optional album comment data', () => {
  const state = fixture();
  assert.equal(isTogetherState(state), true);
  state.media[0].comments = [];
  assert.equal(isTogetherState(state), true);
  for (const comments of [
    null, 'invalid', [null], [saved, saved], [{ ...saved, id: '' }], [{ ...saved, authorId: 1 }],
    [{ ...saved, body: '   ' }], [{ ...saved, body: '가'.repeat(MAX_ALBUM_MEDIA_COMMENT_LENGTH + 1) }],
    [{ ...saved, createdAt: 'invalid date' }],
  ]) {
    state.media[0].comments = comments;
    assert.equal(isTogetherState(state), false);
  }
});
