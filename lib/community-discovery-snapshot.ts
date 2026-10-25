// Explicit local public editorial import. No live user records or popularity counts.
const snapshot = {
  "importedAt": "2026-10-19",
  "sourceFile": "web/src/publicTourismContent.ts",
  "sourceRoot": "Spotlog local bundled public editorial code",
  "liveService": false,
  "journeys": [
    {
      "sourceAppId": "public-busan-coast-day",
      "title": "숲길에서 백사장으로, 해운대의 하루",
      "author": "Spotlog 공공자료 가이드",
      "region": "부산",
      "description": "동백섬의 해안 산책로와 해운대해수욕장. 두 장소만 정하고 바다를 보는 시간을 넉넉히 남긴 당일 가이드.",
      "recommendationKind": "AI",
      "recommendationBasis": "OFFICIAL_SOURCE_SAMPLE",
      "story": "한 번의 부산 여행에 모든 해변을 넣지 않아도 됩니다. 해운대 권역의 두 장소를 중심에 두고, 걷는 길과 쉬는 시간을 번갈아 배치하는 하루를 제안합니다. 오전·오후 시작 모두 가능하며 도착 시간에 맞춰 순서를 조정할 수 있습니다.\n\n공공 관광자료와 사용 조건을 확인한 실제 사진으로 편집한 AI 추천 여행 샘플입니다. 개인의 방문 후기나 외부 AI 서비스로 실시간 생성한 결과가 아닙니다. 체류 시간은 편집상 제안이며 교통편·영업시간·숙소는 확정하지 않았습니다. 방문일을 정한 뒤 공식 안내와 실제 이동 경로를 확인해 조정하세요. 사진별 출처와 공공누리 제1유형 표시를 유지해 사용합니다.",
      "tags": [
        "부산",
        "당일치기",
        "해운대",
        "산책",
        "공공자료"
      ],
      "coverPlaceId": "public-busan-dongbaek",
      "days": [
        {
          "day": 1,
          "title": "나무 사이 바다에서 열린 해변까지",
          "story": "숲길과 백사장의 서로 다른 표정을 한 권역에서 만나는 하루. 이동 목표보다 오래 머무를 장소를 먼저 정합니다.",
          "visits": [
            {
              "entityId": "public-busan-dongbaek",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-dongbaek"
            },
            {
              "entityId": "public-busan-haeundae",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-haeundae"
            }
          ],
          "blocks": [
            {
              "id": "public-busan-coast-day-day1-visit1-text",
              "type": "text",
              "heading": "첫 장면은 해안 산책로",
              "body": "동백섬에서는 바다만 바라보기보다 나무 사이로 도시의 윤곽이 드러나는 순간을 찾아보세요. 지도를 보며 산책 범위를 먼저 정하고, 무리해서 모든 길을 돌기보다 자신의 체력에 맞는 구간을 선택하는 구성이 좋습니다.\n\n사진 속 해안 보행로는 장소의 분위기를 이해하기 위한 자료입니다. 유모차나 휠체어를 이용한다면 계단 없는 접근 경로와 현재 개방 구간을 별도로 확인해야 합니다.",
              "visitEntityId": "public-busan-dongbaek"
            },
            {
              "id": "public-busan-coast-day-day1-visit1-image",
              "type": "photo",
              "photoId": "busan-dongbaek",
              "caption": "동백섬의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-coast-day-day1-visit1-place",
              "type": "place",
              "entityId": "public-busan-dongbaek"
            },
            {
              "id": "public-busan-coast-day-day1-visit2-text",
              "type": "text",
              "heading": "두 번째 장소는 쉬는 시간을 포함하기",
              "body": "숲길을 걸은 뒤에는 해운대의 넓은 해변에서 일정을 느리게 전환합니다. 백사장 전체를 끝까지 걷는 것보다 앉아 쉴 곳과 돌아갈 방향을 먼저 정해두면 짧은 여행도 덜 급해집니다.\n\n식사나 카페는 아직 정하지 않은 선택으로 남겨두었습니다. 실제 영업 중인 업소의 메뉴와 가격을 보고 결정하고, 귀가 교통편에 맞춰 산책을 마무리하세요.",
              "visitEntityId": "public-busan-haeundae"
            },
            {
              "id": "public-busan-coast-day-day1-visit2-image",
              "type": "photo",
              "photoId": "busan-haeundae",
              "caption": "아카이브의 행사 시기 해운대 전경. 현재 행사나 이용 상태를 뜻하지 않습니다."
            },
            {
              "id": "public-busan-coast-day-day1-visit2-place",
              "type": "place",
              "entityId": "public-busan-haeundae"
            },
            {
              "id": "public-busan-coast-day-day1-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "당일치기 예시입니다. 부산 도착·귀가 시간과 출발지를 입력해 이동 구간을 다시 확인하세요. 기상 악화나 보행로 통제가 있으면 동백섬 구간을 줄이고 공식 안전 안내를 따릅니다. 식당·숙박업소가 검증된 추천으로 자동 포함된 일정은 아닙니다.",
              "visitEntityId": null
            }
          ]
        }
      ]
    },
    {
      "sourceAppId": "public-busan-oldtown-2days",
      "title": "부산의 골목과 시장, 바다로 이어지는 이틀",
      "author": "Spotlog 공공자료 가이드",
      "region": "부산",
      "description": "감천의 언덕, 국제시장과 자갈치의 일상, 광안리 바다. 원도심의 장면에서 해변까지 이어보는 1박 2일.",
      "recommendationKind": "AI",
      "recommendationBasis": "OFFICIAL_SOURCE_SAMPLE",
      "story": "첫날은 원도심의 골목과 시장을, 다음 날은 시장과 해변을 연결한 예시입니다. 구역 간 이동 부담이 있으므로 숙소 위치와 실제 교통편을 정한 뒤 조정하는 것을 전제로 합니다. 음식과 숙박은 검증되지 않은 업소를 채워 넣지 않고 사용자가 선택하도록 남겼습니다.\n\n공공 관광자료와 사용 조건을 확인한 실제 사진으로 편집한 AI 추천 여행 샘플입니다. 개인의 방문 후기나 외부 AI 서비스로 실시간 생성한 결과가 아닙니다. 체류 시간은 편집상 제안이며 교통편·영업시간·숙소는 확정하지 않았습니다. 방문일을 정한 뒤 공식 안내와 실제 이동 경로를 확인해 조정하세요. 사진별 출처와 공공누리 제1유형 표시를 유지해 사용합니다.",
      "tags": [
        "부산",
        "1박2일",
        "골목",
        "시장",
        "공공자료"
      ],
      "coverPlaceId": "public-busan-gamcheon",
      "days": [
        {
          "day": 1,
          "title": "언덕의 색과 시장의 골목",
          "story": "주민의 생활을 배려하는 마을 관람에서 시작해 시장의 일상을 살펴보는 구성입니다.",
          "visits": [
            {
              "entityId": "public-busan-gamcheon",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-gamcheon"
            },
            {
              "entityId": "public-busan-gukje",
              "kind": "shop",
              "label": "방문",
              "anchorId": "public-busan-gukje"
            }
          ],
          "blocks": [
            {
              "id": "public-busan-oldtown-2days-day1-visit1-text",
              "type": "text",
              "heading": "전망보다 먼저, 마을의 관람 안내",
              "body": "감천문화마을은 집들이 모여 만드는 풍경이 매력인 동시에 사람들이 실제로 생활하는 공간입니다. 안내센터에서 관람 가능한 길과 시간을 확인한 뒤, 주민 출입구와 사적인 공간을 피해서 둘러보도록 계획했습니다.\n\n언덕길의 이동은 평지 산책과 다릅니다. 짐이 많거나 걷기 부담이 있다면 마을에 들어가기 전에 이동 수단과 짐 보관 방법부터 결정하세요.",
              "visitEntityId": "public-busan-gamcheon"
            },
            {
              "id": "public-busan-oldtown-2days-day1-visit1-image",
              "type": "photo",
              "photoId": "busan-gamcheon",
              "caption": "감천문화마을의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-oldtown-2days-day1-visit1-place",
              "type": "place",
              "entityId": "public-busan-gamcheon"
            },
            {
              "id": "public-busan-oldtown-2days-day1-visit2-text",
              "type": "text",
              "heading": "시장에서 내가 좋아하는 것을 찾기",
              "body": "국제시장에서는 모든 골목을 한 번에 보려 하지 않아도 됩니다. 생활용품을 볼지, 간식을 고를지 한 가지 관심사를 정하면 구경의 속도가 생깁니다.\n\n업소별 추천 순위나 실제 후기 점수는 넣지 않았습니다. 먹거리를 고를 때에는 표시 가격, 재료, 결제 방법을 직접 확인하고 쇼핑하지 않는 시간에도 통행을 방해하지 않도록 배려하세요.",
              "visitEntityId": "public-busan-gukje"
            },
            {
              "id": "public-busan-oldtown-2days-day1-visit2-image",
              "type": "photo",
              "photoId": "busan-gukje",
              "caption": "국제시장의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-oldtown-2days-day1-visit2-place",
              "type": "place",
              "entityId": "public-busan-gukje"
            },
            {
              "id": "public-busan-oldtown-2days-day1-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "오늘 숙소는 미정입니다. 체크인 시각과 위치를 먼저 확인하고 국제시장 이후의 이동을 조정하세요. 여행 중 구입한 물건이나 촬영 사진을 내 여행에 기록하면 이 안내를 자신의 여행기로 바꿀 수 있습니다.",
              "visitEntityId": null
            }
          ]
        },
        {
          "day": 2,
          "title": "시장 풍경에서 광안리의 수평선으로",
          "story": "자갈치에서 원도심의 아침을 살펴본 뒤 광안리로 이동하는 예시입니다. 구역을 이동하기 전에 귀가 시간을 확인합니다.",
          "visits": [
            {
              "entityId": "public-busan-jagalchi",
              "kind": "shop",
              "label": "방문",
              "anchorId": "public-busan-jagalchi"
            },
            {
              "entityId": "public-busan-gwangalli",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-gwangalli"
            }
          ],
          "blocks": [
            {
              "id": "public-busan-oldtown-2days-day2-visit1-text",
              "type": "text",
              "heading": "구경하는 사람과 일하는 사람 사이",
              "body": "자갈치에서는 시장을 관광 배경만이 아니라 사람들이 일하는 장소로 바라보는 시간을 제안합니다. 생선과 도구, 상점의 모습을 촬영하고 싶다면 먼저 상인의 동의를 구하세요.\n\n식사를 선택하더라도 이 자료가 특정 업소의 현재 가격이나 품질을 확인한 것은 아닙니다. 주문 내용과 비용을 확인한 다음 자신의 선택으로 기록하는 것이 좋습니다.",
              "visitEntityId": "public-busan-jagalchi"
            },
            {
              "id": "public-busan-oldtown-2days-day2-visit1-image",
              "type": "photo",
              "photoId": "busan-jagalchi",
              "caption": "자갈치시장의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-oldtown-2days-day2-visit1-place",
              "type": "place",
              "entityId": "public-busan-jagalchi"
            },
            {
              "id": "public-busan-oldtown-2days-day2-visit2-text",
              "type": "text",
              "heading": "마지막 일정은 바다를 보는 여백",
              "body": "광안리에서는 광안대교가 보이는 해변 풍경을 중심으로 쉬는 시간을 둡니다. 남포동 권역에서 이동하는 구간이 있으므로 실제 도착 시각이 늦어지면 추가 장소를 더하기보다 해변 한 곳에 집중하세요.\n\n행사나 공연을 필수 장면으로 가정하지 않았습니다. 날씨와 귀가 교통편에 맞춰 밝은 시간에 마무리해도 되고, 야간 이용이 가능한지 확인한 후 저녁 풍경을 선택해도 됩니다.",
              "visitEntityId": "public-busan-gwangalli"
            },
            {
              "id": "public-busan-oldtown-2days-day2-visit2-image",
              "type": "photo",
              "photoId": "busan-gwangalli",
              "caption": "광안리해수욕장의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-oldtown-2days-day2-visit2-place",
              "type": "place",
              "entityId": "public-busan-gwangalli"
            },
            {
              "id": "public-busan-oldtown-2days-day2-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "체크아웃·짐 보관·귀가 교통편은 직접 확정해야 합니다. 자갈치에서 광안리까지의 경로와 이동 시간은 날짜와 수단에 따라 다시 조회하세요. 늦은 도착이 예상되면 광안리를 다음 여행에 남기는 선택도 가능합니다.",
              "visitEntityId": null
            }
          ]
        }
      ]
    },
    {
      "sourceAppId": "public-busan-slow-3days",
      "title": "골목·해안길·해변으로 보는 부산 3일",
      "author": "Spotlog 공공자료 가이드",
      "region": "부산",
      "description": "원도심 하루, 이기대와 광안리 하루, 동백섬과 해운대 하루. 권역별로 장면을 나눠 담은 부산 2박 3일.",
      "recommendationKind": "AI",
      "recommendationBasis": "OFFICIAL_SOURCE_SAMPLE",
      "story": "서로 떨어진 부산의 장소를 같은 날 모두 순회하지 않도록 세 날로 나눴습니다. 첫날은 원도심, 둘째 날은 남구·수영, 마지막 날은 해운대 권역을 중심으로 구성했습니다. 실제 경로 최적화 결과가 아니라 사용자가 숙소와 이동 수단에 맞춰 편집하는 출발점입니다.\n\n공공 관광자료와 사용 조건을 확인한 실제 사진으로 편집한 AI 추천 여행 샘플입니다. 개인의 방문 후기나 외부 AI 서비스로 실시간 생성한 결과가 아닙니다. 체류 시간은 편집상 제안이며 교통편·영업시간·숙소는 확정하지 않았습니다. 방문일을 정한 뒤 공식 안내와 실제 이동 경로를 확인해 조정하세요. 사진별 출처와 공공누리 제1유형 표시를 유지해 사용합니다.",
      "tags": [
        "부산",
        "2박3일",
        "원도심",
        "해안산책",
        "공공자료"
      ],
      "coverPlaceId": "public-busan-gwangalli",
      "days": [
        {
          "day": 1,
          "title": "부산 원도심의 세 장면",
          "story": "마을과 두 시장을 연결한 첫날입니다. 늦게 도착한다면 시장 한 곳을 제외해도 흐름이 유지됩니다.",
          "visits": [
            {
              "entityId": "public-busan-gamcheon",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-gamcheon"
            },
            {
              "entityId": "public-busan-gukje",
              "kind": "shop",
              "label": "방문",
              "anchorId": "public-busan-gukje"
            },
            {
              "entityId": "public-busan-jagalchi",
              "kind": "shop",
              "label": "방문",
              "anchorId": "public-busan-jagalchi"
            }
          ],
          "blocks": [
            {
              "id": "public-busan-slow-3days-day1-visit1-text",
              "type": "text",
              "heading": "도시의 언덕을 바라보는 시작",
              "body": "감천문화마을은 첫날의 전망 장소로 제안합니다. 마을 안내를 확인하고 열린 관람 길 안에서 풍경을 감상하세요. 계단과 경사가 부담스럽다면 관람 범위를 줄이고, 다음 장소를 위해 체력을 남겨두는 편이 좋습니다.",
              "visitEntityId": "public-busan-gamcheon"
            },
            {
              "id": "public-busan-slow-3days-day1-visit1-image",
              "type": "photo",
              "photoId": "busan-gamcheon",
              "caption": "감천문화마을의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-slow-3days-day1-visit1-place",
              "type": "place",
              "entityId": "public-busan-gamcheon"
            },
            {
              "id": "public-busan-slow-3days-day1-visit2-text",
              "type": "text",
              "heading": "시장 골목에서 취향대로 고르기",
              "body": "국제시장에서는 골목 구경과 간식 선택을 자유 시간으로 둡니다. 일정에 특정 상호를 채워 넣는 대신 실제 운영 중인 가게에서 직접 고르고, 마음에 드는 곳이 생기면 내 여행에 추가하세요.",
              "visitEntityId": "public-busan-gukje"
            },
            {
              "id": "public-busan-slow-3days-day1-visit2-image",
              "type": "photo",
              "photoId": "busan-gukje",
              "caption": "국제시장의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-slow-3days-day1-visit2-place",
              "type": "place",
              "entityId": "public-busan-gukje"
            },
            {
              "id": "public-busan-slow-3days-day1-visit3-text",
              "type": "text",
              "heading": "바다와 이어지는 시장의 일상",
              "body": "자갈치는 국제시장과 다른 시장 풍경을 살펴보는 마지막 장소입니다. 도착 시각에 따라 영업 모습이 달라질 수 있으므로 현장 안내를 확인하고, 사람과 상품을 가까이 촬영할 때에는 동의를 구하는 것을 기본으로 합니다.",
              "visitEntityId": "public-busan-jagalchi"
            },
            {
              "id": "public-busan-slow-3days-day1-visit3-image",
              "type": "photo",
              "photoId": "busan-jagalchi",
              "caption": "자갈치시장의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-slow-3days-day1-visit3-place",
              "type": "place",
              "entityId": "public-busan-jagalchi"
            },
            {
              "id": "public-busan-slow-3days-day1-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "늦은 도착일에는 세 곳을 모두 방문하려고 서두르지 않습니다. 감천 관람 가능 시간과 숙소 체크인을 먼저 확인하고 시장 구간을 줄이세요. 숙박·식사는 별도로 선택해야 하며 실제 이동 시간은 확정되지 않았습니다.",
              "visitEntityId": null
            }
          ]
        },
        {
          "day": 2,
          "title": "걷는 해안과 쉬는 해변",
          "story": "이기대는 낮 산책으로, 광안리는 산책 이후의 휴식 장소로 둡니다. 보행량을 줄일 수 있게 출발 전에 구간을 정합니다.",
          "visits": [
            {
              "entityId": "public-busan-igidae",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-igidae"
            },
            {
              "entityId": "public-busan-gwangalli",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-gwangalli"
            }
          ],
          "blocks": [
            {
              "id": "public-busan-slow-3days-day2-visit1-text",
              "type": "text",
              "heading": "이기대는 날씨와 체력부터 확인",
              "body": "이날의 주된 활동은 해안길 걷기입니다. 아카이브 사진의 야간 분위기와 실제 권장 방문 시간을 구분해 낮 시간에 개방된 구간을 선택하세요.\n\n전 구간 완주를 목표로 하지 않습니다. 비나 강풍, 보행로 통제가 있으면 산책을 취소하거나 범위를 줄이고, 필요한 경우 이 장소를 제외한 뒤 광안리 중심의 일정으로 수정하세요.",
              "visitEntityId": "public-busan-igidae"
            },
            {
              "id": "public-busan-slow-3days-day2-visit1-image",
              "type": "photo",
              "photoId": "busan-igidae",
              "caption": "이기대 구름다리의 야간 기록 사진. 이 가이드는 낮 산책을 제안합니다."
            },
            {
              "id": "public-busan-slow-3days-day2-visit1-place",
              "type": "place",
              "entityId": "public-busan-igidae"
            },
            {
              "id": "public-busan-slow-3days-day2-visit2-text",
              "type": "text",
              "heading": "걷고 난 뒤에는 장소보다 휴식",
              "body": "광안리는 두 번째 코스를 소화하는 장소가 아니라 쉬어가는 해변으로 구성했습니다. 광안대교가 보이는 방향을 따라 짧게 걷고, 앉아서 쉬거나 식사를 고르는 시간을 넉넉히 두세요.\n\n행사 일정이나 야경 점등을 보장하지 않습니다. 방문일 공식 안내를 확인하고 숙소로 돌아가는 교통편에 맞춰 마무리하면 됩니다.",
              "visitEntityId": "public-busan-gwangalli"
            },
            {
              "id": "public-busan-slow-3days-day2-visit2-image",
              "type": "photo",
              "photoId": "busan-gwangalli",
              "caption": "광안리해수욕장의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-slow-3days-day2-visit2-place",
              "type": "place",
              "entityId": "public-busan-gwangalli"
            },
            {
              "id": "public-busan-slow-3days-day2-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "물과 보행에 맞는 신발을 준비하고 현장 안전 안내를 우선합니다. 이기대와 광안리를 잇는 실제 이동편을 확인한 뒤 일정을 확정하세요. 사진 속 구간의 야간 개방을 가정해서는 안 됩니다.",
              "visitEntityId": null
            }
          ]
        },
        {
          "day": 3,
          "title": "해운대에서 남기는 마지막 바다",
          "story": "여행의 마지막 날은 동백섬과 해운대 두 곳만 남겼습니다. 귀가 시간에 따라 한 곳으로 줄일 수 있습니다.",
          "visits": [
            {
              "entityId": "public-busan-dongbaek",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-dongbaek"
            },
            {
              "entityId": "public-busan-haeundae",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-busan-haeundae"
            }
          ],
          "blocks": [
            {
              "id": "public-busan-slow-3days-day3-visit1-text",
              "type": "text",
              "heading": "마지막 날의 산책은 짧게",
              "body": "체크아웃 이후에는 짐을 가지고 긴 길을 걷기 어렵습니다. 짐 보관과 귀가 준비를 먼저 마친 뒤 동백섬의 개방된 산책로 일부를 선택하세요. 나무와 바다, 도시가 함께 보이는 장면을 여행의 마지막 사진으로 남길 수 있습니다.",
              "visitEntityId": "public-busan-dongbaek"
            },
            {
              "id": "public-busan-slow-3days-day3-visit1-image",
              "type": "photo",
              "photoId": "busan-dongbaek",
              "caption": "동백섬의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-busan-slow-3days-day3-visit1-place",
              "type": "place",
              "entityId": "public-busan-dongbaek"
            },
            {
              "id": "public-busan-slow-3days-day3-visit2-text",
              "type": "text",
              "heading": "더 채우지 않아도 되는 해변",
              "body": "해운대에서는 추가 관광지보다 귀가 전 여유 시간을 확보합니다. 남은 시간에 맞춰 짧게 걷고, 이번 여행에서 좋았던 장소와 다음에 다시 보고 싶은 장소를 내 여행에 메모해 보세요.\n\n해변 행사와 입수 가능 여부는 사진만으로 판단하지 않습니다. 날씨와 현장 통제, 역·공항까지의 실제 이동 시간을 확인한 뒤 마무리하세요.",
              "visitEntityId": "public-busan-haeundae"
            },
            {
              "id": "public-busan-slow-3days-day3-visit2-image",
              "type": "photo",
              "photoId": "busan-haeundae",
              "caption": "아카이브의 행사 시기 해운대 전경. 현재 행사나 이용 상태를 뜻하지 않습니다."
            },
            {
              "id": "public-busan-slow-3days-day3-visit2-place",
              "type": "place",
              "entityId": "public-busan-haeundae"
            },
            {
              "id": "public-busan-slow-3days-day3-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "돌아가는 열차·항공편의 시간에서 역산해 출발 시각을 정하세요. 이 샘플에는 예약과 실시간 교통이 연결되어 있지 않습니다. 일정 복사 후 숙소, 실제 이동, 방문 사진을 수정해 자신의 여행기로 완성할 수 있습니다.",
              "visitEntityId": null
            }
          ]
        }
      ]
    },
    {
      "sourceAppId": "public-gyeongju-2days",
      "title": "고분의 초록과 연못의 빛, 경주 이틀",
      "author": "Spotlog 공공자료 가이드",
      "region": "경주",
      "description": "대릉원과 첨성대, 월정교와 동궁과 월지. 경주 시내의 유적 네 곳을 두 날에 나눠 둘러보는 가이드.",
      "recommendationKind": "AI",
      "recommendationBasis": "OFFICIAL_SOURCE_SAMPLE",
      "story": "경주시의 시내권 관광 안내를 바탕으로 네 장소를 두 날에 나눈 편집 일정입니다. 유적의 설명을 읽는 시간과 쉬는 시간을 함께 두며, 야간 사진은 장면 참고용으로 사용합니다. 관람 시간은 원문 작성 이후 바뀔 수 있으므로 현재 안내를 확인해야 합니다.\n\n공공 관광자료와 사용 조건을 확인한 실제 사진으로 편집한 AI 추천 여행 샘플입니다. 개인의 방문 후기나 외부 AI 서비스로 실시간 생성한 결과가 아닙니다. 체류 시간은 편집상 제안이며 교통편·영업시간·숙소는 확정하지 않았습니다. 방문일을 정한 뒤 공식 안내와 실제 이동 경로를 확인해 조정하세요. 사진별 출처와 공공누리 제1유형 표시를 유지해 사용합니다.",
      "tags": [
        "경주",
        "1박2일",
        "신라",
        "역사산책",
        "공공자료"
      ],
      "coverPlaceId": "public-gyeongju-donggung",
      "days": [
        {
          "day": 1,
          "title": "고분 사이 산책과 첨성대",
          "story": "첫날에는 대릉원과 첨성대를 중심으로 경주의 유적 공간을 살펴봅니다. 각 장소의 실내 관람이나 추가 유적은 선택 사항으로 남깁니다.",
          "visits": [
            {
              "entityId": "public-gyeongju-daereungwon",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-gyeongju-daereungwon"
            },
            {
              "entityId": "public-gyeongju-cheomseongdae",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-gyeongju-cheomseongdae"
            }
          ],
          "blocks": [
            {
              "id": "public-gyeongju-2days-day1-visit1-text",
              "type": "text",
              "heading": "대릉원은 하나의 사진보다 산책으로",
              "body": "대릉원 항공사진은 고분들이 모여 있는 지형을 이해하는 자료로 봐주세요. 실제 관람은 지상 보행로에서 이루어지므로 사진과 같은 시야를 얻는 일정은 아닙니다.\n\n관람 가능한 길을 따라 걷다가 마음에 드는 나무나 곡선을 찾는 시간을 제안합니다. 시설별 운영 시간과 입장 조건을 미리 확인하고, 햇빛과 비에 대비해 보행 시간을 조정하세요.",
              "visitEntityId": "public-gyeongju-daereungwon"
            },
            {
              "id": "public-gyeongju-2days-day1-visit1-image",
              "type": "photo",
              "photoId": "gyeongju-daereungwon",
              "caption": "대릉원의 항공 전경. 관람객의 실제 보행 시야와 다릅니다."
            },
            {
              "id": "public-gyeongju-2days-day1-visit1-place",
              "type": "place",
              "entityId": "public-gyeongju-daereungwon"
            },
            {
              "id": "public-gyeongju-2days-day1-visit2-text",
              "type": "text",
              "heading": "첨성대를 풍경 속에서 바라보기",
              "body": "첨성대는 구조물의 윤곽을 살피는 시간과 주변 열린 공간을 함께 바라보는 시간으로 나눠보세요. 현장 안내를 읽고 자신의 언어로 한 줄을 남기면 단순한 인증 사진과 다른 여행 기록이 됩니다.\n\n유적 보호를 위한 출입 제한을 지키고, 꽃이나 행사 장면은 계절마다 달라진다는 점을 전제로 방문합니다.",
              "visitEntityId": "public-gyeongju-cheomseongdae"
            },
            {
              "id": "public-gyeongju-2days-day1-visit2-image",
              "type": "photo",
              "photoId": "gyeongju-cheomseongdae",
              "caption": "첨성대의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다."
            },
            {
              "id": "public-gyeongju-2days-day1-visit2-place",
              "type": "place",
              "entityId": "public-gyeongju-cheomseongdae"
            },
            {
              "id": "public-gyeongju-2days-day1-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "숙소는 아직 포함하지 않았습니다. 체크인과 식사를 정한 뒤 두 장소의 순서를 조정하세요. 원문 코스의 2023년 운영 정보를 현재 정보로 옮기지 않았으며 방문일의 공식 관람 안내를 확인해야 합니다.",
              "visitEntityId": null
            }
          ]
        },
        {
          "day": 2,
          "title": "남천의 다리와 월지의 반영",
          "story": "월정교와 동궁과 월지를 연결합니다. 야경을 선택한다면 귀가 시간을 늦출 수 있는지 먼저 확인하고, 그렇지 않다면 낮 관람으로 바꿉니다.",
          "visits": [
            {
              "entityId": "public-gyeongju-woljeonggyo",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-gyeongju-woljeonggyo"
            },
            {
              "entityId": "public-gyeongju-donggung",
              "kind": "place",
              "label": "방문",
              "anchorId": "public-gyeongju-donggung"
            }
          ],
          "blocks": [
            {
              "id": "public-gyeongju-2days-day2-visit1-text",
              "type": "text",
              "heading": "강변에서 다리의 전체 모습 보기",
              "body": "월정교에서는 복원된 다리 자체와 남천의 풍경을 함께 살펴봅니다. 사진은 밤에 촬영된 모습이지만 낮에 구조와 색을 관찰하는 일정으로 바꿔도 됩니다.\n\n다리 내부와 강변의 개방 구간을 확인하고, 촬영을 위해 보행로 밖이나 제한 구역으로 내려가지 않도록 계획하세요.",
              "visitEntityId": "public-gyeongju-woljeonggyo"
            },
            {
              "id": "public-gyeongju-2days-day2-visit1-image",
              "type": "photo",
              "photoId": "gyeongju-woljeonggyo",
              "caption": "월정교 야간 전경. 현재 조명·관람 시간은 별도 확인이 필요합니다."
            },
            {
              "id": "public-gyeongju-2days-day2-visit1-place",
              "type": "place",
              "entityId": "public-gyeongju-woljeonggyo"
            },
            {
              "id": "public-gyeongju-2days-day2-visit2-text",
              "type": "text",
              "heading": "연못을 따라 바뀌는 장면",
              "body": "동궁과 월지는 전각 한 곳만 찍는 장소보다 연못을 따라 시선을 옮기는 관람으로 제안합니다. 수면의 반영과 건물의 배치가 걷는 위치마다 어떻게 달라지는지 살펴보세요.\n\n야간 관람을 원한다면 현재 입장 마감과 귀가 교통편을 먼저 확인해야 합니다. 자료 사진의 조명이 방문일에도 같은 시간에 켜진다고 가정하지 않습니다.",
              "visitEntityId": "public-gyeongju-donggung"
            },
            {
              "id": "public-gyeongju-2days-day2-visit2-image",
              "type": "photo",
              "photoId": "gyeongju-donggung",
              "caption": "동궁과 월지의 조명과 연못 전경. 현재 운영 상태를 보장하지 않습니다."
            },
            {
              "id": "public-gyeongju-2days-day2-visit2-place",
              "type": "place",
              "entityId": "public-gyeongju-donggung"
            },
            {
              "id": "public-gyeongju-2days-day2-practical",
              "type": "text",
              "heading": "이 하루를 내 일정으로 바꾸려면",
              "body": "둘째 날의 관람 시각은 미정입니다. 귀가 시간이 이르다면 낮에 둘러보고, 야경을 원한다면 교통편과 현재 운영 시간을 확인한 뒤 순서를 조정하세요. 실제 교통수단·입장권·숙박 예약이 포함된 상품은 아닙니다.",
              "visitEntityId": null
            }
          ]
        }
      ]
    }
  ]
};
export default snapshot;
