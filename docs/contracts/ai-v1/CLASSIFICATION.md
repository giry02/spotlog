# Jev 판별·서버 병합 기준

## 무엇을 판별할지

Jev는 외부 선택형 AI. 정해 둔 선택지 중 판별하고 확률을 반환하는 역할. 임의 장소명·날짜·문장을 생성하는 LLM처럼 사용하지 않음. `jev-questions.json`은 공식 `choice / instructions / criteria` 형식의 질문 초안. `model`, `state`, `questions`를 한 요청에 담는 어댑터는 백엔드에서 구현. 실제 호출·한국어 성능 검증은 아직 없음. [공식 API](https://docs.typesafe.ai/api), [Choice](https://docs.typesafe.ai/primitives/choice).

| 항목 | 값 | 서버 처리 |
|---|---|---|
| 지역 | DB 지역 후보 / unknown / ambiguous / multi_region | 별칭은 내부 regionId로 연결. 제주·강릉을 같은 DAY로 합치지 않음 |
| 기간 | 1~7일 / unspecified / ambiguous / out_of_range | ‘2박’→3일은 코드 계산. ‘2박 4일’은 충돌 확인 |
| 속도 | slow / balanced / full / unspecified / ambiguous | 많이 걷기와 알차게 방문은 구분. 보행 제약은 추가 요구로 보존 |
| 이동 | undecided / walk / transit / car / unspecified / mixed / ambiguous | 혼합 이동은 구간별 해석, 기본값으로 덮지 않음 |
| 식사·카페·숙박 추천 | include / exclude / unspecified / ambiguous | 부정·이중 부정·수정 문장 검증. 모호하면 해당 항목만 확인 |
| 점심·저녁 | include / exclude / unspecified / conditional | 특정 DAY 예외는 전역 제외로 바꾸지 않음 |
| 기존 숙박 언급 | booked / not_booked / unspecified / ambiguous | 실제 예약 여부는 서버 자료가 권위. 문장만으로 bookingFixed 생성 금지 |
| 추가 조건 | none / present / uncertain | 원문을 계속 보존. 판별 하나로 누락 없음이 입증되지는 않음 |
| 요청 종류 | generate / revise / unrelated / ambiguous | 현재 UI·서버 요청 종류와 대조. 생성 화면에서 예약 취소 같은 동작 수행 금지 |

`unknown`: 선택지 밖/판단 불가. `unspecified`: 언급 없음. `ambiguous`: 서로 다른 뜻·충돌. 이 셋을 ‘보통’이나 ‘전국’으로 치환하지 않음. 지역 후보는 실제 DB에서 주입; 제공 파일의 지역 목록은 시험용.

날짜·가격·고유명사처럼 자유 값은 코드로 원문 구간과 후보를 먼저 추출한 뒤 Jev 선택 또는 미해결 소형 해석에 전달. Jev가 문자열을 새로 추출해 주는 계약으로 만들지 않음. [공식 사전 추출 패턴](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook).

## UI 값과 문장 병합

1. 안 건드린 1박 2일·보통·이동 미정: `default_ui`. 문장에 명시하면 문장 우선.
2. 직접 누른 값: `explicit_ui`. 같은 항목의 문장 값과 다르면 자동 덮기보다 충돌 항목 하나 확인.
3. 문장을 보고 자동 채운 값: `text`. 실제 직접 선택으로 승격하지 않음.
4. 문장 안에서 ‘아니’, ‘말고’, ‘정정’처럼 명확히 바로잡으면 마지막 수정 값. 그냥 두 값이 공존하면 ambiguous.
5. 이후 확인한 값은 원문 버전/확인 이벤트와 연결. 이전 문장 때문에 같은 충돌을 반복해서 묻지 않음.
6. 누락된 지역은 기존 지역 선택으로 확인. 저장 장소가 같은 지역이면 해당 지역, 여러 지역이면 하나 선택. 지역 선택이 없는데 임의로 가장 인기 있는 지역을 넣지 않음.

## 초안 작성 기본값 · v1 시험 정책

- 기간 미언급: UI 기본 2일. 속도 balanced, 이동 undecided.
- 식사 미언급: 점심·저녁 포함. 카페는 요청 시 포함.
- 숙박 미언급: 2일 이상 포함, 당일 제외. 실제 예약된 숙소가 있으면 새 추천 대신 기존 숙소 유지.
- ‘관광지만’: 음식·카페·새 숙소 추천 제외. 기존 예약 삭제를 뜻하지 않음.
- 음식 추천 제외: 점심·저녁 추천도 제외. ‘점심만 빼’: 저녁 유지.
- ‘숙소 예약했어’: 새 숙소 추천 중지. 서버에 연결된 숙소가 없으면 예약 숙소 미연결 구간을 남기고 상세에서 연결. 호텔명/좌표를 생성하지 않음.
- ‘예약 안 했어/취소했어’: 문장 판별과 서버 예약 상태 변경 분리. 서버에 예약이 있다면 별도 확인 없이 제거하지 않음.

기본값은 현 프론트 샘플과 맞춘 초기 제안. 실제 정책 변경 시 policyVersion과 시험 정답을 함께 변경.

## 정규화 출력과 다음 단계

`Normalized`는 서버 병합 후 결과. Jev 원시 응답 자체가 아님. fields, nextAction, issues, unresolved, preserveVisitIds로 구성. 원문은 원래 GenerateRequest/RevisionRequest에 보존.

| nextAction | 조건 | 뒤 처리 |
|---|---|---|
| ready | 필요한 조건 확보, 별도 의미 해석 없음 | DB·RAG 검색과 일정 계산 |
| clarify | 실제 필수값 누락 또는 충돌 | 그 값만 고객 확인. 나머지 값·원문 유지 |
| local_interpret | DAY별 예외·동행·예산·식단·구간 이동 등 미해결 | 해당 원문과 통과 조건만 소형 LLM에 전달 → 서버 재검증 |
| unsupported | v1 범위 밖 기간·여행 외 요청 | 제한 설명/입력 수정. 대형 호출로 우회하지 않음 |

우선순위: 범위 밖 → 필수 누락/충돌 → 미해결 해석 → ready. 복합 요청에 unresolved가 남아도 먼저 필수값 확인 가능. 이미 지켜야 하는 예약 visitId는 모든 경로에서 보존.

`unresolved.text`는 원문의 정확한 부분 문자열, reason은 `day_specific / mobility / companion / diet / budget / date / place / mixed_transport / multi_region / revision / other`. 구간을 특정할 수 없으면 원문 전체와 other. 모델의 확신만으로 unresolved를 비우지 않음.

서버의 숫자/기간·지역·예약/제외 충돌 검사와 원문 보존을 기본 적용. Jev가 additional=none으로 놓친 의미는 여전히 가능하므로 한국어 평가에서 누락률 별도 측정. 의미 누락이 충분히 낮지 않으면 Jev 경로 채택 보류 또는 검사 범위 조정. 모든 요청을 다시 LLM에 보내면 속도 절감 가정을 다시 평가.

## 비교 방법

동일 입력·자료·일정 계산·검증으로 A=로컬 해석, B=Jev+필요 부분만 로컬 해석. 모델 버전/양자화·프롬프트·색인·칩·동시 요청 수 기록. 정상/오류 모두 포함. 최초 로딩과 준비 완료 상태를 분리해 측정.

100개 정답은 준비 자료. 실측 성적 없음. `evaluate.py`는 항목 일치율·전체 정답·잘못된 진행(clarify/unsupported를 ready 처리)·예약 보존 실패·미해결 요구 누락·지연 p50/p95 집계. 문장 의미 판정의 동일한 다른 구간 표기는 사람이 재검토. 이 자동 점수가 실제 경로·검색 품질을 검증하지는 않음.

초기 채택 목표 제안: 핵심 4항목 95% 이상, 제외/예약 보호 중대 오류 0건, 보류 30문장에서도 같은 기준. 소규모 시험으로 일반 고객 전체 정확도를 보장하지 않음. B가 A보다 실제 전체 초안 생성 시간이 짧으면서 품질이 유지될 때만 속도 이점 인정.
