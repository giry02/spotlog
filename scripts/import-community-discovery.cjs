// Only bundled public editorial code and already approved photo identities.
// This importer never reads browser stores, account records or provider APIs.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sourceRoot='C:/Users/Giry/Documents/Spotlog';
const sourceFile=path.join(sourceRoot,'web/src/publicTourismContent.ts');
const registered=JSON.parse(fs.readFileSync(path.join(root,'lib/registered-spotlog-catalog.json'),'utf8'));
const photos=registered.entries.flatMap(entry=>entry.photos);
const photoBySourceFile=new Map(photos.map(photo=>[path.resolve(sourceRoot,photo.localSourceFile),photo]));
const moduleObject={exports:{}};
const js=ts.transpileModule(fs.readFileSync(sourceFile,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const localRequire=(specifier)=>{
  const target=path.resolve(path.dirname(sourceFile),specifier);
  if(!/\.(png|jpg|jpeg|webp)$/.test(target)||!target.startsWith(path.join(sourceRoot,'assets/spotlog')+path.sep))throw new Error('Only approved local asset imports are allowed');
  return target;
};
vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{}, {filename:sourceFile})(localRequire,moduleObject,moduleObject.exports);
const journeys=moduleObject.exports.publicTourismJourneys;
const output=journeys.filter(journey=>journey.visibility==='PUBLIC'&&journey.status==='PUBLISHED'&&journey.recommendationKind==='AI'&&journey.recommendationBasis==='OFFICIAL_SOURCE_SAMPLE').map(journey=>({
  sourceAppId:journey.id,title:journey.title,author:journey.author,region:journey.region,description:journey.summary,
  recommendationKind:journey.recommendationKind,recommendationBasis:journey.recommendationBasis,
  story:journey.story,tags:journey.tags,
  coverPlaceId:photoBySourceFile.get(path.resolve(journey.cover))?.placeId??journey.days[0].places[0].id,
  days:journey.days.map(day=>({day:day.day,title:day.title,story:day.story,
    visits:day.places.map(place=>{
      const canonical=registered.entries.find(item=>item.id===place.id);if(!canonical)throw new Error('Unregistered public course place: '+place.id);
      return{entityId:place.id,kind:['public-busan-gukje','public-busan-jagalchi'].includes(place.id)?'shop':place.kind==='LANDMARK'?'place':place.kind.toLowerCase(),label:place.time||'방문',anchorId:place.id};
    }),
    blocks:day.blocks.flatMap(block=>{
      if(block.type==='TEXT')return[{id:block.id,type:'text',heading:block.heading??'',body:block.body??'',visitEntityId:day.places.find(place=>place.visitId===block.visitId)?.id??null}];
      if(block.type==='PLACE')return[{id:block.id,type:'place',entityId:block.placeId}];
      if(block.type==='IMAGE') {const photo=photoBySourceFile.get(path.resolve(block.image));if(!photo)throw new Error('Photo is not already approved: '+block.id);return[{id:block.id,type:'photo',photoId:photo.id,caption:block.caption??''}];}
      return[];
    }),
  })),
}));
const snapshot={importedAt:'2026-10-19',sourceFile:'web/src/publicTourismContent.ts',sourceRoot:'Spotlog local bundled public editorial code',liveService:false,journeys:output};
fs.writeFileSync(path.join(root,'lib/community-discovery-snapshot.ts'),'// Explicit local public editorial import. No live user records or popularity counts.\nconst snapshot = '+JSON.stringify(snapshot,null,2)+';\nexport default snapshot;\n');
const legacyCredits=JSON.parse(fs.readFileSync(path.join(root,'lib/photo-credits.json'),'utf8')).filter(photo=>/^CC(?:0| BY(?:-SA)? [234]\.0)$/.test(photo.license)).map(photo=>{
  const imageFile=path.resolve(root,photo.path);if(!imageFile.startsWith(path.join(root,'public/images')+path.sep))throw new Error('Legacy photo outside approved images');
  if(crypto.createHash('sha256').update(fs.readFileSync(imageFile)).digest('hex')!==photo.sha256)throw new Error('Legacy photo checksum mismatch');
  return{...photo,image:'/'+photo.path.replace(/^public\//,''),coordinateSourceUrl:photo.landmarkSourceUrl??photo.sourceUrl,copiedAt:'',localSourceFile:photo.path};
});
fs.writeFileSync(path.join(root,'lib/discovery-legacy-photos.ts'),'// Existing locally licensed photos, checked without copying or editing their files.\nconst photos = '+JSON.stringify(legacyCredits,null,2)+';\nexport default photos;\n');
console.log(JSON.stringify({journeys:output.length,days:output.reduce((n,item)=>n+item.days.length,0),photos:output.reduce((n,item)=>n+item.days.flatMap(day=>day.blocks.filter(block=>block.type==='photo')).length,0)}));
