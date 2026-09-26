import { env } from 'cloudflare:workers';
import { respond, blankFacts, compose, type Snapshot, type Facts } from '@/lib/unit-engine';
import { decideWithJev } from '@/lib/jev';

export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
 let body:Record<string,unknown>;try{if(Number(request.headers.get('content-length')??0)>24000)throw new Error();const raw=await request.text();if(raw.length>24000)throw new Error();body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return Response.json({error:'입력을 확인해 주세요.'},{status:400});}
 if(typeof body.question!=='string'||!body.question.trim()||body.question.length>500)return Response.json({error:'질문을 500자 이내로 입력해 주세요.'},{status:400});
 // Only carry validated facts across requests; never trust a client-supplied unit list or model status.
 let previous:Snapshot|undefined;
 if(body.previous&&typeof body.previous==='object'){
  const p=body.previous as {facts?:Partial<Facts>};const f={...blankFacts};
  if(p.facts){for(const name of Object.keys(f) as (keyof Facts)[]){const value=p.facts[name];if(typeof f[name]==='boolean'&&typeof value==='boolean')(f as unknown as Record<string,unknown>)[name]=value;}
   if(['luggage','cancel','other'].includes(p.facts.faqTopic??''))f.faqTopic=p.facts.faqTopic!;
   if(['airport','jeju','city'].includes(p.facts.location??''))f.location=p.facts.location!;
   if(typeof p.facts.minutes==='number'&&Number.isFinite(p.facts.minutes)&&p.facts.minutes>=0&&p.facts.minutes<=720)f.minutes=p.facts.minutes;
   if(typeof p.facts.budget==='number'&&Number.isFinite(p.facts.budget)&&p.facts.budget>0&&p.facts.budget<=10000000)f.budget=p.facts.budget;
  }previous={question:'',facts:f,units:compose(f),mode:'demo',notice:''};
 }
 const question=body.question.trim();const key=(env as Record<string,unknown>).JEV_API_KEY;
 if(typeof key!=='string'||!key)return Response.json(respond(question,previous));
 const conversation=Array.isArray(body.conversation)?body.conversation.filter((v):v is string=>typeof v==='string'&&v.length<=500).slice(-20):[];
 try{return Response.json(await decideWithJev(question,previous,conversation,key));}catch{return Response.json({error:'Jev 응답을 받지 못했어요. 현재 화면을 유지했습니다. 잠시 후 다시 시도해 주세요.'},{status:502});}
}
