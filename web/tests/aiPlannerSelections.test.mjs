import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlannerSelections, updatePlannerStayNights, personalPlannerBusiness, upsertPlannerBusiness, plannerStayForDay, removePlannerBusiness } from '../src/aiPlannerSelections.ts';
import { buildPersonalPlan } from '../src/tripPlan.ts';
const place=(id,kind='LANDMARK')=>({id,kind,name:id,area:'제주',address:'제주 주소',image:'',lat:33.4,lng:126.2,note:'',description:'',duration:''});
const base=()=>buildPersonalPlan([place('a'),place('b'),place('c')],3,'검수','검수');

test('changing a selected hotel from one to two nights updates the second DAY without removing and re-adding it',()=>{
 const journey=base(),day=journey.days[0],choice={dayId:day.dayId,anchorId:day.places[0].visitId,place:place('hotel','STAY'),nights:1};
 const first=applyPlannerSelections(journey,[],[choice]);
 const changed=updatePlannerStayNights([choice],journey,day.dayId,2);
 const second=applyPlannerSelections(journey,[],changed);
 assert.equal(first.days[1].places.some(p=>p.kind==='STAY'),false);
 assert.equal(second.days[1].places.some(p=>p.id==='hotel'),true);
 assert.equal(second.days.flatMap(d=>d.places).length,first.days.flatMap(d=>d.places).length+1);
 assert.equal(choice.nights,1);
 const shortened=applyPlannerSelections(journey,[],updatePlannerStayNights(changed,journey,day.dayId,1));
 assert.equal(shortened.days[1].places.some(p=>p.kind==='STAY'),false);
});
test('changing nights preserves food and choices on another DAY, and rejects a stay past checkout',()=>{
 const journey=base(),day=journey.days[0],choices=[{dayId:day.dayId,anchorId:day.places[0].visitId,place:place('food','FOOD'),nights:1}];
 assert.deepEqual(updatePlannerStayNights(choices,journey,day.dayId,2),choices);
 assert.throws(()=>updatePlannerStayNights(choices,journey,day.dayId,3));
 assert.throws(()=>updatePlannerStayNights(choices,journey,'missing',1));
});
test('manual business keeps day/landmark context without a made-up image or coordinates',()=>{
 const journey=base(),day=journey.days[0],anchor=day.places[0];
 const form={dayId:day.dayId,anchorId:anchor.visitId,kind:'CAFE',name:' 아는 카페 ',address:' 제주 주소 '};
 const personal=personalPlannerBusiness(form,anchor);
 assert.equal(personal.name,'아는 카페');assert.equal(personal.personal,true);assert.equal(personal.locationVerified,false);assert.equal(personal.image,'');assert.equal(Number.isNaN(personal.lat),true);
 const result=applyPlannerSelections(journey,[],[{...form,place:personal,nights:1}]);
 assert.equal(result.days[0].places.find(p=>p.id===personal.id).anchorVisitId,anchor.visitId);
 assert.equal(result.days[1].places.some(p=>p.id===personal.id),false);
 assert.equal(journey.days[0].places.some(p=>p.personal),false);
 assert.throws(()=>personalPlannerBusiness({...form,name:' '},anchor));
});
test('excluding an anchor cannot leave its selected business orphaned in the draft',()=>{
 const journey=base(),day=journey.days[0],anchor=day.places[0];
 const result=applyPlannerSelections(journey,[anchor.visitId],[{dayId:day.dayId,anchorId:anchor.visitId,place:place('food','FOOD'),nights:1}]);
 assert.equal(result.days[0].places.some(p=>p.id==='food'),false);
});

const hotelChoice=(journey,day,nights,id='hotel-a',anchorDay=day)=>({dayId:journey.days[day-1].dayId,anchorId:journey.days[anchorDay-1].places[0].visitId,place:place(id,'STAY'),nights});
const hotelDays=(journey,choices)=>applyPlannerSelections(journey,[],choices).days.map(day=>day.places.filter(p=>p.kind==='STAY').map(p=>p.id));

