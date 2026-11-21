import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCreationPreferences, privatePlanningPreferences } from '../src/together/creationPreferences.ts';
import { prepareQuickCreation } from '../src/together/quickCreation.ts';
import { buildCreationJourney } from '../src/together/creationCommit.ts';
import { copyPersonalPlan, makeJournalFromPlan } from '../src/tripPlan.ts';
import { createLocalRepository } from '../src/localRepository.ts';

const conditions = (extra = {}) => prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 가족 2박 3일 여행. 식당과 호텔 숙소도 찾아줘', initial: { date: '2026-12-01', people: 4, transport: 'PUBLIC', notes: '유모차로 이동하고 중간에 쉬고 싶어요.', budgetPerPerson: 50000, walkingLimitMinutes: 20, ...extra } }, []).brief;
const journeyFor = (brief, catalog = []) => {
  const draft = prepareQuickCreation({ purpose: brief.purpose, initial: brief }, catalog);
  return buildCreationJourney(draft.brief, draft.plan, catalog, '가상 여행자');
};
function memoryStorage() {
  const values = new Map();
  return { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, String(value)); }, removeItem: key => { values.delete(key); } };
}

test('only the current creation input becomes private planning preferences without fixed visits or inherited operations', () => {
  const brief = conditions(), journey = journeyFor(brief);
  const original = structuredClone(journey);
  const result = attachCreationPreferences({ ...journey, planningPreferences: { prompt: 'OLD-PRIVATE-INPUT', fixedIds: ['old-booking'] } }, brief);
  assert.equal(result.visibility, 'PRIVATE'); assert.equal(result.purpose, 'PLAN');
  assert.equal(result.planningPreferences.region, '부산'); assert.equal(result.planningPreferences.dayCount, 3);
  assert.equal(result.planningPreferences.startDate, '2026-12-01');
  assert.equal(result.planningPreferences.transport, 'transit'); assert.equal(result.planningPreferences.companions, '4명');
  assert.match(result.planningPreferences.prompt, /유모차/); assert.match(result.planningPreferences.prompt, /희망 예산 · 1인 50,000원/);
  assert.match(result.planningPreferences.prompt, /희망 걷기 · 20분/);
  assert.equal(result.planningPreferences.suggestFood, true); assert.equal(result.planningPreferences.suggestStay, true);
  for (const field of ['requiredIds', 'excludedIds', 'fixedIds']) assert.deepEqual(result.planningPreferences[field], []);
  assert.equal(JSON.stringify(result).includes('OLD-PRIVATE-INPUT'), false);
  assert.equal(JSON.stringify(result).includes('old-booking'), false);
  assert.equal(result.summary, ''); assert.equal(result.story, ''); assert.deepEqual(journey, original);
});

test('missing optional inputs remain missing and an explicit zero budget or walking limit is retained', () => {
  const draft = prepareQuickCreation({ purpose: 'TRIP' }, []);
  const result = attachCreationPreferences(journeyFor(draft.brief), draft.brief);
  assert.equal(result.planningPreferences.prompt, ''); assert.equal(result.planningPreferences.companions, '');
  assert.equal(result.planningPreferences.transport, 'undecided'); assert.equal(result.planningPreferences.arrival, '');
  assert.equal(result.planningPreferences.suggestFood, false); assert.equal(result.planningPreferences.suggestStay, false);
  assert.equal(privatePlanningPreferences({ ...result, isMine: true }), undefined);
  const zero = { ...draft.brief, budgetPerPerson: 0, walkingLimitMinutes: 0 };
  assert.match(attachCreationPreferences(journeyFor(zero), zero).planningPreferences.prompt, /희망 예산 · 1인 0원/);
  assert.match(attachCreationPreferences(journeyFor(zero), zero).planningPreferences.prompt, /희망 걷기 · 0분/);
});

test('personal-copy and real repository roundtrip retain input; journal creation strips it', () => {
  const brief = { ...conditions({ startTime: '10:30' }), locationUndecided: false };
  const catalog = [{ id:'fictional-food',kind:'FOOD',name:'가상 식당',area:'부산 해운대',address:'부산 해운대구 가상길 1',lat:35.16,lng:129.16,image:'',photos:[],note:'',description:'',duration:'' }];
  const personal = copyPersonalPlan(attachCreationPreferences(journeyFor(brief, catalog), brief), '가상 여행자');
  assert.equal(personal.planningPreferences.arrival, '10:30');
  assert.equal(privatePlanningPreferences(personal), personal.planningPreferences);
  const storage = memoryStorage(), repository = createLocalRepository(storage), key = 'spotlog.web.journeys.v4';
  assert.equal(repository.setItem(key, JSON.stringify([personal])), true, repository.getIssue());
  const restored = JSON.parse(createLocalRepository(storage).getItem(key))[0];
  assert.deepEqual(restored.planningPreferences, personal.planningPreferences);
  const journal = makeJournalFromPlan(restored, '가상 여행자');
  assert.equal(journal.planningPreferences, undefined); assert.equal(journal.story, ''); assert.equal(journal.summary, '');
  assert.equal(JSON.stringify(journal).includes('유모차'), false);
  assert.equal(privatePlanningPreferences(journal), undefined);
});

test('public, nonowner, trashed and journal views do not expose private input; attachment is private PLAN only', () => {
  const brief = conditions(), personal = copyPersonalPlan(attachCreationPreferences(journeyFor(brief), brief), '가상 여행자');
  for (const patch of [{ visibility: 'PUBLIC' }, { purpose: 'JOURNAL' }, { isMine: false }, { trash: { deletedAt: '', expiresAt: '', ownerId: 'other', previousStatus: 'PLANNING', previousVisibility: 'PRIVATE' } }]) {
    assert.equal(privatePlanningPreferences({ ...personal, ...patch }), undefined);
  }
  for (const patch of [{ visibility: 'PUBLIC' }, { purpose: 'JOURNAL' }, { status: 'PUBLISHED' }, { trash: {} }]) assert.throws(() => attachCreationPreferences({ ...personal, ...patch }, brief), /비공개/);
  assert.throws(() => attachCreationPreferences(personal, { ...brief, purpose: 'GROUP' }), /비공개/);
});

test('stay requests honor explicit exclusion while transport values keep the existing repository contract', () => {
  for (const [transport, expected] of [['UNSET','undecided'],['WALK','walk'],['PUBLIC','transit'],['CAR','car']]) {
    const brief = conditions({ transport });
    assert.equal(attachCreationPreferences(journeyFor(brief), brief).planningPreferences.transport, expected);
  }
  const brief = { ...conditions(), prompt: '부산으로 당일 여행. 호텔 숙소는 빼고 찾아줘.' };
  assert.equal(attachCreationPreferences(journeyFor(brief), brief).planningPreferences.suggestStay, false);
});
