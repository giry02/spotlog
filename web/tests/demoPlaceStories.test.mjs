import assert from 'node:assert/strict';
import test from 'node:test';
import { compareDemoPlaceReviews, getDemoPlaceReview, selectDemoSponsoredPlace } from '../src/demoPlaceReviewData.ts';

const place = (id, kind = 'CAFE', area = '부산 기장') => ({ id, kind, area });
const waveon = place('catalog-busan-waveon');
const hanok = place('catalog-busan-hanok');
const seaAndTree = place('catalog-busan-sea-and-tree');
const shilla = place('catalog-busan-shilla-stay', 'STAY', '부산 해운대');

test('recognizes the same example venue through canonical and itinerary IDs', () => {
  assert.deepEqual(getDemoPlaceReview(waveon), getDemoPlaceReview(place('busan-waveon')));
  assert.equal(getDemoPlaceReview({ ...waveon, personal: true }), undefined);
  assert.equal(getDemoPlaceReview(place('unknown')), undefined);
});

test('example place ratings and counts reflect the accompanying reviewers and replies', () => {
  for (const business of [waveon, hanok, seaAndTree, shilla, place('catalog-busan-haemok', 'FOOD', '부산 해운대')]) {
    const review = getDemoPlaceReview(business);
    assert.equal(review.reviewCount, review.comments.length);
    assert.equal(review.rating, Number((review.comments.reduce((sum, comment) => sum + comment.rating, 0) / review.reviewCount).toFixed(1)));
    assert.equal(new Set(review.comments.map(comment => comment.author)).size, review.reviewCount);
    assert.ok(review.comments.some(comment => comment.replies?.length >= 2));
  }
});

test('orders higher reviewed places first and keeps the original order for ties', () => {
  const missing = place('unknown');
  assert.deepEqual([seaAndTree, missing, hanok, waveon].sort(compareDemoPlaceReviews), [hanok, waveon, seaAndTree, missing]);
  assert.equal(compareDemoPlaceReviews(waveon, { ...waveon }), 0);
  assert.ok(getDemoPlaceReview(waveon).reviewCount > getDemoPlaceReview(hanok).reviewCount);
});

test('advertising respects the kind and area, leaves ranked places untouched and excludes the first organic place', () => {
  const catalogue = [hanok, shilla, seaAndTree, waveon];
  const ranked = [waveon, hanok];
  assert.equal(selectDemoSponsoredPlace(ranked, catalogue), seaAndTree);
  assert.deepEqual(ranked, [waveon, hanok]);
  assert.equal(selectDemoSponsoredPlace([waveon, hanok, seaAndTree], catalogue), hanok);
  assert.equal(selectDemoSponsoredPlace([hanok], [{ ...seaAndTree, personal: true }, shilla]), undefined);
  assert.equal(selectDemoSponsoredPlace([{ ...waveon, area: '서울 강남' }], catalogue), undefined);
});
