
(() => {
 const root=document.documentElement, slides=[...document.querySelectorAll('.slide')];
 const count=document.getElementById('counter'), prev=document.getElementById('prev'), next=document.getElementById('next'), all=document.getElementById('all');
 const toc=document.getElementById('toc-dialog'), imageDialog=document.getElementById('image-dialog');
 let index=Math.max(0,slides.findIndex(s=>s.id===location.hash.slice(1))), allMode=new URLSearchParams(location.search).get('view')==='all', returnFocus=null;
 document.querySelectorAll('table').forEach(t=>{const heads=[...t.querySelectorAll('th')].map(h=>h.textContent);t.querySelectorAll('tbody tr').forEach(r=>[...r.children].forEach((td,i)=>td.dataset.column=heads[i]||''));});
 function render(focus=false){root.classList.toggle('all-view',allMode);slides.forEach((s,i)=>s.classList.toggle('active',i===index));count.textContent=`${String(index+1).padStart(2,'0')} / ${slides.length}`;prev.disabled=index===0;next.disabled=index===slides.length-1;all.textContent=allMode?'페이지 보기':'전체 보기';all.setAttribute('aria-pressed',String(allMode));document.getElementById('progress').style.width=`${(index+1)/slides.length*100}%`;document.querySelectorAll('.toc-link').forEach(a=>{if(a.hash==='#'+slides[index].id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.getElementById('live').textContent=`${index+1}페이지. ${slides[index].dataset.label}`;if(focus)slides[index].querySelector('h2').focus({preventScroll:true});}
 function go(i,focus=false){index=Math.max(0,Math.min(slides.length-1,i));history.replaceState(null,'','#'+slides[index].id);render(focus);if(allMode)slides[index].scrollIntoView({block:'start'});else window.scrollTo({top:0,behavior:'instant'});}
 root.classList.add('enhanced');render();prev.addEventListener('click',()=>go(index-1,true));next.addEventListener('click',()=>go(index+1,true));
 all.addEventListener('click',()=>{allMode=!allMode;render();if(allMode)slides[index].scrollIntoView({block:'start'});else window.scrollTo({top:0,behavior:'instant'});});
 document.getElementById('print').addEventListener('click',()=>window.print());
 document.getElementById('toc').addEventListener('click',()=>toc.showModal());
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
 document.querySelectorAll('.toc-link').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();toc.close();go(slides.findIndex(s=>s.id===a.hash.slice(1)),true);}));
 document.querySelectorAll('.zoom').forEach(b=>b.addEventListener('click',()=>{returnFocus=b;const img=b.querySelector('img');document.getElementById('large-image').src=img.src;document.getElementById('large-image').alt=img.alt;document.getElementById('image-title').textContent=img.alt;imageDialog.showModal();}));
 imageDialog.addEventListener('close',()=>{document.getElementById('large-image').removeAttribute('src');returnFocus?.focus({preventScroll:true});});
 window.addEventListener('hashchange',()=>{const i=slides.findIndex(s=>s.id===location.hash.slice(1));if(i>=0){index=i;render();}});
 document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(index+1,true);}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(index-1,true);}if(e.key==='Home'){e.preventDefault();go(0,true);}if(e.key==='End'){e.preventDefault();go(slides.length-1,true);}});
})();
