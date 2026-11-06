import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';
import { OpsError, applyOpsCommand, activeExposures, exposureIssues, invalidatePlaceExposure, journalThread, opsTrashExpiry, placeHasReferences } from '../src/admin/opsDomain.ts';

const now = '2026-10-05T00:00:00.000Z';
const context = { actor: { operatorId: 'operator-admin', name: '관리자', role: 'ADMIN' }, now };
const operator = { actor: { operatorId: 'review-operator', name: '운영자', role: 'OPERATOR' }, now };
const rights = { display: true, store: true, modify: true, ai: true };
const media = { mediaId: 'photo-1', type: 'PHOTO', url: '/admin-review.svg', rights, withdrawn: false };
const content = { name: '검수 장소', kind: 'LANDMARK', area: '가상 지역', operation: 'OPEN', rights, location: { lat: 35, lng: 129, verified: true }, media: [media] };
const makeState = () => ({ schemaVersion: 1, revision: 1, places: [{ placeId: 'place-1', state: 'PUBLISHED', revision: 1, revoked: false, draft: structuredClone(content), published: structuredClone(content) }], ops: makeOpsSeed(), audit: [], ai: {}, nearbyOverrides: [], processedCommands: [] });
const expectCode = (fn, code) => assert.throws(fn, error => error instanceof OpsError && error.code === code);
const exposure = (overrides = {}) => ({ exposureId: 'exposure-1', revision: 1, channel: 'DISCOVERY_PHOTO', targetId: 'place-1', title: '검수 노출', introduction: '검수 소개', coverMediaId: 'photo-1', startsAt: '', endsAt: '', enabled: true, order: 0, ...overrides });

test('seed is isolated synthetic public data without customer itinerary, prompt, booking or credentials', () => {
  const seed = makeOpsSeed(), second = makeOpsSeed(); seed.members[0].name = 'changed';
  assert.notEqual(seed.members[0].name, second.members[0].name);
  for (const key of ['password', 'apiKey', 'booking', 'prompt', 'conversation', 'privateNote', 'dayId']) assert.equal(JSON.stringify(second).includes('"' + key + '"'), false);
  assert.equal(second.members[0].publicActivity.journals, null);
});

test('exposure enforces current published place, verified coordinates, media rights and actual media channel', () => {
  const state = makeState(); applyOpsCommand(state, { kind: 'ops.exposure.save', payload: exposure() }, context);
  assert.equal(activeExposures(state, now).length, 1);
  state.places[0].published.location.verified = false;
  assert.equal(activeExposures(state, now).length, 0);
  state.places[0].published.location.verified = true;
  expectCode(() => applyOpsCommand(state, { kind: 'ops.exposure.save', payload: exposure({ channel: 'DISCOVERY_VIDEO' }), entityRevision: 1 }, context), 'INELIGIBLE');
  state.places[0].published.media[0].withdrawn = true;
  assert.equal(activeExposures(state, now).length, 0);
});

test('expired, future and invalid exposure periods never appear; photo motions require modification rights', () => {
  const state = makeState(); state.ops.exposures = [exposure({ endsAt: now }), exposure({ exposureId: 'future', startsAt: '2027-01-01' })];
  assert.deepEqual(activeExposures(state, now), []);
  expectCode(() => applyOpsCommand(state, { kind: 'ops.exposure.save', payload: exposure({ exposureId: 'bad', startsAt: now, endsAt: '2026-01-01' }) }, context), 'INELIGIBLE');
  state.places[0].published.media[0].type = 'MOTION'; state.places[0].published.media[0].rights.modify = false;
  assert.ok(exposureIssues(state, exposure({ channel: 'DISCOVERY_VIDEO' })).length);
});

test('withdrawal disables an exposure, restores cannot revive it, and references include curated operations content', () => {
  const state = makeState(); state.ops.exposures = [exposure()];
  assert.equal(placeHasReferences(state, 'place-1'), true);
  state.places[0].revoked = true; invalidatePlaceExposure(state, 'place-1'); assert.equal(state.ops.exposures[0].enabled, false);
  state.places[0].revoked = false; assert.deepEqual(activeExposures(state, now), []);
  state.ops.exposures = []; state.ops.curatedTrips[0].placeIds = ['place-1']; assert.equal(placeHasReferences(state, 'place-1'), true);
  assert.equal(placeHasReferences(state, 'unreferenced'), false);
});

test('operating itineraries use only eligible places and cannot publish empty or missing IDs', () => {
  const state = makeState(), current = state.ops.curatedTrips[0];
  expectCode(() => applyOpsCommand(state, { kind: 'ops.curated.save', payload: { ...current, visibility: 'PUBLIC' }, entityRevision: 1 }, context), 'INELIGIBLE');
  applyOpsCommand(state, { kind: 'ops.curated.save', payload: { ...current, visibility: 'PUBLIC', placeIds: ['place-1', 'place-1'] }, entityRevision: 1 }, context);
  assert.deepEqual(state.ops.curatedTrips[0].placeIds, ['place-1']);
  expectCode(() => applyOpsCommand(state, { kind: 'ops.curated.save', payload: { ...state.ops.curatedTrips[0], placeIds: ['missing'] }, entityRevision: 2 }, context), 'INELIGIBLE');
});

