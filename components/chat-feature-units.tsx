'use client';
import {
  ArrowRight,
  Check,
  CircleHelp,
  GitCompareArrows,
  History,
  Info,
  ListChecks,
  MapPin,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  comparisonRows,
  budgetSummary,
  itineraryChecks,
  chatEntityDetail,
  chatHelpGroups,
} from '@/lib/trip-chat-features';
import { findFood, findPlace, money, period, scenarios } from '@/lib/trip-data';
import type { TripAction, TripSession, TripState } from '@/lib/trip-engine';
import type { OpenBusiness } from '@/components/business-detail';
import { businessDetails } from '@/lib/business-details';
import { BusinessContentSection, BusinessPhotoSection } from './business-content';
import { PlanEditControls, TripLibraryManager } from './trip-edit-controls';
import { RegisteredPhotoGallery } from './registered-photo-gallery';
import { EntityShareControls } from './trip-share-controls';
import { EntityPhotoSourceButton } from './photo-source-modal';
import { SavedPlaceReferences, RecentTripEntry, type OpenSavedTripDay } from './trip-local-features';

type Props = {
  state: TripState;
  session: TripSession;
  act: (action: TripAction) => void;
  onFullDetail: OpenBusiness;
  onEntityDetail: (id: string, state: TripState) => void;
  onOpenSavedDay: OpenSavedTripDay;
};
function Title({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tr-unit-heading">
      <span>
        <Icon size={16} />
        {label}
      </span>
      <div>
        <h2>{children}</h2>
      </div>
    </div>
  );
}
export function ChatFeatureUnits({
  state,
  session,
  act,
  onFullDetail,
  onEntityDetail,
  onOpenSavedDay,
}: Props) {
  if (state.stage === 'compare') {
    const rows = comparisonRows(state);
    return (
      <section className="tr-unit tr-chat-comparison">
        <Title icon={GitCompareArrows} label="같은 조건에서 비교">
          어느 쪽이 더 맞을까요?
        </Title>
        {rows.length ? (
          <div className="tr-comparison-scroll">
            <table>
              <caption className="sr-only">후보 가격·위치·분위기 비교</caption>
              <thead>
                <tr>
                  <th scope="col">비교 항목</th>
                  {rows.map((r) => (
                    <th scope="col" key={r.id}>
                      <img src={r.image} alt="" />
                      <strong>{r.name}</strong>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">가격</th>
                  {rows.map((r) => (
                    <td key={r.id}>
                      <b>{r.price}</b>
                      <small>{r.priceLabel}</small>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">위치·이동</th>
                  {rows.map((r) => (
                    <td key={r.id}>
                      {r.location}
                      <small>{r.walk}</small>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">분위기·특징</th>
                  {rows.map((r) => (
                    <td key={r.id}>{r.features.join(' · ')}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">한눈에 보기</th>
                  {rows.map((r) => (
                    <td key={r.id}>{r.description}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">더 알아보기</th>
                  {rows.map((r) => (
                    <td key={r.id}>
                      <button onClick={() => onEntityDetail(r.id, state)}>
                        {r.name} 상세
                      </button>
                      <button
                        className="tr-compare-select"
                        onClick={() => act({ type: 'select-entity', id: r.id })}
                      >
                        이곳 선택 <ArrowRight size={13} />
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tr-empty-copy">
            장소·식당·카페·숙소 후보를 찾은 뒤 “이 두 곳 비교해줘”라고
            말해보세요.
          </p>
        )}
        <p className="tr-feature-note">
          등록 업체는 주소와 대표 좌표의 직선거리를 비교하며 현재 가격·영업·이동시간은 미확인입니다. 체험 업체의 가격·분위기·도보 시간은 예시예요.
        </p>
      </section>
    );
  }
  if (state.stage === 'budget') {
    const b = budgetSummary(state);
    const partLabel = (kind: 'food' | 'cafe' | 'stay', total: number) =>
      b.lines.some(line => line.category === kind) ? money(total)
        : state.plan.some(visit => visit.kind === kind && visit.status !== 'skipped') ? '가격 미확인' : '항목 없음';
    return (
      <section className="tr-unit">
        <Title icon={Wallet} label="알려진 가격만 합산">
          여행 비용을 살펴볼까요?
        </Title>
        <div className="tr-cost-total">
          <small>
            {b.people}명 · {b.rooms}객실 기준 예시 합계
          </small>
          <strong>{b.totalLabel}</strong>
        </div>
        <div className="tr-cost-parts">
          <span>
            식사 <b>{partLabel('food', b.foodTotal)}</b>
          </span>
          <span>
            카페 <b>{partLabel('cafe', b.cafeTotal)}</b>
          </span>
          <span>
            숙박 <b>{partLabel('stay', b.stayTotal)}</b>
          </span>
        </div>
        <div className="tr-feature-options">
          <button onClick={() => act({ type: 'budget', people: 1 })}>
            1명
          </button>
          <button onClick={() => act({ type: 'budget', people: 2 })}>
            2명
          </button>
          <button onClick={() => act({ type: 'budget', people: 4 })}>
            4명
          </button>
          <button
            onClick={() =>
              act({ type: 'budget', rooms: b.rooms === 1 ? 2 : 1 })
            }
          >
            {b.rooms === 1 ? '2객실로 계산' : '1객실로 계산'}
          </button>
        </div>
        {b.lines.length ? (
          <ul className="tr-feature-list">
            {b.lines.map((l) => (
              <li key={l.visitId}>
                <div>
                  <strong>{l.name}</strong>
                  <small>
                    {l.basis} · {money(l.unitPrice)}
                  </small>
                </div>
                <b>{money(l.amount)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tr-empty-copy">
            {b.hasUnpricedItems?'등록 업체의 현재 가격이 미확인이어서 전체 여행 예산을 계산할 수 없어요. 무료라는 의미가 아닙니다.':'계산할 가격이 확인된 식사·숙박 항목이 없어요.'}
          </p>
        )}
        {b.excluded.length > 0 && (
          <details className="tr-feature-excluded">
            <summary>합계에 포함하지 않은 {b.excluded.length}개 항목</summary>
            <ul>
              {b.excluded.map((x) => (
                <li key={x.visitId}>
                  {x.name}
                  <small>{x.reason}</small>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="tr-feature-note">{b.note}</p>
        <Button
          variant="outline"
          className="tr-primary"
          onClick={() => act({ type: 'show', stage: 'plan' })}
        >
          일정으로 돌아가기
        </Button>
      </section>
    );
  }
  if (state.stage === 'check') {
    const checks = itineraryChecks(state);
    return (
      <section className="tr-unit">
        <Title icon={ListChecks} label="항목과 조건 점검">
          일정에서 확인할 것들
        </Title>
        <ul className="tr-check-list">
          {checks.map((c) => (
            <li
              key={c.id}
              className={c.level === 'warning' ? 'is-warning' : ''}
            >
              <div>
                {c.level === 'warning' ? (
                  <Info size={17} />
                ) : (
                  <Check size={17} />
                )}
                <strong>{c.title}</strong>
              </div>
              <p>{c.description}</p>
              {c.visitId && c.focus==='time' && <PlanEditControls state={state} act={act} disabled={false} focusVisitId={c.visitId} compact/>}
              {c.visitId &&
                c.focus!=='time' && !state.plan.find((v) => v.id === c.visitId)?.locked && (
                  <button onClick={() => act({ type: 'edit', id: c.visitId! })}>
                    이 항목의 후보 보기 <ArrowRight size={13} />
                  </button>
                )}
              {c.day && !c.visitId && (
                <button onClick={() => act({ type: 'day', day: c.day! })}>
                  DAY {c.day} 보기
                </button>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="tr-primary"
          onClick={() => act({ type: 'show', stage: 'plan' })}
        >
          전체 일정 보기
        </Button>
      </section>
    );
  }
  if (state.stage === 'detail') {
    const d = chatEntityDetail(state);
    if (!d)
      return (
        <section className="tr-unit">
          <Title icon={Info} label="상세정보">
            어느 곳을 살펴볼까요?
          </Title>
          <p className="tr-empty-copy">
            후보 이름이나 “첫 번째 식당 메뉴 보여줘”처럼 알려주세요.
          </p>
        </section>
      );
    const place = findPlace(d.id);
    const business = place ? null : businessDetails({ kind: findFood(d.id) ? 'food' : 'stay', id: d.id });
    return (
      <section className="tr-unit tr-chat-detail">
        {business?.registered ? <BusinessPhotoSection details={business}/>
          : d.registered ? <RegisteredPhotoGallery key={d.id} photos={d.photos} name={d.name}/>
          : <><img className="tr-chat-detail-photo" src={d.image} alt={d.imageAlt} /><EntityPhotoSourceButton entityId={d.id} image={d.image} name={d.name}/></>}
        <Title icon={Info} label={`${d.kind} 상세정보`}>
          {d.name}
        </Title>
        <p className="tr-feature-description">{d.headline}</p>
        <div className="tr-business-tags">
          {d.features.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <dl className="tr-chat-detail-facts">
          {!business?.content && <div>
            <dt>가격 기준</dt>
            <dd>
              {d.price}
              <small>{d.priceLabel}</small>
            </dd>
          </div>}
          <div>
            <dt>운영 정보</dt>
            <dd>{d.hours}</dd>
          </div>
          <div>
            <dt>위치</dt>
            <dd>{d.location}</dd>
          </div>
          {d.room && (
            <div>
              <dt>객실</dt>
              <dd>{d.room}</dd>
            </div>
          )}
        </dl>
        {business?.content ? <BusinessContentSection details={business}/> : d.menu.length > 0 && (
          <ul className="tr-feature-list">
            {d.menu.map((m) => (
              <li key={m.name}>
                <span>{m.name}</span>
                <b>{money(m.price)}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="tr-feature-note">
          {place ? d.check : d.registered ? '등록 정보의 확인일 기준입니다. 현재 메뉴·영업시간·요금은 업체에서 확인해 주세요.' : '업체 사진·메뉴·운영정보·가격은 가상 예시예요.'}
        </p>
        <EntityShareControls id={d.id}/>
        {!place && (
          <Button
            variant="outline"
            className="tr-primary"
            onClick={() =>
              onFullDetail(
                { kind: findFood(d.id) ? 'food' : 'stay', id: d.id },
                state,
              )
            }
          >
            시설과 방문 정보 더 보기
          </Button>
        )}
        <Button
          className="tr-primary"
          onClick={() => act({ type: 'select-entity', id: d.id })}
        >
          이곳으로 선택 <ArrowRight size={15} />
        </Button>
        {place && (
          <Button
            variant="outline"
            className="tr-primary"
            onClick={() => act({ type: 'directions', placeId: d.id })}
          >
            길찾기 보기
          </Button>
        )}
      </section>
    );
  }
  if (state.stage === 'trash') return <section className="tr-unit"><Title icon={History} label="삭제한 내 여행">여행 휴지통</Title><TripLibraryManager session={session} state={state} act={act} trash/></section>;
  if (state.stage === 'library') {
    const library = (state.librarySnapshot ?? session.library).filter(p=>!p.deletedAt);
    return (
      <section className="tr-unit">
        <Title icon={History} label="이 브라우저에 보관">
          찜한 장소와 내 여행
        </Title>
        <RecentTripEntry session={session} act={act}/>
        <SavedPlaceReferences session={session} state={state} act={act} onEntityDetail={onEntityDetail} onOpenDay={onOpenSavedDay}/>
        <h3 className="tr-sheet-heading">
          저장한 여행 <span>{library.length}</span>
        </h3>
        <TripLibraryManager session={session} state={state} act={act}/>
        <Button variant="outline" className="tr-primary" onClick={()=>act({type:'offline-library'})}>오프라인 여행 사본 보기</Button>
        <p className="tr-feature-note">
          실제 Spotlog 계정과 동기화하기 전인 기기별 체험 저장본입니다.
        </p>
      </section>
    );
  }
  if (state.stage === 'history') {
    const history =
      state.historySnapshot ??
      session.turns
        .filter((t) => t.state.question)
        .map((t) => ({ id: t.id, question: t.state.question }));
    return (
      <section className="tr-unit">
        <Title icon={History} label="이전 결과에서 이어가기">
          이어온 대화
        </Title>
        <div className="tr-history">
          {history.length ? (
            history.map((t, i) => (
              <button
                key={t.id}
                onClick={() => act({ type: 'resume', id: t.id })}
              >
                <span>{i + 1}번째 대화</span>
                <strong>{t.question}</strong>
                <small>이 결과에서 이어가기</small>
              </button>
            ))
          ) : (
            <p className="tr-empty-copy">아직 이어갈 대화가 없어요.</p>
          )}
        </div>
      </section>
    );
  }
  if (state.stage === 'help') {
    return (
      <section className="tr-unit tr-chat-help">
        <Title icon={CircleHelp} label="말하면 기능으로 이어져요">
          이렇게 물어보세요
        </Title>
        <p className="tr-feature-description">
          예시를 눌러 바로 질문하거나, 장소 이름과 DAY를 바꿔서 말해보세요.
        </p>
        <div className="tr-help-group">
          <h3>둘러보고 이어서 하기</h3>
          <button onClick={() => act({ type: 'community-filter', contentType: 'all', query: '', days: null, authorId: null })}>공개 코스 · 작성자 · 여행기<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'media', mode: 'photos' })}>장소 사진 둘러보기<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'saved-filter', region: null })}>찜과 담긴 여행 보기<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'continue-trip' })}>최근 저장 여행 이어가기<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'offline-library' })}>오프라인 사본<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'open_spotlog', target: 'community', entry: 'place-reaction' })}>장소 카드 좋아요 창<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'open_spotlog', target: 'community', entry: 'journey-comment' })}>여행기 전체 댓글<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'open_spotlog', target: 'community', entry: 'journey-cheer' })}>여행기 응원 창<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'open_spotlog', target: 'profile', entry: 'profile-summary' })}>내 프로필·등급<ArrowRight size={14} /></button>
          <button onClick={() => act({ type: 'open_spotlog', target: 'profile', entry: 'profile-activity' })}>내 기기 활동<ArrowRight size={14} /></button>
        </div>
        {chatHelpGroups.map((g) => (
          <div className="tr-help-group" key={g.title}>
            <h3>{g.title}</h3>
            {g.examples.map((q) => (
              <button key={q} onClick={() => act({ type: 'message', text: q })}>
                {q}
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        ))}
        <div className="tr-help-group">
          <h3>처음부터 이어가는 여행</h3>
          {scenarios.slice(0, 5).map((sc) => (
            <button
              key={sc.id}
              onClick={() => act({ type: 'message', text: sc.prompt })}
            >
              {sc.title}
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
        <p className="tr-feature-note">
          제주·서울·부산·경주·강릉의 등록 자료와 체험 예시를 구분합니다. 실제 AI가 질문을 해석하며 예약·결제·실시간 영업 정보는 연결 전이에요.
        </p>
      </section>
    );
  }
  return null;
}
