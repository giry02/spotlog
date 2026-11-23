/** Stored-message validation must not initialize the chat artwork or picker. */
export type ChatStickerPackId = 'bunny' | 'cat' | 'bear' | 'duck' | 'redcap' | 'roundglasses' | 'purplescarf' | 'pebble' | 'guidebot';
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
  'pebble-thumbs-up', 'pebble-on-my-way', 'pebble-thanks',
  'pebble-hello', 'pebble-okay', 'pebble-laugh', 'pebble-wow', 'pebble-sad', 'pebble-sorry', 'pebble-congrats', 'pebble-cheer', 'pebble-love', 'pebble-tired', 'pebble-good-night', 'pebble-good-morning',
  'pebble-joining', 'pebble-cant-make-it', 'pebble-check-time', 'pebble-change-time', 'pebble-meet-here', 'pebble-where-are-you', 'pebble-leaving', 'pebble-running-late', 'pebble-wait', 'pebble-arrived', 'pebble-im-home', 'pebble-call',
  'pebble-meal', 'pebble-coffee', 'pebble-walk', 'pebble-photo', 'pebble-send-photo', 'pebble-rain', 'pebble-rest', 'pebble-recommend', 'pebble-booked', 'pebble-saved-seat', 'pebble-good-time', 'pebble-again',
  'guidebot-thumbs-up', 'guidebot-on-my-way', 'guidebot-thanks',
  'guidebot-hello', 'guidebot-okay', 'guidebot-laugh', 'guidebot-wow', 'guidebot-sad', 'guidebot-sorry', 'guidebot-congrats', 'guidebot-cheer', 'guidebot-love', 'guidebot-tired', 'guidebot-good-night', 'guidebot-good-morning',
  'guidebot-joining', 'guidebot-cant-make-it', 'guidebot-check-time', 'guidebot-change-time', 'guidebot-meet-here', 'guidebot-where-are-you', 'guidebot-leaving', 'guidebot-running-late', 'guidebot-wait', 'guidebot-arrived', 'guidebot-im-home', 'guidebot-call',
  'guidebot-meal', 'guidebot-coffee', 'guidebot-walk', 'guidebot-photo', 'guidebot-send-photo', 'guidebot-rain', 'guidebot-rest', 'guidebot-recommend', 'guidebot-booked', 'guidebot-saved-seat', 'guidebot-good-time', 'guidebot-again',
] as const);
export type ChatStickerId = typeof chatStickerIds[number];
const stickerIds: ReadonlySet<string> = new Set(chatStickerIds);
export function isChatStickerId(value: unknown): value is ChatStickerId {
  return typeof value === 'string' && stickerIds.has(value);
}
