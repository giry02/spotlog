import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { if (context.parentURL?.includes('/lib/') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context); return next(specifier, context); } });
const { photoSourceForImage, photoSourceForId, photoSourceFacts, photoSourceLink } = await import('../lib/photo-source.ts');
const { default: snapshot } = await import('../lib/registered-spotlog-snapshot.ts');
const { default: legacyPhotos } = await import('../lib/discovery-legacy-photos.ts');

test('each approved source resolves by exact place and displayed photo, including multiple photos at one place', () => {
  const all = [...snapshot.entries.flatMap(entry => entry.photos), ...legacyPhotos];
  assert.equal(all.length, 80);
  for (const photo of all) {
    assert.equal(photoSourceForImage(photo.placeId, photo.image)?.id, photo.id);
    assert.equal(photoSourceForId(photo.id)?.sourceUrl, photo.sourceUrl);
    assert.equal(photoSourceForImage('unknown-place', photo.image), undefined);
    assert.equal(photoSourceForImage(photo.placeId, '/images/unknown-photo.jpg'), undefined);
  }
  const museum = legacyPhotos.filter(photo => photo.placeId === 'osulloc');
  assert.equal(museum.length, 2);
  assert.notEqual(photoSourceForImage('osulloc', museum[0].image)?.id, photoSourceForImage('osulloc', museum[1].image)?.id);
});

test('rights facts preserve exact authors, original titles, modifications and additional conditions', () => {
  const photo = photoSourceForId('commons-osulloc-museum'), before = JSON.stringify(photo);
  const facts = Object.fromEntries(photoSourceFacts(photo));
  assert.equal(facts['저작자'], photo.author);
  assert.equal(facts['보유·제공 기관'], photo.owner);
  assert.equal(facts['원문 제목'], photo.originalTitle);
  assert.equal(facts['수정·가공 기록'], photo.changes);
  assert.equal(facts['추가 이용 조건'], photo.reuseNote);
  assert.equal(facts['권리 자료 확인일'], photo.verifiedAt);
  assert.equal(JSON.stringify(photo), before);
});

test('missing rights and editing records are not inferred from institution, place title or license', () => {
  const facts = Object.fromEntries(photoSourceFacts({ id: 'missing', placeId: 'p', title: '장소 이름', image: '/missing.svg', owner: '기관' }));
  for (const label of ['저작자', '원문 제목', '이용 허락', '권리 자료 확인일', '원문 제작·게시 시점', '수정·가공 기록', '추가 이용 조건']) assert.equal(facts[label], '등록 자료에 없음');
  assert.equal(facts['보유·제공 기관'], '기관');
});

test('source links only expose explicit HTTP or HTTPS originals', () => {
  assert.equal(photoSourceLink('https://example.org/original?photo=1'), 'https://example.org/original?photo=1');
  for (const value of ['javascript:alert(1)', 'data:text/html,x', '/relative', 'not a url', undefined]) assert.equal(photoSourceLink(value), null);
});
