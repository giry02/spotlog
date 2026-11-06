from pathlib import Path
from html import escape
import base64

ROOT = Path('C:/Users/Giry/Documents/Spotlog')
ASSETS = ROOT / 'artifacts/direction-audit-20261030'
OUT = ROOT / 'deliverables/spotlog-direction-report-20261103.html'
SOURCES = {
    'nol': ('NOL 통합 서비스 발표', '2026.09.08', 'https://nol-universe.com/ko/newsroom/pressRelease/detail?prNo=2545'),
    'ai': ('NOL AI 여행일정 기능 설명', '2026.03.03', 'https://www.yanoljagroup.com/ko/press_release/view?id=1541'),
    'discovery': ('NOL 발견 베타 공개', '2026.07.10', 'https://nol-universe.com/ko/newsroom/pressRelease/detail?prNo=2519'),
    'store': ('NOL 공식 앱스토어 소개', '확인 2026.11.01', 'https://apps.apple.com/kr/app/nol-%EC%95%BC%EB%86%80%EC%9E%90/id436731843'),
    'daangn': ('당근 모임 운영 기능 소개', '2024.07.31', 'https://team.daangn.com/company/pr/archive/당근-모임-오픈-1년-만에-1500만-이용자-돌파-누적-방문횟수-12억-7천만-회-달해/'),
    'somoim': ('소모임 공식 도움말', '확인 2026.11.01', 'https://www.somoim.co.kr/helps'),
    'kakao': ('카카오톡 정기 업데이트', '2026.07.15', 'https://www.kakaocorp.com/page/detail/12082'),
    'daangn-pc': ('당근 공식 PC 채팅 안내', '확인 2026.11.01', 'https://cs.kr.karrotmarket.com/wv/faqs/1618'),
    'pwa': ('Microsoft 설치형 웹앱 안내', '확인 2026.11.01', 'https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux'),
}

def cite(*keys):
    return '<div class="source-line">공식 근거 · ' + ' · '.join(f'<a href="{escape(SOURCES[k][2], quote=True)}" target="_blank" rel="noopener">{SOURCES[k][0]} ({SOURCES[k][1]}) ↗</a>' for k in keys) + '</div>'

def image(name, alt, caption='', cls=''):
    uri = 'data:image/png;base64,' + base64.b64encode((ASSETS / name).read_bytes()).decode()
    return f'<figure class="shot {cls}"><button class="zoom" type="button" aria-label="{escape(alt, quote=True)} 확대"><img src="{uri}" alt="{escape(alt, quote=True)}" loading="eager"></button><figcaption>{caption or alt} · 클릭하면 확대</figcaption></figure>'

def card(title, body, tone=''):
    return f'<div class="card {tone}"><h3>{title}</h3>{body}</div>'

def rows(headers, data, cls=''):
    return '<div class="table-wrap"><table class="' + cls + '"><thead><tr>' + ''.join('<th scope="col">'+h+'</th>' for h in headers) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td data-column="'+escape(headers[i], quote=True)+'">'+c+'</td>' for i,c in enumerate(row))+'</tr>' for row in data) + '</tbody></table></div>'

slides=[]
def slide(id, group, label, title, lead, body, note='', cls=''):
    n=len(slides)+1
    slides.append({'id':id,'group':group,'label':label,'html':f'''<section class="slide {cls}" id="{id}" aria-labelledby="{id}-title" data-label="{label}" data-group="{group}">
      <header class="slide-head"><div class="eyebrow">{group} <span>{n:02d}</span></div><h2 id="{id}-title" tabindex="-1">{title}</h2><p class="lead">{lead}</p></header>
      <div class="slide-body">{body}</div>
      {f'<details class="speaker"><summary>발표 메모</summary><p>{note}</p></details>' if note else ''}
      <footer class="slide-foot"><span>SPOTLOG · 방향 전환 보고</span><span>2026.11.03 화요일 · <b>{n:02d}</b> / __TOTAL__</span></footer>
    </section>'''})

slide('cover','보고 개요','보고 목적',
      '개인의 관심을<br><em>함께하는 약속</em>으로',
      '여행 중심 앱에서 개인과 모임이 함께 쓰는 서비스로 전환',
      '''<div class="cover-grid"><div><p class="cover-question">야놀자·NOL과 어디서 겹치고,<br>스팟로그는 무엇에 집중할 것인가</p><p class="cover-desc">장소를 저장하는 개인의 편의와<br>장소를 함께 고르고 다시 만나는 모임의 편의를 연결</p><div class="tags"><span class="tag">방향 제안</span><span class="tag">메뉴·화면 재설계</span><span class="tag">실제 연결 계획</span></div></div><div class="cover-loop"><div><small>혼자 발견</small><strong>관심 장소 저장</strong></div><i>↓</i><div><small>함께 결정</small><strong>제안 · 의견 · 약속</strong></div><i>↓</i><div><small>다시 이용</small><strong>준비 · 기록 · 다음 만남</strong></div></div></div><div class="meta-bar"><span><b>보고</b> 2026.11.03 (화)</span><span><b>작성·자료 확인</b> 2026.11.01</span><span><b>상태</b> 독립 로컬 시안 검토 단계</span></div>''',
      '오늘 결정할 내용은 기능을 얼마나 더 붙일지가 아니라, 개인의 저장을 함께하는 약속과 다음 만남으로 잇는 이용 흐름을 서비스 중심으로 삼을지임. 기존 여행 기능은 보존 대상. 이 문서는 실제 출시나 서버 연결 완료 보고가 아님.', 'cover')

slide('conclusion','핵심 판단','핵심 제안',
      '기능을 더 모으기보다,<br>한 번의 공동 이용을 끝까지 연결',
      '일상과 지속 모임을 중심에 두고, 여행은 더 깊게 계획할 수 있는 활동 유형으로 유지',
      '<div class="three">' +
      card('① 서비스 중심','<p>식사·카페·산책·취미 모임부터 시작.<br><b>개인 저장 → 함께 선택 → 약속 → 다음 참여</b>가 핵심 흐름.</p>','accent') +
      card('② 화면 구조','<p>하단은 <b>홈·발견·내 모임·내 공간</b> 4개. 대화와 준비는 모임 또는 개별 약속 안에서 접근.</p>') +
      card('③ 투자 순서','<p>실제 두 사람이 함께 쓰는 인증·권한·공유·초대·알림을 먼저 연결. AI는 그 위에서 조율을 보조.</p>') +
      '</div><div class="statement"><strong>차별화 가설</strong><p>“갈 곳을 추천하는 기능”보다 “각자 저장한 갈 곳을 함께 정하고, 준비하고, 다음에도 만나는 경험”에 집중.</p></div><div class="two compact">'+
      card('유지할 가치','<p>혼자 쓰는 관심 장소·폴더·개인 일정·여행기. 모임 가입 없이도 이용 가능.</p>')+
      card('줄일 신규 투자','<p>자체 예약 판매·객실 재고·결제, 전국 동시 모집, 범용 메신저 전체 복제는 후순위.</p>')+'</div>',
      '개인·모임·여행을 모두 같은 비중으로 나열하던 방식에서 우선순위를 좁힌 제안. 기능의 독점성이나 성장 효과를 이미 입증한 것은 아님. 실제 반복 이용으로 검증해야 함.')

slide('nol','경쟁 환경','NOL 중복 확인',
      'NOL을 “숙박 예약 앱”으로만 보면<br>방향을 잘못 잡을 수 있음',
      '공식 공개자료 기준, NOL은 추천·발견·일정·동선까지 확장 중',
      rows(['공식 확인한 범위','스팟로그와 겹치는 부분','보고에서의 판단'],[
          ['숙박·항공·투어·레저·공연·티켓 통합 소개','여행 전 과정과 활동 탐색','예약 상품의 양·가격·종합성 경쟁은 초기 핵심에서 제외'],
          ['AI 여행일정: 장소 추가·맞춤 코스·지도 동선','AI 여행 초안, 음식점 포함 일정, 동선','“AI가 여행을 만든다”만으로 차별화 주장 불가'],
          ['발견: 개인화 콘텐츠 피드 베타 발표','맛집·장소·놀거리 발견, 일상 방문','사진 피드나 추천 탭 자체를 차별점으로 삼기 어려움'],
          ['9월 통합 발표에서 트리플의 11월 초 합류 계획 언급','여행 계획·공유 기능의 변화 가능성','통합 완료·세부 기능 유무는 별도 확인 필요'],
      ]) + cite('nol','ai','discovery','store') +
      '<div class="note"><b>해석</b> 중복을 완전히 없애기보다, 이용 목적·주요 대상·성공 기준을 다르게 잡는 전략 필요. NOL의 모임·공유 기능이 없다고 단정하지 않음.</div>',
      'NOL의 통합과 발견, AI 일정은 공식 발표로 확인한 사실. 11월 초 트리플 통합은 9월 발표의 계획이며 11월 1일 확인 시점에 완료라고 단정하지 않음. 보고일에 달라질 수 있는 통합 완료 여부는 별도 재확인 대상.')

