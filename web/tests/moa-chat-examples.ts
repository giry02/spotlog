import type { TogetherMessage, TogetherState } from '../src/together/model.ts';
import { MOA_CHAT_EXAMPLE_MESSAGES } from '../src/together/chatSummaryExample.ts';

type Speaker = 'self' | 'mom' | 'jiu';
type Line = readonly [Speaker, string];
export const MOA_REVIEW_VIEWER_ID = 'spotlog-local-review-member';
export const MOA_REVIEW_ROOMS = {
  group: 'group:family-busan', activity: 'activity:family-next', otherActivity: 'activity:family-past', otherGroup: 'activity:friends-next',
} as const;

// Fictional dialogue, authored as a conversation rather than a repeated load-test body.
const activityLines: readonly Line[] = [
  ['self', '부산 가족여행 이야기는 여기에서 이어갈게요. 전체 모임방에 올린 사진 이야기와 섞이지 않게요.'],
  ['jiu', '좋아요. 먼저 기차 도착 시간부터 맞춰볼까요? 저는 아직 승차권을 고르기 전이에요.'],
  ['mom', '너무 이른 출발만 아니면 괜찮아. 아침은 집에서 간단히 먹고 나갈게.'],
  ['self', '부산역에서 모여서 움직이면 차를 따로 가져오지 않아도 될 것 같아요. 이동편은 다시 비교해볼게요.'],
  ['jiu', '처음 생각은 열 시쯤이었는데, 기차가 맞는지 먼저 확인할게요. 아직 모이는 시간으로 확정하지 말아요.'],
  ['mom', '역에서 나올 때 계단 말고 엘리베이터를 이용할 수 있으면 좋겠네.'],
  ['self', '출구별 이동 동선도 같이 볼게요. 지도에 가깝다고 실제로 걷기 편한 건 아닐 수 있어서요.'],
  ['jiu', '엄마 캐리어는 작은 걸로 가져오실 거예요? 짐이 많으면 첫날 들고 다니기 힘들 것 같아요.'],
  ['mom', '이번엔 작은 가방 하나만 가져갈게. 겉옷도 가벼운 걸로 준비하려고.'],
  ['self', '저도 배낭 정도로 갈게요. 짐 보관은 이용 가능 여부와 비용을 확인한 뒤 정해요.'],
  ['jiu', '기차에서 들을 노래 목록부터 만들고 있었어요. 준비보다 신나 하는 사람이 여기 있네요.'],
  ['mom', '노래보다 제때 일어나는 게 먼저다. 알람은 두 개 맞춰 놓자.'],
  ['self', '그건 저도 조심할게요. 출발하는 날 연락이 없으면 이 방에 먼저 남겨주세요.'],
  ['jiu', '첫날은 시장을 길게 걷기보다 한 구역만 보고 쉬면 어떨까요?'],
  ['mom', '한꺼번에 많이 안 봐도 좋아. 바다를 앉아서 보는 시간도 있었으면 해.'],
  ['self', '장소 개수를 자동으로 줄이지는 않을게요. 가고 싶은 후보를 모으고 같이 고르는 걸로 해요.'],
  ['jiu', '음식도 먼저 취향을 물어봐야겠어요. 매운 음식은 다들 어느 정도 괜찮아요?'],
  ['mom', '나는 맵지 않은 국물이나 생선구이가 편해. 회는 다른 사람들 먹고 싶으면 같이 가도 되고.'],
  ['self', '저는 날것을 많이 먹으면 속이 불편해서 익힌 메뉴가 같이 있는 곳이면 좋겠어요.'],
  ['jiu', '그럼 메뉴 선택이 여러 개인 식당을 후보로 찾아볼게요. 지금 보이는 정보가 최신인지도 확인해야겠네요.'],
  ['mom', '줄을 오래 서는 집은 피하고 싶어. 맛도 좋지만 앉아서 편하게 먹는 게 더 중요해.'],
  ['self', '대기 시간은 보장할 수 없으니 당일 상황을 보고 다른 후보로 바꿀 여지도 남겨둬요.'],
  ['jiu', '식당 A는 생선구이 쪽, 식당 B는 국물 메뉴 쪽으로 비교하는 걸로 메모했어요.'],
  ['mom', '이름만 보면 헷갈리니까 메뉴와 계단 있는지도 같이 적어주면 좋겠어.'],
  ['self', '사진에 입구가 안 보이면 있다고 추측하지 말고 문의할 항목으로 남겨둘게요.'],
  ['jiu', '저장한 사진 보다가 갑자기 배고파졌어요. 아직 점심 먹기 전인데요.'],
  ['mom', '오늘 점심부터 잘 챙겨 먹어. 여행 가기 전부터 굶으면 안 되지.'],
  ['self', '맞아요. 일단 각자 밥 먹고 저녁에 후보 두 곳만 다시 이야기해요.'],
  ['jiu', '식당 후보 투표는 열어두었어요. 표가 더 많다고 바로 예약되는 건 아니에요.'],
  ['mom', '나는 A 쪽으로 마음이 가지만 계단이 많으면 B도 괜찮아. 조건 확인하고 바꿀 수 있지?'],
  ['self', '물론이죠. 의견은 바꿀 수 있고, 최종 선택 전에는 둘 다 후보로 두어요.'],
  ['jiu', '아빠도 일정이 확실해지면 참석 여부를 직접 누르시도록 다시 말씀드릴게요.'],
  ['mom', '가족 모임에 있다고 여행까지 전부 따라가는 걸로 생각하면 안 되니까.'],
  ['self', '이번 여행의 참석 상태는 여기 일정에서 따로 확인할게요. 대신 눌러두지는 않을게요.'],
  ['jiu', '카페는 바다 보이는 곳과 역 근처 조용한 곳을 하나씩 후보로 담았어요.'],
  ['mom', '바다가 보여도 의자가 불편하면 오래 앉기 어렵더라. 사진만으로 결정하지 말자.'],
  ['self', '맞아요. 좌석과 화장실, 엘리베이터는 확인할 항목으로 남겨둘게요.'],
  ['jiu', '그리고 음료를 꼭 한 잔씩 주문해야 하는지, 붐비는 시간은 어떤지도 물어보려고요.'],
  ['mom', '커피 말고 따뜻한 차도 있으면 좋겠어. 메뉴가 없으면 다른 카페로 가도 괜찮고.'],
  ['self', '선호사항으로 적어둘게요. 아직 어느 카페에도 자리가 있다고 확인받은 건 아니에요.'],
  ['jiu', '날씨 앱은 조금씩 다르게 나오네요. 지금 비라고 적혀 있다고 일정을 다 바꾸진 말아요.'],
  ['mom', '접는 우산 정도는 가져갈 수 있어. 바람 많이 불면 우산보다 실내에서 쉬고.'],
  ['self', '실내 대안은 후보로만 남기고 출발 전에 다시 이야기해요. 바깥 장소를 지금 삭제하지는 않아요.'],
  ['jiu', '가족 사진은 이번에도 찍고 싶어요. 찍기 싫은 날엔 편하게 말해줘요.'],
  ['mom', '사진은 좋아. 다만 모르는 사람들 보는 곳에 올릴 땐 먼저 물어봐 줘.'],
  ['self', '우리 일정 앨범에 모으는 것과 공개 여행기에 쓰는 건 따로 확인할게요.'],
  ['jiu', '아, 기차 편을 다시 비교해보니 처음 이야기한 도착 예상과 달라졌어요. 모이는 시간부터 다시 맞춰요.'],
  ['mom', '나는 출구를 여러 번 바꾸면 헷갈려. 최종으로 정하면 예전 안내는 따르지 않게 알려줘.'],
  ['self', '네. 이전 시간과 출구를 그대로 복사하지 않고, 바뀐 내용과 최종 안내를 같이 남길게요.'],
  ['jiu', '식당에 전화할 때 인원도 필요하네요. 아직 미정인 사람은 참석 상태부터 확인해주세요.'],
  ['mom', '확인했다는 말과 예약됐다는 말을 구분해주면 좋겠어. 나는 예약 끝난 줄 알고 움직일 수도 있으니까.'],
  ['self', '알겠어요. 예약 여부는 답변을 받은 뒤 따로 표시하고, 지금은 문의와 비교 단계로 둘게요.'],
  ['jiu', '숙소는 날짜와 인원을 넣어 가격만 비교했어요. 결제 화면으로 넘어가진 않았어요.'],
  ['mom', '밤에 조용한지와 엘리베이터 있는지도 알아보자. 가격만 보고 정하지 말고.'],
  ['self', '숙소 후보도 아직 확정하지 않을게요. 예약한 것처럼 일정에 고정 표시하지 않아요.'],
  ['jiu', '최종 만나는 안내를 한 번 모아두니 이제 덜 헷갈리네요. 이전 안내 캡처는 지워둘게요.'],
  ['mom', '응, 부산역 열 시 반에 2번 출구라는 건 기억했어. 다른 방의 모임 시간과 섞지 않을게.'],
  ['self', '늦어지면 예상 도착 시간을 이 여행 채팅에 남겨주세요. 혼자 먼저 다른 출구로 이동하지 말고요.'],
  ['jiu', '충전기 플러그 종류를 확인해보니 저는 C타입이에요. 엄마 휴대폰도 같은 거죠?'],
  ['mom', '같은 거야. 케이블은 있어도 배터리 충전을 안 해오면 소용없으니 미리 충전할게.'],
  ['self', '저는 제 휴대폰과 배터리는 직접 충전할게요. 한 사람이 모두 책임지는 준비물로 만들지 않아요.'],
  ['jiu', '공용 케이블은 제가 여분으로 챙기면 되겠네요. 각자 필요한 충전기는 따로 부탁해요.'],
  ['mom', '물은 작은 물병에 담아가려고. 너무 무거우면 중간에 다시 사도 되고.'],
  ['self', '약은 개인에게 맞는 것만 각자 준비해요. 누가 권했다고 새 약을 먹기로 정하는 건 아니에요.'],
  ['jiu', '엄마 약 챙기는 건 확인했어요. 다른 사람 약까지 대신 정해두진 않을게요.'],
  ['mom', '편한 신발도 꺼내뒀어. 새 신발은 길들일 시간이 없으니 신던 걸로 갈게.'],
  ['self', '동선에서 쉬는 구간은 다시 확인할게요. 지도 직선거리만 보고 걷기 편하다고 말하지 않을게요.'],
  ['jiu', '산책 구간이 길어 보이면 카페 시간을 앞당길 수도 있겠네요. 아직 순서를 바꾼 건 아니에요.'],
  ['mom', '그렇게 후보로 열어두면 좋아. 당일 내 컨디션 보고 얘기할게.'],
  ['self', '카페 후보 투표도 계속 열려 있어요. 점심 식당 투표와는 별개라 두 곳 다 확인해주세요.'],
  ['jiu', '아직 식당 답변이 안 와서 투표를 닫지 않았어요. 먼저 고르고 예약 완료라고 쓰지 않을게요.'],
  ['mom', '내가 식당 A에 찬성한 것도 예약 승인이라는 뜻은 아니야. 조건이 맞는지 먼저 봐줘.'],
  ['self', '네. 좌석·입구·메뉴 답변이 오면 후보와 함께 다시 공유할게요.'],
  ['jiu', '숙소 후보 화면은 가격 변동이 있을 수 있으니 캡처 금액을 확정 비용으로 적지 말아요.'],
  ['mom', '우리 아직 결제한 방 없는 거지? 그러면 취소 수수료도 이미 낸 돈처럼 생각하지 않을게.'],
  ['self', '맞아요. 아직 숙소 예약이나 결제는 없어요. 실제 예약을 정하면 별도로 확인해요.'],
  ['jiu', '여행 전날까지 준비할 일은 체크하고, 확인이 안 된 건 체크하지 않은 채로 남겨둬요.'],
  ['mom', '이야기가 많아지니 예약 얘기는 꼭 구분해서 읽어야겠다. 준비한 것만 완료 표시할게.'],
  ['self', '이 방에서 정한 내용만 이번 부산 여행에 써요. 다른 정모의 장소나 시간을 가져오지 않아요.'],
  ['jiu', '책 모임은 토요일 두 시였죠? 그건 저쪽 정모방에서 다시 확인할게요. 여기에 섞어 적지 않을게요.'],
  ['mom', '좋아. 이번 여행 준비만 한 번 읽어보고 가방 챙길게.'],
  ['self', '시간은 10시 30분, 부산역 2번 출구 안내를 따라주세요. 처음 이야기한 10시나 1번 출구가 아니에요.'],
  ['jiu', '점심·카페·숙소는 아직 후보와 확인 항목이 남아 있어요. 대화 정리에서도 확정처럼 보이면 바로 짚어주세요.'],
  ['mom', '나는 쉬는 시간이 있는 여행이면 좋겠어. 많이 보는 것보다 같이 편하게 다니자.'],
  ['self', '그렇게 준비해요. 오늘 확인하지 못한 건 나중에 답변을 받으면 이어서 적을게요.'],
];

