import type { TogetherPhotoAttachment, TogetherPost, TogetherState } from './model.ts';

const minute = 60_000;
const hour = 60 * minute;

type DemoPost = Omit<TogetherPost, 'createdAt' | 'comments'> & {
  at: number;
  comments: ReadonlyArray<readonly [authorId: string, body: string]>;
};

function scenePhoto(id: string, file: string, caption: string): TogetherPhotoAttachment {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
  return { id, url: base + 'media/groups/' + file + '-20261109.jpg', caption: caption + ' · 예시 사진' };
}

const originalFamilyReviewBody = '많은 곳보다 함께 쉬어 간 시간이 좋았어요. 다음에도 중간에 카페 시간을 넣으면 좋겠어요.';
const familyReviewStory = [
  '바닷길에 들어설 때는 저 끝까지 걸어 볼까 했어요. 막상 물결 소리가 들리니 저절로 걸음이 느려지더라고요. 아이들이 사진을 찍는 동안 저는 벤치에 앉아 바다를 봤어요. 다들 하나둘 옆에 앉아서 점심 먹을 때 있었던 얘기로 한참 웃었네요.',
  '바람이 세지면서 손이 차가워져 카페로 들어갔어요. 따뜻한 차를 한 잔씩 앞에 두고 방금 찍은 사진을 같이 넘겨 봤어요. 하나, 둘, 셋 하기 전에 제가 눈을 감아 버린 사진이 제일 인기였어요. 사진을 보다가 한 잔을 다 마신 줄도 몰랐네요.',
  '돌아오는 길에 어디를 더 들를까 물었더니 다들 오늘은 이쯤이면 충분하다고 하더라고요. 집에 와서 사진을 다시 보는데, 바다 앞에서 서로 발걸음을 맞춰 주던 순간이 떠올랐어요. 다음 가족 나들이도 그 정도 속도면 좋겠다 싶었어요.',
  '다음에는 바람 막을 얇은 겉옷을 하나씩 챙기고, 바닷길은 다들 편한 데까지만 걷고 싶어요. 중간에 카페나 벤치에 앉아 쉴 시간도 남겨 두려고요. 그래야 또 마음에 드는 풍경 앞에서 한참 머물 수 있으니까요.',
].join('\n\n');

function findFamilyBoardReview(state: TogetherState, viewerId: string) {
  const group = state.groups.find(item => item.id === 'family-busan' && item.ownerId === viewerId
    && item.visibility === 'PRIVATE' && !item.archived && item.spaceType !== 'ACTIVITY');
  if (!group) return;
  const post = state.posts.find(item => item.id === 'family-post' && item.groupId === group.id
    && item.activityId === 'family-past' && item.authorId === 'example-parent' && item.category === 'REVIEW'
    && item.title === '천천히 걸어서 더 좋았던 하루' && !item.publicPreview);
  if (!post || ![viewerId, post.authorId].every(id => group.memberIds.includes(id)
    && !group.blockedMemberIds?.includes(id) && state.members.some(member => member.id === id))) return;
  return { group, post };
}

/** Enrich the original sample in its private demo room without replacing stored edits. */
export function addFamilyBoardReviewPhotos(state: TogetherState, viewerId: string): void {
  const review = findFamilyBoardReview(state, viewerId);
  if (!review) return;
  const { post } = review;
  if (post.body === originalFamilyReviewBody) post.body = familyReviewStory;
  if (post.attachments === undefined) {
    post.attachments = [
      scenePhoto('family-post-example-coast', 'coastal-walking', '천천히 걸었던 바닷길'),
      scenePhoto('family-post-example-cafe', 'cafe-conversation', '산책 중 함께 쉬어 간 카페'),
    ];
  }
}

export function addFamilyBoardReviewReplies(state: TogetherState, viewerId: string, now: Date): void {
  const review = findFamilyBoardReview(state, viewerId);
  if (!review) return;
  const { group, post } = review;
  const sibling = 'example-sibling';
  if (post.body !== familyReviewStory || post.comments.length || !group.memberIds.includes(sibling)
    || group.blockedMemberIds?.includes(sibling) || !state.members.some(member => member.id === sibling)
    || !state.activities.some(activity => activity.id === post.activityId && activity.groupId === group.id)) return;
  const parentId = 'family-post-demo-comment';
  post.comments.push(
    { id: parentId, authorId: sibling, body: '나도 벤치에서 바다 보던 시간이 제일 좋았어. 다음엔 카페를 코스 중간에 넣어 볼까?', createdAt: new Date(now.getTime() - 2 * hour).toISOString() },
    { id: 'family-post-demo-reply', parentId, authorId: post.authorId,
      body: '그래. 이번에도 카페에서 손 녹이니까 남은 길 걷기가 훨씬 편했어. 다음엔 창가 자리 있으면 거기 앉자.', createdAt: new Date(now.getTime() - hour).toISOString() },
  );
}

