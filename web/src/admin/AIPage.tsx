import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Database, Pause, Play, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import type { AdminPageProps } from './types';
import type { AiChannel, AiFeedback, AiFixtureInput, AiPolicy, AiPolicyInput, AiTestFixture, AiTestResult } from './aiTypes';
import { approvedDocuments, effectiveIndexDocuments, indexActivationErrors, validateAiPolicy } from './aiDomain';
import { Badge, EmptyState, Field, Notice, Panel, Tabs, formatTime, kindLabel } from './components';
import { useReviewDraft } from './useReviewDraft';
import { safeExternalUrl } from '../serviceRequest';

const channelLabel: Record<AiChannel, string> = { SIMPLE: '간단 생성', SAVED: '저장 장소 추천', REVISION: '부분 수정', GUIDE: '관광 안내', CHATBOT: '챗봇 후속' };
const jobLabel = { QUEUED: '대기', RUNNING: '실행 중', VALIDATION_PENDING: '검증 대기', APPLIED: '적용 완료', FAILED: '실패' };
const indexLabel = { CANDIDATE: '후보', VERIFIED: '검증 완료', ACTIVE: '현재 적용', ARCHIVED: '이전 정상', FAILED: '검증 실패' };
const policyLabel = { DRAFT: '초안', TESTED: '규칙 검수 완료', ACTIVE: '현재 적용', ARCHIVED: '이전 정상' };
const scenarioLabel = { NORMAL: '정상', MISSING_DATA: '근거 부족', CONNECTION_FAILURE: '연결 장애', MODEL_FORMAT: '소형 출력 형식 오류', STALE_REVISION: '오래된 여행 버전' };
const slotLabel = { MORNING: '오전', LUNCH: '점심', AFTERNOON: '오후', DINNER: '저녁', LODGING: '숙박' };
const tabs = [{ id: 'documents', label: '검색 자료' }, { id: 'indices', label: '색인 작업' }, { id: 'tests', label: '품질 시험' }, { id: 'requests', label: '요청 현황' }, { id: 'policies', label: '실행 정책' }];

function policyInput(policy: AiPolicy): AiPolicyInput {
  const { label, smallLocalProfile, embeddingProfile, externalProfile, flowiseProfile, promptVersion, regions, channels, externalEnabled, externalMaxCalls, timeoutMs, externalBudgetKrw } = policy;
  return structuredClone({ label, smallLocalProfile, embeddingProfile, externalProfile, flowiseProfile, promptVersion, regions, channels, externalEnabled, externalMaxCalls, timeoutMs, externalBudgetKrw });
}
function fixtureInput(fixture: AiTestFixture): AiFixtureInput {
  const { title, prompt, channel, region, dayCount, includeFood, includeStay, expectedPlaceIds, scenario } = fixture;
  return structuredClone({ title, prompt, channel, region, dayCount, includeFood, includeStay, expectedPlaceIds, scenario });
}
function displayAiLabel(value: string, id: string): string {
  if (id === 'policy-local-1' && value === '소형 로컬 우선 · 검수용') return '소형 LLM 우선';
  if (id === 'idx-local-empty' && value === '검수용 초기 색인 · 자료 0건') return '초기 색인 · 자료 0건';
  return id.startsWith('idx-') && /^(전체 재구성|자료 제거|문서 갱신) · 검수용$/.test(value) ? value.replace(' · 검수용', '') : value;
}
const emptyFixture = (): AiFixtureInput => ({ title: '', prompt: '', channel: 'SIMPLE', region: '서울', dayCount: 1, includeFood: true, includeStay: false, expectedPlaceIds: [], scenario: 'NORMAL' });
function SourceLink({ url, children }: { url: string; children: string }) {
  const safe = safeExternalUrl(url);
  return safe ? <a href={safe} target="_blank" rel="noreferrer">{children}</a> : <span className="admin-meta">출처 URL 확인 필요</span>;
}

export default function AIPage(props: AdminPageProps) {
  const { state, session, run, busy, mode } = props;
  const [tab, setTab] = useReviewDraft(mode, session.operatorId, 'ai-navigation', 'page', 'documents');
  const [jobFilter,setJobFilter] = useState('');
  useEffect(() => { if (props.entryAction === 'failed-indices') { setTab('indices'); setJobFilter('FAILED'); props.clearEntryAction?.(); } }, [props.entryAction]);
  const admin = session.role === 'ADMIN';
  const documents = approvedDocuments(state);
  const effective = effectiveIndexDocuments(state);
  return <div className="admin-stack">
    <div className="admin-toolbar">
      <div className="admin-actions"><Badge tone={state.ai.paused ? 'warning' : 'neutral'}>{state.ai.paused ? '생성 일시 중지 설정' : '생성 정책 준비'}</Badge><span className="admin-muted">공개 근거 {documents.length}건 · 현재 색인 유효 {effective.length}건</span></div>
      <button type="button" disabled={!admin || busy} title={!admin ? '최고관리자 권한 필요' : undefined} onClick={() => void run({ kind: 'ai.pause', paused: !state.ai.paused })}>{state.ai.paused ? <Play size={16}/> : <Pause size={16}/>} {state.ai.paused ? '생성 재개 설정' : '생성 일시 중지'}</button>
    </div>
    <Tabs items={tabs} value={tab} onChange={value => { setJobFilter(''); setTab(value); }}/>
    {tab === 'documents' && <DocumentsTab {...props} onIndex={() => setTab('indices')}/>}
    {tab === 'indices' && <IndicesTab {...props} jobFilter={jobFilter} setJobFilter={setJobFilter}/>}
    {tab === 'tests' && <TestsTab {...props}/>}
    {tab === 'requests' && <RequestsTab {...props} onTests={() => setTab('tests')}/>}
    {tab === 'policies' && <PoliciesTab {...props}/>}
  </div>;
}

