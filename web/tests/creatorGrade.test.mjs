import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCreatorGrades,creatorGradeRules,currentCreatorGrade,defaultCreatorGrades} from '../src/creatorGrade.ts';
const custom=[{min:0,label:'첫 여행자',shortLabel:'첫 여행',icon:'SPARKLES'},{min:20,label:'바다 안내자',shortLabel:'안내자',icon:'AWARD'}];
const reference={referenceId:'grade-policy',revision:1,category:'GRADE',name:'담김 기준',enabled:true,value:JSON.stringify(custom)};
test('shared creator defaults preserve current customer thresholds and badge names',()=>{
  assert.equal(currentCreatorGrade(9).label,'새싹 기록자');assert.equal(currentCreatorGrade(10).label,'동네 가이드');assert.equal(currentCreatorGrade(5000).label,'Spotlog 마스터');
});
test('a versioned active grade policy changes the same count boundary without modifying any user count',()=>{
  const rules=creatorGradeRules([reference]);assert.equal(currentCreatorGrade(19,rules).label,'첫 여행자');assert.equal(currentCreatorGrade(20,rules).label,'바다 안내자');
  assert.deepEqual(rules,custom);assert.equal(reference.value,JSON.stringify(custom));
});
test('disabled, malformed or multiple active grade versions retain approved defaults',()=>{
  for(const references of [[{...reference,enabled:false}],[{...reference,value:'not json'}],[reference,{...reference,referenceId:'other'}]])assert.deepEqual(creatorGradeRules(references),defaultCreatorGrades);
});
test('grade policies reject unsorted and duplicate thresholds, absent zero tier, injected fields and unknown icons',()=>{
  for(const rules of [[],[{...custom[0],min:1}],[custom[0],{...custom[1],min:0}],[custom[0],{...custom[1],icon:'SCRIPT'}],[{...custom[0],memberId:'inject'}],[{...custom[0],min:0.5}],[{...custom[0],label:''}]])assert.throws(()=>parseCreatorGrades(JSON.stringify(rules)));
  assert.equal(currentCreatorGrade(NaN).min,0);assert.equal(currentCreatorGrade(-1).min,0);
});
