import { redCapStickers } from './together/redCapStickers.ts';
import { companionStickers } from './together/companionStickers.ts';
import type { ChatStickerId } from './together/chatExpressionContract.ts';

const extraRedCapIds = new Set<ChatStickerId>([
  'redcap-confirmed', 'redcap-cant-make-it', 'redcap-good-night',
  'redcap-where-are-you', 'redcap-ill-call', 'redcap-send-photo',
  'redcap-saved-seat', 'redcap-im-home', 'redcap-had-fun',
]);

/** This read-only gallery uses the same artwork and captions as the chat catalog. */
export const previewPacks = Object.freeze([
  Object.freeze({
    id: 'redcap-extra',
    title: '빨간모자 추가 9종',
    shortTitle: '빨간모자 추가',
    description: '기존 묶음에 새로 더한 답장과 안부.',
    stickers: Object.freeze(redCapStickers.filter(sticker => extraRedCapIds.has(sticker.id))),
  }),
  Object.freeze({
    id: 'roundglasses',
    title: '동글안경',
    shortTitle: '동글안경',
    description: '천천히 와도 괜찮다고 말해주는 다정한 친구.',
    stickers: Object.freeze(companionStickers.filter(sticker => sticker.pack === 'roundglasses')),
  }),
  Object.freeze({
    id: 'purplescarf',
    title: '보라머플러',
    shortTitle: '보라머플러',
    description: '나들이에 신나서 온몸으로 표현하는 친구.',
    stickers: Object.freeze(companionStickers.filter(sticker => sticker.pack === 'purplescarf')),
  }),
]);
