const page=await figma.getNodeByIdAsync("0:1"); await figma.setCurrentPageAsync(page);
const d=await figma.getNodeByIdAsync("112:2005"); d.resizeWithoutConstraints(d.width,380);
const note=await figma.getNodeByIdAsync("112:2028"); note.y=312;
const updates={
"112:2028":"실서비스: 인증 고객·운영자 → 서비스 API → PostgreSQL / 공개 검수·관리자 기본 조회는 개인 원문 제외",
"65:1450":"소형 LLM = 해석·설명  |  서버 = 검색·계산·검증  |  운영 추천 자동 초안 = LOCAL_RULES  |  챗봇 = 향후"
};
for(const [id,value] of Object.entries(updates)){const n=await figma.getNodeByIdAsync(id);for(const s of n.getStyledTextSegments(["fontName"]))await figma.loadFontAsync(s.fontName);n.characters=value;}
const n=await figma.getNodeByIdAsync("112:1881");
return {mutated:Object.keys(updates),admin:n.id,title:(await figma.getNodeByIdAsync("112:1882")).characters,noteBounds:(await figma.getNodeByIdAsync("112:2028")).absoluteBoundingBox};

