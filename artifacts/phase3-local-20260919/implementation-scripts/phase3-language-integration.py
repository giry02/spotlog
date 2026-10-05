from pathlib import Path
root=Path('C:/Users/Giry/Documents/Spotlog/web/src')
p=root/'App.tsx';s=p.read_text(encoding='utf-8')
s=s.replace("import TravelGuideSheet from './TravelGuideSheet';", "import TravelGuideSheet, { TranslationText } from './TravelGuideSheet';\nimport { sourceVersion } from './travelGuide';")
old='onChange={next => { if (!setJourneys(next)) return false; setTrashTarget(null); if (selectedJourneyId === trashTarget) selectTab(\'trips\'); showToast(\'휴지통으로 이동했어요. 6개월 동안 복원할 수 있어요.\'); return true; }}'
new="language={locale} onChange={setJourneys} onMoved={() => { setTrashTarget(null); if (selectedJourneyId === trashTarget) selectTab('trips'); showToast(locale === 'en' ? 'Moved to Trash. You can restore it for six months.' : '휴지통으로 이동했어요. 6개월 동안 복원할 수 있어요.'); }}"
assert old in s;s=s.replace(old,new)
s=s.replace('<TripTrashSheet journeys=', '<TripTrashSheet language={locale} journeys=')
s=s.replace('<p>{block.body}</p></section>', '<p>{block.body}</p>{block.body && <TranslationText sourceId={`${journey.id}:${block.id}`} sourceVersion={sourceVersion(block.body)} text={block.body} kind="journal" showOriginal={false}/>}</section>')
s=s.replace('<p>{day.story}</p></section>', '<p>{day.story}</p>{day.story && <TranslationText sourceId={`${journey.id}:${day.dayId ?? day.day}:story`} sourceVersion={sourceVersion(day.story)} text={day.story} kind="journal" showOriginal={false}/>}</section>')
# Locale only changes UI labels, never journey titles, addresses or IDs.
for signature in ['function Trips(', 'function Saved(']:
    at=s.index('\n',s.index(signature));s=s[:at]+"\n  const { locale } = useLocale();\n  const en = locale === 'en';"+s[at:]
s=s.replace('title="내 여행" subtitle="저장한 곳을 이어 만드는 나의 동선"', "title={en ? 'My trips' : '내 여행'} subtitle={en ? 'Build your itinerary from saved places' : '저장한 곳을 이어 만드는 나의 동선'}")
s=s.replace('onClick={onTrash}><Trash2 size={15}/>휴지통', "onClick={onTrash}><Trash2 size={15}/>{en ? 'Trash' : '휴지통'}")
s=s.replace('title="내 동선" description="가고 싶은 장소와 함께 담은 업체"', "title={en ? 'My itineraries' : '내 동선'} description={en ? 'Landmarks and places you added nearby' : '가고 싶은 장소와 함께 담은 업체'}")
s=s.replace('title="여행기와 이전 기록" description="작성하고 보관한 여행 이야기"', "title={en ? 'Journals' : '여행기와 이전 기록'} description={en ? 'Your written travel stories' : '작성하고 보관한 여행 이야기'}")
s=s.replace('<AppHeader title="저장한 장소" subtitle={`${places.length}개의 국내 랜드마크`}', '<AppHeader title={en ? "Saved places" : "저장한 장소"} subtitle={en ? `${places.length} saved places in Korea` : `${places.length}개의 국내 랜드마크`}')
p.write_text(s,encoding='utf-8')
p=root/'PersonalTrip.tsx';s=p.read_text(encoding='utf-8');s="import { useLocale } from './locale';\n"+s
at=s.index('\n',s.index('export function PersonalTrip('));s=s[:at]+"\n  const { locale, t } = useLocale();\n  const en = locale === 'en';"+s[at:]
s=s.replace('<small>나를 위한 동선</small>', "<small>{t('personalPlan')}</small>")
s=s.replace('aria-label="여행 메뉴"', "aria-label={t('tripMenu')}")
s=s.replace(' · 비공개</span>', " · {t('private')}</span>")
s=s.replace('<p>가고 싶은 곳과 주변 업체를 하나씩 채워보세요.</p>', "<p>{en ? 'Add places and nearby businesses to your day.' : '가고 싶은 곳과 주변 업체를 하나씩 채워보세요.'}</p>")
s=s.replace('<MapPin size={15}/>여행 중 안내', "<MapPin size={15}/>{t('guide')}")
s=s.replace('onRefine(day.day)}>일정 다시 추천', "onRefine(day.day)}>{t('reviseTrip')}")
s=s.replace("{mapOpen?'지도 접기':'이날의 동선 지도'}", "{en ? (mapOpen ? 'Hide map' : 'View route map') : (mapOpen?'지도 접기':'이날의 동선 지도')}")
s=s.replace('<Plus size={16}/>주변 업체', "<Plus size={16}/>{t('nearby')}")
s=s.replace('<Plus size={17}/>저장한 랜드마크 담기', "<Plus size={17}/>{t('addLandmark')}")
s=s.replace('onClick={onJournal}>이 여행을 여행기로 남기기', "onClick={onJournal}>{t('writeJournal')}")
p.write_text(s,encoding='utf-8')
p=root/'BottomSheet.tsx';s=p.read_text(encoding='utf-8');s="import { useLocale } from './locale';\n"+s
s=s.replace('  const titleId = useId();', "  const { locale } = useLocale();\n  const titleId = useId();")
s=s.replace("aria-label={detail ? '상세 닫기' : '닫기'}", "aria-label={locale === 'en' ? (detail ? 'Close details' : 'Close') : (detail ? '상세 닫기' : '닫기')}")
p.write_text(s,encoding='utf-8')
p=root/'JournalPhotos.tsx';s=p.read_text(encoding='utf-8');s="import { TranslationText } from './TravelGuideSheet';\nimport { sourceVersion } from './travelGuide';\n"+s
s=s.replace('<StoryPhoto image={photo.image} caption={photo.caption}/>', '<StoryPhoto image={photo.image} caption={photo.caption}/>{photo.caption && <TranslationText sourceId={`${block.id}:${photo.id}`} sourceVersion={sourceVersion(photo.caption)} text={photo.caption} kind="caption" showOriginal={false}/>}')
p.write_text(s,encoding='utf-8')
p=root/'CardSocial.tsx';s=p.read_text(encoding='utf-8');s="import { TranslationText } from './TravelGuideSheet';\nimport { sourceVersion } from './travelGuide';\n"+s
s=s.replace("<p>{comment.deleted?'삭제된 댓글입니다.':comment.body}</p>", "<p>{comment.deleted?'삭제된 댓글입니다.':comment.body}</p>{!comment.deleted && <TranslationText sourceId={`comment:${comment.id}`} sourceVersion={sourceVersion(comment.body)} text={comment.body} kind=\"comment\" showOriginal={false}/>}")
p.write_text(s,encoding='utf-8')
print('Travel guidance, original-content translations and language settings integrated.')
