import test from 'node:test';
import assert from 'node:assert/strict';
import { answerGuide, createGuideSessionStore, guideAnswerKey, guideDayId, guideIntent, guideRequest, guideSessionKey, guideVisitId, koreanPlaceAddress, localGuideAdapter, localTranslationAdapter, sampleTranslations, sourceVersion, translationCacheKey, translationState, createTranslationCache, TRANSLATION_GLOSSARY_VERSION, validateGuideResponse, validateTranslationResponse } from '../src/travelGuide.ts';

const place = (id, visitId) => ({id,visitId,kind:'LANDMARK',name:`장소 ${id}`,area:'서울',address:`서울 주소 ${id}`,lat:37,lng:127,image:'',description:'등록된 소개',note:'',duration:''});
const journey = () => ({id:'my-trip',purpose:'PLAN',title:'여행',region:'서울',dateRange:'',duration:'2일',status:'PLANNING',visibility:'PRIVATE',cover:'',summary:'',story:'',tags:[],saves:0,author:'나',isMine:true,days:[
  {dayId:'first',day:1,date:'',title:'',story:'',blocks:[],places:[place('a','first-a'),place('b','first-b'),place('a','second-a'),place('c','first-c')]},
  {dayId:'second',day:2,date:'',title:'',story:'',blocks:[],places:[place('d','second-d')]},
]});
const req = (value, day = 0, index = 0, question = '다음 장소', language = 'ko') => guideRequest(value,value.days[day],value.days[day].places[index],index,question,language);
const translation = (text = [...sampleTranslations.keys()][0], overrides = {}) => ({requestId:'request',sourceId:'caption:a',sourceVersion:sourceVersion(text),language:'en',glossaryVersion:TRANSLATION_GLOSSARY_VERSION,text,selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],...overrides});

test('guide uses the selected DAY and distinct visit for repeated places, without changing itinerary', () => {
  const trip = journey(); const before = structuredClone(trip);
  assert.match(answerGuide(req(trip,0,0)).data.text,/장소 b/);
  assert.match(answerGuide(req(trip,0,2)).data.text,/장소 c/);
  assert.match(answerGuide(req(trip,1,0)).data.text,/마지막 장소/);
  const today = answerGuide(req(trip,1,0,'오늘 일정'));
  assert.match(today.data.text,/장소 d/); assert.doesNotMatch(today.data.text,/장소 a/);
  assert.equal(today.mock,true); assert.equal(today.sources[0].checkedAt,null);
  assert.deepEqual(trip,before);
});

test('deleted DAY/visit cannot silently produce guidance for another place', () => {
  const trip = journey(); const input = req(trip);
  assert.throws(()=>answerGuide({...input,dayId:'deleted'}),/DAY_NOT_FOUND/);
  assert.throws(()=>answerGuide({...input,visitId:'deleted'}),/PLACE_NOT_FOUND/);
  assert.throws(()=>answerGuide({...input,visitId:undefined,placeId:'deleted'}),/PLACE_NOT_FOUND/);
});

test('empty day and legacy IDs have explicit stable behavior', () => {
  const trip = journey(); trip.days[0].places=[]; delete trip.days[0].dayId;
  assert.equal(guideDayId(trip.days[0]),'day-1');
  assert.equal(guideVisitId(place('a'),3),'a:3');
  assert.match(answerGuide(req(trip,0,0,'오늘 일정')).data.text,/담긴 장소가 없어요/);
});

test('opening, allergy, emergency and accessibility questions never invent verified facts', () => {
  const trip = journey();
  const questions = [['오늘 영업하나요','hours','확인된 자료가 없어요'],['휠체어 가능해요','accessibility','직접 확인'],['땅콩 알레르기','allergy','안전하다고 판단하지'],['응급 상황이에요','emergency','즉시 도움'],['실제 방문 후기 알려줘','unknown','답을 찾지 못했어요']];
  for (const [question,intent,expected] of questions) {
    assert.equal(guideIntent(question),intent);
    const result=answerGuide(req(trip,0,0,question)); assert.ok(result.data.text.includes(expected)); assert.equal(result.sources[0].checkedAt,null);
  }
});

test('English preserves place IDs and Korean destination name/address', () => {
  const trip=journey(); const result=answerGuide(req(trip,0,0,'Next stop','en'));
  assert.match(result.data.text,/Next stop: 장소 b/); assert.match(result.data.text,/서울 주소 b/);
  assert.match(result.data.text,/not been verified/);
  assert.equal(koreanPlaceAddress(trip.days[0].places[0]),'장소 a\n서울 주소 a');
});

