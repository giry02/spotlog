import { expandedCompanionPoses, type ChatStickerId, type CompanionStickerPackId, type MascotStickerTheme } from './chatExpressionContract.ts';

const entries = [
  ['roundglasses', 'roundglasses-thumbs-up', '좋아요!', new URL('./sticker-art/round-glasses/thumbs-up.webp', import.meta.url).href, 'starter'],
  ['roundglasses', 'roundglasses-hello', '반가워!', new URL('./sticker-art/round-glasses/hello.webp', import.meta.url).href, 'starter'],
  ['roundglasses', 'roundglasses-thanks', '고마워요', new URL('./sticker-art/round-glasses/thanks.webp', import.meta.url).href, 'starter'],
  ['roundglasses', 'roundglasses-thinking', '생각 중', new URL('./sticker-art/round-glasses/thinking.webp', import.meta.url).href, 'daily'],
  ['roundglasses', 'roundglasses-come-along', '같이 가자', new URL('./sticker-art/round-glasses/come-along.webp', import.meta.url).href, 'outing'],
  ['roundglasses', 'roundglasses-booked', '예약했어요', new URL('./sticker-art/round-glasses/booked.webp', import.meta.url).href, 'planning'],
  ['roundglasses', 'roundglasses-tea', '차 한 잔?', new URL('./sticker-art/round-glasses/tea.webp', import.meta.url).href, 'outing'],
  ['roundglasses', 'roundglasses-five-minutes', '5분만!', new URL('./sticker-art/round-glasses/five-minutes.webp', import.meta.url).href, 'planning'],
  ['roundglasses', 'roundglasses-take-time', '천천히 와', new URL('./sticker-art/round-glasses/take-time.webp', import.meta.url).href, 'daily'],
  ['purplescarf', 'purplescarf-excited', '신난다!', new URL('./sticker-art/purple-scarf/excited.webp', import.meta.url).href, 'starter'],
  ['purplescarf', 'purplescarf-high-five', '하이파이브!', new URL('./sticker-art/purple-scarf/high-five.webp', import.meta.url).href, 'starter'],
  ['purplescarf', 'purplescarf-wow', '대박!', new URL('./sticker-art/purple-scarf/wow.webp', import.meta.url).href, 'daily'],
  ['purplescarf', 'purplescarf-go', '출발하자!', new URL('./sticker-art/purple-scarf/go.webp', import.meta.url).href, 'planning'],
  ['purplescarf', 'purplescarf-found-the-way', '길 찾았어!', new URL('./sticker-art/purple-scarf/found-the-way.webp', import.meta.url).href, 'planning'],
  ['purplescarf', 'purplescarf-fresh-air', '바람 쐬자', new URL('./sticker-art/purple-scarf/fresh-air.webp', import.meta.url).href, 'outing'],
  ['purplescarf', 'purplescarf-snack', '간식 먹자', new URL('./sticker-art/purple-scarf/snack.webp', import.meta.url).href, 'outing'],
  ['purplescarf', 'purplescarf-selfie', '같이 찍자', new URL('./sticker-art/purple-scarf/selfie.webp', import.meta.url).href, 'starter'],
  ['purplescarf', 'purplescarf-see-you', '또 만나!', new URL('./sticker-art/purple-scarf/see-you.webp', import.meta.url).href, 'daily'],
] as const satisfies readonly (readonly [CompanionStickerPackId, ChatStickerId, string, string, MascotStickerTheme])[];

export const companionStickers = Object.freeze(entries.map(([pack, id, label, src]) =>
  Object.freeze({ id, name: label, label, pack, src }),
));

// Keep the released sticker objects unchanged; their theme is a picker concern.
const originalCompanionThemes = new Map<ChatStickerId, MascotStickerTheme>(entries.map(([, id, , , theme]) => [id, theme]));
export function companionStickerTheme(id: ChatStickerId): MascotStickerTheme | undefined {
  return originalCompanionThemes.get(id);
}

type ExpandedPose = typeof expandedCompanionPoses[number]['pose'];
const expandedLabels = {
  hello: '안녕!', okay: '알겠어!', laugh: '웃겨!', wow: '깜짝이야!', sad: '속상해', sorry: '미안해',
  congrats: '축하해!', cheer: '힘내!', love: '좋아해', 'good-night': '잘 자', 'good-morning': '좋은 아침!',
  joining: '참석할게!', 'cant-make-it': '오늘은 못 가', 'check-time': '시간 확인', 'change-time': '시간 바꿀까?',
  'meet-here': '여기서 만나', 'where-are-you': '어디야?', leaving: '출발!', 'running-late': '조금 늦어요',
  arrived: '도착!', 'im-home': '집에 왔어', call: '전화할게',
  meal: '밥 먹자', coffee: '커피 한 잔?', walk: '산책 가자', photo: '사진 찍자', 'send-photo': '사진 보내줘',
  rain: '비 와요', rest: '잠깐 쉬자', recommend: '여기 좋아', booked: '예약했어요',
  'saved-seat': '자리 맡아뒀어', 'good-time': '오늘 즐거웠어', again: '또 만나!',
} as const satisfies Record<ExpandedPose, string>;

function expandedCompanionArtUrl(pack: CompanionStickerPackId, pose: ExpandedPose) {
  switch (pack) {
    case 'roundglasses': return new URL(`./sticker-art/round-glasses/${pose}.webp`, import.meta.url).href;
    case 'purplescarf': return new URL(`./sticker-art/purple-scarf/${pose}.webp`, import.meta.url).href;
  }
}

export const expandedCompanionStickers = Object.freeze(expandedCompanionPoses.map(({ pack, id, theme, pose }) =>
  Object.freeze({
    id, name: expandedLabels[pose], label: expandedLabels[pose], pack, theme, src: expandedCompanionArtUrl(pack, pose),
  }),
));
