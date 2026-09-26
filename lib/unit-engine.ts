export type UnitId = 'time' | 'route' | 'food' | 'pickup' | 'budget' | 'indoor' | 'rest' | 'translation' | 'booking' | 'faq' | 'plan' | 'transport';
export type Facts = { location: 'airport' | 'jeju' | 'city'; child: boolean; rain: boolean; food: boolean; takeaway: boolean; rest: boolean; mobility: boolean; translation: boolean; booking: boolean; faq: boolean; plan: boolean; transport: boolean; minutes: number | null; budget: number | null; focus: UnitId | null; only: UnitId | null; faqTopic: 'luggage' | 'cancel' | 'other' };
export type Unit = { id: UnitId; title: string; purpose: string; score: number; reason: string; variant: 'lead' | 'full' | 'compact' };
export type Snapshot = { question: string; facts: Facts; units: Unit[]; mode: 'demo' | 'jev'; notice: string; model?: string; elapsedMs?: number };
export const catalog: {id: UnitId; title: string; purpose: string}[] = [
 {id:'time',title:'남은 시간',purpose:'Show time before boarding, departure or a fixed deadline. Essential when time is short.'},
 {id:'route',title:'이동 동선',purpose:'Connect relevant destinations into a route. Account for pickup, children, reduced walking, rain and deadlines.'},
 {id:'food',title:'식사 선택',purpose:'Help choose food when hungry or needing a meal. Omit when already eaten or rejected.'},
 {id:'pickup',title:'포장·픽업',purpose:'Show takeaway preparation and pickup steps only when food is wanted as takeaway.'},
 {id:'budget',title:'예산',purpose:'Show spending limit and itemized estimated cost when the user sets a budget.'},
 {id:'indoor',title:'실내 장소',purpose:'Find indoor alternatives when rain affects activities or indoor places are requested. Not needed in an airport.'},
 {id:'rest',title:'쉬어갈 곳',purpose:'Find a place to sit, rest or wait when tired, with a sleeping child or before check-in.'},
 {id:'translation',title:'바로 쓰는 번역',purpose:'Provide a phrase card when the user needs to say something in English or requests translation.'},
 {id:'booking',title:'예약 확인',purpose:'Show a demo booking voucher or check-in details when asked about a reservation, hotel or check-in.'},
 {id:'faq',title:'이용 안내',purpose:'Retrieve demo FAQ entries for luggage storage, cancellation or place policies.'},
 {id:'plan',title:'오늘의 순서',purpose:'Organize a requested itinerary or sequence. Omit when only an immediate task is wanted.'},
 {id:'transport',title:'이동수단 비교',purpose:'Compare transport for bus, taxi, fare or reduced walking requests.'},
];
export const blankFacts: Facts = {location:'city',child:false,rain:false,food:false,takeaway:false,rest:false,mobility:false,translation:false,booking:false,faq:false,plan:false,transport:false,minutes:null,budget:null,focus:null,only:null,faqTopic:'luggage'};
export const examples = [
 {label:'비 오는 제주',question:'제주에서 아이랑 여행 중인데 비가 와. 실내에서 밥 먹고 쉬고 싶어. 예산은 3만원이야.'},
 {label:'탑승 전 70분',question:'공항인데 아이가 배고파. 탑승까지 70분 남았어.'},
 {label:'체크인 전에',question:'호텔 체크인까지 90분 남았어. 짐 보관 규정 보고, 근처에서 쉬고 싶어.'},
];
export function readFacts(question: string, previous: Facts = blankFacts): {facts: Facts; recognized: boolean} {
 const q=question.replace(/\d{1,3}(?:,\d{3})+/g,n=>n.replaceAll(',','')).replace(/한\s*시간/g,'60분').replace(/두\s*시간/g,'120분').replace(/세\s*시간/g,'180분').replace(/(\d+)\s*시간(?:\s*(\d+)\s*분)?/g,(_,h,m)=>String(Number(h)*60+Number(m??0))+'분').replace(/\s+/g,' ').trim(); const f:Facts={...previous,focus:null,only:null}; let recognized=false;
 const has=(p:RegExp)=>p.test(q);
 const flag=(key: keyof Facts,on:RegExp,off?:RegExp)=>{for(const clause of q.split(/[.!?。]|그런데|하지만/)){if(off&&off.test(clause)){(f as unknown as Record<string,unknown>)[key]=false;recognized=true;}else if(on.test(clause)){(f as unknown as Record<string,unknown>)[key]=true;recognized=true;}}};
 if(has(/제주.{0,8}도착/)){f.location='jeju';f.minutes=null;recognized=true;}
 else if(has(/공항(인데|에서|이야|에 있어)|탑승까지|게이트(인데|에 있어)/)){f.location='airport';recognized=true;}
 else if(has(/제주/)){f.location='jeju';recognized=true;}
 else if(has(/호텔|체크인|시내/)){f.location='city';recognized=true;}
 flag('child',/아이|아기|유아|가족|유모차/,/아이.{0,5}(없|아니)|혼자/);
 flag('food',/배고|밥|식사|먹고|먹을|음식|메뉴|포장|픽업|간식/,/(밥|식사|음식|간식).{0,10}(먹었|했어|해결|빼|제외|안 먹|필요 없)|배(가)? 안 고|먹지 않을|안 배고/);
 flag('takeaway',/포장|테이크아웃|픽업/,/포장.{0,6}(말고|안|취소|싫)|앉아서 먹|매장에서 먹/);
 flag('rain',/비가|비 와|비 와서|비 오|우천|실내/,/비.{0,6}(그쳤|안 와|안 오)|맑아|야외로/);
 flag('rest',/쉬|휴식|피곤|졸|잠들|앉을|쉴/,/(휴식|쉬는 곳|쉴 곳).{0,6}(빼|필요 없)|안 쉬|쉬지 않/);
 flag('mobility',/걷기.{0,6}(싫|힘|어려)|걷지|적게 걷|가까운|덜 걷|유모차/,/많이 걸|걸어도 돼/);
 flag('translation',/번역|영어|뭐라고 말|어떻게 말/,/번역.{0,6}(빼|끝|필요 없|말고|안 해)|한국어만/);
 flag('booking',/예약|체크인|체크아웃|호텔/,/예약.{0,6}(빼|안 보여|필요 없)/);
 flag('faq',/규정|규칙|FAQ|faq|보관|환불|반입|예약.{0,5}취소/,/(규정|안내).{0,6}(빼|필요 없)/);
 flag('plan',/일정|순서|계획|코스/,/일정.{0,6}(빼|필요 없|말고)|지금만/);
 flag('transport',/택시|버스|이동수단|교통|걷기.{0,6}(싫|힘)|걷지|덜 걷/,/(택시|교통|이동수단).{0,6}(빼|필요 없)/);
 const minutes=q.match(/(?:탑승|출발|체크인|남은 시간|시간)[^\d]{0,10}(\d{1,3})\s*분|(?:이제|남은|딱|단)\s*(\d{1,3})\s*분|(\d{1,3})\s*분\s*(밖에|남았|남아)/);
 if(minutes){f.minutes=Math.min(720,Number(minutes[1]??minutes[2]??minutes[3]));recognized=true;}
 if(has(/시간 제한 없|급하지 않|탑승 끝|도착했/)){f.minutes=null;recognized=true;}
 const won=q.match(/(\d+(?:\.\d+)?)\s*(만\s*원|천\s*원|원)/);
 if(won){const value=Number(won[1])*(won[2].includes('만')?10000:won[2].includes('천')?1000:1);if(value>0&&value<=10000000){f.budget=value;recognized=true;}}
 if(has(/예산.{0,8}(상관 없|제한 없|빼)|돈은 상관/)){f.budget=null;recognized=true;}
 if(has(/보관/))f.faqTopic='luggage';else if(has(/환불|예약.{0,5}취소/))f.faqTopic='cancel';else if(has(/반입/))f.faqTopic='other';
 if(!f.food)f.takeaway=false;
 if(has(/(영어|번역)/)&&f.translation)f.focus='translation';
 else if(has(/(규정|보관|취소|환불)/)&&f.faq)f.focus='faq';
 else if(has(/(택시|버스|이동수단)/)&&f.transport)f.focus='transport';
 else if(has(/(일정|순서|코스)/)&&f.plan)f.focus='plan';
 else if(has(/(예산|원 이하|원 안)/)&&won&&!has(/밥|휴식|쉬|실내|아이/))f.focus='budget';
 if(has(/동선|길|어디로|바로 갈|이동/)){recognized=true;if(has(/동선|길|어디로/))f.focus='route';}
 const onlyNames:[RegExp,UnitId][]=[[/이동수단만|교통만/,'transport'],[/번역만|영어만/,'translation'],[/식사만|메뉴만/,'food'],[/동선만/,'route'],[/예산만/,'budget'],[/예약만/,'booking'],[/일정만/,'plan']];
 for(const [pattern,id] of onlyNames)if(has(pattern)){f.only=id;recognized=true;}
 return {facts:f,recognized};
}
export function compose(f: Facts, priorities?: Partial<Record<UnitId,number>>): Unit[] {
 const urgent=f.minutes!==null&&f.minutes<=25;
 const needRoute=f.food||f.rest||f.rain||f.plan||f.location==='airport'||f.transport;
 const values:Record<UnitId,[number,string]>={
  time:[f.minutes!==null?(urgent?100:85):0,urgent?'남은 시간이 짧아 이동부터 확인해요.':'남은 시간 안에서 가능한 일을 계산해요.'],
  route:[needRoute?(urgent?98:f.mobility?84:61):0,f.mobility?'걷는 구간을 줄인 동선으로 바꿔요.':f.takeaway?'픽업 지점을 동선에 연결해요.':'지금 필요한 장소만 하나의 동선으로 연결해요.'],
  food:[f.food?(urgent?39:f.takeaway?51:81):0,f.takeaway?'포장 가능한 메뉴만 짧게 보여줘요.':f.child?'아이와 함께 먹을 수 있는 선택을 먼저 보여줘요.':'현재 식사가 필요해 메뉴를 보여줘요.'],
  pickup:[f.food&&f.takeaway?(urgent?78:92):0,'앉아서 먹는 정보 대신 준비 시간과 수령 순서를 보여줘요.'],
  budget:[f.budget!==null?72:0,'설정한 예산과 현재 선택의 예상 비용을 함께 봐요.'],
  indoor:[f.rain&&f.location!=='airport'?88:0,'비를 피할 수 있는 실내 장소를 앞에 두었어요.'],
  rest:[f.rest?(f.child?86:76):0,f.child?'아이와 쉬어갈 곳을 먼저 찾았어요.':'이동 중 잠깐 머물 장소가 필요해요.'],
  translation:[f.translation?90:0,'지금 직원에게 보여줄 문장을 바로 꺼내요.'],
  booking:[f.booking?65:0,'체크인 정보와 예약 내용을 함께 확인해요.'],
  faq:[f.faq?77:0,'요청한 이용 규정을 짧은 답과 근거로 보여줘요.'],
  plan:[f.plan?82:0,'선택한 식사·휴식·장소를 순서대로 묶어요.'],
  transport:[f.transport?79:0,'이동 시간·걷는 거리·비용을 함께 비교해요.'],
 };
 return catalog.map(d=>{const [base,reason]=values[d.id];let score=priorities?Math.round((priorities[d.id]??0)/3*90):base;if(base===0)score=0;if(f.only&&d.id!==f.only&&!(urgent&&['time','route'].includes(d.id)))score=0;if(f.focus===d.id&&score>0)score+=20;if(d.id==='time'&&urgent)score=100;if(d.id==='route'&&urgent)score=Math.max(score,98);if(d.id==='time'&&f.minutes===null)score=0;if(d.id==='budget'&&f.budget===null)score=0;if(d.id==='pickup'&&(!f.food||!f.takeaway))score=0;if(d.id==='food'&&!f.food)score=0;return {...d,score,reason,variant:'full' as Unit['variant']};}).filter(u=>u.score>=35).sort((a,b)=>b.score-a.score).map((u,i)=>({...u,variant:i===0?'lead':(i>=4||u.id==='food'&&f.takeaway)?'compact':'full'}));
}
export function respond(question: string, previous?: Snapshot): Snapshot {
 const {facts,recognized}=readFacts(question,previous?.facts??blankFacts);
 if(!recognized)return {question,facts:{...facts,focus:previous?.facts.focus??null},units:previous?.units??[],mode:'demo',notice:'이 표현은 체험 모드에서 이해하지 못했어요. 필요한 것(식사·휴식·이동·시간 등)을 조금 더 구체적으로 알려주세요.'};
 return {question,facts,units:compose(facts),mode:'demo',notice:''};
}
export const initialState:Snapshot=respond(examples[0].question);
export function unitDiff(previous:Snapshot|undefined,current:Snapshot){return {added:current.units.filter(u=>!previous?.units.some(p=>p.id===u.id)),removed:previous?.units.filter(u=>!current.units.some(c=>c.id===u.id))??[],changed:current.units.filter((u,i)=>{const p=previous?.units.find(x=>x.id===u.id);return p&&(p.variant!==u.variant||previous?.units.findIndex(x=>x.id===u.id)!==i||p.reason!==u.reason);})};}
export function followups(s:Snapshot):string[]{const f=s.facts;return [...(f.food?[f.takeaway?'앉아서 먹을래':'포장해서 갈래','밥은 먹었어. 이제 쉬고 싶어']:['아이랑 밥 먹고 싶어']),...(f.minutes!==null?['이제 20분밖에 안 남았어']:['걷기 힘드니까 택시로 갈래']),...(f.translation?['번역은 이제 필요 없어']:['직원에게 영어로 말할 문장도 보여줘'])].slice(0,4);}

