import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { holdCreationHandoff, peekCreationHandoff, takeCreationHandoff, retainCreationHandoff } from '../src/together/creationHandoff.ts';
import { interpretCreationPrompt } from '../src/together/creationPlanner.ts';
import { restoreCreationPreview } from '../src/together/creationPreview.ts';

const start = Date.parse('2026-11-06T03:00:00Z');
const lifetime = 5 * 60_000;
const draft = () => ({
  brief: interpretCreationPrompt('부산 가족 2박 3일 여행', { date: '2026-11-10', region: '부산', purpose: 'TRIP', locationUndecided: true, topics: ['FAMILY', 'FOOD'] }),
  plan: { id: 'unlocated-draft', source: 'CATALOG', title: '부산 가족 여행 초안', placeIds: [],
    days: [{ day: 1, placeIds: [] }, { day: 2, placeIds: [] }, { day: 3, placeIds: [] }],
    explanation: ['장소는 나중에 정해요.'], unknowns: ['실제 방문 장소는 미정이에요.'] },
});

beforeEach(() => retainCreationHandoff(undefined, start));
afterEach(() => retainCreationHandoff(undefined, start));

test('only the two creation routes can hold a handoff and unrelated routes cannot supply one', () => {
  for (const route of ['home', 'together', 'together-plan-more', 'together-plan-trip/extra', '#together-plan', '', 'https://untrusted.example/together-plan']) {
    assert.equal(holdCreationHandoff(route, draft(), start), false, route);
    assert.equal(peekCreationHandoff('account-a', route, start), undefined);
    assert.equal(takeCreationHandoff('account-a', route, start), undefined);
  }
  for (const route of ['together-plan', 'together-plan-trip']) {
    assert.equal(holdCreationHandoff(route, draft(), start), true);
    assert.equal(peekCreationHandoff('account-a', route, start).plan.title, '부산 가족 여행 초안');
    retainCreationHandoff(undefined, start);
  }
});

test('guest take and peek cannot consume a pending draft before the first authenticated visitor', () => {
  const proposed = draft();
  holdCreationHandoff('together-plan-trip', proposed, start);
  for (let i = 0; i < 2; i++) {
    assert.equal(peekCreationHandoff('', 'together-plan-trip', start + i), undefined);
    assert.equal(takeCreationHandoff('', 'together-plan-trip', start + i), undefined);
  }
  const accepted = takeCreationHandoff('account-a', 'together-plan-trip', start + 10);
  assert.deepEqual(accepted, proposed);
  assert.equal(takeCreationHandoff('account-a', 'together-plan-trip', start + 11), undefined);
});

test('repeated initial render peeks are independent nonconsuming copies and the authenticated effect consumes exactly once', () => {
  holdCreationHandoff('together-plan-trip', draft(), start);
  const firstRender = peekCreationHandoff('account-a', 'together-plan-trip', start + 1);
  const repeatedRender = peekCreationHandoff('account-a', 'together-plan-trip', start + 2);
  assert.deepEqual(firstRender, repeatedRender);
  assert.notEqual(firstRender, repeatedRender);
  assert.notEqual(firstRender.brief, repeatedRender.brief);
  assert.notEqual(firstRender.plan.days, repeatedRender.plan.days);
  firstRender.brief.topics.push('CAFE');
  firstRender.plan.days[0].placeIds.push('mutated-render-place');
  firstRender.plan.explanation.push('mutated-render-explanation');
  const effectValue = takeCreationHandoff('account-a', 'together-plan-trip', start + 3);
  assert.deepEqual(effectValue, repeatedRender);
  assert.equal(peekCreationHandoff('account-a', 'together-plan-trip', start + 4), undefined);
  assert.equal(takeCreationHandoff('account-a', 'together-plan-trip', start + 4), undefined);
});

test('after the first authenticated consumption neither the same account nor another account can reuse the draft', () => {
  holdCreationHandoff('together-plan', draft(), start);
  assert.ok(takeCreationHandoff('account-a', 'together-plan', start + 1));
  for (const account of ['account-a', 'account-b', '']) {
    assert.equal(peekCreationHandoff(account, 'together-plan', start + 2), undefined);
    assert.equal(takeCreationHandoff(account, 'together-plan', start + 2), undefined);
  }
});

test('leaving creation discards the draft and returning to its previous route cannot revive it', () => {
  for (const destination of [undefined, 'home', 'together', 'together-plan']) {
    holdCreationHandoff('together-plan-trip', draft(), start);
    retainCreationHandoff(destination, start + 1);
    assert.equal(peekCreationHandoff('account-a', 'together-plan-trip', start + 2), undefined);
    retainCreationHandoff('together-plan-trip', start + 3);
    assert.equal(takeCreationHandoff('account-a', 'together-plan-trip', start + 4), undefined);
  }
});

