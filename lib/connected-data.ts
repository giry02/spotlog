export type Domain='places'|'monitors';
export type Place={id:string;name:string;region:string;image:string;tags:string[];mood:[number,number,number];description:string;credit:string};
// Photos depict real places. Mood values and all recommendation rankings are authored demo data.
export const places:Place[]=[
 {id:'osulloc',name:'오설록 티뮤지엄',region:'제주',image:'/images/osulloc-tea.jpg',tags:['초록 풍경','차분함','느린 산책'],mood:[5,4,3],description:'초록 풍경과 차분한 시간을 기준으로',credit:'commons-osulloc-tea'},
 {id:'seoulforest',name:'서울숲',region:'서울',image:'/images/seoulforest-path.jpg',tags:['초록 풍경','나무 그늘','산책'],mood:[5,4,5],description:'나무 그늘 아래 걸으며 쉬는 분위기',credit:'commons-seoulforest-path'},
 {id:'saebyeol',name:'새별오름',region:'제주',image:'/images/saebyeol-autumn.jpg',tags:['탁 트인 풍경','차분함','산책'],mood:[4,5,4],description:'넓은 풍경을 바라보며 걷는 분위기',credit:'commons-saebyeol-autumn'},
 {id:'hyeopjae',name:'협재해변',region:'제주',image:'/images/hyeopjae-scenery.jpg',tags:['바다 풍경','탁 트인 공간','산책'],mood:[2,3,4],description:'바다를 바라보며 머무는 분위기',credit:'commons-hyeopjae-scenery'},
];
export type Restaurant={id:string;placeId:string;name:string;cuisine:'한식'|'양식'|'카페';menu:string;price:number;walk:number;angle:number;quiet:boolean};
export const restaurants:Restaurant[]=[
 {id:'of-rice',placeId:'osulloc',name:'차밭 옆 밥상',cuisine:'한식',menu:'계절 채소 정식',price:14000,walk:4,angle:30,quiet:true},
 {id:'of-pasta',placeId:'osulloc',name:'그린 키친',cuisine:'양식',menu:'토마토 파스타',price:18000,walk:8,angle:145,quiet:false},
 {id:'of-cafe',placeId:'osulloc',name:'작은 찻집',cuisine:'카페',menu:'차와 스콘',price:9000,walk:12,angle:245,quiet:true},
 {id:'sf-rice',placeId:'seoulforest',name:'숲앞 밥상',cuisine:'한식',menu:'나물 비빔밥',price:11000,walk:4,angle:20,quiet:true},
 {id:'sf-pasta',placeId:'seoulforest',name:'그늘 아래 식탁',cuisine:'양식',menu:'버섯 크림 파스타',price:16000,walk:8,angle:130,quiet:true},
 {id:'sf-cafe',placeId:'seoulforest',name:'느린 오후',cuisine:'카페',menu:'샌드위치와 커피',price:12500,walk:12,angle:230,quiet:false},
 {id:'sb-rice',placeId:'saebyeol',name:'오름 아래 밥상',cuisine:'한식',menu:'들깨 버섯 정식',price:13000,walk:3,angle:210,quiet:true},
 {id:'sb-pasta',placeId:'saebyeol',name:'들판 키친',cuisine:'양식',menu:'구운 채소 파스타',price:19000,walk:9,angle:340,quiet:false},
 {id:'sb-cafe',placeId:'saebyeol',name:'바람 쉬는 자리',cuisine:'카페',menu:'토스트와 차',price:11000,walk:14,angle:85,quiet:true},
 {id:'hj-rice',placeId:'hyeopjae',name:'바다 앞 한상',cuisine:'한식',menu:'생선구이 정식',price:15000,walk:5,angle:40,quiet:false},
 {id:'hj-pasta',placeId:'hyeopjae',name:'모래빛 식탁',cuisine:'양식',menu:'해산물 파스타',price:21000,walk:9,angle:170,quiet:true},
 {id:'hj-cafe',placeId:'hyeopjae',name:'파도 한 모금',cuisine:'카페',menu:'커피와 샌드위치',price:12000,walk:13,angle:290,quiet:true},
];
export type MonitorProduct={id:string;name:string;series:string;size:number;resolution:string;hz:number;price:number;usbC:boolean;flickerFree:boolean;lowBlue:boolean;ergonomic:boolean;description:string};
export const monitors:MonitorProduct[]=[
 {id:'view27',name:'View 27',series:'지금 보고 있는 제품',size:27,resolution:'QHD',hz:75,price:249000,usbC:true,flickerFree:true,lowBlue:true,ergonomic:false,description:'작업 중심의 27인치 QHD'},
 {id:'play27',name:'Play 27',series:'게임과 작업',size:27,resolution:'QHD',hz:165,price:289000,usbC:false,flickerFree:true,lowBlue:true,ergonomic:true,description:'주사율을 높이고 크기는 그대로'},
 {id:'calm27',name:'Calm 27',series:'긴 작업 시간',size:27,resolution:'QHD',hz:100,price:319000,usbC:true,flickerFree:true,lowBlue:true,ergonomic:true,description:'연결성과 높이 조절을 함께'},
 {id:'basic27',name:'Basic 27',series:'합리적인 가격',size:27,resolution:'QHD',hz:100,price:199000,usbC:false,flickerFree:true,lowBlue:false,ergonomic:false,description:'같은 크기·해상도, 낮은 가격'},
 {id:'speed24',name:'Speed 24',series:'빠른 화면 전환',size:24,resolution:'FHD',hz:180,price:229000,usbC:false,flickerFree:true,lowBlue:true,ergonomic:true,description:'작아진 크기, 높아진 주사율'},
 {id:'studio32',name:'Studio 32',series:'넓고 선명한 작업',size:32,resolution:'4K',hz:60,price:429000,usbC:true,flickerFree:true,lowBlue:true,ergonomic:true,description:'크기와 해상도를 함께 확장'},
];
export const getPlace=(id:string)=>places.find(p=>p.id===id)!;
export const getMonitor=(id:string)=>monitors.find(p=>p.id===id)!;
export const getRestaurant=(id:string)=>restaurants.find(p=>p.id===id)!;
export const won=(n:number)=>n.toLocaleString('ko-KR')+'원';
