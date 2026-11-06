import test from 'node:test';
import assert from 'node:assert/strict';
import { afterSheetClose } from '../src/sheetNavigation.ts';
function host(state={spotlogSheet:'s',tab:'saved'}) {
 const listeners=new Set();let timeout;
 return { history:{state}, addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn),setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:()=>{timeout=undefined;},pop(state){for(const fn of [...listeners])fn({state});},expire(){timeout?.();},get size(){return listeners.size;} };
}
test('sheet close navigates only once at the original content and ignores nested sheet history',()=>{
 const h=host();let count=0;afterSheetClose(h,s=>s?.tab==='saved',()=>count++);
 h.pop({tab:'saved',spotlogSheet:'s'});assert.equal(count,0);h.pop({tab:'saved'});h.pop({tab:'saved'});assert.equal(count,1);assert.equal(h.size,0);
});
test('account/route revocation, explicit cancellation and missing close event never cause delayed navigation',()=>{
 let count=0;const h=host();afterSheetClose(h,()=>false,()=>count++);h.pop({tab:'home'});assert.equal(count,0);
 const h2=host();const cancel=afterSheetClose(h2,()=>true,()=>count++);cancel();h2.pop({tab:'saved'});assert.equal(count,0);
 const h3=host();afterSheetClose(h3,()=>true,()=>count++);h3.expire();h3.pop({tab:'saved'});assert.equal(count,0);assert.equal(h3.size,0);
});
test('a normal content entry navigates immediately without inserting history',()=>{
 const h=host({tab:'saved'});let count=0;afterSheetClose(h,()=>true,()=>count++);assert.equal(count,1);assert.equal(h.size,0);
});