slide('position','경쟁 환경','우리가 선택할 영역',
      '기능 이름보다<br>사용자가 돌아오는 이유를 다르게',
      '겹치는 기본 기능은 인정하되, 개발·운영의 중심을 공동 선택과 반복 만남에 배분',
      rows(['영역','스팟로그의 선택','첫 검증 질문'],[
          ['장소 탐색·저장','혼자 저장해도 쓸모 있는 지역·종류·폴더 관리','여행을 만들지 않아도 저장한 곳을 다시 찾는가'],
          ['함께 정하기','완성 일정 이전에 장소 한 곳을 모임에 제안','후보·의견이 실제 약속 생성으로 이어지는가'],
          ['지속 모임','하나의 가족·친구·취미 모임에 여러 약속과 기록 축적','한 번의 참여 뒤 같은 모임에서 다음 참여가 생기는가'],
          ['AI','근거 대화에서 준비·확인·공지 후보를 제시','사용자가 원문을 확인하고 실제 준비에 쓰는가'],
          ['여행·예약','기존 여행 깊이는 보존, 예약 서비스 재구축은 후순위','일상 흐름을 방해하지 않으면서 다일 여행을 수용하는가'],
      ])+
      '<div class="statement small-statement"><strong>선택할 포지션</strong><p>개인의 관심 장소를 함께하는 약속과 지속적인 모임으로 연결하는 서비스</p></div><p class="fine">위 항목은 투자 우선순위 제안. 경쟁사에 같은 기능이 없다는 뜻이나 검증된 경쟁 우위를 의미하지 않음.</p>',
      'NOL이나 커뮤니티 앱의 기능 부재에 기대는 전략은 오래가기 어려움. 우리에게 남아야 할 자료는 개인의 취향과 모임의 결정·준비·기록. 이를 실제 반복 이용으로 연결하는지가 검증 과제.')

slide('benchmark','경쟁 환경','벤치마킹 반영',
      '당근·소모임·카카오의 장점은<br>메뉴 복제가 아니라 행동으로 반영',
      '이미 익숙한 구조를 가져오되, 장소 제안과 약속 준비에 맞춰 조합',
      rows(['공식 자료에서 확인','가져올 장점','스팟로그에 반영할 동작'],[
          ['당근: 지역·관심사, 반복 일정, 자주 모이는 장소, 그룹 앨범','가까운 관계와 반복 참여','발견에서 지역·관심사로 모임 찾기 → 다음 약속 → 지난 활동·앨범'],
          ['소모임: 모임 소개·가입, 정모 참여, 게시판·공지·운영 역할','모임과 개별 만남의 구조·운영','모임 가입과 약속 참석 분리. 전체 공지·대화와 약속별 준비·대화 구분'],
          ['카카오: 대화 요약 등 AI 기능 업데이트','쌓인 대화를 따라잡는 편의','방·기간·작성자 범위를 선택 → 근거 있는 요약 → 준비·공지 초안으로 연결'],
      ]) + cite('daangn','somoim','kakao')+
      '<div class="two compact">'+card('메인에서 보여줄 것','<p>공개 모임 소개·지역·관심사·다음 공개 약속. 가입 전에는 참여 조건과 운영자를 쉽게 확인.</p>')+card('과하게 넓히지 않을 것','<p>메신저 모든 기능이나 전국 모집을 한 번에 복제하지 않기. 한 지역의 반복 활동부터 검증.</p>')+'</div><p class="fine">카카오 발표를 모든 오픈채팅방의 동일한 요약 제공으로 일반화하지 않음. 우리 AI의 원문·준비 연결은 별도 구현 제안.</p>',
      '당근의 지역 연결, 소모임의 운영 구조, 카카오의 대화 편의를 각각 기능 목록으로만 붙이지 않고 실제 이용 순서로 묶는 방향. 당근 자료는 2024년 발표이므로 최신 전체 기능 목록으로 취급하지 않음.')

slide('loop','서비스 설계','핵심 이용 흐름',
      '식당 한 곳에서 시작해도<br>모임과 다음 만남까지 이어지게',
      '예시 · “저장해 둔 부산 식당, 이번 주 가족과 같이 갈까?”',
      '''<ol class="journey"><li><b>01</b><div><h3>개인 저장</h3><p>식당·카페·호텔·레저·랜드마크를 독립 저장. 지역·종류·폴더로 다시 찾기.</p></div></li><li><b>02</b><div><h3>모임에 제안</h3><p>선택 장소만 가족 모임에 전달. 개인 폴더 전체와 비공개 메모는 전달하지 않기.</p></div></li><li><b>03</b><div><h3>함께 선택</h3><p>시간·장소 의견 확인. 담당자가 “약속 만들기”로 확정하고 참여자는 별도로 참석 선택.</p></div></li><li><b>04</b><div><h3>준비·만남</h3><p>약속 안에서 공지·챙길 일·대화·일정 확인. 여행이면 DAY·숙소·동선 편집을 확장.</p></div></li><li><b>05</b><div><h3>기록·다음 제안</h3><p>사진·후기·지난 약속이 모임에 남고, 다시 가고 싶은 곳을 다음 후보로 제안.</p></div></li></ol><div class="note"><b>상태는 분리</b> 긍정 의견 ≠ 약속 생성 ≠ 참석 신청 ≠ 실제 참석 ≠ 음식점·숙소 예약 완료.</div>''',
      '일반 정모는 기존에도 있었음. 이번 변경의 중심은 새 정모 기능의 존재보다 개인 저장이 모임의 결정으로 이어지는 연결과 화면의 우선순위. 혼자 이용하는 사람에게 모임 가입을 강요하지 않음.')

slide('menus','화면 변경','기존·변경 메뉴',
      '5개 메뉴의 기능은 보존하고<br>4개 목적지로 다시 배치',
      '기존 앱은 아직 5탭. 아래 4탭은 새 독립 시안의 제안 구조',
      rows(['기존 하단 메뉴','변경 메뉴·위치','사용자가 하게 될 일'],[
          ['홈','홈','처음 온 사람은 모임 발견, 모임원은 다음 약속, 모임장은 가입 처리부터'],
          ['둘러보기','발견','모임 / 약속 / 장소 / 공개 기록 중 하나씩 보기. 지역·관심사·종류로 필터'],
          ['함께하기','내 모임 + 발견의 모임 찾기','가입한 모임과 공개 모집 분리. 모임 → 약속 → 대화·준비·기록'],
          ['내 여행','내 공간 → 내 일정·여행 / 내 기록','개인 일정과 공개 여행기를 구분. 여행 계획·DAY·숙소·동선 유지'],
          ['관심 장소','내 공간 → 저장 장소·폴더','저장 목록을 먼저 확인. 혼자 일정에 넣거나 특정 모임에 제안'],
      ])+
      '<div class="two compact">'+card('우측 상단 전체 메뉴','<p>알림·내 정보·설정·이용 안내 등 보조 기능. 기존 화면마다 주요 기능 버튼을 덧붙이는 방식 축소.</p>')+card('대화의 위치','<p>독립 하단 채팅 탭을 만들지 않고 <b>모임 전체방 / 개별 약속방</b> 안에서 접근.</p>')+'</div><p class="fine">최종 메뉴 명칭과 알림 진입은 사용자 검수 후 확정. 기존 데이터의 ID·공개 범위·소유권은 메뉴 이동으로 변경하지 않음.</p>',
      '페이지를 그대로 합치는 재사용보다 목적별 탐색을 먼저 정리. 기존 내 여행과 관심 장소가 없어지는 것이 아니라 내 공간 안에서 명확하게 분리됨. 일반 약속과 다일 여행도 같은 입력폼으로 강제하지 않음.')

