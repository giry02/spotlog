/** Original vector characters from the user's 모여봄 prototype/sticker-packs.js.
 * Adapted for Spotlog's local immutable sticker catalog; no third-party sticker art.
 * SVG builders are private and use only constant labels/poses, never user markup.
 */
export type ChatStickerPackId = 'bunny'|'cat'|'bear'|'duck';
export type ChatStickerId = `bunny-${'hi'|'love'|'cheer'|'thanks'|'laugh'|'tears'|'sleep'|'coffee'|'okay'|'nope'}` | `${'cat'|'bear'|'duck'}-${'hi'|'thanks'|'okay'|'cheer'|'laugh'|'sorry'|'coffee'|'sleep'}`;
export interface ChatSticker { readonly id:ChatStickerId; readonly name:string; readonly label:string; readonly pack:ChatStickerPackId; readonly svg:string; readonly src:string }
  const ink='#514d47', cream='#fff9e7', mint='#adc9b6', coral='#ef9b91';
  const entries=[
    ['bunny-hi','안녕!','안녕!', 'wave'],
    ['bunny-love','좋아해','마음 전해요','love'],
    ['bunny-cheer','할 수 있어','응원해요!','cheer'],
    ['bunny-thanks','고마워','고마워요','thanks'],
    ['bunny-laugh','하하하','하하하!','laugh'],
    ['bunny-tears','훌쩍','훌쩍…','tears'],
    ['bunny-sleep','잘 자','좋은 꿈 꿔요','sleep'],
    ['bunny-coffee','커피 한 잔','커피 한 잔?','coffee'],
    ['bunny-okay','좋아요','좋아요!','okay'],
    ['bunny-nope','잠깐만','잠깐만요','nope']
  ] as const;
  function art(label:string,pose:string) {
    const smiling=['laugh','cheer','thanks','sleep'].includes(pose);
    const eyes=smiling?`<path d="M87 106q7-9 14 0m35 0q7-9 14 0" fill="none"/>`:`<ellipse cx="96" cy="105" rx="3.8" ry="5.4" fill="${ink}"/><ellipse cx="143" cy="105" rx="3.8" ry="5.4" fill="${ink}"/>`;
    const mouth=pose==='laugh'?`<path d="M110 120q10 23 21 0Z" fill="#df9f92"/>`:pose==='tears'?`<path d="M111 127q9-9 18 0" fill="none"/>`:`<path d="M112 119q8 10 16 0" fill="none"/>`;
    const ornament=({
      wave:`<path d="M65 147Q28 113 45 96q17-11 27 30" fill="${cream}"/><path d="M28 91l-8-7m15-2-2-11m15 5 4-10" fill="none" stroke="${mint}"/>`,
      love:`<path d="M120 164c-38-26-40-44-24-50 12-4 20 7 24 12 5-5 13-16 25-12 16 6 14 24-25 50Z" fill="${coral}" stroke="none"/><ellipse cx="91" cy="151" rx="13" ry="9" fill="${cream}"/><ellipse cx="149" cy="151" rx="13" ry="9" fill="${cream}"/>`,
      cheer:`<path d="M65 146Q32 112 47 99q14-10 28 26m100 21q33-34 18-47-14-10-28 26" fill="${cream}"/><path d="m40 66 4-10 5 10 11 2-9 7 2 11-9-6-10 6 2-11-8-7Zm147 10 4-10 5 10 11 2-9 7 2 11-9-6-10 6 2-11-8-7Z" fill="#edc46b" stroke="none"/>`,
      thanks:`<ellipse cx="111" cy="153" rx="14" ry="10" transform="rotate(-25 111 153)" fill="${cream}"/><ellipse cx="130" cy="153" rx="14" ry="10" transform="rotate(25 130 153)" fill="${cream}"/><path d="m43 111 9 4m-7 6 8-1m136-9-9 4m7 6-8-1" stroke="${coral}"/>`,
      laugh:`<path d="M65 150q-15-14-24-1m134 1q15-14 24-1" fill="none"/><path d="M40 126q-8-7-2-16m161 16q8-7 2-16" fill="none" stroke="${mint}"/>`,
      tears:`<path d="M87 115q-13 20 0 20 13 0 0-20m66 0q-13 20 0 20 13 0 0-20" fill="#a7cddd" stroke="none"/><ellipse cx="85" cy="157" rx="13" ry="10" fill="${cream}"/><ellipse cx="155" cy="157" rx="13" ry="10" fill="${cream}"/>`,
      sleep:`<path d="M174 51q-7 23 16 24-26 15-31-10-2-9 15-14Z" fill="#edcc75" stroke="none"/><text x="187" y="111" font-size="18" fill="${mint}" stroke="none" font-weight="700">z</text><text x="202" y="91" font-size="24" fill="${mint}" stroke="none" font-weight="700">z</text><path d="M66 168q54 25 108 0v25H66Z" fill="#d8e5d8" stroke="none"/>`,
      coffee:`<path d="M94 145h46v29q-22 18-46 0Z" fill="#d5b99d"/><path d="M140 148q26-3 16 17-5 8-16 6m-34-33q-7-9 0-16m14 16q-7-9 0-16" fill="none"/><ellipse cx="87" cy="161" rx="12" ry="9" fill="${cream}"/>`,
      okay:`<path d="M167 166V102" fill="none"/><rect x="165" y="94" width="48" height="42" rx="9" fill="${mint}" stroke="none"/><path d="m176 114 9 9 16-20" fill="none" stroke="#fff" stroke-width="5"/><ellipse cx="162" cy="155" rx="14" ry="10" fill="${cream}"/>`,
      nope:`<ellipse cx="64" cy="144" rx="14" ry="20" transform="rotate(-20 64 144)" fill="${cream}"/><ellipse cx="176" cy="144" rx="14" ry="20" transform="rotate(20 176 144)" fill="${cream}"/><path d="M36 112v-10m8 12v-10m150 8v-10m8 12v-10" stroke="${coral}" fill="none"/>`
    } as Record<string,string>)[pose];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="120" cy="185" rx="61" ry="8" fill="#c9d4c5" opacity=".34" stroke="none"/><ellipse cx="120" cy="153" rx="49" ry="39" fill="${cream}"/><ellipse cx="87" cy="59" rx="15" ry="39" transform="rotate(-13 87 59)" fill="${cream}"/><ellipse cx="147" cy="61" rx="16" ry="39" transform="rotate(18 147 61)" fill="${cream}"/><path d="M83 34q-4 24 7 44m61-42q3 22-9 42" stroke="#edcfc2" stroke-width="8"/><path d="M63 106c0-36 28-48 57-48s57 12 57 48c0 35-25 45-57 45s-57-10-57-45Z" fill="${cream}"/><ellipse cx="80" cy="119" rx="11" ry="6" fill="${coral}" opacity=".56" stroke="none"/><ellipse cx="160" cy="119" rx="11" ry="6" fill="${coral}" opacity=".56" stroke="none"/>${eyes}${mouth}<path d="m94 143 26 10 26-10-9 19-17-9-17 9Z" fill="${mint}" stroke="none"/>${ornament}<ellipse cx="95" cy="186" rx="18" ry="9" fill="${cream}"/><ellipse cx="145" cy="186" rx="18" ry="9" fill="${cream}"/></g><text x="120" y="224" text-anchor="middle" font-family="Arial,'Malgun Gothic',sans-serif" font-size="20" font-weight="700" fill="${ink}">${label}</text></svg>`;
  }
  const animalPoses=[
    ['hi','안녕','반가워요!','wave'],
    ['thanks','고마워','고마워요','thanks'],
    ['okay','좋아요','좋아요!','okay'],
    ['cheer','응원해','할 수 있어요!','cheer'],
    ['laugh','하하','하하하!','laugh'],
    ['sorry','미안해','미안해요…','sorry'],
    ['coffee','커피 한 잔','커피 마실래요?','coffee'],
    ['sleep','잘 자','푹 쉬어요','sleep']
  ] as const;
  const animalPalette={
    cat:{skin:'#cad9df',light:'#edf2ed',outline:'#485963',accent:'#769b95',pink:'#e7a79d'},
    bear:{skin:'#cba477',light:'#f4e4c9',outline:'#654c36',accent:'#c67b65',pink:'#e6a895'},
    duck:{skin:'#f4d66d',light:'#fff2b6',outline:'#765e35',accent:'#84ad94',pink:'#e9a26c'}
  };
  function animalArt(species:'cat'|'bear'|'duck',label:string,pose:string){
    const c=animalPalette[species],duck=species==='duck',cat=species==='cat',bear=species==='bear';
    const relaxed=['thanks','laugh','sleep'].includes(pose);
    const ears=cat?`<path d="m69 83 4-49 35 32m23 0 35-32 5 49" fill="${c.skin}"/><path d="m79 65 1-19 14 22m51 0 15-22 1 19" fill="${c.pink}" stroke="none"/>`:bear?`<circle cx="76" cy="63" r="21" fill="${c.skin}"/><circle cx="164" cy="63" r="21" fill="${c.skin}"/><circle cx="76" cy="63" r="11" fill="${c.light}" stroke="none"/><circle cx="164" cy="63" r="11" fill="${c.light}" stroke="none"/>`:`<path d="M107 58q-9-26 4-21l8 18q0-31 10-22 5 6-3 23" fill="${c.skin}"/>`;
    const eyes=relaxed?`<path d="M88 100q7-9 14 0m36 0q7-9 14 0" fill="none"/>`:pose==='sorry'?`<path d="m88 97 13 4m38 0 13-4" fill="none"/><ellipse cx="96" cy="108" rx="3.4" ry="4" fill="${c.outline}" stroke="none"/><ellipse cx="145" cy="108" rx="3.4" ry="4" fill="${c.outline}" stroke="none"/>`:`<ellipse cx="96" cy="102" rx="3.5" ry="5" fill="${c.outline}" stroke="none"/><ellipse cx="145" cy="102" rx="3.5" ry="5" fill="${c.outline}" stroke="none"/>`;
    const muzzle=duck?`<path d="M98 115q22-14 45 0 2 13-23 15-24-2-22-15Z" fill="#eaa05b"/><path d="M102 119q18 6 37 0" fill="none" stroke-width="2"/>`:`${bear?`<ellipse cx="120" cy="120" rx="23" ry="17" fill="${c.light}" stroke="none"/>`:''}<path d="m115 113 5 4 5-4Z" fill="${c.outline}" stroke="none"/>${pose==='laugh'?`<path d="M110 124q10 17 20 0Z" fill="${c.pink}" stroke-width="2"/>`:pose==='sorry'?'<path d="M112 129q8-7 16 0" fill="none"/>':'<path d="M120 118v5m0 0q-6 8-12 0m12 0q6 8 12 0" fill="none" stroke-width="2"/>'}`;
    const speciesDetails=cat?`<path d="m75 110-17-4m17 13-18 2m108-11 17-4m-17 13 18 2M112 66v9m8-11v12m8-10v9" fill="none" stroke-width="2.4"/>`:'';
    let gesture=({
      wave:`<path d="M70 149Q31 130 47 107q12-15 28 19" fill="${c.skin}"/><path d="m31 101-7-6m15-2-1-10m11 8 4-8" stroke="${c.accent}" fill="none"/>`,
      thanks:`<ellipse cx="109" cy="153" rx="15" ry="10" transform="rotate(-27 109 153)" fill="${c.skin}"/><ellipse cx="130" cy="153" rx="15" ry="10" transform="rotate(27 130 153)" fill="${c.skin}"/><path d="m44 110 9 4m-8 7h9m133-11-9 4m8 7h-9" stroke="${c.pink}" fill="none"/>`,
      okay:`<path d="M168 167v-65" fill="none"/><rect x="166" y="95" width="45" height="39" rx="8" fill="${c.accent}" stroke="none"/><path d="m176 113 8 9 15-18" fill="none" stroke="#fff" stroke-width="5"/><ellipse cx="163" cy="155" rx="14" ry="10" fill="${c.skin}"/>`,
      cheer:`<path d="M70 145Q34 123 47 105q10-15 29 19m94 21q36-22 23-40-10-15-29 19" fill="${c.skin}"/><path d="m38 66 4-10 5 10 11 2-9 7 2 11-9-6-10 6 2-11-8-7Zm160-8 4-10 5 10 11 2-9 7 2 11-9-6-10 6 2-11-8-7Z" fill="${duck?'#94bca2':'#ecc76f'}" stroke="none"/>`,
      laugh:`<path d="M71 156q-24-21-31-5m129 5q24-21 31-5" fill="none"/><path d="M42 132q-8-8-1-16m158 16q8-8 1-16" fill="none" stroke="${c.accent}"/>`,
      sorry:`<path d="M86 116q-11 18 0 18 11 0 0-18m68 0q-11 18 0 18 11 0 0-18" fill="#a5c8dc" stroke="none"/><ellipse cx="103" cy="160" rx="16" ry="10" transform="rotate(-20 103 160)" fill="${c.skin}"/><ellipse cx="136" cy="160" rx="16" ry="10" transform="rotate(20 136 160)" fill="${c.skin}"/>`,
      coffee:`<path d="M94 146h46v28q-23 17-46 0Z" fill="#e4c3a0"/><path d="M140 149q25-3 15 17-5 7-15 5m-32-32q-7-9 0-16m13 16q-7-9 0-16" fill="none"/><ellipse cx="86" cy="161" rx="13" ry="10" fill="${c.skin}"/>`,
      sleep:`<path d="M181 47q-8 24 16 25-27 17-32-9-2-9 16-16Z" fill="${duck?'#90b6a0':'#efd177'}" stroke="none"/><text x="186" y="108" fill="${c.accent}" stroke="none" font-size="18" font-weight="700">z</text><text x="201" y="88" fill="${c.accent}" stroke="none" font-size="23" font-weight="700">z</text><path d="M70 165q50 22 100 0v24H70Z" fill="${c.accent}" opacity=".65" stroke="none"/>`
    } as Record<string,string>)[pose];
    // Species have distinct paws, wings and body language as well as different faces.
    if(cat&&pose==='wave')gesture=`<path d="M71 151q-27-3-31-21-2-12 10-13 13 0 15 14l8 8" fill="${c.skin}"/><path d="m43 120 1 6m7-8 1 7m-17-13-7-5m10-3-2-8" fill="none" stroke-width="2"/>`;
    if(bear&&pose==='wave')gesture=`<path d="M73 150q-29-8-30-38-1-17 13-18 14 0 14 18l6 17" fill="${c.skin}"/><ellipse cx="56" cy="111" rx="7" ry="9" fill="${c.light}" stroke="none"/><circle cx="47" cy="99" r="2.5" fill="${c.light}" stroke="none"/><circle cx="56" cy="97" r="2.5" fill="${c.light}" stroke="none"/><path d="m32 91-6-6m9-1-1-9" fill="none" stroke="${c.accent}"/>`;
    if(duck&&pose==='wave')gesture=`<path d="M75 151q-30 6-35-12-2-8 5-6-10-17 0-16 7 3 18 16-4-20 5-15 9 10 12 22" fill="${c.skin}"/><path d="m30 128-8-1m12-8-5-7" fill="none" stroke="${c.accent}"/>`;
    if(duck&&pose==='cheer')gesture=`<path d="M73 146q-26-5-37-28-4-9 5-6-6-17 4-11 15 10 25 28m97 17q26-5 37-28 4-9-5-6 6-17-4-11-15 10-25 28" fill="${c.skin}"/><path d="m35 83 4-8 5 8 9 2-7 6 1 9-8-5-8 5 2-9-7-6Zm169-6 4-8 5 8 9 2-7 6 1 9-8-5-8 5 2-9-7-6Z" fill="#91bba2" stroke="none"/>`;
    if(bear&&pose==='laugh')gesture=`<ellipse cx="100" cy="160" rx="18" ry="11" transform="rotate(-23 100 160)" fill="${c.skin}"/><ellipse cx="140" cy="160" rx="18" ry="11" transform="rotate(23 140 160)" fill="${c.skin}"/><path d="m40 122-7-8m9 20-11-1m158-11 7-8m-9 20 11-1" fill="none" stroke="${c.accent}"/>`;
    const tail=cat?`<path d="M161 165q45 12 34-19-7-15-18-2" fill="none" stroke="${c.outline}" stroke-width="12"/><path d="M161 165q45 12 34-19-7-15-18-2" fill="none" stroke="${c.skin}" stroke-width="7"/>`:'';
    const feet=duck?`<path d="m104 180-7 10-15 1 9-9m45-2 7 10 15 1-9-9" fill="#e9a15f" stroke-width="2"/>`:`<ellipse cx="96" cy="185" rx="18" ry="9" fill="${c.skin}"/><ellipse cx="144" cy="185" rx="18" ry="9" fill="${c.skin}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g stroke="${c.outline}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="120" cy="186" rx="63" ry="8" fill="#cbd3c2" opacity=".32" stroke="none"/>${tail}<ellipse cx="120" cy="155" rx="${duck?53:47}" ry="36" fill="${c.skin}"/><ellipse cx="120" cy="161" rx="${bear?26:22}" ry="22" fill="${c.light}" stroke="none"/>${ears}<path d="M64 105c0-34 25-50 56-50s56 16 56 50c0 31-25 44-56 44s-56-13-56-44Z" fill="${c.skin}"/><ellipse cx="79" cy="117" rx="10" ry="6" fill="${c.pink}" opacity=".65" stroke="none"/><ellipse cx="161" cy="117" rx="10" ry="6" fill="${c.pink}" opacity=".65" stroke="none"/>${eyes}${muzzle}${speciesDetails}<path d="m96 142 24 9 24-9-8 19-16-10-16 10Z" fill="${c.accent}" stroke="none"/>${gesture}${feet}</g><text x="120" y="224" text-anchor="middle" font-family="Arial,'Malgun Gothic',sans-serif" font-size="19" font-weight="700" fill="${c.outline}">${label}</text></svg>`;
  }
  export const chatStickerPacks=Object.freeze([
    Object.freeze({id:'bunny',name:'포근 토끼의 하루',shortName:'토끼',coverId:'bunny-hi',description:'다정한 토끼와 나누는 작은 마음 10가지'}),
    Object.freeze({id:'cat',name:'살금 고양이의 인사',shortName:'고양이',coverId:'cat-hi',description:'조용히 다가와 마음을 건네는 회색 고양이'}),
    Object.freeze({id:'bear',name:'느긋 곰의 오후',shortName:'곰',coverId:'bear-hi',description:'크고 포근한 마음으로 곁을 지키는 갈색 곰'}),
    Object.freeze({id:'duck',name:'동동 오리의 산책',shortName:'오리',coverId:'duck-hi',description:'가벼운 발걸음으로 기분을 전하는 노란 오리'})
  ]);
  const stickers:ChatSticker[]=entries.map(([id,name,label,pose])=>{const svg=art(label,pose);return Object.freeze({id,name,label,pack:'bunny',svg,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});});
  for(const species of ['cat','bear','duck'] as const){
    for(const [suffix,name,label,pose] of animalPoses){const svg=animalArt(species,label,pose);stickers.push(Object.freeze({id:(species+'-'+suffix) as ChatStickerId,name,label,pack:species,svg,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}));}
  }

export const packs = chatStickerPacks;
export const chatStickers:readonly ChatSticker[] = Object.freeze(stickers);
const stickerIndex = new Map(chatStickers.map(sticker=>[sticker.id,sticker]));
export function isChatStickerId(value:unknown):value is ChatStickerId { return typeof value==='string' && stickerIndex.has(value as ChatStickerId); }
export function getChatSticker(id:unknown):ChatSticker|null { return isChatStickerId(id) ? stickerIndex.get(id)! : null; }
export interface ChatEmoji { readonly emoji:string; readonly label:string }
export interface ChatEmojiCategory { readonly id:string; readonly label:string; readonly emoji:string; readonly items:readonly ChatEmoji[] }
const emojiList=(entries:readonly (readonly [string,string])[]):readonly ChatEmoji[]=>Object.freeze(entries.map(([emoji,label])=>Object.freeze({emoji,label})));
export const emojiCategories:readonly ChatEmojiCategory[]=Object.freeze([
  Object.freeze({id:'feelings',label:'표정',emoji:'😊',items:emojiList([['😊','미소'],['😄','활짝 웃음'],['😂','웃음 눈물'],['🥹','감동'],['😍','반했어요'],['😎','멋져요'],['🤔','생각 중'],['😮','놀랐어요'],['😢','슬퍼요'],['😴','졸려요'],['🥳','축하'],['😅','머쓱해요'],['🤗','포옹'],['🫡','알겠어요'],['😌','편안해요']])}),
  Object.freeze({id:'reactions',label:'마음·반응',emoji:'❤️',items:emojiList([['❤️','하트'],['🧡','주황 하트'],['💛','노랑 하트'],['💚','초록 하트'],['💙','파랑 하트'],['👍','좋아요'],['👏','박수'],['🙌','환호'],['🙏','고마워요'],['👌','오케이'],['✌️','브이'],['💪','힘내요'],['🎉','축하해요'],['✨','반짝'],['✅','확인']])}),
  Object.freeze({id:'travel',label:'여행·준비',emoji:'🧳',items:emojiList([['🧳','여행 가방'],['✈️','비행기'],['🚆','기차'],['🚌','버스'],['🚗','자동차'],['🚶','걷기'],['🏨','숙소'],['📍','위치'],['🗺️','지도'],['📷','사진'],['🌊','바다'],['🏕️','캠핑'],['☔','우산'],['🎒','배낭'],['🔋','배터리']])}),
  Object.freeze({id:'food',label:'음식·카페',emoji:'☕',items:emojiList([['☕','커피'],['🍵','차'],['🥐','크루아상'],['🍰','케이크'],['🍚','밥'],['🍜','국수'],['🍲','찌개'],['🥗','샐러드'],['🍔','햄버거'],['🍕','피자'],['🍣','초밥'],['🍦','아이스크림'],['🥤','음료'],['🍻','건배'],['🍽️','식사']])}),
]);
