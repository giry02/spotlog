// Local, explicit snapshot import. Never fetches provider APIs or customer data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const appRoot = 'C:/Users/Giry/Documents/Spotlog';
const projectRoot = path.resolve(__dirname, '..');
const assetRoot = path.join(appRoot, 'assets/spotlog');
const publicRoot = path.join(projectRoot, 'public/images/registered-spotlog');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (!file.startsWith(path.join(appRoot, 'web/src') + path.sep)) throw new Error('Module outside approved source root');
  if (cache.has(file)) return cache.get(file).exports;
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const module = { exports: {} }; cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const localRequire = (name) => {
    if (!name.startsWith('.')) throw new Error('External import blocked: ' + name);
    const target = path.resolve(path.dirname(file), name);
    if (/\.(png|jpg|jpeg|webp)$/.test(target)) return target;
    return load(fs.existsSync(target) ? target : target + '.ts');
  };
  vm.runInNewContext('(function(require,module,exports){' + js + '\n})', {}, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const data = load(path.join(appRoot, 'web/src/data.ts'));
const tourism = load(path.join(appRoot, 'web/src/publicTourismContent.ts'));
const business = load(path.join(appRoot, 'web/src/plannerBusinessCatalog.ts'));
const media = load(path.join(appRoot, 'web/src/busanBusinessMedia.ts'));
const licensed = load(path.join(appRoot, 'web/src/licensedPlaceSources.ts'));
const landmarkRecords = load(path.join(appRoot, 'web/src/busanLandmarkRecords.json'));
const sources = [...tourism.publicTourismSources, ...media.busanBusinessPhotoSources, ...licensed.licensedPlaceSources];
const photos = sources.filter((photo) => photo.license === '공공누리 제1유형' || /^CC BY-SA (3|4)\.0$/.test(photo.license)).map((photo) => {
  const original = path.resolve(photo.image);
  if (!original.startsWith(path.resolve(assetRoot) + path.sep) || !fs.statSync(original).isFile()) throw new Error('Asset outside approved root');
  const filename = path.basename(original);
  const bytes = fs.readFileSync(original);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (photo.sha256 && photo.sha256 !== sha256) throw new Error('Photo checksum differs: ' + photo.id);
  return { ...photo, image: '/images/registered-spotlog/' + filename, sha256, copiedAt: '2026-10-18', localSourceFile: 'assets/spotlog/' + path.relative(assetRoot, original).replaceAll('\\', '/'), _original: original };
});
const sourceById = new Map(business.plannerBusinessSources.map((source) => [source.placeId, source]));
for (const place of tourism.publicTourismPlaces) {
  const photo = sources.find((source) => source.placeId === place.id);
  if (photo) sourceById.set(place.id, { provider: photo.owner, providerRecordId: place.id, sourceUrl: photo.coordinateSourceUrl, checkedAt: photo.verifiedAt });
}
for (const place of landmarkRecords) sourceById.set(place.id, { provider: '부산광역시 비짓부산', providerRecordId: place.recordId, sourceUrl: place.sourceUrl, checkedAt: '2026-10-12' });
const originals = data.placeCatalog.filter((place) => sourceById.has(place.id));
const entries = originals.map((place) => ({
  id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address,
  latitude: place.lat, longitude: place.lng,
  description: place.description, note: place.note, tags: place.tags ?? [],
  duration: place.duration,
  source: sourceById.get(place.id),
  photos: photos.filter((photo) => photo.placeId === place.id).map(({_original,...photo}) => photo),
  price: null, openingHours: null, availability: null,
}));
fs.mkdirSync(publicRoot, { recursive: true });
const usedPhotoIds = new Set(entries.flatMap((place) => place.photos.map((photo) => photo.id)));
for (const photo of photos.filter((photo) => usedPhotoIds.has(photo.id))) fs.copyFileSync(photo._original, path.join(publicRoot, path.basename(photo.image)));
const snapshot = { importedAt: '2026-10-18', source: 'Spotlog local working tree: registered official basic facts only; not a live service database', sourceFiles: ['web/src/data.ts','web/src/plannerBusinessCatalog.ts','web/src/regionalBusinessRecords.json','web/src/busanBusinessRecords.json','web/src/busanLandmarkRecords.json','web/src/publicTourismContent.ts','web/src/busanBusinessMedia.ts'], scope: 'name-address-category-coordinate-original-editorial-description-and-licensed-photos', entries };
fs.writeFileSync(path.join(projectRoot, 'lib/registered-spotlog-catalog.json'), JSON.stringify(snapshot, null, 2) + '\n');
fs.writeFileSync(path.join(projectRoot, 'lib/registered-spotlog-snapshot.ts'), '// Generated from the explicit local import script; preserve source and photo rights.\nconst snapshot = ' + JSON.stringify(snapshot, null, 2) + ';\nexport default snapshot;\n');
console.log(JSON.stringify({ entries: entries.length, kinds: entries.reduce((counts, item) => ({...counts,[item.kind]:(counts[item.kind]??0)+1}),{}), photos: usedPhotoIds.size, regions: [...new Set(entries.map((item) => item.area))] },null,2));
