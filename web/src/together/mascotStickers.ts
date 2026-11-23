import {
  mascotStickerId, mascotStickerPackIds, mascotStickerPoses, mascotStickerThemes,
  type MascotStickerPackId, type MascotStickerPose,
} from './chatExpressionContract.ts';

export type { MascotStickerPackId, MascotStickerTheme } from './chatExpressionContract.ts';

const labels = {
  'thumbs-up': '엄지척', 'on-my-way': '가는 중', thanks: '고마워',
  hello: '안녕!', okay: '알겠어!', laugh: '웃겨!', wow: '깜짝이야!', sad: '속상해', sorry: '미안해',
  congrats: '축하해!', cheer: '힘내!', love: '좋아해', tired: '피곤해', 'good-night': '잘 자', 'good-morning': '좋은 아침!',
  joining: '참석할게!', 'cant-make-it': '오늘은 못 가', 'check-time': '시간 확인', 'change-time': '시간 바꿀까?',
  'meet-here': '여기서 만나', 'where-are-you': '어디야?', leaving: '출발!', 'running-late': '조금 늦어요',
  wait: '잠깐만', arrived: '도착!', 'im-home': '집에 왔어', call: '전화할게',
  meal: '밥 먹자', coffee: '차 한 잔?', walk: '산책 가자', photo: '사진 찍자', 'send-photo': '사진 보내줘', rain: '비 와요',
  rest: '잠깐 쉬자', recommend: '여기 좋아', booked: '예약했어요', 'saved-seat': '자리 맡아뒀어', 'good-time': '오늘 즐거웠어', again: '또 만나!',
} as const satisfies Record<MascotStickerPose, string>;

// A static directory in each branch lets Vite bundle the matching local WebPs.
function artUrl(pack: MascotStickerPackId, pose: MascotStickerPose) {
  switch (pack) {
    case 'pebble': return new URL(`./sticker-art/pebble/${pose}.webp`, import.meta.url).href;
    case 'guidebot': return new URL(`./sticker-art/guide-bot/${pose}.webp`, import.meta.url).href;
    case 'backpack': return new URL(`./sticker-art/backpack/${pose}.webp`, import.meta.url).href;
    case 'cloud': return new URL(`./sticker-art/cloud/${pose}.webp`, import.meta.url).href;
    case 'otter': return new URL(`./sticker-art/otter/${pose}.webp`, import.meta.url).href;
    case 'thermos': return new URL(`./sticker-art/thermos/${pose}.webp`, import.meta.url).href;
  }
}

export const mascotStickers = Object.freeze(mascotStickerPackIds.flatMap(pack => mascotStickerThemes.flatMap(theme =>
  mascotStickerPoses[theme].map(pose => Object.freeze({
    id: mascotStickerId(pack, pose), name: labels[pose], label: labels[pose], pack, theme, src: artUrl(pack, pose),
  })),
)));
