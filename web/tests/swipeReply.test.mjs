import test from 'node:test';
import assert from 'node:assert/strict';
import { beginMessageHoldGesture, beginSwipeReplyGesture, canStartSwipeReplyOnTargetPath, finishSwipeReplyGesture, fireMessageHoldGesture, MESSAGE_HOLD_DELAY_MS, MESSAGE_HOLD_MOVE_SLOP, moveMessageHoldGesture, moveSwipeReplyGesture, SWIPE_REPLY_MAX_OFFSET, SWIPE_REPLY_THRESHOLD } from '../src/together/swipeReplyGesture.ts';

const start = changes => beginSwipeReplyGesture({ pointerId: 7, x: 100, y: 200, enabled: true, targetAllowed: true, pointerType: 'touch', isPrimary: true, button: 0, ...changes });
const move = (gesture, dx, dy = 0, enabled = true, pointerId = 7) => moveSwipeReplyGesture(gesture, { pointerId, x: 100 + dx, y: 200 + dy }, enabled);
const done = (gesture, enabled = true, pointerId = 7) => finishSwipeReplyGesture(gesture, pointerId, enabled);
const plain = { tagName: 'SPAN' }, surface = { tagName: 'BUTTON', surface: true };

test('only a current enabled primary touch or pen can start; mouse text selection remains untouched', () => {
  assert.equal(start().phase, 'PENDING'); assert.equal(start({ pointerType: 'pen' }).phase, 'PENDING');
  for (const changes of [{ pointerType: 'mouse' }, { pointerType: '' }, { enabled: false }, { targetAllowed: false }, { isPrimary: false }, { button: 2 }, { x: NaN }, { y: Infinity }, { pointerId: -1 }]) assert.equal(start(changes), null, JSON.stringify(changes));
});

test('taps and tiny movement neither trigger a reply nor suppress the existing button click', () => {
  const gesture = move(start(), 4, 3), result = done(gesture);
  assert.equal(gesture.phase, 'PENDING'); assert.equal(gesture.offset, 0);
  assert.deepEqual(result, { gesture: null, reply: false, suppressClick: false });
});

test('a short horizontal drag does not reply, and a threshold release replies once before state is cleared', () => {
  assert.equal(done(move(start(), SWIPE_REPLY_THRESHOLD - 1)).reply, false);
  const threshold = move(start(), SWIPE_REPLY_THRESHOLD), result = done(threshold);
  assert.equal(threshold.crossed, true); assert.equal(result.reply, true); assert.equal(result.suppressClick, true); assert.equal(result.gesture, null);
  assert.equal(done(result.gesture).reply, false);
});

test('large right drags remain locally bounded and returning under the threshold cancels reply without opening message tools', () => {
  const far = move(start(), 5000);
  assert.equal(far.offset, SWIPE_REPLY_MAX_OFFSET);
  const returned = move(far, 10), result = done(returned);
  assert.equal(returned.crossed, true); assert.equal(result.reply, false); assert.equal(result.suppressClick, true);
});

test('left swipes are blocked for the entire pointer gesture even when it later reverses right', () => {
  const left = move(start(), -20), reversed = move(left, 100);
  assert.equal(left.phase, 'BLOCKED'); assert.equal(reversed.offset, 0); assert.equal(done(reversed).reply, false);
});

test('vertical and ambiguous diagonal gestures never acquire a horizontal drag or interfere with scrolling', () => {
  const undecided = move(start(), 8, 7);
  assert.equal(undecided.phase, 'PENDING'); assert.equal(undecided.offset, 0);
  for (const [dx, dy] of [[0, 12], [10, 20], [12, 12], [6, -30]]) {
    const gesture = move(start(), dx, dy);
    assert.equal(gesture.phase, 'BLOCKED'); assert.equal(gesture.offset, 0); assert.equal(gesture.dragged, false); assert.equal(done(gesture).reply, false);
  }
});

test('vertical movement after horizontal intent cancels a pending reply and cannot recover within that pointer', () => {
  const right = move(start(), 60, 2), vertical = move(right, 62, 70), reversed = move(vertical, 100, 0);
  assert.equal(vertical.phase, 'BLOCKED'); assert.equal(vertical.offset, 0);
  assert.equal(done(reversed).reply, false); assert.equal(done(reversed).suppressClick, true);
});