slide('layout','화면 변경','레이아웃 진단',
      '기존 기능을 계속 쌓으면<br>다음 행동이 화면 아래로 밀림',
      '10월 30일 로컬 관찰 · 색상보다 정보 순서와 정렬을 먼저 수정',
      '<div class="visual-two"><div>'+image('current-home-groups.png','기존 모임 홈의 카드 누적 화면','기존 로컬 화면 · 390 × 844','phone old')+'</div><div class="stack">'+
      card('① 첫 행동이 늦게 나옴','<p>390 × 844 화면에서 첫 모집 카드 시작 약 <b>695px</b>. 상단 설명과 CTA가 누적돼 탐색이 늦어짐.</p>')+
      card('② 여백 기준이 섞임','<p>일부 주요 버튼의 좌우 여백 18px, AI·로그인 카드 38px. 같은 화면에서 내용 폭이 달라 끼워 넣은 인상.</p>')+
      card('③ 역할과 맥락이 섞임','<p>모임명 반복, 소개·대화·AI가 다음 약속보다 앞섬. 신규 방문자와 기존 모임원의 우선 행동도 같게 배치.</p>')+
      '<div class="note"><b>수정 기준</b> 기존 스타일가이드 유지 + 좌우 기준 통일 + 한 화면의 주요 행동 우선 + 고급 기능은 해당 맥락 안으로 이동.</div></div></div>',
      '이 수치는 선택한 기존 로컬 화면에서 관찰한 값. 모든 기기·모든 상태의 평균값은 아님. 화면 폭 문제를 해결했다는 것과 실제 사용자가 이해했다는 것은 별도 검증이 필요함.')

slide('homes','화면 변경','역할별 새 홈',
      '같은 홈에서도 지금 필요한<br>다음 행동을 먼저 보여주기',
      '신규 방문자 · 모임원 · 모임장에 따라 상단 우선순위 변경',
      image('new-home-overview.png','새 홈 시안 세 역할 비교','10월 30일 독립 로컬 시안 · 실제 회원·모집 수치가 아닌 예시','overview')+
      '<div class="three caption-cards">'+card('처음 온 사람','<p>지역·관심사 → 공개 모임 소개 → 가입 또는 공개 약속 확인</p>')+card('모임원','<p>내가 참석할 다음 약속 → 챙길 일 → 소속 모임</p>')+card('모임장','<p>가입 요청 → 예정 약속·공지 → 모임 운영</p>')+'</div><p class="fine">시안 보완 과제 · 개인 장소 찾기의 첫 화면 진입, 지역·종류와 결과 연결, 정모 제목 검색. 새 시안도 최종 확정본은 아님.</p>',
      '시안 상단 역할 전환은 검수 도구이며 실제 서비스 권한 전환이 아님. 새 화면이 기존 앱을 대체한 상태도 아님. 이미지는 클릭해 확대하면 모바일 화면별 글자와 여백을 볼 수 있음.')

slide('structure','서비스 설계','모임·약속·대화 구조',
      '모임은 지속되는 관계,<br>약속은 그 안에서 함께하는 활동',
      '가족·친구·취미·가이드 모임 하나에 여러 식사·산책·여행이 연결되는 구조',
      '''<div class="hierarchy"><div class="hierarchy-root"><small>개인</small><b>내 저장 장소 · 내 일정 · 내 기록</b><p>원본은 개인 소유. 선택한 자료만 공유.</p></div><div class="connector">선택 공유 · 여러 모임에 참여 가능 ↓</div><div class="hierarchy-group"><header><b>모임 A · 가족 / 친구 / 취미 / 가이드</b><span class="tag">장기 관계</span></header><div class="two compact"><div class="room"><h3>모임 전체 공간</h3><p>전체 공지 · 게시판 · 전체 대화<br>구성원 · 모임 사진·기록 · 일정 캘린더</p></div><div class="room coral"><h3>개별 약속 1 · 2 · 3 …</h3><p>날짜·시간·장소 · 참석 · 준비·후기<br><b>각 약속의 공지·대화·앨범</b><br>여행 유형에서만 DAY·숙소·동선 확장</p></div></div></div></div><div class="two compact">'''+card('공개 모집은 일부만','<p>모임 소개와 선정한 공개 약속만 노출. 실제 집합 위치·내부 대화·참석자·비공개 기록과 구분.</p>')+card('열람 권한 결정 필요','<p>현재 로컬 정책은 가입 모임원의 활동 대화·기록 열람 허용. 참석자 전용으로 바꾸려면 별도 정책·서버 검사 필요.</p>')+'</div>',
      '사용자가 요구한 대화방 두 단계 유지. 대화를 모임과 같은 전역 메뉴로 올리지 않음. “약속방”은 모임 안의 활동 맥락이며 모임 전체방과 공지·대화 범위를 구분함.')

slide('flows','서비스 설계','눌렀을 때의 동작',
      '버튼 뒤의 결과와<br>돌아올 위치까지 명확하게',
      '주요 흐름 3개 · 새 로컬 시안에서 조작 확인, 실제 공동 사용 연결은 후속',
      rows(['사용자·출발점','클릭 순서','도착·보호 기준'],[
          ['개인 → 모임원<br>저장한 카페','내 공간의 장소 → 모임에 제안 → 의견 선택 → 약속 만들기 → 참석 선택 → 약속 대화','재클릭 시 같은 약속으로 이동. 투표만으로 참석 처리하지 않음. 개인 원본 유지'],
          ['가입 희망자 → 모임장<br>발견의 두 번째 공개 약속','약속 선택 → 모임 가입 신청 → 모임장이 승인 → 원래 고른 약속으로 복귀 → 별도 참석','첫 약속으로 잘못 복귀하지 않기. 취소·공개 철회·만료는 서버 연결 시 추가 검증'],
          ['모임원<br>쌓인 모임 대화','전체 대화 → 작성자 선택 → 원문 모아보기 → 챙길 일 선택 → 원문으로 돌아가기','현재는 원문 선택 기능. 실제 AI 연결 후에도 출처를 남기고 확정은 사용자가 수행'],
      ])+
      '<div class="note"><b>서버 계약에서 결정할 부분</b> 약속 확정·수정 권한, 정원 초과 동시 신청, 만료·취소 초대, 중복 생성, 승인 뒤 탈퇴 시 접근 차단.</div><p class="fine">시안에서는 긍정 의견이 있으면 가입 모임원이 약속 생성 가능. 모임장만 확정하도록 구현된 상태로 보고하지 않음.</p>',
      '화면 이동 자체보다 동일한 대상 ID를 끝까지 유지하는 것이 중요. 회원 가입 승인과 개별 정모 참석, 그리고 실제 예약은 서로 다른 상태. 권한·동시성은 프론트 예시만으로 보장할 수 없음.')

slide('ai-plan','구현 방향','AI 역할과 연결',
      'AI는 추천뿐 아니라<br>함께 결정하고 준비하는 일을 보조',
      '현재 원문 선택과 예시 결과를 실제 AI 처리로 표현하지 않기',
      '<div class="two ai-flows">'+card('A · 개인 장소·여행 생성','''<ol class="mini-flow"><li>조건 입력 → 우리 서버 권한 확인</li><li>소형 LLM 조건 해석 → 서버 조건 검증</li><li>원본 장소 DB + 승인 설명 RAG 검색</li><li>서버가 일정·동선·고정 일정 계산</li><li>소형 LLM 설명 → 서버 최종 검증</li><li>초안 미리보기 → 고객 승인 후 저장</li></ol>''')+card('B · 모임 대화·준비','''<ol class="mini-flow"><li>현재 방·기간·작성자 범위 선택</li><li>서버가 최신 구성원 권한 확인</li><li>허용된 메시지만 조회</li><li>소형 LLM 요약 + 근거 메시지 ID 반환</li><li>미정·확정·준비 후보를 구분</li><li>사용자 확인 → 공지·챙길 일에 반영</li></ol>''','accent')+'</div><div class="note"><b>연결 구분</b> 화면 → 우리 서버 → 맥미니 AI 실행 환경(로컬 LLM·검색, 필요 시 내부 Flowise). 모델과 DB 비밀번호는 화면에 전달하지 않음.</div><p class="fine">여행 생성의 대형 외부 보완은 근거가 충분한 모델 실패 부분만, 요청 전체 최대 1회·시간·비용 한도 적용. 자료·지도·맥미니 장애는 추측으로 메우지 않기. 비공개 대화는 공용 장소 RAG에서 제외하며, 외부 전송 조건은 별도 확정.</p>',
      '맥미니 64GB 기반 로컬 AI는 설계 방향이며 모델 성능·동시 처리·지연은 실제 한국어 평가로 결정. 도구인 Ollama나 Flowise 자체를 별도 지능으로 설명하지 않음. 대화 요약이 결정·참석·예약을 자동 확정하지 않도록 설계.')

