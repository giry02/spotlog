/* Separate executive summary. Original reports remain unchanged. */
Report.mount({
  "date": "2026.09.10",
  "title": "Spotlog AI 관광 가이드 요약",
  "shortTitle": "AI 관광 가이드 요약",
  "otherTitle": "원본 전체 보기",
  "otherHref": "./spotlog-ai-guide-plan.html",
  "slides": [
    {
      "title": "AI 관광 가이드의 핵심",
      "lead": "Spotlog 내부 데이터에서 취향에 맞는 인기 장소를 찾고, 음식점·숙소와 실행 가능한 일정으로 연결함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">구성</th><th scope=\"col\">쉽게 말하면</th><th scope=\"col\">담당 역할</th></tr></thead><tbody><tr><th scope=\"row\">내부 RAG</th><td>우리 자료를 먼저 찾아 읽게 함</td><td>여행기·장소 설명에서 지역/취향에 맞는 후보와 추천 근거를 찾음.</td></tr><tr><th scope=\"row\">DB·인기 순위</th><td>조건과 실제 반응을 계산함</td><td>좌표·분류·권한으로 걸러내고 저장·복사·반응을 보정해 인기 순위를 계산함.</td></tr><tr><th scope=\"row\">LLM</th><td>조건을 이해하고 설명함</td><td>자연어 요청을 해석하고 후보 조합을 보조하며, 확인된 근거로 추천 이유와 관광 안내를 작성함.</td></tr><tr><th scope=\"row\">경로·일정 엔진</th><td>실제로 다닐 수 있는지 검사함</td><td>교통수단별 이동 시간과 체류·고정 조건을 확인하고 DAY별 배치를 검증함.</td></tr></tbody></table></div><div class=\"callout\"><strong>현재 자동 일정은 로컬 정렬과 정해진 문구 기반임.</strong> 내부 RAG·실제 교통·LLM 추천 엔진은 이후 개발할 대상임.</div>",
      "section": "SPOTLOG · AI GUIDE SUMMARY · 1",
      "sources": [
        [
          "원본 상세 57쪽",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-plan.html#slide-6"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-development-summary.html"
        ]
      ]
    },
    {
      "title": "추천 방식과 업체 매칭",
      "lead": "지역 추천, 저장 장소 구성, 외부 보완을 분리해 사용자가 의도한 범위 안에서 초안을 만듦.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">모드</th><th scope=\"col\">처리 기준</th></tr></thead><tbody><tr><th scope=\"row\">지역·취향 추천</th><td>내부 후보에서 랜드마크·음식점·숙소를 자동 조합하고 최종 저장 전 사용자 승인을 받음.</td></tr><tr><th scope=\"row\">저장한 곳 구성</th><td>선택 장소만 우선 사용함. 음식점·숙소 보충은 사용자가 선택한 경우에 진행함.</td></tr><tr><th scope=\"row\">외부 보완</th><td>내부 자료가 부족하면 별도 후보로 제시함. 승인 없이 넣거나 내부 인기 장소로 표시하지 않음.</td></tr></tbody></table></div><section class=\"section-block\"><h3>예시: 부산 2박 3일, 덜 걷고 바다·로컬 음식 선호</h3><ul class=\"list\"><li>지역·취향·걷기 조건으로 내부 랜드마크를 찾고 실제 반응과 근거를 확인함.</li><li>음식점은 주변 인기와 식사 시간·다음 동선을, 숙소는 여러 날의 이동 부담을 고려해 매칭함.</li><li>실제 경로로 무리한 이동을 검사하고, 미배치 장소·이유·변경안을 보여 준 뒤 승인받음.</li></ul></section><p class=\"note\">필요 데이터: 고유 장소 ID·좌표·분류·메타 정보, 연결된 여행기/사진, 확인일·권한, 중복을 제거한 실제 저장·복사·반응. 숙박 가격·예약은 제외함.</p>",
      "section": "SPOTLOG · AI GUIDE SUMMARY · 2",
      "sources": [
        [
          "원본 상세 57쪽",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-plan.html#slide-7"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-development-summary.html"
        ]
      ]
    },
    {
      "title": "기술과 모델 선택 기준",
      "lead": "원본의 후보 기술을 역할별로 나눔. 특정 모델을 확정하거나 추천 품질이 검증됐다고 가정하지 않음.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">역할</th><th scope=\"col\">원본의 적용 후보</th><th scope=\"col\">선택 기준</th></tr></thead><tbody><tr><th scope=\"row\">검색 기반</th><td>PostgreSQL + PostGIS + pgvector</td><td>장소·권한·거리 조건과 키워드/의미 검색을 함께 관리함.</td></tr><tr><th scope=\"row\">의미 검색</th><td>text-embedding-3-small / BGE-M3</td><td>문장의 의미를 검색용 숫자로 변환함. 한국어 여행 데이터 검색 품질과 운영비를 비교함.</td></tr><tr><th scope=\"row\">추천·설명 LLM</th><td>GPT / Claude / Gemini 계열 비교</td><td>같은 후보로 조건 준수·추천 근거·한국어/영어 품질·지연·1건 총비용을 평가함.</td></tr><tr><th scope=\"row\">경로 조회</th><td>자동차·도보 TMAP, 대중교통 ODsay 검증</td><td>교통수단별 실제 구간을 확보함. 상용 계약·표시·캐시·요금 조건 확인 후 확정함.</td></tr><tr><th scope=\"row\">일정 배치</th><td>규칙 기반 시작, 필요 시 OR-Tools</td><td>OR-Tools는 방문 순서·시간 제약 계산 도구임. 복잡한 고정 일정이 필요할 때 추가함.</td></tr></tbody></table></div><p class=\"note\">지도 표시는 현재 MapLibre를 유지함. LLM이 좌표·영업시간·경로를 만들어내지 않도록 결과를 검사함. 개별 모델명·단가·조건은 원본 29~33쪽을 참고하고 도입 시 다시 확인함.</p>",
      "section": "SPOTLOG · AI GUIDE SUMMARY · 3",
      "sources": [
        [
          "원본 상세 57쪽",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-plan.html#slide-29"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-development-summary.html"
        ]
      ]
    },
    {
      "title": "관광 안내와 자동번역",
      "lead": "국내 여행기 원문을 유지하고, 외국인이 실제로 찾아가고 이용할 수 있는 영어 안내를 연결함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">영역</th><th scope=\"col\">처리 방식</th></tr></thead><tbody><tr><th scope=\"row\">여행 중 안내</th><td>오늘 일정·다음 장소 이동·볼거리·이용 주의사항을 현재 여행과 확인된 근거로 답함.</td></tr><tr><th scope=\"row\">자동번역</th><td>본문·사진 설명은 원문 버전별로 번역·재사용함. UI 문구는 직접 관리하고 댓글은 요청 시 번역함.</td></tr><tr><th scope=\"row\">번역 기반</th><td>Google Cloud Translation Advanced와 용어집을 적용 후보로 검토함. 원문/자동번역/검수/재번역 필요를 구분함.</td></tr><tr><th scope=\"row\">현장 정보</th><td>한글 장소명·주소 크게 보기와 복사, 역·출구·마지막 도보, 예약·결제·문화 차이 정보를 원문부터 확보함.</td></tr></tbody></table></div><section class=\"section-block\"><h3>안내 품질의 필수 기준</h3><ul class=\"list\"><li>주소·장소명·숫자·날짜·부정 표현을 보존하고 출처와 확인 시점을 표시함.</li><li>미확인 영업·대기시간은 모른다고 표시함. 실제 방문자의 체험담을 생성하지 않음.</li></ul></section><p class=\"note\">한국어→영어가 첫 운영 범위임. 추가 언어·음성 가이드·실시간 통역·상시 위치 추적은 후속 단계로 분리함.</p>",
      "section": "SPOTLOG · AI GUIDE SUMMARY · 4",
      "sources": [
        [
          "원본 상세 57쪽",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-plan.html#slide-39"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-development-summary.html"
        ]
      ]
    },
    {
      "title": "개발 순서와 비용 관리",
      "lead": "모델 호출료뿐 아니라 데이터 준비·검색·경로·번역·운영 비용까지 묶어 판단함.",
      "html": "<div class=\"table-wrap\"><table><thead><tr><th scope=\"col\">단계</th><th scope=\"col\">진행 내용</th></tr></thead><tbody><tr><th scope=\"row\">프런트엔드 1·2·3차</th><td>입력·추천 근거·업체 후보·승인·부분 수정·관광 안내·번역 화면을 샘플로 검증함.</td></tr><tr><th scope=\"row\">서버 기반 이후</th><td>내부 데이터/권한·검색 색인을 준비하고, 추천·업체 매칭과 LLM 비교를 진행함.</td></tr><tr><th scope=\"row\">엔진·영어 시범</th><td>실제 경로·일정 검증과 관광 안내·번역을 연결한 뒤 비공개 평가를 통과함.</td></tr></tbody></table></div><section class=\"section-block\"><h3>예산에 포함할 항목</h3><ul class=\"list\"><li>초기 원문 정리·임베딩 색인과 콘텐츠 검수 비용을 별도 확보함.</li><li>요청별 검색·LLM·재시도, 교통 경로, 새 번역량, DB·저장·전송 비용을 합산함.</li><li>동일 요청 중복 방지, 변경분만 재처리, 번역 재사용, 사용자 한도·예산 경보를 적용함.</li></ul></section><div class=\"callout\"><strong>도입 전 결정:</strong> 내부 자료·인기 지표 기준, 공급자 계약, 모델 비교 결과와 실제 1건 비용, 월 예산 한도를 확정함. 비밀 키와 비공개 여행의 권한은 서버에서 관리함.</div>",
      "section": "SPOTLOG · AI GUIDE SUMMARY · 5",
      "sources": [
        [
          "원본 상세 57쪽",
          "https://giry02.github.io/spotlog/spotlog-ai-guide-plan.html#slide-46"
        ],
        [
          "다른 요약본",
          "https://giry02.github.io/spotlog/spotlog-development-summary.html"
        ]
      ]
    }
  ]
});
