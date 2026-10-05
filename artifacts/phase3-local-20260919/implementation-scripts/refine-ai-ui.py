from pathlib import Path
p=Path('web/src/AiPlannerSheet.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace("type RefObject }", "type RefObject, type ReactNode }")
s=s.replace("ArrowLeft, Check, LockKeyhole, Plus, Sparkles", "ArrowLeft, CalendarDays, Check, ChevronDown, MapPin, LockKeyhole, Plus, Sparkles, SlidersHorizontal, Users, Utensils, BedDouble, Info")
s=s.replace('plannerBusinessCandidates, ', '')
s=s.replace("import { plannerText } from './aiPlanner';", "import { plannerText } from './aiPlanner';\nimport { readQuickPlannerPrompt, dayBusinessSuggestions } from './aiPlannerQuickStart';\nimport { travelRegionOptions } from './aiTravelDraft';\nimport { PhotoCredit } from './PublicTourismCredit';")
s=s.replace('export function AiPlannerSheet(', '''function PlannerDisclosure({ icon, label, children }: {icon:ReactNode;label:string;children:ReactNode}) {
  return <details className="ai-planner-details"><summary>{icon}<span>{label}</span><ChevronDown className="ai-planner-chevron" size={16}/></summary><div className="ai-planner-disclosure-body">{children}</div></details>;
}

export function AiPlannerSheet(''')
s=s.replace("  const [preview,setPreview]", "  const [advanced,setAdvanced]=useState(false);\n  const [preview,setPreview]")
s=s.replace("  const regions=[...new Set(places.filter(p=>p.kind==='LANDMARK'&&!p.personal).map(p=>p.area.split(' ')[0]))];", "  const regions=travelRegionOptions(places.filter(p=>p.kind==='LANDMARK'&&!p.personal));\n  const quickPrompt=(prompt:string)=>change(readQuickPlannerPrompt(prompt,conditions,places));")
s=s.replace("    if(pending.current||saving.current)return;", "    if(pending.current||saving.current)return;\n    if(conditions.mode==='region'&&!conditions.region){setAdvanced(true);setError(locale==='en'?'Add a destination to your request or choose a region below.':'문장에 여행 지역을 적거나 아래에서 지역만 선택해 주세요.');return;}", 1)
s=s.replace("setBusinessKind(conditions.suggestFood?'FOOD':'STAY')", "setBusinessKind('FOOD')")
start=s.index('  const anchor=selectedAnchors.find')
end=s.index('  const save=()=>',start)
s=s[:start]+'''  const businessPool=[...new Map([...places,...savedPlaces].map(p=>[p.id,p])).values()];
  const businessCandidates=dayBusinessSuggestions(anchorId?selectedAnchors.filter(p=>p.visitId===anchorId):selectedAnchors,businessPool,businessKind,businessMode==='saved'?new Set(savedPlaces.map(p=>p.id)):undefined,businessMode==='search'?search:'');
'''+s[end:]
s=s.replace('hint={say("입력한 단어와 등록 설명을 비교해요. 자세한 조건은 아래에서 직접 정할 수 있어요.")}', 'hint={locale===\'en\'?"Describe your destination and trip length. Adjust the draft afterwards.":"지역과 기간을 적으면 초안을 먼저 만들어요. 세부 조건은 나중에 바꿔도 돼요."}')
s=s.replace('placeholder={say("바다를 보며 천천히 여행하고 싶어요.")}', 'placeholder={locale===\'en\'?"Jeju, 2 nights and 3 days, a relaxed seaside trip.":"제주 2박 3일, 바다를 보며 천천히 여행하고 싶어요."}')
s=s.replace('onChange={e=>change({prompt:e.target.value})}', 'onChange={e=>quickPrompt(e.target.value)}')
start=s.index('      <div className="ai-travel-conditions">')
s=s[:start]+'''      <div className="ai-planner-readback" aria-live="polite"><span><MapPin size={14}/>{conditions.mode==='saved'?say('저장 장소로 추천'):conditions.region||(locale==='en'?'Destination needed':'지역을 알려주세요')}</span><span><CalendarDays size={14}/>{period(conditions.dayCount,locale)}</span></div>
      {error&&<p className="ui-error" role="alert">{say(error)}</p>}
      <Button loading={busy} onClick={generate}><Sparkles size={16}/>{say("여행 초안 만들기")}</Button>
      {busy&&<Button size="compact" variant="ghost" className="ai-planner-cancel" onClick={cancel}>{say("생성 취소 · 입력 유지")}</Button>}
      <Button size="compact" variant="secondary" className="ai-planner-settings-toggle" aria-expanded={advanced} aria-controls="ai-planner-preferences" onClick={()=>setAdvanced(value=>!value)}><SlidersHorizontal size={16}/>{locale==='en'?'Adjust preferences · optional':'세부 조건 조정 · 선택'}<ChevronDown size={16}/></Button>
      {advanced&&<div id="ai-planner-preferences" className="ai-planner-preferences">
'''+s[start:]
for label,icon in [('날짜·이동·여행 속도','CalendarDays'),('필수·제외·고정 장소','MapPin'),('동행·식사·접근성','Users')]:
    s=s.replace(f'<details className="ai-planner-details"><summary>{{say("{label}")}}</summary>',f'<PlannerDisclosure icon={{<{icon} size={{16}}/>}} label={{say("{label}")}}>')
start=s.index('      <div className="ai-planner-option-group">')
end=s.index('    </div>:<div className="ai-travel-preview">', start)
s=s[:start]+'      </div>}\n'+s[end:]
# The three retained optional preference groups now use a styled disclosure header.
form_end=s.index('    </div>:<div className="ai-travel-preview">')
s=s[:form_end].replace('</details>','</PlannerDisclosure>')+s[form_end:]
s=s.replace('<button className="ai-planner-back" onClick={()=>{cancel();setPreview(null);setError(\'\');}}>', '<Button size="compact" variant="secondary" className="ai-planner-back" onClick={()=>{cancel();setPreview(null);setError(\'\');}}>')
s=s.replace('{say("조건 바꾸기")}</button>', '{say("조건 바꾸기")}</Button>')
s=s.replace("'선택한 장소를 확인하고 내 여행에 저장해요.'", "'장소는 이미 일정에 담았어요. 그대로 저장하거나 필요한 곳만 바꿔보세요.'")
start=s.index('      {(conditions.suggestFood||conditions.suggestStay)')
end=s.index('      <details className="ai-planner-details"><summary>{say("추천 근거',start)
s=s[:start]+s[end:]
# Candidate suggestions are open, above the tall landmark cards, and default to all included anchors of the DAY.
at=s.index('      <div className="ui-stack">{day?.places.map')
business='''      <section className="ai-planner-business-section" aria-label={say("음식점·숙소 보완하기")}>
        <div className="ai-planner-section-heading"><h4>{locale==='en'?'Along this day’s route':'이날 함께 들를 곳'}</h4><span>{locale==='en'?'Optional':'선택 사항'}</span></div>
        <div className="ai-planner-tabs"><button aria-pressed={businessKind==='FOOD'} onClick={()=>setBusinessKind('FOOD')}><Utensils size={14}/>{say("음식점")}</button><button aria-pressed={businessKind==='STAY'} onClick={()=>setBusinessKind('STAY')}><BedDouble size={14}/>{say("숙소")}</button></div>
        <p className="ai-planner-note">{locale==='en'?'Registered samples within 15 km of this day’s landmarks. Add only what you like.':'이날 랜드마크 주변 15km 이내 등록 샘플이에요. 마음에 드는 곳만 담으세요.'}</p>
        <PlannerDisclosure icon={<SlidersHorizontal size={16}/>} label={locale==='en'?'Filter or search candidates':'후보 필터·검색'}><div className="ui-stack">
          <Field label={say("기준 랜드마크")}><select value={anchorId} onChange={e=>setAnchorId(e.target.value)}><option value="">{locale==='en'?'All landmarks on this day':'이날 랜드마크 전체'}</option>{selectedAnchors.map(p=><option key={p.visitId} value={p.visitId}>{p.name}</option>)}</select></Field>
          <div className="ai-planner-tabs">{([['recommended','주변 후보'],['saved','저장한 업체'],['search','직접 검색']] as const).map(([mode,label])=><button key={mode} aria-pressed={businessMode===mode} onClick={()=>setBusinessMode(mode)}>{say(label)}</button>)}</div>
          {businessMode==='search'&&<Field label={say("등록 업체 검색")}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={say("업체명·주소")}/></Field>}
        </div></PlannerDisclosure>
        {businessKind==='STAY'&&selectedDay<conditions.dayCount&&<Field label={say("숙박 기간")}><select value={nights} onChange={e=>setNights(Number(e.target.value))}>{Array.from({length:conditions.dayCount-selectedDay},(_,i)=><option key={i} value={i+1}>{i+1}{locale==='en'?' nights':'박'}</option>)}</select></Field>}
        {businessKind==='STAY'&&selectedDay===conditions.dayCount?<p className="ai-planner-empty"><BedDouble size={20}/>{say("당일 여행과 마지막 DAY에는 숙박을 추가하지 않아요.")}</p>:!businessCandidates.length?<p className="ai-planner-empty"><MapPin size={20}/>{locale==='en'?'No registered candidates match this day or filter yet. Your trip can still be saved; add or register a business from My trips.':'이날 주변 또는 선택한 필터에 맞는 등록 후보가 아직 없어요. 여행은 그대로 저장하고 내 여행에서 업체를 추가·직접 등록할 수 있어요.'}</p>:businessCandidates.map(({place,anchor,km})=>{
          const selected=businesses.some(choice=>choice.dayId===day?.dayId&&choice.place.id===place.id);
          return <article className="ai-planner-business" key={place.id}>
            <div className="ai-planner-business-media">{place.image?<img src={place.image} alt=""/>:<Utensils size={24}/>}<PhotoCredit image={place.image}/></div>
            <div className="ai-planner-business-copy"><strong>{place.name}</strong><p>{anchor.name} · {locale==='en'?'straight line':'직선'} {km<1?`${Math.round(km*1000)}m`:`${km.toFixed(1)}km`}</p><p>{place.description}</p><Button size="compact" variant="secondary" aria-pressed={selected} onClick={()=>{if(!day?.dayId||!anchor.visitId)return;setBusinesses(current=>selected?current.filter(choice=>!(choice.dayId===day.dayId&&choice.place.id===place.id)):[...current.filter(choice=>!(place.kind==='STAY'&&choice.place.kind==='STAY')),{dayId:day.dayId!,anchorId:anchor.visitId!,place,nights}]);}}>{selected?<Check size={14}/>:<Plus size={14}/>}{locale==='en'?(selected?'Added':'Add to day'):(selected?'담김':'일정에 담기')}</Button></div>
          </article>;
        })}
      </section>
      <div className="ai-planner-section-heading"><h4>{locale==='en'?'Your landmarks':'추천 랜드마크'}</h4><span>{locale==='en'?'Already included':'일정에 포함됨'}</span></div>
'''
s=s[:at]+business+s[at:]
s=s.replace('<details className="ai-planner-details"><summary>{say("추천 근거·확인할 내용")}</summary>', '<PlannerDisclosure icon={<Info size={16}/>} label={say("추천 근거·확인할 내용")}>')
s=s.replace('</details>','</PlannerDisclosure>')
s=s.replace('<Button onClick={save}>','<div className="ai-planner-save"><Button onClick={save}>').replace("{say('곳')}</Button>\n    </div>","{say('곳')}</Button></div>\n    </div>")
p.write_text(s,encoding='utf-8')