slide('preserve','구현 방향','보존과 이관',
      '방향 전환이<br>기존 여행·저장 자료의 손실이면 안 됨',
      '화면을 새로 설계해도 데이터 원본과 이미 만든 기능의 보호 기준은 유지',
      rows(['보존 대상','새 구조에서의 위치·동작','이관 시 확인할 것'],[
          ['관심 장소·개인 등록','내 공간. 음식점·카페·숙소·레저도 랜드마크 없이 저장','placeId·종류·지역·폴더·개인 메모 보호'],
          ['내 일정·다일 여행','내 공간의 개인 계획 / 약속의 여행 유형','DAY·방문 ID·순서·숙소·예약 고정 보호'],
          ['여행기·댓글·좋아요','개인 기록과 공개 기록. 모임 공유는 별도 선택','작성자·공개 범위·기존 스레드·신고 대상 유지'],
          ['여행 복사·공유','모임으로 보낼 자료와 공유 범위 명시','새 DAY·방문 ID, 개인 메모 제외, 공유 해제 반영'],
          ['오프라인 저장·휴지통','개인 이용 편의로 유지','기존 저장·복원 규칙 보호. 오프라인 지도·기기 GPS는 별도 현장 검증'],
      ])+
      '<div class="statement small-statement"><strong>이관 주의</strong><p>새 시안의 “여행” 선택은 유형 표시 수준. 기존 DAY·숙소·동선 편집기가 모두 연결된 상태는 아님.</p></div>',
      '기존 기능 유지란 코드를 모두 그대로 붙인다는 뜻이 아니라 소유권과 동작을 새 구조에 옮겨도 깨지지 않게 한다는 뜻. 새 시안에서 기존 여행 기능 전체의 이관 완료를 입증한 것은 아님.')

slide('desktop','구현 방향','PC·설치형 확장',
      '모임의 대화·공지·준비는<br>PC에서도 이어 쓸 수 있게',
      'PC 웹 + 설치형 웹앱(PWA)을 먼저 설계. 별도 PC 프로그램은 실제 요구를 보고 확장',
      '<div class="two">'+card('당근에서 확인한 방식','<p>공식 안내는 <b>PC 홈페이지의 채팅하기 → 모바일 앱 QR 인증 → PC 채팅</b>. 모임 게시판·앨범·운영 전체가 PC에서 동일하게 제공되는지는 이 안내로 확인 불가.</p>')+card('스팟로그 권고안','<p>브라우저와 설치형 웹앱에서 같은 계정·모임·메시지 사용. Windows에서는 앱 창·작업표시줄 진입 가능. 모바일 화면을 PC 중앙에 작게 띄우는 배치는 개선.</p>','accent')+'</div><div class="desktop-wire"><div><small>왼쪽</small><b>모임·약속 목록</b><p>여러 모임과 개별 방 이동</p></div><div><small>가운데</small><b>대화·공지·일정</b><p>긴 글·사진·캘린더·게시판 편집</p></div><div><small>오른쪽</small><b>준비·파일·요약 근거</b><p>필요할 때만 펼치는 보조 영역</p></div></div><div class="note"><b>선행 조건</b> 공통 서버 인증·방 권한·메시지 동기화·읽음·파일·푸시 연결. 설치만으로 자동 동기화되거나 카카오톡과 동일한 상주 알림이 보장되지는 않음.</div>'+cite('daangn-pc','pwa')+'<p class="fine">OS·브라우저·알림 허용·종료/절전·재접속 상태 검증 필요. 트레이 상주·자동 실행·파일 연동 요구가 확정되면 Windows/Mac 전용 패키지 검토. 관리자 웹과 고객 PC 화면은 별도.</p>',
      '카카오톡처럼 PC에서도 계속 쓰게 하는 경험은 방향에 포함. 첫 단계는 별도 코드베이스를 하나 더 만드는 것보다 공통 서버 위의 반응형 PC 화면과 설치형 웹앱. QR 연결을 채택할 경우 만료·휴대폰 승인·기기별 로그아웃 계약도 별도 구현. 당근의 모든 PC 모임 기능을 실사용으로 검증했다는 뜻은 아님.')

slide('roadmap','실행 계획','개발 순서',
      '시안 검토 다음 단계는<br>실제 두 사람이 함께 쓰는 검증',
      '일정·인력 합의 전 임의 출시일을 제시하지 않고 단계별 통과 조건으로 관리',
      rows(['단계','진행할 작업','다음 단계로 넘어갈 기준'],[
          ['01 방향·계약 확정','4개 메뉴, 제안·의견·약속 상태, 운영 역할, 공개 범위·초대 방식 결정','화면별 입력·결과·권한·오류·버전 계약 합의'],
          ['02 실제 공동 사용','인증·저장·모임·초대·신청·승인·약속·참석. PC 반응형·설치형 진입','다른 두 계정·휴대폰과 PC에서 같은 자료 확인. 철회·중복·정원·충돌 처리'],
          ['03 준비·운영 연결','전체방·약속방, 파일·공지·챙길 일·알림·신고','재접속·중복 수신·실패 복구. 알림이 정확한 방·약속으로 이동'],
          ['04 제한 베타','동의한 가족·친구와 한 지역 취미 모임에서 첫 이용·다음 이용 관찰','실제 공동 이용과 다음 참여 측정. 운영 대응·복구 가능 여부 확인'],
          ['05 공개 모집 확대','지역·관심사 홍보·선정·중단·가입 흐름 운영','모집→가입→참석 퍼널과 반복 참여를 보며 지역·모임 범위 확대'],
      ])+
      '<div class="note"><b>AI는 병행 가능</b> 권한과 원문 근거를 확정한 뒤 한국어 시험집으로 연결·평가. AI 고도화 때문에 기본 공동 이용 검증을 미루지 않기.</div>',
      '프론트 담당은 메뉴·화면·상태·DTO와 회귀 확인, 백엔드 담당은 인증·권한·공유 상태·알림·작업, AI 담당은 자료·실행·평가를 병행. 공유 식별자와 오류 계약을 먼저 맞춰야 같은 화면을 각자 다르게 구현하는 일을 줄일 수 있음.')

slide('operations','실행 계획','관리자·운영 보완',
      '모임 기능이 늘면<br>관리자도 여행기 운영을 넘어 확장',
      '기존 장소·자료 운영은 유지. 실제 모임 문제를 처리할 경로를 추가',
      rows(['운영 업무','추가·보완할 것','권한·처리 기준'],[
          ['모임·약속 신고','모임·활동·메시지·게시물 대상과 해당 문맥 조회','신고 대상 ID·사유·조치·이력. 모임장에 대한 독립 신고 가능'],
          ['공개 모집·홍보','모임 공개 소개·선정 약속, 메인 선정·기간·순서·게시 중단','모임장 공개와 서비스 운영자 추천을 구분'],
          ['가입·참여 문제','신청·승인·초대 만료·정원 충돌·강퇴·탈퇴 확인','가입·참석·실제 출석을 각각 구분. 운영자 임의 참석 처리 제외'],
          ['알림·파일·AI 실패','전달 실패·재시도·파일 철회·AI 요청 오류 목록','대화 원문 전체 기본 열람 제외. 필요한 범위의 근거만 접근'],
          ['지역·장소 자료','지역별 업체·출처·좌표·영업·사용 범위 검수','공용 장소와 개인 장소·모임 비공개 자료 분리'],
      ])+
      '<p class="fine">현재 관리자 신고 계약은 여행기·댓글·프로필·장소·사진 중심. 모임·활동·채팅 신고는 새 계약과 화면 연결 필요.</p>',
      '고객 화면에 신고 버튼만 넣고 끝내지 않기. 실제 접수와 조치·복구·이력까지 운영 경로가 필요. 반대로 운영자가 모든 개인 대화를 기본으로 조회하는 관리자는 만들지 않음.')

