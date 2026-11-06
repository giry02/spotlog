import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateComparison, candidatePhoto } from '../src/tripCandidatePresentation.ts';

const place = { id:'one',kind:'FOOD',name:'식당',area:'부산 해운대',address:'부산',lat:35.16,lng:129.16,image:'',description:'등록된 소개',note:'',duration:'1시간' };
test('candidate distance uses the anchor coordinates and identifies straight-line distance',()=>{
  assert.equal(candidateComparison(place,place).distance,'직선 0m');
  assert.match(candidateComparison(place,{...place,lng:129.17}).distance,/^직선 \d+m$/);
  assert.match(candidateComparison(place,{...place,lng:129.2}).distance,/^직선 \d+\.\dkm$/);
});
test('candidate distance does not claim coordinates for personal/unverified/missing locations',()=>{
  assert.equal(candidateComparison(place).distance,'거리 확인 필요');
  assert.equal(candidateComparison({...place,locationVerified:false},place).distance,'거리 확인 필요');
  assert.equal(candidateComparison(place,{...place,lat:NaN}).distance,'거리 확인 필요');
});
test('comparison reuses distinct registered features without inventing prices or availability',()=>{
  const input={...place,tags:['공식 관광정보','해운대',' 음식점 ','바다 전망','바다 전망','우동','좌석 안내','남은 태그']};
  const comparison=candidateComparison(input,place);
  assert.deepEqual(comparison.features,['바다 전망','우동','좌석 안내']);
  assert.equal(comparison.description,'등록된 소개');
  assert.deepEqual(candidateComparison(place).features,[]);
  assert.equal(input.tags.length,8);
});
test('basic catalogue boilerplate is not shown as a registered business feature',()=>{
  assert.equal(candidateComparison({...place,description:'부산 해운대 일정에서 확인할 음식점 후보입니다.'}).description,'');
  assert.equal(candidateComparison({...place,kind:'STAY',description:'부산 해운대 일정에서 비교할 숙소 후보예요.'}).description,'');
  assert.equal(candidateComparison({...place,description:'바다를 보며 먹는 등록된 소개.'}).description,'바다를 보며 먹는 등록된 소개.');
});
test('candidate photos never resurrect withdrawn covers or explicitly empty galleries',()=>{
  assert.equal(candidatePhoto({...place,image:'cover'}),'cover');
  assert.equal(candidatePhoto({...place,image:'cover',photos:[]}),'');
  const input={...place,image:'old',photos:[{image:'old',availability:'withdrawn',alt:'old',caption:''},{image:'current',alt:'current',caption:''}]};
  assert.equal(candidatePhoto(input),'current');
  assert.equal(candidatePhoto(input,['current']),'');
  assert.equal(input.image,'old');
});
