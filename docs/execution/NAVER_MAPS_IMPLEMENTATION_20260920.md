# 네이버 지도·업체 검색 연결 실행안

확인일: **2026-09-20, 한국 시간**. 신규 서버·DB·업체·순위 데이터가 아직 없는 상태를 기준으로 작성했다. 현재 코드는 변경하지 않았으며, 계정 가입·약관 동의·키 발급·유료 호출·Git 반영·배포도 실행하지 않았다. 아래 구현 순서와 제주 MVP는 제안이다.

기존 방향은 [데이터 수급 계획](../DATA_SUPPLY_AND_NAVER_PLAN.md), [완성 일정 우선 방향](AI_COMPLETE_ITINERARY_DIRECTION_20260920.md)을 따른다. 발견·저장 → 간단한 개인 동선 → 랜드마크 주변 업체 보완을 유지한다. AI는 사용자의 요청을 해석해 식사·숙박이 필요한 위치까지 포함한 초안을 제안하고, 후보 검색은 사용자가 수정할 때 열어야 한다.

## 1. 먼저 구분해야 하는 세 가지

| 기능 | 연결할 대상 | Spotlog에서 해야 하는 일 |
|---|---|---|
| 지도 표시·주소 변환·자동차 경로 | **NCP Maps** | 현재 지도 내부 구현을 교체하고 마커·DAY·카드 선택을 연결 |
| 사용자가 입력한 업체 찾기 | **NAVER API HUB 지역 검색** | 자체 서버에서 조회하고 별도 네이버 검색 영역에 표시 |
| 저장·업체 연결·주변 추천·자체 순위·AI/RAG | **새 Spotlog 서버와 내부 데이터** | 사용권을 확보한 장소 DB, 회사/지점 식별, 거리·순위 규칙, 여행 저장 구축 |

지도 서비스가 업체 DB와 자체 추천 엔진까지 만들어 주는 것은 아니다. 신규 지역 검색은 이제 일반 NAVER Developers 계정에서 신청하는 방식이 아니다. **NCP 계정 하나에서 Maps와 NAVER API HUB를 각각 신청하고 각 Application의 인증 정보를 관리**한다. Maps 키와 HUB 키를 서로 바꿔 쓰지 않는다.

