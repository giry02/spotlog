import fs from 'node:fs';
const file='web/src/PersonalTrip.tsx';let text=fs.readFileSync(file,'utf8');
const pairs=[
 ['`DAY ${day.day} 메뉴`',"`DAY ${day.day} ${en?'menu':'메뉴'}`"],
 ["' · 위치 미확인'","(en?' · Location unverified':' · 위치 미확인')"],
 ['`${place.name} 위로 이동`',"`${place.name} · ${en?'Move up':'위로 이동'}`"],
 ['`${place.name} 아래로 이동`',"`${place.name} · ${en?'Move down':'아래로 이동'}`"],
 ['`${place.name} 장소 메뉴`',"`${place.name} · ${en?'Place menu':'장소 메뉴'}`"],
 ['`DAY ${day.day} 숙소${place.bookingFixed?',"`DAY ${day.day} ${en?'stay':'숙소'}${place.bookingFixed?"],
 ['`${removing.name}을 일정에서 뺄까요? 저장한 장소는 유지돼요.`',"en?`Remove ${removing.name} from this itinerary? Your saved place is kept.`:`${removing.name}을 일정에서 뺄까요? 저장한 장소는 유지돼요.`"],
 ['`DAY ${day.day}에 장소 담기`',"en?`Add places to DAY ${day.day}`:`DAY ${day.day}에 장소 담기`"],
 ['`${stayEditing.name} 숙박일 추가`',"`${stayEditing.name} · ${en?'Add stay dates':'숙박일 추가'}`"],
 ["return '담지 못했어요. 다시 시도해 주세요.'", "return en?'Could not add this place. Please try again.':'담지 못했어요. 다시 시도해 주세요.'"],
 ["return '저장하지 못했어요.'", "return en?'Could not save.':'저장하지 못했어요.'"],
];
for(const [from,to] of pairs){if(!text.includes(from))throw Error(from);text=text.replaceAll(from,to);}fs.writeFileSync(file,text);
