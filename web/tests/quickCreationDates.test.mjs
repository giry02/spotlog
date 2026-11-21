import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareQuickCreation, quickCreationStartDatePatch } from '../src/together/quickCreation.ts';
import { validateCreationPlan } from '../src/together/creationPlanner.ts';

test('choosing the first date of an undated three-day draft fills the last date without changing its itinerary', () => {
  const source = prepareQuickCreation({ purpose:'TRIP', prompt:'부산 가족 2박 3일 여행' }, []);
  assert.equal(source.brief.date,'');
  assert.equal(source.brief.endDate,'');
  assert.equal(source.plan.days.length,3);
  const before = structuredClone(source.plan);
  const changed = { ...source.brief, ...quickCreationStartDatePatch('TRIP','2026-12-01',source.plan.days.length) };
  assert.equal(changed.date,'2026-12-01');
  assert.equal(changed.endDate,'2026-12-03');
  assert.deepEqual(validateCreationPlan(changed,source.plan,[]),[]);
  assert.deepEqual(source.plan,before);
  const cleared = { ...changed, ...quickCreationStartDatePatch('TRIP','',source.plan.days.length) };
  assert.equal(cleared.date,'');
  assert.equal(cleared.endDate,'');
  assert.deepEqual(validateCreationPlan(cleared,source.plan,[]),[]);
});

test('moving the start of a three-day draft keeps every DAY and produces a matching end date', () => {
  const source = prepareQuickCreation({ purpose:'TRIP', prompt:'부산 가족 2박 3일 여행', initial:{ date:'2026-12-30', endDate:'2027-01-01' } }, []);
  const before = structuredClone(source.plan);
  const changed = { ...source.brief, ...quickCreationStartDatePatch('TRIP','2027-01-02',source.plan.days.length) };
  assert.equal(changed.endDate,'2027-01-04');
  assert.deepEqual(validateCreationPlan(changed,source.plan,[]),[]);
  assert.deepEqual(source.plan,before);
  assert.equal(source.brief.date,'2026-12-30');
});

test('new dates support leap days and a cleared date returns to an undated draft without a stale end date', () => {
  assert.deepEqual(quickCreationStartDatePatch('TRIP','2028-02-28',3),{date:'2028-02-28',endDate:'2028-03-01'});
  assert.deepEqual(quickCreationStartDatePatch('TRIP','',3),{date:'',endDate:''});
  assert.deepEqual(quickCreationStartDatePatch('MEETUP','2027-01-02',1),{date:'2027-01-02',endDate:''});
});

test('an invalid calendar date or duration is never corrected into a different travel day', () => {
  for(const date of ['2027-02-29','2026-13-01','2026-11-31','tomorrow']) assert.throws(()=>quickCreationStartDatePatch('TRIP',date,2));
  for(const count of [0,8,NaN,2.5]) assert.throws(()=>quickCreationStartDatePatch('TRIP','2027-01-01',count));
});