공식 이관 공지는 검색 계열의 HUB 출시를 2026-06-25, Developers 신규 신청 종료를 2026-07-31, 기존 발급 키 지원 종료를 2027-06-30으로 안내한다. 이 공지는 **Maps가 HUB로 이관된다는 뜻이 아니다.** [공식 이관 공지](https://developers.naver.com/notice/article/32530), [HUB 이관 절차](https://guide.ncloud-docs.com/docs/apihub-migration)

## 2. 사용자가 준비할 것과 개발자가 맡을 것

### 사용자가 준비·결정할 항목

| 항목 | 준비할 내용 |
|---|---|
| 서비스 소유 계정 | 고객사/운영사 소유 NCP 계정. 회사 서비스라면 회사 명의 계정과 청구 담당자를 권장한다. 개인 계정도 지원하므로 사업자만 신청 가능하다는 뜻은 아니다 |
| 가입·청구 정보 | 계정 인증용 이메일·연락처, 사업자 유형을 선택할 경우 사업자 정보, 청구·결제 담당자와 결제 수단. 실제 제출 서류는 가입 화면에서 확인 |
| 권한 | 회사가 메인 계정을 소유하고 개발자는 Sub Account로 작업하도록 결정. 메인 비밀번호를 개발자에게 공유할 필요 없음 |
| 서비스 이용 신청 | **Maps**와 **NAVER API HUB** 각각 Subscription에서 약관을 읽고 동의. 특정 데이터를 장기 보관/AI에 쓰려는 경우 아래 별도 문의사항도 확인 |
| 사이트 주소 | 운영 도메인과 검수용 도메인 확정. 도메인 미정이면 현재 검수 주소로 개발하되 공개 전에 회사 소유 주소로 정리 |
| 앱 식별자 | Android 패키지명·iOS Bundle ID 확정. 현재 프로젝트 값은 둘 다 `com.spotlog.mobile`이며, 회사의 최종 배포 식별자로 승인된 상태는 아님 |
| 비용 관리 | 대표 계정 여부, 일/월 한도, 알림 수신자, 한도 초과 사용 허용 여부 결정. 무료 구간만 보고 예산 0원으로 확정하지 않음 |
| 첫 데이터 범위 | 초기 지역과 랜드마크·식당·카페·숙소 후보, 직접 제공받을 사진/주소/좌표/운영정보 및 권리 증빙. **제주 한 지역 시작은 제안이며 아직 확정되지 않음** |
| 순위 기준 | 실제 이용 데이터가 없으므로 초기는 검수한 추천·거리·분류 기준으로 시작할지 결정. 존재하지 않는 인기/별점/순위를 만들지 않음 |

Maps와 HUB는 일반 이용 신청·Application 등록 절차를 안내한다. 별도의 사업제휴 심사가 모든 지도 표시에 필수라고 단정하지 않는다. 다만 일반 약관이 허용하지 않는 데이터 저장·AI 활용을 원한다면 별도 이용 허락/계약 확인이 필요하다. [Maps 신청](https://guide.ncloud-docs.com/docs/application-maps-start-vpc), [HUB 신청·Application](https://guide.ncloud-docs.com/docs/apihub-application)

회사 계정 아래 개발 권한을 나눌 수 있다. HUB에는 전용 조회/관리 정책이 있으므로 작업 범위에 맞게 부여한다. [HUB 권한 관리](https://guide.ncloud-docs.com/docs/apihub-subaccount), [Maps 권한 관리](https://guide.ncloud-docs.com/docs/application-maps-subaccount)

### 개발자가 준비할 항목

- 웹 지도 연결, 마커와 기존 카드 선택 연결, DAY 변경·팝업 복귀 후 선택 유지.
- 서버 API, DB, 인증, 비밀키 저장, 호출 한도·오류·시간 초과 처리.
- 업체/지점 ID와 장소 ID를 연결하는 데이터 모델, 중복 검수와 좌표 검증.
- 개발/검수/운영 설정 분리, 키 없는 모의 응답 검증, 키 발급 후 실제 인증 검증.
- 네이버 결과의 출처·원문 링크·BI 표시 및 외부 검색과 자체 추천 영역의 분리.

## 3. Maps 신청과 웹·앱 등록

신규 연동은 **한국 리전 / VPC 콘솔 → Application Services → Maps → Subscription → 이용 신청 → Application 등록**으로 진행한다. 초기에는 Dynamic Map과 필요한 REST API만 선택한다. 과거 `AI·NAVER API > Application` 안내와 신규 서비스를 혼용하지 않는다. [신규 Maps 신청](https://guide.ncloud-docs.com/docs/application-maps-start-vpc), [신규 Application 등록](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)

공식 등록 문서는 Web 서비스 URL 최대 10개, Android 패키지명 최대 10개, iOS Bundle ID 최대 10개를 안내한다. HTTP/HTTPS 구분 없음·www 제외·서브도메인 등록 규칙도 명시되어 있으므로 실제 등록 화면에 맞춰 확인한다. 하이브리드는 실행 중 `location.href`를 기준으로 등록한다. **도메인뿐 아니라 실제 브라우저·WebView에서 인증 성공 여부를 검증**해야 한다. [서비스 환경 등록](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)

등록을 준비할 주소 목록은 다음과 같다. 이는 현재 주소 목록이며, 모두 무조건 같은 문자열로 등록 가능하다고 검증한 것은 아니다.

| 환경 | 현재/예정 주소 | 작업 |
|---|---|---|
| 로컬 웹 | `http://127.0.0.1:5210`, 필요 시 `http://localhost:5210` | 실제 접속 호스트·포트로 인증 확인 |
| Android 에뮬레이터 | 현재 HybridShell 기본 `http://10.0.2.2:5173` | 웹 개발 서버 포트와 환경변수를 맞춘 뒤 인증 확인 |
| iOS 개발 | 현재 기본 `http://localhost:5173` | 시뮬레이터/실기기의 접속 주소를 구분 |
| 기존 공개 웹 | `https://giry02.github.io/spotlog/` | 임시 공개 주소. 공유 호스팅에서 상위 도메인 전체를 넓게 허용하지 말고 실제 등록 지원 범위를 확인 |
| 고객 검수 | 회사 소유 검수 도메인 미정 | 고정 HTTPS 주소 권장 |
| 정식 운영 | 회사 소유 운영 도메인 미정 | 운영 Application과 허용 주소 확정 |

개발·검수용 Application과 운영용 Application을 분리하는 것이 관리상 좋다. 이는 Spotlog 운영 제안이며 Maps 필수 등록 조건은 아니다. 키를 나누어도 무료 사용량이 계정별로 늘어나는 것으로 계산하지 않는다. 대표 계정과 무료량 적용 조건을 확인하고, 초과 허용과 알림을 함께 설정한다. [Maps 이용량·한도 관리](https://guide.ncloud-docs.com/docs/application-maps-app-vpc), [대표 계정 설명](https://guide.ncloud-docs.com/docs/application-maps-overview)

### 웹 SDK와 호스팅

신규 JS 로더는 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=YOUR_CLIENT_ID` 형식이다. 예전 `ncpClientId` 예제를 그대로 복사하지 않는다. 브라우저에 들어가는 Client ID는 숨길 수 있는 서버 비밀번호가 아니므로 허용 서비스 환경과 사용량 제한으로 관리한다. **Client Secret은 웹 소스·Vite 공개 변수·앱 번들·Git에 넣지 않고 서버에만 둔다.** 공식 예제도 JS에는 Client ID만 전달한다. [현재 JS 시작 문서](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)

웹 페이지는 지금처럼 정적 호스팅할 수 있고 지도 리소스는 SDK가 네이버에서 받는다. 별도 지도 타일 서버를 직접 구축하는 방식으로 시작할 필요가 없다. 다만 검색·REST 프록시·회원·여행·업체 DB를 위해 **별도 Spotlog 백엔드 호스팅**은 필요하다. NCP의 VPC 콘솔 표기는 Maps 서비스 지원 환경이며, 이 문서에서 Spotlog 서버까지 반드시 NCP VM에 둬야 한다고 해석하지 않는다. 실제 호스팅 사업자는 백엔드 운영 조건에 따라 정한다. [Maps 제공 방식](https://api.ncloud-docs.com/docs/application-maps-dynamic), [지원 환경](https://guide.ncloud-docs.com/docs/application-maps-spec)

현재 앱은 `src/hybrid/HybridShell.tsx`의 WebView 기반이다. 우선 같은 웹 지도를 사용하면 웹/앱 지도 화면을 각각 다시 만들 필요가 줄어든다. 앱의 외부 네이버 지도 이동·위치 권한·복귀 동작을 별도 검증한다. 향후 네이티브 지도가 필요할 때 Android/iOS SDK와 확정 패키지/Bundle ID 등록을 진행한다. 이번 연구는 네이티브 지도 전환 결정이나 구현이 아니다.

## 4. 실제 사용할 API와 한계

REST 인증은 Maps Application의 `x-ncp-apigw-api-key-id`, `x-ncp-apigw-api-key` 헤더다. 신규 기본 호스트는 **`maps.apigw.ntruss.com`**이다. 이전 `naveropenapi.apigw.ntruss.com` 문서는 기존 서비스용이므로 신규 키와 혼용하지 않는다. [신규 Maps API 공통 설정](https://api.ncloud-docs.com/docs/application-maps-overview)

| 기능 | 서버 요청 경로 | 구현상 의미 |
|---|---|---|
| 주소 → 좌표 | `GET https://maps.apigw.ntruss.com/map-geocode/v2/geocode` | 주소 검색. 응답 `x` 경도, `y` 위도. 업체명 검색 API와 다름 |
| 좌표 → 주소 | `GET https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc` | 지번·도로명·행정구역. 모든 지점에 도로명 주소가 있는 것은 아님 |
| 자동차 경로 | `GET https://maps.apigw.ntruss.com/map-direction/v1/driving` | 출발/도착 외 경유지 최대 5개 |
| 경유지 많은 자동차 경로 | `GET https://maps.apigw.ntruss.com/map-direction-15/v1/driving` | 경유지 최대 15개 |

[Geocoding](https://api.ncloud-docs.com/docs/application-maps-geocoding), [Reverse Geocoding](https://api.ncloud-docs.com/docs/application-maps-reversegeocoding), [Directions 5](https://api.ncloud-docs.com/docs/application-maps-directions5), [Directions 15](https://api.ncloud-docs.com/docs/application-maps-directions15)

Directions 5/15는 **자동차 경로**다. 도보·대중교통 이동 시간을 같은 결과로 표시하면 안 된다. 자동차 전용도로 회피 옵션도 도보 경로를 의미하지 않는다. 응답의 거리는 m, 시간은 밀리초이므로 화면 단위로 변환한다. 조회 시점의 교통 반영 결과이며 미래 여행일의 확정 이동 시간으로 약속하지 않는다. DAY 순서·식사 시간·숙박 배치는 Spotlog가 결정하고 경로 API는 이동 구간 검증에 사용한다. [Directions 5 명세](https://api.ncloud-docs.com/docs/application-maps-directions5), [Directions 15 명세](https://api.ncloud-docs.com/docs/application-maps-directions15)

네이버 지도 앱으로 보내는 URL Scheme은 도보·대중교통·자동차·자전거 길찾기를 제공한다. 이것은 **외부 앱을 여는 기능**이며, 도보/대중교통 경로 데이터를 Spotlog 서버로 받는 API가 아니다. 초기에는 해당 수단을 외부 앱으로 연결하고 내부 소요시간은 미확인으로 표시하거나, 별도 허용된 경로 공급자를 계약한다. `appname` 필수이며 Android/iOS 식별자 또는 모바일 웹 URL을 넣는다. 미설치·복귀 처리를 함께 구현한다. [공식 앱 연동](https://guide.ncloud-docs.com/docs/application-maps-url-scheme-vpc)

## 5. 업체 검색은 HUB에서 별도 연결

서버에서 `GET https://naverapihub.apigw.ntruss.com/search/v1/local`을 호출하며, HUB Application의 Client ID/Secret을 쓴다. 클라이언트에서 직접 비밀키를 보내지 않는다. 사용자의 명시적 검색을 계기로 지역·업체명/분류를 질의한다. [지역 검색 명세](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)

확인된 기술 제약은 다음과 같다.

- 한 번에 최대 **5개**, 시작 위치는 **1**. 지역 업체를 전량 수집하거나 무한 페이지로 제공하는 API가 아니다.
- `random`은 정확도순, `comment`는 카페·블로그 리뷰 개수순이다. 별점순·Spotlog 순위로 표시하지 않는다.
- 반경·기준 좌표 검색 파라미터가 없다. 랜드마크 주변 전수 검색을 보장하지 않는다.
- 업체명·주소·분류·링크·좌표 등을 제공하지만 사진·별점·리뷰 본문·운영시간·예약 재고는 이 응답 항목이 아니다. `telephone`은 값이 없는 호환 필드다.
- `mapx/mapy`는 WGS84 문자열로 명시된다. **현 HUB 문서는 숫자 예제와 배율을 명시하지 않는다.** 예전 정수 응답 사례만 보고 일괄 `10^7`로 나누지 않는다. 승인된 실제 응답과 공식 확인으로 공급자 형식을 고정하고 경도/위도 범위를 검사한다. 추측 변환을 통과시키지 않는다.
- 응답에 안정적인 별도 `companyId`/장소 ID 필드가 명시되지 않는다. 링크에서 임의로 내부 ID를 추출해 영구 키로 쓰지 않는다.

위 기술 범위의 근거: [HUB 지역 검색 API](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)

HUB 개요 FAQ는 검색 카테고리 **통합 월 775,000회**, 키당 **50 RPS**, 한시 무료 기간 한도 증설 불가를 안내한다. 한편 지역 API 페이지에는 아직 일 25,000회가 적혀 있다. **문서 불일치가 있으므로 운영 한도는 신청 콘솔과 공식 문의로 확인**하고 서버에 월/초당 제한을 둔다. HUB가 현재 한시 무료라는 안내를 영구 무료 또는 향후 단가 확정으로 설명하지 않는다. Maps 요금과 별도다. [HUB 개요·호출 한도](https://guide.ncloud-docs.com/docs/apihub-overview)

## 6. 저장·RAG에 대한 현재 공식 조건

### NAVER API HUB 검색 결과

**2026-09-20 시행 HUB 전용 개정 공지**를 확인했다. 개발자센터의 9월 7일 약관을 HUB에 추정 적용한 결론이 아니다. 개정된 검색 특약은 검색 결과 제공 목적, 독립 표시·가공 금지·순위/내용 유지, 출처와 원문 링크, BI를 요구한다. 검색 데이터와 파생물의 저장·캐시·제3자 제공·AI 입력/학습/개선/평가/노출, 검색 결과 페이지 광고나 검색 API 수익화도 제한한다. 예외 임시 보관은 목적이 제한되며 기기는 24시간/새 질의 중 먼저 도달할 때까지, 서버 이력은 최대 21일, 개인화는 기기와 같은 제한을 명시한다. [HUB 약관 개정 공지 — 특약 2.1~2.4](https://www.ncloud.com/support/notice/all/2243), [HUB BI 가이드](https://guide.ncloud-docs.com/docs/apihub-brandguide)

따라서 기본 실행안은 **외부 검색 결과를 그대로 보여주고 원문으로 이동**하는 용도다. 내부 추천 카드와 합쳐 재정렬하거나 네이버 검색 내용을 LLM 문맥에 넣지 않는다. 사용자 선택이나 내부 ID 부여만으로 저장 권한이 생기지 않는다. 장기 여행에 네이버 응답을 복사하여 담기, 결과 업체를 내부 랭킹에 편입하기, 광고/유료 서비스에서의 노출은 서비스 흐름을 보여주고 별도 허락 범위를 먼저 확인해야 한다.

### Maps 결과 데이터

현재 NCP 정책 목록이 연결하는 Maps 약관의 **제7조⑨·⑪**은 결과 데이터의 무단 저장·가공 등을 제한하며, 반환 좌표를 모아 DB화하고 API 재호출 없이 재사용하는 행위도 금지한다. 따라서 **네이버 Geocoding을 일괄 호출해 모든 업체의 영구 좌표 DB를 만드는 안은 기본안으로 채택하지 않는다.** 경로 결과·주소 변환 결과도 서버/클라이언트 캐시와 로그 저장을 자동 허용하지 않는다. [Maps 약관 PDF](https://xv-ncloud.pstatic.net/images/provision/%5B%EB%AF%BC%EA%B0%84%5DMaps%EC%84%9C%EB%B9%84%EC%8A%A4%EC%9D%B4%EC%9A%A9%EC%95%BD%EA%B4%80_v0.4_(CLEAN)_1742433558704.pdf), [NCP 약관 목록](https://www.ncloud.com/policy/terms/svc?language=ko-KR)

내부 영구 좌표·주소는 직접 제공, 사용 조건이 맞는 공공 원천, 별도 계약으로 확보한다. 공급자별 데이터 권리와 필드 출처를 기록하고, 네이버 결과를 사람이 옮겨 적거나 다른 ID로 감싸서 권리를 우회한 것으로 처리하지 않는다. ‘AI 모델 학습을 안 하고 RAG만 쓴다’는 이유도 HUB의 **AI 입력 금지**를 피하는 근거가 아니다.

### 별도 허락이 필요한 경우 보낼 문의 내용

회사가 다음 사용 흐름을 명시해 NCP 고객지원에 문의하고 답변/계약을 보관한다. 이 문서 작성 중 문의를 발송하지 않았다.

1. 사용자가 선택한 업체의 이름·주소·좌표·링크를 개인 여행에 장기 저장할 수 있는 필드와 기간.
2. 자체 `companyId/placeId`와 외부 결과의 연결 식별정보를 보관할 수 있는 범위.
3. Maps Geocoding 좌표를 자체 장소 DB에 보존하거나 경로 응답을 일시 캐시할 수 있는 별도 조건.
4. 외부 검색 결과가 있는 화면의 광고·유료 서비스 결합 가능 범위.
5. 검색 또는 지도 결과를 AI 추천 입력/설명/RAG에 쓰는 별도 계약 가능 여부.
6. HUB 지역 좌표 숫자 단위와 현재 실제 호출 한도, 공유 호스팅 도메인 등록 범위.

[공식 문의](https://www.ncloud.com/support/question/service)

## 7. 내부 업체·순위·RAG 연결은 새로 만든다

현재 서버와 순위 데이터가 없으므로 ‘기존 업체 순위를 네이버에 붙이기’만 남은 상태가 아니다. 먼저 아래 최소 데이터를 구축해야 한다.

| 내부 데이터 | 역할 |
|---|---|
| `companyId` | 사업자/운영 주체 식별. 프랜차이즈 본사와 지점을 무조건 하나로 묶지 않음 |
| `placeId` | 실제 방문 지점. 이름·주소·검증 좌표·분류·운영 상태·출처·확인일 |
| `visitId`, `tripId`, `dayId`, `anchorVisitId` | 같은 장소를 여러 날 방문하더라도 각 방문 순서와 기준 랜드마크를 구분 |
| 추천 근거 | 초기 검수 추천, 거리·분류 조건. 이후 실제 저장/담김 등의 운영 지표가 쌓이면 정의한 자체 순위 적용 |
| 콘텐츠/권리 | 사진·설명·운영정보별 출처, 저장·노출·번역·AI 사용권, 버전, 회수 상태 |
| 연결 검수 | 이름+지점명+주소+좌표+분류를 대조하고 일치/보류/불일치 기록. 이름만 같으면 자동 통합하지 않음 |

예를 들어 ‘주안반점’은 먼저 특정 지점의 내부 `placeId`와 허가된 좌표를 가진다. 순위 데이터가 생기면 그 ID로 조회하여 카드와 지도에 같은 장소를 표시한다. AI/RAG 문서도 그 ID를 참조한다. **이 ID 연결 자체는 LLM 학습이 아니라 데이터 정합성 작업**이다. RAG는 사용권을 확보한 설명·취향·운영 근거를 찾고, 좌표·순위·방문 순서는 정형 데이터로 다룬다.

여행 생성은 내부 허가 데이터만으로 지역·기간·저장 장소·식사/숙박 요청을 해석하고, 가까운 후보와 시간대까지 포함한 초안을 만든다. 사용자가 고정한 예약 숙소와 제외 요청은 제약으로 유지한다. 내부 데이터가 부족하면 부족한 부분을 표시하고 미확인 업체를 생성하지 않는다. 네이버 검색은 사용자가 수정 과정에서 직접 업체를 찾는 별도 흐름이다.

## 8. 단계별 구현·검수 순서

| 단계 | 구현 | 완료 기준 |
|---|---|---|
| A. 데이터·서버 기반 | 첫 지역 선택, 내부 장소/업체/방문 테이블, 출처·권리, 서버 인증·비밀키 관리, 검수용 API | 실제 지점과 좌표가 대조된 소량 데이터로 저장→DAY→주변 후보가 이어짐 |
| B. 웹 지도 연동 | 현재 `RouteMap` 입력과 카드 UI를 보존하고 NAVER 지도 구현을 개발 설정 뒤에 추가 | 마커 번호·장소·DAY·선택 카드 일치, 크기/터치·모달 복귀·지도 실패 처리 |
| C. 자동차 경로 | 서버 프록시, DAY 좌표 검증, Directions 5/15 선택, 실패/한도/경유지 초과 처리 | 실제 조회 구간만 거리·시간 표시. 직선/추정 표시와 혼동 없음 |
| D. 업체 검색 | HUB 프록시, 명시적 질의, 독립 결과 표시·BI·원문, 약관에 맞는 보관 정책 | 자체 추천 순위와 외부 검색 순서가 분리되고 응답/비밀키가 영구 저장에 섞이지 않음 |
| E. 내부 추천·AI 연결 | 지역별 내부 후보, 식사 위치·숙소·고정 방문 포함 초안, ID 기반 조회·검증 | 사용자 요청→활용 가능한 초안→선택 수정. 신규 업체 임의 생성 없음 |
| F. 검수·앱 연결 | 검수 도메인·실제 Android Chrome/WebView·iOS·외부 지도 이동·복귀 | 저장·DAY·기준 랜드마크 보존, 키/한도/오프라인 오류에도 기존 여행 유지 |

현재 `web/src/App.tsx`의 `RouteMap`은 MapLibre와 OSM 타일을 사용하고 `places`, `selectedVisitId`, `onSelectVisit`를 받는다. 이 경계를 유지하면 **지도 교체를 위해 기존 내 여행 레이아웃 전체를 바꿀 필요는 없다.** 새로운 연결은 후속 별도 구현·검수 범위다. 어제 이전에 승인된 화면을 이번 조사 과정에서 변경하지 않았다.

키 발급 전에도 내부 ID/데이터 계약, 서버 프록시 규격, 지도 공급자 경계, 오류 처리와 모의 응답 검증은 준비할 수 있다. 키 발급 후에는 인증·허용 도메인·실제 좌표·경로 품질·사용량을 검수 환경에서 확인한다. 정식 공개는 별도 승인 후 진행한다.

## 9. 운영 전 확인할 미확정 사항

- 첫 지역/초기 데이터 건수, 자료의 실제 사용권, 자체 추천 기준.
- 회사 계정 소유자·대표 계정 여부·운영/검수 도메인·최종 앱 ID.
- Maps/HUB의 신청 시점 요금표와 비용 상한. 현재 문서로 확정하지 않은 단가·월 비용은 제시하지 않음.
- HUB의 월/일 한도 문서 차이와 좌표 숫자 배율.
- 네이버 데이터 장기 저장·AI·수익화에 대한 추가 허락 범위. 확인 전 기본안은 내부 허가 데이터와 외부 검색을 분리.
- 도보·대중교통의 내부 경로 공급 여부. 외부 네이버 앱 연결만으로 내부 이동시간 API가 완성됐다고 표시하지 않음.

**검증 방법 메모:** 공식 가이드·API 원문과 약관 PDF를 열어 확인했다. HUB 2243 공지는 웹 본문 추출기에 제목만 보이므로 동일 공식 공개 HTML의 `__NUXT_DATA__`에 포함된 공지 본문을 읽어 시행일과 특약 2.1~2.4를 확인했다. Maps PDF는 현재 NCP 약관 목록의 링크와 같은 파일임을 확인했다. 비공식 블로그의 정책 해석은 근거로 사용하지 않았다.
