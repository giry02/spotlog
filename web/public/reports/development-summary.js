/* Separate executive summary. Original reports remain unchanged. */
Report.mount({
  "date": "2026.09.10",
  "title": "Spotlog 추가 개발 계획 요약",
  "shortTitle": "추가 개발 계획 요약",
  "otherTitle": "원본 전체 보기",
  "otherHref": "./spotlog-development-plan.html",
  "slides": [
    {
      "title": "추가 개발 계획 핵심",
      "lead": "기존 여행기 서비스를 유지하고, 총 3주간 프런트엔드 사용 흐름을 보완함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">구분</th><th scope=\"col\">요약</th></tr></thead><tbody><tr><th scope=\"row\">제품 방향</th><td>여행기를 읽고 장소를 저장한 뒤, 내 일정으로 활용하고 여행 후 기록을 발행함. 국내 콘텐츠를 먼저 쌓고 영어 이용을 준비함.</td></tr><tr><th scope=\"row\">현재 활용</th><td>홈 추천·여행기 검색, 장소 발견·지역별 저장, 여러 여행과 DAY 편집, 글·사진·장소 블록, 여행기 복사·지도 표시를 활용함.</td></tr><tr><th scope=\"row\">우선 보완</th><td>담을 여행·DAY를 명확히 선택하고, 저장/담김/해제를 구분함. 작성 중 기록 복구와 사진·장소 정보의 신뢰도를 높임.</td></tr><tr><th scope=\"row\">운영 전제</th><td>현재 AI·댓글·반응 등의 로컬 동작과 실제 서버 기능을 구분함. 3주 완료는 화면 검증 단계이며 정식 출시를 뜻하지 않음.</td></tr></tbody></table></div><div class=\"callout\"><strong>모바일웹과 하이브리드 앱을 유지함.</strong> 숙소·음식점은 여행기 속 장소로 다루며 예약·결제·숙박비 비교는 제외함.</div>",
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 1",
      "sources": [
        [
          "원본 상세 32쪽",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-4"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ]
    },
    {
      "title": "3주 프런트엔드 개발",
      "lead": "개발자 A는 탐색·저장, B는 작성·일정·AI 화면을 담당함. 선택 인력 C는 콘텐츠·통합 검수를 지원함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">차수</th><th scope=\"col\">주요 개발</th><th scope=\"col\">완료 기준</th></tr></thead><tbody><tr><th scope=\"row\">1차 · 1주</th><td>보관함 관리, 여행·DAY 선택 분리, 담김 상태·해제, 검색/목록/오류 정돈</td><td>원하는 여행의 원하는 DAY에 담고 해당 항목만 해제함.</td></tr><tr><th scope=\"row\">2차 · 1주</th><td>자동 임시 저장·복구, 글/사진/장소 편집, DAY 이동·복사, 삭제 복구·지도 연결</td><td>사진 있는 여행기를 복구할 수 있고, 복사본 수정이 원본에 영향을 주지 않음.</td></tr><tr><th scope=\"row\">3차 · 1주</th><td>AI 조건·추천·승인·부분 수정, 관광 안내, 한국어/영어 전환과 전체 검수</td><td>샘플 응답으로 생성부터 수정·안내·영어 보기까지 연결함.</td></tr></tbody></table></div><section class=\"section-block\"><h3>주간 운영 기준</h3><ul class=\"list\"><li>1일차 설계 확정, 2~4일차 구현, 5일차 통합 테스트·수정에 배정함.</li><li>AI·번역·외부 장소 검색은 연결 규격을 맞춘 샘플로 검증함. 실제 연동 전 상태를 표시함.</li></ul></section><p class=\"note\">로그인·서버 저장·실제 집계·외부 AI 호출은 이후 단계임. AI 문서 때문에 3주 일정이 별도로 추가되지 않음.</p>",
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 2",
      "sources": [
        [
          "원본 상세 32쪽",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-11"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ]
    },
    {
      "title": "백엔드와 콘텐츠 확보 순서",
      "lead": "3주 프런트엔드 이후 데이터 기반과 운영 안전성을 갖춘 뒤 실제 AI를 연결함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">순서</th><th scope=\"col\">추가 개발</th></tr></thead><tbody><tr><th scope=\"row\">B1 · 데이터 기반</th><td>회원·권한·기기 동기화, 로컬 여행 이전, 이미지 저장소, 계정 삭제·백업.</td></tr><tr><th scope=\"row\">B2 · 콘텐츠 운영</th><td>장소 검색·중복 통합, 사진/영상 업로드·최적화, 공개 URL·검색, 원문/복사 관계.</td></tr><tr><th scope=\"row\">B3 · 커뮤니티</th><td>실제 조회·담김·댓글·반응, 작성자 등급·팔로우, 신고·차단·관리자 처리.</td></tr><tr><th scope=\"row\">B4 · AI·영어</th><td>내부 RAG 추천·업체 매칭, 실제 경로·일정·관광 안내, 번역·품질·사용량 관리.</td></tr><tr><th scope=\"row\">B5 · 앱 확장</th><td>원격 푸시·수신 설정, 오프라인 자료, 현장 방문 기록, 앱 링크·추가 언어·공동 편집.</td></tr></tbody></table></div><section class=\"section-block\"><h3>초기 콘텐츠 운영</h3><ul class=\"list\"><li>서울·부산·제주에서 당일/1박 2일/2박 3일 샘플 9개를 먼저 검수함. 이후 경주·강릉으로 확대함.</li><li>작성자를 모집하고 실제 저장·복사·작성 완료를 측정함. 샘플 반응을 실사용 성과로 사용하지 않음.</li></ul></section>",
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 3",
      "sources": [
        [
          "원본 상세 32쪽",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-21"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ]
    },
    {
      "title": "우선 결정과 완료 판단",
      "lead": "기존 기능을 다시 만들기보다 저장의 정확성, 기록 보존, 여행 정보의 신뢰도를 먼저 확인함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">판단 항목</th><th scope=\"col\">통과 조건</th></tr></thead><tbody><tr><th scope=\"row\">저장·편집</th><td>여행 기간과 대상 DAY가 독립적이며, DAY 이동/복사/삭제 후 글·사진·장소 연결이 유지됨.</td></tr><tr><th scope=\"row\">모바일 이용</th><td>새로고침 후 로컬 초안을 복구하고, 긴 스크롤에서도 뒤로가기·DAY 전환이 가능함.</td></tr><tr><th scope=\"row\">신뢰도</th><td>장소와 사진을 맞추고 미확인 좌표·영업·추정 경로를 표시함. 도보를 자동차 경로와 혼동시키지 않음.</td></tr><tr><th scope=\"row\">출시 판단</th><td>실제 회원·권한·집계·미디어·운영 대응은 백엔드 이후 별도 검증함. 화면 시연만으로 출시 완료라 하지 않음.</td></tr></tbody></table></div><section class=\"section-block\"><h3>착수 전에 확정할 사항</h3><ul class=\"list\"><li>2인 역할과 검수 시간을 배정하고, 첫 9개 샘플의 사진 권리·내용 검수 담당을 정함.</li><li>이번 3주 범위와 후속 서버 범위를 고정함. 국내 콘텐츠 확보는 별도 운영 업무로 함께 진행함.</li></ul></section><p class=\"note\">참고 방향: 트리플·Wanderlog의 일정 편집, Thatch의 장소형 가이드, Polarsteps의 기록 연결, Creatrip·VISITKOREA의 외국인 현장 안내를 원본에서 검토함.</p>",
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 4",
      "sources": [
        [
          "원본 상세 32쪽",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-25"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ]
    }
  ]
});
