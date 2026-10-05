import fs from 'node:fs';
let p='web/src/App.tsx',s=fs.readFileSync(p,'utf8');
for(const [a,b] of [
 ['{option.label}</button>','{copy(option.label)}</button>'],
 ['<strong>{label}</strong><span>{cheers[id]','<strong>{copy(label)}</strong><span>{cheers[id]'],
 ['<TierIcon size={19} />{tier.label}','<TierIcon size={19} />{copy(tier.label)}'],
 ['<b>{nextTier.label}</b>','<b>{copy(nextTier.label)}</b>'],
 ]){if(!s.includes(a))throw Error(a);s=s.replaceAll(a,b);}fs.writeFileSync(p,s);
p='web/src/frontend-copy.en.json';const d=JSON.parse(fs.readFileSync(p,'utf8'));
Object.assign(d,{'전체 기간':'All durations','당일치기':'Day trip','1박 2일':'1 night, 2 days','2박 3일':'2 nights, 3 days','3박 이상':'3+ nights','너무 좋아요':'Love it','최고예요':'Excellent','동선이 유용해요':'Useful itinerary','새싹 기록자':'New storyteller','새싹':'Newcomer','동네 가이드':'Local guide','가이드':'Guide','여행 큐레이터':'Travel curator','큐레이터':'Curator','루트 메이커':'Route maker','루트메이커':'Route maker','Spotlog 마스터':'Spotlog master','마스터':'Master'});
fs.writeFileSync(p,JSON.stringify(d,null,2));
