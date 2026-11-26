import assert from 'node:assert/strict';
import test from 'node:test';
import { googleDirectionsUrl, naverDirectionsUrl } from '../src/placeDirections.ts';

test('Google directions request the selected mode and let Maps resolve the starting location', () => {
  const place = { name: '부산 가족여행', address: '부산 동구', lat: 35.1151, lng: 129.0415 };
  for (const mode of ['walking', 'driving', 'transit']) {
    const url = new URL(googleDirectionsUrl(place, mode));
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.pathname, '/maps/dir/');
    assert.equal(url.searchParams.get('api'), '1');
    assert.equal(url.searchParams.get('destination'), '35.1151,129.0415');
    assert.equal(url.searchParams.get('travelmode'), mode);
    assert.equal(url.searchParams.has('origin'), false);
  }
  assert.equal(new URL(googleDirectionsUrl(place)).searchParams.has('travelmode'), false);
});

test('Unverified, blank or out-of-bounds coordinates fall back to the destination text', () => {
  for (const coords of [{ lat: 0, lng: 0 }, { lat: 91, lng: 4 }, { lat: 35, lng: 129, locationVerified: false }, {}]) {
    const place = { name: '해운대 카페 & 정원', address: '부산 해운대구', ...coords };
    const google = new URL(googleDirectionsUrl(place, 'walking'));
    assert.equal(google.searchParams.get('destination'), '해운대 카페 & 정원 부산 해운대구');
    const naver = new URL(naverDirectionsUrl(place));
    assert.equal(naver.hostname, 'map.naver.com');
    assert.equal(decodeURIComponent(naver.pathname), '/p/search/해운대 카페 & 정원 부산 해운대구');
  }
});

test('Text-only meeting points use their region and empty destinations have no action', () => {
  const url = new URL(googleDirectionsUrl({ name: '부산역 2번 출구', area: '부산' }, 'transit'));
  assert.equal(url.searchParams.get('destination'), '부산역 2번 출구 부산');
  assert.equal(googleDirectionsUrl({ name: ' ' }), null);
  assert.equal(googleDirectionsUrl({ name: '가'.repeat(300) }, 'driving'), null);
});