slide('status','검증 현황','어디까지 했나',
      '독립 시안은 검토 가능,<br>실제 공동 서비스는 연결 전',
      '2026.10.30 로컬 검수 기록 기준 · 시안과 기존 제품을 구분',
      '<div class="three status-cards">'+card('기존 앱','<span class="badge neutral">로컬 구현</span><p>기존 5탭·개인 저장·여행·모임 UI 유지.<br>모임 자료는 계정별 로컬 저장 기준.</p>')+card('새 방향 시안','<span class="badge coral-badge">독립 시안</span><p>4탭·역할별 홈·제안→약속·정확한 승인 복귀·원문→챙길 일.<br>페이지 메모리 동작.</p>')+card('실제 서비스','<span class="badge neutral">미연결</span><p>실제 인증·공동 서버 자료·초대 전달·실시간·푸시·LLM·모임 신고 처리.</p>')+'</div>'+
      rows(['검수 항목','확인 결과','해석의 한계'],[
          ['반응형 레이아웃','기존 24개 상태 / 새 시안 39개 상태, 320·390·460px에서 가로 넘침·깨진 이미지 0','39개 독립 화면이 아니라 11화면×3폭 + 추가 역할 홈 6개'],
          ['시안 조작·기본 규격','제안 중복 방지·가입 승인 뒤 정확한 약속 복귀·원문→챙길 일 확인. 입력16px·주요 터치44px+','실제 다른 기기·동시 수정·기기 키보드·사용자 이해도 검증은 별도'],
          ['코드·로그','시안 타입 검사·기존 웹 빌드 통과. 단독 시안 경고·오류 기록 없음','비교 iframe의 MutationObserver 오류 1건 미해결. 기존 빌드 용량 안내 존재'],
      ],'dense')+
      '<div class="note"><b>정확한 보고 표현</b> “새 방향의 독립 로컬 시안과 주요 조작 흐름 확인”. 실제 AI·공동 사용·출시 완료로 표현하지 않기.</div>',
      '화면 오버플로가 없다는 결과는 사용성이 검증되었다는 뜻이 아님. 시안 새로고침 시 메모리는 초기화됨. 이번 보고 문서 작성은 제품이나 Git 배포를 바꾸는 작업이 아님.')

slide('metrics','검증 계획','성과 판단 기준',
      '조회 수보다 먼저 볼 것:<br>실제로 함께 쓰고 다시 참여하는가',
      '가설 검증 지표. 현재 실적이 아니며 서버 연결 전 항목은 “미측정”으로 표시',
      rows(['검증할 가설','측정 단위','잘못 해석하지 않을 것'],[
          ['개인 이용 가치','저장 후 다시 찾기·지역/종류 필터 사용·제안 진입','샘플 장소 수를 사용자 이용 성과로 집계하지 않기'],
          ['첫 공동 이용','서로 다른 실제 회원 2명 이상이 같은 모임에서 제안·의견·참석 등 성공','한 사람이 검수 역할을 바꾼 테스트는 공동 이용 아님'],
          ['모집 전환','소개 열람 → 가입 신청 → 승인 → 첫 약속 참석 선택을 각각 측정','가입 승인율을 정모 참석률로 해석하지 않기'],
          ['반복 이용','첫 참여 이후 같은 모임에서 다음 약속 참석 선택','참석 선택과 실제 방문은 다름. 출석 확인 방식은 별도 합의'],
          ['조율·운영 품질','제안→약속 전환, AI 후보 적용·오답, 취소·신고·알림 실패·응답시간·비용','AI 결과 수·메시지 수만으로 유용성 판정하지 않기'],
      ])+
      '<div class="note"><b>목표치는 베타 범위와 함께 합의</b> 기간·대상·최소 표본·성공 기준을 정한 뒤 판단. 임의 MAU·매출·전환율 목표나 검증되지 않은 성장 수치 제시 제외.</div>',
      '최소 첫 공동 이용과 다음 참여를 분리해 확인해야 함. 실제 출석은 동의받은 확인 방식이 있어야 측정 가능. 지표 수집을 위해 고객 대화 원문과 개인 메모를 자동 수집하는 방식은 기본값에서 제외.')

slide('decisions','의사결정','화요일 합의할 내용',
      '이 방향에 합의한 뒤<br>실제 연결 범위를 좁혀 실행',
      '승인 요청은 기능 전체가 아니라 중심 경험·검증 대상·권한·통과 기준',
      rows(['결정할 것','권고안','이 결정이 필요한 이유'],[
          ['① 서비스 중심·메뉴','개인 발견→모임 제안→반복 만남. 4개 메뉴 채택','기존 여행 UI에 새 기능을 계속 덧붙이는 방식 중단'],
          ['② 첫 파일럿','비공개 가족·친구 + 한 지역 취미 모임의 소규모 검증','사적인 편의와 공개 모집은 유입·운영 난도가 다르므로 별도 관찰'],
          ['③ MVP 투자 순서','실제 공동 사용·권한·초대·알림·신고를 AI 고도화보다 먼저','두 사람이 함께 쓸 수 있어야 서비스 가치 검증 가능'],
          ['④ 결정 권한·모임 생성','멤버 제안·의견 허용, 확정·공개 권한 결정. 개인 초대 첫 수락 시 활성화와 모임 먼저 만들기 구분','시안의 멤버 생성 허용·초대 방식과 운영 정책을 혼동하지 않기'],
          ['⑤ 통과·확대 기준','다른 계정·기기의 전체 흐름 + 다음 참여 + 운영 복구 확인','화면 수나 기능 목록이 아닌 이용 성공으로 확대 여부 판단'],
      ])+
      '<div class="statement small-statement"><strong>보고 제안 문장</strong><p>여행 기능은 유지하면서, 개인의 장소 저장을 함께 정하는 약속과 지속 모임으로 연결하는 방향으로 우선순위를 바꾸고 실제 공동 이용부터 검증.</p></div>',
      '예약 제휴나 운영자 유료 도구 같은 수익 모델은 반복 이용과 운영 가치를 확인한 뒤 실험. 자체 결제나 예약 재고 확보를 지금 MVP 완료 조건에 넣지 않음.')

slide('questions','부록','발표 메모·질의응답',
      '보고 때 바로 쓸 설명',
      '1분 설명과 예상 질문 · 과장 없이 전달할 표현',
      '''<div class="talk"><span class="tag">1분 설명</span><p>기존 스팟로그는 장소를 찾고 개인 여행을 만드는 데 중심이 있었음. 새 방향은 개인이 저장한 식당·카페·산책 장소를 모임에 제안하고, 함께 약속을 정하고, 준비와 기록을 다음 만남으로 잇는 서비스.</p><p>NOL도 이미 AI 일정과 일상형 발견을 제공하므로 추천이나 AI 생성 자체로는 구분이 약함. 우리는 개인의 저장과 지속 모임의 결정·준비 연결에 집중. 이를 위해 메뉴를 4개로 재설계한 독립 로컬 시안을 만들었고, 다음 단계는 실제 두 계정의 공동 이용과 재참여 검증.</p></div>'''+
      rows(['질문','답변 요지'],[
          ['여행 앱을 버리는 건가?','아님. 개인 여행과 여행기를 보존하고, 여행을 일상 약속보다 깊은 계획 유형으로 수용.'],
          ['소모임·카카오와 뭐가 다른가?','그룹·요약 기능 존재만으로는 구분 불가. 개인 저장→함께 선택→준비→다음 만남의 연결을 검증할 계획.'],
          ['지금 출시 가능한가?','독립 시안 검토 단계. 실제 인증·공동 자료·실시간·알림·AI·운영 연결과 제한 베타 필요.'],
          ['수익화는?','반복 이용 확인 뒤 운영자 편의·가이드 콘텐츠·외부 예약 연결 등을 검토. 가격·제휴·수익은 미확정.'],
      ],'dense'),
      '피할 표현: “NOL에는 모임이 없다”, “AI 요약이라 유일하다”, “39개 화면 구현 완료”, “실제 공동 서비스 완료”, “가입 승인이 곧 참석·예약”.')

