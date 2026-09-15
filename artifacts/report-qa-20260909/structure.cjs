const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const root='web/public/';
function read(p){return fs.readFileSync(root+p,'utf8');}
function render(files, sources){
  let result;
  const context=vm.createContext({window:{}});
  vm.runInContext(read('reports/report.js'),context);
  context.Report=context.window.Report;
  context.Report.mount=(data)=>{result=data;};
  for(const [i,file] of files.entries()){
    vm.runInContext(sources?sources[i]:read(file),context,{filename:file});
    if(context.window.SpotlogRecommendationSections)context.SpotlogRecommendationSections=context.window.SpotlogRecommendationSections;
  }
  return result;
}
const old=render(['previous'],[cp.execFileSync('git',['show','6dda9e7:web/public/reports/ai-guide-plan.js'],{encoding:'utf8'})]);
const now=render(['reports/ai-recommendation-sections.js','reports/ai-guide-plan.js']);
const development=render(['reports/development-plan.js']);
assert.equal(now.slides.length,57);
assert.equal(development.slides.length,32);
assert.equal(now.date,'2026.09.09');
assert.equal(new Set(now.slides.map(s=>s.title)).size,57);
const allowedRename={'OR-Tools 기반 일정 배치':'OR-Tools는 복잡한 배치의 선택 도구임'};
for(const s of old.slides){assert(now.slides.some(n=>n.title===(allowedRename[s.title]||s.title)),'Missing original slide: '+s.title);}
const unchanged=old.slides.filter(s=>{const n=now.slides.find(n=>n.title===s.title);return n&&n.html===s.html;}).length;
const all=now.slides.map(s=>s.html).join('\n');
for(const phrase of ['선택한 곳만','RAG','OR-Tools','claude-sonnet-5','gemini-3.8-flash','gpt-5.6-sol','gpt-5.6-luna','원문','검수','비공개','숙소','음식점'])assert(all.includes(phrase),phrase);
for(const [model,ip,op,total] of [['sol',4,20,56],['sonnet',2,10,28],['gemini',.75,3.75,10.5],['luna',.2,1.2,3.2]])assert(Math.abs((4000*ip+2000*op)/1e6*1000-total)<1e-9,model);
const toc=now.slides[2].html;
for(const m of toc.matchAll(/href="#slide-(\d+)"/g))assert(Number(m[1])<=57);
for(const name of ['spotlog-ai-guide-plan.html','spotlog-development-plan.html'])for(const m of read(name).matchAll(/(?:src|href)="\.\/([^"#]+)"/g))assert(fs.existsSync(root+m[1].split('?')[0]),m[1]);
assert(all.includes('name="generationCost"'));
const result={slides:57,developmentSlides:32,originalSlidesPreserved:34,unchangedOriginalHtmlSlides:unchanged,chapters:now.slides.map((s,i)=>({page:i+1,title:s.title,chars:s.html.replace(/<[^>]+>/g,'').length})),costPage:now.slides.findIndex(s=>s.html.includes('data-cost-form'))+1};
fs.writeFileSync(__dirname+'/structure-results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