const groupLines: readonly Line[] = [
  ['jiu', '가족 모임방은 여행 하나가 끝나도 계속 두는 거죠? 사진이랑 안부도 여기에서 나누면 좋겠어요.'],
  ['self', '맞아요. 여행마다 약속과 채팅을 따로 만들고, 이 방에서는 가족 전체 이야기를 나눠요.'],
  ['mom', '이번 달은 다들 바빴지? 여행 안 가는 주에도 가끔 밥 한번 먹자.'],
  ['jiu', '좋아요. 그렇다고 이 방에 들어온 사람이 모든 일정에 참석하는 건 아닌 걸로요.'],
  ['self', '각 약속에서 참석·미정·불참을 직접 고르면 돼요. 다른 사람 대신 눌러두지 않을게요.'],
  ['mom', '나는 달력에서 날짜를 보고 정하고 싶어. 가족 여행이랑 친구 만나는 날이 겹칠 수 있어서.'],
  ['jiu', '날짜 없는 아이디어는 아직 확정 약속과 나눠두면 덜 헷갈리겠네요.'],
  ['self', '카페 나들이는 아이디어만 모으는 중이에요. 시간과 장소가 정해진 건 아니에요.'],
  ['mom', '그럼 다음 카페 모임까지 이미 참석한다고 생각하지는 않을게.'],
  ['jiu', '지난 바다 나들이 사진을 정리하다가 엄마 웃는 사진 찾았어요. 앨범에 모아둘게요.'],
  ['mom', '그날 바람 많이 불었는데 사진은 밝게 나왔네. 나중에 같이 보자.'],
  ['self', '개인 사진을 모임 앨범에 올리는 것과 공개 여행기에 쓰는 건 별개로 확인해요.'],
  ['jiu', '사진에 다른 사람이 잘 보이면 공개로 올리기 전에 먼저 물어볼게요.'],
  ['mom', '위치도 집 주소처럼 자세한 건 공개 글에 쓰지 말자.'],
  ['self', '모임 소개에는 관심사와 넓은 지역만 쓰고, 구체적으로 만나는 곳은 해당 약속 안에서 봐요.'],
  ['jiu', '가족 모임은 일단 비공개가 좋겠어요. 여행기 공유한다고 가족 대화까지 공개되면 안 되니까요.'],
  ['mom', '응. 우리끼리 보관한 사진도 밖에 소개하는 사진으로 자동 바뀌지 않았으면 해.'],
  ['self', '다른 모임에 공유할 때도 내가 고른 기록만 전달하는 걸로 해요.'],
  ['jiu', '전체 공지에는 여행방을 어디서 찾는지만 적어둘까요? 음식점 후보까지 여기서 정하면 헷갈릴 것 같아요.'],
  ['mom', '맞아. 부산 여행의 기차 시간은 그 여행 채팅에서 확인할게.'],
  ['self', '중요한 변경은 해당 약속 공지와 대화에서 먼저 남겨주세요. 이 방의 다른 일정 안내와 섞지 않게요.'],
  ['jiu', '그럼 모임방에서는 다음에 하고 싶은 것 정도만 편하게 이야기해요.'],
  ['mom', '나는 가벼운 산책이나 식사가 좋더라. 꼭 멀리 여행하지 않아도 되고.'],
  ['self', '장소만 저장해 두었다가 같이 가고 싶을 때 제안해도 돼요. 저장만 했다고 새 약속을 만들지는 않아요.'],
  ['jiu', '저는 동네 책방 하나 저장해뒀어요. 영업시간부터 확인하고 제안으로 올려볼게요.'],
  ['mom', '책방이면 오래 서 있어야 하나? 앉을 곳 있는지도 나중에 봐줘.'],
  ['self', '아직 가기로 정한 건 아니니 가능한 이용 방식부터 확인해요.'],
  ['jiu', '다음 가족 모임은 한 달에 한 번쯤 어떨까요? 아직 날짜를 고르자는 건 아니에요.'],
  ['mom', '나는 그 정도가 부담 없을 것 같아. 다른 사람 일정도 먼저 물어보자.'],
  ['self', '반복 모임 주기는 의견으로 남길게요. 달력에 매달 약속을 자동으로 넣지는 않아요.'],
  ['jiu', '혹시 모임 알림이 많으면 방별로 조절할 수 있으면 좋겠네요. 놓치면 공지부터 다시 읽고요.'],
  ['mom', '나는 새벽 알림은 조용했으면 좋겠어. 급하지 않은 안부는 낮에 읽을게.'],
  ['self', '답장이 늦어도 재촉하지 않는 걸로 해요. 중요한 약속 변경은 담당자가 따로 확인해주세요.'],
  ['jiu', '사진 정리 담당을 영원히 저로 정한 건 아니죠? 이번 지난 여행만 제가 모아볼게요.'],
  ['mom', '그렇지. 다음에는 나도 좋은 사진 몇 장 골라볼게.'],
  ['self', '담당이 정해진 일과 그냥 아이디어를 나누는 건 나눠둘게요.'],
  ['jiu', '오늘은 여기까지 정리할게요. 부산 여행 준비는 여행방에서 이어서 볼게요.'],
  ['mom', '다들 저녁 잘 챙겨 먹고. 오늘은 날이 쌀쌀하네.'],
  ['self', '엄마도 따뜻하게 입으세요. 안부 남길 공간이 있으니 좋네요.'],
  ['jiu', '이번 주 찍은 고양이 사진도 모임 앨범에 올리고 싶어요. 여행 사진은 아니지만 귀여워요.'],
  ['mom', '가족 앨범이면 그런 일상 사진도 좋지. 공개 글로 올릴 건 아니고.'],
  ['self', '좋아요. 여행이 없는 날에도 우리 이야기는 여기서 이어가요.'],
];

