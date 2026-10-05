# 전체 로컬 작업 GitHub 백업

2026-10-05 · 사용자 ‘지금 로컬꺼 다 업로드해 깃에’ 승인. 작업본 `C:/Users/Giry/Documents/Spotlog`의 통합 내용을 GitHub 전체 백업으로 보존.

- 저장소: [giry02/spotlog](https://github.com/giry02/spotlog)
- 백업 브랜치: [codex/full-local-backup-20261005](https://github.com/giry02/spotlog/tree/codex/full-local-backup-20261005)
- 기준 이력: 기존1차 백업 `a123166`에서 현재 전체 작업을 추가한 스냅샷. 과거 커밋과 별도 주차 브랜치는 유지.

## 포함한 내용

| 범위 | 주요 내용 |
|---|---|
| 통합 웹 소스 | 1차 발견·저장·사진 넘김·간편 생성, 2차 개인 일정·주변 업체·댓글, 4주차/3차 AI 샘플·계정/지도/영어 연결 준비 |
| 최신 수정 | 여행기 전체 언어 선택, 다지역 자동 생성 범위, 안내/기능 글씨, 개인 일정 표지/DAY/도구, 종류 배지·다음 방문 완료·알림 정리 |
| 앱 셸·자료 | Expo 하이브리드 셸의 로컬 수정, 현재 사진·장소/업체 카탈로그·출처 자료 |
| 계약·설계 | DTO/API 연결 가이드, AI/RAG·소형 모델·Flowise·네이버 연결 방향, 고객 여정/시스템 구성도 기록·일정표 HTML |
| 검수·복구 | 기존 테스트·독립 검수 화면·실행 스크립트·캡처·전후 원본·보고서 |

전체 소스와 설계 자료의 백업이며 모든 기능이 실서비스에 연결된 상태를 뜻하지 않음. 실제 AI/RAG 서버, 네이버 지도/업체 검색·경로 응답, 계정 서버와 실제 폰 검수는 기존 문서의 준비 상태를 따름.

Git에서 이미 제외된 `node_modules`, `dist`, Expo 캐시·생성 네이티브 폴더, 로컬 환경 설정/인증 파일은 업로드하지 않음. `web/.env.example`은 값이 빈 연결 설정 예시로 포함. 브라우저에 저장된 개인 여행/찜/계정 상태는 소스 파일이 아니므로 Git 백업에 포함되지 않음.

## 공개·단계별 기록

| 기록 | 이번 백업에서 유지할 값 |
|---|---|
| 공개 배포 `codex/mobile-foundation` | `922d17e87dfbb5c7cd714ea91b3125c3927615ad` |
| 2주차 `codex/release-week2-20260929` | `2ac18722ce5da2ce36be44b9fa6a08828144514f` |
| 3주차 `codex/release-week3-20261006` | `511e0013bc84c42877dbd903064650fce0b0fde9` |
| 영어 패치 `codex/review-page-language-20261002` | `8bac32fdf5d85b13c251b445b99e9f782c8971ff` |

현재 Pages 워크플로의 push 대상은 `codex/mobile-foundation` 한 개. 이번에는 전체 백업 브랜치만 업로드하고 수동 배포를 실행하지 않음. 실제 소스 구현 대화창의 별도 작업본에도 전송하지 않음. 과거 문서의 ‘Git 미반영’은 해당 시점의 이력이며 이번 전체 백업과 함께 읽을 것.

## 확인

- `npm run web:build`: 통과. 웹 TypeScript 검사 포함. 기존 큰 번들 경고 유지.
- `npm run typecheck`: Expo 앱 셸 타입 검사 통과.
- `node --test web/tests/*.test.mjs web/tests/typography.test.cjs`: 자동 검사266개 통과.
- 새 비밀키 파일이나 일반 제공자 토큰이 업로드 목록에 들어가는지 확인. 값이 빈 환경 설정 예시만 포함.

화면 검수는 [10/02 수정·114개 상태 확인](PRODUCT_UX_FIXES_20261002.md), [전체 영어 보기 검수 자료](../../artifacts/content-language-20261002/), [방문/교체/경고 사용 흐름](TRIP_USABILITY_REVIEW_20260930.md) 참고. 이번 업로드에서 제품 화면을 새로 변경하지 않음.

## 다른 컴퓨터에서 이어가기

새 폴더에 백업 브랜치를 받으면 기존 작업본을 덮어쓰지 않고 복구 가능.

```bash
git clone --branch codex/full-local-backup-20261005 https://github.com/giry02/spotlog.git Spotlog-local-backup
cd Spotlog-local-backup
npm ci
npm run web
```

기본 로컬 주소는 터미널에 표시되는 Vite 주소. 서버 연결 설정이 필요할 때만 `web/.env.example`을 참고해 별도 로컬 설정 작성. 배포 브랜치나 다른 작업본을 강제로 되돌리는 방식은 사용하지 않음.