test('whole-journal and each journal/card thread stay separate, with replies in original chronological positions', () => {
  const state = makeState();
  assert.deepEqual(journalThread(state, 'review-journal-1').map(c => c.commentId), ['review-comment-1']);
  assert.deepEqual(journalThread(state, 'review-journal-1', 'review-card-1').map(c => c.commentId), ['review-comment-2', 'review-comment-3']);
  assert.deepEqual(journalThread(state, 'review-journal-1', 'review-card-2').map(c => c.commentId), ['review-comment-4']);
  const command = { kind: 'ops.content.moderate', targetType: 'COMMENT', targetId: 'review-comment-2', action: 'HIDE', reason: '신고 검수', entityRevision: 1 };
  applyOpsCommand(state, command, context);
  assert.equal(state.ops.comments.find(c => c.commentId === 'review-comment-4').moderation, 'VISIBLE');
  assert.equal(state.ops.comments.find(c => c.commentId === 'review-comment-2').original, '첫 번째 카드에 남기는 샘플 댓글입니다.');
  expectCode(() => applyOpsCommand(state, command, context), 'CONFLICT');
});

test('unhide never republishes author-private, trashed or deleted content; moderation requires reasons', () => {
  const state = makeState();
  expectCode(() => applyOpsCommand(state, { kind: 'ops.content.moderate', targetType: 'JOURNAL', targetId: 'review-journal-2', action: 'UNHIDE', reason: '검수', entityRevision: 1 }, context), 'INELIGIBLE');
  expectCode(() => applyOpsCommand(state, { kind: 'ops.content.moderate', targetType: 'JOURNAL', targetId: 'review-journal-1', action: 'HIDE', reason: '', entityRevision: 1 }, context), 'INVALID');
  applyOpsCommand(state, { kind: 'ops.content.moderate', targetType: 'COMMENT', targetId: 'review-comment-2', action: 'DELETE', reason: '검수 삭제 조치', entityRevision: 1 }, context);
  expectCode(() => applyOpsCommand(state, { kind: 'ops.content.moderate', targetType: 'COMMENT', targetId: 'review-comment-2', action: 'UNHIDE', reason: '검수', entityRevision: 2 }, context), 'INELIGIBLE');
});

test('last active administrator cannot be demoted, operator cannot alter roles or connection limits', () => {
  const state = makeState();
  const command = { kind: 'ops.operator.role', operatorId: 'operator-admin', role: 'OPERATOR', entityRevision: 1 };
  expectCode(() => applyOpsCommand(state, command, context), 'INELIGIBLE');
  expectCode(() => applyOpsCommand(state, { ...command, operatorId: 'review-operator', role: 'ADMIN' }, operator), 'FORBIDDEN');
  applyOpsCommand(state, { ...command, operatorId: 'review-operator', role: 'ADMIN' }, context);
  applyOpsCommand(state, command, context); assert.equal(state.ops.operators[0].role, 'OPERATOR');
  expectCode(() => applyOpsCommand(state, { kind: 'ops.connection.limit', connectionId: 'review-connection-0', limit: 10 }, operator), 'FORBIDDEN');
});

test('member suspension requires future expiry and a reason, with warning distinct from suspension', () => {
  const state = makeState(), base = { kind: 'ops.member.action', memberId: 'review-member-1', reason: '프로필 신고 확인', entityRevision: 1 };
  expectCode(() => applyOpsCommand(state, { ...base, action: 'SUSPEND', until: now }, context), 'INVALID');
  applyOpsCommand(state, { ...base, action: 'WARN' }, context); assert.equal(state.ops.members[0].state, 'ACTIVE');
  applyOpsCommand(state, { ...base, entityRevision: 2, action: 'SUSPEND', until: '2026-10-06T00:00:00Z' }, context);
  assert.equal(state.ops.members[0].state, 'SUSPENDED');
  applyOpsCommand(state, { ...base, entityRevision: 3, action: 'REINSTATE' }, context); assert.equal(state.ops.members[0].suspendedUntil, undefined);
});

test('inquiry answers are records, never sent; resolving requires a recorded answer and active assignee', () => {
  const state = makeState(), base = { kind: 'ops.inquiry.save', inquiryId: 'review-inquiry-1', assigneeId: 'operator-admin', status: 'RESOLVED', reply: '', entityRevision: 1 };
  expectCode(() => applyOpsCommand(state, base, context), 'INVALID');
  const outcome = applyOpsCommand(state, { ...base, reply: '사진 출처 버튼에서 확인할 수 있습니다.' }, context);
  assert.match(outcome.message, /발송하지/); assert.equal(state.ops.inquiries[0].replyRecords.length, 1);
  assert.equal(state.ops.notifications.length, 3);
});

