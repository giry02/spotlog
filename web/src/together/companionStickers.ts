import type { ChatStickerId, ChatStickerPackId } from './chatExpressionContract.ts';

type CompanionPack = Extract<ChatStickerPackId, 'roundglasses' | 'purplescarf'>;
const entries = [
  ['roundglasses', 'roundglasses-thumbs-up', '좋아요!', new URL('./sticker-art/round-glasses/thumbs-up.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-hello', '반가워!', new URL('./sticker-art/round-glasses/hello.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-thanks', '고마워요', new URL('./sticker-art/round-glasses/thanks.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-thinking', '생각 중', new URL('./sticker-art/round-glasses/thinking.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-come-along', '같이 가자', new URL('./sticker-art/round-glasses/come-along.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-booked', '예약했어요', new URL('./sticker-art/round-glasses/booked.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-tea', '차 한 잔?', new URL('./sticker-art/round-glasses/tea.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-five-minutes', '5분만!', new URL('./sticker-art/round-glasses/five-minutes.webp', import.meta.url).href],
  ['roundglasses', 'roundglasses-take-time', '천천히 와', new URL('./sticker-art/round-glasses/take-time.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-excited', '신난다!', new URL('./sticker-art/purple-scarf/excited.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-high-five', '하이파이브!', new URL('./sticker-art/purple-scarf/high-five.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-wow', '대박!', new URL('./sticker-art/purple-scarf/wow.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-go', '출발하자!', new URL('./sticker-art/purple-scarf/go.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-found-the-way', '길 찾았어!', new URL('./sticker-art/purple-scarf/found-the-way.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-fresh-air', '바람 쐬자', new URL('./sticker-art/purple-scarf/fresh-air.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-snack', '간식 먹자', new URL('./sticker-art/purple-scarf/snack.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-selfie', '같이 찍자', new URL('./sticker-art/purple-scarf/selfie.webp', import.meta.url).href],
  ['purplescarf', 'purplescarf-see-you', '또 만나!', new URL('./sticker-art/purple-scarf/see-you.webp', import.meta.url).href],
] as const satisfies readonly (readonly [CompanionPack, ChatStickerId, string, string])[];

export const companionStickers = Object.freeze(entries.map(([pack, id, label, src]) =>
  Object.freeze({ id, name: label, label, pack, src }),
));