test('selecting a second hotel on another day preserves the first overnight stay',()=>{
  const journey=base(),a=hotelChoice(journey,1,1),b=hotelChoice(journey,2,1,'hotel-b');
  const choices=upsertPlannerBusiness([a],journey,b);
  assert.deepEqual(hotelDays(journey,choices),[['hotel-a'],['hotel-b'],[]]);assert.equal(choices[0],a);
});
test('overlapping selection splits only the replaced nights and retains an original anchor on an empty later day',()=>{
  const journey=buildPersonalPlan([place('a'),place('b')],4,'','나'),a=hotelChoice(journey,1,3),b=hotelChoice(journey,2,1,'hotel-b');
  const choices=upsertPlannerBusiness([a],journey,b);
  assert.deepEqual(hotelDays(journey,choices),[['hotel-a'],['hotel-b'],['hotel-a'],[]]);
  const last=plannerStayForDay(choices,journey,journey.days[2].dayId);assert.equal(last.choice.anchorId,a.anchorId);assert.equal(last.choice.dayId,journey.days[2].dayId);assert.equal(journey.days[2].places.length,0);
  assert.equal(a.nights,3);
});
test('middle-day duration shows remaining nights and changes only that day forward',()=>{
  const journey=buildPersonalPlan([place('a'),place('b')],4,'','나'),a=hotelChoice(journey,1,3),day2=journey.days[1].dayId;
  const initial=plannerStayForDay([a],journey,day2);assert.equal(initial.remainingNights,2);assert.equal(initial.startDay,1);assert.equal(initial.endDay,3);
  const short=updatePlannerStayNights([a],journey,day2,1);assert.deepEqual(hotelDays(journey,short),[['hotel-a'],['hotel-a'],[],[]]);
  const longer=updatePlannerStayNights(short,journey,day2,2);assert.deepEqual(hotelDays(journey,longer),[['hotel-a'],['hotel-a'],['hotel-a'],[]]);
});
test('removing one overnight stay preserves the nights before and after it',()=>{
  const journey=buildPersonalPlan([place('a'),place('b')],4,'','나'),a=hotelChoice(journey,1,3);
  const choices=removePlannerBusiness([a],journey,journey.days[1].dayId,'hotel-a');
  assert.deepEqual(hotelDays(journey,choices),[['hotel-a'],[],['hotel-a'],[]]);assert.equal(choices[1].anchorId,a.anchorId);
});
test('selecting the same hotel again on a continued day never removes its previous night',()=>{
  const journey=base(),a=hotelChoice(journey,1,2),again=hotelChoice(journey,2,1,'hotel-a');
  const choices=upsertPlannerBusiness([a],journey,again);assert.deepEqual(hotelDays(journey,choices),[['hotel-a'],['hotel-a'],[]]);
  assert.equal(plannerStayForDay(choices,journey,journey.days[1].dayId).choice,again);
  assert.deepEqual(hotelDays(journey,removePlannerBusiness(choices,journey,journey.days[1].dayId,'hotel-a')),[['hotel-a'],[],[]]);
});
test('extending a stay replaces overlapping nights of another hotel but preserves its remaining nights',()=>{
  const journey=buildPersonalPlan([place('a'),place('b')],5,'','나'),a=hotelChoice(journey,1,1),b=hotelChoice(journey,2,3,'hotel-b');
  const choices=updatePlannerStayNights([a,b],journey,journey.days[0].dayId,3);
  assert.deepEqual(hotelDays(journey,choices),[['hotel-a'],['hotel-a'],['hotel-a'],['hotel-b'],[]]);
});
test('food insertion, re-selection and removal keep other days and all overnight stays',()=>{
  const journey=base(),a=hotelChoice(journey,1,2),day=journey.days[1],food={dayId:day.dayId,anchorId:day.places[0].visitId,place:place('food','FOOD'),nights:1};
  const choices=upsertPlannerBusiness(upsertPlannerBusiness([a],journey,food),journey,food);assert.equal(choices.length,2);
  assert.deepEqual(removePlannerBusiness(choices,journey,day.dayId,'food'),[a]);
  assert.throws(()=>upsertPlannerBusiness(choices,journey,{...food,anchorId:'missing'}));assert.throws(()=>upsertPlannerBusiness(choices,journey,{...a,nights:3}));
});
