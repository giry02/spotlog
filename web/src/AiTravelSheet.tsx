import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { Button, Field } from './ui';
import type { Journey, Place } from './data';
import { interpretTravelPrompt, localTravelDraftProvider, travelRegionOptions, type TravelConditions, type TravelDraftResult, type TravelPace, type TravelTransport } from './aiTravelDraft';
import { aiTravelVisitKey, selectAiTravelVisits } from './aiTravelSelection';
import './ai-travel.css';

export interface AiTravelSheetProps {
  initialPrompt?: string;
  places: Place[];
  onClose: () => void;
  onCreate: (draft: Journey) => string | null;
}
const paceLabels: Record<TravelPace, string> = { slow: '여유롭게', balanced: '적당히', full: '알차게' };
const transportLabels: Record<TravelTransport, string> = { undecided: '미정', walk: '도보', transit: '대중교통', car: '자동차' };
const periodLabel = (days: number) => days === 1 ? '당일치기' : `${days - 1}박 ${days}일`;

export function AiTravelSheet({ initialPrompt = '', places, onClose, onCreate }: AiTravelSheetProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [overrides, setOverrides] = useState<Partial<Pick<TravelConditions, 'region' | 'dayCount' | 'pace' | 'transport'>>>({});
  const [preview, setPreview] = useState<TravelDraftResult | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [excludedVisits, setExcludedVisits] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const activeDay = useRef<HTMLElement>(null);
  const interpreted = useMemo(() => interpretTravelPrompt({ prompt, overrides }, places), [prompt, overrides, places]);
  const regionOptions = useMemo(() => travelRegionOptions(places), [places]);
  const selectedJourney = useMemo(() => preview?.journey ? selectAiTravelVisits(preview.journey, excludedVisits) : null, [preview, excludedVisits]);
  const selectedPlaceCount = selectedJourney?.days.reduce((total, day) => total + day.places.length, 0) ?? 0;
  const conditions = interpreted.conditions;
  const generate = async () => {
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const result = await localTravelDraftProvider.generate({ prompt, overrides }, places);
      if (result.errors.length || !result.journey) { setError(result.errors.join(' ')); return; }
      setSelectedDay(result.journey.days[0]?.day ?? 1);
      setExcludedVisits(new Set());
      setPreview(result);
      window.setTimeout(() => resultHeading.current?.focus(), 0);
    } catch { setError('초안을 만들지 못했어요. 입력한 내용은 유지되니 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const save = () => {
    if (!selectedJourney || saving.current) return;
    if (!selectedPlaceCount) { setError('여행에 포함할 장소를 한 곳 이상 선택해 주세요.'); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      if (!onCreate(structuredClone(selectedJourney))) { setError('여행을 저장하지 못했어요. 초안을 유지했으니 저장 공간을 확인한 뒤 다시 시도해 주세요.'); saving.current = false; setBusy(false); }
      else onClose();
    } catch { setError('여행을 저장하지 못했어요. 초안은 닫지 않고 유지했어요.'); saving.current = false; setBusy(false); }
  };
  const toggleVisit = (visitKey: string) => {
    if (busy) return;
    setExcludedVisits((current) => {
      const next = new Set(current);
      if (next.has(visitKey)) next.delete(visitKey); else next.add(visitKey);
      return next;
    });
    setError('');
  };
  return <BottomSheet title={preview ? '여행 초안 미리보기' : 'AI 여행 만들기'} description="로컬 추천 미리보기 · 외부 AI 미연결" onClose={onClose}>
    <div className="ai-travel-sheet">
      {!preview ? <form className="ai-travel-form" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
        <Field label="어떤 여행을 하고 싶으세요?" hint="지역·기간·취향을 적으면 등록된 장소에서 골라요. 실제 AI 답변이 아닌 조건 기반 미리보기예요.">
          <textarea rows={4} maxLength={1000} value={prompt} placeholder="부산에서 1박 2일, 바다를 보고 싶어요. 카페는 빼고 많이 걷지 않았으면 좋겠어요." onChange={(event) => { setPrompt(event.target.value); setOverrides({}); setError(''); }} />
        </Field>
        {!prompt && <button type="button" className="phase-search-reset ai-travel-example" onClick={() => setPrompt('부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.')}>예시 문장 넣기 <ChevronRight size={14} /></button>}
        <div className="ai-travel-conditions">
          <Field label="여행 지역"><select value={conditions.region} onChange={(event) => { setOverrides({ ...overrides, region: event.target.value }); setError(''); }}><option value="">지역 선택</option>{regionOptions.map((region) => <option value={region} key={region}>{region}</option>)}</select></Field>
          <Field label="여행 기간"><select value={conditions.dayCount >= 1 && conditions.dayCount <= 7 ? conditions.dayCount : ''} onChange={(event) => { setOverrides({ ...overrides, dayCount: Number(event.target.value) }); setError(''); }}><option value="" disabled>기간 선택</option>{Array.from({ length: 7 }, (_, index) => index + 1).map((days) => <option value={days} key={days}>{periodLabel(days)}</option>)}</select></Field>
          <Field label="여행 속도"><select value={conditions.pace} onChange={(event) => setOverrides({ ...overrides, pace: event.target.value as TravelPace })}>{Object.entries(paceLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>
          <Field label="이동수단 · 경로 검증 전"><select value={conditions.transport} onChange={(event) => setOverrides({ ...overrides, transport: event.target.value as TravelTransport })}>{Object.entries(transportLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>
        </div>
        {(conditions.interests.length > 0 || conditions.excludedKinds.length > 0 || conditions.excludedThemes.length > 0) && <p className="ai-travel-readback" aria-live="polite">{conditions.interests.length > 0 && <span>관심: {conditions.interests.join(' · ')}</span>}{(conditions.excludedKinds.length > 0 || conditions.excludedThemes.length > 0) && <span>제외: {[...conditions.excludedKinds.map((kind) => ({ CAFE: '카페', FOOD: '음식점', STAY: '숙소', SHOP: '쇼핑', LANDMARK: '랜드마크' })[kind]), ...conditions.excludedThemes].join(' · ')}</span>}</p>}
        {interpreted.notices.map((notice) => <p className="phase-hint" key={notice}>{notice}</p>)}
        {error && <p className="ui-error" role="alert">{error}</p>}
        <Button type="submit" loading={busy} disabled={!prompt.trim()}><Sparkles size={17} />초안 만들기</Button>
      </form> : <div className="ai-travel-preview">
        <button className="phase-search-reset ai-travel-back" onClick={() => { setPreview(null); setError(''); }} disabled={busy}><ArrowLeft size={16} />조건 바꾸기</button>
        <h3 ref={resultHeading} tabIndex={-1}>{preview.journey?.title}</h3>
        <p className="ai-travel-result-meta" aria-live="polite">선택 {selectedPlaceCount}곳 · {periodLabel(preview.conditions.dayCount)} · 경로 검증 전</p>
        <p className="phase-hint">사진과 설명을 보고 가고 싶은 장소만 남겨 주세요. 제외한 장소는 아래 카드에서 다시 포함할 수 있어요.</p>
        <div className="phase-day-options ai-travel-day-options" role="group" aria-label="추천 일정 날짜 선택">
          {preview.journey?.days.map((day) => {
            const count = selectedJourney?.days.find((selected) => selected.day === day.day)?.places.length ?? 0;
            return <button type="button" key={day.day} className={selectedDay === day.day ? 'active' : ''} aria-pressed={selectedDay === day.day} aria-label={`DAY ${day.day}, ${count}곳 선택`} onClick={() => {
              setSelectedDay(day.day);
              window.requestAnimationFrame(() => activeDay.current?.scrollIntoView({ block: 'start' }));
            }}>DAY {day.day}<small>{count}곳</small></button>;
          })}
        </div>
        <div className="ai-travel-days">{preview.journey?.days.map((day) => <section className="ai-travel-day" key={day.day} ref={selectedDay === day.day ? activeDay : undefined} hidden={selectedDay !== day.day} aria-label={`DAY ${day.day} 추천 장소`}>
          <h4>DAY {day.day}<span>{selectedJourney?.days.find((selected) => selected.day === day.day)?.places.length ?? 0}곳 선택 · 후보 {day.places.length}곳</span></h4>
          {day.places.length ? <div className="landmark-guide-list">{day.places.map((place, index) => {
            const visitKey = aiTravelVisitKey(day.day, place, index);
            const included = !excludedVisits.has(visitKey);
            return <LandmarkGuideCard key={visitKey} place={place} actions={<Button size="card" className={included ? 'is-included' : ''} aria-pressed={included} aria-label={`${place.name} ${included ? '선택됨, 이번 초안에서 제외' : '일정에 다시 포함'}`} disabled={busy} onClick={() => toggleVisit(visitKey)}>{included ? <Check size={16} /> : <Plus size={16} />}{included ? '선택됨 · 제외' : '일정에 다시 포함'}</Button>} />;
          })}</div> : <p>장소가 부족해 비워 두었어요. 내 여행에서 추가해 주세요.</p>}
          {day.places.length > 0 && !selectedJourney?.days.find((selected) => selected.day === day.day)?.places.length && <p className="phase-hint" role="status">이 DAY의 장소를 모두 제외했어요. 위 카드에서 다시 포함할 수 있으며 DAY는 그대로 유지돼요.</p>}
        </section>)}</div>
        <details className="ai-travel-notices"><summary>확인할 내용 {preview.notices.length}개</summary><ul>{preview.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul></details>
        <p className="phase-hint">직선거리로 묶은 후보예요. 이동시간·영업시간·사진은 방문 전 확인이 필요해요. 아직 저장되지 않았으며, 아래 버튼을 누르면 선택한 장소만 비공개 내 여행으로 만들어요.</p>
        {!selectedPlaceCount && <p className="phase-hint" role="status">여행에 포함할 장소를 한 곳 이상 선택해 주세요.</p>}
        {error && <p className="ui-error" role="alert">{error}</p>}
        <Button onClick={save} loading={busy} disabled={!selectedPlaceCount}>이 초안으로 내 여행 만들기</Button>
      </div>}
    </div>
  </BottomSheet>;
}
