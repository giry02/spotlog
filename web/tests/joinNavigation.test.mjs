import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateAfterPublicJoin } from '../src/together/joinNavigation.ts';

function browser(state = { spotlog: true, spotlogSheet: 'join-confirmation' }) {
  const listeners = new Set(), timers = new Map();
  let timerId = 0;
  return {
    history: { state },
    addEventListener(type, callback) { assert.equal(type, 'popstate'); listeners.add(callback); },
    removeEventListener(type, callback) { assert.equal(type, 'popstate'); listeners.delete(callback); },
    setTimeout(callback, duration) { const id = ++timerId; timers.set(id, { callback, duration }); return id; },
    clearTimeout(id) { timers.delete(id); },
    pop(next) { this.history.state = next; for (const callback of [...listeners]) callback({ state: next }); },
    cancelTimers() { for (const { callback } of [...timers.values()]) callback(); },
    listenerCount: () => listeners.size,
    timerCount: () => timers.size,
  };
}

test('ordinary direct join stays on the group without pushing an identical history entry', () => {
  const host = browser(), destinations = [];
  navigateAfterPublicJoin(host, 'group-food', 'group-food', () => destinations.push('group-food'));
  assert.deepEqual(destinations, []); assert.equal(host.listenerCount(), 0); assert.equal(host.timerCount(), 0);
});

test('exact selected public appointment is entered once only after the confirmation sheet history is removed', () => {
  const host = browser(), destinations = [];
  navigateAfterPublicJoin(host, 'group-food', 'activity-second', () => destinations.push({ route: 'activity-second', state: host.history.state }));
  assert.deepEqual(destinations, []);
  host.pop({ spotlog: true, spotlogSheet: 'nested-detail' });
  assert.deepEqual(destinations, []);
  const groupState = { spotlog: true, togetherRoute: 'group-food', depth: 1 };
  host.pop(groupState);
  assert.deepEqual(destinations, [{ route: 'activity-second', state: groupState }]);
  assert.equal(host.listenerCount(), 0); assert.equal(host.timerCount(), 0);
  host.pop({ spotlog: true, togetherRoute: 'together-find', depth: 0 });
  assert.equal(destinations.length, 1);
});

test('with no installed sheet entry the selected appointment can open immediately', () => {
  const host = browser({ spotlog: true, togetherRoute: 'group-food' }), destinations = [];
  navigateAfterPublicJoin(host, 'group-food', 'activity-second', () => destinations.push('activity-second'));
  assert.deepEqual(destinations, ['activity-second']); assert.equal(host.listenerCount(), 0); assert.equal(host.timerCount(), 0);
});

test('account or route cleanup cancels a pending navigation and removes its browser listener', () => {
  const host = browser(), destinations = [];
  const cancel = navigateAfterPublicJoin(host, 'group-food', 'activity-second', () => destinations.push('activity-second'));
  cancel(); cancel();
  host.pop({ spotlog: true, togetherRoute: 'another-account' });
  assert.deepEqual(destinations, []); assert.equal(host.listenerCount(), 0); assert.equal(host.timerCount(), 0);
});

test('a missing close event is bounded by cancellation and never causes timer-based navigation', () => {
  const host = browser(), destinations = [];
  navigateAfterPublicJoin(host, 'group-food', 'activity-second', () => destinations.push('activity-second'));
  host.cancelTimers();
  assert.deepEqual(destinations, []); assert.equal(host.listenerCount(), 0); assert.equal(host.timerCount(), 0);
  host.pop({ spotlog: true, togetherRoute: 'group-food' });
  assert.deepEqual(destinations, []);
});

test('backing to discovery while a confirmation is settling cancels the selected appointment instead of navigating forward again', () => {
  const host = browser(), destinations = [];
  navigateAfterPublicJoin(host, 'group-food', 'activity-second', () => destinations.push('activity-second'));
  host.pop({ spotlog: true, togetherRoute: 'together-find', depth: 0 });
  assert.deepEqual(destinations, []); assert.equal(host.listenerCount(), 0); assert.equal(host.timerCount(), 0);
});
