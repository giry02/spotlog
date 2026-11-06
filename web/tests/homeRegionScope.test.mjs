import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHomePlaces } from '../src/homeDiscovery.ts';
import { selectDiscoveryHome } from '../src/community/discoveryHomeModel.ts';
import { createEmptyState } from '../src/together/model.ts';

const places = [
 { id:'coffee', kind:'CAFE', area:'부산', address:'부산 수영구 광안동', name:'바다 커피', tags:[], description:'조용한 카페' },
 { id:'other', kind:'CAFE', area:'부산 해운대구', address:'부산 해운대구', name:'바다 커피', tags:[] },
 { id:'food', kind:'FOOD', area:'부산 수영구', address:'부산 수영구', name:'바다 커피 식당', tags:[] },
];
test('home district, query, region and kind remain independent AND conditions through place-directory handoff', () => {
 const result=selectDiscoveryHome(createEmptyState('', ''),places,[],{region:'부산',district:'수영구',query:'커피',purpose:'CAFE'});
 assert.deepEqual(result.places.map(p=>p.id),['coffee']);
 assert.deepEqual(result.placeFilters,{region:'부산',district:'수영구',query:'커피',kind:'CAFE'});
 assert.deepEqual(filterHomePlaces(places,result.placeFilters,[]).map(p=>p.id),['coffee']);
 assert.deepEqual(filterHomePlaces(places,{...result.placeFilters,district:'없는동네'},[]),[]);
 assert.deepEqual(filterHomePlaces(places,{...result.placeFilters,region:'서울'},[]),[]);
});
test('address-only district and case-normalized address search work without rewriting place data', () => {
 const before=structuredClone(places);
 assert.deepEqual(filterHomePlaces(places,{district:'광안동',query:'바다'},[]).map(p=>p.id),['coffee']);
 assert.deepEqual(filterHomePlaces(places,{query:'광안동'},[]).map(p=>p.id),['coffee']);
 assert.deepEqual(places,before);
});
