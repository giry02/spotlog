import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') &&
      specifier.startsWith('./') &&
      !/\.[a-z]+$/.test(specifier)
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const { initialTrip, makePlan, createTripSession, currentTrip, isTripSession } =
  await import('../lib/trip-engine.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');
const {
  visibleChatCandidates,
  comparisonRows,
  budgetSummary,
  itineraryChecks,
} = await import('../lib/trip-chat-features.ts');

test('collected candidate order and kinds survive browsing another anchor', () => {
  const state = {
    ...initialTrip(),
    stage: 'collection',
    region: '제주',
    anchorId: 'saebyeol',
    collectedIds: ['hyeopjae', 'hj-rice', 'osulloc', 'of-cafe', 'stay-tea'],
  };
  const before = JSON.stringify(state);
  const candidates = visibleChatCandidates(state);
  assert.deepEqual(
    candidates.map(({ id, kind }) => [id, kind]),
    [
      ['hyeopjae', 'place'],
      ['hj-rice', 'food'],
      ['osulloc', 'place'],
      ['of-cafe', 'cafe'],
      ['stay-tea', 'stay'],
    ],
  );
  const comparison = comparisonRows({
    ...state,
    stage: 'compare',
    comparisonIds: [candidates[1].id, candidates[3].id],
  });
  assert.deepEqual(
    comparison.map(({ id }) => id),
    ['hj-rice', 'of-cafe'],
  );
  assert.equal(JSON.stringify(state), before);
});

test('budget and checks use every collected visit without adding an unselected stay', () => {
  const state = {
    ...initialTrip(),
    stage: 'collection',
    region: '제주',
    days: 2,
    anchorId: 'osulloc',
    collectedIds: ['hyeopjae', 'hj-rice', 'osulloc', 'of-cafe'],
  };
  const before = JSON.stringify(state);
  const planned = makePlan(state);
  assert.deepEqual(
    planned.plan.map(({ entityId }) => entityId),
    state.collectedIds,
  );
  const budget = budgetSummary(planned);
  assert.equal(budget.foodTotal, 30_000);
  assert.equal(budget.cafeTotal, 18_000);
  assert.equal(budget.stayTotal, 0);
  assert.equal(budget.total, 48_000);
  assert.deepEqual(
    budget.lines.map(({ name }) => name),
    ['바다 앞 한상', '작은 찻집'],
  );
  assert.equal(budget.excluded.length, 2);
  assert.ok(!itineraryChecks(planned).some(({ level }) => level === 'warning'));
  assert.equal(JSON.stringify(state), before);
});

test('older sessions without collectedIds remain readable and yield an empty collection', () => {
  const session = createTripSession(['hyeopjae']);
  delete currentTrip(session).collectedIds;
  assert.ok(isTripSession(session));
  assert.ok(parseTripSession(session));
  assert.deepEqual(
    visibleChatCandidates({ ...currentTrip(session), stage: 'collection' }),
    [],
  );
});