const pastLines: readonly Line[] = [
  ['self', '지난 바다 나들이는 해변 입구에서 오후 2시에 모이기로 한 약속이에요. 부산역 집합 여행과 다른 일정이에요.'],
  ['mom', '그날은 점심을 먹고 출발할게. 식당 예약은 하지 않는 나들이였지.'],
  ['jiu', '돗자리는 제가 가져가기로 했어요. 이번 나들이 준비에서만 표시해주세요.'],
  ['self', '그럼 이 나들이의 집합은 해변 입구 14시로 안내할게요. 다른 여행 공지는 바꾸지 않아요.'],
  ['mom', '물은 챙겼어. 바람이 세면 모래사장 말고 위쪽 벤치에서 쉬자.'],
  ['jiu', '사진 몇 장 찍었어요. 얼굴이 크게 나온 사진은 올리기 전에 먼저 보여드릴게요.'],
  ['self', '오늘 나들이는 마쳤어요. 다음 부산 여행에서 만나는 시간은 그 일정방에서 새로 확인해요.'],
  ['mom', '수고했어. 이번 나들이 사진은 지난 일정 앨범에 남겨두자.'],
];

function timedLines(lines: readonly Pick<TogetherMessage, 'id' | 'roomId' | 'authorId' | 'body'>[], now: number): TogetherMessage[] {
  const finalStart = Math.floor(lines.length * .52);
  return lines.map((line, index) => {
    const segment = index < Math.floor(lines.length * .26) ? 0 : index < finalStart ? 1 : 2;
    const end = segment === 0 ? Math.floor(lines.length * .26) : segment === 1 ? finalStart : lines.length;
    // Three short conversation sessions, all in the past; no fixed date will become stale.
    const sessionEnd = now - (2 - segment) * 86_400_000 - 12 * 60_000;
    return { ...line, createdAt: new Date(sessionEnd - (end - index - 1) * 3 * 60_000).toISOString() };
  });
}

