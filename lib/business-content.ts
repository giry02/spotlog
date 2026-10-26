import jejuContent from './jeju-business-content';

export type BusinessContent = {
  menus: readonly { name: string; price: number | null; note: string }[];
  rooms?: readonly { name: string; note: string }[];
  facilities: readonly string[];
  hours?: string;
  checkIn?: string;
  priceNote: string;
  checkedAt: string;
  sources: readonly { url: string; title: string; scope: string }[];
};

// Display-only source snapshots. Published menu prices never become verified
// trip-budget prices or evidence of today's opening/booking availability.
const contentById = new Map<string, BusinessContent>(jejuContent.entries.map(entry => [
  entry.id, { ...entry, checkedAt: jejuContent.checkedAt },
]));
export function getBusinessContent(id: string): BusinessContent | null {
  return contentById.get(id) ?? null;
}

const illustrations: Record<string, { image: string; alt: string }> = {
  'catalog-jeju-hyeopjae-sin-guksu': { image: '/images/business-templates/noodle-menu.jpg', alt: '고기국수의 AI 생성 예시 이미지 · 실제 업체 음식 사진 아님' },
  'catalog-jeju-myeongri-main': { image: '/images/business-templates/pork-grill.jpg', alt: '돼지고기 구이의 AI 생성 예시 이미지 · 실제 업체 음식 사진 아님' },
  'catalog-jeju-bongseong': { image: '/images/business-templates/pork-grill.jpg', alt: '돼지고기 구이의 AI 생성 예시 이미지 · 실제 업체 음식 사진 아님' },
  'catalog-jeju-paratodos': { image: '/images/business-templates/coastal-brunch.jpg', alt: '브런치와 커피의 AI 생성 예시 이미지 · 실제 업체 음식 사진 아님' },
  'catalog-jeju-coffee-sketch': { image: '/images/business-templates/coffee-dessert.jpg', alt: '커피와 디저트의 AI 생성 예시 이미지 · 실제 업체 음식 사진 아님' },
};
export function getBusinessIllustration(id: string, kind: string) {
  return illustrations[id] ?? (kind === 'STAY'
    ? { image: '/images/demo-stay.jpg', alt: '객실 유형 예시 이미지 · 실제 업체 사진 아님' }
    : kind === 'CAFE'
      ? { image: '/images/demo-cafe.jpg', alt: '카페 유형 예시 이미지 · 실제 업체 사진 아님' }
      : { image: '/images/demo-restaurant.jpg', alt: '공간 유형 예시 이미지 · 실제 업체 사진 아님' });
}
