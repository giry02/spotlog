import { registeredBusinessFactQueryIds } from './rag-catalog';

export const REGISTERED_BUSINESS_FACT_HINT = '이번 질문은 정식 등록 업체의 기본정보 조회다. 검색 자료에 있는 이름·주소·분류·작성 안내만 사실로 설명한다. 현재 등록 자료에는 인기도·인기 순위·평점·별점·방문객 수가 제공되지 않는다. “관광객들에게 인기가 있습니다”, “인기도 1등”, “별점 4.8점”처럼 확인하지 않은 인기·평판 수치를 덧붙이지 않는다. 해당 정보가 질문에 필요하면 미확인이라고 말한다. 현재 영업·메뉴 가격·객실 요금·예약 가능 여부도 확인된 사실로 만들지 않는다.';

/** A bounded claim check for this catalog's explicitly unavailable reputation
 * facts. This never edits a completion: the existing model validation/fallback
 * chain must produce a valid reply instead. It is not a general truth checker. */
export function hasUnsupportedRegisteredBusinessReputation(query: string, message: string) {
  if (!registeredBusinessFactQueryIds(query).length) return false;
  const clauses = message.normalize('NFKC').split(/\n|[;；,，]|[.!?。！？](?:\s+|$)|하지만|그렇지만|그러나|다만|지만/u);
  const claim = /인기\s*(?:도|순위)?(?:가|는|이|을|를)?\s*(?:많|높|있|좋|끌|얻|누리)|인기\s*(?:맛집|식당|카페|숙소|호텔|업체|명소)|(?:관광객|여행객|여행자|방문객|현지인)(?:들)?(?:에게|들이|이|가|에게서)?\s*(?:많이\s*찾|즐겨\s*찾|사랑받)|(?:인기\s*(?:도|순위)?|평점|별점|리뷰\s*점수)\s*(?:은|는|이|가|[:：])?\s*\d+(?:\.\d+)?\s*(?:점|등|위)?/gu;
  const uncertainty = /미확인|확인(?:하지\s*(?:못|않)|되지\s*않|할\s*수\s*없)|알\s*수\s*없|단정할\s*수\s*없|근거(?:가|는|를)?\s*없|자료(?:가|는)?\s*없|제공(?:되지|하지)\s*않|(?:높|많|있)지(?:는)?\s*않/u;
  const affirmative = /인기(?:가|는|도)?\s*(?:많|높|있)(?:습니다|어요|아요|다|죠|네요)(?:[.!?。！？\s]|$)|(?:인기\s*(?:도|순위)?|평점|별점|리뷰\s*점수)\s*(?:은|는|이|가|[:：])?\s*\d+(?:\.\d+)?\s*(?:점|등|위)?\s*(?:입니다|이에요|예요|이다)(?:[.!?。！？\s]|$)/u;
  for (const clause of clauses) for (const match of clause.matchAll(claim)) {
    // An earlier disclaimer cannot excuse a later positive claim. Uncertainty
    // belongs to this claim's own remaining phrase, not the whole response.
    const phrase = clause.slice(match.index);
    if (!uncertainty.test(phrase) || affirmative.test(phrase)) return true;
  }
  return false;
}
