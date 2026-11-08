import type { GroupTopic } from './model';

export interface GroupSubtopic { readonly id: string; readonly parent: GroupTopic; readonly label: string; readonly emoji: string; readonly keywords: readonly string[] }
const definitions: ReadonlyArray<readonly [parent: GroupTopic, suffix: string, label: string, emoji: string, keywords?: readonly string[]]> = [
  ['SPORTS','RUNNING','러닝','🏃',['달리기','조깅']], ['SPORTS','RACKET','라켓 스포츠','🏸',['테니스','배드민턴','탁구','스쿼시']],
  ['SPORTS','FITNESS','헬스·요가','🧘',['피트니스','필라테스','스트레칭']], ['SPORTS','CYCLING','자전거','🚲',['라이딩','사이클']],
  ['SPORTS','BALL','축구·농구','⚽',['풋살','배구','야구']], ['SPORTS','GOLF','골프','⛳'], ['SPORTS','SWIMMING','수영','🏊'], ['SPORTS','BOWLING','볼링','🎳'],
  ['OUTDOOR','HIKING','등산·트레킹','🥾',['산행','트레일']], ['OUTDOOR','CAMPING','캠핑','🏕️',['차박','백패킹']], ['OUTDOOR','FISHING','낚시','🎣'],
  ['OUTDOOR','WATER','수상 레저','🏄',['서핑','카약','패들보드']], ['OUTDOOR','SNOW','스키·보드','🎿',['스노보드']], ['OUTDOOR','PICNIC','피크닉','🧺',['소풍','공원']],
  ['TRAVEL','DOMESTIC','국내 여행','🚆'], ['TRAVEL','OVERSEAS','해외 여행','✈️'], ['TRAVEL','DAY','당일 여행','🚌',['당일치기','나들이']],
  ['TRAVEL','FAMILY','가족 여행','👨‍👩‍👧'], ['TRAVEL','SLOW','여유로운 여행','🌿',['휴식','힐링']], ['TRAVEL','ROAD','드라이브 여행','🚗',['로드트립']],
  ['FOOD','KOREAN','한식','🍚',['국밥','백반','전통음식']], ['FOOD','BRUNCH','브런치','🥪'], ['FOOD','SEAFOOD','해산물','🦐',['생선','회']],
  ['FOOD','GLOBAL','세계 음식','🍝',['양식','일식','중식','아시아음식']], ['FOOD','MARKET','시장·골목 맛집','🥟',['길거리음식']], ['FOOD','VEGETARIAN','채식','🥗',['비건']],
  ['CAFE','COFFEE','커피','☕',['원두','핸드드립']], ['CAFE','DESSERT','디저트·빵','🍰',['베이커리']], ['CAFE','TEA','차·티룸','🍵'],
  ['CAFE','CHAT','카페 수다','💬'], ['CAFE','WORK','작업·공부 카페','💻',['카공','코워킹']],
  ['WALK','NEIGHBORHOOD','동네 산책','🚶'], ['WALK','PARK','공원·숲길','🌳'], ['WALK','COAST','바다·강변 걷기','🌊'], ['WALK','NIGHT','저녁·야경 산책','🌙'], ['WALK','CITY','도심·골목 걷기','🏙️'],
  ['PHOTO','SNAP','스냅·일상 사진','📷'], ['PHOTO','LANDSCAPE','풍경 사진','🌅'], ['PHOTO','PORTRAIT','인물 사진','🖼️'], ['PHOTO','VIDEO','영상 촬영','🎬'], ['PHOTO','FILM','필름 카메라','🎞️'],
  ['CULTURE','EXHIBITION','전시·미술관','🎨'], ['CULTURE','PERFORMANCE','공연·연극','🎭',['뮤지컬']], ['CULTURE','MOVIE','영화','🎥'], ['CULTURE','FESTIVAL','축제','🎪'], ['CULTURE','HISTORY','역사·문화 탐방','🏛️'],
  ['BOOK','FREE','자유 독서','📖'], ['BOOK','DISCUSSION','책 토론','🗣️'], ['BOOK','WRITING','글쓰기','✍️'], ['BOOK','STUDY','독서·스터디','📝'], ['BOOK','BOOKSTORE','서점 탐방','📚'],
  ['GAME','BOARD','보드게임','🎲'], ['GAME','STRATEGY','전략 게임','♟️',['체스','바둑','장기']], ['GAME','PARTY','파티 게임','🎉'], ['GAME','ESCAPE','방탈출','🔑'], ['GAME','DIGITAL','온라인·콘솔 게임','🎮'],
  ['MUSIC','LISTEN','음악 감상','🎧'], ['MUSIC','INSTRUMENT','악기 연주','🎸'], ['MUSIC','SING','노래·합창','🎤'], ['MUSIC','BAND','밴드·합주','🥁'], ['MUSIC','LIVE','라이브 공연','🎵'],
  ['LANGUAGE','ENGLISH','영어','🇬🇧'], ['LANGUAGE','JAPANESE','일본어','🇯🇵'], ['LANGUAGE','CHINESE','중국어','🇨🇳'], ['LANGUAGE','EXCHANGE','언어 교환','🌍'], ['LANGUAGE','OTHER','다른 언어','💬'],
  ['CRAFT','POTTERY','도예','🏺'], ['CRAFT','KNIT','뜨개·자수','🧶'], ['CRAFT','DRAW','그림·드로잉','🖌️'], ['CRAFT','MAKE','공예·만들기','🛠️'], ['CRAFT','COOK','요리·베이킹','🧁'],
  ['PETS','DOG','강아지','🐕'], ['PETS','CAT','고양이','🐈'], ['PETS','WALK','반려동물 산책','🐾'], ['PETS','CARE','반려 생활·돌봄','💛'], ['PETS','OTHER','다른 반려동물','🐇'],
  ['SOCIAL','NEIGHBORS','동네 친구','👋'], ['SOCIAL','TALK','편한 수다','💬'], ['SOCIAL','AFTERWORK','퇴근 후 만남','🌆'], ['SOCIAL','WEEKEND','주말 만남','☀️'], ['SOCIAL','WELCOME','새 친구 환영','🤝'],
  ['FAMILY','OUTING','가족 나들이','🧺'], ['FAMILY','PARENTING','육아·부모 모임','🧸'], ['FAMILY','MEAL','가족 식사','🍽️'], ['FAMILY','PARENTS','부모님과 함께','💐'], ['FAMILY','CULTURE','가족 체험·문화','🎟️'],
];
/** Stable additive IDs. Never infer these from a legacy group's name or introduction. */
export const groupSubtopics: readonly GroupSubtopic[] = Object.freeze(definitions.map(([parent, suffix, label, emoji, keywords = []]) => Object.freeze({ id: `${parent}_${suffix}`, parent, label, emoji, keywords: Object.freeze([...keywords]) })));
const byId = new Map(groupSubtopics.map(item => [item.id, item]));
export const MAX_GROUP_SUBTOPICS = 32;
export function getGroupSubtopic(id: string): GroupSubtopic | undefined { return byId.get(id); }
export function groupSubtopicsFor(topic?: GroupTopic | 'ALL'): GroupSubtopic[] { return groupSubtopics.filter(item => !topic || topic === 'ALL' || item.parent === topic); }
export function validGroupSubtopics(topics: readonly GroupTopic[], value: unknown): boolean {
  return value === undefined || Array.isArray(value) && value.length <= MAX_GROUP_SUBTOPICS && new Set(value).size === value.length
    && value.every(id => typeof id === 'string' && Boolean(byId.get(id) && topics.includes(byId.get(id)!.parent)));
}
/** Sanitize only explicit IDs for display/drafts; no text-based backfill or parent guessing. */
export function normalizeGroupSubtopics(topics: readonly GroupTopic[], value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(byId.get(id) && topics.includes(byId.get(id)!.parent))))].slice(0, MAX_GROUP_SUBTOPICS) : [];
}
