import { catalog, compose, respond, type Snapshot, type UnitId, type Facts } from './unit-engine';

const booleanFacts = ['child','rain','food','takeaway','rest','mobility','translation','booking','faq','plan','transport'] as const;
const meanings:Record<typeof booleanFacts[number],string>={child:'Traveling with a child.',rain:'Needs indoor places due to rain or an indoor preference.',food:'Still needs food; false if already eaten or no food wanted.',takeaway:'Wants takeaway food instead of dining in.',rest:'Needs to sit, rest, sleep or wait comfortably.',mobility:'Needs reduced walking or an accessible route.',translation:'Needs a ready-to-use English phrase.',booking:'Needs hotel reservation or check-in information.',faq:'Needs a luggage, cancellation, or service policy.',plan:'Wants an itinerary or visit sequence.',transport:'Wants transport options or less walking.'};
export function buildQuestions(){
 const questions:Record<string,unknown>={};
 for(const unit of catalog)questions['unit_'+unit.id]={type:'score',instructions:`Evaluate the current usefulness of this travel UI unit: ${unit.title}. ${unit.purpose} Use the whole conversation. The latest explicit update overrides earlier preferences. Data are illustrative demo data. Do not infer availability of real services.`,criteria:['Not relevant now','Optional background','Important now','Immediate priority']};
 for(const key of booleanFacts)questions['fact_'+key]={type:'noul',instructions:`Is this true of the CURRENT travel context? ${meanings[key]} Carry forward prior context unless explicitly changed. Interpret Korean follow-ups and negations.`,criteria:{true:'The condition applies now.',false:'The condition does not apply, was completed, or was explicitly rejected.'}};
 questions.location={type:'choice',instructions:'Where is the user now? Carry forward the latest established location.',criteria:{airport:'At an airport or boarding a flight.',jeju:'Traveling around Jeju, outside an airport.',city:'At a hotel, in a city, or location is otherwise unspecified.'}};
 return questions;
}
export async function decideWithJev(question:string,previous:Snapshot|undefined,conversation:string[],key:string):Promise<Snapshot>{
 const start=Date.now();const fallback=respond(question,previous);
 const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000),body:JSON.stringify({model:'jev-latest',state:{conversation:conversation.slice(-20),latestMessage:question,previousContext:previous?.facts??null,availableData:'Fictional food options, routes, transport and hotel/FAQ data. Numeric times and budgets are parsed from the user, not live data.'},questions:buildQuestions()})});
 if(!response.ok)throw new Error('Jev 호출 실패');
 const result=await response.json() as {model?:string;answers?:Record<string,{type?:string;score?:number;noul?:number;choice?:string}>};
 if(!result.answers)throw new Error('Jev 응답 형식 오류');
 const priorities:Partial<Record<UnitId,number>>={};const facts:Facts={...fallback.facts};
 for(const unit of catalog){const answer=result.answers['unit_'+unit.id];if(answer?.type!=='score'||typeof answer.score!=='number'||!Number.isFinite(answer.score)||answer.score<0||answer.score>3)throw new Error('Jev 점수 형식 오류');priorities[unit.id]=answer.score;}
 for(const name of booleanFacts){const answer=result.answers['fact_'+name];if(answer?.type!=='noul'||typeof answer.noul!=='number'||!Number.isFinite(answer.noul)||answer.noul<0||answer.noul>1)throw new Error('Jev 판단 형식 오류');facts[name]=answer.noul>=0.5;}
 const location=result.answers.location;if(location?.type!=='choice'||!['airport','jeju','city'].includes(location.choice??''))throw new Error('Jev 장소 형식 오류');facts.location=location.choice as Facts['location'];
 if(!facts.food)facts.takeaway=false;
 return {question,facts,units:compose(facts,priorities),mode:'jev',notice:'',model:result.model,elapsedMs:Date.now()-start};
}
