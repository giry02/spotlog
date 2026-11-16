import assert from 'node:assert/strict';
import test from 'node:test';
import { courseDayFacts, courseStayLabel } from '../src/coursePreviewModel.ts';
import { initializeCreatedPlan, isPersonalPlan } from '../src/tripPlan.ts';

test('course burden sums registered stay suggestions without inventing transfer or unknown time', () => {
  const day = { places: [{kind:'LANDMARK',duration:'1시간 20분'}, {kind:'FOOD',duration:'40분'}, {kind:'CAFE',duration:''}, {kind:'STAY',duration:'1박'}] };
  const before = structuredClone(day);
  assert.deepEqual(courseDayFacts(day), {stopCount:4,stayMinutes:120,unknownStays:1,overnightCount:1});
  assert.deepEqual(day,before);
  assert.equal(courseStayLabel(120),'체류 합계 2시간');
});
test('missing durations and empty DAY remain unknown rather than a zero-hour itinerary claim', () => {
  assert.deepEqual(courseDayFacts({places:[]}),{stopCount:0,stayMinutes:0,unknownStays:0,overnightCount:0});
  assert.equal(courseStayLabel(0),'체류시간 미등록');
  assert.equal(courseStayLabel(75),'체류 합계 1시간 15분');
  assert.equal(courseDayFacts({places:[{kind:'FOOD',duration:'미정'}]}).unknownStays,1);
});
test('taking a generated recommendation creates a private PLAN rather than an authored journal', () => {
  const source = { id:'recommendation',title:'등록 코스',region:'부산',duration:'당일',dateRange:'날짜 미정',status:'PLANNING',visibility:'PRIVATE',cover:'',summary:'',story:'',tags:[],saves:0,author:'추천',isMine:true,days:[{day:1,date:'DAY 1',title:'',story:'',blocks:[],places:[{id:'cafe',kind:'CAFE',name:'카페',area:'부산',address:'부산',lat:35.1,lng:129.1,image:'',description:'',note:'',duration:'1시간'}]}] };
  const before=structuredClone(source), plan=initializeCreatedPlan(source,'나');
  assert.equal(isPersonalPlan(plan),true);
  assert.equal(plan.visibility,'PRIVATE');
  assert.equal(plan.planStage,'READY');
  assert.equal(plan.author,'나');
  assert.equal(plan.days[0].places[0].name,'카페');
  assert.deepEqual(source,before);
});
