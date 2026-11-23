import { expandedRedCapStickers, redCapStickers } from './together/redCapStickers.ts';
import { companionStickers, expandedCompanionStickers } from './together/companionStickers.ts';
import { mascotStickers } from './together/mascotStickers.ts';
import { mascotStickerPackIds, type ChatStickerId, type MascotStickerPackId } from './together/chatExpressionContract.ts';

const extraRedCapIds = new Set<ChatStickerId>([
  'redcap-confirmed', 'redcap-cant-make-it', 'redcap-good-night',
  'redcap-where-are-you', 'redcap-ill-call', 'redcap-send-photo',
  'redcap-saved-seat', 'redcap-im-home', 'redcap-had-fun',
]);

const mascotPreviewInfo = {
  pebble: ['몽돌이', '주황 스카프를 두른 느긋한 조약돌.'],
  guidebot: ['길잡이 로봇', '약속 장소와 이동 소식을 알려주는 노란 로봇.'],
  backpack: ['배낭콩', '새로운 나들이를 좋아하는 초록 배낭.'],
  cloud: ['두둥구름', '노란 리본을 달고 둥실 떠다니는 보라색 구름.'],
  otter: ['탐험수달', '파란 가방을 메고 여기저기 누비는 수달.'],
  thermos: ['온기병', '청록 뚜껑을 쓰고 따뜻한 인사를 건네는 보온병.'],
} as const satisfies Record<MascotStickerPackId, readonly [string, string]>;

const allCompanions = [...companionStickers, ...expandedCompanionStickers];

/** This read-only gallery uses the same artwork and captions as the chat catalog. */
export const previewPacks = Object.freeze([
  Object.freeze({
    id: 'redcap-extra',
    title: '빨간모자',
    shortTitle: '빨간모자',
    description: '기존 미리보기의 추가 9종부터 전체 스티커를 볼 수 있어요.',
    stickers: Object.freeze([
      ...redCapStickers.filter(sticker => extraRedCapIds.has(sticker.id)),
      ...redCapStickers.filter(sticker => !extraRedCapIds.has(sticker.id)),
      ...expandedRedCapStickers,
    ]),
  }),
  Object.freeze({
    id: 'roundglasses',
    title: '동글안경',
    shortTitle: '동글안경',
    description: '천천히 와도 괜찮다고 말해주는 다정한 친구.',
    stickers: Object.freeze(allCompanions.filter(sticker => sticker.pack === 'roundglasses')),
  }),
  Object.freeze({
    id: 'purplescarf',
    title: '보라머플러',
    shortTitle: '보라머플러',
    description: '나들이에 신나서 온몸으로 표현하는 친구.',
    stickers: Object.freeze(allCompanions.filter(sticker => sticker.pack === 'purplescarf')),
  }),
  ...mascotStickerPackIds.map(id => {
    const [title, description] = mascotPreviewInfo[id];
    return Object.freeze({
      id, title, shortTitle: title, description,
      stickers: Object.freeze(mascotStickers.filter(sticker => sticker.pack === id)),
    });
  }),
]);
