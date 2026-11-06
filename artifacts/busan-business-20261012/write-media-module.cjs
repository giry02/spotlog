const fs = require('node:fs');
const path = require('node:path');
const root = 'C:/Users/Giry/Documents/Spotlog';
const manifestPath = path.join(root, 'assets/spotlog/busan-business/ATTRIBUTION.json');
const allEntries = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
// The street from a café window is not an identifying café cover; the Namaste
// coordinate conflict remains excluded until its exact branch is confirmed.
const entries = allEntries.filter(entry => entry.placeId !== 'catalog-busan-namaste' && entry.id !== 'busan-business-metadata002340');
const imports = entries.map((entry, index) => `import photo${index} from '../../assets/spotlog/busan-business/${entry.asset}';`).join('\n');
const sourceRows = entries.map((entry, index) => {
  const { asset, address, ...credit } = entry;
  return `  { ...${JSON.stringify(credit, null, 2).replace(/\n/g, '\n  ')}, image: photo${index} }`;
});
const preferred = {
  'catalog-busan-geumsu': 'busan-business-metadata012472',
  'catalog-busan-bibibidang': 'busan-business-metadata002464',
  'catalog-busan-blackup-saha': 'busan-business-metadata002341',
  'catalog-busan-kappadokia': 'busan-business-metadata012705',
  'public-busan-huinnyeoul': 'busan-business-metadata006339',
};
const source = `${imports}
import type { PhotoSource } from './photoSources';
import type { PlacePhotoInput } from './placePhotos';

/** Individual KOGL type1 photos, verified against the exact branch address. */
export const busanBusinessPhotoSources: PhotoSource[] = [
${sourceRows.join(',\n')}
];

export interface BusanPlaceMedia { image: string; photos: PlacePhotoInput[] }
const preferredCoverById: Record<string, string> = ${JSON.stringify(preferred, null, 2)};
const mediaById: Record<string, BusanPlaceMedia> = {};
for (const source of busanBusinessPhotoSources) {
  const media = mediaById[source.placeId] ??= { image: '', photos: [] };
  media.photos.push({ mediaId: source.id, sourceId: source.id, placeId: source.placeId,
    image: source.image, alt: source.title, caption: source.title, availability: 'available' });
}
for (const [placeId, media] of Object.entries(mediaById)) {
  const preferredId = preferredCoverById[placeId];
  if (preferredId) media.photos.sort((a, b) => Number(b.sourceId === preferredId) - Number(a.sourceId === preferredId));
  media.image = media.photos[0]?.image ?? '';
}
export const busanBusinessMediaById: Record<string, BusanPlaceMedia> = Object.fromEntries(
  Object.entries(mediaById).filter(([placeId]) => placeId.startsWith('catalog-')));
export const busanLandmarkMediaById: Record<string, BusanPlaceMedia> = Object.fromEntries(
  Object.entries(mediaById).filter(([placeId]) => placeId.startsWith('public-')));
`;
fs.writeFileSync(path.join(root, 'web/src/busanBusinessMedia.ts'), source);
fs.writeFileSync(path.join(root, 'artifacts/busan-business-20261012/media-summary.json'), JSON.stringify({
  licensedImages: entries.length,
  businessCount: new Set(entries.filter(e => e.placeId.startsWith('catalog-')).map(e => e.placeId)).size,
  landmarkCount: new Set(entries.filter(e => e.placeId.startsWith('public-')).map(e => e.placeId)).size,
  totalBytes: entries.reduce((sum, entry) => sum + fs.statSync(path.join(root, 'assets/spotlog/busan-business', entry.asset)).size, 0),
  places: [...new Set(entries.map(entry => entry.placeId))],
}, null, 2));
console.log('Registered photos:', entries.length);