test('notification retry refuses opted-out, duplicate and disabled-template records; no sent status is fabricated', () => {
  const state = makeState(), retry = notificationId => ({ kind: 'ops.notification.retry', notificationId, entityRevision: 1 });
  expectCode(() => applyOpsCommand(state, retry('review-notification-2'), context), 'INELIGIBLE');
  expectCode(() => applyOpsCommand(state, retry('review-notification-3'), context), 'INELIGIBLE');
  state.ops.templates[0].enabled = false; expectCode(() => applyOpsCommand(state, retry('review-notification-1'), context), 'INELIGIBLE');
  state.ops.templates[0].enabled = true; applyOpsCommand(state, retry('review-notification-1'), context);
  assert.equal(state.ops.notifications[0].status, 'RETRY_REVIEWED'); assert.equal(state.ops.notifications[0].attempts, 1);
});

test('Korea-time six-calendar-month expiry clamps month ends and excludes restoration at exact expiry', () => {
  assert.equal(opsTrashExpiry('2026-08-31T14:05:12.987Z'), '2027-02-28T14:05:12.987Z');
  assert.equal(opsTrashExpiry('2026-09-30T15:00:00.000Z'), '2027-03-31T15:00:00.000Z');
  const state = makeState(), command = { kind: 'ops.trash.restore', trashId: 'review-trash-trip', reason: '사용자 요청 검수', entityRevision: 1 };
  expectCode(() => applyOpsCommand(state, command, operator), 'FORBIDDEN');
  expectCode(() => applyOpsCommand(state, command, { ...context, now: opsTrashExpiry(state.ops.trash[0].deletedAt) }), 'INELIGIBLE');
  applyOpsCommand(state, command, context); assert.equal(state.ops.trash[0].status, 'RESTORED_PRIVATE'); assert.equal(state.ops.trash[1].status, 'TRASHED');
  assert.equal(state.ops.mediaCleanup[0].references.length, 2);
});

test('shared file references block cleanup; only unreferenced review records are marked, files never deleted', () => {
  const state = makeState();
  expectCode(() => applyOpsCommand(state, { kind: 'ops.cleanup.review', mediaId: 'review-shared-media', reason: '정리 검수', entityRevision: 1 }, context), 'INELIGIBLE');
  const outcome = applyOpsCommand(state, { kind: 'ops.cleanup.review', mediaId: 'review-orphan-media', reason: '참조 확인 완료', entityRevision: 1 }, context);
  assert.equal(state.ops.mediaCleanup[1].status, 'REVIEWED'); assert.equal(outcome.message, '참조 없는 파일을 정리 대상으로 지정했습니다.');
  assert.equal(state.ops.mediaCleanup[0].status, 'WAITING');
});

test('private journal restoration redacts the administrator projection and its comments, while independent records and shared media remain', () => {
  const state = makeState(), restored = state.ops.trash.find(t => t.trashId === 'review-trash-journal');
  restored.publicJournalId = 'review-journal-1';
  state.ops.exposures = [exposure({ channel: 'HOME_JOURNAL', targetId: 'review-journal-1', coverMediaId: '' })];
  const independent = structuredClone(state.ops.journals[1]), mediaBefore = structuredClone(state.ops.mediaCleanup);
  applyOpsCommand(state, { kind: 'ops.trash.restore', trashId: restored.trashId, reason: '요청한 여행기 복원 검수', entityRevision: 1 }, context);
  const journal = state.ops.journals[0];
  assert.equal(journal.ownerVisibility, 'PRIVATE'); assert.equal(journal.original, ''); assert.equal(journal.english, ''); assert.deepEqual(journal.cards, []);
  assert.equal(journal.journalId, 'review-journal-1');
  assert.ok(state.ops.comments.filter(c => c.journalId === journal.journalId).every(c => c.original === '' && c.english === '' && !!c.commentId));
  assert.deepEqual(state.ops.journals[1], independent); assert.deepEqual(state.ops.mediaCleanup, mediaBefore);
  assert.equal(state.ops.trash[0].status, 'TRASHED'); assert.equal(state.ops.exposures[0].enabled, false);
});

test('translation review uses matching original revision and preserves original content', () => {
  const state = makeState(), journal = state.ops.journals[0], original = journal.original;
  const command = { kind: 'ops.translation.review', journalId: journal.journalId, english: 'Reviewed English sample.', note: '검수 완료', status: 'APPROVED', sourceRevision: 2, entityRevision: 1 };
  expectCode(() => applyOpsCommand(state, command, context), 'CONFLICT');
  applyOpsCommand(state, { ...command, sourceRevision: 1 }, context); assert.equal(journal.original, original); assert.equal(journal.translation.status, 'APPROVED');
});
