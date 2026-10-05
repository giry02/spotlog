# Spotlog 전체 설계 문서 — 14장 목차

**2026-09-29 최신 개정:** 맥미니 소형 LLM의 조건 해석·설명을 기본 경로로 정리. Jev는 선택 비교 후보. 네이버 외부 길찾기 / 지도 SDK / 주소·경로 API / 업체 검색을 분리하고 GitHub 업로드·로컬 구현·실제 연결 전·향후 상태 표시. [변경·검수 기록](FIGJAM_ARCHITECTURE_UPDATE_20260929.md). 09/23 Jev 선행안은 [이전 비교안](JEV_LLM_ARCHITECTURE_20260923.md)으로 보존.

**2026-09-21 최신 추가:** 맥미니 64GB 로컬 AI·RAG 구성을 11~13에 상세화. 먼저 [11 전체 연결](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=77-1293) → [12 고객 요청 처리](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=78-1343) → [13 자료 갱신·협업](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=79-1440) 순서로 확인. [추가 도면 기록](MAC_MINI_FIGJAM_20260921.md). 로컬 모델·검색 DB는 시험 제안이며 아직 설치·연결 전.

2026-09-21 · 기존 4장 명칭 보완 + 추가 7장 · 메모체 · FigJam 설계 자료

[FigJam 전체 보드](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi) · [추가 도면 원고·연결표](SYSTEM_DIAGRAM_DETAILS_20260921.md)

**2026-09-21 가독성 개정:** 00~10 전체를 항목 단위로 재편. 한 상자에 한 행동, 큰 제목·짧은 담당 표기, 기본·판단·예외 구역 분리. 고객 여정은 단계별 4칸, AI는 기본 생성·실패 판단·대형 부분 보완의 3구역. 기존 도면 링크와 설계 정책 유지. [도면별 변경·검수 기록](DIAGRAM_READABILITY_20260921.md).

기존 Mermaid 원고는 상세 연결·정책 참고용. 최신 FigJam은 기능별로 끊어 읽는 배치로 변경했으므로 원고와 화면 배치가 다름.

## 적용 순서

- 우선: 간단 생성에 글 입력 → 맥미니 소형 LLM 조건 해석 → 서버 검증 → DB·RAG 후보 조회 → 서버 일정 구성 → 소형 LLM 설명 → 검증·초안 확인·저장
- 원문·추가 요구 보존. 실제 없는 필수 정보는 필요한 항목만 확인. Jev는 고정 항목 분류의 선택 비교 후보이며 RAG 검색 담당 아님
- 대형 LLM: 근거가 충분한 모델 실패에만 미해결 부분 보완 → 동일 검증 후 병합. [모델별 역할·호출 기준](AI_MODEL_CASCADE_20260921.md)
- 저장 장소로 추천 유지. 찜을 먼저 하지 않아도 글로 바로 생성 가능
- 향후: 챗봇 화면·대화 맥락 추가 → 같은 검색·생성·검증·저장 기능 재사용
- Flowise는 초기에도 활용하는 실행 도구. 챗봇 화면이나 대화 세션과 별개
- [간단 생성 우선 적용안](AI_SIMPLE_FIRST_ROADMAP_20260921.md) · 실제 AI·서버 연결 완료 의미 아님

## 바로 열기

