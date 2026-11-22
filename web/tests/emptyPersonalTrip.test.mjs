import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmptyPersonalTrip } from '../src/emptyPersonalTrip.ts';
import { createLocalRepository } from '../src/localRepository.ts';
import { isPersonalPlan, makeJournalFromPlan } from '../src/tripPlan.ts';

test('create first produces a private draft with no assumed dates, destinations or copied information', () => {
  const trip = buildEmptyPersonalTrip({ title:'', requestId:'new-trip' }, '여행자');
  assert.equal(trip.title,'새 여행');
  assert.equal(trip.visibility,'PRIVATE');
  assert.equal(trip.status,'PLANNING');
  assert.equal(trip.planStage,'DRAFT');
  assert.equal(isPersonalPlan(trip),true);
  assert.equal(trip.startDate,undefined);
  assert.equal(trip.duration,'기간 미정');
  assert.equal(trip.days.length,1);
  assert.deepEqual(trip.days[0].places,[]);
  assert.deepEqual(trip.days[0].blocks,[]);
  for(const key of ['sourceJourneyId','sourceAuthor','planningPreferences','businessCandidates','travelProgress','recommendationKind']) assert.equal(trip[key],undefined);
  assert.throws(()=>makeJournalFromPlan(trip,'여행자'));
});

test('a request retains its identity for failed-save retry without altering the optional title', () => {
  const request={title:'  부산 가족 여행  ',requestId:'same-request'};
  const first=buildEmptyPersonalTrip(request,'여행자'), retry=buildEmptyPersonalTrip(request,'여행자');
  assert.equal(first.id,retry.id);
  assert.equal(first.title,'부산 가족 여행');
  assert.equal(request.title,'  부산 가족 여행  ');
  assert.notEqual(first.id,buildEmptyPersonalTrip({...request,requestId:'another-request'},'여행자').id);
});

test('an empty private trip can be saved and reopened with the existing journey repository', () => {
  const values=new Map();
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),clear:()=>values.clear()};
  const trip=buildEmptyPersonalTrip({title:'나중에 채울 여행',requestId:'persist'},'여행자');
  const key='spotlog.web.journeys.v4';
  assert.equal(createLocalRepository(storage).setItem(key,JSON.stringify([trip])),true);
  const reopened=JSON.parse(createLocalRepository(storage).getItem(key))[0];
  assert.equal(reopened.id,trip.id);
  assert.equal(reopened.days[0].dayId,trip.days[0].dayId);
  assert.equal(reopened.days[0].places.length,0);
});

test('invalid names and request identifiers fail before a trip is persisted', () => {
  for(const title of ['x'.repeat(101),'여행\n이름',null]) assert.throws(()=>buildEmptyPersonalTrip({title,requestId:'valid'},'여행자'));
  for(const requestId of ['',null,'../trip']) assert.throws(()=>buildEmptyPersonalTrip({title:'여행',requestId},'여행자'));
});