test('known English description is explicitly a local sample, unknown text remains Korean', () => {
  const trip=journey(); trip.days[0].places[0].description=[...sampleTranslations.keys()][0];
  assert.match(answerGuide(req(trip,0,0,'Highlights','en')).data.text,/Evening light/);
  trip.days[0].places[0].description='나만의 새 장소 소개';
  assert.match(answerGuide(req(trip,0,0,'Highlights','en')).data.text,/나만의 새 장소 소개/);
  assert.match(answerGuide(req(trip,0,0,'Highlights','en')).data.text,/not available/);
});

test('cancelling guide and translation rejects before a response is applied', async () => {
  const controller=new AbortController(); controller.abort();
  await assert.rejects(localGuideAdapter.answer(req(journey()),controller.signal),{name:'AbortError'});
  await assert.rejects(localTranslationAdapter.translate(translation(),controller.signal),{name:'AbortError'});
  const second=new AbortController();const pending=localGuideAdapter.answer(req(journey()),second.signal);second.abort();
  await assert.rejects(pending,{name:'AbortError'});
});

test('translation cache requires source, version, language, glossary and exact source text', async () => {
  const input=translation(); const response=await localTranslationAdapter.translate(input);
  const record={sourceId:input.sourceId,sourceVersion:input.sourceVersion,original:input.text,language:input.language,glossaryVersion:input.glossaryVersion,translated:response.data.text,status:response.data.status};
  const cache=createTranslationCache(); assert.equal(cache.put(input,record),true); assert.equal(cache.get(input),record);
  assert.equal(translationState(record,input),'sample');
  for (const change of [{sourceId:'other'},{sourceVersion:'changed'},{text:'원문 수정'},{language:'ko'},{glossaryVersion:'new'}]) {
    const next={...input,...change}; assert.equal(cache.get(next),null); assert.equal(translationState(record,next),'stale'); assert.notEqual(translationCacheKey(next),translationCacheKey(input)); assert.equal(cache.put(next,record),false);
  }
  assert.equal(translationState(null,input),'original');
  assert.equal(translationState({...record,status:'reviewed'},input),'reviewed');
});

test('unsupported freeform numbers, dates, amounts, phone, exit and negation are preserved exactly', async () => {
  const original='서울숲 서울 성동구 뚝섬로 273. 2026-09-19, 2번 출구. 10,000원, 전화 02-123-4567. 휠체어 진입 불가. 견과류 없음으로 단정하면 안 됩니다.';
  const result=await localTranslationAdapter.translate(translation(original));
  assert.equal(result.data.status,'unavailable'); assert.equal(result.data.text,original); assert.equal(result.mock,true);
  const changedGlossary=await localTranslationAdapter.translate(translation(undefined,{glossaryVersion:'unrecognized'}));
  assert.equal(changedGlossary.data.status,'unavailable');
});

test('caption sample preserves explicit number and every translation is labeled sample, not reviewed', async () => {
  const caption='해가 낮아질수록 물빛이 옅어지는 협재. 일몰 40분 전부터 천천히 걷기 시작했다.';
  const result=await localTranslationAdapter.translate(translation(caption));
  assert.match(result.data.text,/40 minutes before sunset/); assert.equal(result.data.status,'sample');
  assert.equal(result.requestId,'request'); assert.equal(result.sources[0].checkedAt,null);
});

test('translation cache is bounded and can clear on account boundary', () => {
  const cache=createTranslationCache(1); const input=translation();
  const make=input=>({sourceId:input.sourceId,sourceVersion:input.sourceVersion,original:input.text,language:input.language,glossaryVersion:input.glossaryVersion,translated:input.text,status:'unavailable'});
  cache.put(input,make(input)); const second={...input,sourceId:'another'}; cache.put(second,make(second));
  assert.equal(cache.size,1); assert.equal(cache.get(input),null); cache.clear(); assert.equal(cache.size,0);
});

test('guide locks keep original visit indices and versions change after actual edits', () => {
  const trip=journey(); trip.days[0].places[2].bookingFixed=true; delete trip.days[0].places[2].visitId;
  const input=req(trip); assert.deepEqual(input.lockedVisitIds,['a:2']);
  const version=sourceVersion(trip); trip.days[0].places[0].name='새 이름'; assert.notEqual(sourceVersion(trip),version);
});

test('guide rejects malformed runtime responses even when request ID and version are correct', () => {
  const trip=journey();const input=req(trip);const response=answerGuide(input);const before=structuredClone(trip);
  const malformed=[null,[],{}, {...response,data:null}, {...response,data:{}}, {...response,data:{text:{unexpected:'React child'}}},
    {...response,data:{text:'  '}}, {...response,sources:undefined}, {...response,sources:{}}, {...response,sources:[null]},
    {...response,sources:[{...response.sources[0],label:{text:'not renderable'}}]},
    {...response,sources:[{...response.sources[0],checkedAt:4}]}, {...response,sources:[{...response.sources[0],checkedAt:'2026-02-30'}]},
    {...response,sources:[{...response.sources[0],checkedAt:'today'}]}, {...response,sources:[{...response.sources[0],checkedAt:undefined}]},
    {...response,sources:[{...response.sources[0],sourceVersion:null}]}, {...response,sources:[{...response.sources[0],url:{}}]},
    {...response,mock:'true'}, {...response,warnings:null}, {...response,warnings:[{}]}, {...response,unplaced:[{placeId:'a',reason:{}}]},
    {...response,requestId:'different'}, {...response,sourceVersion:'old'}];
  for (const value of malformed) assert.throws(()=>validateGuideResponse(value,input),/INVALID_GUIDE_RESPONSE/);
  assert.deepEqual(trip,before); assert.deepEqual(input.journey,before);
});

