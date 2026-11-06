
(()=>{
const buttons=[...document.querySelectorAll('[data-screen]')];
buttons.forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.screen;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.screen-panel').forEach(p=>p.hidden=p.id!==`screen-${key}`);}));
const examples={
decision:`<h3>현재 확정과 새 제안을 구분</h3><div class="decision"><div><small>현재 저장된 약속</small><strong>오후 2시</strong></div><div><small>대화에서 나온 변경안</small><strong>오후 3시</strong></div></div><p>서연·현우는 3시 가능이라고 답했습니다. 민지의 시간 응답은 아직 없습니다. 준서는 투표를 올리겠다고 했습니다.</p><p><strong>아직 바뀐 일정이 아닙니다.</strong> 주최자의 변경 확정과 참석자 확인이 필요합니다.</p><p><a href="#m4">시간 변경 제안 원문</a> · <a href="#m9">투표 제안 원문</a></p>`,
conditions:`<h3>장소를 고르기 전 남은 조건</h3><ul><li><strong>시간:</strong> 오후 3시 후보. 일부 가능 응답, 전체 확정 아님.</li><li><strong>걷기:</strong> 카페까지 도보 10분 안쪽 희망. 경로 확인 전 충족 여부 미정.</li><li><strong>예산:</strong> 1인 2만원 아래 희망. 메뉴 정보 확인 필요.</li><li><strong>후보:</strong> 민지가 A/B카페 공유 의향을 밝힘. 실제 공유 자료를 선택한 뒤 비교.</li><li><strong>미확인:</strong> B카페 운영 시간.</li></ul><p>AI가 없는 업체·가격·이동 시간을 만들어 채우지 않습니다.</p><p><a href="#m3">걷기 조건</a> · <a href="#m6">예산 조건</a> · <a href="#m11">운영 정보 질문</a></p>`,
tasks:`<h3>대화에서 준비 탭으로 제안</h3><ul><li><strong>모임 사진 촬영:</strong> 현우가 자원. 항목 등록 여부 확인.</li><li><strong>우산:</strong> 각자 준비인지 질문 상태. 확정 준비물로 취급하지 않음.</li><li><strong>B카페 운영 시간:</strong> 미확인. 확인할 일로 등록할지 선택.</li><li><strong>시간 투표:</strong> 준서가 올릴 예정. 투표가 생성·발송됐다는 뜻은 아님.</li></ul><p>실제 준비 항목 등록과 담당 수락은 사용자 조작으로 확정합니다.</p><p><a href="#m7">우산 질문</a> · <a href="#m8">사진 자원</a> · <a href="#m12">미확인 답변</a></p>`,
person:`<h3>민지가 이번 약속에서 말한 것</h3><ul><li>카페까지 도보 10분 안쪽을 희망했습니다.</li><li>우산을 각자 가져오는지 질문했습니다.</li><li>A카페·B카페를 이번 약속에 공유하겠다고 했습니다.</li></ul><p>이 대화만으로 민지의 3시 참석, 건강 상태, 전체 취향을 추정하지 않습니다.</p><p><a href="#m3">걷기 요청</a> · <a href="#m7">준비 질문</a> · <a href="#m10">장소 공유 의향</a></p>`};
const output=document.getElementById('ai-output');output.innerHTML=examples.decision;
document.querySelectorAll('[data-ai]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-ai]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));output.innerHTML=examples[button.dataset.ai];}));
document.getElementById('print-report').addEventListener('click',()=>window.print());
})();
