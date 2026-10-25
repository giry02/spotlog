export type JejuKnowledgeDocument = {
  id: string;
  placeId: string;
  title: string;
  text: string;
  sourceUrl: string;
  checkedAt: string;
};

// Independently written summaries of official sources checked on the stated date.
// These are reference material, not live opening, reservation, fare, or safety status.
// Planning suggestions are identified in the text separately from sourced facts.
export const jejuKnowledgeDocuments: JejuKnowledgeDocument[] = [
  {
    "id": "jeju-osulloc-overview",
    "placeId": "osulloc",
    "title": "오설록 티뮤지엄 | 차 문화와 실내 전시",
    "text": "오설록 티뮤지엄은 제주 서남부 안덕면에 있는 차 문화 공간이다. 차의 역사와 찻도구 전시를 살펴보고, 티 로스터리에서는 찻잎을 차로 만드는 과정을 접할 수 있다. 본동은 차밭과 곶자왈을 바라보도록 구성돼 있다. 차밭 풍경과 실내 전시를 함께 원하는 여행에 어울리지만, 실제 전시·시음·체험의 운영 여부는 방문일 공식 안내를 확인해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500457",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-osulloc-visit",
    "placeId": "osulloc",
    "title": "오설록 티뮤지엄 | 비 오는 날과 체험 구분",
    "text": "오설록에는 실내 전시와 차를 마시는 공간이 있고, 앞뜰과 차밭은 야외다. 비 오는 날 후보로 검토할 때는 실내 관람과 야외 촬영을 나누어 계획하는 편이 좋다. 이는 공간 구성에 근거한 일정 제안이며 모든 동선에서 비를 피한다는 보장은 아니다. 별도 티코스나 시음은 일반 전시 관람과 구별하고, 예약·비용·현장 판매 메뉴는 공식 안내에서 다시 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500457",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-saebyeol-overview",
    "placeId": "saebyeol",
    "title": "새별오름 | 억새와 서쪽 조망",
    "text": "새별오름은 제주 서부 애월의 중산간에 있는 오름으로, 가을 억새와 여러 갈래 능선이 특징이다. 정상에서는 맑은 날 서쪽 해안과 비양도 방향의 풍경을 볼 수 있다. 숲속 산책보다는 풀밭 능선과 오름 경관을 즐기는 야외 탐방지에 가깝다. 억새의 상태와 먼 바다의 시야는 계절·날씨에 따라 달라지므로 특정 사진과 같은 풍경을 보장할 수 없다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500309",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-saebyeol-visit",
    "placeId": "saebyeol",
    "title": "새별오름 | 경사와 짧은 산책 선택",
    "text": "새별오름은 동쪽과 서쪽 입구가 있으며 공식 소개는 서쪽 탐방로의 경사가 더 가파르다고 설명한다. 오르막이 부담스럽다면 정상 등반 대신 아래쪽 억새 풍경을 보는 짧은 산책을 검토할 수 있다. 이 선택은 지형에 근거한 제안으로 무장애 동선 보장은 아니다. 아이·부모님과 동행할 때는 보행 능력과 노면을 확인하고, 강풍 등 기상 상황과 현장 안내에 따라 탐방 범위를 줄인다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500309",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hyeopjae-overview",
    "placeId": "hyeopjae",
    "title": "협재해수욕장 | 비양도와 서부 해변 풍경",
    "text": "협재해수욕장은 제주시 한림읍의 서부 해변으로, 흰 모래와 바다 너머 비양도 풍경을 함께 보는 곳이다. 바다 색과 섬을 배경으로 한 산책·사진 촬영을 원하는 여행에 참고할 수 있다. 금능해변과 같은 서부 해안 일정에 묶는 것은 위치에 근거한 계획 제안이며, 실제 이동 동선은 지도에서 확인한다. 모래사장 관람과 해수욕장 물놀이 운영은 서로 구별해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500697",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hyeopjae-visit",
    "placeId": "hyeopjae",
    "title": "협재해수욕장 | 아이 동반과 물놀이 확인",
    "text": "협재해수욕장의 풍경을 보는 방문이 곧 안전한 입수를 뜻하지는 않는다. 2026년 10월 15일 확인한 공식 관광 안내의 2026년 물놀이 관리 기간은 6월 24일~9월 6일이므로 이를 가을에도 안전요원이 있다는 정보로 사용해서는 안 된다. 아이와 방문할 때는 현장의 입수 가능 구역·파도·안전 안내를 확인한다. 샤워·대여·주차 등 편의시설의 실제 운영과 요금도 방문 전 확인이 필요하다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500697",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-geumneung-overview",
    "placeId": "geumneung",
    "title": "금능해수욕장 | 협재와 이어진 서쪽 바다",
    "text": "금능해수욕장은 제주시 한림읍에 있으며 협재해수욕장과 이어지는 해변이다. 비양도가 보이는 바다와 모래사장 풍경을 즐길 수 있어 협재와 함께 비교해 볼 서부 후보지다. 공식 소개에 얕은 수심이 언급되지만 실제 수심은 물때와 구간에 따라 달라진다. 한적함 역시 방문객 수에 따라 달라지므로 항상 덜 붐빈다고 단정하지 않는다. 해변 산책과 입수 여부는 별도로 판단한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500079",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-geumneung-visit",
    "placeId": "geumneung",
    "title": "금능해수욕장 | 조석과 가족 방문",
    "text": "금능은 간조 때 드러나는 모래사장과 물웅덩이 경관을 볼 수 있는 해변으로 소개된다. 아이와 바닷가를 둘러보려면 물때에 따라 걷는 범위가 달라짐을 고려한다. 이는 가족 일정 제안이며 안전한 물놀이나 유모차 이동을 보장하는 뜻은 아니다. 2026년 10월 15일 확인한 공식 안내의 해당 연도 해수욕장 관리 기간은 이미 종료된 일정이다. 방문 당일 해상 상태·통제·시설 운영을 다시 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500079",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-songaksan-overview",
    "placeId": "songaksan",
    "title": "송악산 | 둘레길의 해안과 역사",
    "text": "송악산은 제주 서남부 대정읍의 해안 화산 지형으로, 둘레길에서 산방산과 형제섬·가파도 방향 바다를 조망할 수 있다. 시야가 트인 해안 경관과 일제강점기의 군사 유적이라는 역사적 맥락이 함께 있는 장소다. 섬 조망은 날씨에 따라 달라진다. 해안 절벽 아래 진지동굴은 일반 산책로와 구별하며, 풍경을 보기 위해 울타리를 넘거나 동굴에 들어가는 일정을 제안하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500378",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-songaksan-visit",
    "placeId": "songaksan",
    "title": "송악산 | 강풍과 정상부 출입 제한",
    "text": "2026년 10월 15일 확인한 비짓제주 공식 안내에 따르면 송악산 정상부와 정상탐방로는 식생 복원을 위해 2027년 7월 31일까지 출입 제한 대상이다. 그 밖의 둘레길 탐방과 정상 등반을 같은 것으로 설명하면 안 된다. 송악산은 주변이 트여 바람이 많은 곳으로 소개되므로 강풍일에는 아이·부모님과의 걷기 일정을 줄이는 선택을 검토한다. 방문 당일 통제와 현장 표지의 안내를 우선한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500378",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-seongsan-overview",
    "placeId": "seongsan",
    "title": "성산일출봉 | 화산 분화구와 동부 해안",
    "text": "성산일출봉은 바닷속 분출로 형성된 수성 화산체로, 제주 세계자연유산을 구성하는 대표 지형이다. 분화구 둘레의 암봉과 바다 위로 솟은 모습이 특징이며 제주 동부 성산 지역에 있다. 정상에서의 일출 감상과 아래쪽에서 봉우리 외관을 보는 방문은 다른 활동이다. 일출을 목표로 한다면 날씨·일출 시각·입장 가능 시간을 함께 확인해야 하며, 맑은 전망을 보장할 수 없다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500349",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-seongsan-visit",
    "placeId": "seongsan",
    "title": "성산일출봉 | 계단과 부모님 동반",
    "text": "성산일출봉 정상 방향 탐방로는 계단과 오르막이 있는 야외 동선이다. 공식 관광 안내에서도 난이도를 높게 분류하므로 계단이 힘든 부모님·어린아이와는 정상 등반을 기본값으로 잡지 않는다. 보행 능력을 먼저 확인하고 아래쪽에서 외관을 보는 방문과 비교하는 것이 일정 제안이다. 계절별 관람시간·매표 마감·정기 휴무는 변동 가능 정보이므로 방문일 공식 안내를 다시 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500349",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-seopjikoji-overview",
    "placeId": "seopjikoji",
    "title": "섭지코지 | 초원과 해안 화산지형",
    "text": "섭지코지는 제주 동부 성산읍의 해안 명소로, 성산일출봉 방향 조망과 초원·절벽·선돌바위 등 화산지형을 함께 보는 곳이다. 해안선을 따라 야외 풍경을 감상하려는 일정에 참고할 수 있다. 넓은 풀밭 경관 때문에 실내 관광지로 설명해서는 안 된다. 봄의 유채꽃과 가을 억새 같은 계절 풍경은 시기와 현장 상태에 따라 달라지며 연중 같은 모습은 아니다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500343",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-seopjikoji-visit",
    "placeId": "seopjikoji",
    "title": "섭지코지 | 오르내림과 해안 산책",
    "text": "섭지코지 공식 관광 안내는 장소 특성을 실외로, 경사 난이도를 높게 분류한다. 따라서 바닷가 산책이라는 이유로 평탄한 길만 이어진다거나 유모차로 모든 곳을 다닐 수 있다고 단정하지 않는다. 아이·부모님과는 당일 바람과 보행 상태를 보고 돌아오는 지점을 정하는 것이 일정 제안이다. 주차장별 요금 체계가 다를 수 있으므로 이용할 진입 지점과 최신 주차 안내를 함께 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500343",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hamdeok-overview",
    "placeId": "hamdeok",
    "title": "함덕해수욕장 | 바다와 서우봉 조망",
    "text": "함덕해수욕장은 제주 북동부 조천읍의 해변으로, 흰 모래와 맑은 바다 옆에 서우봉이 있는 풍경이 특징이다. 해변과 산책로에서 쉬는 방문, 서우봉으로 올라가 해변을 내려다보는 걷기는 구별할 수 있다. 서우봉의 유채꽃 등 계절 경관은 시기마다 달라진다. 해변 휴식 중심의 가족 일정에 참고할 수 있지만, 실제 혼잡도와 시야는 방문일 상황에 따라 달라진다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500693",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hamdeok-visit",
    "placeId": "hamdeok",
    "title": "함덕해수욕장 | 해변 산책과 입수 구별",
    "text": "함덕은 가족 피서지로 소개되지만 얕아 보이는 물과 안전한 입수는 같은 뜻이 아니다. 해변 산책로의 야간 경관 관람도 야간 물놀이 운영과 구별해야 한다. 2026년 10월 15일 확인한 공식 관광 안내의 2026년 관리 기간은 6월 24일~9월 6일이며 야간 물놀이는 운영하지 않는다고 적혀 있다. 가을 방문에는 해당 여름의 안전요원 배치를 가정하지 말고 현장 통제와 해상 상태를 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500693",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-bijarim-overview",
    "placeId": "bijarim",
    "title": "비자림 | 오래된 비자나무와 그늘",
    "text": "비자림은 제주 동부 구좌읍에 있는 숲으로 500~800년 된 비자나무들이 자라는 자연 명소다. 비자나무 외에도 후박나무와 단풍나무 등 여러 수종이 있어 나무 아래 천천히 걷는 숲 산책을 원하는 여행에 참고할 수 있다. 오름 정상 조망이나 해변 풍경을 보는 곳과 성격이 다르다. 그늘이 있다는 특성이 비를 피하는 실내 공간을 뜻하지는 않으며, 날씨에 따른 노면 상태도 고려한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500270",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-bijarim-visit",
    "placeId": "bijarim",
    "title": "비자림 | 조용한 걷기와 자연 보호",
    "text": "비자림은 아름드리나무와 숲길을 감상하는 야외 탐방지다. 걷기 위주로 일정을 줄이고 싶다면 숲 산책 후보로 검토할 수 있으나, 모든 길이 평탄하거나 누구에게나 쉽다고 보장하지 않는다. 2026년 10월 15일 확인한 공식 안내에는 반려동물 동반 불가와 생수를 제외한 음식물 반입 금지가 적혀 있다. 입장 마감과 이용 규칙은 방문 전 재확인하고 식물 채취 없이 정해진 탐방로를 이용한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500270",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-cheonjiyeon-overview",
    "placeId": "cheonjiyeon",
    "title": "천지연폭포 | 난대림과 계곡 산책",
    "text": "천지연폭포는 서귀포 도심 가까운 계곡 끝에서 폭포와 연못을 보는 장소다. 주변에는 구실잣밤나무·동백나무 등 난대림이 있고 담팔수 자생지와 무태장어 서식지 등 보호 가치가 높은 자연환경이 있다. 바다로 바로 떨어지는 정방폭포와 달리 숲과 연못을 함께 보는 계곡 경관에 초점이 있다. 보호구역에서는 식물 채취나 야생동물 포획 등 자연 훼손 행위를 해서는 안 된다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500618",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-cheonjiyeon-visit",
    "placeId": "cheonjiyeon",
    "title": "천지연폭포 | 야간 관람과 보행 확인",
    "text": "천지연은 산책로를 따라 폭포를 바라보는 곳이며 야간 경관 관람도 공식 소개에 포함된다. 다만 일부 징검다리와 탐방로 가장자리는 보행 보조기 이용자에게 부담이 될 수 있으므로 모든 구간의 접근성을 단정하지 않는다. 낮과 밤의 방문 중 하나를 고르는 것은 일정 제안이다. 조명 운영·매표 마감·기상 통제는 달라질 수 있으니 야간 방문 전 공식 안내를 확인하고 안전한 관람 동선을 이용한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_200000000011154",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jeongbang-overview",
    "placeId": "jeongbang",
    "title": "정방폭포 | 바다로 떨어지는 해안 폭포",
    "text": "정방폭포는 서귀포 도심 인근의 높은 해안 절벽에서 물줄기가 바다로 떨어지는 폭포다. 주변 수직 암벽에 주상절리가 발달해 바다·절벽·폭포를 함께 감상할 수 있다. 숲과 연못이 중심인 천지연폭포와 다른 해안 경관을 원하는 경우 비교 후보가 된다. 아름다운 자연뿐 아니라 제주4·3의 아픈 역사를 간직한 소남머리 일대와 연결된 장소라는 점도 함께 이해할 수 있다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500531",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jeongbang-visit",
    "placeId": "jeongbang",
    "title": "정방폭포 | 내려가는 계단과 해안 노면",
    "text": "정방폭포는 매표소에서 계단을 따라 아래로 내려가 관람하는 동선이다. 따라서 계단이 힘든 부모님이나 유모차와 함께라면 폭포 바로 아래 관람을 당연한 선택으로 잡지 않고 실제 이동 가능한 범위를 먼저 확인한다. 야외 해안에서 폭포 물보라와 젖은 노면을 만날 수 있으므로 보행에 주의하는 편이 좋다. 관람시간은 일몰과 기상에 따라 달라질 수 있으니 방문일 통제·입장 마감을 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500531",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jusangjeolli-overview",
    "placeId": "jusangjeolli",
    "title": "중문대포해안 주상절리대 | 기둥 모양 바위",
    "text": "중문대포해안 주상절리대는 서귀포 중문 지역에서 현무암질 용암이 식고 수축하며 만들어진 기둥 모양 바위를 보는 지질 명소다. 여러 각형의 돌기둥이 겹쳐 선 해안 절벽과 그 아래 파도가 주요 경관이다. 폭포나 모래 해변과는 다른 제주의 화산 지형을 설명하는 자료로 쓸 수 있다. 바위 형태를 보기 위해 관람시설을 벗어나 해안 아래로 내려가는 일정은 제안하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000020476",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jusangjeolli-visit",
    "placeId": "jusangjeolli",
    "title": "중문대포해안 주상절리대 | 날씨와 중문 일정",
    "text": "주상절리대는 중문관광단지 가까이 있는 야외 해안 관람지다. 중문 지역의 다른 전시·식물원 후보와 함께 묶는 것은 위치에 근거한 일정 제안이며 실제 이동 시간은 교통과 경로에 따라 다르다. 파도가 바위에 부딪히는 모습이 볼거리라도 높은 파도 때 관람 가능함을 뜻하지 않는다. 공식 안내는 기상이나 일몰에 따른 관람 변경·통제 가능성을 설명하므로 방문 당일 현장 운영 여부를 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000020476",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hallasan-overview",
    "placeId": "hallasan",
    "title": "한라산국립공원 | 백록담 코스와 영실·어리목 차이",
    "text": "2026년 10월 15일 공식 안내로 확인한 한라산 탐방로 구분이다. 성판악 코스: 출발점=성판악 입구, 중간 지점=진달래밭, 정상 목적지=백록담. 관음사 코스: 출발점=관음사 탐방로 입구, 중간 지점=삼각봉, 정상 목적지=백록담. 영실·어리목 코스: 목적지=윗세오름·남벽분기점 방향의 별도 탐방로, 백록담 정상 직접 연결=불가. 백록담 정상 방향은 성판악·관음사로 구분해 계획한다. 당일 개방·기상 통제와 입산·하산 시간은 한라산국립공원의 최신 공지를 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500685",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hallasan-visit",
    "placeId": "hallasan",
    "title": "한라산국립공원 | 예약 관리 구간과 코스 출발점",
    "text": "2026년 10월 15일 확인한 공식 공지의 예약 구분이다. 성판악: 코스 출발점=성판악 입구, 사전 예약 필수 구간=진달래밭~백록담. 관음사: 코스 출발점=관음사 탐방로 입구, 사전 예약 필수 구간=삼각봉~백록담. 진달래밭·삼각봉의 역할=코스 중간 지점이자 상부 예약 관리 구간의 경계. 백록담 정상 탐방=해당 사전 예약 필요. 예약 관리 구간 이전의 탐방과 영실·어리목 탐방은 별도로 구분한다. 영실·어리목의 백록담 정상 직접 연결=불가. 예약 가능 여부·기상 통제·입출입 시간은 공식 예약시스템과 국립공원 공지에서 재확인한다.",
    "sourceUrl": "https://visithalla.jeju.go.kr/board/boardView.do?bbsId=notice&seq=1284",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-udo-overview",
    "placeId": "udo",
    "title": "우도 | 부속섬 경관과 도항선 이동",
    "text": "우도는 제주 동쪽 본섬과 바다로 떨어져 있는 부속섬으로, 우도봉·검멀레·서빈백사 등 해안 경관이 주요 볼거리다. 본섬의 성산항 또는 종달항에서 우도행 도항선을 이용하므로 도로와 버스만으로 섬에 들어가는 여행이 아니다. 해안 산책과 우도봉 오르기는 걷는 부담이 달라 목적에 맞게 나눈다. 배편 이동과 섬 안 체류 시간을 별도로 잡는 것이 일정 제안이다. 배는 기상·해상 상태에 따라 운항 여부가 달라져 방문 당일 선박 운영사·항구의 도항선 매표소에서 확인해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500477",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-udo-visit",
    "placeId": "udo",
    "title": "우도 | 배편·귀항과 차량 반입 확인 경로",
    "text": "우도행 배의 당일 출항·결항과 마지막 귀항편은 이용할 성산항·종달항의 도항선 매표소 또는 선박 운영사에 확인한다. 제주버스정보시스템은 육상버스 정보이므로 우도 배편의 운항 확인 경로가 아니다. 2026년 10월 15일 확인한 공식 관광 안내는 우도 내 외부 차량 운행 제한과 조건별 예외를 설명한다. 렌터카·전기 이동수단을 모두 반입할 수 있다고 단정하지 않으며, 차종·동행자·숙박 등 실제 조건에 따른 허용 여부와 증빙은 우도면 공식 차량 운행 제한 안내 및 도항선 운영사에 확인한다. 섬에 들어갈 수 있어도 원하는 시각에 돌아올 수 있다고 가정하지 않고 귀항편을 먼저 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500477",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-sehwa-overview",
    "placeId": "sehwa",
    "title": "세화해변 | 구좌의 작은 해안 풍경",
    "text": "세화해변은 제주 북동부 구좌읍의 현무암 바탕에 모래가 쌓인 작은 해변이다. 해안도로·포구 가까이 있어 제주올레 20코스가 지나는 세화마을 일대의 풍경과 함께 살펴볼 수 있다. 바다와 검은 바위, 모래사장의 대비를 보는 해안 산책 후보로 참고한다. 백사장 규모는 조석과 침식·퇴적에 따라 달라지므로 사진 속 넓이와 같은 상태를 항상 기대할 수는 없다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500361",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-sehwa-visit",
    "placeId": "sehwa",
    "title": "세화해변 | 만조와 지정 해수욕장 여부",
    "text": "2026년 10월 15일 확인한 비짓제주 세화해변 안내는 정식 개장·관리되는 지정 해수욕장이 아니라고 설명한다. 만조에는 좁은 모래사장이 크게 줄거나 잠길 수 있어 간조 여부를 확인하는 것이 좋다. 예쁜 바다나 얕아 보이는 구간을 근거로 아이에게 안전한 수영 장소라고 보장하지 않는다. 해변 접근과 물놀이는 현장의 기상·해상 상태와 안전 안내를 보고 결정하며 포구에서 수영·다이빙을 계획하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500361",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-manjanggul-overview",
    "placeId": "manjanggul",
    "title": "만장굴 | 거문오름 용암동굴계",
    "text": "만장굴은 구좌읍에 있는 큰 용암동굴로 거문오름 용암동굴계에 속하며 제주 세계자연유산의 일부다. 용암이 흘렀던 흔적과 용암선반·석주 등 동굴 생성물을 살펴보는 지질 명소다. 일반 공개구간과 학술적으로 보호되는 전체 동굴은 다르므로 동굴 전체를 자유롭게 둘러본다고 설명해서는 안 된다. 동굴 생물의 서식지를 직접 관찰할 수 있다고 약속하지 않고 지정된 관람 동선을 기준으로 안내한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500182",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-manjanggul-visit",
    "placeId": "manjanggul",
    "title": "만장굴 | 어두운 동굴과 관람 가능 확인",
    "text": "만장굴은 일반 실내 전시관과 다른 자연 동굴이다. 공식 관광 자료는 동굴을 보호하기 위해 조명이 어둡고 여름에도 내부 공기가 쌀쌀할 수 있다고 설명한다. 보행 속도가 느린 동행자와는 이런 환경을 고려해 방문 여부를 정한다. 과거 폐쇄·정비 기사만으로 현재 상태를 단정하지 않으며, 관람 재개 여부·공개구간·휴무·입장 마감은 방문일 제주 세계자연유산센터의 최신 공식 공지로 재확인해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000020940",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-saryeoni-overview",
    "placeId": "saryeoni",
    "title": "사려니숲길 | 삼나무와 숲 그늘",
    "text": "사려니숲길은 제주 중산간의 삼나무·서어나무·편백나무 등 다양한 수종을 만나는 숲길이다. 비자림로 쪽과 남조로 붉은오름 쪽 입구가 있어 어느 방향에서 들어가는지에 따라 동선이 달라진다. 나무 아래 그늘과 숲 산책을 원하는 여행에 참고할 수 있지만 숲 전체를 짧게 걷는 코스로 간주하지 않는다. 실내 관광지가 아니므로 비가 오면 노면 상태와 기상 통제 여부도 살펴야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500281",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-saryeoni-visit",
    "placeId": "saryeoni",
    "title": "사려니숲길 | 입구·주차·반환점 선택",
    "text": "사려니숲길 공식 안내는 비자림로변 입구에 별도 주차공간이 없고 자가용은 남조로 붉은오름 입구 주차장을 검토하도록 설명한다. 절물조릿대길 일부는 노면과 높낮이가 고르지 않아 유모차 이용자에게 붉은오름 쪽을 권한다. 다만 모든 코스의 무장애 이동을 보장하지 않는다. 2026년 10월 15일 확인 자료에서 물찻오름은 평소 출입 제한 대상이며, 반환점·기상 통제·입구를 미리 확인해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500281",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-gotjawal-overview",
    "placeId": "gotjawal",
    "title": "제주곶자왈도립공원 | 암석과 숲 생태",
    "text": "제주곶자왈도립공원은 서남부 대정읍에서 암석·나무·덩굴식물이 어우러진 곶자왈 생태를 살펴보는 공원이다. 단순 조경 정원과 달리 용암 지형 위의 숲을 이해하고 관찰하는 생태 여행 성격이 있다. 숲속 걷기와 전망대를 통한 경관 감상이 공식 관광 소개에 포함된다. 그늘을 찾는 여행의 후보지만 전 구간이 포장된 평지나 비를 피할 수 있는 실내라고 설명하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000021111",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-gotjawal-visit",
    "placeId": "gotjawal",
    "title": "제주곶자왈도립공원 | 탐방 코스 선택",
    "text": "곶자왈도립공원에서는 생태 보호와 탐방을 함께 고려해야 한다. 숲과 암석이 섞인 환경이라는 특징을 바탕으로 걷기 편한 신발을 준비하고 정해진 탐방로에서 관찰하는 것이 방문 제안이다. 코스별 거리·노면·경사는 다를 수 있으므로 아이·부모님·유모차와는 실제 이용할 구간을 먼저 확인한다. 숲이라는 이유로 강풍이나 비에 항상 안전하다고 단정하지 않으며, 통제·입장 마감·해설 운영은 공식 안내를 재확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000021111",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-aquaplanet-overview",
    "placeId": "aquaplanet",
    "title": "아쿠아플라넷 제주 | 실내 해양 전시",
    "text": "아쿠아플라넷 제주는 제주 동부 성산읍 섭지코지 인근의 해양 전시 시설이다. 제주 앞바다를 재현한 메인 수조와 해양과학 체험·해양 공연 공간 등이 공식 시설 소개에 포함된다. 아이와 바다 생물을 실내에서 관찰하는 후보로 검토할 수 있다. 해변 입수 체험과는 다른 관람 활동이며, 특정 생물·공연을 반드시 볼 수 있다고 약속하지 않고 당일 프로그램 안내를 확인한다.",
    "sourceUrl": "https://www.aquaplanet.co.kr/jeju/aquaplanet/planet.do",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-aquaplanet-visit",
    "placeId": "aquaplanet",
    "title": "아쿠아플라넷 제주 | 비 오는 날과 프로그램",
    "text": "실내 수조와 전시를 중심으로 하는 아쿠아플라넷은 비 오는 날 동부 지역 일정의 대안으로 검토할 수 있다. 이는 시설 구성에 근거한 일정 제안이며 주차장부터 모든 동선에서 비를 피한다는 보장은 아니다. 관람·공연·별도 체험의 포함 범위는 티켓과 프로그램마다 다를 수 있다. 방문 전에 공식 시간표·매표와 입장 마감·요금·할인을 확인하며, 여기서 예약 완료나 티켓 확보를 단정하지 않는다.",
    "sourceUrl": "https://www.aquaplanet.co.kr/jeju/information/use_price.do",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jejumuseum-overview",
    "placeId": "jejumuseum",
    "title": "국립제주박물관 | 제주 역사와 상설전시",
    "text": "국립제주박물관은 제주시에서 제주 섬의 역사와 사람들의 문화를 살펴보는 국립 박물관이다. 상설전시는 선사시대·탐라국·고려·조선과 제주섬 사람들의 생활 등을 주제로 구성된다. 자연 관광 사이에 제주 역사와 문화를 이해하고 싶은 일정의 실내 전시 후보로 삼을 수 있다. 어린이박물관과 실감영상실도 공식 사이트에 안내되지만 일반 상설전시와 이용 방식이 같다고 가정하지 않는다.",
    "sourceUrl": "https://jeju.museum.go.kr/html/kr/index.html",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jejumuseum-visit",
    "placeId": "jejumuseum",
    "title": "국립제주박물관 | 어린이와 예약 확인",
    "text": "국립제주박물관에는 어린이박물관과 교육·문화행사 안내가 있어 아이와 함께 역사 체험을 검토할 수 있다. 다만 어린이박물관·행사·교육은 각각 대상 연령과 예약 조건이 다를 수 있으므로 현장에 가면 모두 참여할 수 있다고 약속하지 않는다. 2026년 10월 15일 확인한 공식 홈페이지에는 월요일과 일부 명절 휴관이 안내돼 있다. 비 오는 날 방문이라도 방문일 관람·예약 공지를 먼저 확인한다.",
    "sourceUrl": "https://jeju.museum.go.kr/html/kr/index.html",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-dolculturepark-overview",
    "placeId": "dolculturepark",
    "title": "제주돌문화공원 | 돌과 설문대할망 설화",
    "text": "제주돌문화공원은 조천읍 교래리 일대에서 제주의 돌 문화와 생활, 설문대할망·오백장군 설화 등을 살펴보는 공간이다. 자연석과 조형물이 있는 야외 공원에 박물관·갤러리 등 전시 공간이 함께 구성된다. 설화는 사실로 입증된 역사와 구별해 설명한다. 제주 화산섬의 돌이 생활과 문화에 어떻게 이어지는지 이해하는 여행에 참고할 수 있으며, 한림의 제주돌마을공원과는 다른 장소다.",
    "sourceUrl": "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_200000000012141",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-dolculturepark-visit",
    "placeId": "dolculturepark",
    "title": "제주돌문화공원 | 넓은 동선과 실내외 구분",
    "text": "돌문화공원은 여러 코스로 나뉜 넓은 공간이어서 모두 둘러보기와 일부 전시만 관람하기를 구별할 수 있다. 공식 관광 소개는 하늘연못·돌박물관·오백장군갤러리 등을 포함한 코스를 설명한다. 비가 오거나 오래 걷기 어렵다면 전시 중심으로 범위를 줄이는 것은 일정 제안이다. 전체 공원이 실내인 것은 아니므로 전시관 사이 야외 이동과 휴식을 고려하고, 코스 개방·휴관·관람 마감은 최신 공식 안내에서 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_300000000013098",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-ecoland-overview",
    "placeId": "ecoland",
    "title": "에코랜드 | 기차와 교래 곶자왈",
    "text": "에코랜드 테마파크는 조천읍 교래 곶자왈에서 기차로 여러 테마 정차역을 연결하는 관광 시설이다. 숲과 호수·정원 등 서로 다른 풍경을 역별로 살펴보는 구성이어서 기차를 좋아하는 아이와 검토할 수 있다. 기차를 탄다는 특징이 관광 전체가 실내임을 뜻하지는 않는다. 정차 후 산책과 관람에는 야외 동선이 포함되므로 계절·날씨와 동행자의 걷기 능력을 함께 고려한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500438",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-ecoland-visit",
    "placeId": "ecoland",
    "title": "에코랜드 | 역별 관람과 기상 운영",
    "text": "에코랜드는 기차 이동과 역별 걷기가 결합된 공간이다. 아이와 방문한다면 모든 역을 빠짐없이 도는 일정 대신 관심 있는 숲·정원 구간을 골라 휴식하는 방식을 검토할 수 있다. 이는 시설 구성에 근거한 제안이며 당일 운행 간격이나 가능한 하차 방식은 공식 안내를 따른다. 강풍·비·눈에 따른 기차 운영, 마지막 열차, 특별공연·야간개장 여부와 요금은 방문일에 다시 확인해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500438",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-yeomiji-overview",
    "placeId": "yeomiji",
    "title": "여미지식물원 | 온실과 세계 정원",
    "text": "여미지식물원은 서귀포 중문관광단지 북쪽에 있으며 실내 온실과 야외 정원이 함께 있는 식물원이다. 온실에는 꽃·물·선인장·열대식물 등 주제별 정원이 구성되고, 외부에는 한국·일본·프랑스·이탈리아식 정원 등이 있다. 식물을 가까이서 보며 천천히 관람하는 여행에 참고할 수 있다. 실내와 실외의 관람 환경이 다르므로 전체 부지를 비를 피하는 공간으로 안내해서는 안 된다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500442",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-yeomiji-visit",
    "placeId": "yeomiji",
    "title": "여미지식물원 | 비 오는 날 온실 선택",
    "text": "여미지식물원에서는 비 오는 날 온실 중심으로 관람 범위를 정하는 선택을 검토할 수 있다. 이는 실내 온실이 있다는 사실에 근거한 일정 제안이며 야외 정원까지 같은 조건으로 다닐 수 있다는 뜻은 아니다. 아이·부모님과 함께라면 온실과 전망 공간 사이 실제 이동 동선과 휴식 지점을 확인한다. 전시·전망 시설의 가동, 입장 마감, 야외 관람 범위와 요금은 방문 전 공식 안내에서 재확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500442",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hallimpark-overview",
    "placeId": "hallimpark",
    "title": "한림공원 | 동굴·정원·민속마을",
    "text": "한림공원은 제주 서부 한림읍 협재리에 있는 여러 테마의 공원이다. 아열대 식물과 야자수길, 분재원, 민속마을, 동굴 등 서로 다른 볼거리가 있어 바다 풍경과 다른 정원·문화 관람 후보가 된다. 협재굴·쌍용굴 같은 동굴이 있다는 점도 특징이다. 계절 꽃은 개화와 전시 상황에 따라 달라지므로 특정 달의 꽃을 보장하지 않고 방문 시점의 공식 전시 안내를 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500690",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-hallimpark-visit",
    "placeId": "hallimpark",
    "title": "한림공원 | 가족 관람과 실내외 범위",
    "text": "한림공원은 온실·동굴과 야외 산책길이 섞여 있어 공원 전체가 실내인 것은 아니다. 아이와 함께라면 정원·초가·동굴 중 관심 있는 주제를 골라 걷고 쉬는 방식으로 계획할 수 있다. 이는 공간 구성에 근거한 제안이며 동굴이나 모든 산책로에 유모차·휠체어가 진입 가능하다고 보장하지 않는다. 계절별 매표 마감과 각 시설 개방, 반려동물 규정·이용요금은 공식 안내에서 방문 전 다시 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500690",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jeolmul-overview",
    "placeId": "jeolmul",
    "title": "절물자연휴양림 | 삼나무 숲과 산책",
    "text": "절물자연휴양림은 제주시 봉개동 중산간에 있는 숲 휴양 공간이다. 곧게 자란 삼나무와 다양한 수종이 숲을 이루며 산책과 산림 휴양을 원하는 여행에 참고할 수 있다. 휴양림 안에서 쉬며 걷는 방문과 절물오름을 오르는 코스는 보행 부담이 다르므로 구별한다. 비나 안개 속 풍경이 소개되더라도 악천후 탐방을 보장하는 뜻은 아니며 실제 노면과 통제 상태를 확인한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500570",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-jeolmul-visit",
    "placeId": "jeolmul",
    "title": "절물자연휴양림 | 숲 해설과 숙박 구별",
    "text": "절물자연휴양림은 일반 숲 관람 외에 숲 해설·체험·숙박과 관련된 안내가 있는 곳이다. 이 서비스들은 입장과 별개로 신청·예약·운영 조건이 있을 수 있다. 아이와 참여하려면 공식 숲나들e 페이지의 대상·날짜·접수 여부를 확인한다. 산책 일정을 제안하면서 숙소나 체험 예약이 확보됐다고 말해서는 안 된다. 장생의숲길·오름 등 구간별 개방과 기상 통제도 방문일 공식 공지에서 확인한다.",
    "sourceUrl": "https://jeolmul.foresttrip.go.kr/",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-geomunoreum-overview",
    "placeId": "geomunoreum",
    "title": "거문오름 | 용암동굴계를 만든 화산",
    "text": "거문오름은 조천읍 선흘리에서 화산 분화구와 곶자왈을 살펴보는 자연유산이다. 흘러나온 용암이 북동쪽 해안 방향으로 이동하며 거문오름 용암동굴계를 만든 모체로 알려져 있다. 풍혈·용암 함몰구 등 지형과 숲 생태를 이해하는 탐방에 참고할 수 있다. 만장굴 안을 걷는 방문과 거문오름의 분화구를 탐방하는 방문은 다른 활동이므로 위치와 입장 절차를 구별한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500034",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-geomunoreum-visit",
    "placeId": "geomunoreum",
    "title": "거문오름 | 사전 예약과 탐방 조건",
    "text": "2026년 10월 15일 확인한 비짓제주 공식 안내는 거문오름 탐방을 사전 예약제로 설명하고 당일 예약은 불가하다고 명시한다. 정해진 차수·휴무·기상 통제 조건이 있으므로 다른 오름처럼 아무 때나 자유롭게 오를 수 있다고 안내하지 않는다. 세계자연유산센터 전시 관람과 거문오름 탐방 예약도 서로 구별한다. 이용할 탐방 코스와 최신 회차·준비물은 공식 예약 안내에서 직접 확인하고 예약 완료를 가정하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500034",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-yongmeori-overview",
    "placeId": "yongmeori",
    "title": "용머리해안 | 층층이 이어진 화산 절벽",
    "text": "용머리해안은 산방산 자락에서 바다로 이어지는 화산쇄설층과 파도의 침식 지형을 보는 해안이다. 암벽의 층리와 좁은 해안 탐방 구간이 특징이며 산방산·사계리와 함께 지질 여행 후보로 검토할 수 있다. 해변 모래사장이나 실내 전시관과는 다른 암반 해안이다. 사진을 위해 정해진 탐방 구간을 벗어나지 않고, 해안 지형의 설명과 실제 당일 입장 가능 여부를 구별한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500471",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-yongmeori-visit",
    "placeId": "yongmeori",
    "title": "용머리해안 | 물때·파도·당일 통제",
    "text": "용머리해안은 만조·높은 파도·기상 악화에 따라 출입을 통제하는 곳이다. 2026년 10월 15일 확인한 공식 관광 안내도 당일 관람 가능 시간대를 확인하도록 설명한다. 예정된 운영시간이 있어도 오늘 입장할 수 있다고 단정할 수 없으며, 바람이 센 날이나 비 오는 날의 확정 코스로 잡지 않는다. 방문 당일 서귀포시 공영관광지 공식 안내와 관리소에서 개방 여부를 확인한 뒤 주변 대안을 함께 검토한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500471",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-sanbangsan-overview",
    "placeId": "sanbangsan",
    "title": "산방산 | 사계리의 산과 산방굴사",
    "text": "산방산은 제주 서남부 안덕면 사계리의 평탄한 지대 위로 눈에 띄게 솟은 산이다. 산방산의 굴에 있는 산방굴사와 주변 해안 경관이 함께 소개된다. 한라산 정상을 옮겼다는 이야기는 지형 형성의 과학적 설명과 구별되는 전설이다. 산의 외관을 바라보는 방문, 허용된 길로 산방굴사까지 가는 방문을 나누며 산방산 정상 등산을 일반 관광 코스로 제안하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500285",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-sanbangsan-visit",
    "placeId": "sanbangsan",
    "title": "산방산 | 허용 산책로와 정상 제한",
    "text": "2026년 10월 15일 확인한 공식 관광 안내는 산방산 보호를 위해 2031년 12월 31일까지 지정 구역 밖 출입을 금지하고 매표소~산방굴사 산책로만 탐방 가능하다고 설명한다. 정상 등산이 가능한 오름과 혼동하지 않는다. 산방굴사까지의 방문도 아이·부모님의 보행 능력과 현장 동선을 먼저 확인한다. 주변 용머리해안은 별도의 기상·물때 통제 대상이므로 두 곳을 같은 입장 조건으로 안내하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500285",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-planning-west",
    "placeId": "jeju-general",
    "title": "제주 서부 일정 | 한림 해변과 안덕 구분",
    "text": "제주 공식 관광지도에서 협재·금능·한림공원은 서부 한림권, 오설록과 산방산·용머리해안은 더 남쪽의 안덕권에 놓여 있다. 이를 바탕으로 서부 여행은 한림의 바다·정원, 안덕의 차 문화·지질 경관처럼 지역별로 묶는 방식을 제안한다. 하루에 동서 끝을 왕복하는 일정은 이동 경로와 휴식을 따로 검토한다. 이 구성은 지도에 근거한 작성자의 제안이며 확정 이동 시간·도로 통행 상태·시설 예약을 뜻하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/map/JEJU_MAP_KOREAN.pdf",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-planning-east",
    "placeId": "jeju-general",
    "title": "제주 동부 일정 | 함덕·구좌·성산과 우도",
    "text": "제주 공식 관광지도에는 함덕이 북동부 조천, 비자림·세화가 구좌, 성산일출봉·섭지코지가 성산 지역에 표시된다. 동부 하루 일정은 숙소·출발지와 관심 장소에 따라 한 권역에 집중하는 방식으로 제안할 수 있다. 우도는 본섬과 다른 섬이므로 성산 주변 명소와 같은 도로 이동만으로 계산하지 않는다. 이는 지리 정보를 바탕으로 한 계획 제안으로, 실제 경로·버스 연결·배편·입장 시간을 확인해 일정 수를 정한다.",
    "sourceUrl": "https://www.visitjeju.net/map/JEJU_MAP_KOREAN.pdf",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-planning-south",
    "placeId": "jeju-general",
    "title": "제주 남부 일정 | 중문과 서귀포 도심",
    "text": "제주 공식 관광지도에서 중문대포해안 주상절리대와 여미지식물원은 중문권, 천지연·정방폭포는 서귀포 도심권에 놓여 있다. 남부 여행은 중문의 해안·온실 또는 서귀포 도심의 폭포처럼 걷는 범위를 묶는 방식을 제안한다. 두 폭포의 동선은 같지 않으므로 계단이 부담되는 동행자라면 각각 확인한다. 이는 위치를 바탕으로 한 작성자의 일정 제안이며 정확한 이동 시간, 모든 시설의 개방이나 접근성을 보장하지 않는다.",
    "sourceUrl": "https://www.visitjeju.net/map/JEJU_MAP_KOREAN.pdf",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-planning-bus",
    "placeId": "jeju-general",
    "title": "제주 버스 여행 | 노선·정류소·막차 확인",
    "text": "제주버스정보시스템은 노선·정류소·출도착 경로·실시간 버스 위치를 확인하는 공식 서비스다. 렌터카 없이 여행할 때는 관광지 이름만 보지 말고 실제로 탈 정류소와 반대편 귀환 정류소를 확인하는 방식을 제안한다. 환승과 정류소에서 입구까지의 걷기, 마지막 귀환편을 함께 검토한다. 배차·우회·결행은 변동될 수 있으므로 오래된 관광지도 번호나 고정 이동 시간을 그대로 적용하지 않고 출발 전 공식 검색 결과를 다시 확인한다.",
    "sourceUrl": "https://bus.jeju.go.kr/search/route",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-planning-rain",
    "placeId": "jeju-general",
    "title": "제주 비 오는 날 | 실내 관람 후보와 이동",
    "text": "국립제주박물관은 상설전시·어린이박물관·실감영상실을 안내하는 제주시의 문화 공간이다. 비 오는 날에는 이런 실내 전시를 중심으로 관람 범위를 잡는 방식을 제안할 수 있다. 그러나 박물관도 휴관이나 예약 조건이 있어 비만 오면 언제든 입장할 수 있는 것은 아니다. 아이와는 관심 주제·대상 연령·예약을 먼저 확인하고 주차장이나 대중교통 정류소에서 건물까지의 이동과 귀환 경로를 함께 고려한다.",
    "sourceUrl": "https://jeju.museum.go.kr/html/kr/index.html",
    "checkedAt": "2026-10-15"
  },
  {
    "id": "jeju-planning-sea-safety",
    "placeId": "jeju-general",
    "title": "제주 바다 안전 | 강풍·너울과 아이 동반",
    "text": "제주관광공사의 물놀이 안내는 강풍·너울·호우 예보가 있으면 일정을 조정하고, 지정된 물놀이 구역과 안전요원 배치 여부를 확인하도록 설명한다. 포구는 선박 이동과 예측하기 어려운 수심 때문에 수영·다이빙을 피해야 한다. 아이와는 구명조끼 등 안전장비와 보호자 동행이 필요하다. 이 자료는 수영 가능 판정이 아니며, 얕아 보이거나 맑은 바다라도 당일 기상·해상 상태와 현장 안전 안내를 우선해야 한다.",
    "sourceUrl": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_300000000014629",
    "checkedAt": "2026-10-15"
  }
];
