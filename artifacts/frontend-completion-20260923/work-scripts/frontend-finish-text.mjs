import fs from 'node:fs';
function update(file,replacements){let source=fs.readFileSync(file,'utf8');for(const [before,after] of replacements){if(!source.includes(before))throw Error(`Missing ${file}: ${before}`);source=source.replaceAll(before,after);}fs.writeFileSync(file,source);}
update('web/src/RouteMap.tsx',[
 ['places={mappablePlaces} coordinates=', 'places={mappablePlaces} numbers={markerNumbers} coordinates='],
 ['{schedule.text}',"{en?`${Math.abs(schedule.margin)} min ${schedule.margin<0?'short':'spare'} · arrival ${schedule.arrival}`:schedule.text}"],
 ['`추정 ${leg.minutes}분`',"en?`Est. ${leg.minutes} min`:`추정 ${leg.minutes}분`"],
 ['`추정 계산상 ${conflictCount}개 구간의 시간이 부족합니다.`',"en?`${conflictCount} estimated connections need more time.`:`추정 계산상 ${conflictCount}개 구간의 시간이 부족합니다.`"],
 ['`추정 계산상 ${scheduleChecks.length}개 구간에 여유가 있습니다. 실제 이동은 확인이 필요합니다.`',"en?`${scheduleChecks.length} connections have estimated spare time. Check actual travel conditions.`:`추정 계산상 ${scheduleChecks.length}개 구간에 여유가 있습니다. 실제 이동은 확인이 필요합니다.`"],
 ["!routeLoading&&mappablePlaces.length>1&&routeResult.source==='ESTIMATE'", "!routeLoading&&(!naverClientId||routeEndpoint)&&mappablePlaces.length>1&&routeResult.source==='ESTIMATE'"],
 ["routeResult.source === 'ROAD' ?", "naverClientId&&!routeEndpoint?(en?'Places are linked in visit order. Driving routes and travel times are not verified.':'방문 순서를 직선으로 연결했어요. 도로 경로와 이동 시간은 확인 전이에요.'):routeResult.source === 'ROAD' ?"],
]);
update('web/src/AiPlannerSheet.tsx',[
 ['  const selectedJourney=useMemo(', '  const selectedJourney=useMemo('],
 ['      <Button size="compact" variant="secondary" className="ai-planner-edit-toggle"', '      {selectedJourney?.days.some(d=>d.planningGaps?.some(g=>g.reason===\'missing-data\'))&&<p className="frontend-partial-note" role="status">{locale===\'en\'?\'Some requested places have no matching registered candidates. Those stops are marked in the route. Save this draft and add them later.\':\'일부 요청은 맞는 등록 장소가 없어 일정에 빈자리로 표시했어요. 지금 초안을 저장하고 상세에서 채울 수 있어요.\'}</p>}\n      <Button size="compact" variant="secondary" className="ai-planner-edit-toggle"'],
 ['{error&&<p className="ui-error" role="alert">{error}</p>}', '{error&&<p className="ui-error" role="alert">{say(error)}</p>}'],
]);
update('web/src/NearbyBusinessSheet.tsx',[
 ['`직선 ${Math.round(distance * 1000)}m`','`${copy("직선")} ${Math.round(distance * 1000)}m`'],
 ['`직선 ${distance.toFixed(1)}km`','`${copy("직선")} ${distance.toFixed(1)}km`'],
 ['`${anchor.name} 주변`','`${anchor.name} · ${copy("주변 업체")}`'],
 ['`${place.name} 상세`','`${place.name} · ${copy("상세 보기")}`'],
 [' · ${anchor.name}에서 이어지는 일정',' · ${anchor.name}'],
 ["{query && ' · 지역 내 검색'}",'{query && ` · ${copy("지역 내 검색")}`}'],
]);
const dict=JSON.parse(fs.readFileSync('web/src/frontend-copy.en.json','utf8'));
Object.assign(dict,{'직선':'Straight line','주변 업체':'Nearby places','상세 보기':'Details','지역 내 검색':'Search in this region'});
fs.writeFileSync('web/src/frontend-copy.en.json',JSON.stringify(dict,null,2));
