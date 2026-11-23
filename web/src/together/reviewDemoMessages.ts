import type { Place } from '../data';
import type { MessageReactionEmoji } from './chatActions.ts';
import type { ChatStickerId } from './chatExpressionContract.ts';
import { roomIdForActivity, roomIdForGroup, type TogetherMessage, type TogetherState } from './model.ts';
import { placeProposalBody, placeProposalDestinations, placeProposalPreview, placeProposalVersion, proposeSavedPlace } from './placeProposal.ts';
import { resolveRoomIdentity } from './roomIdentity.ts';

type DemoSpeaker = 'viewer' | 'parent' | 'sibling' | 'friend' | 'guide';

interface DemoLine {
  key: string;
  by: DemoSpeaker;
  body?: string;
  reply?: string;
  mention?: DemoSpeaker;
  reaction?: [MessageReactionEmoji, DemoSpeaker[]];
  sticker?: ChatStickerId;
  placeId?: string;
}

interface RoomDialogue {
  groupId: 'family-busan' | 'weekend-walk';
  activityId?: 'family-next' | 'friends-next';
  anchorId: string;
  introducedIn?: 2;
  lines: DemoLine[];
}

const dialogues: RoomDialogue[] = [
  {
    groupId: 'family-busan', anchorId: 'family-general-2',
    lines: [
      { key: 'family-photo-request', by: 'parent', body: '지난번 파도 치던 사진 있지? 그거 한 장만 더 올려 줘. 집에 와서 보니까 내가 찍은 건 다 수평이 기울었더라 ㅎㅎ' },
      { key: 'family-photo-answer', by: 'sibling', body: '있지 ㅋㅋ 수평 맞춰서 저녁에 사진첩에 올릴게요. 같이 찍은 사진은 여기서만 봐요.', reply: 'family-photo-request', reaction: ['❤️', ['parent', 'viewer']] },
      { key: 'family-review', by: 'viewer', body: '지난 나들이 후기도 다시 읽었는데, 저는 그냥 아무 말 없이 바다 보던 시간이 제일 좋았어요.' },
      { key: 'family-wind', by: 'parent', body: '맞아. 바람 불어서 모자 붙들고 셋이 웃던 건 사진에 없네 😂', reply: 'family-review' },
      { key: 'family-sticker', by: 'sibling', sticker: 'redcap-had-fun' },
      { key: 'family-next-idea', by: 'sibling', body: '날 풀리면 영도 쪽도 한 번 갈까요? 날 좋은 주말 잡아서 따로요.' },
      { key: 'family-next-place', by: 'sibling', placeId: 'public-busan-taejongdae' },
      { key: 'family-next-condition', by: 'parent', body: '좋지. 근데 한 바퀴 다 걷는 건 욕심이고, 바다 보이는 데까지만 가 보자.', reply: 'family-next-idea' },
      { key: 'family-restaurant', by: 'viewer', body: '밥 먹고 산책하는 쪽으로 찬성이요. 점심부터 정하면 동선 짜기 편할 듯!' },
      { key: 'family-pick-weekend', by: 'sibling', body: '다음 달 첫째 주랑 둘째 주 중에 언제 편하세요? 일단 되는 주말만 알려 주세요.', mention: 'parent' },
      { key: 'family-pick-answer', by: 'parent', body: '나는 둘째 주가 나아. 아빠한테도 물어보고 다시 얘기할게.', reply: 'family-pick-weekend' },
      { key: 'family-reminder', by: 'viewer', body: '그럼 날짜는 아직 미정! 이번 부산 얘기는 여행방에 남겨주세요. 여기서는 다음 산책 날짜만 볼게요.', reaction: ['👍', ['parent', 'sibling']] },
    ],
  },
  {
    groupId: 'family-busan', anchorId: 'review-demo-family-reminder', introducedIn: 2,
    lines: [
      { key: 'family-board-added-photos', by: 'parent', body: '게시판에 썼던 ‘천천히 걸어서 더 좋았던 하루’에 바닷길이랑 카페 사진도 붙여 뒀어. 한참 들여다봤네.' },
      { key: 'family-board-table-photo', by: 'sibling', body: '카페 테이블 나온 사진 좋네요. 따뜻한 거 시켜 놓고 한참 떠들었던 게 생각나요.', reply: 'family-board-added-photos', reaction: ['❤️', ['parent', 'viewer']] },
      { key: 'family-board-path-photo', by: 'viewer', body: '전 바닷길 사진이요. 사진만 보면 한참 걸은 것 같은데 벤치 보일 때마다 앉았잖아요 ㅋㅋ' },
      { key: 'family-board-bench-reply', by: 'parent', body: '그게 좋았지. 바람 적은 데 찾아서 앉았을 때 간식도 꺼내 먹었고.', reply: 'family-board-path-photo' },
      { key: 'family-board-cafe-memory', by: 'sibling', body: '그날 카페에선 메뉴판 한참 보고 결국 원래 마시려던 거 시켰지요 😂', reaction: ['😂', ['viewer', 'parent']] },
      { key: 'family-board-photo-sticker', by: 'viewer', sticker: 'redcap-photo' },
      { key: 'family-board-comment', by: 'viewer', body: '사진은 글이랑 같이 보니까 찾기 편하네요. 그날 어디서 쉬었는지도 댓글에 짧게 적어 둘게요.', reply: 'family-board-added-photos' },
      { key: 'family-board-name', by: 'parent', body: '응. 나는 다음에 가도 벤치에서 한 번 쉬고 카페 들어가는 순서면 좋겠어.' },
      { key: 'family-week-update', by: 'sibling', body: '다들 이번 주는 좀 어때요? 저는 이번 토요일은 오전 일이 있어서 저녁쯤이나 움직일 수 있어요.' },
      { key: 'family-week-parent', by: 'parent', body: '나는 오전에 장 보고 나면 집에 있을 거야. 급한 약속 없으니 저녁 시간 억지로 맞추지 말자.', reply: 'family-week-update' },
      { key: 'family-week-viewer', by: 'viewer', body: '저도 이번 주는 집 정리 좀 할래요. 나들이는 아까 얘기한 다음 달 둘째 주부터 보면 좋겠어요.' },
      { key: 'family-week-dad', by: 'parent', body: '아빠는 일요일 오후 쪽이 편하대. 아직 달력에 표시만 해 둘게.' },
      { key: 'family-week-calendar', by: 'sibling', body: '일요일 오후로 일단 후보 하나 잡아둘게요. 토요일 되는지도 이따 일정 보고 알려 드릴게요.', reply: 'family-week-dad' },
      { key: 'family-week-early', by: 'viewer', body: '황급히 나오지 않게 점심 지나서 만나면 좋겠네요. 바닷가에서 늦게까지 있을 필요는 없고요.' },
      { key: 'family-week-parent-ok', by: 'parent', body: '좋아. 늦게 끝나지만 않으면 나도 오후가 편해.', reply: 'family-week-early', reaction: ['👍', ['viewer', 'sibling']] },
      { key: 'family-week-thanks-sticker', by: 'sibling', sticker: 'redcap-thanks' },
      { key: 'family-options-two-paths', by: 'viewer', body: '영도 갈 땐 날 맑으면 태종대 조금 걷고, 바람 세거나 비 오면 실내에서 쉬는 쪽으로 나눠 보면 어때요?' },
      { key: 'family-options-cafe', by: 'sibling', body: '실내 쪽은 창가에 앉아서 배 구경할 수 있는 카페를 하나 후보로 올려요.' },
      { key: 'family-options-piark', by: 'sibling', placeId: 'catalog-busan-piark' },
      { key: 'family-options-window', by: 'parent', body: '창가 좋다. 자리 없으면 기다리느라 시간 다 쓰지 말고 근처 다른 데도 봐 두자.', reply: 'family-options-cafe' },
      { key: 'family-options-slope', by: 'viewer', body: '걷는 구간 짧은 쪽으로 볼게요. 주차장에서 입구까지 얼마나 가는지랑 중간에 앉을 곳도 확인해 볼게요.', mention: 'parent' },
      { key: 'family-options-sweater', by: 'parent', body: '고마워. 날 맑아도 바다 쪽은 얇은 겉옷 하나 갖고 나가면 되겠다.', reply: 'family-options-slope' },
      { key: 'family-options-lunch-only', by: 'sibling', body: '비 많이 오면 점심이랑 카페만 하고 들어와도 좋죠. 우산 들고 굳이 멀리 걷지 말고요.' },
      { key: 'family-options-practical', by: 'viewer', body: '좋아요. 멀리 옮겨 다니지 않게 점심 후보는 카페 가는 길에 같이 보고요.', reply: 'family-options-lunch-only', reaction: ['✅', ['parent', 'sibling']] },
      { key: 'family-options-camera', by: 'parent', body: '사진은 이번엔 지우한테 부탁할래. 나는 잘 걷다가 맛있는 것만 먼저 찾을게 ㅎㅎ', mention: 'sibling' },
      { key: 'family-options-camera-reply', by: 'sibling', body: '맡겨요. 이번엔 세로 사진도 찍어 둘게요. 지난번엔 죄다 가로였더라고요.', reply: 'family-options-camera' },
      { key: 'family-options-forecast', by: 'viewer', body: '날짜는 아직 후보로 두고, 주말 가까워지면 날씨랑 갈 곳 한 번에 확인해요. 그때 단톡에 남길게요.' },
      { key: 'family-options-wrap', by: 'parent', body: '응, 급하게 고르지 말자. 지난번처럼 천천히 보고 와도 충분히 좋았으니까.', reply: 'family-options-forecast', reaction: ['❤️', ['viewer', 'sibling']] },
    ],
  },
  {
    groupId: 'family-busan', activityId: 'family-next', anchorId: 'family-chat-6',
    lines: [
      { key: 'trip-meeting-check', by: 'sibling', body: '만나는 곳은 공지에 올라온 출구로 갈게요. 먼저 도착하면 개찰구 말고 출구 앞에서 기다릴게요.' },
      { key: 'trip-packing', by: 'parent', body: '나는 작은 물병 챙겨 갈게. 오래 걷는 날 아니어도 물은 있어야지.' },
      { key: 'trip-battery', by: 'sibling', body: '보조배터리는 제가 챙겨요. C타입 선 하나만 더 있으면 같이 쓸 수 있어요.', reaction: ['✅', ['parent', 'viewer']] },
      { key: 'trip-cable', by: 'viewer', body: '선은 제 가방에 넣어둘게요. 엄마 폰에 맞는 것도 하나 챙겼어요.', reply: 'trip-battery' },
      { key: 'trip-lunch-question', by: 'parent', body: '기차에서 아침만 간단히 먹을 거라 점심 너무 늦으면 배고플 것 같은데, 먼저 밥 먹고 움직이면 어때?' },
      { key: 'trip-lunch-answer', by: 'viewer', body: '저도 그게 좋겠어요. 식당은 투표 결과 보고 고르고, 대기 길면 역 근처에서 간단히 먹는 걸로 다시 얘기해요.', reply: 'trip-lunch-question' },
      { key: 'trip-lunch-check', by: 'sibling', body: '점심 후보 전화할 때 대기 줄이랑 쉬는 시간도 같이 물어봐 줄래요?', mention: 'viewer' },
      { key: 'trip-no-booking', by: 'viewer', body: '네. 영업시간이랑 자리 상황 먼저 확인하고 알려 줄게요.', reply: 'trip-lunch-check' },
      { key: 'trip-walk', by: 'parent', body: '바다 쪽 길은 중간에 앉아서 쉴 데 있으면 좋겠어. 걷다가 기운 빠지면 그날은 한 군데 빼도 돼.' },
      { key: 'trip-walk-answer', by: 'sibling', body: '그럼 바닷길 먼저 조금만 걷고, 나머지는 그때 정해요. 사진 욕심은 제가 참아 볼게요 ㅋㅋ', reply: 'trip-walk', reaction: ['😂', ['viewer', 'parent']] },
      { key: 'trip-rain-option', by: 'sibling', body: '비 오거나 바람 많이 불 땐 실내에서 쉬는 게 낫겠죠? 수영 쪽 카페 하나 보다가 괜찮아서 남겨요.' },
      { key: 'trip-rain-place', by: 'sibling', placeId: 'catalog-busan-momos-domoheon' },
      { key: 'trip-rain-check', by: 'parent', body: '나는 카페 좋다. 바깥은 날씨 봐서 결정하고, 젖은 신발로 오래 안 걷게만 해 줘.', reply: 'trip-rain-option' },
      { key: 'trip-weather-owner', by: 'viewer', body: '날씨는 출발 전날 저녁에 확인해서 여기 남길게요. 우산이나 겉옷 필요한지도 그때 같이 볼게요.' },
      { key: 'trip-coffee-sticker', by: 'parent', sticker: 'redcap-coffee' },
      { key: 'trip-agenda', by: 'sibling', body: '정리하면 집합은 공지대로, 점심은 확인 중, 비 오면 카페 비교! 사진은 돌아와서 한 군데 모아요.', reaction: ['👍', ['parent', 'viewer']] },
    ],
  },
  {
    groupId: 'weekend-walk', anchorId: 'friends-chat-1',
    lines: [
      { key: 'friends-book-too-long', by: 'viewer', body: '지난번 추천받은 책 빌렸는데 생각보다 두껍더라. 아직 첫 장인데 토요일 전에 끝날 리가 없네 ㅋㅋ' },
      { key: 'friends-book-club', by: 'friend', body: '읽은 만큼만 가져와 ㅎㅎ 재밌었던 문장 한 줄이면 충분해.', reply: 'friends-book-too-long', reaction: ['👍', ['viewer']] },
      { key: 'friends-essay', by: 'guide', body: '난 짧은 산문집 들고 갈게. 요즘 긴 이야기보다 짧게 읽고 덮어 둘 수 있는 게 편하더라.' },
      { key: 'friends-photo-people', by: 'friend', body: '지난번 컵이랑 책만 찍은 컷 괜찮던데, 사람 나온 사진은 올리기 전에 서로 물어보자.' },
      { key: 'friends-photo-answer', by: 'viewer', body: '좋아. 여긴 글이랑 사진 모아 두고, 실제로 어디서 모일지는 약속방에서 맞추면 헷갈리지 않겠다.', reply: 'friends-photo-people' },
      { key: 'friends-board-idea', by: 'guide', body: '게시판에 추천 책 이름만 모으는 글 하나 있으면 좋겠다. 제목 또 까먹을 것 같아.' },
      { key: 'friends-board-owner', by: 'friend', body: '그건 내가 정리해 둘게. 이유도 한 줄씩 달면 다음에 고르기 좋을 듯.', reply: 'friends-board-idea' },
      { key: 'friends-snack', by: 'viewer', body: '커피 마신 다음 20분쯤 걸을 사람? 날 괜찮으면 골목 한 바퀴만 돌고 갈래.' },
      { key: 'friends-snack-answer', by: 'guide', body: '나는 걷는 거 찬성. 햇빛 좋으면 밖에서, 비 오면 그냥 한 잔 더 마시자.', reply: 'friends-snack' },
      { key: 'friends-next-theme', by: 'friend', body: '다다음 모임 주제는 다음에 정하자. 책 말고 플레이리스트 한 곡씩 가져오는 것도 재밌겠다.' },
      { key: 'friends-next-theme-reply', by: 'viewer', body: '오 좋다. 노래 사연도 들으면 재밌을 듯. 다음에 이 얘기 다시 꺼내줘!', reply: 'friends-next-theme', reaction: ['❤️', ['friend', 'guide']] },
    ],
  },
  {
    groupId: 'weekend-walk', activityId: 'friends-next', anchorId: 'friends-chat-1',
    lines: [
      { key: 'coffee-first-topic', by: 'friend', body: '토요일 두 시 약속은 그대로 두고 카페만 정하자. 서면에서 만나기 편한 쪽으로 볼까?' },
      { key: 'coffee-noisy-place', by: 'viewer', body: '난 어디든 괜찮은데 음악 너무 큰 데는 피하고 싶어. 가까이 앉아도 잘 안 들리더라.' },
      { key: 'coffee-street-option', by: 'guide', body: '전포에 제가 보던 카페도 하나 넣어 볼게요. 다만 자리 넉넉한지는 가기 전에 확인해 봐야 해요.', reply: 'coffee-noisy-place' },
      { key: 'coffee-proposed-place', by: 'guide', placeId: 'catalog-busan-ogoodthing' },
      { key: 'coffee-walk', by: 'viewer', body: '전포면 지하철 타기 괜찮겠다. 걷기 좋아하는 사람은 끝나고 골목 한 바퀴만 돌아도 좋고.' },
      { key: 'coffee-confirm-how', by: 'friend', body: '좋아. 카페는 아직 결정 전이야. 예약 필요할지 내가 전화해서 물어볼게.', reaction: ['👍', ['viewer', 'guide']] },
      { key: 'coffee-weeks', by: 'guide', body: '저는 조금 늦을 수도 있어요. 두 시 못 맞추면 출발할 때 여기 남길게요.' },
      { key: 'coffee-come-in', by: 'friend', body: '그래. 늦으면 밖에서 기다리지 말고 정해진 카페로 바로 와. 장소 정하면 공지 남길게.', reply: 'coffee-weeks' },
      { key: 'coffee-one-sentence', by: 'viewer', body: '책은 종이책 꼭 가져가야 해? 한 문장만 메모해 놔서 그걸 읽어도 좋을 것 같아.' },
      { key: 'coffee-one-sentence-answer', by: 'friend', body: '메모면 충분해. 좋았던 이유만 각자 한 마디씩 하고, 나머지는 편하게 얘기하자.', reply: 'coffee-one-sentence' },
      { key: 'coffee-cover-reminder', by: 'guide', body: '책 표지 궁금하다고 했죠? 제목이랑 작가 이름도 메모해서 가져갈게요.', mention: 'viewer' },
      { key: 'coffee-wrap', by: 'viewer', body: '나는 제목 적어 갈게. 장소는 전화 결과 보고 정하자!', reaction: ['✅', ['friend', 'guide']] },
    ],
  },
];

