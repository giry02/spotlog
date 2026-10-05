from pathlib import Path
root=Path('C:/Users/Giry/Documents/Spotlog')
p=root/'web/src/App.tsx'
s=p.read_text(encoding='utf-8')
def change(old,new):
    global s
    assert old in s,old[:100]
    s=s.replace(old,new)
change("import { AiTravelSheet, type AiTravelSheetDraft } from './AiTravelSheet';", "import { AiPlannerSheet, type AiPlannerDraft } from './AiPlannerSheet';\nimport { AiPlanRevisionSheet } from './AiPlanRevisionSheet';\nimport { journeyVersion } from './aiPlanner';\nimport TravelGuideSheet from './TravelGuideSheet';\nimport { LocaleProvider, useLocale } from './locale';\nimport { ProfilePreferencesSheet } from './ProfilePreferencesSheet';\nimport { TripTrashSheet, MoveToTrashSheet } from './TripTrashSheet';\nimport './phase-three-integration.css';")
change('export default function App() {', "export default function App() { return <LocaleProvider><SpotlogApp /></LocaleProvider>; }\n\nfunction SpotlogApp() {\n  const { locale } = useLocale();")
change('const [journeys, persistJourneys]', 'const [allJourneys, persistJourneys]')
change('  const setJourneys = (action:', "  const journeys = useMemo(() => allJourneys.filter(journey => !journey.trash), [allJourneys]);\n  const [trashOpen, setTrashOpen] = useState(false);\n  const [trashTarget, setTrashTarget] = useState<string | null>(null);\n  const [guideDay, setGuideDay] = useState<number | null>(null);\n  const [reviseDay, setReviseDay] = useState<number | null>(null);\n  const setJourneys = (action:")
change('useRef<AiTravelSheetDraft | null>(null)', 'useRef<AiPlannerDraft | null>(null)')
change('...journeys.flatMap((journey) => journey.days.flatMap((day) => day.places)),...personalPlaces', '...allJourneys.flatMap((journey) => journey.days.flatMap((day) => day.places)),...personalPlaces')
change('[savedIds, journeys,personalPlaces]', '[savedIds, allJourneys,personalPlaces]')
change('    setAiTravelOpen(false);\n    setDetailDay', '    setAiTravelOpen(false);\n    setTrashOpen(false);\n    setTrashTarget(null);\n    setGuideDay(null);\n    setReviseDay(null);\n    setDetailDay')
change("    const created = { ...draft, author: profile.displayName, recommendationKind:", "    const created = { ...draft, purpose: 'PLAN' as const, author: profile.displayName, recommendationKind:")
change('onSaveBusiness={saveBusiness} catalog=', 'onGuide={setGuideDay} onRefine={setReviseDay} onTrash={() => setTrashTarget(selectedJourney.id)} onSaveBusiness={saveBusiness} catalog=')
change("<Trips journeys={journeys}", "<Trips onTrash={() => setTrashOpen(true)} onDelete={setTrashTarget} journeys={journeys}")
change('<span>{item.label}</span>', "<span>{locale === 'en' ? ({home:'Home',community:'Journals',discover:'Places',trips:'My trips',saved:'Saved'} as Record<string,string>)[item.id] : item.label}</span>")
change('{aiTravelOpen && <AiTravelSheet draftRef={aiTravelDraft} places={aiPlaceCandidates}', '{aiTravelOpen && <AiPlannerSheet draftRef={aiTravelDraft} places={aiPlaceCandidates} savedPlaces={savedPlaces} author={profile.displayName}')
change('      {toast && <div className="toast"', '''      {trashOpen && <TripTrashSheet journeys={allJourneys} ownerId="local-profile" onChange={setJourneys} onClose={() => setTrashOpen(false)} />}
      {trashTarget && <MoveToTrashSheet journeys={allJourneys} journeyId={trashTarget} ownerId="local-profile" onChange={next => { if (!setJourneys(next)) return false; setTrashTarget(null); if (selectedJourneyId === trashTarget) selectTab('trips'); showToast('휴지통으로 이동했어요. 6개월 동안 복원할 수 있어요.'); return true; }} onClose={() => setTrashTarget(null)} />}
      {selectedJourney && guideDay !== null && <TravelGuideSheet journey={selectedJourney} initialDay={guideDay} onClose={() => setGuideDay(null)} />}
      {selectedJourney && reviseDay !== null && <AiPlanRevisionSheet journey={selectedJourney} initialDay={reviseDay} onClose={() => setReviseDay(null)} onApply={(next, sourceVersion) => { const current = journeys.find(item => item.id === next.id); if (!current || journeyVersion(current) !== sourceVersion) return false; return setJourneys(items => items.map(item => item.id === next.id ? next : item)); }} />}
      {toast && <div className="toast"''')
