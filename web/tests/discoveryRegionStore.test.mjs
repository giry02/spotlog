import test from 'node:test';
import assert from 'node:assert/strict';
import { MY_REGION_OPTIONS, MY_REGION_STORAGE_PREFIX, activeRegion, emptyMyRegions, myRegionStorageKey, readMyRegions, writeMyRegions } from '../src/discoveryRegionStore.ts';

const memory = () => { const values = new Map(); return { values, getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value) }; };
const draft = (owner='member-a') => ({ ...emptyMyRegions(owner), regions:[{id:'area-busan',region:'부산',district:'해운대구'}], activeId:'area-busan' });

test('manual discovery areas use exactly 17 canonical regions and an explicit empty default',()=>{
  assert.equal(MY_REGION_OPTIONS.length,17); assert.equal(new Set(MY_REGION_OPTIONS).size,17);
  assert.deepEqual(emptyMyRegions('guest-device'),{schemaVersion:1,owner:'guest-device',revision:0,regions:[],activeId:null});
  assert.equal(activeRegion(emptyMyRegions('member-a')),null);
  assert.equal(myRegionStorageKey('member-a'),MY_REGION_STORAGE_PREFIX+'member-a');
});
test('account namespaces never copy guest areas and encoded owners remain distinct',()=>{
  const storage=memory(); writeMyRegions(storage,draft('guest-device'),0);
  assert.equal(readMyRegions(storage,'guest-device').state.regions.length,1);
  assert.equal(readMyRegions(storage,'member-a').state.regions.length,0);
  assert.equal(readMyRegions(storage,'member-b').state.regions.length,0);
  assert.notEqual(myRegionStorageKey('a:b'),myRegionStorageKey('a%3Ab'));
  for(const owner of ['', ' ', 'a'.repeat(301), 'bad\nowner']) assert.throws(()=>myRegionStorageKey(owner));
});
test('save supports one active area plus two interests without mutating the draft or unrelated records',()=>{
  const storage=memory(); storage.values.set('spotlog.web.saved.v3','["food"]'); storage.values.set('spotlog.web.journeys.v4','[{"id":"my-trip"}]');
  const next={...draft(),regions:[...draft().regions,{id:'area-seoul',region:'서울',district:'성수동'},{id:'area-jeju',region:'제주'}],activeId:'area-seoul'};
  const before=structuredClone(next), saved=writeMyRegions(storage,next,0);
  assert.equal(saved.revision,1); assert.equal(activeRegion(saved).district,'성수동'); assert.deepEqual(next,before);
  saved.regions[0].district='changed'; assert.deepEqual(next,before);
  assert.equal(storage.values.get('spotlog.web.saved.v3'),'["food"]'); assert.equal(storage.values.get('spotlog.web.journeys.v4'),'[{"id":"my-trip"}]');
  assert.equal(storage.values.size,3);
});
test('clearing all areas is explicit and does not delete the storage key or a second account',()=>{
  const storage=memory(); const saved=writeMyRegions(storage,draft(),0); writeMyRegions(storage,draft('member-b'),0);
  const cleared=writeMyRegions(storage,{...saved,regions:[],activeId:null},1);
  assert.equal(cleared.revision,2); assert.equal(activeRegion(cleared),null); assert.ok(storage.getItem(myRegionStorageKey('member-a')));
  assert.equal(readMyRegions(storage,'member-b').state.regions.length,1);
});
test('malformed, future, foreign and extra private fields are preserved without being overwritten',()=>{
  const invalids=['{broken',JSON.stringify({...draft(),schemaVersion:2}),JSON.stringify({...draft(),owner:'member-b'}),JSON.stringify({...draft(),gps:{lat:35,lng:129}}),JSON.stringify({...draft(),regions:[{...draft().regions[0],address:'a private address'}]})];
  for(const raw of invalids){const storage=memory();storage.setItem(myRegionStorageKey('member-a'),raw);assert.equal(readMyRegions(storage,'member-a').status,'invalid');assert.throws(()=>writeMyRegions(storage,draft(),0));assert.equal(storage.getItem(myRegionStorageKey('member-a')),raw);}
});
test('invalid active ids, duplicates, noncanonical regions and overlong districts cannot replace a valid setting',()=>{
  const storage=memory(),saved=writeMyRegions(storage,draft(),0),raw=storage.getItem(myRegionStorageKey('member-a'));
  const variants=[{...saved,activeId:'missing'},{...saved,activeId:null},{...saved,regions:[]},{...saved,regions:[...saved.regions,...saved.regions]},
    {...saved,regions:[...saved.regions,{id:'second',region:'부산',district:'해운대구'}]},
    {...saved,regions:[{id:'x',region:'부산광역시'}],activeId:'x'},
    {...saved,regions:[{id:'x',region:'부산',district:'a'.repeat(41)}],activeId:'x'},
    {...saved,regions:[{id:'x',region:'부산',district:'\n해운대구'}],activeId:'x'},
    {...saved,regions:['서울','부산','제주','인천'].map((region,index)=>({id:`a${index}`,region})),activeId:'a0'}];
  for(const invalid of variants){assert.throws(()=>writeMyRegions(storage,invalid,1));assert.equal(storage.getItem(myRegionStorageKey('member-a')),raw);}
});
test('same city with distinct neighborhoods is allowed, while Unicode and whitespace duplicate neighborhoods are rejected',()=>{
  const storage=memory(), next={...draft(),regions:[{id:'a',region:'부산',district:'해운대구'},{id:'b',region:'부산',district:'수영구'}],activeId:'a'};
  const saved=writeMyRegions(storage,next,0);assert.equal(saved.regions.length,2);
  assert.throws(()=>writeMyRegions(storage,{...saved,regions:[{id:'a',region:'서울',district:'주안 6동'},{id:'b',region:'서울',district:'주안  ６동'}]},1));
});
test('stale revisions and failed writes leave existing bytes and the editor draft unchanged',()=>{
  const storage=memory(),saved=writeMyRegions(storage,draft(),0),raw=storage.getItem(myRegionStorageKey('member-a'));
  assert.throws(()=>writeMyRegions(storage,draft(),0),/다른 화면/);assert.equal(storage.getItem(myRegionStorageKey('member-a')),raw);
  const next={...saved,regions:[{id:'new-area',region:'경기',district:'수원시'}],activeId:'new-area'}, before=structuredClone(next);
  const blocked={getItem:storage.getItem,setItem(){throw new Error('QuotaExceededError')}};
  assert.throws(()=>writeMyRegions(blocked,next,1),/입력 내용은 유지/);assert.equal(storage.getItem(myRegionStorageKey('member-a')),raw);assert.deepEqual(next,before);
  assert.throws(()=>writeMyRegions(storage,{...next,revision:0},1),/버전/);
});
test('unavailable reads/writes and revision overflow never create or reset data',()=>{
  assert.equal(readMyRegions(null,'member-a').status,'unavailable');assert.throws(()=>writeMyRegions(null,draft(),0));
  const blocked={getItem(){throw new Error('SecurityError')},setItem(){throw new Error('should not write')}};
  assert.equal(readMyRegions(blocked,'member-a').status,'unavailable');assert.throws(()=>writeMyRegions(blocked,draft(),0));
  const storage=memory();assert.throws(()=>writeMyRegions(storage,{...draft(),revision:Number.MAX_SAFE_INTEGER},Number.MAX_SAFE_INTEGER));assert.equal(storage.values.size,0);
});
