import test from 'node:test';
import assert from 'node:assert/strict';
import { detailScreen, isTravelRootRoute, primaryTabs, primaryTabForScreen, mySectionForRoute, myRoute, legacyMySection, legacyMyHashMatches } from '../src/primaryNavigation.ts';
test('public place and journal discovery do not select the private saved catalogue', () => {
  for (const screen of ['home','discover','photo-stories']) assert.equal(primaryTabForScreen(screen), 'home');
  assert.equal(primaryTabForScreen('saved'), 'saved');
});
test('travel is a primary destination while private trips keep their My parent', () => {
  assert.deepEqual(primaryTabs.map(item => item.id), ['home','together','travel','saved','my']);
  assert.equal(primaryTabForScreen('travel'), 'travel');
  assert.equal(primaryTabForScreen('community'), 'travel');
  assert.equal(primaryTabForScreen('trips'), 'my');
});
test('legacy public travel links do not replace the private trip library', () => {
  assert.equal(isTravelRootRoute('travel'), true);
  assert.equal(isTravelRootRoute('home-trips'), true);
  assert.equal(isTravelRootRoute('trips'), false);
  assert.equal(isTravelRootRoute('my-travel'), false);
  assert.equal(isTravelRootRoute('journey-travel'), false);
});
test('legacy personal pages retain My as parent while group pages keep their hierarchy', () => {
  for (const screen of ['my','appointments','records','trips','profile','offline']) assert.equal(primaryTabForScreen(screen), 'my');
  assert.equal(primaryTabForScreen('together'), 'together');
});
test('old appointment and record links resolve without treating record IDs as menu routes', () => {
  assert.equal(mySectionForRoute('appointments'), 'schedule');
  assert.equal(mySectionForRoute('records'), 'records');
  assert.equal(legacyMySection('appointments','past'), 'records');
  assert.equal(legacyMySection('appointments','undated'), 'schedule');
  assert.equal(legacyMySection('trips'), undefined);
  assert.equal(mySectionForRoute('journey-my-record'), undefined);
});
test('My sections roundtrip their canonical deep links and reject unknown sections', () => {
  for (const section of ['schedule','travel','records']) assert.equal(mySectionForRoute(myRoute(section)), section);
  assert.equal(mySectionForRoute('my-private'), undefined);
  assert.equal(mySectionForRoute('my-travel-extra'), undefined);
});
test('legacy root history preserves its past view without reviving an unrelated detail', () => {
  assert.equal(legacyMyHashMatches('appointments','#appointments',false),true);
  assert.equal(legacyMySection('appointments','past'),'records');
  assert.equal(legacyMyHashMatches('records','#records',false),true);
  assert.equal(legacyMyHashMatches('appointments','#appointments',true),false);
  assert.equal(legacyMyHashMatches('appointments','#home',false),false);
  assert.equal(legacyMyHashMatches('my','#appointments',false),false);
});
test('calendar and group travel links retain the detail target for direct navigation', () => {
  assert.equal(detailScreen({ journeyId: 'personal-plan' }), 'journey-personal-plan');
  assert.equal(detailScreen({ templateId: 'weekend-route' }), 'recommendation-weekend-route');
  assert.equal(detailScreen({ editorId: 'journal', journeyId: 'old' }), 'edit-journal');
  assert.equal(detailScreen({ journeyId: null, templateId: null }), undefined);
});
