/** Stored-message validation must not initialize the chat artwork or picker. */
export type ChatStickerPackId = 'bunny' | 'cat' | 'bear' | 'duck';
export const chatStickerIds = Object.freeze([
  'bunny-hi', 'bunny-love', 'bunny-cheer', 'bunny-thanks', 'bunny-laugh',
  'bunny-tears', 'bunny-sleep', 'bunny-coffee', 'bunny-okay', 'bunny-nope',
  'cat-hi', 'cat-thanks', 'cat-okay', 'cat-cheer', 'cat-laugh', 'cat-sorry', 'cat-coffee', 'cat-sleep',
  'bear-hi', 'bear-thanks', 'bear-okay', 'bear-cheer', 'bear-laugh', 'bear-sorry', 'bear-coffee', 'bear-sleep',
  'duck-hi', 'duck-thanks', 'duck-okay', 'duck-cheer', 'duck-laugh', 'duck-sorry', 'duck-coffee', 'duck-sleep',
] as const);
export type ChatStickerId = typeof chatStickerIds[number];
const stickerIds: ReadonlySet<string> = new Set(chatStickerIds);
export function isChatStickerId(value: unknown): value is ChatStickerId {
  return typeof value === 'string' && stickerIds.has(value);
}
