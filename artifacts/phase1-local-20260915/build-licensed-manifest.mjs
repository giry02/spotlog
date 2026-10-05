import fs from 'node:fs';
import crypto from 'node:crypto';
const root = 'C:/Users/Giry/Documents/Spotlog';
const pages = Object.values(JSON.parse(fs.readFileSync(`${root}/artifacts/phase1-local-20260915/commons-candidates.json`, 'utf8').replace(/^\uFEFF/, '')).query.pages);
const rows = [
  ['File:Hyeopjae Beach Scenery.jpg', 'hyeopjae-scenery', 'jeju-hyeopjae', 'Lcarrion88', '협재해수욕장 · 비양도와 백사장', '파도 너머 비양도를 바라보는 협재해변.', '70% 50%'],
  ['File:Hyeopjae.jpg', 'hyeopjae-shore', 'jeju-hyeopjae', 'Lcarrion88', '협재해수욕장 · 현무암 해안', '검은 현무암과 푸른 바다가 맞닿은 협재해변.', '50% 50%'],
  ["File:O'Sulloc Tea Museum, Jeju (오설록 녹차박물관, 제주) - panoramio.jpg", 'osulloc-museum', 'jeju-osulloc', '골뱅이 (IM Seongbin)', '오설록 티뮤지엄 · 건물 전경', '오설록 티뮤지엄의 과거 전경. 현재 시설 모습은 다를 수 있어요.', '55% 50%'],
  ["File:Camellia Sinensis, O'Sulloc Tea Museum, Jeju (차나무, 오설록 녹차박물관, 제주) - panoramio.jpg", 'osulloc-tea', 'jeju-osulloc', '골뱅이 (IM Seongbin)', '오설록 티뮤지엄 · 차나무', '오설록에서 가까이 바라본 차나무와 찻잎.', '50% 50%'],
  ['File:Sagye Beach 01.jpg', 'sagye-coast', 'jeju-sagye', 'Grapesurgeon', '사계해안 · 산방산과 해변', '사계해변 너머로 보이는 산방산과 해안 풍경.', '33% 50%'],
  ['File:Sagye Beach 03.jpg', 'sagye-rocks', 'jeju-sagye', 'Grapesurgeon', '사계해안 · 바위와 바다', '사계의 바위 해안에서 바라본 바다.', '50% 50%'],
  ['File:새별오름.jpg', 'saebyeol-autumn', 'jeju-saebyeol', 'HiHoHo', '새별오름 · 가을 억새와 노을', '억새 사이로 이어지는 새별오름의 가을 산책길.', '50% 50%'],
  ['File:Saebyeol Oreum 01.jpg', 'saebyeol-ridge', 'jeju-saebyeol', 'Grapesurgeon', '새별오름 · 봄 전경', '잔디 너머로 바라본 새별오름의 봄 능선.', '43% 50%'],
  ['File:Seoulforest path01.jpg', 'seoulforest-path', 'seoul-seoulforest', 'Enigma7seven', '서울숲 · 가을 산책길', '낙엽이 내려앉은 서울숲의 산책길.', '50% 50%'],
  ['File:Anmok Beach 20220430 001.jpg', 'anmok-beach', 'gangneung-anmok', 'Mobius6', '안목해변 · 해변 전망대', '바다를 바라보는 안목해변의 전망대.', '50% 50%'],
];
const provenance = rows.map(([fileTitle, slug, placeId, author, title, caption, objectPosition]) => {
  const page = pages.find(page => page.title === fileTitle);
  if (!page) throw new Error(`Missing metadata: ${fileTitle}`);
  const info = page.imageinfo[0], meta = info.extmetadata;
  const path = `assets/spotlog/licensed-places/${slug}.jpg`;
  return {id:`commons-${slug}`,placeId,title,originalTitle:fileTitle.slice(5),path,sourceUrl:info.descriptionurl,imageSourceUrl:info.url,
    downloadUrl:(info.thumburl || info.url).split('?')[0],owner:'Wikimedia Commons',author,license:meta.LicenseShortName.value,licenseUrl:meta.LicenseUrl.value.replace(/^http:/,'https:'),
    verifiedAt:'2026-09-15',publishedAt:slug.startsWith('osulloc')?'2010-12-12 (원본 최초 업로드일 · 촬영일 미상)':meta.DateTimeOriginal.value.replace(/<[^>]*>/g,''),
    changes:`${info.thumburl && info.thumbwidth < info.width ? 'Wikimedia Commons 제공 축소본' : '원본 파일'} 사용. 파일 추가 편집 없음. 화면 비율에 따라 일부가 잘려 보일 수 있습니다.`,
    reuseNote:'저작자와 출처·이용허락 링크를 표시해야 합니다. 사진을 수정하여 공유할 때에는 동일한 이용허락 조건을 따라야 합니다.',
    caption,objectPosition,bytes:fs.statSync(`${root}/${path}`).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(`${root}/${path}`)).digest('hex')};
});
const imports = provenance.map((p,i)=>`import photo${i} from '../../${p.path}';`).join('\n');
const entries = provenance.map(({path,downloadUrl,bytes,sha256,...p},i)=>`  { ...${JSON.stringify(p,null,2)}, image: photo${i} }`).join(',\n');
const destination = `${root}/web/src/licensedPlaceSources.ts`;
if(fs.existsSync(destination)) throw new Error('Manifest module already exists');
fs.writeFileSync(destination,`import type { PhotoSource } from './photoSources';\n${imports}\n\n/** Actual place photos; original attribution and licenses are per asset. */\nexport const licensedPlaceSources: PhotoSource[] = [\n${entries}\n];\n`);
fs.writeFileSync(`${root}/assets/spotlog/licensed-places/ATTRIBUTION.json`,JSON.stringify(provenance,null,2)+'\n');
console.log(`Prepared ${provenance.length} photos, ${provenance.reduce((n,p)=>n+p.bytes,0)} bytes`);