| 번호 | 자료 | 읽는 내용 |
|---|---|---|
| 00 | [시스템 전체 구성도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=21-379) | 우리 화면·서버·DB, 자체 운영 Flowise, 외부 AI·네이버·사진 저장 연결 |
| 01 | [개념도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=5-262) | 요청 → 검증된 일정 제안과 구성별 역할 |
| 02 | [기술 상세 연결도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=4-34) | 회원·자료 등록·AI·RAG·지도·업체 검색·저장·사진 요청과 응답 |
| 03 | [고객 여정별 상세 연결도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=15-379) | 가입 → 발견·찜 또는 직접 입력 → AI 간단 생성 → 다듬기 → 여행기 → 추천·스레드 |
| 04 | [서비스 기능·화면 전환도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=34-1342) | 우선: 글 입력·저장 장소로 간단 생성 / 향후: 챗봇 진입 추가 |
| 05 | [데이터 관계도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=35-1342) | 우리 DB 설계안 · 실제 서버·DB 미구축 · 확정 DDL 이전의 핵심 관계 |
| 06 | [장소·업체 데이터 등록 과정](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=35-1353) | 자료 확보부터 추천 노출까지 · 운영 검수 + 우리 서버·DB + 맥미니 임베딩 AI |
| 07 | [소형 LLM 기본 · 대형 예외 보완](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=35-1364) | 소형 조건 해석 → 검색·일정 계산 → 소형 설명. 정보·자료 부족과 모델 실패 구분 |
| 08 | [내부·외부 연결과 실패 대응](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=33-1278) | 연결 대상·호출자·주고받는 정보·실패 대응 · API는 호출 방식 |
| 09 | [권한·공개·삭제 처리도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=36-1342) | 내 여행·여행기 독립 · 소유권은 우리 서버에서 확인 · 휴지통 6개월 |
| 10 | [개발·검수·배포·운영 흐름도](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=36-1353) | 코드 백업·고객 검수·공개 배포 분리 · 현재 웹 배포 경로 + 향후 서버·앱 운영 |
| 11 | [맥미니 AI·RAG 전체 연결](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=77-1293) | 서버와 맥미니 경계 · 언어/임베딩 AI · Flowise/Ollama · DB · 외부 서비스 |
| 12 | [고객 요청 한 건의 처리](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=78-1343) | 조건 인식·후보·근거·일정·설명·검증·저장 · 대형 예외 · 내부 규격 |
| 13 | [RAG 자료 갱신·협업](https://www.figma.com/board/8IageUvocd3SaddRKOoCGi?node-id=79-1440) | 자료 승인·색인·동기화 · 주안반점 ID 예시 · 백엔드/AI 병행 |

## 읽는 순서

- 고객 설명: 00 전체 구성 → 01 개념 → 03 고객 여정 → 04 화면 전환
- 백엔드 협업: 05 데이터 관계 → 06 자료 등록 → 08 연결·실패 → 09 권한 → 10 배포·운영
- AI 협업: 06 등록·색인 → 07 AI 처리 → 02 요청·응답 상세 → 08 실패 대응
- 실제 실행 전 합의: 모델·호스팅·인증 제공자, 자료 확보·검수 담당, 운영·백업 정책

## 공통 표기 기준

| 표기 | 의미 |
|---|---|
| 내부 / 우리 시스템 | Spotlog 화면·서버·DB·서비스 소유 사진 영역 |
| 자체 운영 Flowise | 맥미니의 AI 호출·도구 연결 소프트웨어. 간단 생성부터 활용, 챗봇 UI·AI 모델과 구분 |
| 외부 Jev | 고정 항목 분류의 선택 비교 후보. 기본 경로에 필수 아님. 한국어·전체 응답 시간 시험 전 |
| 로컬 소형 언어 모델 | 기본 조건 해석·일정 설명. 맥미니 Qwen3.5 9B/4B 비교 평가, 설치·성능 확인 후 확정 |
| 예외 외부 대형 LLM | 충분한 근거가 있는 모델 실패만 부분 보완. 통과한 일정 유지·동일 서버 재검증. 제공자·모델 미정 |
| 로컬 임베딩 AI | 설명·질문을 검색용 숫자로 변환. 맥미니 Qwen3 Embedding 0.6B 첫 평가 후보, 연결 예정 |
| 외부 네이버 Maps | 지도 표시·주소·지원 자동차 경로 조회 |
| 외부 네이버 업체 검색 | API HUB 지역 검색. Maps와 별도 서비스 |
| API | 호출·연결 방식. 구성품 단독 이름 대신 대상·역할·내외부 구분 함께 표기 |
| 현재 / 예정 / 결정 필요 | 시제품·기존 도구와 신규 서비스 연결·운영 합의 구분 |

## 구현 상태와 설계 범위

- 기존 자산: React 웹·Expo WebView 시제품, 맥미니 Flowise와 외부 모델 연결
- 신규 구축·연결: 서비스 서버·실제 회원 인증·장소/여행 DB·RAG·관리자·네이버·사진 저장소
- 데이터 관계도: 서버 신규 구축용 핵심 관계 제안. 확정 DDL 아님. 현재 로컬 Journey의 PLAN/JOURNAL 구분과 신규 서버 엔터티 분리는 구분
- 조회·초안 생성과 확정 저장 분리. 고객 요청에 맞춘 식사·숙박 배치, 예약·고정 장소 보존
- 내 여행은 비공개 일정. 여행기는 별도 작성·공개·삭제 상태
- 휴지통: 한국 시각 달력 6개월. 서버 만료 판정·정리 작업은 연결 예정. 장애 복구용 백업과 별도
- 현재 웹 배포: codex/mobile-foundation push 및 수동 워크플로 실행. 코드 백업은 배포 대상 아닌 별도 브랜치
- 공개 전 고객 승인: 운영 절차. GitHub 승인 강제 게이트 구축 완료 표시 아님
- 앱 스토어 공개·서버 운영·복구 목표는 별도 준비·검증 단계

## 검수 기록

- 11장 모두 실제 FigJam 이미지 확인
- 화면 전환·AI 처리·권한·배포 흐름의 반복 연결을 복귀 설명으로 정리하여 시작부터 결과까지 읽는 순서 유지
- 기존 네 장의 임베딩·AI·서버 참가자 명칭 보완, 전체 구성도 00번과 기존 배치 유지
- 새 문서마다 담당 영역·현재/예정·판단 기준 포함
- 검수 이미지: artifacts/system-diagram-set-20260921/00.png ~ 10.png
- 간단 생성 우선 개정: 00~04·07·08 및 02 안내 검수 · 향후 챗봇 분기 표시
- 개정 검수 이미지: artifacts/ai-simple-first-20260921/
- 소형 기본·대형 부분 보완 개정: 00·01·02·03·07·08. 최신 검수 이미지: artifacts/ai-model-cascade-20260921/
- 기존 제품 코드·맥미니 설정·외부 API 연결 변경 없음. Git 커밋·푸시·공개 배포 없음
