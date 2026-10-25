type Business = { id: string; name: string; kind: 'food' | 'cafe' | 'shop' | 'stay' };

/** Bind collection authority to each commanded clause; excluding other categories is not a global veto. */
export function requestedBusinessCollectionIds(input: string, businesses: Business[]): string[] {
  const text=input.normalize('NFKC').replace(/\s+/g,'');
  if (/방법|어떻게|설명|(?:담아|추가해).{0,8}(?:돼|가능|되나)/.test(text)) return [];
  const command=/담아(?:줘|주세요|둘래|둘게)|담을래|담을게|(?:여행|후보)에담기|추가해(?:줘|주세요)|담(?:아(?:주|두|놓)?)?지(?:는)?(?:마(?:세요)?|말(?:아(?:줘|주세요))?|않(?:아|을래)?)|추가(?:해주|해두|해|하)?지(?:는)?(?:마|말|않)|말고|대신(?:에)?|빼(?:줘|고|주세요)|제외(?:하고|해줘|해주세요|한)/g;
  const requested=new Map<string,number>();
  let cursor=0;
  for(const match of text.matchAll(command)) {
    const wholeScope=text.slice(cursor,match.index),boundary=Math.max(wholeScope.lastIndexOf('.'),wholeScope.lastIndexOf('!'),wholeScope.lastIndexOf('?'),wholeScope.lastIndexOf(';'));
    const scope=wholeScope.slice(boundary+1),offset=cursor+boundary+1;
    const named=businesses.filter(item=>scope.includes(item.name.replace(/\s+/g,'')));
    const negative=/지(?:는)?(?:마|말|않)|말고|대신|빼|제외/.test(match[0]);
    if(!negative) for(const item of named) requested.set(item.id,offset+scope.indexOf(item.name.replace(/\s+/g,'')));
    else if(named.length) for(const item of named) requested.delete(item.id);
    else if(!/다른|나머지|그밖|추가/.test(scope)) {
      const categories: Business['kind'][]=[];
      if(/식당|식사|음식점/.test(scope)) categories.push('food');
      if(/카페/.test(scope)) categories.push('cafe');
      if(/상점|쇼핑|시장/.test(scope)) categories.push('shop');
      if(/숙소|숙박|호텔/.test(scope)) categories.push('stay');
      if(categories.length) for(const item of businesses) {if(categories.includes(item.kind)) requested.delete(item.id);}
      else if(!/관광지|장소|일정|예약|결제/.test(scope)) requested.clear();
    }
    cursor=match.index+match[0].length;
  }
  return [...requested].sort((a,b)=>a[1]-b[1]).map(([id])=>id);
}
