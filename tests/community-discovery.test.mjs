import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
registerHooks({resolve(specifier,context,next){if(/\/lib\/[^/]+\.ts$/.test(context.parentURL??'')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {communityTrips,findCommunityTrip}=await import('../lib/community-trips.ts');
const {filterCommunityTrips,communityAuthorProfile,hasCommunityAuthor,communityTypeLabel,communityModelCandidates,communityPhoto}=await import('../lib/community-discovery.ts');
const {discoveryMediaResults,mediaCatalogSummary,mediaModelCandidates}=await import('../lib/discovery-media.ts');
const {createCommunityTripPreview}=await import('../lib/community-trip-preview.ts');
const {getTripMapData}=await import('../lib/trip-map-data.ts');
const {createTripSession,currentTrip,appendTrip}=await import('../lib/trip-engine.ts');
const {parseTripSession}=await import('../lib/chat-contract.ts');

test('app public editorial courses preserve only explicit AI sample provenance, paragraphs and allowed photos',()=>{
  assert.equal(communityTrips.length,11);
  const editorial=communityTrips.filter(trip=>trip.sourceAppId);
  assert.equal(editorial.length,4);
  for(const trip of editorial){
    assert.equal(trip.sourceKind,'demo');assert.equal(trip.contentType,'ai');assert.equal(trip.sourceMetadata.recommendationKind,'AI');
    assert.equal(trip.sourceMetadata.recommendationBasis,'OFFICIAL_SOURCE_SAMPLE');assert.equal(trip.dayStories.length,trip.days);
    assert.match(trip.story,/개인의 방문 후기.*실시간 생성한 결과가 아닙니다/);
    assert.ok(trip.dayStories.every(day=>day.provenance==='app-editorial'&&day.story));
    for(const block of trip.dayStories.flatMap(day=>day.blocks)){if(block.type==='photo'){const photo=communityPhoto(block.photoId);assert.ok(photo&&photo.license&&photo.author&&photo.sourceUrl);}if(block.type==='place')assert.ok(trip.visits.some(visit=>visit.entityId===block.entityId));}
  }
  const legacy=communityTrips.filter(trip=>!trip.sourceAppId&&trip.id!=='community-jeju-west-real-11');assert.equal(legacy.length,6);
  assert.ok(legacy.every(trip=>communityTypeLabel(trip)==='여행자 코스 형식 데모'&&/실제 여행자가 올린 글.*아닙니다/.test(trip.story)));
});
test('title, author, period, type and region filters compose without mutating the public originals',()=>{
  const before=JSON.stringify(communityTrips);
  assert.equal(filterCommunityTrips({communityType:'ai'}).length,4);
  assert.equal(filterCommunityTrips({communityType:'traveler'}).length,7);
  const exact=filterCommunityTrips({communityRegion:'경주',communityDays:2,communityType:'ai',communityQuery:'공공자료 가이드'});
  assert.equal(exact.length,1);assert.match(exact[0].title,/경주/);
  assert.ok(filterCommunityTrips({communityQuery:'1박2일'}).every(trip=>trip.days===2));
  assert.ok(filterCommunityTrips({communityQuery:'당일'}).length>0);assert.ok(filterCommunityTrips({communityQuery:'당일'}).every(trip=>trip.days===1));
  assert.equal(filterCommunityTrips({communityQuery:'없는 제목 123'}).length,0);
  assert.equal(filterCommunityTrips({communityDays:7}).length,0);
  assert.equal(JSON.stringify(communityTrips),before);
});
test('author details show honest demo/editorial identity, no invented rank or engagement and real other bundled courses',()=>{
  const profile=communityAuthorProfile('spotlog-public-editorial');assert.ok(profile);assert.equal(profile.trips.length,4);
  assert.match(profile.introduction,/실제 회원.*아닙니다/);assert.match(profile.gradeNote,/실제 회원 등급.*연결하지 않았/);
  assert.equal('copies' in profile,false);assert.equal('likes' in profile,false);assert.equal('followers' in profile,false);
  assert.equal(hasCommunityAuthor(profile.id),true);assert.equal(hasCommunityAuthor('unknown-author'),false);assert.equal(communityAuthorProfile('unknown-author'),undefined);
  assert.equal(filterCommunityTrips({communityAuthorId:profile.id}).length,4);
});
test('AI editorial preview and explicit copy retain source and SHOP visits without altering source or current saved plans',()=>{
  const trip=findCommunityTrip('community-app-public-busan-oldtown-2days'),before=JSON.stringify(trip);
  const preview=createCommunityTripPreview(trip),map=getTripMapData(preview,{allDays:true});
  assert.equal(map.points.length,trip.visits.length);assert.equal(map.unlocatedCount,0);assert.equal(preview.plan.filter(v=>v.kind==='shop').length,2);
  const session=appendTrip(createTripSession(),{type:'copy-community',id:trip.id});assert.equal(currentTrip(session).communitySourceId,trip.id);
  assert.doesNotThrow(()=>parseTripSession(session));assert.deepEqual(session.library,[]);
  currentTrip(session).plan[0].label='local edit';assert.equal(JSON.stringify(trip),before);
});
test('media feed exposes only matching real photo sets with source rights and content hashes, and does not invent videos',()=>{
  const summary=mediaCatalogSummary();assert.equal(summary.photos,81);assert.equal(summary.videos,0);assert.ok(summary.places>13);
  const all=discoveryMediaResults();assert.equal(new Set(all.map(item=>item.id)).size,all.length);
  for(const entity of all)for(const photo of entity.photos){const bytes=readFileSync(new URL('../public'+photo.image,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);assert.equal(photo.placeId,entity.id);assert.ok(photo.author&&photo.license&&photo.sourceUrl&&photo.licenseUrl);}
  assert.ok(discoveryMediaResults({mediaRegion:'제주'}).length>0);assert.ok(discoveryMediaResults({mediaRegion:'서울'}).length>0);
  assert.ok(discoveryMediaResults({mediaRegion:'부산',mediaKind:'CAFE'}).every(item=>item.region==='부산'&&item.kind==='CAFE'));
  assert.deepEqual(discoveryMediaResults({mediaRegion:'강릉'}),[]);
  assert.ok(discoveryMediaResults({mediaRegion:'제주'}).some(item=>item.photos.length>1));
});
test('compact model candidates exclude narrative bodies, photo rights, source URLs and unsupported popularity',()=>{
  const courses=communityModelCandidates(),media=mediaModelCandidates();assert.equal(courses.length,11);assert.equal(media.length,mediaCatalogSummary().places);
  for(const item of courses){for(const key of ['story','dayStories','blocks','photos','sourceUrl','likes','saves','views'])assert.equal(key in item,false,key);}
  for(const item of media)assert.deepEqual(Object.keys(item).sort(),['id','name','kind','region','photoCount'].sort());
  assert.ok(JSON.stringify(courses).length<15000);
});
test('media region filters remain separate from private travel and explicit photo collection respects existing region guards',()=>{
  let session=appendTrip(createTripSession(),{type:'media',mode:'photos',region:'부산',kind:'LANDMARK'});
  assert.equal(currentTrip(session).region,null);assert.equal(currentTrip(session).mediaRegion,'부산');
  session=appendTrip(session,{type:'collect-entity',id:'public-busan-haeundae'});
  assert.equal(currentTrip(session).region,'부산');assert.deepEqual(currentTrip(session).collectedIds,['public-busan-haeundae']);
  let active=appendTrip(createTripSession(),{type:'collect-entity',id:'hyeopjae'});active=appendTrip(active,{type:'build'});
  const before=structuredClone(currentTrip(active));
  active=appendTrip(active,{type:'media',mode:'photos',region:'부산',kind:'all'});
  assert.equal(currentTrip(active).region,'제주');assert.deepEqual(currentTrip(active).plan,before.plan);
  active=appendTrip(active,{type:'collect-entity',id:'public-busan-haeundae'});
  assert.equal(currentTrip(active).region,'제주');assert.deepEqual(currentTrip(active).plan,before.plan);assert.deepEqual(currentTrip(active).collectedIds,before.collectedIds);assert.match(currentTrip(active).notice,/지역/);
  assert.doesNotThrow(()=>parseTripSession(active));
});