source_rows=[]
for key in ['nol','ai','discovery','store','daangn','somoim','kakao']:
    title,date,url=SOURCES[key]
    source_rows.append([f'<a href="{escape(url, quote=True)}" target="_blank" rel="noopener">{title} ↗</a>',date,{'nol':'통합 범위·트리플 합류 계획','ai':'일정·장소 추가·지도 동선','discovery':'개인화 발견 피드 베타','store':'현재 앱 이름·서비스 소개','daangn':'지역·반복 일정·앨범','somoim':'모임·가입·정모·운영','kakao':'대화 요약 등 AI 업데이트'}[key]])

slide('sources','부록','근거·로컬 검토 링크',
      '공식 근거와 내부 검수 자료',
      '외부 자료 확인일 2026.11.01 · 제품 시안·검수일 2026.10.30',
      rows(['공식 공개자료','발표·확인일','사용 범위'],source_rows,'sources-table')+
      '''<div class="local-links"><b>로컬 시안 확인</b><a href="http://127.0.0.1:5210/tests/zero-direction-review.html" target="_blank" rel="noopener">새 방향 시안 ↗</a><a href="http://127.0.0.1:5210/@fs/C:/Users/Giry/Documents/Spotlog/docs/execution/ZERO_DIRECTION_REVIEW_20261030.html" target="_blank" rel="noopener">10/30 상세 검수 ↗</a><a href="http://127.0.0.1:5210/@fs/C:/Users/Giry/Documents/Spotlog/deliverables/spotlog-home-followup-20261101.html" target="_blank" rel="noopener">11/1 메인 추가 점검 ↗</a></div><p class="fine">스크린샷은 파일 안에 포함되어 서버 없이 열람 가능. 로컬 시안 링크는 개발 서버 실행 필요. 내부 근거: artifacts/direction-audit-20261030의 verification.json·behavior.json·레이아웃·로그 기록. PC 자료는 PC 확장 페이지에 별도 링크. 실제 고객 자료·요청·대화 원문 수집 없음.</p><p class="fine">비교 범위: 공식 발표·도움말·스토어의 공개 내용. 로그인한 경쟁 앱의 모든 화면·계정·지역을 실기기로 전수 검증한 비교가 아님. 경쟁 기능 부재나 예약 제휴·API·이용 조건을 보장하지 않음.</p>''',
      '발표 전에 통합 완료 등 날짜에 민감한 내용은 필요 시 재확인. 이 문서는 11월 1일 확인 자료를 기준으로 작성한 11월 3일 보고용 문서. 승인·확정된 사업 계획이나 법률 검토 결과로 취급하지 않음.')

