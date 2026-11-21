import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCreationResumePhase } from '../src/together/groupCreation.ts';

test('reopening a draft after clearing its optional introduction stays in the editor and does not regenerate it', () => {
  const edited = { name:'주말 산책', introduction:'' };
  assert.equal(groupCreationResumePhase(edited,'DRAFT'),'DRAFT');
  assert.deepEqual(edited,{name:'주말 산책',introduction:''});
  assert.equal(groupCreationResumePhase({name:'',introduction:''},'DRAFT'),'DRAFT');
});

test('an explicit input-phase draft and legacy callers retain their original opening behavior', () => {
  assert.equal(groupCreationResumePhase({name:'이름만 적음',introduction:''},'INPUT'),'INPUT');
  assert.equal(groupCreationResumePhase({name:'미리 채운 이름',introduction:'미리 채운 소개'},'INPUT'),'INPUT');
  assert.equal(groupCreationResumePhase({name:'기존 초안',introduction:'작성한 소개'}),'DRAFT');
  assert.equal(groupCreationResumePhase({name:'이름만 적음'}),'INPUT');
});
