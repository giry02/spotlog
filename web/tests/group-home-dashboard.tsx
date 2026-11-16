// DEV-only fictional group. Repository data stays in an isolated in-memory Storage object.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TogetherApp from '../src/together/TogetherApp';
import { createEmptyState } from '../src/together/model';
import { createTogetherRepository, togetherStorageKey } from '../src/together/repository';
import { DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples';
import { koreaDay, shiftDay } from '../src/together/discovery';
import { placeCatalog } from '../src/data';
import park from '../../assets/spotlog/seoul-forest-evening.webp';
import cafe from '../../assets/spotlog/jeju-aewol-bakery.jpg';
import beach from '../../assets/spotlog/busan-haeundae-blue-hour.webp';
import food from '../../assets/spotlog/local-food.jpg';
import flowers from '../../assets/spotlog/jeju-osulloc-tea-field.jpg';
import '../src/styles.css';
import '../src/theme.css';

const viewer = { id: 'hub-review-member', name: '민지' }, groupId = 'hub-review-group';
const requestedScenario = new URLSearchParams(window.location.search).get('scenario');
const scenario = requestedScenario === 'start' || requestedScenario === 'records' || requestedScenario === 'archived' ? requestedScenario : 'active';
const now = new Date(), today = koreaDay(now), date = shiftDay(today, 3), time = now.toISOString();
const places = ['FOOD', 'CAFE', 'STAY'].map(kind => placeCatalog.find(place => place.kind === kind && !place.personal && place.image)!).filter(Boolean);
const state = createEmptyState(viewer.id, viewer.name); state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
state.members.push(...['서연','도윤','수아','지민','지호'].map((name,index)=>({id:`hub-${index}`,name})));
state.groups.push({id:groupId,name:'우리 동네, 좋은 시간',kind:'HOBBY',region:'서울',introduction:'주말 산책과 커피, 가까운 곳에서 편하게 만나요. 긴 소개와 가입 안내는 소개에서 확인해요.',cover:park,ownerId:'hub-0',memberIds:state.members.map(member=>member.id),managerIds:[],archived:false,visibility:'PRIVATE',promotionPublished:false,sourceKind:'EXAMPLE',interestPlaceIds:places.map(place=>place.id)});
for(let index=0;index<4;index++) state.activities.push({id:`hub-activity-${index}`,groupId,kind:index===3?'TRIP':'MEETUP',title:['주말 커피와 서울숲 산책','퇴근 후 가볍게 저녁','토요일의 작은 전시','같이 떠나는 하루 여행'][index],date:shiftDay(date,index*3),endDate:shiftDay(date,index*3),startTime:['14:00','19:00','11:00','09:30'][index],meetingPoint:['서울숲역 3번 출구','성수동 식당 앞','전시장 1층 로비','서울역 대합실'][index],description:'가상 검수용 약속입니다.',cover:[cafe,food,flowers,beach][index],status:'PLANNED',leadId:'hub-0',editorIds:[],participants:{'hub-0':'JOINED','hub-1':'JOINED','hub-2':'JOINED',[viewer.id]:'MAYBE'},arrivedIds:[],revision:1});
state.notices.push({id:'hub-notice',groupId,title:'새로 오신 분은 대화방에서 편하게 인사해 주세요.',body:'약속마다 참가 여부를 선택하고 만나는 장소를 확인해 주세요.',createdAt:time});
state.posts.push({id:'hub-post-photo',groupId,activityId:'hub-activity-0',authorId:'hub-1',title:'산책 후 커피 한 잔, 다음에도 함께해요',body:'가상 검수용 약속 후기입니다. 이 글을 누르면 해당 약속 기록에서 이 글이 펼쳐집니다.',category:'REVIEW',createdAt:time,likes:['hub-0'],comments:[],attachments:[{id:'p1',url:cafe,caption:'참고 사진'}]}, {id:'hub-post-text',groupId,authorId:'hub-0',title:'다음에는 어떤 활동을 하고 싶으세요?',body:'산책, 전시, 저녁 식사 중 여러분의 의견을 나눠 주세요.',category:'QUESTION',createdAt:time,likes:[],comments:[{id:'comment',authorId:viewer.id,body:'전시도 좋아요.',createdAt:time}]});
[park,beach,food,flowers].forEach((url,index)=>state.media.push({id:`hub-media-${index}`,groupId,authorId:'hub-2',url,kind:'PHOTO',caption:`가상 모임 참고 사진 ${index+1}`,createdAt:time}));
state.tasks.push({id:'hub-task',groupId,activityId:'hub-activity-0',title:'만나는 출구 확인하기',assigneeId:viewer.id,completed:false});
// These scenarios modify only the fictional snapshot before its isolated repository is created.
if (scenario === 'start') {
  state.groups[0].interestPlaceIds = [];
  state.activities = []; state.posts = []; state.media = []; state.notices = []; state.tasks = [];
  state.messages = []; state.polls = []; state.sharedJournals = []; state.challenges = [];
  state.placeFeedback = []; state.placeMenus = [];
} else if (scenario === 'records') {
  state.activities.forEach((activity, index) => {
    activity.status = 'COMPLETED'; activity.date = shiftDay(today, -7 - index * 3); activity.endDate = activity.date;
  });
} else if (scenario === 'archived') state.groups[0].archived = true;
const memory = new Map<string,string>([[togetherStorageKey(viewer.id),JSON.stringify(state)]]);
const storage:Storage = { get length(){return memory.size;},getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,value);},removeItem:key=>{memory.delete(key);},clear:()=>memory.clear(),key:index=>[...memory.keys()][index]??null };
const repository = createTogetherRepository(viewer.id,viewer.name,placeCatalog,storage);
function Review(){const [route,setRoute]=useState(`group-${groupId}`);return <main className="app-shell" data-review-scenario={scenario}><section className="content"><TogetherApp repository={repository} route={route} viewer={viewer} places={placeCatalog} journeys={[]} onNavigate={setRoute} onBack={()=>setRoute(`group-${groupId}`)} onLogin={()=>{}} onOpenJourney={()=>{}} onSavePlace={()=>{}} onCopyJourney={()=>{}}/></section></main>;}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<Review/>);
