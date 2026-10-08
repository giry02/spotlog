import test from 'node:test';
import assert from 'node:assert/strict';
import {draftPolicies,emptySignupChoices,requiredSignupAccepted,signupConsentPayload} from '../src/accountPolicies.ts';
import {createSocialAccountAdapter,validEmail,validSignupPassword,validatePolicies,validateSocialSession,validateSocialUser,validateAuthorizeUrl,validateReturnTo} from '../src/socialAccountService.ts';
import {canUseCurrentLocation,requestCurrentLocation} from '../src/locationConsent.ts';
import {requestJson,ACCOUNT_EXPIRED_EVENT} from '../src/serviceRequest.ts';

const published=()=>({...structuredClone(draftPolicies),status:'PUBLISHED',operator:{name:'검수 운영자',address:'검수 주소',email:'qa@example.invalid'},documents:draftPolicies.documents.map(d=>({...d,version:'fixture-1'}))});
const required={terms:true,collection:true,age:true,marketing:false};
test('required-only signup excludes marketing and GPS; drafts never count as member consent',()=>{
 assert.equal(requiredSignupAccepted(emptySignupChoices()),false);
 assert.equal(requiredSignupAccepted(required),true);
 for(const key of ['terms','collection','age'])assert.equal(requiredSignupAccepted({...required,[key]:false}),false);
 assert.throws(()=>signupConsentPayload(draftPolicies,required));
 assert.throws(()=>signupConsentPayload({...draftPolicies,status:'PUBLISHED'},required));
 const body=signupConsentPayload(published(),required);
 assert.equal(body.marketing.accepted,false);assert.equal(body.marketing.version,'fixture-1');
 assert.deepEqual(body.versions,{terms:'fixture-1',collection:'fixture-1'});
 assert.ok(!JSON.stringify(body).includes('location'));assert.ok(!JSON.stringify(body).includes('email'));
});
test('policy publication rejects unknown operator, draft versions, duplicates and missing content',()=>{
 assert.equal(validatePolicies(draftPolicies).status,'DRAFT');assert.equal(validatePolicies(published()).status,'PUBLISHED');
 for(const bad of [{...published(),operator:draftPolicies.operator},{...published(),documents:draftPolicies.documents},{...published(),minimumAge:0},{...published(),documents:Array(5).fill(published().documents[0])},{...published(),documents:published().documents.map(d=>({...d,sections:[]}))}])assert.throws(()=>validatePolicies(bad));
});
test('Apple private email and missing email are supported without merging identities by email',()=>{
 const a={id:'member-a',displayName:'여행자',email:null,provider:'APPLE'};
 assert.equal(validateSocialUser(a).email,null);
 assert.equal(validateSocialUser({...a,email:'private@privaterelay.appleid.com'}).provider,'APPLE');
 assert.equal(validateSocialSession({state:'PENDING_SIGNUP',provider:'GOOGLE'}).state,'PENDING_SIGNUP');
 for(const bad of [{state:'SIGNED_IN',user:{...a,id:''}},{state:'PENDING_SIGNUP',provider:'NAVER'},a])assert.throws(()=>validateSocialSession(bad));
});
test('OAuth redirects are HTTPS and exactly the selected provider; return route cannot leave app',()=>{
 assert.equal(validateAuthorizeUrl('https://accounts.google.com/o/oauth2/v2/auth','GOOGLE'),'https://accounts.google.com/o/oauth2/v2/auth');
 for(const bad of ['https://accounts.google.com.bad.example/auth','javascript:alert(1)','https://user:secret@accounts.google.com/auth','https://appleid.apple.com/auth','http://accounts.google.com/auth'])assert.throws(()=>validateAuthorizeUrl(bad,'GOOGLE'));
 assert.equal(validateReturnTo('/spotlog/#profile'),'/spotlog/#profile');
 for(const bad of ['https://bad.example','//bad.example','/../outside','/%2f%2fbad','/\\bad','/x?token=secret','/x\n'])assert.throws(()=>validateReturnTo(bad));
});
test('unconnected auth and GPS create no requests and no fake account or permissions',async t=>{
 let requests=0,gps=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw new Error('unexpected');});
 const adapter=createSocialAccountAdapter(''),signal=new AbortController().signal;
 assert.deepEqual(await adapter.session(signal),{state:'GUEST'});
 await assert.rejects(adapter.beginSignIn('GOOGLE','/#profile',signal));
 await assert.rejects(adapter.completeSignup(draftPolicies,required,signal));
 await assert.rejects(requestCurrentLocation(draftPolicies,null,{getCurrentPosition(){gps++;}}),e=>e.code==='UNCONNECTED');
 assert.equal(requests,0);assert.equal(gps,0);
});
test('social signup uses server session plus versions; no browser user ID, GPS or timestamps accepted as proof',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(path,options)=>{calls.push({path,options});return path.endsWith('/start')?Response.json({authorizeUrl:'https://appleid.apple.com/auth/authorize'}):Response.json({id:'server-member',displayName:'여행자',email:null,provider:'APPLE'});});
 const adapter=createSocialAccountAdapter('/api/account'),signal=new AbortController().signal;
 await adapter.beginSignIn('APPLE','/spotlog/#profile',signal);
 assert.equal((await adapter.completeSignup(published(),required,signal)).id,'server-member');
 assert.deepEqual(JSON.parse(calls[0].options.body),{returnTo:'/spotlog/#profile'});
 assert.equal(calls[1].options.credentials,'same-origin');assert.equal(calls[1].options.method,'POST');
 assert.deepEqual(Object.keys(JSON.parse(calls[1].options.body)).sort(),['accepted','marketing','versions']);
});
test('current location requires published enabled feature and matching purpose/version before OS call',async()=>{
 const bundle={...published(),locationEnabled:true};let calls=0;
 const geo={getCurrentPosition(ok){calls++;ok({coords:{latitude:37.5,longitude:127,accuracy:12},timestamp:10});}};
 for(const consent of [null,{accepted:true,purpose:'NEARBY_SEARCH',version:'old'},{accepted:true,purpose:'BACKGROUND',version:'fixture-1'}]){
  assert.equal(canUseCurrentLocation(bundle,consent),false);await assert.rejects(requestCurrentLocation(bundle,consent,geo),e=>e.code==='CONSENT_REQUIRED');
 }
 assert.equal(calls,0);
 assert.deepEqual(await requestCurrentLocation(bundle,{accepted:true,purpose:'NEARBY_SEARCH',version:'fixture-1'},geo),{lat:37.5,lng:127,accuracy:12,measuredAt:10});assert.equal(calls,1);
});
test('location denial, invalid position and cancel cannot leak a late position to feature',async()=>{
 const bundle={...published(),locationEnabled:true},consent={accepted:true,purpose:'NEARBY_SEARCH',version:'fixture-1'};
 await assert.rejects(requestCurrentLocation(bundle,consent,{getCurrentPosition(_ok,error){error({code:1});}}),e=>e.code==='DENIED');
 await assert.rejects(requestCurrentLocation(bundle,consent,{getCurrentPosition(ok){ok({coords:{latitude:500,longitude:127,accuracy:12},timestamp:10});}}),e=>e.code==='UNAVAILABLE');
 const c=new AbortController();let finish;const op=requestCurrentLocation(bundle,consent,{getCurrentPosition(ok){finish=ok;}},c.signal);c.abort();
 await assert.rejects(op,{name:'AbortError'});finish({coords:{latitude:37,longitude:127,accuracy:12},timestamp:10});
});
test('email signup cannot create a member before verified server response and versioned consent',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return path.endsWith('/signup')?Response.json({state:'VERIFICATION_REQUIRED',email:'qa@example.invalid'}):Response.json({id:'verified-id',displayName:'검수 회원',email:'qa@example.invalid',provider:'EMAIL'});});
 const a=createSocialAccountAdapter('/api/account'),signal=new AbortController().signal;
 assert.deepEqual(await a.signUpEmail({email:'qa@example.invalid',password:'long-password',displayName:'검수 회원'},published(),required,signal),{state:'VERIFICATION_REQUIRED',email:'qa@example.invalid'});
 assert.equal(calls[0].body.consent.marketing.accepted,false);assert.deepEqual(calls[0].body.consent.versions,{terms:'fixture-1',collection:'fixture-1'});
 assert.equal((await a.verifyEmail('qa@example.invalid','123456',signal)).id,'verified-id');
 assert.deepEqual(calls[1].body,{email:'qa@example.invalid',code:'123456'});
});
test('email validation, draft policies and malformed verification block completion',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({state:'SIGNED_IN',user:{id:'bad'}});});
 const a=createSocialAccountAdapter('/api/account'),signal=new AbortController().signal;
 assert.equal(validEmail('not-email'),false);assert.equal(validSignupPassword('short'),false);
 await assert.rejects(a.signUpEmail({email:'qa@example.invalid',password:'long-password',displayName:'qa'},draftPolicies,required,signal));
 await assert.rejects(a.signUpEmail({email:'bad',password:'long-password',displayName:'qa'},published(),required,signal));
 await assert.rejects(a.verifyEmail('qa@example.invalid','12345',signal));assert.equal(calls,0);
 await assert.rejects(a.signUpEmail({email:'qa@example.invalid',password:'long-password',displayName:'qa'},published(),required,signal));assert.equal(calls,1);
 assert.throws(()=>validateSocialUser({id:'member',displayName:'qa',email:null,provider:'EMAIL'}));
});
test('email login/reset/resend are same-origin and unavailable adapter never sends credentials',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(path,options)=>{calls.push({path,options});return path.endsWith('/sign-in')?Response.json({id:'member',displayName:'qa',email:'qa@example.invalid',provider:'EMAIL'}):new Response(null,{status:204});});
 const signal=new AbortController().signal,a=createSocialAccountAdapter('/api/account');
 assert.equal((await a.signInEmail('qa@example.invalid','pass',signal)).provider,'EMAIL');await a.resetPassword('qa@example.invalid',signal);await a.resendVerification('qa@example.invalid',signal);
 assert.ok(calls.every(c=>c.options.credentials==='same-origin'&&c.options.method==='POST'));assert.equal(calls.length,3);
 await assert.rejects(createSocialAccountAdapter('').signInEmail('qa@example.invalid','secret',signal));assert.equal(calls.length,3);
});
test('customer API 401 invalidates shared identity while independent admin auth stays separate',async t=>{
 const old=globalThis.window;globalThis.window=new EventTarget();let expired=0;window.addEventListener(ACCOUNT_EXPIRED_EVENT,()=>expired++);
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:401}));
 try{await assert.rejects(requestJson('/api/trips'));assert.equal(expired,1);await assert.rejects(requestJson('/api/admin/v1/session'));assert.equal(expired,1);}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}
});
