from pathlib import Path
p=Path('C:/Users/Giry/Documents/Spotlog/web/src/App.tsx');s=p.read_text(encoding='utf-8')
at=s.index('\n',s.index('function Home('));s=s[:at]+"\n  const { locale } = useLocale();\n  const en = locale === 'en';"+s[at:]
start=s.index('function Home(');end=s.index('const previewCopy',start)
part=s[start:end]
pairs={'다른 사람의 여행에서 내 여행을 시작하세요':'Start your trip with travel inspiration','가고 싶은 여행을 이야기해 주세요':'Tell us about your trip','AI 여행 만들기':'Create an AI trip','지역·기간·취향을 적고 여행 초안을 받아보세요.':'Choose a region, duration and preferences for your draft.','이번 주 추천 일정':'Featured itineraries','에디터가 고른 일정을 읽어보고 내 여행에 담으세요':'Explore selected itineraries and make them your own.','일정 자세히 보기':'View itinerary','여행자들이 만든 일정':'Travelers’ journals','실제 여행 기록을 읽고 내 일정으로 가져오세요':'Read travel stories and save ideas for your trip.','여행기 먼저 보기':'Read journal','지역 · 여행 기간으로 검색':'Search by region and duration','다른 여행자의 여행기 찾기':'Find travel journals','당일치기부터 3박 이상까지 골라보세요.':'Find day trips and longer stays.','랜드마크 찾기':'Discover landmarks','영상이나 안내 목록에서 장소 담기':'Save places from photos, videos and guides','내 여행':'My trips','복사하고 만든 일정 관리':'Manage your itineraries'}
for ko,en in pairs.items():part=part.replace('>'+ko+'<', ">{en ? '"+en+"' : '"+ko+"'}<")
part=part.replace('<h1>가고 싶은 곳을 찾거나,<br />마음에 드는 여행을 고르세요.</h1>', '<h1>{en ? <>Find your next place,<br />create your own trip.</> : <>가고 싶은 곳을 찾거나,<br />마음에 드는 여행을 고르세요.</>}</h1>')
part=part.replace('<p>공개 여행기를 그대로 읽고, 내 일정으로 복사해 장소와 동선을 자유롭게 바꿀 수 있습니다.</p>', "<p>{en ? 'Read journals, copy ideas into your itinerary and arrange the places your way.' : '공개 여행기를 그대로 읽고, 내 일정으로 복사해 장소와 동선을 자유롭게 바꿀 수 있습니다.'}</p>")
part=part.replace('aria-label="프로필"','aria-label={en ? "Profile" : "프로필"}')
s=s[:start]+part+s[end:]
at=s.index('\n',s.index('function SavedPlaceCard('));s=s[:at]+"\n  const { locale } = useLocale();\n  const en = locale === 'en';"+s[at:]
s=s.replace("(placement ? '담김 확인·해제' : '여행에 담기')", "(placement ? (en ? 'Manage placement' : '담김 확인·해제') : (en ? 'Add to trip' : '여행에 담기'))")
s=s.replace('onClick={() => setDetailOpen(true)}>상세보기<ChevronRight', "onClick={() => setDetailOpen(true)}>{en ? 'Details' : '상세보기'}<ChevronRight")
p.write_text(s,encoding='utf-8')
p=Path('C:/Users/Giry/Documents/Spotlog/web/src/PersonalTrip.tsx');s=p.read_text(encoding='utf-8')
s=s.replace("title={menu==='trip'?'내 여행 관리':`DAY ${day.day} 관리`}", "title={menu==='trip'?(en ? 'Manage trip' : '내 여행 관리'):`DAY ${day.day} ${en ? 'settings' : '관리'}`}" )
for ko,en in {'여행 이름 · 날짜':'Trip name and dates','내 여행 복사':'Copy trip','여행기로 남기기':'Write a journal','휴지통으로 이동':'Move to Trash','DAY 추가':'Add a day','이 DAY 복사':'Copy this day','이 DAY 삭제':'Remove this day','변경 저장':'Save changes'}.items():s=s.replace('>'+ko+'<', ">{en ? '"+en+"' : '"+ko+"'}<")
p.write_text(s,encoding='utf-8')
