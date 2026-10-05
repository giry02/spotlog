# AI 일정용 음식점·숙소 추가 자료

2026-09-21. 사용자 요청에 따라 로컬 추천 후보 12곳(음식점 8, 숙소 4)을 추가했다. 확인 중인 부산 해운대·동백섬에서 식사와 숙박 후보를 여러 개 비교할 수 있도록 우선 구성하고, 광안리·원도심·영도 일정용 음식점도 포함했다. 전국 업체 수급 완료나 실시간 검색 연결을 뜻하지 않는다.

## 수록 범위와 근거

- 공식 비짓부산 상세 페이지에서 업체명·분류·주소·지도 대표 좌표만 수작업으로 대조했다. 소개 본문·후기·별점·사진·가격·운영시간은 복제하지 않았다.
- 추가 문장은 Spotlog가 작성한 중립적인 일정 후보 설명이다. 실제 방문 평가나 인기 순위를 뜻하지 않는다.
- 음식점 좌표는 공식 상세 HTML의 `findPath_goal_lat/lng`, 숙소 좌표는 `mapObj.default_lat/lng`에서 확인했다. 네이버 검색·지도 반환값을 추출하거나 저장한 자료가 아니다.
- 좌표는 관광정보의 대표 지점이며 실제 방문 출입구·보행 경로 검증을 뜻하지 않는다. 현재 영업과 객실·예약 가능 여부는 확인 전이다. 숙소 공식 목록에는 ‘2025년 12월 등록 업체 기준’이 표시되어 있다.
- 사진 권리를 새로 확보하지 않았으므로 `image: ''`를 사용한다. 관련 없는 음식·호텔 사진으로 실제 업체 사진처럼 보이게 하지 않는다.
- 각 자료의 개별 ID, 출처 URL, 확인일, 좌표 성격, 사용 필드 범위를 `plannerBusinessSources`에 보존한다. 이번 소량 기본 사실 검수는 원문 사진·설명·전체 데이터베이스 재사용이나 외부 AI/RAG 전송 허락으로 확대 해석하지 않는다.

## 확인 목록

| 종류 | 장소 | 위도 / 경도 | 공식 원문 |
|---|---|---|---|
| 음식점 | 금수복국 해운대본점 | 35.16243 / 129.1645 | [비짓부산 146](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=146&lang_cd=ko) |
| 음식점 | 거대갈비 | 35.16155 / 129.16693 | [비짓부산 141](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=141&lang_cd=ko) |
| 음식점 | 동백섬횟집 | 35.160427 / 129.15468 | [비짓부산 154](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=154&lang_cd=ko) |
| 음식점 | 남천면가 | 35.139626 / 129.10675 | [비짓부산 2356](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=2356&lang_cd=ko) |
| 음식점 | 할매가야밀면 | 35.098934 / 129.03122 | [비짓부산 102](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=102&lang_cd=ko) |
| 음식점 | 재기돼지국밥 | 35.08963 / 129.03987 | [비짓부산 1837](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=1837&lang_cd=ko) |
| 음식점 | 몽실종가돼지국밥 감천문화마을 본점 | 35.10019 / 129.01718 | [비짓부산 961](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=961&lang_cd=ko) |
| 음식점 | 신창국밥 본점 | 35.10093 / 129.02254 | [비짓부산 198](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201002001000&uc_seq=198&lang_cd=ko) |
| 숙소 | 웨스틴 조선 부산 | 35.156128 / 129.15404 | [비짓부산 592](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201004001000&uc_seq=592&lang_cd=ko) |
| 숙소 | 신라스테이 해운대 | 35.15978 / 129.15875 | [비짓부산 596](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201004001000&uc_seq=596&lang_cd=ko) |
| 숙소 | 파라다이스호텔부산 | 35.160034 / 129.16446 | [비짓부산 591](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201004001000&uc_seq=591&lang_cd=ko) |
| 숙소 | 파크하얏트부산 | 35.156567 / 129.14197 | [비짓부산 590](https://www.visitbusan.net/index.busan?menuCd=DOM_000000201004001000&uc_seq=590&lang_cd=ko) |

## 구현 및 검증

- `web/src/plannerBusinessCatalog.ts`: 기존 `Place` 계약을 따르는 `plannerBusinessPlaces`, 출처 배열 및 ID 조회 맵을 별도 모듈로 제공한다. 기존 여행 기록과 저장 데이터를 일괄 수정하지 않는다.
- 기존 같은 지역·가까운 업체 필터를 사용한다. 음식점·숙소 제외 요청, 예약 숙소 보존, 점심·저녁·숙박 배치 규칙을 변경하지 않는다.
- `web/tests/plannerBusinessCatalog.test.mjs`: ID/출처 대응, 사진·운영 사실 비조작, 해운대·동백섬 근거리 선택 폭, 점심/저녁 중복 방지, 실제 일정 생성과 제외 요청을 검사한다.
- 이번 작업은 로컬용이다. Git 커밋·푸시·공개 사이트 배포를 하지 않는다.
