import { registeredEntities } from './registered-catalog';

/** Original Spotlog editorial summaries plus registered public basic facts.
 * No provider search results, customer records, photos, reviews or live claims
 * are sent to the model. Indexing and current-source validation share this text.
 */
export const registeredKnowledgeDocuments = registeredEntities.map((item) => ({
  id: `registered-${item.id}`,
  placeId: item.id,
  title: `${item.name} | Spotlog 등록 공식 기본정보`,
  region: item.region,
  text: `${item.name}\n지역: ${item.region}\n등록 분류: ${item.kind}\n주소: ${item.address}\n공식 대표 위치(출입구 미검증): ${item.latitude}, ${item.longitude}\nSpotlog 작성 안내: ${item.description}\n등록 특징: ${item.tags.join(', ')}\n${item.note}\n현재 영업시간·메뉴 가격·객실 요금·빈방·재고·평점·인기도는 제공되지 않습니다.\n기본정보 출처: ${item.source.provider}\n공식 자료 확인일: ${item.source.checkedAt}`,
  sourceUrl: item.source.sourceUrl,
  checkedAt: item.source.checkedAt,
}));
