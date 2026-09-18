import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeAxis, swipeStep, wrapPlace, realSlot } from '../src/photoFeedNavigation.ts';

test('tap jitter and ambiguous diagonals do not choose an axis', () => {
  assert.equal(swipeAxis(4, 3), null);
  assert.equal(swipeAxis(30, 29), null);
  assert.equal(swipeAxis(-90, 18), 'x');
  assert.equal(swipeAxis(16, -95), 'y');
});

test('intentional drag and quick flick advance once; small slow motion snaps back', () => {
  assert.equal(swipeStep(-150, 390, 400), 1);
  assert.equal(swipeStep(200, 844, 600), -1);
  assert.equal(swipeStep(-25, 844, 30), 1);
  assert.equal(swipeStep(-25, 844, 500), 0);
  assert.equal(swipeStep(0, 390, 1), 0);
});

test('place navigation wraps forward and backward for each selected region', () => {
  for (const count of [2, 4, 6, 15]) {
    assert.equal(wrapPlace(count, count), 0);
    assert.equal(wrapPlace(-1, count), count - 1);
    assert.equal(realSlot(0, count), count);
    assert.equal(realSlot(count + 1, count), 1);
    for (let slot = 1; slot <= count; slot++) assert.equal(realSlot(slot, count), slot);
  }
});

test('one or no place never produces a ghost destination', () => {
  for (const count of [0, 1]) {
    assert.equal(wrapPlace(-1, count), 0);
    assert.equal(wrapPlace(1, count), 0);
    assert.equal(realSlot(0, count), 0);
    assert.equal(realSlot(2, count), 0);
  }
});
