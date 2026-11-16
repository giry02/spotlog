import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTravelLandingContent } from '../src/community/travelLandingModel.ts';

const place = { id:'cafe',kind:'CAFE',name:'현재 공개 카페',area:'표시 지역',address:'공개 주소',regionId:'busan',image:'/current.webp',description:'소개',note:'',duration:'1시간',lat:35,lng:129 };
const references = [{category:'REGION',referenceId:'busan',name:'부산'}];
const journal = (id,extra={}) => ({id,title:id,region:'부산',author:'기록자',summary:'공개 소개',story:'본문',visibility:'PUBLIC',status:'PUBLISHED',purpose:'JOURNAL',isMine:false,cover:'/journal.webp',duration:'당일',dateRange:'',saves:0,tags:[],days:[{day:1,date:'',title:'',story:'',places:[place],blocks:[]}],...extra});
const course = (id,extra={}) => ({id,title:id,region:'부산',eyebrow:'추천',summary:'소개',duration:'당일',dayCount:1,cover:'/course.webp',places:[place],...extra});
const select = (templates,journals=[],filters={}) => selectTravelLandingContent(templates,journals,[place],references,{region:'',query:'',duration:'ALL',...filters});

test('duplicate source IDs cannot carry a private or owned template into a visible public course',()=>{
  const hidden = course('same',{title:'비공개 제목',publicJourney:journal('private',{visibility:'PRIVATE'})});
  const own = course('same',{title:'내 개인 여행',publicJourney:journal('mine',{isMine:true})});
  const result = select([hidden,own,course('same'),course('same',{title:'중복'})]);
  assert.deepEqual(result.templates.map(item=>item.title),['same']);
  assert.deepEqual(result.courses.map(item=>item.title),['same']);
  assert.equal(JSON.stringify(result).includes('비공개 제목'),false);
  assert.equal(JSON.stringify(result).includes('내 개인 여행'),false);
});

test('destination chips come only from admitted current courses and stay available across selected filters',()=>{
  const withdrawn = { ...place,id:'withdrawn' };
  const templates=[course('busan'),course('seoul',{region:'서울'}),course('private',{region:'제주',publicJourney:journal('private',{visibility:'PRIVATE'})}),course('withdrawn',{region:'강원',places:[withdrawn]})];
  const result=select(templates,[],{region:'부산',query:'busan'});
  assert.deepEqual(result.regions,['부산','서울']); assert.deepEqual(result.templates.map(item=>item.id),['busan']);
  assert.deepEqual(select(templates,[],{query:'없는 검색어'}).regions,['부산','서울']);
});

test('course destination and search use registered current places instead of old place snapshots',()=>{
  const source=course('registered',{region:'국내',places:[{...place,name:'철회된 옛 상호',area:'서울',image:'/withdrawn.webp'}]});
  const before=structuredClone(source), result=select([source],[],{region:'부산',query:'현재 공개 카페'});
  assert.equal(result.courses.length,1); assert.equal(result.templates.length,1);
  assert.equal(result.templates[0].places[0].name,'현재 공개 카페');
  assert.equal(JSON.stringify(result).includes('철회된 옛 상호'),false);
  assert.deepEqual(source,before);
});

test('landing never exposes a current-looking course whose embedded public route still contains a withdrawn place',()=>{
  const withdrawn={...place,id:'withdrawn',name:'철회 장소'};
  const bad=course('stale',{region:'제주',publicJourney:journal('source',{days:[{day:1,places:[place,withdrawn],blocks:[]}]})});
  const before=structuredClone(bad), result=select([bad,course('current')]);
  assert.deepEqual(result.templates.map(item=>item.id),['current']);
  assert.deepEqual(result.courses.map(item=>item.id),['current']);
  assert.deepEqual(result.regions,['부산']);
  assert.equal(JSON.stringify(result).includes('철회 장소'),false);
  assert.deepEqual(bad,before);
});

test('travel subhome keeps region/query/duration intersections and excludes personal, draft and private journals',()=>{
  const sources=[journal('visible'),journal('mine',{isMine:true}),journal('private',{visibility:'PRIVATE'}),journal('draft',{status:'PLANNING'})];
  assert.deepEqual(select([],sources,{region:'부산'}).journals.map(item=>item.id),['visible']);
  assert.deepEqual(select([],sources,{duration:'TWO'}).journals,[]);
  assert.deepEqual(select([],sources,{query:'비공개 검색어'}).journals,[]);
  assert.deepEqual(select([],sources,{region:'서울'}).journals,[]);
});
