import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlacePhotos, activePhotoIndex } from '../src/placePhotos.ts';

const place = { id: 'a', name: '테스트 장소', image: '/cover.jpg', motionImages: ['/other-place.jpg'] };
const photo = (mediaId, extra = {}) => ({ mediaId, placeId: 'a', image: `/${mediaId}.jpg`, alt: `${mediaId} 설명`, caption: `${mediaId} 캡션`, sourceId: `${mediaId}-source`, ...extra });

test('legacy cover is opt-in and motion photos never populate a gallery', () => {
  assert.deepEqual(resolvePlacePhotos(place), []);
  assert.equal(resolvePlacePhotos(place, [], true)[0].image, place.image);
  assert.deepEqual(resolvePlacePhotos({ ...place, image: '' }, [], true), []);
});
test('explicit empty, withdrawn and wrong-place photos never resurrect samples or covers', () => {
  for (const photos of [[], [photo('a', { availability: 'withdrawn' })], [photo('a', { placeId: 'another' })]]) {
    assert.deepEqual(resolvePlacePhotos({ ...place, photos }, [photo('sample')], true), []);
  }
});
test('media identity and matching credit/caption survive reorder, URL updates and removal', () => {
  const initial = resolvePlacePhotos({ ...place, photos: [photo('first'), photo('second')] });
  const selected = initial[1].mediaId;
  const reordered = resolvePlacePhotos({ ...place, photos: [photo('second', { image: '/new.jpg' }), photo('first')] });
  assert.equal(activePhotoIndex(reordered, selected), 0);
  assert.equal(reordered[0].sourceId, 'second-source');
  assert.equal(reordered[0].caption, 'second 캡션');
  assert.equal(activePhotoIndex([initial[0]], selected), 0);
  assert.equal(activePhotoIndex([], selected), 0);
});
test('legacy media gets deterministic IDs, duplicates collapse and usable photos cap at five', () => {
  const legacy = { image: '/same.jpg', alt: '', caption: '' };
  const resolved = resolvePlacePhotos({ ...place, photos: [legacy, legacy, ...Array.from({ length: 7 }, (_, i) => photo(`p${i}`))] });
  assert.equal(resolved.length, 5);
  assert.equal(resolved[0].mediaId, resolvePlacePhotos({ ...place, photos: [legacy] })[0].mediaId);
  assert.equal(resolved[0].placeId, 'a');
});