test('cancellation, revoked permission and a fresh gesture do not retain the old threshold', () => {
  const ready = move(start(), 60);
  assert.equal(move(ready, 70, 0, false), null); assert.equal(done(ready, false).reply, false);
  assert.equal(done(null).reply, false); assert.equal(start().crossed, false); assert.equal(start().offset, 0);
});

test('another pointer cannot move or complete the active gesture and malformed movement fails closed', () => {
  const gesture = start();
  assert.equal(move(gesture, 80, 0, true, 8), gesture);
  assert.deepEqual(done(gesture, true, 8), { gesture, reply: false, suppressClick: false });
  const invalid = moveSwipeReplyGesture(gesture, { pointerId: 7, x: NaN, y: 200 });
  assert.equal(invalid.phase, 'BLOCKED'); assert.equal(done(invalid).reply, false);
});

test('ordinary interactive targets, photos, editable regions and opt-out ancestors are never gesture surfaces', () => {
  for (const tagName of ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL', 'SUMMARY', 'VIDEO', 'AUDIO', 'IMG', 'PICTURE', 'SVG', 'BLOCKQUOTE']) assert.equal(canStartSwipeReplyOnTargetPath([{ tagName }, { tagName: 'DIV' }]), false, tagName);
  for (const target of [{ ...plain, role: 'button' }, { ...plain, role: 'link' }, { ...plain, focusable: true }, { ...plain, editable: true }, { ...plain, ignore: true }]) assert.equal(canStartSwipeReplyOnTargetPath([target]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([plain, { tagName: 'DIV', ignore: true }]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([plain, { tagName: 'DIV' }]), true);
});

test('only the exact opted-in message button and its plain descendants bypass button exclusion', () => {
  assert.equal(canStartSwipeReplyOnTargetPath([surface]), true);
  assert.equal(canStartSwipeReplyOnTargetPath([plain, { tagName: 'STRONG' }, { ...surface, role: 'button', focusable: true }]), true);
  for (const target of [{ tagName: 'A', surface: true }, { tagName: 'INPUT', surface: true }, { tagName: 'BUTTON' }, { ...plain, role: 'link' }, { ...plain, editable: true }, { ...plain, ignore: true }, { tagName: 'IMG' }]) assert.equal(canStartSwipeReplyOnTargetPath([target, surface]), false, JSON.stringify(target));
  assert.equal(canStartSwipeReplyOnTargetPath([{ ...surface, role: 'link' }]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([surface, { tagName: 'A' }]), false);
});

test('a sticker image requires its own explicit mark inside an opted message surface; arbitrary photos remain excluded', () => {
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'IMG', sticker: true }, surface]), true);
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'IMG', sticker: true }, { tagName: 'DIV' }]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'IMG' }, surface]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'IMG', sticker: true }, { tagName: 'A' }, surface]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'IMG', sticker: true }, { tagName: 'DIV', surface: true }]), true);
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'BUTTON', ignore: true }, { tagName: 'DIV', surface: true }]), false);
  assert.equal(canStartSwipeReplyOnTargetPath([{ tagName: 'A' }, { tagName: 'DIV', surface: true }]), false);
});

const holdInput = changes => ({ pointerId: 7, x: 100, y: 200, enabled: true, targetAllowed: true, pointerType: 'touch', isPrimary: true, button: 0, ...changes });
const startHold = (changes, at = 1000) => beginMessageHoldGesture(holdInput(changes), at);
const moveHold = (hold, dx, dy = 0, enabled = true, pointerId = 7) => moveMessageHoldGesture(hold, { pointerId, x: 100 + dx, y: 200 + dy }, enabled);

test('stationary touch and pen holds open at 450ms, never on early taps or an early timer', () => {
  for (const pointerType of ['touch', 'pen']) {
    const hold = startHold({ pointerType });
    assert.equal(fireMessageHoldGesture(hold, 1000 + MESSAGE_HOLD_DELAY_MS - 1).open, false);
    assert.equal(fireMessageHoldGesture(hold, 1000 + MESSAGE_HOLD_DELAY_MS).open, true);
  }
  assert.equal(fireMessageHoldGesture(null, 5000).open, false, 'released or cancelled hold');
});

