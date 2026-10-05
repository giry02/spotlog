from pathlib import Path
import shutil

root = Path('C:/Users/Giry/Documents/Spotlog')
release = Path('C:/Users/Giry/Documents/Spotlog-Week1-Review-20260918')
backup = root / 'artifacts/phase3-local-20260919/before-integration'
for name in ['App.tsx','PersonalTrip.tsx','data.ts','localRepository.ts']:
    dest = backup / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists(): shutil.copy2(root/'web/src'/name, dest)
for name in ['SavedTripControls.tsx','savedTripBuilder.ts','saved-trip-builder.css']:
    shutil.copy2(release/'web/src'/name,root/'web/src'/name)
shutil.copy2(release/'web/tests/savedTripBuilder.test.mjs',root/'web/tests/savedTripBuilder.test.mjs')

p=root/'web/src/App.tsx'
s=p.read_text(encoding='utf-8')
r=(release/'web/src/App.tsx').read_text(encoding='utf-8')
def change(old,new):
    global s
    assert old in s, old[:120]
    s=s.replace(old,new)
change("import { AiTravelSheet", "import { SavedTripControls } from './SavedTripControls';\nimport { newSavedTripDraft, pickSavedTripPlace, forgetSavedTripPlace, type SavedTripDraft } from './savedTripBuilder';\nimport { AiTravelSheet")
change("  const savedTravelDraft = useRef<AiTravelSheetDraft | null>(null);\n  const [savedTravelPreview, setSavedTravelPreview] = useState<{ places: Place[]; dayCount: number } | null>(null);", "  const [savedTripDraft, setSavedTripDraft] = useState<SavedTripDraft>(newSavedTripDraft);")
change('    setSavedTravelPreview(null);\n','')
start=s.index('  const generateAiJourney = ')
end=s.index('  const startRecommendedJourney',start)
s=s[:start]+'''  const createSavedTrip = (draft: Journey): string | null => {
    const created = normalizePlan(normalizeVisits({ ...draft, purpose: 'PLAN', author: profile.displayName, isMine: true, visibility: 'PRIVATE' }));
    if (!setJourneys(current => current.some(item => item.id === created.id) ? current : [created, ...current])) return null;
    setSavedTripDraft(newSavedTripDraft());
    openMyJourney(created.id);
    showToast('내 여행에 저장했어요. 주변 업체를 더 담아보세요.');
    return created.id;
  };

'''+s[end:]
change("onCreatePlan={places => { setPlanChoices(places); setPlanCreating(true); }} onGenerate={generateAiJourney}","draft={savedTripDraft} onDraftChange={setSavedTripDraft} onCreate={createSavedTrip}")
s='\n'.join(line for line in s.split('\n') if '{savedTravelPreview && <AiTravelSheet' not in line)
start=s.index('function Saved({')
end=s.index('function CreatorBadge',start)
rstart=r.index('function Saved({')
rend=r.index('function CreatorBadge',rstart)
s=s[:start]+r[rstart:rend]+s[end:]
change('function SavedPlaceCard({ place, placement, onRemove, onAdd }: { place: Place;', 'function SavedPlaceCard({ place, placement, selection, onRemove, onAdd }: { selection?: { label: string; badge: string; included: boolean }; place: Place;')
change("  const placementLabel = placement ? '담김 확인·해제' : '여행에 담기';", "  const placementLabel = selection?.label ?? (placement ? '담김 확인·해제' : '여행에 담기');\n  const included = selection ? selection.included : Boolean(placement);")
change("className={`saved-card ${placement ? 'is-added-to-trip' : ''}`}","className={`saved-card ${included ? 'is-added-to-trip' : ''}`}")
change("{placement && <em><Check size={12} />{placement.count > 1 ? `${placement.count}개 일정` : `DAY ${placement.day}`}</em>}", "{(selection?.badge || (!selection && placement)) && <em><Check size={12} />{selection ? selection.badge : placement!.count > 1 ? `${placement!.count}개 일정` : `DAY ${placement!.day}`}</em>}")
change("className={`add-to-trip ${placement ? 'is-added' : ''}`}","className={`add-to-trip ${included ? 'is-added' : ''}`}")
change("{placement && <Check size={13} />}{placementLabel}","{included && <Check size={13} />}{placementLabel}")
p.write_text(s,encoding='utf-8')
p=root/'web/src/savedTripBuilder.ts'
s=p.read_text(encoding='utf-8').replace('  return result;', "  return { ...result, purpose: 'PLAN', startDate: draft.startDate || undefined, story: '', days: result.days.map(day => ({ ...day, story: '', blocks: day.blocks.filter(block => block.type === 'PLACE') })) };")
p.write_text(s,encoding='utf-8')
print('Saved builder integrated; original editing files backed up locally.')
