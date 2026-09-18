import test from 'node:test';
import assert from 'node:assert/strict';
import { photoCaptionWithoutDuplicateCredit } from '../src/photoCaption.ts';

const source = { owner: '부산광역시', author: '개별 촬영자 미표기', license: '공공누리 제1유형' };
const caption = '동백섬 산책로의 모습입니다.\n사진: 부산광역시 · 공공누리 제1유형';
test('known trailing duplicate is removed for display without changing stored text or metadata', () => {
  const record = { caption, source: { ...source } }; const before = structuredClone(record);
  assert.equal(photoCaptionWithoutDuplicateCredit(record.caption, record.source), '동백섬 산책로의 모습입니다.');
  assert.deepEqual(record, before);
  assert.equal(photoCaptionWithoutDuplicateCredit(caption.replace('\n', '\r\n'), source), '동백섬 산책로의 모습입니다.');
});
test('separate credited author and equal owner/author match their exact legacy suffix only', () => {
  assert.equal(photoCaptionWithoutDuplicateCredit('해운대 사진\n사진: 부산광역시 · 촬영자 이름 · 공공누리 제1유형', { ...source, author: '촬영자 이름' }), '해운대 사진');
  assert.equal(photoCaptionWithoutDuplicateCredit(caption, { ...source, author: source.owner }), '동백섬 산책로의 모습입니다.');
});
test('missing source never hides an attribution; mismatched/custom captions remain intact', () => {
  assert.equal(photoCaptionWithoutDuplicateCredit(caption), caption);
  assert.equal(photoCaptionWithoutDuplicateCredit(caption, { ...source, owner: '다른 기관' }), caption);
  assert.equal(photoCaptionWithoutDuplicateCredit(caption, { ...source, license: '다른 이용조건' }), caption);
  for (const text of ['직접 쓴 사진 설명', '사진: 부산광역시 · 공공누리 제1유형', `${caption}\n내가 덧붙인 메모`, '사진: 내가 직접 촬영']) assert.equal(photoCaptionWithoutDuplicateCredit(text, source), text);
});
test('empty and multiline descriptions are handled without inventing caption text', () => {
  assert.equal(photoCaptionWithoutDuplicateCredit(undefined, source), '');
  assert.equal(photoCaptionWithoutDuplicateCredit('', source), '');
  assert.equal(photoCaptionWithoutDuplicateCredit('첫째 줄\n둘째 줄\n사진: 부산광역시 · 공공누리 제1유형', source), '첫째 줄\n둘째 줄');
});
