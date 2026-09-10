/* Executive summary with page architecture and implementation phases. */
Report.mount({
  "date": "2026.09.10",
  "title": "Spotlog 추가 개발 계획 요약",
  "shortTitle": "추가 개발 계획 요약",
  "otherTitle": "원본 전체 보기",
  "otherHref": "./spotlog-development-plan.html",
  "slides": [
    {
      "title": "추가 개발 계획 핵심",
      "lead": "프런트엔드를 1차·2차·3차로 나누어 구현함. 차수별 완료 조건을 기준으로 진행함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">구분</th><th scope=\"col\">요약</th></tr></thead><tbody><tr><th scope=\"row\">제품 방향</th><td>여행기를 읽고 장소를 저장한 뒤, 내 일정으로 활용하고 여행 후 기록을 발행함. 국내 콘텐츠를 먼저 쌓고 영어 이용을 준비함.</td></tr><tr><th scope=\"row\">현재 활용</th><td>홈 추천·여행기 검색, 장소 발견·지역별 저장, 여러 여행과 DAY 편집, 글·사진·장소 블록, 여행기 복사·지도 표시를 활용함.</td></tr><tr><th scope=\"row\">우선 보완</th><td>담을 여행·DAY를 명확히 선택하고, 저장/담김/해제를 구분함. 작성 중 기록 복구와 사진·장소 정보의 신뢰도를 높임.</td></tr><tr><th scope=\"row\">운영 전제</th><td>현재 AI·댓글·반응 등의 로컬 동작과 실제 서버 기능을 구분함. 3차까지 완료는 화면 검증 단계이며 정식 출시를 뜻하지 않음.</td></tr></tbody></table></div><div class=\"callout\"><strong>모바일웹과 하이브리드 앱을 유지함.</strong> 숙소·음식점은 여행기 속 장소로 다루며 예약·결제·숙박비 비교는 제외함.</div>",
      "section": "SPOTLOG · 공통 방향 · 1",
      "sources": [
        [
          "원본 상세 47쪽",
          "./spotlog-development-plan.html#slide-4"
        ],
        [
          "다른 요약본",
          "./spotlog-ai-guide-summary.html"
        ]
      ]
    },
    {
      "title": "1차·2차·3차 프런트엔드 합본",
      "lead": "1차·2차·3차의 구현 범위와 완료 기준을 정리함.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">차수</th><th scope=\"col\">구현 범위</th><th scope=\"col\">완료 후 가능한 일</th></tr></thead><tbody><tr><th scope=\"row\">1차 · 발견·저장</th><td>기존 스타일·검색·사진 쇼츠·카드 사진 넘김·담기·홈 AI 초안</td><td>저장 하단 팝업에서 여행·기간·DAY를 고름. 확정한 내 여행 상세를 엶.</td></tr><tr><th scope=\"row\">2차 · 일정·작성·소통</th><td>임시 저장·복구·사진/글·주변 업체·숙소·카드 반응·댓글·지도·복사</td><td>여행기를 편집하고 본문 속 장소마다 반응·댓글을 남김.</td></tr><tr><th scope=\"row\">3차 · 추천·안내</th><td>AI 추천·주변 업체 보완·후보 승인·부분 수정·관광 안내·영어</td><td>추천 초안 수정·관광 안내·영어 열람을 확인함.</td></tr></tbody></table></div><section class=\"section-block\"><h3>차수 진행 기준</h3><ul class=\"list\"><li>각 차수 안에서 구조 정리, 기능 구현, 실패 상태 처리, 전체 흐름 검증을 순서대로 진행함.</li><li>앞 차수의 기록·상태와 기존 화면 역할별 스타일·컴포넌트를 다음 차수에서 재사용함.</li></ul></section><p class=\"note\">1~3차는 프런트엔드 범위임. 실제 로그인·서버 저장·AI/RAG·교통·번역 연동은 이후 백엔드 단계임.</p>",
      "section": "SPOTLOG · 공통 방향 · 2",
      "sources": [
        [
          "원본 상세 47쪽",
          "./spotlog-development-plan.html#slide-11"
        ],
        [
          "다른 요약본",
          "./spotlog-ai-guide-summary.html"
        ]
      ]
    },
    {
      "section": "SPOTLOG · 공통 방향 · 3",
      "title": "전체 페이지 구조 · 메뉴와 하위 화면",
      "lead": "현재 하단 메뉴를 유지하고, 각 메뉴 안의 화면을 연결하며 필요한 기능을 차수별로 보완함.",
      "html": "<div class=\"table-wrap architecture-table\"><table><thead><tr><th scope=\"col\">진입 메뉴</th><th scope=\"col\">하위 페이지와 연결</th><th scope=\"col\">개발 배치</th></tr></thead><tbody><tr><th scope=\"row\">홈</th><td>추천 일정·여행자 일정 → 여행기 읽기<br>지역·기간 검색 → 여행기 목록</td><td>기존 활용 / 1차 탐색 정돈</td></tr><tr><th scope=\"row\">여행기</th><td>검색·지역·기간 목록 → 여행기 읽기<br>작성자 프로필·다른 여행기 / 복사 → 내 여행</td><td>1차 검색 / 2차 읽기·복사·카드 반응</td></tr><tr><th scope=\"row\">장소</th><td>안내 목록 · 영상 · 사진 쇼츠<br>랜드마크 상세 → 저장 / 내 여행의 DAY 선택</td><td>1차 쇼츠·카드 사진 넘김·저장 통일</td></tr><tr><th scope=\"row\">내 여행</th><td>여러 여행 목록 → 여행·DAY 선택 / 생성·상세·편집<br>기간·DAY·순서·글·사진 수정 / 지도·현장 안내·영어</td><td>1차 선택·생성 / 2차 작성 / 3차 안내</td></tr><tr><th scope=\"row\">저장</th><td>저장 목록 · 지역 필터 · 작은 가로 카드 → 담기<br>만들기·AI 하단 입력 → 승인 후 내 여행 상세</td><td>1차 진입·상태 표시 / 3차 AI 보완</td></tr></tbody></table></div><div class=\"callout\"><strong>공통 진입:</strong> 프로필은 홈에서 열며 아이콘·등급·내 공개 글·반응·알림 설정을 연결함. AI 관광 안내는 여행 안에서 제공하며 하단 메뉴를 늘리지 않음.</div><p class=\"note\">기존 화면을 활용하는 목표 구조임. 새 하위 기능은 1·2·3차에서 보완하며 실제 로그인·동기화·집계·푸시는 후속 서버 단계에서 연결함.</p>",
      "sources": [
        [
          "원본 동일 구조도",
          "./spotlog-development-plan.html#slide-12"
        ]
      ]
    },
    {
      "section": "SPOTLOG · 공통 방향 · 4",
      "title": "기능 구조 · 1·2·3차 구현 로드맵",
      "lead": "장소·저장·방문·본문을 공통 기반으로 연결하고, 앞 차수의 결과를 다음 차수가 이어서 사용함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">차수 · 연결 영역</th><th scope=\"col\">주요 기능 묶음</th><th scope=\"col\">완료 후 이어지는 화면</th></tr></thead><tbody><tr><th scope=\"row\">1차 · 발견·저장<br>F01–F06 · F20</th><td>기존 스타일·검색·사진 쇼츠·카드 사진 넘김·홈 AI 초안<br>하단 기간·DAY 선택 후 내 여행·담김·해제</td><td>생성 후 내 여행 상세로 이동해 수정함.<br>선택한 장소·방문 기록을 2차로 전달함.</td></tr><tr><th scope=\"row\">2차 · 작성·독자 소통<br>F07–F12 · F19</th><td>임시 저장·복구, 글·사진·업체 카드·DAY 편집<br>이동·복사·지도·미리보기, 카드별 좋아요·스레드</td><td>읽을 만한 여행기를 작성하고 카드별 반응을 시연함.<br>편집기와 읽기 화면을 3차가 재사용함.</td></tr><tr><th scope=\"row\">3차 · 추천·현장 안내<br>F13–F18</th><td>AI 조건·후보 승인·결과·일부 재생성<br>관광 안내·영어·원문 보기·전체 회귀 검수</td><td>저장 진입 → 내 여행 생성·상세 → 오늘 안내.<br>샘플 연결부를 이후 실제 서버로 교체함.</td></tr></tbody></table></div><section class=\"section-block\"><h3>공통 기능의 연결 원칙</h3><ul class=\"list\"><li>사진·영상·안내는 같은 장소와 저장 상태를 사용함. 여행 방문·본문 카드·댓글 대상은 별도 ID로 구분함.</li><li>읽기·편집·지도·추천 결과는 같은 여행과 DAY를 참조함. 글자·버튼·입력·하단 팝업은 공통 스타일을 재사용하며 오류·복원·뒤로가기를 검증함.</li></ul></section><p class=\"note\">이후 서버: B1 회원·데이터 → B2 콘텐츠·발행 → B3 실제 커뮤니티 → B4 AI·번역 → B5 푸시·현장 앱. 프런트엔드 샘플을 실사용 집계나 실제 AI 결과로 표시하지 않음.</p>",
      "sources": [
        [
          "원본 동일 구조도",
          "./spotlog-development-plan.html#slide-14"
        ]
      ]
    },
    {
      "section": "SPOTLOG · 공통 방향 · 5",
      "title": "스팟 보완 기능의 1·2·3차 구현",
      "lead": "기존 각 차수의 작업을 유지하고, 사진으로 확인한 스팟을 주변 업체와 연결하는 기능을 단계별로 추가함.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">차수</th><th scope=\"col\">추가 구현</th><th scope=\"col\">완료 조건</th></tr></thead><tbody><tr><th scope=\"row\">1차 · 사진으로 확인</th><td>지역 안내·AI·담기의 큰 카드에 좌우 사진 넘김·순번·출처를 추가함. 저장 본문의 작은 가로 카드는 유지함.</td><td>사진과 장소 정보를 보고 생성·담기를 확정함. 대상 여행·DAY와 실제 결과가 일치함.</td></tr><tr><th scope=\"row\">2차 · 직접 보완</th><td>내 여행 스팟의 주변 장소 팝업과 숙박 DAY별 숙소 추가를 구현함. 현재 여행·DAY·스팟 문맥을 이어받음.</td><td>샘플 후보를 스팟 다음에 추가함. 같은 숙소의 여러 날 사용·예약 숙소 고정·취소·중복을 처리함.</td></tr><tr><th scope=\"row\">3차 · AI 보완 승인</th><td>내부 후보를 사용한 음식점·숙소 보완 선택, 사진 카드·근거·대안·변경 미리보기를 연결함.</td><td>승인한 후보만 적용함. 고정 장소와 수정 대상 밖 기록은 보존하며 거절·부족·경로 실패를 표시함.</td></tr><tr><th scope=\"row\">백엔드 이후</th><td>실제 내부 인기·RAG와 교통 검증을 연결함. 네이버는 계약을 확인한 뒤 별도 외부 검색으로 검토함.</td><td>권한·출처·후보 품질·호출 비용을 검증함. 로컬 샘플을 실제 검색·추천 성과로 표시하지 않음.</td></tr></tbody></table></div><div class=\"callout\"><strong>2차의 기존 소통 기능 유지:</strong> 여행기 속 업체·랜드마크 카드마다 좋아요·댓글 수를 표시하고, 별도 하단 팝업에서 댓글·답글을 보고 작성함. 주변 장소 선택 팝업과 역할을 구분함.</div><p class=\"note\">장소 ID와 여행 방문 ID를 분리함. 주변 업체는 기준 방문에 연결하고 숙박은 숙박일·DAY에 연결함. 이동·복사·삭제 시 관계와 다른 날 기록을 함께 검사함.</p>"
    },
    {
      "section": "SPOTLOG · 공통 방향 · 6",
      "title": "데이터 수급과 내부 추천 자료",
      "lead": "공식 기초 정보와 허용된 사진·여행기를 내부 자료로 쌓고, 실제 사용자 반응으로 추천 품질을 높임.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">수급 항목</th><th scope=\"col\">적용 방향</th></tr></thead><tbody><tr><th scope=\"row\">랜드마크·공식 안내</th><td>TourAPI·지자체에서 장소와 이용 정보를 확인함. 필드별 출처·확인일·권리를 보존하고 미확인 정보는 표시함.</td></tr><tr><th scope=\"row\">여러 사진</th><td>관광사진 API·허용된 지자체 자료·직접 촬영·제휴·사용자 사진을 확보함. 같은 장소의 실제 사진만 사용하고 자산별 조건을 검사함.</td></tr><tr><th scope=\"row\">음식점·숙박</th><td>현재 공공데이터포털 인허가 자료로 기초 업체 정보를 보완함. 구 LOCALDATA는 2026.04.16 폐쇄되었으며 인허가 정보를 인기·평점·사진으로 간주하지 않음.</td></tr><tr><th scope=\"row\">권리와 RAG</th><td>공공누리 유형과 개별 조건을 검사함. 표시·보관·변형·임베딩·AI 입력 허용을 구분하고 권리 미확인 자료는 제외함.</td></tr><tr><th scope=\"row\">초기 목표 · 제안</th><td>서울·부산·제주 각각 스팟 20곳 내외·사진 2~3장, 기간별 여행기 총 9개를 준비함. 현재 완료 수치가 아니며 기존 검증 자산도 활용함.</td></tr><tr><th scope=\"row\">실제 운영</th><td>인기는 내부 실제 저장·복사·반응으로 계산함. 원문 수정·삭제·권리 철회 시 이미지·색인·번역도 갱신함.</td></tr></tbody></table></div><p class=\"note\">스팟을 먼저 고른 뒤 주변 음식점·숙소를 보완하는 방향을 유지함. 공유 대화의 데이터 수급 후속 내용은 확인되지 않아 공식 자료로 별도 조사함.</p>",
      "sources": [
        [
          "한국관광공사 국문 관광정보",
          "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578"
        ],
        [
          "한국관광공사 관광사진 정보 API",
          "https://www.data.go.kr/data/15101914/openapi.do"
        ],
        [
          "공공누리 이용 조건",
          "https://www.kogl.or.kr/static/html/opencode.html"
        ],
        [
          "LOCALDATA 폐쇄·통합 안내",
          "https://yongin.go.kr/home/ifOp/ifOpAdm/ifOpAdm07/ifOpAdm07_01.jsp"
        ]
      ]
    },
    {
      "title": "TourAPI 장소·좌표와 공공 사진 활용",
      "lead": "관광정보와 좌표를 먼저 확보하고, 같은 장소의 이용 가능한 사진을 연결함. API 무료 이용과 사진별 사용 조건을 구분함.",
      "section": "SPOTLOG · 공통 방향 · 7",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">항목</th><th scope=\"col\">수집·이용 기준</th></tr></thead><tbody><tr><th scope=\"row\">장소·좌표 먼저</th><td>TourAPI에서 장소명·주소·좌표·소개 정보를 확보함. 누락·좌표계·실제 장소를 확인하며 대표 좌표와 출입구를 구분함.</td></tr><tr><th scope=\"row\">사진 연결</th><td>TourAPI·관광사진 API·지자체 사진을 같은 내부 장소 ID에 연결함. 사진마다 별도 ID와 출처·작가·이용 유형·원문 링크·확인일을 보관함.</td></tr><tr><th scope=\"row\">무료 이용 범위</th><td>국문 TourAPI는 무료이며 호출 한도·운영 승인 절차를 확인함. 관광공사 사이트 전체 사진·글의 무제한 이용 허락으로 해석하지 않음.</td></tr><tr><th scope=\"row\">사진별 이용 조건</th><td>1유형은 출처 표시 후 상업 이용·변경이 가능해 편집·사진 모션용으로 우선 확보함. 3유형은 출처 표시·변경 금지 조건으로 원형 사용을 별도 관리함.</td></tr><tr><th scope=\"row\">화면 출처</th><td>사진 설명과 출처 메타를 분리함. ‘사진 출처’ 버튼에서 기존 하단 팝업으로 상세를 제공하며 캡션에 같은 문구를 반복하지 않음.</td></tr></tbody></table></div><div class=\"callout\"><strong>적용 순서:</strong> 1차에는 권리를 확인한 소량 샘플·표시·실패 상태를 준비함. 자동 수집·갱신은 B1·B2의 서버 단계에서 연결함.</div><p class=\"note\">자료별 허용 조건과 제3자 권리를 확인함. API가 무료여도 사진 저장·전송·검수 비용은 별도임. 실제 연동·대량 수집 완료를 뜻하지 않음.</p>",
      "sources": [
        [
          "TourAPI 공식 안내",
          "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578"
        ],
        [
          "원본 수급 상세",
          "./spotlog-development-plan.html#slide-47"
        ],
        [
          "공공누리 1유형",
          "https://www.kogl.or.kr/info/licenseType1.do"
        ],
        [
          "공공누리 3유형",
          "https://www.kogl.or.kr/info/licenseType3.do"
        ]
      ]
    },
    {
      "title": "1차 · 장소 발견부터 정확한 담기까지",
      "lead": "구현 목표: 장소를 저장한 뒤 어느 여행의 몇 일차에 들어가는지 명확하게 확인함.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">구현 항목</th><th scope=\"col\">화면에서 구현할 내용</th></tr></thead><tbody><tr><th scope=\"row\">검색·지역 목록</th><td>검색·지역 조건에 맞는 목록, 자동 추가 로딩, 빈 결과·오류·이전 목록 복원을 정리함.</td></tr><tr><th scope=\"row\">저장 목록·여행 생성</th><td>지역 필터·작은 가로 카드를 유지함. 만들기·AI는 하단 입력 후 승인한 내 여행 상세로 연결함.</td></tr><tr><th scope=\"row\">여행·DAY 선택</th><td>담기를 누르면 하단 팝업에서 여행·기간·DAY를 선택함. 확정 후 해당 내 여행 DAY 상세를 엶.</td></tr><tr><th scope=\"row\">담김·해제 표시</th><td>저장 카드에는 담긴 여행·DAY만 표시함. 방문 해제·재방문은 내 여행에서 처리하며 저장 해제는 방문을 보존함.</td></tr><tr><th scope=\"row\">공통 스타일·기록·예외</th><td>글자·버튼·입력·하단 팝업은 기존 화면 역할별 스타일을 사용함. 기존 기록 보존, 빈 여행·중복·실패·뒤로가기를 검증함.</td></tr><tr><th scope=\"row\">랜드마크 사진 보기</th><td>사진 피드는 세로 장소·가로 사진 전환을 유지함. 지역 안내·AI·담기의 큰 카드도 같은 장소 사진을 좌우로 넘기며 순번·사진별 출처를 표시함. 작은 저장 카드는 대표 사진을 유지함.</td></tr></tbody></table></div><div class=\"callout\"><strong>사용 흐름:</strong> 저장 카드의 담기 → 하단 팝업에서 ‘부산 여행’ DAY 2 선택 → 해당 상세. 홈 AI도 글 입력·미리보기·승인 후 내 여행으로 연결함.</div><p class=\"note\">완료 기준: 기간과 담을 DAY가 독립이며, 하단 팝업에서 확정한 DAY와 내 여행 상세가 일치함. 기존 스타일·사진 모션 실험을 보존함.</p>",
      "sources": [
        [
          "원본 차수 상세",
          "./spotlog-development-plan.html#slide-15"
        ],
        [
          "AI 요약",
          "./spotlog-ai-guide-summary.html"
        ]
      ],
      "section": "SPOTLOG · 1차 · 8"
    },
    {
      "section": "SPOTLOG · 1차 · 9",
      "title": "1차 추가 범위 · 담기·AI·콘텐츠",
      "lead": "저장은 장소를 모으고, 선택은 하단 팝업, 관리는 내 여행에서 진행함. 기존 1·2·3차의 상세 항목은 유지함.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">항목</th><th scope=\"col\">추가 구현 기준</th></tr></thead><tbody><tr><th scope=\"row\">1차 · 담기와 기간</th><td>기존 작은 가로 저장 카드는 유지함. 하단 팝업에서 당일치기~6박 7일을 고르면 DAY 1~N을 표시함. 기간과 담을 DAY는 독립 상태이며 확정 후 내 여행 상세를 엶.</td></tr><tr><th scope=\"row\">1차 · 홈 AI 진입</th><td>홈의 AI 여행 만들기에서 원하는 내용을 글로 받음. 지역·기간·취향·제외 조건을 확인하고 DAY별 로컬 초안을 제안함. 승인 전 저장하지 않으며 외부 AI 미연결을 표시함.</td></tr><tr><th scope=\"row\">1차 · 추천 여행 구분</th><td>여행기에서 AI 추천 여행을 별도 필터·라벨로 구분함. 개인 생성본은 비공개 내 여행이며 공개 목록에 섞지 않음. 추천 샘플은 실제 방문 후기로 표현하지 않음.</td></tr><tr><th scope=\"row\">공공 콘텐츠 준비</th><td>한국관광공사·지자체 자료도 항목별 허용 조건을 확인함. 공공누리 유형·저작자·원문 주소를 보존하고 장소와 일치하는 사진만 사용함. 원문 복사와 직접 작성한 안내를 구분함.</td></tr></tbody></table></div><p class=\"note\">홈 AI의 기본 입력·초안을 1차에 포함함. 3차에는 상세 조건·일부 재생성·관광 안내·번역을 확장하며 실제 서버 추천은 이후 연결함.</p>",
      "sources": [
        [
          "원본 추가 결정",
          "./spotlog-development-plan.html#slide-37"
        ]
      ]
    },
    {
      "section": "SPOTLOG · 1차 · 10",
      "title": "1차 · 사진 카드로 확인하는 AI·담기 팝업",
      "lead": "지역 안내에서 사용 중인 큰 랜드마크 카드의 사진·정보 구조를 AI 미리보기와 담기 팝업에도 재사용함.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">적용 위치</th><th scope=\"col\">구현 기준</th></tr></thead><tbody><tr><th scope=\"row\">AI 일정 미리보기</th><td>DAY별 후보를 사진·장소명·지역·설명·체류 정보가 있는 카드로 보여줌. 방문별 제외·다시 포함으로 장소를 고른 뒤 여행 생성을 승인함.</td></tr><tr><th scope=\"row\">담기 하단 팝업</th><td>담을 장소를 같은 큰 사진 카드로 보여주고 그 아래 여행·기간·DAY를 선택함. 여러 장소도 개별 카드를 확인할 수 있게 함.</td></tr><tr><th scope=\"row\">동일한 장소 표현</th><td>기존 LandmarkGuideCard의 사진 비율·정보 위계·여백을 재사용함. 저장 상태와 출처를 유지하고 화면 목적에 맞는 동작만 연결함.</td></tr><tr><th scope=\"row\">화면별 역할 보존</th><td>팝업 바깥 저장 목록의 작은 가로 SavedPlaceCard는 유지함. 여행기 본문 임베드·사진/영상 쇼츠를 일괄 교체하지 않음.</td></tr><tr><th scope=\"row\">미확인·실패 상태</th><td>장소 사진이 없으면 사진 없음으로 표시함. 다른 장소의 사진·가짜 평점·인기를 채우지 않으며, 로컬 초안·출처·오류 상태를 구분함.</td></tr></tbody></table></div><div class=\"callout\"><strong>승인 기준:</strong> 글 목록만 보고 생성·담기를 결정하게 하지 않음. 팝업을 닫거나 뒤로 가면 원래 화면 위치를 유지함. 새로 담기·AI 생성은 승인 전 원본 여행을 변경하지 않음.</div><p class=\"note\">320·390·460px에서 사진·선택 상태·빈 목록·팝업 스크롤과 하단 동작을 검증함. 현재 승인된 카드 스타일을 그대로 활용하며 새로운 디자인 체계를 만들지 않음.</p>"
    },
    {
      "section": "SPOTLOG · 1차 · 11",
      "title": "1차 · 랜드마크 카드의 여러 사진 넘김",
      "lead": "현재 랜드마크 카드의 이미지 영역 안에서 같은 장소의 여러 사진을 좌우로 넘기게 함.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">적용 영역</th><th scope=\"col\">구현 방향과 완료 조건</th></tr></thead><tbody><tr><th scope=\"row\">동일한 큰 카드</th><td>지역 안내·AI 미리보기·담기 하단 팝업의 LandmarkGuideCard에 같은 사진 넘김 기능을 적용함. 사진 높이·둥글기·글자·여백은 현재 화면 기준을 유지함.</td></tr><tr><th scope=\"row\">좌우 넘김</th><td>사진 영역에서 가로 스와이프와 이전·다음 조작을 제공함. 현재 순번·전체 장수를 표시하고 한 장일 때 불필요한 조작·순번은 숨김.</td></tr><tr><th scope=\"row\">사진별 정보</th><td>현재 사진에 맞는 설명·대체 텍스트·출처를 연결함. 다른 장소의 사진으로 장수를 채우지 않으며 사진 없음·불러오기 실패를 구분함.</td></tr><tr><th scope=\"row\">조작·로딩</th><td>현재·인접 사진부터 불러옴. 가로 넘김이 카드 저장·담기나 팝업 닫기를 실행하지 않도록 분리하고, 세로 스크롤과 선택 상태를 보존함.</td></tr><tr><th scope=\"row\">다른 화면 역할</th><td>기존 사진 피드는 장소를 세로, 같은 장소의 사진을 가로로 넘김. 저장 목록의 작은 가로 카드는 대표 사진을 유지하고 본문 임베드·영상은 일괄 교체하지 않음.</td></tr><tr><th scope=\"row\">완료 검수</th><td>320·390·460px에서 0·1·여러 장, 실패·선택·스크롤·팝업 상태를 검증함. 키보드 조작·읽기 도구 안내와 화면 복귀 후 사진 상태도 확인함.</td></tr></tbody></table></div><p class=\"note\">1차 추가 개발 항목임. 이번 문서 갱신만으로 제품 카드가 변경되지는 않으며, 사진 모션 실험이나 공개 영상 화면을 교체하지 않음.</p>",
      "sources": []
    },
    {
      "title": "2차 · 여행기 작성과 장소 카드별 소통",
      "lead": "목표: 글·사진·업체·랜드마크로 여행기를 작성하고, 읽는 사람이 카드별 반응·댓글을 남기는 화면을 완성함.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">구현 항목</th><th scope=\"col\">화면에서 구현할 내용</th></tr></thead><tbody><tr><th scope=\"row\">자동 임시 저장</th><td>작성 중 로컬 초안을 자동 저장함. 새로고침·앱 재실행 후 내용과 위치를 복구하고 저장 실패를 알림.</td></tr><tr><th scope=\"row\">글·사진·장소 편집</th><td>글·사진·업체·랜드마크 카드 삽입과 순서 변경을 구현함. 사진 여러 장·설명·대표 사진, 오류·미확인 상태를 표시함.</td></tr><tr><th scope=\"row\">DAY 이동·복사</th><td>장소와 연결된 글·사진을 함께 이동/복제함. 여행 전체·하루·장소 단위 복사와 원문 출처를 보존함.</td></tr><tr><th scope=\"row\">삭제 복구·지도</th><td>마지막 변경 취소와 삭제 복구를 제공함. 선택 DAY·본문 장소·지도 핀이 같은 방문을 가리키게 함.</td></tr><tr><th scope=\"row\">공개 전 미리보기</th><td>여행기를 읽는 화면으로 확인하고 빠진 사진·장소 정보를 점검함. 원본에 영향을 주지 않는 사본을 만듦.</td></tr><tr><th scope=\"row\">카드별 반응·댓글</th><td>본문의 업체·랜드마크마다 좋아요·댓글 수를 표시함. 하단 팝업에서 반응 확인·댓글·답글 작성·수정·삭제를 샘플로 구현함.</td></tr></tbody></table></div><div class=\"callout\"><strong>사용 흐름:</strong> DAY 2 장소에 주변 사진과 평가 작성 → 잠시 종료 → 초안 복구 → DAY 이동 → 지도와 미리보기 확인.</div><p class=\"note\">완료 기준: 여행기별 카드 반응을 분리하고 이동 시 유지·복사 시 0건으로 시작함. 실제 발행·저장·집계는 서버 단계이며 3차는 편집기를 재사용함.</p>",
      "sources": [
        [
          "원본 차수 상세",
          "./spotlog-development-plan.html#slide-17"
        ],
        [
          "AI 요약",
          "./spotlog-ai-guide-summary.html"
        ]
      ],
      "section": "SPOTLOG · 2차 · 12"
    },
    {
      "section": "SPOTLOG · 2차 · 13",
      "title": "2차 · 여행기 화면 구조와 독자 이용",
      "lead": "한 여행기의 글·사진 사이에 업체와 랜드마크를 넣고, 독자는 해당 항목을 보고 저장하거나 반응함.",
      "html": "<div class=\"table-wrap architecture-table\"><table><thead><tr><th scope=\"col\">화면 영역 · 위에서 아래</th><th scope=\"col\">구성 및 독자 동작</th><th scope=\"col\">차수</th></tr></thead><tbody><tr><th scope=\"row\">표지·작성자</th><td>제목·대표 사진·지역·기간·작성자·등급<br>작성자 프로필과 다른 여행기로 이동</td><td>기존 활용 / 2차 정돈</td></tr><tr><th scope=\"row\">DAY 선택 줄</th><td>DAY 앞 뒤로가기, 가로 DAY 전환<br>스크롤 중에도 뒤로가기·날짜 선택 유지</td><td>1차 공통 / 2차 편집 연결</td></tr><tr><th scope=\"row\">본문 · 글·사진·장소 카드</th><td>글·주변 사진·평가 사이에 음식점·호텔·랜드마크 삽입<br>장소명·설명·방문 정보·저장·여행 담기 제공</td><td>1차 저장 / 2차 작성</td></tr><tr><th scope=\"row\">카드 하단 · 좋아요·댓글</th><td>카드별 개수 표시 → 하단 팝업<br>반응한 사용자·댓글 목록·답글 펼침·입력창</td><td>2차 F19 / 실제 집계 B3</td></tr><tr><th scope=\"row\">지도·여행기 하단</th><td>DAY 지도 핀·이동 구간 / 여행기 전체 댓글·작성자 글<br>공유·내 여행으로 복사, 편집 시 저장·미리보기</td><td>2차 연결 / 실제 발행 B2·B3</td></tr></tbody></table></div><div class=\"callout\"><strong>작성자 흐름:</strong> 글·사진 추가 → 장소 선택 또는 직접 입력 → 카드 삽입 → 미리보기.<br><strong>독자 흐름:</strong> 여행기 읽기 → 카드 저장·반응 → 필요할 때 내 여행으로 복사함.</div><p class=\"note\">카드별 댓글과 여행기 전체 댓글은 서로 다른 영역임. 3차의 관광 안내·영어 보기는 이 여행과 DAY를 그대로 사용함. 숙소 예약·결제·가격 비교는 포함하지 않음.</p>",
      "sources": [
        [
          "원본 동일 구조도",
          "./spotlog-development-plan.html#slide-13"
        ]
      ]
    },
    {
      "section": "SPOTLOG · 2차 · 14",
      "title": "2차 · 스팟 주변 음식점·숙소 추가",
      "lead": "스팟으로 DAY별 일정의 기본 구성을 정한 뒤, 내 여행에서 음식점·카페와 숙박 거점을 보완함.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">화면</th><th scope=\"col\">사용자 동작과 연결</th></tr></thead><tbody><tr><th scope=\"row\">장소 발견·저장</th><td>가고 싶은 스팟을 저장함. 저장 화면은 기존 목록·지역 필터·여행 만들기 진입을 유지하고 업체 추천·일정 편집을 펼치지 않음.</td></tr><tr><th scope=\"row\">여행 만들기</th><td>기간과 DAY를 선택하고 사진 카드로 장소를 확인함. 승인하면 해당 내 여행 상세를 열며 이후 수정은 그곳에서 진행함.</td></tr><tr><th scope=\"row\">내 여행 · 스팟 주변</th><td>스팟 카드의 ‘＋ 주변 장소’로 하단 팝업을 엶. 추천 / 직접 검색 / 저장한 장소에서 음식점·카페를 고름.</td></tr><tr><th scope=\"row\">추가 위치</th><td>현재 여행·DAY·기준 스팟을 팝업에 표시함. 고른 장소는 기준 스팟 다음에 추가하며 여행과 DAY를 다시 묻지 않음.</td></tr><tr><th scope=\"row\">숙박과 공개 열람</th><td>숙소는 숙박할 DAY의 거점으로 추가함. 다른 사람의 여행기에는 편집 동작을 숨기고 읽기·저장·복사 흐름을 유지함.</td></tr></tbody></table></div><div class=\"callout\"><strong>화면 역할:</strong> 저장은 모으기·만들기, 내 여행은 DAY별 보완·관리임. 주변 업체의 직접 선택과 선택적 AI 보완은 같은 후보와 장소 카드를 사용함.</div><p class=\"note\">스팟을 먼저 고르는 흐름만으로 동선이 보장되지는 않음. 예약한 숙소·고정 시간은 처음부터 반영하고, 음식점은 다음 스팟 방향과 식사 시간을 함께 검토함.</p>"
    },
    {
      "section": "SPOTLOG · 2차 · 15",
      "title": "2차 · 여행기 속 장소 카드별 소통",
      "lead": "작성자는 여행기 본문에 업체·랜드마크를 넣고, 독자는 각 카드에 좋아요·댓글·답글을 남김.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">구현 영역</th><th scope=\"col\">화면과 동작</th></tr></thead><tbody><tr><th scope=\"row\">작성·제공</th><td>저장 장소·검색·직접 입력으로 음식점·호텔·랜드마크 카드를 넣음. 사진·경험·설명과 함께 독자에게 제공함.</td></tr><tr><th scope=\"row\">카드별 반응</th><td>각 카드 아래 좋아요 버튼·좋아요 수·댓글 수를 표시함. 좋아요는 누르기/취소, 숫자는 해당 카드의 하단 팝업을 엶.</td></tr><tr><th scope=\"row\">하단 팝업</th><td>좋아요 수를 누르면 반응한 사용자 목록, 댓글 수를 누르면 아이콘·이름·시각·본문과 입력창을 보여 줌. 여행기 제목·장소명을 함께 표시함.</td></tr><tr><th scope=\"row\">댓글·답글</th><td>댓글별 ‘답글 N개’를 같은 팝업에서 펼침. 답글 대상·취소, 본인 글 수정·삭제, 신고를 제공함. 목록은 나눠 불러오고 키보드 위에서 작성함.</td></tr><tr><th scope=\"row\">연결·보존</th><td>여행기 ID + 장소 카드 ID로 스레드를 구분함. 같은 업체라도 다른 여행기의 반응은 섞지 않음. 카드 이동은 유지, 복사본은 새 ID·반응 0건으로 시작함.</td></tr></tbody></table></div><div class=\"callout\"><strong>2차 F19:</strong> 카드 삽입·미리보기·반응·댓글·답글과 실패·로그인 필요 상태를 샘플로 구현함. <strong>이후 B3:</strong> 실제 저장·권한·중복 방지·집계·신고·차단을 연결함.</div><p class=\"note\">여행기 전체 댓글·업체 공통 리뷰와 분리함. 좋아요는 카드·계정별 1회, 댓글 수는 공개 댓글·답글 합계임. 닫기·뒤로가기 시 본문 위치·포커스·미전송 초안을 보존함. 샘플 수치는 실제 인기와 구분함.</p>",
      "sources": [
        [
          "원본 상세 동일 구성",
          "./spotlog-development-plan.html#slide-27"
        ]
      ]
    },
    {
      "title": "3차 · AI 추천·관광 안내·영어 이용",
      "lead": "구현 목표: 실제 엔진 연결 전, 조건 입력과 추천 확인·수정·영어 이용 흐름을 검증함.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">구현 항목</th><th scope=\"col\">화면에서 구현할 내용</th></tr></thead><tbody><tr><th scope=\"row\">추천 조건 입력</th><td>지역·취향 추천과 저장한 곳 구성을 구분함. 장소 범위·기간·교통·숙소·필수/제외·고정 조건을 입력함.</td></tr><tr><th scope=\"row\">후보·결과 확인</th><td>랜드마크·음식점·숙소 후보와 추천 근거, DAY별 배치·미배치 이유·경고를 보여 주고 승인/거절하게 함.</td></tr><tr><th scope=\"row\">부분 수정·승인</th><td>특정 DAY 재생성과 고정 항목 유지를 시연함. 변경 전후를 비교하고 승인 후 새 초안이나 수정본에 적용함.</td></tr><tr><th scope=\"row\">관광 안내·영어</th><td>현재 DAY·다음 장소·질문 답변·출처 화면을 제공함. 한국어/영어, 원문·번역 상태·한글 주소 보기를 연결함.</td></tr><tr><th scope=\"row\">실패·통합 검증</th><td>자료 부족·생성 취소·시간 초과·재시도·경로 미확인을 처리함. 저장·편집·승인·영어 이용 흐름을 회귀 검사함.</td></tr><tr><th scope=\"row\">3차와 백엔드 이후</th><td>3차는 후보 승인·부분 수정·안내·번역 화면을 확장함. 실제 내부 RAG·LLM·인기 점수·교통 검증·네이버 연결은 서버 단계에서 구현함. MapLibre와 현재 경로 표시는 유지함.</td></tr></tbody></table></div><div class=\"callout\"><strong>사용 흐름:</strong> 저장 장소와 조건 선택 → 추천·업체 후보 확인 → 하루만 수정 → 승인 → 관광 안내와 영어 원문 전환.</div><p class=\"note\">완료 기준: 샘플 응답으로 끝까지 동작하며 원본·고정 일정이 보존됨. 실제 RAG·LLM·경로·번역·인기 집계는 이후 서버에서 구현함.</p>",
      "sources": [
        [
          "원본 차수 상세",
          "./spotlog-development-plan.html#slide-19"
        ],
        [
          "AI 요약",
          "./spotlog-ai-guide-summary.html"
        ]
      ],
      "section": "SPOTLOG · 3차 · 16"
    },
    {
      "title": "후속 개발 · 백엔드와 콘텐츠 확보 순서",
      "lead": "1·2·3차 프런트엔드 이후 데이터 기반과 운영 안전성을 갖춘 뒤 실제 AI를 연결함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">순서</th><th scope=\"col\">추가 개발</th></tr></thead><tbody><tr><th scope=\"row\">B1 · 데이터 기반</th><td>회원·권한·기기 동기화, 로컬 여행 이전, 이미지 저장소, 계정 삭제·백업.</td></tr><tr><th scope=\"row\">B2 · 콘텐츠 운영</th><td>장소 검색·중복 통합, 사진/영상 업로드·최적화, 공개 URL·검색, 원문/복사 관계.</td></tr><tr><th scope=\"row\">B3 · 커뮤니티</th><td>실제 조회·담김, 여행기 속 카드별 좋아요·댓글·답글 저장과 집계, 작성자 등급·팔로우, 신고·차단·관리자 처리.</td></tr><tr><th scope=\"row\">B4 · AI·영어</th><td>내부 RAG 추천·업체 매칭, 실제 경로·일정·관광 안내, 번역·품질·사용량 관리.</td></tr><tr><th scope=\"row\">B5 · 앱 확장</th><td>원격 푸시·수신 설정, 오프라인 자료, 현장 방문 기록, 앱 링크·추가 언어·공동 편집.</td></tr></tbody></table></div><section class=\"section-block\"><h3>초기 콘텐츠 운영</h3><ul class=\"list\"><li>서울·부산·제주에서 당일/1박 2일/2박 3일 샘플 9개를 먼저 검수함. 이후 경주·강릉으로 확대함.</li><li>작성자를 모집하고 실제 저장·복사·작성 완료를 측정함. 샘플 반응을 실사용 성과로 사용하지 않음.</li></ul></section>",
      "section": "SPOTLOG · 후속 개발 · 17",
      "sources": [
        [
          "원본 상세 47쪽",
          "./spotlog-development-plan.html#slide-24"
        ],
        [
          "다른 요약본",
          "./spotlog-ai-guide-summary.html"
        ]
      ]
    },
    {
      "section": "SPOTLOG · 후속 개발 · 18",
      "title": "후속 개발 · 네이버 연동과 내부 RAG의 경계",
      "lead": "네이버 지역 검색은 외부 검색 확인 경로로 검토하며, 내부 추천용 데이터 적재를 기본 허용으로 가정하지 않음.",
      "html": "<div class=\"table-wrap compact\"><table><thead><tr><th scope=\"col\">항목</th><th scope=\"col\">계획에 반영한 판단</th></tr></thead><tbody><tr><th scope=\"row\">신규 연결</th><td>2026.07.31부터 신규 신청은 NAVER API HUB임. 서버 키로 연결하며 기존 개발자센터 키 유예는 2027.06.30까지임.</td></tr><tr><th scope=\"row\">검색 범위</th><td>최대 5건·start 1이며 반경·사진·평점·경로는 제공하지 않음. comment 정렬은 블로그·카페 리뷰 수로, 내부 인기 점수와 구분함.</td></tr><tr><th scope=\"row\">약관 확인</th><td>개발자센터의 2026.09.07 시행 약관은 AI 입력·학습·평가, 결과 변경·수익화 등에 제한을 둠. HUB는 별도 계약이므로 적용 범위를 서면 확인함.</td></tr><tr><th scope=\"row\">기본 사용 경계</th><td>네이버 결과의 영구 DB·RAG·자체 재정렬·다른 사진 결합·내부 병합은 승인 범위 확인 전 차단함. 사용자 선택만으로 허용되지 않음.</td></tr><tr><th scope=\"row\">비용·연동 시점</th><td>공식 문서의 월 775,000회·키별 50 RPS와 지역 API 일 25,000회 설명을 콘솔에서 확인함. 한시 무료를 상시 무료로 계획하지 않으며 실제 연동은 서버 이후임.</td></tr><tr><th scope=\"row\">외부 검색 변경</th><td>네이버 API HUB를 별도 외부 검색으로 검토함. 영구 저장·RAG·내부 병합·표시 허용을 계약으로 확인한 뒤 서버 연결 범위를 확정함. 사진·인기 데이터는 별도임.</td></tr></tbody></table></div><p class=\"note\">내부 추천은 허용된 공공·제휴·사용자 자료와 실제 반응을 사용함. 네이버 신규 키 발급·호출·저장 기능을 이번 문서 작업에서 실행하지 않음.</p>",
      "sources": [
        [
          "네이버 API HUB 이관 공지",
          "https://developers.naver.com/notice/article/32530"
        ],
        [
          "검색 API 특별약관 개정 · 2026.09.07 시행",
          "https://developers.naver.com/notice/article/33400"
        ],
        [
          "API HUB 지역 검색 규격",
          "https://api.ncloud-docs.com/docs/naver-api-hub-search-local"
        ],
        [
          "API HUB 이용 한도 안내",
          "https://guide.ncloud-docs.com/docs/apihub-overview"
        ]
      ]
    },
    {
      "title": "우선 결정과 완료 판단",
      "lead": "기존 기능을 다시 만들기보다 저장의 정확성, 기록 보존, 여행 정보의 신뢰도를 먼저 확인함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">판단 항목</th><th scope=\"col\">통과 조건</th></tr></thead><tbody><tr><th scope=\"row\">저장·편집</th><td>여행 기간과 대상 DAY가 독립적이며, DAY 이동/복사/삭제 후 글·사진·장소 연결이 유지됨.</td></tr><tr><th scope=\"row\">모바일 이용</th><td>새로고침 후 로컬 초안을 복구하고, 긴 스크롤에서도 뒤로가기·DAY 전환이 가능함.</td></tr><tr><th scope=\"row\">신뢰도</th><td>장소와 사진을 맞추고 미확인 좌표·영업·추정 경로를 표시함. 도보를 자동차 경로와 혼동시키지 않음.</td></tr><tr><th scope=\"row\">출시 판단</th><td>실제 회원·권한·집계·미디어·운영 대응은 백엔드 이후 별도 검증함. 화면 시연만으로 출시 완료라 하지 않음.</td></tr></tbody></table></div><section class=\"section-block\"><h3>착수 전에 확정할 사항</h3><ul class=\"list\"><li>각 차수의 구현·검수 항목을 확정하고, 첫 9개 샘플의 사진 권리와 내용을 점검함.</li><li>이번 프런트엔드 범위와 후속 서버 범위를 고정함. 국내 콘텐츠 확보는 별도 운영 업무로 함께 진행함.</li></ul></section><p class=\"note\">참고 방향: 트리플·Wanderlog의 일정 편집, Thatch의 장소형 가이드, Polarsteps의 기록 연결, Creatrip·VISITKOREA의 외국인 현장 안내를 원본에서 검토함.</p>",
      "section": "SPOTLOG · 완료 기준 · 19",
      "sources": [
        [
          "원본 상세 47쪽",
          "./spotlog-development-plan.html#slide-29"
        ],
        [
          "다른 요약본",
          "./spotlog-ai-guide-summary.html"
        ]
      ]
    }
  ]
});
