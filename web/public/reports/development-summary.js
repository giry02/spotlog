/* Executive summary with a dedicated page for each implementation phase. */
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
      "title": "1차·2차·3차 프런트엔드 합본",
      "lead": "개인 개발 기준으로 한 차수씩 구현·검증함. 차수는 기능 묶음이며, 각각 1주로 환산하지 않음.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">차수</th><th scope=\"col\">구현 범위</th><th scope=\"col\">완료 후 가능한 일</th></tr></thead><tbody><tr><th scope=\"row\">1차 · 발견·저장</th><td>검색·보관함·여행/DAY 선택·담김 상태·해제</td><td>찾은 장소를 원하는 여행과 DAY에 정확히 넣음.</td></tr><tr><th scope=\"row\">2차 · 일정·작성</th><td>임시 저장·복구·사진/글·이동/복사·지도·미리보기</td><td>사진 있는 여행기를 안전하게 편집하고 재사용함.</td></tr><tr><th scope=\"row\">3차 · 추천·안내</th><td>AI 추천·후보 승인·부분 수정·관광 안내·영어 샘플</td><td>추천 초안부터 수정·관광 안내·영어 열람까지 확인함.</td></tr></tbody></table></div><section class=\"section-block\"><h3>차수 진행 기준</h3><ul class=\"list\"><li>각 차수 안에서 구조 정리, 기능 구현, 실패 상태 처리, 전체 흐름 검증을 순서대로 진행함.</li><li>앞 차수의 기록과 상태를 다음 차수에서 재사용함. 별도 개발자 역할 배정이나 주간 마감은 두지 않음.</li></ul></section><p class=\"note\">1~3차는 프런트엔드 범위임. 실제 로그인·서버 저장·AI/RAG·교통·번역 연동은 이후 백엔드 단계임.</p>",
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
      "title": "1차 · 장소 발견부터 정확한 담기까지",
      "lead": "구현 목표: 장소를 저장한 뒤 어느 여행의 몇 일차에 들어가는지 명확하게 확인함.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">구현 항목</th><th scope=\"col\">화면에서 구현할 내용</th></tr></thead><tbody><tr><th scope=\"row\">검색·지역 목록</th><td>검색·지역 조건에 맞는 목록, 자동 추가 로딩, 빈 결과·오류·이전 목록 복원을 정리함.</td></tr><tr><th scope=\"row\">저장함·보관함</th><td>빠른 저장과 이름 있는 보관함을 제공함. 보관함 생성·이름 변경, 장소 이동·복사·메모를 구현함.</td></tr><tr><th scope=\"row\">여행·DAY 선택</th><td>담기 창에서 여행 제목과 DAY를 직접 선택함. 여행 기간 입력과 분리하고 없는 DAY는 추가 여부를 확인함.</td></tr><tr><th scope=\"row\">담김·해제 표시</th><td>담긴 여행과 DAY를 확인하고 해당 방문만 해제함. 저장 해제와 여행에서 빼기를 구분하며 재방문도 처리함.</td></tr><tr><th scope=\"row\">기존 기록·예외</th><td>기존 데이터를 보존하고 여행 없음·중복·저장 실패를 안내함. 긴 스크롤에서도 조작과 뒤로가기를 유지함.</td></tr></tbody></table></div><div class=\"callout\"><strong>사용 흐름:</strong> 지역에서 장소 찾기 → 보관함 저장 → ‘부산 여행’ DAY 2 선택 → 담긴 위치 확인 → DAY 2에서만 해제함.</div><p class=\"note\">완료 기준: 다른 여행·DAY·보관함의 관계가 바뀌지 않음. 2차에서는 이 저장·방문 구조를 그대로 편집에 사용함.</p>",
      "sources": [
        [
          "원본 차수 상세",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-12"
        ],
        [
          "AI 요약",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ],
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 3"
    },
    {
      "title": "2차 · 사진 있는 여행기 작성과 복구",
      "lead": "구현 목표: 1차에 담은 장소를 글·사진·지도와 연결하여 편집하고, 중단 후에도 기록을 이어 씀.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">구현 항목</th><th scope=\"col\">화면에서 구현할 내용</th></tr></thead><tbody><tr><th scope=\"row\">자동 임시 저장</th><td>작성 중 로컬 초안을 자동 저장함. 새로고침·앱 재실행 후 내용과 위치를 복구하고 저장 실패를 알림.</td></tr><tr><th scope=\"row\">글·사진·장소 편집</th><td>블록 추가·순서 변경, 사진 여러 장 선택·설명·대표 사진을 구현함. 사진 오류와 미확인 장소를 표시함.</td></tr><tr><th scope=\"row\">DAY 이동·복사</th><td>장소와 연결된 글·사진을 함께 이동/복제함. 여행 전체·하루·장소 단위 복사와 원문 출처를 보존함.</td></tr><tr><th scope=\"row\">삭제 복구·지도</th><td>마지막 변경 취소와 삭제 복구를 제공함. 선택 DAY·본문 장소·지도 핀이 같은 방문을 가리키게 함.</td></tr><tr><th scope=\"row\">공개 전 미리보기</th><td>여행기를 읽는 화면으로 확인하고 빠진 사진·장소 정보를 점검함. 원본에 영향을 주지 않는 사본을 만듦.</td></tr></tbody></table></div><div class=\"callout\"><strong>사용 흐름:</strong> DAY 2 장소에 주변 사진과 평가 작성 → 잠시 종료 → 초안 복구 → DAY 이동 → 지도와 미리보기 확인.</div><p class=\"note\">완료 기준: 이동·복사·복구 후 연결이 유지됨. 서버 업로드·실제 발행은 후속이며, 3차는 이 편집기를 추천 초안에 재사용함.</p>",
      "sources": [
        [
          "원본 차수 상세",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-14"
        ],
        [
          "AI 요약",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ],
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 4"
    },
    {
      "title": "3차 · AI 추천·관광 안내·영어 이용",
      "lead": "구현 목표: 실제 엔진 연결 전, 사용자가 조건을 정하고 추천을 확인·수정하는 전체 화면을 검증함.",
      "html": "<div class=\"table-wrap \"><table><thead><tr><th scope=\"col\">구현 항목</th><th scope=\"col\">화면에서 구현할 내용</th></tr></thead><tbody><tr><th scope=\"row\">추천 조건 입력</th><td>지역·취향 추천과 저장한 곳 구성을 구분함. 장소 범위·기간·교통·숙소·필수/제외·고정 조건을 입력함.</td></tr><tr><th scope=\"row\">후보·결과 확인</th><td>랜드마크·음식점·숙소 후보와 추천 근거, DAY별 배치·미배치 이유·경고를 보여 주고 승인/거절하게 함.</td></tr><tr><th scope=\"row\">부분 수정·승인</th><td>특정 DAY 재생성과 고정 항목 유지를 시연함. 변경 전후를 비교하고 승인 후 새 초안이나 수정본에 적용함.</td></tr><tr><th scope=\"row\">관광 안내·영어</th><td>현재 DAY·다음 장소·질문 답변·출처 화면을 제공함. 한국어/영어, 원문·번역 상태·한글 주소 보기를 연결함.</td></tr><tr><th scope=\"row\">실패·통합 검증</th><td>자료 부족·생성 취소·시간 초과·재시도·경로 미확인을 처리함. 저장부터 편집·승인·영어까지 회귀 검사함.</td></tr></tbody></table></div><div class=\"callout\"><strong>사용 흐름:</strong> 저장 장소와 조건 선택 → 추천·업체 후보 확인 → 하루만 수정 → 승인 → 관광 안내와 영어 원문 전환.</div><p class=\"note\">완료 기준: 샘플 응답으로 끝까지 동작하며 원본·고정 일정이 보존됨. 실제 RAG·LLM·경로·번역·인기 집계는 이후 서버에서 구현함.</p>",
      "sources": [
        [
          "원본 차수 상세",
          "https://giry02.github.io/spotlog/spotlog-development-plan.html#slide-16"
        ],
        [
          "AI 요약",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-summary.html"
        ]
      ],
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 5"
    },
    {
      "title": "백엔드와 콘텐츠 확보 순서",
      "lead": "1·2·3차 프런트엔드 이후 데이터 기반과 운영 안전성을 갖춘 뒤 실제 AI를 연결함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">순서</th><th scope=\"col\">추가 개발</th></tr></thead><tbody><tr><th scope=\"row\">B1 · 데이터 기반</th><td>회원·권한·기기 동기화, 로컬 여행 이전, 이미지 저장소, 계정 삭제·백업.</td></tr><tr><th scope=\"row\">B2 · 콘텐츠 운영</th><td>장소 검색·중복 통합, 사진/영상 업로드·최적화, 공개 URL·검색, 원문/복사 관계.</td></tr><tr><th scope=\"row\">B3 · 커뮤니티</th><td>실제 조회·담김·댓글·반응, 작성자 등급·팔로우, 신고·차단·관리자 처리.</td></tr><tr><th scope=\"row\">B4 · AI·영어</th><td>내부 RAG 추천·업체 매칭, 실제 경로·일정·관광 안내, 번역·품질·사용량 관리.</td></tr><tr><th scope=\"row\">B5 · 앱 확장</th><td>원격 푸시·수신 설정, 오프라인 자료, 현장 방문 기록, 앱 링크·추가 언어·공동 편집.</td></tr></tbody></table></div><section class=\"section-block\"><h3>초기 콘텐츠 운영</h3><ul class=\"list\"><li>서울·부산·제주에서 당일/1박 2일/2박 3일 샘플 9개를 먼저 검수함. 이후 경주·강릉으로 확대함.</li><li>작성자를 모집하고 실제 저장·복사·작성 완료를 측정함. 샘플 반응을 실사용 성과로 사용하지 않음.</li></ul></section>",
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 6",
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
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">판단 항목</th><th scope=\"col\">통과 조건</th></tr></thead><tbody><tr><th scope=\"row\">저장·편집</th><td>여행 기간과 대상 DAY가 독립적이며, DAY 이동/복사/삭제 후 글·사진·장소 연결이 유지됨.</td></tr><tr><th scope=\"row\">모바일 이용</th><td>새로고침 후 로컬 초안을 복구하고, 긴 스크롤에서도 뒤로가기·DAY 전환이 가능함.</td></tr><tr><th scope=\"row\">신뢰도</th><td>장소와 사진을 맞추고 미확인 좌표·영업·추정 경로를 표시함. 도보를 자동차 경로와 혼동시키지 않음.</td></tr><tr><th scope=\"row\">출시 판단</th><td>실제 회원·권한·집계·미디어·운영 대응은 백엔드 이후 별도 검증함. 화면 시연만으로 출시 완료라 하지 않음.</td></tr></tbody></table></div><section class=\"section-block\"><h3>착수 전에 확정할 사항</h3><ul class=\"list\"><li>각 차수의 구현·검수 항목을 확정하고, 첫 9개 샘플의 사진 권리와 내용을 점검함.</li><li>이번 프런트엔드 범위와 후속 서버 범위를 고정함. 국내 콘텐츠 확보는 별도 운영 업무로 함께 진행함.</li></ul></section><p class=\"note\">참고 방향: 트리플·Wanderlog의 일정 편집, Thatch의 장소형 가이드, Polarsteps의 기록 연결, Creatrip·VISITKOREA의 외국인 현장 안내를 원본에서 검토함.</p>",
      "section": "SPOTLOG · DEVELOPMENT SUMMARY · 7",
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
