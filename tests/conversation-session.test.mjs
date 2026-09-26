import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/(conversation-session|connected-engine)\.ts$/.test(
        context.parentURL ?? '',
      ) &&
      specifier.startsWith('./')
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});
const {
  createConversation,
  latestState,
  appendConversation,
  resumeConversation,
  undoConversation,
} = await import('../lib/conversation-session.ts');
const { workspace } = await import('../lib/connected-engine.ts');
const append = (s, message) =>
  appendConversation(s, { type: 'message', message });

test('place dialogue appends four independently preserved responses', () => {
  let s = createConversation('places');
  const first = JSON.stringify(workspace(latestState(s)));
  Object.freeze(s.turns[0].state.compareIds);
  Object.freeze(s.turns[0].state);
  s = append(s, '두 번째 장소 근처 맛집은?');
  const nearby = JSON.stringify(workspace(latestState(s)));
  s = append(s, '도보 5분 안에서만');
  s = append(s, '첫 번째로 갈래');
  assert.equal(s.turns.length, 4);
  assert.equal(JSON.stringify(workspace(s.turns[0].state)), first);
  assert.equal(JSON.stringify(workspace(s.turns[1].state)), nearby);
  assert.equal(s.turns[1].state.walkMinutes, 15);
  assert.equal(s.turns[2].state.walkMinutes, 5);
  assert.equal(s.turns[2].state.selectedRestaurantId, null);
  assert.equal(s.turns[3].state.selectedRestaurantId, 'sb-rice');
  assert.deepEqual(workspace(s.turns[1].state).resources.restaurantIds, [
    'sb-rice',
    'sb-pasta',
    'sb-cafe',
  ]);
  assert.deepEqual(workspace(s.turns[2].state).resources.restaurantIds, [
    'sb-rice',
  ]);
});

test('resume restores that exact result without deleting intervening dialogue', () => {
  let s = append(createConversation('places'), '두 번째 장소 근처 맛집은?');
  const original = JSON.stringify(s.turns);
  s = append(s, '도보 1분 안에서만');
  assert.equal(workspace(latestState(s)).resources.restaurantIds.length, 0);
  s = resumeConversation(s, 2);
  assert.equal(s.turns.length, 4);
  assert.equal(s.turns[3].restoredFrom, 2);
  assert.equal(JSON.stringify(s.turns.slice(0, 2)), original);
  assert.equal(latestState(s).walkMinutes, 15);
  assert.equal(latestState(s).selectedPlaceId, 'saebyeol');
  s = appendConversation(s, { type: 'select-restaurant', id: 'sb-pasta' });
  assert.equal(latestState(s).selectedRestaurantId, 'sb-pasta');
  assert.equal(s.turns[3].state.selectedRestaurantId, null);
});

test('monitor reference and comparison snapshots remain intact across new priorities and anchors', () => {
  let s = createConversation('monitors');
  s = append(s, '게임도 하고 눈이 편했으면 좋겠어');
  s = append(s, '30만원 이하로 보여줘');
  s = appendConversation(s, { type: 'use-anchor', id: 'play27' });
  assert.equal(s.turns[0].state.gaming, false);
  assert.equal(s.turns[0].state.maxPrice, 450000);
  assert.equal(s.turns[1].state.gaming, true);
  assert.equal(s.turns[1].state.maxPrice, 450000);
  assert.equal(s.turns[2].state.anchorId, 'view27');
  assert.equal(s.turns[2].state.maxPrice, 300000);
  assert.equal(latestState(s).anchorId, 'play27');
  assert.match(latestState(s).question, /Play 27/);
  assert.deepEqual(s.turns[2].state.compareIds, ['play27']);
  assert.deepEqual(latestState(s).compareIds, []);
});

test('undo restores prior response and never reuses a conversation identifier', () => {
  let s = append(createConversation('places'), '두 번째 장소 근처 맛집은?');
  s = append(s, '도보 5분 안에서만');
  const removedId = s.turns.at(-1).id;
  s = undoConversation(s);
  assert.equal(s.turns.length, 2);
  assert.equal(latestState(s).walkMinutes, 15);
  s = append(s, '도보 10분 안에서만');
  assert.ok(s.turns.at(-1).id > removedId);
  assert.equal(new Set(s.turns.map((t) => t.id)).size, s.turns.length);
});

test('control actions produce matching user utterances in the transcript', () => {
  let s = appendConversation(createConversation('places'), {
    type: 'map',
    value: false,
  });
  assert.equal(latestState(s).question, '지도는 접어줘');
  let m = appendConversation(createConversation('monitors'), {
    type: 'compare',
    id: 'play27',
  });
  assert.match(latestState(m).question, /비교를 해제/);
  m = appendConversation(m, { type: 'compare', id: 'play27' });
  assert.match(latestState(m).question, /비교해줘/);
});

test('separate tabs and long conversations retain their own original history', () => {
  let places = createConversation('places'),
    monitors = createConversation('monitors');
  for (let i = 0; i < 35; i++)
    places = appendConversation(places, {
      type: 'walk',
      minutes: 1 + (i % 20),
    });
  assert.equal(places.turns.length, 36);
  assert.equal(places.turns[0].state.walkMinutes, 15);
  assert.equal(monitors.turns.length, 1);
  assert.equal(latestState(monitors).domain, 'monitors');
});
