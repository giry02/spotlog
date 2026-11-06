import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyContent } from '../src/admin/content.ts';
import { publicationIssues } from '../src/admin/selectors.ts';
import { placeCheckItems, placeWorkLabel } from '../src/admin/placeWorkflow.ts';

function complete() {
  const content = emptyContent('FOOD');
  Object.assign(content,{name:'부산 식당',area:'부산 해운대',regionId:'kr-busan-haeundae',address:'부산 해운대구 확인 주소',description:'직접 등록한 설명',provider:'직접 제공',sourceUrl:'https://example.org/source',checkedAt:'2026-10-12'});
  content.rights={display:true,store:true,modify:false,ai:false};
  content.location={lat:35.16,lng:129.16,verified:true,reference:'공식 도착점',sourceUrl:content.sourceUrl,checkedAt:content.checkedAt};
  return content;
}
function record(content=complete()) {return {placeId:'food-a',revision:1,state:'DRAFT',draft:content,revoked:false,updatedAt:'2026-10-12T01:00:00.000Z'};}

test('registration checklist preserves every publication blocker and routes unfinished sources to their editor',()=>{
  const content=emptyContent('CAFE'); content.provenance={origin:'STAFF'};
  const checks=placeCheckItems(content);
  assert.deepEqual(checks.map(check=>check.message),publicationIssues(content));
  assert.equal(checks.find(check=>check.message.startsWith('등록 지역')).tab,'basic');
  assert.equal(checks.find(check=>check.message.startsWith('자료 제공자')).source,true);
  assert.equal(checks.find(check=>check.message.startsWith('자료 표시')).source,true);
  assert.equal(checks.find(check=>check.message.startsWith('좌표와')).tab,'location');
  assert.equal(content.rights.display,false);
  assert.equal(content.location.verified,false);
});

test('optional media stays optional but invalid media, translation, and AI approval remain blocking in their own tabs',()=>{
  const content=complete(); assert.deepEqual(placeCheckItems(content),[]);
  content.guide.english='A local restaurant';
  content.ai.allowed=true;
  content.media=[{mediaId:'photo',type:'PHOTO',url:'/photo.webp',caption:'',alt:'',cover:true,provider:'',author:'',sourceUrl:'',license:'',licenseUrl:'',checkedAt:'',rights:{display:false,store:false,modify:false,ai:false},withdrawn:false}];
  const checks=placeCheckItems(content);
  assert.deepEqual(new Set(checks.map(check=>check.tab)),new Set(['guide','ai','media']));
  assert.ok(checks.filter(check=>check.tab==='media').length>=2);
  assert.deepEqual(checks.map(check=>check.message),publicationIssues(content));
  content.media[0].withdrawn=true;
  assert.equal(placeCheckItems(content).some(check=>check.tab==='media'),false);
});

test('saved edits remain a draft of the public original until explicit publication',()=>{
  const place=record();
  assert.equal(placeWorkLabel(place),'작성 중');
  place.meta={createdById:'staff',assignedToId:'staff',reviewStatus:'NEEDS_CHECK'};
  assert.equal(placeWorkLabel(place),'확인 필요');
  place.meta.reviewStatus='READY'; assert.equal(placeWorkLabel(place),'검수 완료 · 공개 전');
  place.state='PUBLISHED'; place.published=structuredClone(place.draft);
  assert.equal(placeWorkLabel(place),'공개');
  assert.equal(placeWorkLabel(place,true),'공개본 수정 중');
  place.draft.description='수정 초안'; assert.equal(placeWorkLabel(place),'공개본 수정 중');
  assert.equal(place.published.description,'직접 등록한 설명');
  place.published=structuredClone(place.draft); assert.equal(placeWorkLabel(place),'공개');
  place.state='INACTIVE'; assert.equal(placeWorkLabel(place),'비활성');
  place.revoked=true; assert.equal(placeWorkLabel(place),'사용 철회');
});