/** Mutates only the caller's memory fixture. Never accesses browser or customer storage. */
export function installMoaChatExamples(state: TogetherState, viewerId: string, reference = new Date()) {
  if (viewerId !== MOA_REVIEW_VIEWER_ID || !state.groups.some(group => group.id === 'family-busan' && group.memberIds.includes(viewerId))) throw new Error('격리된 채팅 검수 계정에서만 예시를 준비할 수 있어요.');
  const now = reference.getTime();
  if (!Number.isFinite(now)) throw new Error('예시 대화 기준 시각을 확인해 주세요.');
  const author = (speaker: Speaker) => speaker === 'self' ? viewerId : speaker === 'mom' ? 'example-parent' : 'example-sibling';
  const plain = (lines: readonly Line[], prefix: string, roomId: string) => lines.map(([speaker, body], index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`, roomId, authorId: author(speaker), body,
  }));
  const legacyIds = ['family-chat-1', 'family-chat-2', 'family-chat-3', 'family-chat-4', 'family-chat-5', 'family-chat-6', 'family-general-1', 'family-general-2'];
  const legacy = new Map(state.messages.filter(message => legacyIds.includes(message.id)).map(message => [message.id, message]));
  if (legacy.size !== legacyIds.length) throw new Error('기존 가족 대화 예시를 먼저 준비해 주세요.');
  const activity = plain(activityLines, 'moa-family', MOA_REVIEW_ROOMS.activity);
  const general = plain(groupLines, 'moa-group', MOA_REVIEW_ROOMS.group);
  const insert = (target: typeof activity, after: number, ids: string[]) => target.splice(after, 0, ...ids.map(id => ({ ...legacy.get(id)! })));
  insert(activity, 5, ['family-chat-1']);
  insert(activity, 21, ['family-chat-3']);
  insert(activity, 33, ['family-chat-4']);
  insert(activity, 45, ['family-chat-5']);
  // Exact-source AI examples are shared with the renderer, never guessed from arbitrary user text.
  const activityExamples = MOA_CHAT_EXAMPLE_MESSAGES.filter(message => message.roomId === MOA_REVIEW_ROOMS.activity);
  const groupExamples = MOA_CHAT_EXAMPLE_MESSAGES.filter(message => message.roomId === MOA_REVIEW_ROOMS.group);
  activity.splice(59, 0, ...activityExamples.map(message => ({ ...message })));
  insert(activity, 59 + activityExamples.length, ['family-chat-2']);
  insert(activity, activity.length - 8, ['family-chat-6']);
  insert(general, 2, ['family-general-1', 'family-general-2']);
  general.splice(28, 0, ...groupExamples.map(message => ({ ...message })));
  const activityMessages = timedLines(activity, now), groupMessages = timedLines(general, now - 60_000);
  const pastDate = state.activities.find(item => item.id === 'family-past')?.date;
  const pastReference = pastDate ? Date.parse(`${pastDate}T18:00:00+09:00`) : now - 14 * 86_400_000;
  const isolatedPast = timedLines(plain(pastLines, 'moa-past', MOA_REVIEW_ROOMS.otherActivity), Math.min(pastReference, now - 7 * 86_400_000));
  const friendMessages = timedLines([
    { id: 'moa-other-001', roomId: MOA_REVIEW_ROOMS.otherGroup, authorId: 'example-friend', body: '책 정모는 14시에 만나요. 가족여행의 부산역 10시 30분 안내와는 다른 약속이에요.' },
    { id: 'moa-other-002', roomId: MOA_REVIEW_ROOMS.otherGroup, authorId: viewerId, body: '네, 책 한 권 챙겨서 갈게요. 이 약속 참석은 아직 미정으로 남겨둘게요.' },
    { id: 'moa-other-003', roomId: MOA_REVIEW_ROOMS.otherGroup, authorId: 'example-friend', body: '이 모임의 카페는 아직 후보예요. 가족여행 카페가 정해진 것으로 가져오지는 말아요.' },
  ], now - 30_000);
  const replacedRooms = new Set(Object.values(MOA_REVIEW_ROOMS));
  state.messages = [...state.messages.filter(message => !replacedRooms.has(message.roomId as typeof MOA_REVIEW_ROOMS[keyof typeof MOA_REVIEW_ROOMS])), ...activityMessages, ...groupMessages, ...isolatedPast, ...friendMessages];
  state.readCursors[MOA_REVIEW_ROOMS.activity] = activityMessages[8].createdAt;
  state.readCursors[MOA_REVIEW_ROOMS.group] = groupMessages[4].createdAt;
  return { activityCount: activityMessages.length, groupCount: groupMessages.length, isolatedCount: isolatedPast.length + friendMessages.length,
    totalCount: activityMessages.length + groupMessages.length + isolatedPast.length + friendMessages.length,
    from: activityMessages[0].createdAt, to: activityMessages.at(-1)!.createdAt };
}
