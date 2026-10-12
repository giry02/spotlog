import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'assets/spotlog/busan-business/ATTRIBUTION.json'), 'utf8'));
const mediaFile = resolve(root, 'web/src/busanBusinessMedia.ts');
const sourceFixtureDirectory = resolve(root, 'web/tests/fixtures/busan-media-sources');
const sourceFixtureIndex = JSON.parse(readFileSync(resolve(sourceFixtureDirectory, 'sources.json'), 'utf8'));
function loadMedia() {
  const compiled = ts.transpileModule(readFileSync(mediaFile, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(specifier => {
    const filename = resolve(root, 'web/src', specifier);
    assert.ok(existsSync(filename));
    return filename;
  }, module, module.exports);
  return module.exports;
}

test('registered Busan photos retain individual commercial reuse conditions, authors and exact sources', () => {
  const ids = new Set();
  assert.ok(manifest.filter(row => row.placeId.startsWith('catalog-')).length >= 40);
  for (const source of manifest) {
    assert.equal(source.license, '공공누리 제1유형');
    assert.ok(source.id && source.author && source.owner && source.originalTitle && source.verifiedAt && source.changes);
    assert.equal(new URL(source.sourceUrl).hostname, 'visitbusan.net');
    assert.equal(new URL(source.imageSourceUrl).hostname, 'visitbusan.net');
    assert.equal(new URL(source.licenseUrl).hostname, 'www.kogl.or.kr');
    assert.ok(!ids.has(source.id)); ids.add(source.id);
    const recordId = new URL(source.sourceUrl).searchParams.get('dataSid');
    const page = readFileSync(resolve(sourceFixtureDirectory, `${recordId}.html`), 'utf8').replace(/\r\n/g, '\n');
    const provenance = sourceFixtureIndex[recordId];
    assert.ok(provenance, `${recordId}: missing source provenance`);
    assert.equal(provenance.sourceUrl, source.sourceUrl);
    assert.equal(provenance.verifiedAt, source.verifiedAt);
    assert.match(provenance.originalHtmlSha256, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(page).digest('hex'), provenance.fixtureSha256);
    assert.ok(page.includes(`Original HTML SHA256: ${provenance.originalHtmlSha256}`));
    assert.ok(Buffer.byteLength(page) < 10_000);
    assert.doesNotMatch(page, /<script\b|<img\b|\son\w+\s*=|descriptionText/i);
    assert.equal(page.match(/<div class="viewTitleBox">([\s\S]*?)<\/div>/)?.[1].trim(), source.originalTitle);
    assert.equal(page.match(/<div class="ggnrTxt">[\s\S]*?<span>(.*?)<\/span>/)?.[1].trim(), '공공누리 제1유형 : 출처표시');
    assert.equal(page.match(/<div class="cateName">제작자<\/div>\s*<div class="cateCont">([\s\S]*?)<\/div>/)?.[1].trim(), source.author);
    assert.equal(page.match(/<div class="cateName">발행자<\/div>\s*<div class="cateCont">([\s\S]*?)<\/div>/)?.[1].trim(), source.owner);
    if (source.address) assert.equal(page.match(/<div class="adrsContWrap">\s*<div>(.*?)<\/div>/)?.[1].trim(), source.address);
  }
});

test('web photo assets are real optimized WebP files with preserved integrity and bounded transfer size', () => {
  let total = 0;
  const hashes = new Set();
  for (const source of manifest) {
    const filename = resolve(root, 'assets/spotlog/busan-business', source.asset);
    const bytes = readFileSync(filename);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(statSync(filename).size < 500_000);
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(source.sha256, hash);
    assert.ok(!hashes.has(hash), 'gallery items must not repeat an identical asset'); hashes.add(hash);
    total += bytes.length;
  }
  assert.ok(total < 10_000_000);
});

test('gallery identities match their exact branch and every displayed image has one attribution', () => {
  const { busanBusinessPhotoSources, busanBusinessMediaById, busanLandmarkMediaById } = loadMedia();
  const sources = new Map(busanBusinessPhotoSources.map(source => [source.id, source]));
  for (const [placeId, media] of Object.entries({ ...busanBusinessMediaById, ...busanLandmarkMediaById })) {
    assert.equal(media.image, media.photos[0].image);
    assert.ok(media.photos.length >= 1 && media.photos.length <= 5);
    for (const photo of media.photos) {
      const credit = sources.get(photo.sourceId);
      assert.ok(credit);
      assert.equal(photo.placeId, placeId);
      assert.equal(credit.placeId, placeId);
      assert.equal(photo.image, credit.image);
      assert.equal(photo.mediaId, credit.id);
    }
  }
  assert.ok(manifest.filter(s => s.placeId === 'catalog-busan-momos-yeongdo').every(s => s.address.includes('봉래나루로 160')));
  assert.ok(manifest.filter(s => s.placeId === 'catalog-busan-blackup-saha').every(s => s.address.includes('낙동남로1233번길 30')));
  assert.equal(busanBusinessMediaById['catalog-busan-momos'], undefined, 'the Yeongdo photo cannot stand in for Oncheonjang');
  assert.equal(busanBusinessMediaById['catalog-busan-blackup'], undefined, 'the Saha photo cannot stand in for Seomyeon');
});

test('excluded noncommercial media and coordinate conflicts stay outside the active asset registry', () => {
  const sources = loadMedia().busanBusinessPhotoSources;
  assert.ok(!sources.some(source => source.placeId === 'catalog-busan-namaste'));
  assert.ok(!sources.some(source => /METADATA019634|METADATA017594|METADATA000373|METADATA000405/i.test(source.id)));
  assert.ok(!sources.some(source => /metadata002340/i.test(source.id)), 'a café window street view is not its identifying cover');
});
