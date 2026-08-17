# Spotlog Mobile

Spotlog는 숏폼의 한 장면에서 장소를 발견하고, 마음에 든 장소를 담아 나만의 여행 가이드로 만드는 모바일 우선 서비스입니다.

## 현재 기반

- Android / iOS 전용 Expo + React Native + TypeScript
- 세로형 장소 발견 피드
- 장소 담기와 기기 내부 저장
- 담은 장소 우선 추천 일정 초안
- 날짜별 일정과 지도 동선 미리보기
- 내 여행과 독립 프로필 화면

현재 추천 일정은 로컬 Mock 규칙으로 생성됩니다. 실제 AI, 지도 경로, 회원 서버, 영상 업로드·스트리밍은 연결하지 않았습니다.

## 실행

```bash
npm install
npm run android
# 또는 macOS에서
npm run ios
```

타입 검사는 `npm run typecheck`로 실행합니다.

## 프로젝트 원칙

- HotelNGo와 회원·저장소·런타임을 공유하지 않습니다.
- PMS 또는 HotelNGo를 직접 참조하지 않습니다.
- 가격·재고·예약·정산은 Spotlog 1차 범위가 아닙니다.
- 향후 예약이 필요한 장소만 독립 API 어댑터로 HotelNGo에 연결합니다.
- 모바일 경험을 먼저 완성한 뒤 웹은 별도 앱으로 설계합니다.
