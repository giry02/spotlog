/* Static, local-only report viewer. This does not call service or AI APIs. */
(() => {
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list = (items) => `<ul class="list">${items.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  const table = (headers,rows,cls='') => `<div class="table-wrap ${cls}"><table><thead><tr>${headers.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((x,i)=>i?`<td>${x}</td>`:`<th scope="row">${x}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const panel = (title,items,cls='')=>`<section class="panel ${cls}"><h3>${title}</h3>${Array.isArray(items)?list(items):items}</section>`;
  const columns = (...parts)=>`<div class="columns ${parts.length===3?'three':''}">${parts.join('')}</div>`;
  const note = (text)=>`<p class="note">${text}</p>`;
  const callout = (text)=>`<div class="callout">${text}</div>`;
  const steps = (items)=>`<ol class="steps">${items.map(([a,b])=>`<li><strong>${a}</strong><span>${b}</span></li>`).join('')}</ol>`;
  const flow = (items)=>`<div class="flow">${items.map(([a,b],i)=>`<div><small>STEP ${i+1}</small><strong>${a}</strong><p>${b}</p></div>`).join('')}</div>`;
  window.Report = {list,table,panel,columns,note,callout,steps,flow,esc, mount};

  function mount({title,shortTitle,otherTitle,otherHref,slides}) {
    const root=document.getElementById('report');
    const toc=slides.map((s,i)=>`<a href="#slide-${i+1}"><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title.replace(/<br\s*\/?>/g,' '))}</a>`).join('');
    root.innerHTML=`<div class="shell"><header class="toolbar"><span class="brand">SPOTLOG · INTERNAL REPORT</span><span class="toolbar-title">${esc(shortTitle)} / 2026.09.08</span><nav aria-label="문서 메뉴"><a href="${otherHref}">${esc(otherTitle)}</a><a class="service-link" href="./#home">서비스 화면</a><button type="button" data-print>인쇄·PDF</button></nav></header><main class="stage" id="stage" aria-label="${esc(title)}">${slides.map((s,i)=>`<article class="slide ${s.cover?'cover':''}" id="slide-${i+1}" data-title="${esc(s.title.replace(/<br\s*\/?>/g,' '))}" aria-labelledby="heading-${i+1}" tabindex="-1"><header class="slide-header"><p class="eyebrow">${esc(s.section||shortTitle)}</p>${s.cover?`<h1 id="heading-${i+1}">${s.title}</h1>`:`<h2 id="heading-${i+1}">${s.title}</h2>`}${s.lead?`<p class="lead">${s.lead}</p>`:''}</header><div class="slide-content">${s.html}</div><footer class="slide-footer"><div class="sources">${s.sources?.length?s.sources.map(([name,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`).join(''):'Spotlog 개발 계획 · 제안 사항과 현재 구현 상태를 구분함'}</div><span class="folio">${String(i+1).padStart(2,'0')} / ${slides.length}</span></footer></article>`).join('')}</main><footer class="controls"><div class="control-start"><button type="button" data-toc>목차</button><button type="button" class="all-button" data-all aria-pressed="false">전체 보기</button></div><div class="page-label" aria-live="polite" aria-atomic="true"><b data-current>01</b> / ${slides.length}</div><div class="progress" aria-hidden="true"><span></span></div><div class="control-end"><small>← → 방향키</small><button type="button" data-prev aria-label="이전 페이지">←</button><button type="button" data-next aria-label="다음 페이지">→</button></div></footer></div><dialog class="contents-dialog" aria-labelledby="toc-title"><header><h2 id="toc-title">${esc(shortTitle)} 목차</h2><button type="button" data-close>닫기</button></header><nav class="contents-list" aria-label="전체 페이지">${toc}</nav></dialog>`;
    document.title=title;
    const pages=[...root.querySelectorAll('.slide')], stage=root.querySelector('.stage'), dialog=root.querySelector('dialog');
    let index=0, all=false;
    const fromHash=()=>/^#slide-\d+$/.test(location.hash)?Number(location.hash.slice(7))-1:0;
    function show(next,{hash=true,focus=false}={}){
      index=Math.max(0,Math.min(pages.length-1,Number.isFinite(next)?next:0));
      pages.forEach((p,i)=>{p.classList.toggle('active',i===index);p.setAttribute('aria-hidden',String(!all&&i!==index));});
      root.querySelector('[data-current]').textContent=String(index+1).padStart(2,'0');
      root.querySelector('.progress span').style.width=`${(index+1)/pages.length*100}%`;
      root.querySelector('[data-prev]').disabled=index===0;
      root.querySelector('[data-next]').disabled=index===pages.length-1;
      document.title=`${pages[index].dataset.title} | ${shortTitle}`;
      if(hash)history.replaceState(null,'',`#slide-${index+1}`);
      if(all)pages[index].scrollIntoView({block:'start'});else stage.scrollTop=0;
      if(focus)pages[index].focus({preventScroll:true});
    }
    root.querySelector('[data-prev]').onclick=()=>show(index-1,{focus:true});
    root.querySelector('[data-next]').onclick=()=>show(index+1,{focus:true});
    root.querySelector('[data-print]').onclick=()=>window.print();
    root.querySelector('[data-toc]').onclick=()=>dialog.showModal();
    root.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    root.querySelector('[data-all]').onclick=(e)=>{all=!all;document.body.classList.toggle('all-view',all);e.currentTarget.setAttribute('aria-pressed',String(all));e.currentTarget.textContent=all?'발표 보기':'전체 보기';show(index);};
    root.addEventListener('click',e=>{const a=e.target.closest('a[href^="#slide-"]');if(!a)return;e.preventDefault();if(dialog.open)dialog.close();show(Number(a.hash.slice(7))-1,{focus:true});});
    window.addEventListener('hashchange',()=>show(fromHash(),{hash:false}));
    window.addEventListener('keydown',e=>{if(dialog.open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();show(index+1,{focus:true});}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(index-1,{focus:true});}if(e.key==='Home'){e.preventDefault();show(0,{focus:true});}if(e.key==='End'){e.preventDefault();show(pages.length-1,{focus:true});}});
    let start=null;
    stage.addEventListener('touchstart',e=>{start=e.touches.length===1&&!e.target.closest('a,button,input,select,textarea,.table-wrap')?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
    stage.addEventListener('touchend',e=>{if(!start||all)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*2)show(index+(dx<0?1:-1));},{passive:true});
    window.addEventListener('beforeprint',()=>pages.forEach(p=>p.setAttribute('aria-hidden','false')));
    window.addEventListener('afterprint',()=>pages.forEach((p,i)=>p.setAttribute('aria-hidden',String(!all&&i!==index))));
    setupCost(root);
    show(fromHash(),{hash:false});
    document.documentElement.dataset.reportReady='true';
  }
  function setupCost(root){
    const form=root.querySelector('[data-cost-form]');if(!form)return;
    const n=(key)=>{const el=form.elements.namedItem(key);if(!el||el.value.trim()==='')return null;const v=Number(el.value);return Number.isFinite(v)&&v>=0?v:null;};
    const fmt=(x)=>x.toLocaleString('ko-KR',{maximumFractionDigits:2});
    const update=()=>{
      const g=n('generations'), q=n('questions'), r=n('routeRequests'), t=n('translationChars');
      const usage=[g,q,r,t].every(x=>x!==null);
      const units=[n('generationCost'),n('questionCost'),n('routeCost'),n('translationCost'),n('storageCost')];
      const ready=usage&&units.every(x=>x!==null);
      form.querySelector('[data-cost-usage]').textContent=usage?`월 일정 ${fmt(g)}건 / 질문 ${fmt(q)}건 / 경로 요청 ${fmt(r)}건 / 번역 ${fmt(t)}자`:'사용량을 0 이상의 숫자로 입력해야 함';
      form.querySelector('[data-cost-total]').textContent=ready?`${fmt(g*units[0]+q*units[1]+r*units[2]+t/1000000*units[3]+units[4])} 원`:'단가 확인 필요';
      form.querySelector('[data-cost-status]').textContent=ready?'입력한 단가 기준 월 예상액임. 세금·환율·최소 계약금·초과 사용료는 별도 확인 필요함.':'빈 단가는 무료가 아님. 같은 원화 기준의 검증된 단가를 모두 입력해야 합계를 계산함.';
    };form.addEventListener('input',update);form.addEventListener('submit',e=>e.preventDefault());update();
  }
})();
