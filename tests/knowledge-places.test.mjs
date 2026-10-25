import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';

registerHooks({
  resolve(specifier, context, next) {
    if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier))
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const { places: originalPlaces, restaurants } = await import('../lib/connected-data.ts');
const { places, findPlace } = await import('../lib/trip-data.ts');
const { knowledgePlaces } = await import('../lib/knowledge-places.ts');
const { jejuKnowledgeDocuments } = await import('../lib/jeju-knowledge.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { mapLinks, nearbyMapSearch } = await import('../lib/travel-links.ts');
const { registeredPlaces } = await import('../lib/registered-catalog.ts');

test('every official Jeju destination resolves to an itinerary card without adding sample businesses or duplicate RAG documents', () => {
  const sourceIds = [...new Set(jejuKnowledgeDocuments.map((doc) => doc.placeId))].filter((id) => id !== 'jeju-general');
  assert.equal(sourceIds.length, 28);
  assert.equal(knowledgePlaces.length, 16);
  assert.equal(places.length, 29 + registeredPlaces.length);
  assert.equal(new Set(places.map((place) => place.id)).size, places.length);
  assert.equal(originalPlaces.length, 13);
  assert.ok(ragCatalog().length >= 75);
  for (const id of sourceIds) assert.equal(findPlace(id)?.region, '제주', id);
  assert.ok(knowledgePlaces.every((place) => !restaurants.some((business) => business.placeId === place.id)));
});

test('additional itinerary cards retain exact official source text and have no fabricated timing or admission facts', () => {
  for (const place of knowledgePlaces) {
    const overview = jejuKnowledgeDocuments.find((doc) => doc.id === `jeju-${place.id}-overview`);
    const visit = jejuKnowledgeDocuments.find((doc) => doc.id === `jeju-${place.id}-visit`);
    assert.equal(place.description, overview.text, place.id + ' sourced description');
    assert.equal(place.visitNote, visit.text, place.id + ' sourced conditions');
    assert.equal(place.sourceUrl, overview.sourceUrl);
    assert.equal(place.sourceVerifiedAt, overview.checkedAt);
    assert.equal(place.knowledgeSource, 'curated-official-summary');
    assert.deepEqual(place.knowledgeDocumentIds, [overview, visit].map((doc) => `moa-knowledge:${doc.id}`));
    assert.deepEqual(place.planning.conditions, [visit.text]);
    assert.equal(place.durationMinutes, 0);
    assert.match(place.planningNote, /미산정/);
    assert.equal(place.imageKind, 'illustration');
    const asset = new URL('../public' + place.image, import.meta.url);
    assert.ok(existsSync(asset));
    assert.match(readFileSync(asset, 'utf8'), /실제 장소 사진이 없는/);
  }
  assert.equal(findPlace('hallasan').planning.dayScope, 'full-day');
  assert.equal(findPlace('udo').planning.dayScope, 'full-day');
  assert.equal(findPlace('geomunoreum').planning.dayScope, 'half-day');
  assert.equal(findPlace('hallasan').area, 'central');
  assert.equal(findPlace('jejumuseum').area, 'north');
});

test('additional destination map searches use known names without invented coordinates or street addresses', () => {
  for (const place of knowledgePlaces) {
    const links = mapLinks(place.id);
    assert.ok(links, place.id);
    assert.equal(new URL(links.directions).searchParams.get('destination'), `${place.name} 제주`);
    for (const kind of ['식당', '카페', '숙소'])
      assert.ok(decodeURIComponent(nearbyMapSearch(place.id, kind)).endsWith(`${place.name} 제주 ${kind}`));
  }
  assert.equal(mapLinks('unknown-injected-id'), null);
  assert.equal(nearbyMapSearch('unknown-injected-id', '식당'), null);
});