CSS=r'''
:root{--paper:#f8f8f6;--ink:#22221f;--muted:#65665f;--line:#deded8;--accent:#ff5a3d;--soft:#fff1ec;--green:#376b5b;--radius:18px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#eaece8;color:var(--ink);font-family:Pretendard,"Malgun Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.65;word-break:keep-all;overflow-wrap:break-word}button,a{-webkit-tap-highlight-color:transparent}button{font:inherit;cursor:pointer}a{color:inherit;text-underline-offset:3px}a:hover{color:#bd3f27}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}button:disabled{opacity:.4;cursor:default}button:disabled:hover{background:inherit}p{margin:0 0 12px}b,strong{font-weight:750}h2,h3{letter-spacing:-.04em}h3{font-size:18px;line-height:1.45;margin:0 0 12px}h2{font-size:34px;line-height:1.27;margin:12px 0 14px;font-weight:800}em{color:var(--accent);font-style:normal}small{font-size:13px}ul,ol{margin:0;padding-left:22px}li+li{margin-top:8px}.toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;min-height:68px;padding:10px max(20px,calc((100vw - 1240px)/2));background:rgba(248,248,246,.97);border-bottom:1px solid var(--line)}.brand{font-size:21px;font-weight:850;letter-spacing:-.06em;margin-right:12px;white-space:nowrap}.brand i{font-style:normal;color:var(--accent)}.toolbar button{min-height:44px;padding:8px 15px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:14px;white-space:nowrap}.toolbar button:hover{background:var(--soft)}.toolbar .print{background:var(--ink);border-color:var(--ink);color:white}.toolbar .spacer{flex:1}.counter{font-size:14px;color:var(--muted);min-width:52px;text-align:center;font-variant-numeric:tabular-nums}.toolbar .arrow{font-size:19px;padding:4px;width:44px}.progress{position:fixed;z-index:22;top:0;left:0;height:3px;background:var(--accent);width:0}.report{max-width:1240px;padding:28px 0 60px;margin:auto}.slide{position:relative;background:var(--paper);border:1px solid #dcdfd8;border-radius:20px;box-shadow:0 10px 45px #25261e0b;padding:40px 48px 22px;min-height:790px;margin-bottom:28px;display:flex;flex-direction:column;scroll-margin-top:88px}.enhanced:not(.all-view) .slide{display:none}.enhanced:not(.all-view) .slide.active{display:flex}.slide-head{margin-bottom:26px;flex:0 0 auto}.eyebrow{text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-size:13px;font-weight:750;display:flex;justify-content:space-between;align-items:center}.eyebrow span{font-size:14px;letter-spacing:0}.lead{font-size:16px;color:var(--muted);margin:0;line-height:1.6;max-width:1000px}.slide-body{flex:1;min-width:0}.slide-foot{display:flex;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding-top:14px;margin-top:24px;color:var(--muted);font-size:12px;letter-spacing:.02em}.slide-foot b{color:var(--ink)}.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:22px 24px;min-width:0}.card p:last-child{margin-bottom:0}.card.accent{background:var(--soft);border-color:#f4c5b7}.card h3{margin-bottom:12px}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.compact{margin-top:18px}.statement{margin-top:24px;padding:24px 28px;border-left:4px solid var(--accent);background:#fff;border-radius:0 16px 16px 0}.statement strong{font-size:13px;color:#b63c26}.statement p{font-size:24px;line-height:1.5;font-weight:700;letter-spacing:-.04em;margin:6px 0 0}.small-statement{padding:17px 24px}.small-statement p{font-size:20px}.note{margin-top:20px;padding:15px 20px;background:#eeefeb;border:1px solid #e1e3dc;border-radius:12px;font-size:15px;line-height:1.65}.note b{margin-right:8px}.fine{font-size:13px;color:var(--muted);line-height:1.65;margin:14px 0 0}.source-line{margin-top:16px;display:flex;flex-wrap:wrap;gap:5px 9px;font-size:12px;color:var(--muted);line-height:1.7}.source-line a{color:#4f584f}.table-wrap{max-width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:15px;line-height:1.65}th,td{padding:15px 18px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}th{font-size:13px;color:#52564d;background:#eceee8;font-weight:750}tr:last-child td{border-bottom:0}td:first-child{font-weight:700}th:first-child{width:23%}th:nth-child(2){width:37%}th:nth-child(3){width:40%}.dense td,.dense th{padding:12px 15px;font-size:14px}.sources-table th:first-child{width:40%}.sources-table th:nth-child(2){width:22%}.sources-table th:nth-child(3){width:38%}.sources-table td{padding:10px 14px;font-size:14px}.badge,.tag{display:inline-flex;align-items:center;border-radius:8px;min-height:28px;padding:3px 10px;font-size:12px;font-weight:700;line-height:1.4}.neutral{background:#eeefe9;color:#535c50}.coral-badge,.tag{background:var(--soft);color:#b9412b}.tags{display:flex;gap:8px;flex-wrap:wrap}.tags .tag{border:1px solid #f1d5c9}.status-cards{margin-bottom:20px}.status-cards p{margin:12px 0 0;font-size:15px}.status-cards .card{padding:20px}.cover h2{font-size:51px;line-height:1.25;margin-top:18px}.cover .lead{font-size:19px}.cover-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:60px;align-items:center;padding:8px 0 25px}.cover-question{font-size:23px;line-height:1.55;font-weight:700;letter-spacing:-.04em;margin:8px 0 20px}.cover-desc{font-size:17px;color:var(--muted);margin-bottom:24px}.cover-loop{border-left:1px solid var(--line);padding-left:48px}.cover-loop>div{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px 22px}.cover-loop>div:nth-of-type(2){border-color:#ffb6a5;background:var(--soft)}.cover-loop small{display:block;color:var(--muted)}.cover-loop strong{display:block;font-size:21px;letter-spacing:-.03em}.cover-loop i{display:block;text-align:center;color:var(--accent);font-style:normal;height:26px;line-height:26px}.meta-bar{padding:17px 0;border-top:1px solid var(--line);display:flex;gap:22px;flex-wrap:wrap;color:var(--muted);font-size:13px}.meta-bar b{margin-right:6px;color:var(--ink)}.journey{padding:0;list-style:none;display:grid;gap:12px}.journey li{display:grid;grid-template-columns:46px 1fr;gap:18px;padding:15px 20px;border:1px solid var(--line);border-radius:14px;background:#fff;margin:0}.journey li>b{color:var(--accent);font-size:23px}.journey h3{font-size:17px;margin:0 0 4px}.journey p{margin:0;font-size:15px}.visual-two{display:grid;grid-template-columns:280px 1fr;gap:36px;align-items:start}.shot{margin:0;min-width:0}.shot .zoom{display:block;padding:0;border:1px solid #d7d8d2;border-radius:16px;background:#fff;width:100%;overflow:hidden;cursor:zoom-in}.shot img{display:block;width:100%;height:auto}.shot.phone{max-width:250px;margin:auto}.shot.phone .zoom{height:490px}.shot.phone img{height:100%;object-fit:cover;object-position:top}.shot figcaption{font-size:11px;color:var(--muted);margin-top:9px;line-height:1.6}.stack{display:grid;gap:12px}.stack .card{padding:16px 22px}.stack .card h3{font-size:17px;margin-bottom:5px}.stack .card p{font-size:15px}.stack .note{margin:0}.shot.overview{max-width:790px;margin:auto}.shot.overview .zoom{max-height:415px}.shot.overview img{width:100%;height:415px;object-fit:contain;background:#eef0eb}.caption-cards{margin-top:18px}.caption-cards .card{padding:16px 20px}.caption-cards h3{font-size:16px;margin-bottom:5px}.caption-cards p{font-size:14px}.hierarchy-root{border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px 22px;display:grid;grid-template-columns:70px 1fr;align-items:center;gap:4px 12px}.hierarchy-root small{color:var(--accent);font-weight:700;grid-row:span 2}.hierarchy-root p{margin:0;font-size:14px;color:var(--muted)}.connector{text-align:center;font-size:13px;color:var(--muted);padding:9px}.hierarchy-group{background:#fff;border:2px solid #dbbcb0;border-radius:18px;padding:22px}.hierarchy-group>header{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:20px}.room{background:#f1f3ed;padding:20px;border-radius:12px;border:1px solid #dfe3d9}.room.coral{background:var(--soft);border-color:#f2d0c3}.room p{margin:0;font-size:15px}.mini-flow{list-style:none;padding:0;counter-reset:flow}.mini-flow li{counter-increment:flow;display:flex;align-items:center;gap:12px;font-size:15px;padding:10px 0;border-bottom:1px solid #deded880;margin:0}.mini-flow li:last-child{border:0}.mini-flow li:before{content:counter(flow);border:1px solid #d7d7d0;border-radius:50%;width:25px;height:25px;flex:0 0 25px;text-align:center;line-height:23px;font-size:12px;background:white}.ai-flows .card{padding:20px 24px}.talk{background:#fff;border-left:4px solid var(--accent);border-radius:0 16px 16px 0;padding:20px 25px;margin-bottom:20px;font-size:16px}.talk .tag{margin-bottom:14px}.local-links{margin-top:18px;display:flex;gap:16px;flex-wrap:wrap;font-size:14px}.speaker{margin-top:20px;font-size:14px;color:var(--muted)}.speaker summary{cursor:pointer;width:fit-content;min-height:32px;line-height:32px}.speaker p{margin:8px 0 0;padding:13px 18px;border:1px dashed #cecec5;border-radius:12px;background:#f1f2ec}.help{color:var(--muted);text-align:center;font-size:12px;margin:0 20px 24px}.toc-dialog,.image-dialog{border:1px solid var(--line);border-radius:20px;padding:28px;box-shadow:0 20px 120px #0004;max-width:min(92vw,960px);width:960px;color:var(--ink);background:var(--paper);max-height:90vh}.toc-dialog::backdrop,.image-dialog::backdrop{background:#161814b3}.dialog-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.dialog-header h2{font-size:24px;margin:0}.close-dialog{width:44px;height:44px;flex:0 0 44px;border:1px solid var(--line);border-radius:50%;background:#fff;font-size:23px}.toc-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.toc-group h3{font-size:13px;color:var(--accent);margin:0 0 5px}.toc-group a{display:flex;gap:12px;align-items:center;padding:9px 12px;min-height:44px;text-decoration:none;font-size:15px;border-radius:8px}.toc-group a:hover,.toc-group a[aria-current=page]{background:#eceee6}.toc-group a span{font-size:12px;color:var(--muted);width:22px}.image-dialog{width:auto;max-width:94vw;max-height:96vh;padding:16px}.image-dialog .dialog-header{margin-bottom:12px}.image-dialog h2{font-size:16px;letter-spacing:0}.image-dialog img{max-height:78vh;max-width:89vw;width:auto;height:auto;display:block;margin:auto}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(min-width:1500px){.report{padding-top:34px}.slide{min-height:810px}}
@media(max-width:1280px){.report{margin:0 22px}.toolbar{padding:10px 22px}.slide{padding:32px 36px 20px}.cover h2{font-size:45px}h2{font-size:31px}th,td{padding:13px 16px}}
@media(max-width:900px){.report{margin:0 14px;padding-top:18px}.slide{padding:28px 26px 18px;min-height:0}.three{gap:12px}.card{padding:18px}.cover-grid{gap:28px}.cover-loop{padding-left:25px}.cover h2{font-size:38px}.cover-question{font-size:21px}.visual-two{grid-template-columns:210px 1fr;gap:22px}.shot.phone .zoom{height:440px}.shot.overview .zoom,.shot.overview img{height:auto;max-height:500px}.toolbar{gap:7px;padding:10px 16px}.toolbar button{padding:8px 10px}.brand{margin-right:2px}.source-line{font-size:12px}.statement p{font-size:21px}.caption-cards{grid-template-columns:1fr}.caption-cards .card{display:grid;grid-template-columns:140px 1fr;gap:12px}.caption-cards h3{margin:0}th:first-child{width:23%}th,td{padding:12px;font-size:14px}.sources-table th:first-child{width:37%}.sources-table td{font-size:13px}.status-cards{grid-template-columns:1fr}.status-cards .card{display:grid;grid-template-columns:110px 85px 1fr;align-items:center;gap:12px}.status-cards h3,.status-cards p{margin:0}}
@media(max-width:620px){body{font-size:16px}.toolbar{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;padding:10px 14px}.brand{font-size:20px;grid-column:1}.toolbar .spacer{display:none}.toolbar .counter{grid-column:2;grid-row:2}.toolbar .arrow#prev{grid-column:1;grid-row:2;justify-self:end}.toolbar .arrow#next{grid-column:3;grid-row:2}.toolbar #all{grid-column:4;grid-row:2}.toolbar .print{grid-column:3 / 5;grid-row:1}.toolbar #toc{grid-column:2;grid-row:1}.report{margin:0 10px;padding:12px 0 26px}.slide{padding:25px 20px 18px;border-radius:16px;scroll-margin-top:128px}.slide-head{margin-bottom:22px}h2{font-size:27px}.lead{font-size:15px}.cover h2{font-size:35px}.cover .lead{font-size:16px}.cover-grid,.two,.three,.visual-two{grid-template-columns:1fr;gap:14px}.cover-grid{padding:0 0 18px}.cover-loop{border-left:0;padding:16px 0 0;border-top:1px solid var(--line)}.cover-loop strong{font-size:19px}.cover-question{font-size:20px}.cover-desc{font-size:16px}.meta-bar{gap:9px;display:grid}.card{padding:19px}.card h3{font-size:18px}.statement{padding:18px 20px}.statement p,.small-statement p{font-size:19px}.note{font-size:14px;padding:14px 16px}.slide-foot{font-size:11px;align-items:start}.slide-foot>span:first-child{max-width:100px}.table-wrap{border-radius:10px}table,thead,tbody,tr,th,td{display:block;width:100%}thead{display:none}tbody tr{border-bottom:1px solid var(--line);padding:6px 0}tbody tr:last-child{border:0}td{border:0;padding:7px 15px!important;font-size:15px!important}td:first-child{font-size:16px!important;background:#eff1eb}td:before{content:attr(data-column);display:block;font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.02em;margin-bottom:3px}td:first-child:before{display:none}.dense td{font-size:14px!important}.shot.phone{max-width:230px}.shot.phone .zoom{height:470px}.stack .card{padding:18px}.caption-cards .card,.status-cards .card{display:block}.caption-cards p{margin-top:6px;font-size:15px}.status-cards .badge{margin:5px 0}.status-cards p{margin-top:6px}.hierarchy-root{grid-template-columns:1fr}.hierarchy-root small{grid-row:auto}.hierarchy-group{padding:16px}.hierarchy-group>header{display:block;font-size:18px}.hierarchy-group .tag{margin-top:8px}.room{padding:16px}.journey li{padding:14px;grid-template-columns:32px 1fr;gap:10px}.journey li>b{font-size:20px}.journey p{font-size:15px}.source-line{display:block}.source-line a{display:block;margin-top:6px}.talk{padding:18px;font-size:15px}.toc-dialog{padding:20px}.toc-grid{grid-template-columns:1fr}.dialog-header h2{font-size:21px}.local-links{display:grid;gap:10px}.image-dialog img{max-width:86vw;max-height:76vh}.image-dialog .dialog-header h2{max-width:65vw}.mini-flow li{font-size:15px}.help{display:none}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{@page{size:A4 landscape;margin:10mm}html,body{margin:0;background:#fff;color:#111;font-size:12px;line-height:1.5}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.toolbar,.progress,.help,.speaker,dialog{display:none!important}.report{display:block;margin:0;padding:0;max-width:none}.slide,.enhanced:not(.all-view) .slide{display:flex!important;border:0;border-radius:0;box-shadow:none;width:100%;min-height:186mm;margin:0;padding:0;break-after:page;page-break-after:always;break-inside:avoid}.slide:last-child{break-after:auto;page-break-after:auto}.slide-head{margin-bottom:18px}h2{font-size:28px;margin:10px 0}.eyebrow{font-size:11px}.lead{font-size:13px}.slide-foot{font-size:10px;margin-top:18px;padding-top:10px}.card{padding:17px 19px;border-radius:12px}.card h3{font-size:16px;margin-bottom:8px}.card p{font-size:13px}.two,.three{gap:14px;grid-template-columns:repeat(2,1fr)}.three{grid-template-columns:repeat(3,1fr)}.statement{margin-top:18px;padding:18px 22px}.statement p{font-size:21px}.small-statement p{font-size:18px}.compact{margin-top:14px}.note{font-size:12px;padding:12px 16px;margin-top:15px}.fine{font-size:10px;line-height:1.55;margin-top:10px}.source-line{font-size:10px;line-height:1.5;margin-top:12px}table,thead,tbody,tr,th,td{display:revert}table{display:table;table-layout:fixed;font-size:12px;line-height:1.5}thead{display:table-header-group}tbody{display:table-row-group}tr{display:table-row}th,td{display:table-cell;border-bottom:1px solid var(--line);padding:12px 14px!important;vertical-align:top}th{font-size:11px}td{font-size:12px!important}td:before{display:none!important}.dense td,.dense th{font-size:11px!important;padding:10px 13px!important}.cover h2{font-size:44px}.cover .lead{font-size:17px}.cover-grid{grid-template-columns:1.3fr 1fr;gap:50px;padding:0 0 25px}.cover-question{font-size:21px}.cover-desc{font-size:15px}.cover-loop{padding-left:36px}.cover-loop strong{font-size:19px}.cover-loop small{font-size:11px}.meta-bar{font-size:11px;gap:20px}.journey{gap:9px}.journey li{padding:12px 17px}.journey h3{font-size:15px}.journey p{font-size:12px}.visual-two{grid-template-columns:240px 1fr;gap:28px}.shot.phone{max-width:220px}.shot.phone .zoom{height:448px}.shot figcaption{font-size:9px}.stack .card{padding:14px 18px}.stack .card h3{font-size:15px}.stack .card p{font-size:12px}.shot.overview{max-width:710px}.shot.overview .zoom,.shot.overview img{height:345px;max-height:345px}.caption-cards{grid-template-columns:repeat(3,1fr)}.caption-cards .card{display:block;padding:13px 16px}.caption-cards h3{font-size:14px}.caption-cards p{font-size:12px}.hierarchy-root{padding:13px 20px}.hierarchy-root p{font-size:12px}.hierarchy-group{padding:18px}.hierarchy-group>header{font-size:17px}.room{padding:17px}.room p{font-size:13px}.mini-flow li{font-size:13px;padding:9px 0}.status-cards{grid-template-columns:repeat(3,1fr)}.status-cards .card{display:block;padding:17px}.status-cards p{margin-top:9px;font-size:12px}.status-cards h3{margin:0 0 8px}.talk{font-size:13px;padding:17px 22px;margin-bottom:16px}.local-links{font-size:12px;margin-top:14px}.sources-table td{font-size:11px!important;padding:9px 12px!important}a{text-decoration:none;color:inherit}.badge,.tag{font-size:10px;min-height:24px}.ai-flows .card{padding:17px 22px}}
'''

