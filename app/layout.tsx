import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '모아 — 대화에서 기능으로',
  description:
    '비슷한 장소부터 주변 맛집·도보 지도까지, 모니터 추천부터 조건·스펙 비교까지 이어지는 기능 유닛 체험. 샘플 데이터와 규칙으로 작동합니다.',
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
