import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSavedEditor } from '../src/admin/editorialSave.ts';

test('unchanged submitted input adopts canonical accepted data without mutating either snapshot', () => {
  const before = { revision: 2, title: '초안', days: [{ dayId: 'day:1', introduction: '소개' }] };
  const saved = { ...structuredClone(before), revision: 3, title: '확인한 제목', sourceKind: 'EDITORIAL' };
  const result = mergeSavedEditor(before, structuredClone(before), saved);
  assert.deepEqual(result.value, saved); assert.equal(result.hasLaterInput, false);
  result.value.days[0].introduction = '입력 중'; assert.equal(saved.days[0].introduction, '소개'); assert.equal(before.revision, 2);
});

test('text and DAY input typed while saving survives and receives the accepted revision', () => {
  const before = { revision: 4, title: '부산 여행', introduction: '제출한 소개', visibility: 'PRIVATE', days: [{ dayId: 'day:1', visits: [{ visitId: 'visit:1', placeId: 'place:1', introduction: '장소 소개' }] }] };
  const current = structuredClone(before); current.title = '저장 중에 바꾼 제목'; current.days[0].visits[0].introduction = '저장 중 작성한 장소 소개';
  const saved = { ...structuredClone(before), revision: 5, introduction: '서버가 확인한 소개', visibility: 'PUBLIC' };
  const result = mergeSavedEditor(before, current, saved);
  assert.equal(result.hasLaterInput, true); assert.equal(result.value.revision, 5); assert.equal(result.value.title, current.title);
  assert.equal(result.value.introduction, saved.introduction); assert.equal(result.value.visibility, 'PUBLIC');
  assert.deepEqual(result.value.days, current.days); assert.equal(current.revision, 4);
});

test('region input after submission remains editable while accepted metadata is retained', () => {
  const before = { revision: 1, regionId: 'region:a', name: '해운대', parentId: 'kr-busan', level: 'DISTRICT', enabled: true };
  const current = { ...before, name: '새로 입력한 지역 이름' };
  const saved = { ...before, revision: 2 };
  assert.deepEqual(mergeSavedEditor(before, current, saved).value, { ...saved, name: current.name });
});