JS=r'''
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
'''

CSS += r'''
.desktop-wire{display:grid;grid-template-columns:1fr 1.5fr 1fr;margin-top:18px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.desktop-wire>div{padding:16px 20px;border-right:1px solid var(--line)}.desktop-wire>div:last-child{border:0}.desktop-wire small{display:block;color:var(--accent);font-size:12px}.desktop-wire b{font-size:17px}.desktop-wire p{font-size:13px;color:var(--muted);margin:5px 0 0}
@media(max-width:620px){.desktop-wire{grid-template-columns:1fr}.desktop-wire>div{border-right:0;border-bottom:1px solid var(--line)}}
@media print{.desktop-wire{grid-template-columns:1fr 1.5fr 1fr;margin-top:15px}.desktop-wire>div{padding:13px 17px;border-bottom:0;border-right:1px solid var(--line)}.desktop-wire b{font-size:15px}.desktop-wire p{font-size:11px}}
'''

groups={}
for i,s in enumerate(slides):
    groups.setdefault(s['group'],[]).append(f'<a class="toc-link" href="#{s["id"]}"><span>{i+1:02d}</span>{s["label"]}</a>')
toc='<div class="toc-grid">'+''.join('<div class="toc-group"><h3>'+g+'</h3>'+''.join(links)+'</div>' for g,links in groups.items())+'</div>'
document='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="스팟로그 개인·모임 중심 전환, NOL 중복 대응, 메뉴·화면 변경과 실행 계획. 2026년 11월 3일 보고용."><title>Spotlog 방향 전환 보고 · 2026.11.03</title><style>'''+CSS+'''</style></head><body><div class="progress" id="progress"></div><nav class="toolbar" aria-label="보고서 탐색"><a class="brand" href="#cover" aria-label="스팟로그 보고서 첫 페이지">spotlog<i>.</i></a><button id="toc" aria-haspopup="dialog">목차</button><span class="spacer"></span><button class="arrow" id="prev" aria-label="이전 페이지">←</button><span class="counter" id="counter">01 / __TOTAL__</span><button class="arrow" id="next" aria-label="다음 페이지">→</button><button id="all" aria-pressed="false">전체 보기</button><button class="print" id="print">인쇄 / PDF</button></nav><main class="report" aria-label="스팟로그 방향 전환 보고서">'''+''.join(s['html'] for s in slides)+'''</main><p class="help">← → 페이지 이동 · 목차에서 바로 이동 · 전체 보기로 연속 열람 · 인쇄는 모든 페이지 출력 · 스크린샷 클릭 확대</p><span class="sr-only" id="live" aria-live="polite"></span><dialog class="toc-dialog" id="toc-dialog" aria-labelledby="toc-title"><header class="dialog-header"><h2 id="toc-title">보고서 목차</h2><button class="close-dialog" data-close aria-label="목차 닫기">×</button></header>'''+toc+'''</dialog><dialog class="image-dialog" id="image-dialog" aria-labelledby="image-title"><header class="dialog-header"><h2 id="image-title">화면 확대</h2><button class="close-dialog" data-close aria-label="화면 확대 닫기">×</button></header><img id="large-image" alt=""></dialog><noscript><style>.toolbar{display:none}</style></noscript><script>'''+JS+'''</script></body></html>'''
document=document.replace('__TOTAL__',str(len(slides)))
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(document,encoding='utf-8')
print(f'{OUT}\n{len(slides)} pages · {OUT.stat().st_size:,} bytes')