function DocumentsTab({ state, run, navigate, busy, onIndex, mode }: AdminPageProps & { onIndex: () => void }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const indexed = new Map(effectiveIndexDocuments(state).map(ref => [ref.placeId, ref]));
  const docs = approvedDocuments(state).filter(({ content, place }) => `${content.name} ${content.area} ${content.ai.tags.join(' ')} ${place.placeId}`.toLowerCase().includes(query.toLowerCase()) && (scope !== 'pending' || !indexed.has(place.placeId)));
  const rejected = state.places.filter(place => !approvedDocuments(state).some(doc => doc.place.placeId === place.placeId));
  return <div className="admin-stack">
    <Panel title="승인된 검색 설명" description="공개본의 AI 사용 허용·출처·확인일·좌표·영업 상태를 통과한 자료만 표시합니다. 수정은 장소 상세의 AI 자료에서 진행합니다." actions={<button onClick={onIndex}>색인 작업 보기</button>}>
      <div className="admin-toolbar"><Field label="장소·지역·태그 검색"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="장소명 또는 placeId"/></Field><Field label="반영 상태"><select value={scope} onChange={event => setScope(event.target.value)}><option value="all">전체 승인 자료</option><option value="pending">색인 반영 필요</option></select></Field></div>
      {docs.length ? <div className="admin-list">{docs.map(({ place, content, ref }) => <article className="admin-list-row" key={place.placeId}>
        <div><div className="admin-actions"><strong>{content.name}</strong><Badge>{kindLabel[content.kind]}</Badge><Badge tone={indexed.has(place.placeId) ? 'success' : 'warning'}>{indexed.has(place.placeId) ? '색인 반영' : '반영 필요'}</Badge></div><p>{content.ai.text}</p><div className="admin-meta">{place.placeId} · 원문 v{ref.version} · {content.area} · {content.ai.provider || '제공자 미입력'} · 확인 {content.ai.checkedAt}</div><div className="admin-meta">검색 태그 {content.ai.tags.join(' · ') || '없음'} · 영어 {content.guide.englishStatus === 'REVIEWED' ? '검수 완료' : '미반영'}</div><SourceLink url={content.ai.sourceUrl}>자료 출처 확인</SourceLink></div>
        <div className="admin-actions"><button onClick={() => navigate('places', place.placeId)}>장소에서 수정</button><button disabled={busy} onClick={() => void run({ kind: 'ai.index.queue', mode: 'DOCUMENT', placeId: place.placeId })}><RefreshCw size={16}/> 재색인 대기</button></div>
      </article>)}</div> : <EmptyState title="조건에 맞는 승인 자료가 없어요" description="장소의 공개·좌표·AI 사용 범위·검색 설명·출처를 확인해 주세요." action={<button onClick={() => navigate('places')}>장소·업체 관리</button>}/>}
    </Panel>
    <Panel title={`검색 제외 자료 ${rejected.length}건`} description="초안·비활성·폐업·좌표 미검수·AI 사용권 미확인 자료는 추천과 RAG에서 제외합니다.">
      {rejected.length ? <div className="admin-list">{rejected.map(place => <div className="admin-list-row" key={place.placeId}><div><strong>{place.draft.name || '이름 없는 초안'}</strong><div className="admin-meta">{place.placeId} · {place.revoked ? '사용권 철회' : place.state === 'DRAFT' ? '미공개 초안' : place.state === 'INACTIVE' ? '비활성' : '영업·좌표·AI 자료 검수 필요'}</div></div><button onClick={() => navigate('places', place.placeId)}>검수하기</button></div>)}</div> : <p className="admin-muted">모든 자료가 승인 조건을 통과했습니다.</p>}
    </Panel>
  </div>;
}