test('guide accepts typed dated sources and detaches accepted data from the adapter', () => {
  const input=req(journey());const response=answerGuide(input);
  for (const checkedAt of [null,'2026-09-19','2026-09-19T12:30:00Z','2026-09-19T01:30:00.123+09:00']) {
    const raw={...response,sources:[{...response.sources[0],checkedAt}],warnings:['sample'],unplaced:[{placeId:'missing',reason:'No location'}]};
    const accepted=validateGuideResponse(raw,input);
    assert.equal(accepted.sources[0].checkedAt,checkedAt);
    raw.data={text:{bad:true}};raw.sources[0].label={bad:true};raw.warnings[0]={bad:true};raw.unplaced[0].reason={bad:true};
    assert.equal(typeof accepted.data.text,'string');assert.equal(typeof accepted.sources[0].label,'string');
    assert.deepEqual(accepted.warnings,['sample']);assert.equal(accepted.unplaced[0].reason,'No location');
  }
});

test('translation response validates status, data, provenance and exact fallback before caching', async () => {
  const input=translation();const response=await localTranslationAdapter.translate(input);
  const invalid=[null,{...response,data:null},{...response,data:{status:'sample'}},{...response,data:{text:{bad:true},status:'sample'}},
    {...response,data:{text:'English',status:'verified'}},{...response,data:{text:'Changed source',status:'unavailable'}},
    {...response,sources:undefined},{...response,sources:[{...response.sources[0],checkedAt:{bad:true}}]},
    {...response,requestId:'another'},{...response,sourceVersion:'outdated'}];
  const cache=createTranslationCache();const original=input.text;
  for (const value of invalid) assert.throws(()=>validateTranslationResponse(value,input),/INVALID_(GUIDE|TRANSLATION)_RESPONSE/);
  assert.equal(cache.size,0);assert.equal(input.text,original);
  const accepted=validateTranslationResponse(response,input);assert.equal(accepted.data.status,'sample');
  const fallback=validateTranslationResponse({...response,data:{text:input.text,status:'unavailable'}},input);
  assert.equal(fallback.data.text,original);assert.equal(fallback.data.status,'unavailable');
  assert.equal(validateTranslationResponse({...response,data:{...response.data,status:'reviewed'}},input).data.status,'reviewed');
});

test('guide session restores selected visits and questions only for the same trip version and entry DAY', () => {
  const trip=journey(),store=createGuideSessionStore(),key=guideSessionKey(trip,1);
  const draft={dayId:'second',visitsByDay:{first:'second-a',second:'second-d'},question:'다음 장소',answers:{},lastAnswerByScope:{}};
  store.write(key,draft);
  assert.deepEqual(store.read(key),draft);
  const returned=store.read(key);returned.visitsByDay.first='modified-outside';assert.equal(store.read(key).visitsByDay.first,'second-a');
  assert.equal(store.read(guideSessionKey({...trip,id:'other-trip'},1)),null);
  assert.equal(store.read(guideSessionKey({...trip,title:'changed title'},1)),null);
  assert.equal(store.read(guideSessionKey(trip,2)),null);
});

test('guide answer reuse requires exact question and language/place context; memory is bounded and clearable', () => {
  assert.equal(guideAnswerKey('day1:visit1:ko','다음 장소 '),guideAnswerKey('day1:visit1:ko','다음 장소'));
  assert.notEqual(guideAnswerKey('day1:visit1:ko','다음 장소'),guideAnswerKey('day1:visit1:ko','오늘 일정'));
  assert.notEqual(guideAnswerKey('day1:visit1:ko','다음 장소'),guideAnswerKey('day1:visit2:ko','다음 장소'));
  assert.notEqual(guideAnswerKey('day1:visit1:ko','다음 장소'),guideAnswerKey('day1:visit1:en','다음 장소'));
  const store=createGuideSessionStore(1),base={dayId:'first',visitsByDay:{},question:'',answers:{},lastAnswerByScope:{}};
  store.write('old',base);store.write('new',base);assert.equal(store.read('old'),null);assert.deepEqual(store.read('new'),base);
  store.clear();assert.equal(store.read('new'),null);
});
