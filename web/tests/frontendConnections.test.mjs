import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJson,servicePath,safeExternalUrl,ServiceError} from '../src/serviceRequest.ts';
import {validateExternalPlaces,searchExternalPlaces} from '../src/placeSearchService.ts';
import {createAccountAdapter,validateAccountUser} from '../src/accountService.ts';
import {withRequestDeadline} from '../src/requestDeadline.ts';
import {validateServiceRoute,fetchServiceRoute,fetchRoadRoute} from '../src/routeData.ts';
import {loadNaverMap,watchNaverMapFailure} from '../src/naverMap.ts';

test('service requests stay on our origin, and external links reject executable URLs',()=>{
 for(const path of ['','https://bad.example/api','//bad.example/api','/\\bad','/api\n'])assert.throws(()=>servicePath(path));
 assert.equal(servicePath('/api/places'),'/api/places');
 for(const url of ['javascript:alert(1)','data:text/html,a','https://user:secret@example.com',null])assert.equal(safeExternalUrl(url),null);
 assert.equal(safeExternalUrl('https://map.naver.com/'),'https://map.naver.com/');
});
test('requests pass cancellation and timeout, never turn malformed responses into success',async t=>{
 let opts;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{opts=options;return new Response('{bad',{status:200});});
 await assert.rejects(requestJson('/api/account'),e=>e.status===502);
 assert.equal(opts.credentials,'same-origin');assert.equal(opts.cache,'no-store');
 t.mock.method(globalThis,'fetch',async(_url,options)=>new Promise((_,reject)=>{
  const abort=()=>reject(new DOMException('aborted','AbortError'));if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});
 }));
 await assert.rejects(requestJson('/api/places',{},10),e=>e.status===504);
 const controller=new AbortController();const request=requestJson('/api/places',{signal:controller.signal});controller.abort();
 await assert.rejects(request,{name:'AbortError'});
});
test('external results preserve provider order, separate source, and safe links',async t=>{
 const a={name:'first',address:'Seoul',category:'Food',url:'https://example.com/a'},b={...a,name:'second'};
 assert.deepEqual(validateExternalPlaces({provider:'NAVER',items:[b,a]}).items.map(x=>x.name),['second','first']);
 for(const value of [{provider:'OTHER',items:[]},{provider:'NAVER',items:Array(6).fill(a)},{provider:'NAVER',items:[{...a,url:'javascript:bad'}]}])assert.throws(()=>validateExternalPlaces(value));
 let path;t.mock.method(globalThis,'fetch',async p=>{path=p;return Response.json({provider:'NAVER',items:[]});});
 assert.deepEqual((await searchExternalPlaces('/api/places','서울 카페',new AbortController().signal)).items,[]);
 assert.match(path,/query=%EC%84%9C%EC%9A%B8%20%EC%B9%B4%ED%8E%98/);
});
test('unconfigured accounts never claim signed in; session expiration is a guest state',async t=>{
 const adapter=createAccountAdapter(''),signal=new AbortController().signal;
 let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response('',{status:401});});
 assert.equal(adapter.configured,false);assert.equal(await adapter.session(signal),null);assert.equal(requests,0);
 await assert.rejects(adapter.signIn('a@b.com','password',signal));assert.equal(requests,0);
 assert.equal(await createAccountAdapter('/api/account').session(signal),null);
 for(const user of [null,{}, {id:'x',displayName:'n'}, {id:'',displayName:'n',email:'e'}])assert.throws(()=>validateAccountUser(user));
});
test('account writes use same-origin POST and only explicit payloads',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(path,options)=>{calls.push({path,options});return path.endsWith('/sign-in')?Response.json({id:'a',displayName:'Name',email:'a@b.com'}):new Response(null,{status:204});});
 const adapter=createAccountAdapter('/api/account'),signal=new AbortController().signal;
 assert.equal((await adapter.signIn('a@b.com','private-password',signal)).id,'a');
 await adapter.removeAccount(signal);
 assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.headers.get('X-Requested-With'),'Spotlog');
 assert.deepEqual(JSON.parse(calls[1].options.body),{confirmed:true});
 assert.ok(!calls[0].path.includes('private-password'));
});
test('deadline cancels underlying work and rejects late adapters without applying them',async()=>{
 let inner,finish;
 const promise=withRequestDeadline(signal=>{inner=signal;return new Promise(r=>finish=r);},new AbortController().signal,10);
 await assert.rejects(promise,/입력을 유지/);assert.equal(inner.aborted,true);finish('late');
 const cancel=new AbortController();const operation=withRequestDeadline(()=>new Promise(()=>{}),cancel.signal,100);cancel.abort();await assert.rejects(operation,{name:'AbortError'});
 assert.equal(await withRequestDeadline(async()=>42,new AbortController().signal),42);
});
const places=[{id:'a',visitId:'va',lat:37,lng:127},{id:'b',visitId:'vb',lat:37.1,lng:127.1}];
const route={provider:'NAVER',mode:'DRIVE',visitIds:['va','vb'],coordinates:[[127,37],[127.1,37.1]],legs:[{distanceMeters:5000,durationSeconds:600}]};
test('route response must match this exact DAY visit order and valid geometry',()=>{
 const result=validateServiceRoute(route,places);assert.equal(result.distanceKm,5);assert.equal(result.minutes,10);assert.equal(result.legs[0].from,places[0]);
 for(const value of [{...route,visitIds:['vb','va']},{...route,mode:'WALK'},{...route,coordinates:[[190,37],[127,37]]},{...route,legs:[]},{...route,legs:[{distanceMeters:-1,durationSeconds:600}]}])assert.throws(()=>validateServiceRoute(value,places));
});
test('route backend receives coordinates with visit IDs; malformed legacy road data fails safely',async t=>{
 let body;t.mock.method(globalThis,'fetch',async(_path,options)=>{body=JSON.parse(options.body);return Response.json(route);});
 await fetchServiceRoute('/api/route',places,new AbortController().signal);assert.deepEqual(body.visits.map(v=>v.visitId),['va','vb']);
 t.mock.method(globalThis,'fetch',async()=>Response.json({code:'Ok',routes:[{geometry:{coordinates:[[127,37],[127.1,37.1]]},legs:[{distance:-1,duration:600}]}]}));
 await assert.rejects(fetchRoadRoute(places,new AbortController().signal),/unavailable/);
});
test('Naver SDK shares loading and reports late authorization failure, then retries',async t=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 t.after(()=>{globalThis.window=previousWindow;globalThis.document=previousDocument;});
 const scripts=[];globalThis.window={};globalThis.document={createElement:()=>({remove(){this.removed=true;}}),head:{append:s=>scripts.push(s)}};
 await assert.rejects(loadNaverMap(''),/missing/);
 const first=loadNaverMap('public-id');assert.equal(loadNaverMap('public-id'),first);assert.equal(scripts.length,1);
 const maps={};window.naver={maps};scripts[0].onload();assert.equal(await first,maps);
 let failed=0;const unwatch=watchNaverMapFailure(()=>failed++);window.navermap_authFailure();assert.equal(failed,1);
 const retry=loadNaverMap('public-id');assert.equal(scripts.length,2);scripts[1].onerror();await assert.rejects(retry,/network/);
 unwatch();
});