function IndicesTab({ state, session, run, busy, mode, jobFilter, setJobFilter }: AdminPageProps & { jobFilter: string; setJobFilter: (value: string) => void }) {
  const [embedding, setEmbedding] = useState(state.ai.policies.find(policy => policy.policyId === state.ai.activePolicyId)?.embeddingProfile || '');
  const admin = session.role === 'ADMIN';
  return <div className="admin-stack">
    {!jobFilter && <Panel title="후보 색인 만들기" description="자료 변경은 해당 문서 재색인, 임베딩 변경은 전체 후보 색인 검증 후 적용합니다.">
      <div className="admin-toolbar"><Field label="임베딩 연결 이름"><input value={embedding} onChange={event => setEmbedding(event.target.value)}/></Field><button className="admin-primary" disabled={busy || !embedding.trim()} onClick={() => void run({ kind: 'ai.index.queue', mode: 'FULL', embeddingProfile: embedding })}><Database size={16}/> 전체 재구성 대기</button></div>
    </Panel>}
    <Panel title="작업 목록" description="실패 재시도와 후보 검증을 진행해도 현재 적용 색인은 유지됩니다.">
      <Field label="색인 작업 상태"><select value={jobFilter} onChange={event => setJobFilter(event.target.value)}><option value="">모든 작업</option>{Object.entries(jobLabel).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
      {state.ai.jobs.filter(job => !jobFilter || job.state === jobFilter).length ? <div className="admin-list">{state.ai.jobs.filter(job => !jobFilter || job.state === jobFilter).map(job => <article className="admin-list-row" key={job.jobId}>
        <div><div className="admin-actions"><strong>{job.mode === 'FULL' ? '전체 재구성' : job.mode === 'REMOVAL' ? '자료 제거' : '문서 갱신'}</strong><Badge tone={job.state === 'FAILED' ? 'danger' : job.state === 'APPLIED' ? 'success' : 'warning'}>{jobLabel[job.state]}</Badge></div><div className="admin-meta">{job.jobId} · {job.placeId || '전체 공개 자료'} · 시도 {job.attempts}회 · {formatTime(job.updatedAt)}</div>{job.error && <p className="admin-danger">{job.error}</p>}</div>
        <div className="admin-actions">{['QUEUED', 'RUNNING'].includes(job.state) && <><button disabled={busy || (mode === 'API' && job.state === 'RUNNING')} title={mode === 'API' && job.state === 'RUNNING' ? '서버에서 실행 중입니다. 상태를 갱신해 확인하세요.' : undefined} onClick={() => void run({ kind: 'ai.index.run', jobId: job.jobId })}>{job.localSimulation ? job.state === 'QUEUED' ? '실행 시작' : '실행 완료 단계' : '실행 시작'}</button>{mode === 'LOCAL' && <button disabled={busy} onClick={() => void run({ kind: 'ai.index.run', jobId: job.jobId, simulateFailure: true })}>실패 시나리오</button>}</>}{job.state === 'FAILED' && <button disabled={busy} onClick={() => void run({ kind: 'ai.index.retry', jobId: job.jobId })}>현재 자료로 재시도</button>}{job.state === 'VALIDATION_PENDING' && state.ai.indices.find(index => index.indexId === job.indexId)?.state === 'CANDIDATE' && <button disabled={busy} onClick={() => void run({ kind: 'ai.index.verify', indexId: job.indexId })}>자료·사용권 검증</button>}</div>
      </article>)}</div> : <EmptyState title="색인 작업이 없어요" description="전체 재구성 대기를 추가하거나 장소의 AI 자료를 공개해 시작하세요."/>}
    </Panel>
    <Panel title="색인 버전" description="최고관리자가 검증된 버전을 적용합니다. 이전 버전 복구 후에도 철회·폐업·원문 변경 자료는 현재 DB 검증에서 제외됩니다.">
      <div className="admin-list">{state.ai.indices.map(index => {
        const effective = effectiveIndexDocuments(state, index.indexId);
        const activationErrors = index.state === 'VERIFIED' ? indexActivationErrors(state, index.indexId) : [];
        const job = state.ai.jobs.find(value => value.indexId === index.indexId);
        return <article className="admin-list-row" key={index.indexId}>
          <div>
            <div className="admin-actions"><strong>{displayAiLabel(index.label, index.indexId)}</strong><Badge tone={index.state === 'ACTIVE' ? 'success' : index.state === 'FAILED' ? 'danger' : 'neutral'}>{indexLabel[index.state]}</Badge></div>
            <div className="admin-meta">{index.indexId} · {index.embeddingProfile} · 스냅샷 {index.documents.length}건 · 현재 유효 {effective.length}건 · {formatTime(index.createdAt)}</div>
            {index.validationErrors.length > 0 && <p className="admin-danger">{index.validationErrors.join(' / ')}</p>}
            {activationErrors.length > 0 && <Notice tone="warning">검증 뒤 자료나 현재 색인이 바뀌어 적용을 보류합니다. {activationErrors.join(' / ')}</Notice>}
            {index.state === 'ARCHIVED' && index.documents.length > effective.length && <p className="admin-muted">현재 철회·상태·원문 검증으로 {index.documents.length - effective.length}건 제외</p>}
          </div>
          <div className="admin-actions">
            {index.state === 'VERIFIED' && <button className="admin-primary" disabled={busy || !admin || activationErrors.length > 0} title={!admin ? '최고관리자 권한 필요' : activationErrors.length ? '현재 자료로 다시 준비한 뒤 실행·검증하세요.' : undefined} onClick={() => void run({ kind: 'ai.index.activate', indexId: index.indexId })}><ShieldCheck size={16}/> 적용</button>}
            {activationErrors.length > 0 && job?.state === 'VALIDATION_PENDING' && <button disabled={busy} onClick={() => void run({ kind: 'ai.index.retry', jobId: job.jobId })}><RefreshCw size={16}/> 현재 자료로 다시 준비</button>}
            {index.state === 'ARCHIVED' && <button disabled={busy || !admin} title={!admin ? '최고관리자 권한 필요' : undefined} onClick={() => void run({ kind: 'ai.index.rollback', indexId: index.indexId })}><RotateCcw size={16}/> 이전 버전 복구</button>}
          </div>
        </article>;
      })}</div>
    </Panel>
  </div>;
}

function TestsTab({ state, session, run, navigate, busy, mode }: AdminPageProps) {
  const [fixtureId, setFixtureId] = useReviewDraft(mode, session.operatorId, 'ai-fixture-selection', 'page', state.ai.fixtures[0]?.fixtureId || '');
  const selectedFixture = state.ai.fixtures.find(value => value.fixtureId === fixtureId);
  const initialFixture = selectedFixture ? fixtureInput(selectedFixture) : emptyFixture();
  const [editorDraft, setEditorDraft, clearEditorDraft] = useReviewDraft(mode, session.operatorId, 'ai-fixture', fixtureId || 'new', { fixture: initialFixture, expectedIdText: initialFixture.expectedPlaceIds.join(', '), baseRevision: selectedFixture?.revision ?? null });
  const input = editorDraft.fixture;
  const [policyId, setPolicyId] = useState(state.ai.activePolicyId);
  const [indexId, setIndexId] = useState(state.ai.activeIndexId);
  const [compareId, setCompareId] = useState('');
  const [category, setCategory] = useState<AiFeedback['category']>('GROUNDING');
  const [note, setNote] = useState('');
  const [validation, setValidation] = useState('');
  const result = state.ai.results.find(value => value.fixtureId === fixtureId);
  const comparison = state.ai.results.find(value => value.resultId === compareId);
  const dirty = selectedFixture ? JSON.stringify(input) !== JSON.stringify(fixtureInput(selectedFixture)) : true;
  const chooseFixture = (id: string) => { setFixtureId(id); setValidation(''); };
  const update = <K extends keyof AiFixtureInput>(key: K, value: AiFixtureInput[K]) => setEditorDraft(previous => ({ ...previous, fixture: { ...previous.fixture, [key]: value } }));
  const reloadFixture = () => {
    if (!selectedFixture) return;
    const latest = fixtureInput(selectedFixture);
    setEditorDraft({ fixture: latest, expectedIdText: latest.expectedPlaceIds.join(', '), baseRevision: selectedFixture.revision });
    clearEditorDraft(); setValidation('현재 저장된 시험 조건을 불러왔습니다.');
  };
  const save = async () => {
    if (!input.title.trim() || !input.prompt.trim() || !input.region.trim()) { setValidation('시험 이름·운영자 작성 문장·지역을 입력해 주세요.'); return; }
    const success = await run({ kind: 'ai.fixture.save', fixtureId: fixtureId || undefined, fixture: input, entityRevision: editorDraft.baseRevision ?? undefined });
    if (success) { setEditorDraft(previous => ({ ...previous, baseRevision: selectedFixture ? selectedFixture.revision + 1 : null })); clearEditorDraft(); setValidation('시험 조건을 저장했습니다.'); }
  };
  return <div className="admin-stack">
    {selectedFixture && editorDraft.baseRevision !== selectedFixture.revision && <Notice tone="warning">보존된 입력은 v{editorDraft.baseRevision} 기준이고 현재 저장본은 v{selectedFixture.revision}입니다. 입력을 비교한 후 현재 저장본을 불러오세요. <button onClick={reloadFixture}>현재 시험 저장본 불러오기</button></Notice>}
    <div className="admin-grid-2">
      <Panel title="운영자 시험집" actions={<button onClick={() => chooseFixture('')}>새 시험</button>}>
        <div className="admin-list">{state.ai.fixtures.map(fixture => <button className={'admin-list-row ' + (fixtureId === fixture.fixtureId ? 'selected' : '')} key={fixture.fixtureId} onClick={() => chooseFixture(fixture.fixtureId)}><div><strong>{fixture.title}</strong><div className="admin-meta">{channelLabel[fixture.channel]} · {fixture.region} · {scenarioLabel[fixture.scenario]} · v{fixture.revision}</div></div></button>)}</div>
      </Panel>
      <Panel title={fixtureId ? '시험 조건 편집' : '새 시험'}>
        <div className="admin-stack"><Field label="시험 이름"><input value={input.title} onChange={event => update('title', event.target.value)}/></Field><Field label="시험 문장"><textarea rows={3} value={input.prompt} placeholder="고객 개인정보 없이 작성하세요." maxLength={4000} onChange={event => update('prompt', event.target.value)}/></Field><div className="admin-form-grid"><Field label="시험 기능"><select value={input.channel} onChange={event => update('channel', event.target.value as AiChannel)}>{Object.entries(channelLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="지역"><input value={input.region} onChange={event => update('region', event.target.value)}/></Field><Field label="기간"><input type="number" min={1} max={7} value={input.dayCount} onChange={event => update('dayCount', Number(event.target.value))}/></Field><Field label="오류 시나리오"><select value={input.scenario} onChange={event => update('scenario', event.target.value as AiFixtureInput['scenario'])}>{Object.entries(scenarioLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div><div className="admin-actions"><label className="admin-check"><input type="checkbox" checked={input.includeFood} onChange={event => update('includeFood', event.target.checked)}/> 식사 포함</label><label className="admin-check"><input type="checkbox" checked={input.includeStay} onChange={event => update('includeStay', event.target.checked)}/> 숙박 포함</label></div><Field label="기대 장소 ID · 쉼표로 구분"><input value={editorDraft.expectedIdText} onChange={event => setEditorDraft(previous => ({ ...previous, expectedIdText: event.target.value, fixture: { ...previous.fixture, expectedPlaceIds: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } }))}/></Field>{validation && <Notice>{validation}</Notice>}<button disabled={busy} onClick={() => void save()}>시험 조건 저장</button></div>
      </Panel>
    </div>
    <Panel title="실행·버전 비교" description="정책·색인 버전별 결과 비교">
      <div className="admin-toolbar"><Field label="정책 버전"><select value={policyId} onChange={event => setPolicyId(event.target.value)}>{state.ai.policies.map(policy => <option value={policy.policyId} key={policy.policyId}>v{policy.version} · {displayAiLabel(policy.label, policy.policyId)}</option>)}</select></Field><Field label="색인 버전"><select value={indexId} onChange={event => setIndexId(event.target.value)}>{state.ai.indices.filter(index => ['ACTIVE', 'VERIFIED', 'ARCHIVED'].includes(index.state)).map(index => <option value={index.indexId} key={index.indexId}>{displayAiLabel(index.label, index.indexId)}</option>)}</select></Field><button className="admin-primary" disabled={busy || !fixtureId || dirty} title={dirty ? '시험 조건을 먼저 저장하세요.' : undefined} onClick={() => void run({ kind: 'ai.fixture.run', fixtureId, policyId, indexId })}><Play size={16}/> 시험 실행</button></div>{dirty && <p className="admin-muted">변경한 조건을 저장한 뒤 시험하세요.</p>}
      <Field label="비교할 이전 결과"><select value={compareId} onChange={event => setCompareId(event.target.value)}><option value="">이전 결과 선택</option>{state.ai.results.filter(value => value.fixtureId === fixtureId && value.resultId !== result?.resultId).map(value => <option key={value.resultId} value={value.resultId}>{formatTime(value.createdAt)} · {value.outcome} · {value.policyId} / {value.indexId}</option>)}</select></Field>
    </Panel>
    {result ? <div className={comparison ? 'admin-grid-2' : 'admin-stack'}><TestResultCard result={result} navigate={navigate}/>{comparison && <TestResultCard result={comparison} navigate={navigate}/>}</div> : <EmptyState title="이 시험의 결과가 없어요" description="시험 조건을 저장하고 실행하세요."/>}
    {result && <Panel title="오답·평가 기록" ><div className="admin-toolbar"><Field label="오류 유형"><select value={category} onChange={event => setCategory(event.target.value as AiFeedback['category'])}><option value="GROUNDING">근거 불일치</option><option value="MISSING_PLACE">장소 누락</option><option value="WRONG_ORDER">방문 순서</option><option value="REVISION">부분 수정·버전</option><option value="OTHER">기타</option></select></Field><Field label="평가 내용"><input value={note} onChange={event => setNote(event.target.value)} placeholder="운영자 평가 내용"/></Field><button disabled={busy || !note.trim()} onClick={async () => { if (await run({ kind: 'ai.feedback.add', resultId: result.resultId, category, note })) setNote(''); }}>평가 등록</button></div><div className="admin-list">{state.ai.feedback.filter(feedback => state.ai.results.some(value => value.resultId === feedback.resultId && value.fixtureId === fixtureId)).map(feedback => <div className="admin-list-row" key={feedback.feedbackId}><div><strong>{feedback.note}</strong><div className="admin-meta">{feedback.category} · {formatTime(feedback.createdAt)} · {feedback.state === 'OPEN' ? '미처리' : '처리 완료'}</div></div>{feedback.state === 'OPEN' && <button disabled={busy} onClick={() => void run({ kind: 'ai.feedback.resolve', feedbackId: feedback.feedbackId })}>처리 완료</button>}</div>)}</div></Panel>}
    <Panel title="후속 챗봇 연결" description="장소 질문·추천 → 장소 카드 → 고객 선택 찜 → 일정 초안 → 특정 DAY 수정 흐름을 기존 생성·수정 계약으로 연결합니다."><div className="admin-actions"><Badge tone="warning">고객 채널 비활성</Badge><button disabled title="고객 챗봇 UI·세션·서버 도구 연결은 후속 단계입니다.">고객 챗봇 열기 · 준비 중</button><button onClick={() => chooseFixture('fixture-chatbot')}>대화 시험 선택</button></div></Panel>
  </div>;
}

function TestResultCard({ result, navigate }: { result: AiTestResult; navigate: AdminPageProps['navigate'] }) {
  return <Panel title={<span className="admin-actions">시험 결과 <Badge tone={result.outcome === 'PASS' ? 'success' : result.outcome === 'BLOCKED' ? 'warning' : 'danger'}>{result.outcome === 'PASS' ? result.localSimulation ? '조건 통과' : '평가 통과' : result.outcome === 'BLOCKED' ? '보류' : '실패'}</Badge></span>} description={<span>{formatTime(result.createdAt)} · 시험 v{result.fixtureRevision} · {result.policyId} · {result.indexId}</span>}>
    <div className="admin-list">{result.checks.map(check => <div className="admin-list-row" key={check.label}><div className="admin-actions">{check.passed ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}<div><strong>{check.label}</strong><div className="admin-meta">{check.detail}</div></div></div><Badge tone={check.passed ? 'success' : 'danger'}>{check.passed ? '통과' : '확인 필요'}</Badge></div>)}</div>
    {result.visits.length > 0 && <div className="admin-list">{result.visits.map(visit => <div className="admin-list-row" key={visit.visitId}><div><span className="admin-meta">DAY {visit.day} · {slotLabel[visit.slot]} · {kindLabel[visit.kind]} </span><strong>{visit.name}</strong>{visit.bookingFixed && <Badge>예약 고정</Badge>}</div><button onClick={() => navigate('places', visit.placeId)}>공용 근거</button></div>)}</div>}
    {result.originalVisits.length > 0 && <div className="admin-meta">부분 수정 전 {result.originalVisits.length}개 → 제안 {result.visits.length}개 방문 · 삭제 제안: {result.originalVisits.filter(original => !result.visits.some(next => next.visitId === original.visitId)).map(visit => `DAY ${visit.day} ${slotLabel[visit.slot]} ${visit.name}`).join(', ') || '없음'}</div>}
    {result.guideEvidence?.map(evidence => <div key={evidence.placeId} className="admin-list-row"><div><Badge>관광 안내 근거</Badge><p>{evidence.text}</p>{evidence.english && <p lang="en">{evidence.english}</p>}<SourceLink url={evidence.sourceUrl}>공개 안내 출처</SourceLink></div></div>)}
    {result.messages.length > 0 && <div className="admin-list">{result.messages.map((message, index) => <div className="admin-list-row" key={index}><div><Badge>{message.role === 'USER' ? '시험 문장' : '응답'}</Badge><p>{message.text}</p></div></div>)}</div>}
    <div className="admin-meta">외부 호출 {result.externalCalls}회 · {result.externalReason}</div>
    <div className="admin-meta">요청 기준 revision {result.expectedRevision} → 제안 revision {result.proposedRevision} · {result.errorCode}</div>
  </Panel>;
}

function RequestsTab({ state, navigate, onTests, mode }: AdminPageProps & { onTests: () => void }) {
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const requests = useMemo(() => state.ai.requests.filter(value => value.requestId.includes(query) && (channel === 'all' || value.channel === channel) && (status === 'all' || value.state === status)), [state.ai.requests, query, channel, status]);
  const selected = state.ai.requests.find(value => value.requestId === selectedId);
  return <div className="admin-stack"><Panel title="요청 처리 요약"><div className="admin-toolbar"><Field label="요청 ID 검색"><input value={query} onChange={event => setQuery(event.target.value)}/></Field><Field label="채널"><select value={channel} onChange={event => setChannel(event.target.value)}><option value="all">전체</option>{Object.entries(channelLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="상태"><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">전체</option><option value="SUCCESS">성공</option><option value="FAILED">실패</option><option value="PENDING">대기</option></select></Field></div>
    {requests.length ? <div className="admin-list">{requests.map(request => <button className={'admin-list-row ' + (request.requestId === selectedId ? 'selected' : '')} key={request.requestId} onClick={() => setSelectedId(request.requestId)}><div><strong>{channelLabel[request.channel]}</strong><div className="admin-meta">{request.requestId} · {request.stage} · {formatTime(request.createdAt)}</div><div className="admin-meta">{request.modelProfile}</div></div><div className="admin-actions"><Badge tone={request.localSimulation ? 'sample' : 'neutral'}>{request.localSimulation ? '시험 기록' : '서비스 요청'}</Badge><Badge tone={request.state === 'SUCCESS' ? 'success' : request.state === 'PENDING' ? 'warning' : 'danger'}>{request.state === 'SUCCESS' ? request.localSimulation ? '조건 통과' : '실행 성공' : request.state === 'FAILED' ? request.localSimulation ? '조건 실패·보류' : '실행 실패' : '대기'}</Badge></div></button>)}</div> : <EmptyState title="조건에 맞는 요청이 없어요" description="품질 시험을 실행하면 요약 기록을 확인할 수 있습니다." action={<button onClick={onTests}>품질 시험으로 이동</button>}/>}
  </Panel>{selected && <Panel title="선택한 요청 요약"><dl className="admin-meta"><dt>요청 ID</dt><dd>{selected.requestId}</dd><dt>오류·실패 단계</dt><dd>{selected.errorCode} · {selected.stage}</dd><dt>정책 / 색인</dt><dd>{selected.policyId} / {selected.indexId}</dd><dt>응답 시간 / 외부 비용</dt><dd>{selected.latencyMs === null ? '실측 없음' : `${selected.latencyMs}ms`} / {selected.externalCostKrw === null ? '실측 없음' : `${selected.externalCostKrw}원`}</dd><dt>보완 판단</dt><dd>{selected.fallbackReason}</dd></dl><div className="admin-actions">{selected.sourcePlaceIds.map(placeId => <button key={placeId} onClick={() => navigate('places', placeId)}>공용 근거 {placeId}</button>)}<button onClick={onTests}>오류 시험집 확인</button></div></Panel>}</div>;
}

function PoliciesTab({ state, session, run, busy, mode }: AdminPageProps) {
  const active = state.ai.policies.find(value => value.policyId === state.ai.activePolicyId)!;
  const [selectedId, setSelectedId] = useReviewDraft(mode, session.operatorId, 'ai-policy-selection', 'page', active.policyId);
  const selected = state.ai.policies.find(value => value.policyId === selectedId);
  const initialPolicy = selected || active;
  const [editorDraft, setEditorDraft, clearEditorDraft] = useReviewDraft(mode, session.operatorId, 'ai-policy', selectedId, { policy: policyInput(initialPolicy), regionText: initialPolicy.regions.join(', '), baseVersion: initialPolicy.version });
  const input = editorDraft.policy;
  const regionText = editorDraft.regionText;
  const setRegionText = (value: string) => setEditorDraft(previous => ({ ...previous, regionText: value }));
  const admin = session.role === 'ADMIN';
  const errors = validateAiPolicy(input);
  const dirty = !selected || JSON.stringify(input) !== JSON.stringify(policyInput(selected));
  const choose = (policy: AiPolicy) => { setSelectedId(policy.policyId); };
  const update = <K extends keyof AiPolicyInput>(key: K, value: AiPolicyInput[K]) => setEditorDraft(previous => ({ ...previous, policy: { ...previous.policy, [key]: value } }));
  const reloadPolicy = () => {
    if (!selected) return;
    setEditorDraft({ policy: policyInput(selected), regionText: selected.regions.join(', '), baseVersion: selected.version });
    clearEditorDraft();
  };
  const savePolicy = async () => {
    if (await run({ kind: 'ai.policy.save', policyId: selectedId, policy: input, entityRevision: editorDraft.baseVersion })) {
      if (selected?.state === 'DRAFT') setEditorDraft(previous => ({ ...previous, baseVersion: Math.max(...state.ai.policies.map(policy => policy.version)) + 1 }));
      clearEditorDraft();
    }
  };
  return <div className="admin-stack">{!admin && <Notice>운영자는 정책을 조회하고 품질 시험을 실행할 수 있습니다. 정책 저장·적용·복구·연결 한도 변경에는 최고관리자 권한이 필요합니다.</Notice>}
    {selected && editorDraft.baseVersion !== selected.version && <Notice tone="warning">보존된 입력은 v{editorDraft.baseVersion} 기준이고 현재 저장본은 v{selected.version}입니다. 입력을 비교한 후 현재 저장본을 불러오세요. <button onClick={reloadPolicy}>현재 정책 저장본 불러오기</button></Notice>}
    <div className="admin-grid-2"><Panel title="정책 버전" description="수정은 새 초안으로 저장합니다. 검수와 적용 전까지 현재 정책을 유지합니다."><div className="admin-list">{state.ai.policies.map(policy => <button className={'admin-list-row ' + (selectedId === policy.policyId ? 'selected' : '')} key={policy.policyId} onClick={() => choose(policy)}><div><strong>v{policy.version} · {displayAiLabel(policy.label, policy.policyId)}</strong><div className="admin-meta">{policy.smallLocalProfile} · {policy.promptVersion}</div></div><Badge tone={policy.state === 'ACTIVE' ? 'success' : 'neutral'}>{policyLabel[policy.state]}</Badge></button>)}</div></Panel>
    <Panel title="연결·실행 정책" description="API 키와 비밀번호는 서버에서 관리합니다. 여기에는 연결 이름과 사용 조건만 입력합니다."><fieldset disabled={!admin || busy} className="admin-stack"><Field label="정책 이름"><input value={displayAiLabel(input.label, selected?.policyId ?? '')} onChange={event => update('label', event.target.value)}/></Field><div className="admin-form-grid"><Field label="소형 로컬 모델 연결 이름"><input value={input.smallLocalProfile} onChange={event => update('smallLocalProfile', event.target.value)}/></Field><Field label="임베딩 모델 연결 이름"><input value={input.embeddingProfile} onChange={event => update('embeddingProfile', event.target.value)}/></Field><Field label="Flowise 연결 이름"><input value={input.flowiseProfile} onChange={event => update('flowiseProfile', event.target.value)}/></Field><Field label="외부 대형 모델 연결 이름"><input value={input.externalProfile} onChange={event => update('externalProfile', event.target.value)}/></Field><Field label="프롬프트 버전"><input value={input.promptVersion} onChange={event => update('promptVersion', event.target.value)}/></Field><Field label="사용 지역 · 쉼표 구분"><input value={regionText} onChange={event => { setRegionText(event.target.value); update('regions', event.target.value.split(',').map(value => value.trim()).filter(Boolean)); }}/></Field></div><div className="admin-actions">{(['SIMPLE', 'SAVED', 'REVISION', 'GUIDE'] as AiChannel[]).map(channel => <label className="admin-check" key={channel}><input type="checkbox" checked={input.channels.includes(channel)} onChange={event => update('channels', event.target.checked ? [...input.channels, channel] : input.channels.filter(value => value !== channel))}/>{channelLabel[channel]}</label>)}<label className="admin-check"><input type="checkbox" disabled checked={false}/>챗봇 · 준비 중</label></div><label className="admin-check"><input type="checkbox" checked={input.externalEnabled} onChange={event => update('externalEnabled', event.target.checked)}/>근거가 충분한 소형 모델 실패에 외부 보완 허용</label><div className="admin-form-grid"><Field label="요청 전체 외부 보완 한도 · 최대 1회"><input type="number" min={0} max={1} value={input.externalMaxCalls} onChange={event => update('externalMaxCalls', Number(event.target.value))}/></Field><Field label="시간 제한 · ms"><input type="number" min={1} value={input.timeoutMs ?? ''} onChange={event => update('timeoutMs', event.target.value ? Number(event.target.value) : null)} placeholder="외부 사용 시 필수"/></Field><Field label="요청 외부 비용 상한 · 원"><input type="number" min={1} value={input.externalBudgetKrw ?? ''} onChange={event => update('externalBudgetKrw', event.target.value ? Number(event.target.value) : null)} placeholder="외부 사용 시 필수"/></Field></div></fieldset>{errors.length > 0 && <Notice tone="warning">{errors.join(' / ')}</Notice>}{selected?.validationErrors.length ? <Notice tone="warning">최근 규칙 검수: {selected.validationErrors.join(' / ')}</Notice> : null}<div className="admin-actions"><button disabled={busy || !admin} onClick={() => void savePolicy()}>{selected?.state === 'DRAFT' ? '초안 저장' : '새 정책 초안 저장'}</button>{selected && ['DRAFT', 'TESTED'].includes(selected.state) && <button disabled={busy || !admin || dirty} title={dirty ? '변경 내용을 먼저 저장해 주세요.' : undefined} onClick={() => void run({ kind: 'ai.policy.test', policyId: selected.policyId })}>규칙 검증</button>}{selected?.state === 'TESTED' && <button className="admin-primary" disabled={busy || !admin || dirty} onClick={() => void run({ kind: 'ai.policy.activate', policyId: selected.policyId })}>검수 정책 적용</button>}{selected?.state === 'ARCHIVED' && <button disabled={busy || !admin || dirty} onClick={() => void run({ kind: 'ai.policy.rollback', policyId: selected.policyId })}>이전 정책 복구</button>}</div>{dirty && <p className="admin-meta">편집값은 저장·검수·적용 단계가 끝나기 전 현재 정책에 반영되지 않습니다.</p>}</Panel></div>
    <Panel title="실행 원칙"><div className="admin-list">{[['소형 로컬 LLM', '기본 조건 해석·근거 설명'], ['임베딩·RAG', '승인 설명 검색 · PostgreSQL 원본과 분리'], ['Flowise', '내부 실행 도구 · 연결 상태는 운영 설정에서 확인'], ['외부 대형 보완', '근거 충분 + 모델 형식·해석·설명 실패 + 요청 전체 1회 + 시간·비용 제한'], ['차단 상황', '입력·자료·좌표 부족, 지도·맥미니·DB 장애, 오래된 여행 버전은 외부 우회 금지']].map(([title, description]) => <div className="admin-list-row" key={title}><div><strong>{title}</strong><p>{description}</p></div><Badge>운영 규칙</Badge></div>)}</div></Panel>
  </div>;
}
