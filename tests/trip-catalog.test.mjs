import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/(trip-data|business-details|travel-links)\.ts$/.test(
        context.parentURL ?? '',
      ) &&
      specifier.startsWith('./') &&
      !specifier.endsWith('.ts')
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const { places, legacyPlaces, restaurants } =
  await import('../lib/connected-data.ts');
const { stays, scenarios } = await import('../lib/trip-data.ts');
const { businessDetails, businessReasons } =
  await import('../lib/business-details.ts');
const { mapLinks, nearbyMapSearch } = await import('../lib/travel-links.ts');
const credits = JSON.parse(
  readFileSync(new URL('../lib/photo-credits.json', import.meta.url), 'utf8'),
);
const asset = (path) => new URL('../public' + path, import.meta.url);

test('Jeju catalog spans three areas and every anchor has food, cafe and stay coverage', () => {
  const jeju = places.filter((p) => p.region === '제주');
  assert.equal(jeju.length, 12);
  assert.deepEqual(
    new Set(jeju.map((p) => p.area)),
    new Set(['west', 'east', 'south']),
  );
  assert.equal(new Set(places.map((p) => p.id)).size, places.length);
  assert.equal(new Set(restaurants.map((p) => p.id)).size, restaurants.length);
  assert.equal(new Set(stays.map((p) => p.id)).size, stays.length);
  for (const place of jeju) {
    assert.ok(place.district && place.durationMinutes > 0, place.id);
    assert.ok(
      restaurants.some((r) => r.placeId === place.id && r.cuisine !== '카페'),
      place.id + ' meal',
    );
    assert.ok(
      restaurants.some((r) => r.placeId === place.id && r.cuisine === '카페'),
      place.id + ' cafe',
    );
    assert.ok(
      stays.some((s) => s.region === place.region && s.near.includes(place.id)),
      place.id + ' stay',
    );
    assert.match(
      place.sourceUrl,
      /^https:\/\/www\.visitjeju\.net\/kr\/detail\/view\?contentsid=/,
    );
    assert.equal(place.sourceVerifiedAt, '2026-10-12');
  }
  assert.equal(scenarios.length, 6);
  assert.deepEqual(
    legacyPlaces.map((p) => p.id),
    ['osulloc', 'seoulforest', 'saebyeol', 'hyeopjae'],
  );
  assert.ok(legacyPlaces.every((p) => places.includes(p)));
});

test('all landmark photographs have matching files, credits and content hashes', () => {
  assert.equal(new Set(credits.map((c) => c.id)).size, credits.length);
  assert.equal(new Set(credits.map((c) => c.path)).size, credits.length);
  for (const place of places) {
    const credit = credits.find((c) => c.id === place.credit);
    assert.ok(credit, place.id + ' credit');
    assert.ok(existsSync(asset(place.image)), place.id + ' image');
    const bytes = readFileSync(asset(place.image));
    assert.equal(bytes.length, credit.bytes, place.id + ' byte count');
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      credit.sha256,
      place.id + ' provenance',
    );
    assert.ok(
      credit.path.endsWith(place.image.slice('/images/'.length)),
      place.id + ' matching filename',
    );
    assert.ok(
      credit.author && credit.license && credit.changes && credit.reuseNote,
      place.id + ' attribution',
    );
    assert.match(credit.sourceUrl, /^https:\/\/commons\.wikimedia\.org\//);
    assert.match(credit.licenseUrl, /^https:\/\/creativecommons\.org\//);
  }
});

test('every catalog business has a valid explicit sample detail sheet and landmark referent', () => {
  for (const item of restaurants) {
    assert.ok(
      places.some((p) => p.id === item.placeId),
      item.id + ' anchor',
    );
    const details = businessDetails({ kind: 'food', id: item.id });
    assert.ok(details, item.id);
    assert.equal(details.primary, item.menu);
    assert.ok(details.menu.length >= 2, item.id + ' menu');
    assert.ok(existsSync(asset(details.image)), item.id + ' category photo');
    assert.match(details.description, /설정|가상/);
    const reasons = businessReasons(
      { kind: 'food', id: item.id },
      {
        anchorId: 'hyeopjae',
        region: '제주',
        plan: [],
        editingId: null,
        activeDay: 1,
      },
    );
    assert.ok(
      reasons[0].includes(places.find((p) => p.id === item.placeId).name),
      item.id + ' own place context',
    );
  }
  for (const item of stays) {
    assert.ok(item.near.length > 0, item.id + ' coverage');
    assert.ok(
      item.near.every((id) =>
        places.some((p) => p.id === id && p.region === item.region),
      ),
      item.id + ' anchors',
    );
    const details = businessDetails({ kind: 'stay', id: item.id });
    assert.ok(details?.room, item.id);
    assert.ok(existsSync(asset(details.image)), item.id + ' category photo');
    assert.match(details.description, /설정|가상/);
  }
  assert.equal(
    businessDetails({ kind: 'food', id: 'not-in-catalog' }),
    undefined,
  );
  assert.equal(
    businessDetails({ kind: 'stay', id: 'not-in-catalog' }),
    undefined,
  );
});

test('each landmark has named map links and all nearby search actions', () => {
  for (const place of places) {
    const links = mapLinks(place.id);
    assert.ok(links, place.id);
    const query = new URL(links.directions).searchParams.get('destination');
    assert.ok(
      query.includes(place.name) ||
        (place.id === 'hyeopjae' && query.includes('협재해변')),
      place.id + ' named destination',
    );
    assert.ok(links.kakao.startsWith('https://map.kakao.com/link/search/'));
    assert.ok(links.naver.startsWith('https://map.naver.com/p/search/'));
    for (const kind of ['식당', '카페', '숙소']) {
      assert.ok(
        decodeURIComponent(nearbyMapSearch(place.id, kind)).endsWith(
          ' ' + kind,
        ),
        place.id + ' ' + kind,
      );
    }
  }
  assert.equal(mapLinks('not-in-catalog'), null);
});