test('hold preserves normal mouse selection and rejects unsafe, secondary or malformed starts', () => {
  for (const changes of [{ pointerType: 'mouse' }, { pointerType: '' }, { enabled: false }, { targetAllowed: false }, { isPrimary: false }, { button: 2 }, { x: NaN }, { y: Infinity }, { pointerId: -1 }]) assert.equal(startHold(changes), null);
  assert.equal(startHold({}, NaN), null); assert.equal(startHold({}, Infinity), null);
});

test('small stationary jitter is allowed but moving outside the 8px circle permanently cancels a hold', () => {
  const jitter = moveHold(startHold(), 3, 4);
  assert.equal(jitter.phase, 'WAITING'); assert.equal(fireMessageHoldGesture(jitter, 1450).open, true);
  const boundary = moveHold(startHold(), MESSAGE_HOLD_MOVE_SLOP);
  assert.equal(boundary.phase, 'WAITING');
  for (const [dx, dy] of [[9, 0], [-9, 0], [0, 9], [0, -9], [6, 6]]) {
    const moved = moveHold(startHold(), dx, dy), returned = moveHold(moved, 0, 0);
    assert.equal(moved.phase, 'CANCELLED'); assert.equal(returned.phase, 'CANCELLED');
    assert.equal(fireMessageHoldGesture(returned, 9000).open, false);
  }
});

test('a stationary hold fires only once even if its timer callback is delivered again much later', () => {
  const first = fireMessageHoldGesture(startHold(), 1450);
  assert.equal(first.hold.phase, 'FIRED'); assert.equal(first.open, true);
  assert.equal(fireMessageHoldGesture(first.hold, 1600).open, false);
  assert.equal(fireMessageHoldGesture(first.hold, 100000).open, false);
  assert.equal(moveHold(first.hold, 60).phase, 'FIRED');
});

test('permission or scope cancellation cannot revive an old pending hold after authority returns', () => {
  const pending = startHold();
  const cancelled = fireMessageHoldGesture(pending, 1450, false);
  assert.deepEqual(cancelled, { hold: null, open: false });
  assert.equal(fireMessageHoldGesture(cancelled.hold, 5000, true).open, false);
  assert.equal(moveHold(pending, 0, 0, false), null);
  assert.equal(fireMessageHoldGesture(null, 5000, true).open, false, 'scroll, blur, pointer-up or unmount clears the hold');
  assert.equal(fireMessageHoldGesture(startHold({}, 5000), 5001).open, false, 'a new scope requires a new full hold');
});

test('another pointer cannot advance a hold and malformed movement fails closed', () => {
  const pending = startHold();
  assert.equal(moveHold(pending, 100, 100, true, 8), pending);
  const invalid = moveMessageHoldGesture(pending, { pointerId: 7, x: NaN, y: 200 });
  assert.equal(invalid.phase, 'CANCELLED'); assert.equal(fireMessageHoldGesture(invalid, 5000).open, false);
});

test('invalid or backwards timer time never opens message actions', () => {
  const hold = startHold();
  for (const at of [NaN, Infinity, -Infinity, 999, 1000, 1449]) assert.equal(fireMessageHoldGesture(hold, at).open, false);
});

test('hold decisions leave their caller-owned snapshot unchanged', () => {
  const hold = Object.freeze(startHold()), before = JSON.stringify(hold);
  moveHold(hold, 20); fireMessageHoldGesture(hold, 1450); fireMessageHoldGesture(hold, 1450, false);
  assert.equal(JSON.stringify(hold), before);
});

test('gesture and target decisions do not mutate caller-owned state or path descriptors', () => {
  const gesture = Object.freeze(start()), path = Object.freeze([Object.freeze(plain), Object.freeze(surface)]);
  const before = JSON.stringify({ gesture, path });
  move(gesture, 80); done(gesture); canStartSwipeReplyOnTargetPath(path);
  assert.equal(JSON.stringify({ gesture, path }), before);
});