const minuteMs = 60_000;
const demoPrefix = 'review-demo-';

export function addReviewDemoMessages(state: TogetherState, viewerId: string, places: Place[], now: Date, afterVersion: 0 | 1 = 0): void {
  const clock = now.getTime();
  if (!Number.isFinite(clock)) return;
  const speakers: Record<DemoSpeaker, string> = {
    viewer: viewerId, parent: 'example-parent', sibling: 'example-sibling', friend: 'example-friend', guide: 'example-guide',
  };
  const currentMember = (userId: string) => state.members.some(member => member.id === userId);

  for (const { groupId, activityId, anchorId, introducedIn, lines } of dialogues) {
    if ((introducedIn ?? 1) <= afterVersion) continue;
    const group = state.groups.find(item => item.id === groupId);
    const expectedOwner = groupId === 'family-busan' ? viewerId : speakers.friend;
    if (!group || group.visibility !== 'PRIVATE' || group.ownerId !== expectedOwner || group.archived || group.spaceType === 'ACTIVITY'
      || group.temporaryRoom || !currentMember(viewerId) || !group.memberIds.includes(viewerId) || group.blockedMemberIds?.includes(viewerId)) continue;
    const roomMember = (userId: string) => currentMember(userId) && group.memberIds.includes(userId) && !group.blockedMemberIds?.includes(userId);
    const activity = activityId ? state.activities.find(item => item.groupId === groupId && item.id === activityId) : undefined;
    if (activityId && (!activity || activity.status !== 'PLANNED')) continue;
    const roomId = activityId ? roomIdForActivity(activityId) : roomIdForGroup(groupId);
    const anchor = Date.parse(state.messages.find(item => item.id === anchorId)?.createdAt ?? '');
    const referenceTime = Number.isFinite(anchor) ? anchor : clock - 45 * minuteMs;
    const firstTime = Math.min(introducedIn === 2 ? Math.max(referenceTime, clock - 45 * minuteMs) : referenceTime, clock - 2 * minuteMs);
    const duration = Math.min(clock - firstTime - 1000, 55 * minuteMs);

    for (const [index, line] of lines.entries()) {
      const authorId = speakers[line.by];
      const id = demoPrefix + line.key;
      const messageId = line.placeId ? 'place-proposal:' + id : id;
      if (!roomMember(authorId) || state.messages.some(item => item.id === messageId)) continue;
      const at = new Date(firstTime + Math.round(duration * (index + 1) / (lines.length + 1)));
      const base = { id: messageId, roomId, authorId, createdAt: at.toISOString() };
      if (line.placeId) {
        const place = places.find(item => item.id === line.placeId && !item.personal && item.name.trim());
        if (!place) continue;
        const body = placeProposalBody(place);
        if (state.messages.some(item => item.roomId === roomId && item.id.startsWith('place-proposal:')
          && (item.placeProposal?.publicPlaceId === place.id || item.body === body))) continue;
        const availableInRoom = activity
          ? activity.placeCandidateIds?.includes(place.id) || activity.revision === 1 && activity.placeCandidateIds === undefined
          : group.interestPlaceIds === undefined;
        const destination = { groupId, activityId };
        const writable = availableInRoom && placeProposalDestinations(state, authorId, now).some(item => item.groupId === groupId && item.activityId === activityId);
        if (writable) {
          proposeSavedPlace(state, authorId, destination, place, placeProposalVersion(place), id, [place.id], at);
        } else {
          // Record a fictional past suggestion without changing an edited destination's candidate list.
          state.messages.push({ ...base, body, placeProposal: { name: placeProposalPreview(place).name, publicPlaceId: place.id } });
        }
        continue;
      }

      const body = line.body ?? '';
      const message: TogetherMessage = { ...base, body };
      const replyId = line.reply ? demoPrefix + line.reply : '';
      if (replyId && state.messages.some(item => item.id === replyId && item.roomId === roomId && !item.deleted)) message.replyToMessageId = replyId;
      if (line.mention) {
        const userId = speakers[line.mention];
        if (roomMember(userId)) {
          const name = resolveRoomIdentity(state, userId, groupId, activityId).name.trim();
          if (name && name.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(name)) {
            const tag = '@' + name;
            message.body = tag + ' ' + body;
            message.mentions = [{ groupId, roomId, userId, start: 0, end: tag.length, text: tag }];
          }
        }
      }
      if (line.reaction) {
        const [emoji, audience] = line.reaction;
        const memberIds = audience.map(speaker => speakers[speaker]).filter(roomMember);
        if (memberIds.length) message.reactions = { [emoji]: memberIds };
      }
      if (line.sticker) message.stickerId = line.sticker;
      state.messages.push(message);
    }
  }
}