test('a different creation route cannot read the current handoff and taking that route discards the old context', () => {
  holdCreationHandoff('together-plan-trip', draft(), start);
  assert.equal(peekCreationHandoff('account-a', 'together-plan', start + 1), undefined);
  assert.ok(peekCreationHandoff('account-a', 'together-plan-trip', start + 1));
  assert.equal(takeCreationHandoff('account-a', 'together-plan', start + 2), undefined);
  assert.equal(peekCreationHandoff('account-a', 'together-plan-trip', start + 3), undefined);
});

test('five minute expiry is exact and repeated retain or peek does not extend the original deadline', () => {
  holdCreationHandoff('together-plan', draft(), start);
  retainCreationHandoff('together-plan', start + lifetime - 2);
  assert.ok(peekCreationHandoff('account-a', 'together-plan', start + lifetime - 1));
  assert.equal(peekCreationHandoff('account-a', 'together-plan', start + lifetime), undefined);
  assert.equal(takeCreationHandoff('account-a', 'together-plan', start + lifetime), undefined);
  assert.equal(takeCreationHandoff('account-a', 'together-plan', start + lifetime + 1), undefined);
  holdCreationHandoff('together-plan', draft(), start);
  retainCreationHandoff('together-plan', start + lifetime);
  assert.equal(peekCreationHandoff('account-a', 'together-plan', start + lifetime + 1), undefined);
});

test('the held snapshot strips member, private place, prior consent and operation metadata at every layer', () => {
  const input = draft();
  Object.assign(input, { accountId: 'SECRET-ACCOUNT', groupId: 'SECRET-GROUP', checked: true, dateUnconfirmed: true, previewOnly: false });
  Object.assign(input.brief, { groupId: 'SECRET-GROUP', ownerEmail: 'SECRET-EMAIL', sourceMessageIds: ['SECRET-MESSAGE'] });
  Object.assign(input.plan, { ownerId: 'SECRET-OWNER', booking: 'SECRET-BOOKING', privatePlace: { note: 'SECRET-NOTE' } });
  Object.assign(input.plan.days[0], { visitId: 'SECRET-VISIT', memberIds: ['SECRET-MEMBER'] });
  const before = structuredClone(input);
  holdCreationHandoff('together-plan-trip', input, start);
  const result = takeCreationHandoff('account-a', 'together-plan-trip', start + 1);
  assert.deepEqual(Object.keys(result).sort(), ['brief', 'plan']);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal('checked' in result, false);
  assert.equal('dateUnconfirmed' in result, false);
  assert.deepEqual(Object.keys(result.plan.days[0]).sort(), ['day', 'placeIds']);
  assert.deepEqual(input, before);
  const restored = restoreCreationPreview(result, []);
  assert.equal(restored.checked, false);
  assert.equal(restored.dateUnconfirmed, false);
  assert.equal(restored.ready, true);
});

test('later caller mutations cannot modify the pending plan and group draft snapshots', () => {
  const input = draft();
  input.brief = interpretCreationPrompt('부산 책 모임을 만들고 싶어.', { purpose: 'GROUP', region: '부산' });
  input.plan = null;
  input.groupDraft = { name: '한 장씩 읽어요', kind: 'HOBBY', region: '부산', introduction: '함께 읽어요.',
    topics: ['BOOK', 'CAFE'], welcome: '처음도 환영', joinGuide: '서로 배려해요.', joinMode: 'APPROVAL',
    memberIds: ['SECRET-MEMBER'], ownerId: 'SECRET-OWNER', promotionPublished: true };
  holdCreationHandoff('together-plan', input, start);
  input.groupDraft.name = 'caller changed title';
  input.groupDraft.topics.push('SPORTS');
  input.brief.topics.push('GAME');
  const preview = peekCreationHandoff('account-a', 'together-plan', start + 1);
  assert.equal(preview.groupDraft.name, '한 장씩 읽어요');
  assert.deepEqual(preview.groupDraft.topics, ['BOOK', 'CAFE']);
  assert.equal(JSON.stringify(preview).includes('SECRET'), false);
  assert.equal('promotionPublished' in preview.groupDraft, false);
  preview.groupDraft.topics.push('PHOTO');
  const accepted = takeCreationHandoff('account-a', 'together-plan', start + 2);
  assert.equal(accepted.plan, null);
  assert.deepEqual(accepted.groupDraft.topics, ['BOOK', 'CAFE']);
  assert.equal(accepted.groupDraft.joinMode, 'APPROVAL');
  assert.deepEqual(accepted.brief.topics, ['BOOK']);
});

test('only the latest explicitly held draft is retained and a new hold starts its own expiry window', () => {
  const first = draft(), second = draft();
  second.plan.title = '새로 확인한 여행';
  holdCreationHandoff('together-plan', first, start);
  holdCreationHandoff('together-plan-trip', second, start + 100);
  assert.equal(peekCreationHandoff('account-a', 'together-plan', start + 101), undefined);
  assert.equal(peekCreationHandoff('account-a', 'together-plan-trip', start + lifetime).plan.title, '새로 확인한 여행');
  assert.equal(takeCreationHandoff('account-a', 'together-plan-trip', start + lifetime + 100), undefined);
});
