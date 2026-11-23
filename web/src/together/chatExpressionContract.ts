/** Stored-message validation must not initialize the chat artwork or picker. */
export const mascotStickerPackIds = Object.freeze(['pebble', 'guidebot', 'backpack', 'cloud', 'otter', 'thermos'] as const);
export type MascotStickerPackId = typeof mascotStickerPackIds[number];
export const companionStickerPackIds = Object.freeze(['roundglasses', 'purplescarf'] as const);
export type CompanionStickerPackId = typeof companionStickerPackIds[number];
export type ChatStickerPackId = 'bunny' | 'cat' | 'bear' | 'duck' | 'redcap' | CompanionStickerPackId | MascotStickerPackId;

export const mascotStickerPoses = Object.freeze({
  starter: Object.freeze(['thumbs-up', 'on-my-way', 'thanks'] as const),
  daily: Object.freeze(['hello', 'okay', 'laugh', 'wow', 'sad', 'sorry', 'congrats', 'cheer', 'love', 'tired', 'good-night', 'good-morning'] as const),
  planning: Object.freeze(['joining', 'cant-make-it', 'check-time', 'change-time', 'meet-here', 'where-are-you', 'leaving', 'running-late', 'wait', 'arrived', 'im-home', 'call'] as const),
  outing: Object.freeze(['meal', 'coffee', 'walk', 'photo', 'send-photo', 'rain', 'rest', 'recommend', 'booked', 'saved-seat', 'good-time', 'again'] as const),
});
export type MascotStickerTheme = keyof typeof mascotStickerPoses;
export type MascotStickerPose = typeof mascotStickerPoses[MascotStickerTheme][number];
export const mascotStickerThemes = Object.freeze(Object.keys(mascotStickerPoses) as MascotStickerTheme[]);
export function mascotStickerId(pack: MascotStickerPackId, pose: MascotStickerPose): `${MascotStickerPackId}-${MascotStickerPose}` {
  return `${pack}-${pose}`;
}
const mascotStickerIds = mascotStickerPackIds.flatMap(pack => mascotStickerThemes.flatMap(theme =>
  mascotStickerPoses[theme].map(pose => mascotStickerId(pack, pose)),
));

const companionExpansionThemes = ['daily', 'planning', 'outing'] as const;
type CompanionExpansionTheme = typeof companionExpansionThemes[number];
const companionPoses = {
  roundglasses: {
    daily: ['okay', 'laugh', 'wow', 'sad', 'sorry', 'congrats', 'cheer', 'love', 'good-night', 'good-morning'],
    planning: ['joining', 'cant-make-it', 'check-time', 'change-time', 'meet-here', 'where-are-you', 'leaving', 'arrived', 'im-home', 'call'],
    outing: ['meal', 'walk', 'photo', 'send-photo', 'rain', 'rest', 'recommend', 'saved-seat', 'good-time', 'again'],
  },
  purplescarf: {
    daily: ['hello', 'okay', 'laugh', 'sad', 'sorry', 'congrats', 'cheer', 'love', 'good-night', 'good-morning'],
    planning: ['joining', 'cant-make-it', 'check-time', 'change-time', 'meet-here', 'where-are-you', 'running-late', 'arrived', 'im-home', 'call'],
    outing: ['meal', 'coffee', 'walk', 'photo', 'send-photo', 'rain', 'rest', 'recommend', 'booked', 'saved-seat'],
  },
} as const satisfies Record<CompanionStickerPackId, Record<CompanionExpansionTheme, readonly MascotStickerPose[]>>;
type CompanionExpansionStickerId = {
  [Pack in CompanionStickerPackId]: `${Pack}-${(typeof companionPoses)[Pack][CompanionExpansionTheme][number]}`;
}[CompanionStickerPackId];
export const expandedCompanionPoses = Object.freeze(companionStickerPackIds.flatMap(pack =>
  companionExpansionThemes.flatMap(theme => companionPoses[pack][theme].map(pose => Object.freeze({
    pack, theme, pose, id: `${pack}-${pose}` as CompanionExpansionStickerId,
  }))),
));
export const expandedRedCapStickerIds = Object.freeze(['redcap-love', 'redcap-tired', 'redcap-good-morning'] as const);

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
  ...mascotStickerIds,
  ...expandedCompanionPoses.map(sticker => sticker.id),
  ...expandedRedCapStickerIds,
] as const);
export type ChatStickerId = typeof chatStickerIds[number];
const stickerIds: ReadonlySet<string> = new Set(chatStickerIds);
export function isChatStickerId(value: unknown): value is ChatStickerId {
  return typeof value === 'string' && stickerIds.has(value);
}
