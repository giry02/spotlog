import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '모아 — 대화에서 기능으로',
  description:
    'Spotlog 여행 챗봇 체험. 장소 찾기와 찜에서 식당·숙소·DAY별 일정까지, 질문과 선택에 따라 기능이 이어집니다. 샘플 데이터와 규칙으로 작동합니다.',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#f8f8f6',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