/** Review-account examples use the existing synthetic scene photos and preserve stored posts. */
export function addReviewDemoPosts(state: TogetherState, viewerId: string, now: Date): void {
  const clock = now.getTime();
  const family = 'family-busan', friends = 'weekend-walk';
  const parent = 'example-parent', sibling = 'example-sibling', friend = 'example-friend', guide = 'example-guide';

  const add = ({ at, comments, ...post }: DemoPost) => {
    if (state.posts.some(item => item.id === post.id)) return;
    const ownerId = post.groupId === family ? viewerId : friend;
    const group = state.groups.find(item => item.id === post.groupId && item.visibility === 'PRIVATE'
      && item.ownerId === ownerId && !item.archived && item.spaceType !== 'ACTIVITY');
    if (!group) return;
    const isMember = (id: string) => group.memberIds.includes(id) && !group.blockedMemberIds?.includes(id)
      && state.members.some(item => item.id === id);
    if (!isMember(viewerId) || !isMember(post.authorId)) return;
    state.posts.push({
      ...post,
      createdAt: new Date(at).toISOString(),
      likes: post.likes.filter(isMember),
      comments: comments.flatMap(([authorId, body], index) => isMember(authorId) ? [{
        id: post.id + '-comment-' + (index + 1),
        authorId,
        body,
        createdAt: new Date(Math.min(clock, at + (index + 1) * 35 * minute)).toISOString(),
      }] : []),
    });
  };

  const past = state.activities.find(item => item.id === 'family-past' && item.groupId === family && item.status === 'COMPLETED');
  const pastEnd = past ? Date.parse((past.endDate || past.date) + 'T17:00:00+09:00') : NaN;
  if (past && Number.isFinite(pastEnd) && pastEnd < clock) {
    add({
      id: 'review-demo-family-coast', groupId: family, activityId: past.id, authorId: parent, category: 'REVIEW',
      title: '바다 보면서 쉬었던 오후',
      body: '점심 먹고 바닷길을 조금 걷다가 벤치에 앉았는데, 거기서 한참 이야기한 게 제일 기억에 남네. 바람이 세서 카페에 일찍 들어갔는데 덕분에 다들 안 지치고 돌아왔어.\n\n다음엔 바닷가에 갈 때 얇은 겉옷 하나씩 챙기자.',
      at: Math.min(clock, pastEnd + 21 * hour),
      likes: [viewerId, sibling],
      attachments: [
        scenePhoto('review-demo-family-coast-walk', 'coastal-walking', '바다 옆 산책길'),
        scenePhoto('review-demo-family-coast-cafe', 'cafe-conversation', '바람을 피해 쉬어 간 카페'),
      ],
      comments: [
        [viewerId, '맞아요. 다음 일정에도 중간에 아무것도 안 하는 시간 한 칸 남겨 둘게요.'],
        [parent, '좋지. 다음엔 따뜻한 차도 같이 마시자 ☕'],
      ],
    });
    add({
      id: 'review-demo-family-lunch', groupId: family, activityId: past.id, authorId: viewerId, category: 'REVIEW',
      title: '걷기는 짧게, 점심은 천천히',
      body: '점심시간을 넉넉히 잡으니 밥 먹다가 다음 장소로 서두를 일이 없었어요. 같이 나눠 먹을 수 있는 메뉴로 고른 것도 편했고요. 다만 오후에 바닷길로 다시 나갈 때 바람이 세서, 다음엔 식당에서 바로 카페로 가는 동선도 하나 표시해 둘까 해요.',
      at: Math.min(clock, pastEnd + 17 * hour),
      likes: [parent, sibling],
      attachments: [scenePhoto('review-demo-family-lunch-table', 'friends-shared-meal', '서로 덜어 먹은 한 끼')],
      comments: [
        [parent, '점심 한 시간 넘게 앉아 있었지? 그게 딱 좋았어.'],
      ],
    });
  }

  add({
    id: 'review-demo-family-rain-question', groupId: family, authorId: sibling, category: 'QUESTION',
    title: '비 오면 어디서 만날까?',
    body: '다음 나들이 날 비가 오면 바다 산책은 짧게 하고 실내에서 만나는 건 어때요? 역에서 많이 걷지 않고 앉아 있기 편한 곳이면 좋겠어요. 생각나는 곳 있으면 댓글로 알려 주세요.',
    at: clock - 5 * hour,
    likes: [viewerId],
    comments: [
      [parent, '밖에서 오래 기다리지만 않으면 좋아. 따뜻한 데면 더 좋고.'],
      [viewerId, '역 근처 카페랑 실내 전시 한 곳씩 찾아서 비교해 볼게요.'],
    ],
  });
  add({
    id: 'review-demo-friends-book-cafe', groupId: friends, authorId: friend, category: 'REVIEW',
    title: '커피 식을 때까지 책 얘기',
    body: '각자 읽다가 밑줄 친 한 문장만 읽었는데 생각보다 이야기가 길어졌어요. 같은 문장을 듣고 누군가는 여행을, 누군가는 첫 출근을 떠올린 게 재미있었어요. 다음에도 다 읽고 올 필요 없이 읽고 싶은 부분만 가져와요.',
    at: clock - 30 * hour,
    likes: [viewerId, guide],
    attachments: [scenePhoto('review-demo-friends-book-table', 'neighborhood-bookclub', '책과 커피를 펼쳐 놓은 테이블')],
    comments: [
      [guide, '책 안 읽은 날에도 한 문장만 들고 갈 수 있어서 부담 없었어요.'],
      [viewerId, '다음엔 짧은 여행 에세이 한 페이지 들고 가 볼게요!'],
    ],
  });
  add({
    id: 'review-demo-friends-reading-note', groupId: friends, authorId: guide, category: 'FREE',
    title: '이번에는 밑줄 하나만 가져오기',
    body: '토요일에는 책 한 권 통째로 소개하기보다 같이 들려주고 싶은 문장 하나씩 가져와요. 종이책이어도 좋고 휴대폰에 적어 온 메모여도 좋아요. 지난번처럼 메뉴 고르는 시간도 넉넉히 잡으면 좋겠어요.',
    at: clock - 4 * hour,
    likes: [friend],
    comments: [
      [friend, '좋아요! 인사하고 주문한 뒤에 편한 사람부터 한 문장씩 나눠요.'],
    ],
  });
}