change('function Trips({ journeys, onOpen, onCreate, onShare }: { journeys:', 'function Trips({ journeys, onOpen, onCreate, onShare, onTrash, onDelete }: { onTrash: () => void; onDelete: (id: string) => void; journeys:')
change('    {myTrips.some(isPersonalPlan)', '    <button className="phase-three-trash-link" onClick={onTrash}><Trash2 size={15}/>휴지통</button>\n    {myTrips.some(isPersonalPlan)')
change('onOpen={onOpen} onShare={onShare} />}', 'onOpen={onOpen} onShare={onShare} onDelete={onDelete} />}')
change('function JourneySection({ title, description, journeys, onOpen, onShare }: { title:', 'function JourneySection({ title, description, journeys, onOpen, onShare, onDelete }: { onDelete?: (id: string) => void; title:')
change('    <button className="journey-share"', '    {onDelete && journey.isMine && <button className="journey-share journey-trash" aria-label={`${journey.title} 휴지통으로 이동`} onClick={() => onDelete(journey.id)}><Trash2 size={16}/></button>}\n    <button className="journey-share"')
# Profile settings are real local profile edits; server authentication remains a separate contract.
idx=s.index('function Profile(')
idx=s.index('\n',idx)
s=s[:idx]+"\n  const { locale } = useLocale();\n  const [preferencesOpen, setPreferencesOpen] = useState(false);"+s[idx:]
change('onProfileChange: (profile: CreatorProfile) => void;', 'onProfileChange: (profile: CreatorProfile) => boolean;')
change('    <div className="settings-list"><SettingRow', '''    <button className="phase-three-profile-settings" onClick={() => setPreferencesOpen(true)}><Settings size={16}/>{locale === 'en' ? 'Profile & preferences' : '프로필 · 이용 설정'}</button>
    {preferencesOpen && <ProfilePreferencesSheet name={profile.displayName} onClose={() => setPreferencesOpen(false)} onSave={displayName => onProfileChange({...profile,displayName})} />}
    <div className="settings-list"><SettingRow''')
# Use a preexisting settings icon exported by lucide without relying on its previous imports.
s="import { Settings } from 'lucide-react';\n"+s
p.write_text(s,encoding='utf-8')
p=root/'web/src/PersonalTrip.tsx';s=p.read_text(encoding='utf-8')
s=s.replace('  onSaveBusiness:', '  onGuide?: (day: number) => void; onRefine?: (day: number) => void; onTrash?: () => void;\n  onSaveBusiness:')
s=s.replace('renderMap,onSaveBusiness }: Props)', 'renderMap,onSaveBusiness,onGuide,onRefine,onTrash }: Props)')
s=s.replace('      <button className="outline wide plan-map-toggle"', '''      <div className="phase-three-trip-tools">{onGuide && <button onClick={() => onGuide(day.day)}><MapPin size={15}/>여행 중 안내</button>}{onRefine && <button onClick={() => onRefine(day.day)}>일정 다시 추천</button>}</div>
      <button className="outline wide plan-map-toggle"''')
s=s.replace('<Button variant="secondary" onClick={onJournal}>여행기로 남기기</Button></>', '<Button variant="secondary" onClick={onJournal}>여행기로 남기기</Button>{onTrash && <Button variant="danger" onClick={() => {closeMenu();onTrash();}}><Trash2 size={16}/>휴지통으로 이동</Button>}</>')
s=s.replace('type="date" value={tripSettings.startDate} onChange=', 'type="date" value={tripSettings.startDate} onInput={event=>setTripSettings({...tripSettings,startDate:event.currentTarget.value})} onChange=')
p.write_text(s,encoding='utf-8')
p=root/'web/src/data.ts';s=p.read_text(encoding='utf-8').replace("export interface Journey {\n  id: string;", "export interface Journey {\n  id: string;\n  trash?: { deletedAt: string; expiresAt: string; ownerId: string; previousVisibility: 'PUBLIC' | 'PRIVATE'; previousStatus: JourneyStatus };")
p.write_text(s,encoding='utf-8')
p=root/'web/src/localRepository.ts';s=p.read_text(encoding='utf-8').replace("  if (value.purpose !== undefined", "  if (value.trash !== undefined && (!isObject(value.trash) || !hasStrings(value.trash, ['deletedAt','expiresAt','ownerId']) || !Number.isFinite(Date.parse(String(value.trash.deletedAt))) || !Number.isFinite(Date.parse(String(value.trash.expiresAt))) || Date.parse(String(value.trash.expiresAt)) <= Date.parse(String(value.trash.deletedAt)) || !['PUBLIC','PRIVATE'].includes(String(value.trash.previousVisibility)) || !['PLANNING','TRAVELING','PUBLISHED'].includes(String(value.trash.previousStatus)) || value.visibility !== 'PRIVATE' || value.isMine !== true)) return false;\n  if (value.purpose !== undefined")
p.write_text(s,encoding='utf-8')
print('Local integration wired. Waiting for isolated feature modules to complete.')
