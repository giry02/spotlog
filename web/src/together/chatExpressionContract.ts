/** Stored-message validation must not initialize the chat artwork or picker. */
export type ChatStickerPackId = 'bunny' | 'cat' | 'bear' | 'duck' | 'redcap' | 'roundglasses' | 'purplescarf';
export const chatStickerIds = Object.freeze([
  'bunny-hi', 'bunny-love', 'bunny-cheer', 'bunny-thanks', 'bunny-laugh',
  'bunny-tears', 'bunny-sleep', 'bunny-coffee', 'bunny-okay', 'bunny-nope',
  'cat-hi', 'cat-thanks', 'cat-okay', 'cat-cheer', 'cat-laugh', 'cat-sorry', 'cat-coffee', 'cat-sleep',
  'bear-hi', 'bear-thanks', 'bear-okay', 'bear-cheer', 'bear-laugh', 'bear-sorry', 'bear-coffee', 'bear-sleep',
  'duck-hi', 'duck-thanks', 'duck-okay', 'duck-cheer', 'duck-laugh', 'duck-sorry', 'duck-coffee', 'duck-sleep',
  'redcap-thumbs-up', 'redcap-hello', 'redcap-thanks', 'redcap-laugh', 'redcap-sorry', 'redcap-congrats', 'redcap-sad', 'redcap-cheer', 'redcap-surprised',
  'redcap-leaving', 'redcap-on-my-way', 'redcap-arrived', 'redcap-running-late', 'redcap-wait', 'redcap-meet-here', 'redcap-check-time', 'redcap-change-time', 'redcap-joining',
  'redcap-meal', 'redcap-coffee', 'redcap-walk', 'redcap-photo', 'redcap-rain', 'redcap-rest', 'redcap-love-this-place', 'redcap-go-again', 'redcap-trip',
  'redcap-confirmed', 'redcap-cant-make-it', 'redcap-good-night', 'redcap-where-are-you', 'redcap-ill-call', 'redcap-send-photo', 'redcap-saved-seat', 'redcap-im-home', 'redcap-had-fun',
  'roundglasses-thumbs-up', 'roundglasses-hello', 'roundglasses-thanks', 'roundglasses-thinking', 'roundglasses-come-along', 'roundglasses-booked', 'roundglasses-tea', 'roundglasses-five-minutes', 'roundglasses-take-time',
  'purplescarf-excited', 'purplescarf-high-five', 'purplescarf-wow', 'purplescarf-go', 'purplescarf-found-the-way', 'purplescarf-fresh-air', 'purplescarf-snack', 'purplescarf-selfie', 'purplescarf-see-you',
] as const);
export type ChatStickerId = typeof chatStickerIds[number];
const stickerIds: ReadonlySet<string> = new Set(chatStickerIds);
export function isChatStickerId(value: unknown): value is ChatStickerId {
  return typeof value === 'string' && stickerIds.has(value);
}
