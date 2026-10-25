'use client';

import { useId, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  MapPin,
  Route,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import {
  communityResults,
  type TripAction,
  type TripState,
} from '@/lib/trip-engine';
import { findPlace, findFood, findStay, period } from '@/lib/trip-data';
import { type CommunityTrip } from '@/lib/community-trips';
import { communityTypeLabel,communityAuthorId,communityAuthorProfile,communityPhoto } from '@/lib/community-discovery';
import { REGIONS } from '@/lib/trip-data';
import { RegisteredPhotoGallery } from './registered-photo-gallery';
import { EntityPhotoSourceButton } from './photo-source-modal';
import { buildSpotlogAppUrl } from '@/lib/spotlog-app-bridge';
import { createCommunityTripPreview } from '@/lib/community-trip-preview';
import { TripMap } from '@/components/trip-map';
import { CommunityVisitAccordion } from './community-visit-accordion';
import { SocialSummary } from './spotlog-social';
import './community-trip-preview.css';
import './community-trips.css';

const visitTitle = (id: string | null) =>
  findPlace(id)?.name ??
  findFood(id)?.name ??
  findStay(id)?.name ??
  '장소 확인 필요';

function CommunityAuthorLink({ trip, onClick }: { trip: CommunityTrip; onClick: () => void }) {
  return (
    <button
      type="button"
      className="tr-community-author-link"
      aria-label={`${trip.author} 작성자 소개`}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <span className="tr-community-author-avatar" aria-hidden="true"><Users size={15} /></span>
      <span className="tr-community-author-name">{trip.author}</span>
      <span className="tr-community-author-more">소개<ChevronRight size={14} aria-hidden="true" /></span>
    </button>
  );
}

export function CommunityUnit({
  state,
  act,
  onPreview,
}: {
  state: TripState;
  act: (action: TripAction) => void;
  onPreview: (trip: CommunityTrip) => void;
}) {
  const results = communityResults(state);
  const searchId=useId();
  const [query,setQuery]=useState(state.communityQuery??'');
  const [authorId,setAuthorId]=useState<string|null>(null);
  const communityRoot=useRef<HTMLElement>(null);
  const [authorContainer,setAuthorContainer]=useState<HTMLElement|null>(null);
  const openAuthor=(id:string)=>{setAuthorContainer(communityRoot.current?.closest<HTMLElement>('[data-spotlog-device]')??null);setAuthorId(id);};
  return (
    <section className="tr-unit tr-community" ref={communityRoot}>
      <div className="tr-unit-heading">
        <span>
          <Users size={15} />
          다른 여행자 코스
        </span>
        <div>
          <h2>다른 코스는 어떻게 짰을까요?</h2>
          <small>{results.length}개</small>
        </div>
      </div>
      <p className="tr-community-intro">
        앱에 포함된 공개 기획과 여행자 코스 형식의 데모를 읽고, 내 여행으로 가져와 바꿔보세요. 실제 회원 게시물이나 인기 순위는 아닙니다.
      </p>
      <form className="tr-community-search" onSubmit={event=>{event.preventDefault();act({type:'community-filter',query:query.trim()});}}><label htmlFor={searchId}>제목·작성자·기간 검색</label><div><input id={searchId} value={query} maxLength={100} onChange={event=>setQuery(event.target.value)} placeholder="예: 경주, 공공자료 가이드, 1박2일"/><button type="submit">검색</button></div></form>
      <div className="tr-pills" aria-label="공개 코스 지역">
        {([null, ...REGIONS] as const).map((region) => (
          <button
            key={region ?? 'all'}
            aria-pressed={(state.communityRegion ?? null) === region}
            onClick={() => act({ type: 'community-filter', region })}
          >
            {region ?? '전체 지역'}
          </button>
        ))}
      </div>
      <div className="tr-pills" aria-label="공개 코스 유형">{([{value:'all',label:'모든 유형'},{value:'traveler',label:'여행자 형식 데모'},{value:'ai',label:'AI 추천 기획'}] as const).map(item=><button key={item.value} aria-pressed={(state.communityType??'all')===item.value} onClick={()=>act({type:'community-filter',contentType:item.value})}>{item.label}</button>)}</div>
      <div className="tr-community-days"><label>여행 기간<select value={state.communityDays??''} onChange={event=>act({type:'community-filter',days:event.target.value?Number(event.target.value):null})}><option value="">모든 기간</option>{Array.from({length:7},(_,i)=><option key={i+1} value={i+1}>{period(i+1)}</option>)}</select></label>{state.communityAuthorId&&<button onClick={()=>act({type:'community-filter',authorId:null})}>작성자 조건 해제</button>}</div>
      <div className="tr-pills" aria-label="공개 코스 취향">
        {(
          [
            { value: 'all', label: '전체 코스' },
            { value: 'sea', label: '바다·풍경' },
            { value: 'green', label: '초록·산책' },
          ] as const
        ).map((theme) => (
          <button
            key={theme.value}
            aria-pressed={(state.communityTheme ?? 'all') === theme.value}
            onClick={() =>
              act({ type: 'community-filter', theme: theme.value })
            }
          >
            {theme.label}
          </button>
        ))}
      </div>
      <p className="tr-meta">
        공개 기획 샘플·데모 프로필 · 실제 회원 게시물·등급·인기 집계 연동 전
      </p>
      <div className="tr-community-list">
        {results.map((trip) => {
          const cover = findPlace(trip.coverPlaceId);
          const stops = trip.visits;
          return (
            <article className="tr-community-card" key={trip.id}>
              <button
                className="tr-community-preview"
                onClick={() => onPreview(trip)}
                aria-label={`${trip.title} 코스 자세히 보기`}
              >
                {cover && (
                  <img
                    src={cover.image}
                    alt={`${cover.name} 풍경`}
                    width={320}
                    height={145}
                    loading="lazy"
                  />
                )}
                <span className="tr-community-copy">
                  <span className="tr-community-card-meta">
                    <span>
                      {trip.region} · {period(trip.days)}
                    </span>
                    <span>{stops.length}곳 방문</span>
                  </span>
                  <span className="tr-community-content-kind">{communityTypeLabel(trip)}</span>
                  <strong>{trip.title}</strong>
                </span>
              </button>
              <div className="tr-community-card-body">
                <CommunityAuthorLink trip={trip} onClick={() => openAuthor(communityAuthorId(trip))} />
                <p className="tr-community-description">{trip.description}</p>
                <div className="tr-community-route">
                    {stops.slice(0, 4).map((visit, i) => (
                      <span key={`${visit.day}-${visit.entityId}`}>
                        {i > 0 && <ChevronRight size={11} />}
                        {visitTitle(visit.entityId)}
                      </span>
                    ))}
                    {stops.length > 4 && <span>외 {stops.length - 4}곳</span>}
                </div>
              </div>
              <div className="tr-community-card-body"><SocialSummary target={{kind:'course',id:trip.id}} compact /></div>
              <div className="tr-community-actions">
                <button onClick={() => onPreview(trip)}>
                  코스 자세히
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => act({ type: 'copy-community', id: trip.id })}
                >
                  <Bookmark size={14} />내 여행으로 가져오기
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <CommunityAuthorSheet authorId={authorId} container={authorContainer} onClose={()=>setAuthorId(null)} onPreview={onPreview} onFilter={id=>act({type:'community-filter',authorId:id})}/>
      {!results.length && (
        <div className="tr-empty">
          <p>이 조건의 코스 예시가 없어요.</p>
          <Button
            variant="outline"
            onClick={() =>
              act({ type: 'community-filter', region: null, theme: 'all',query:'',contentType:'all',days:null,authorId:null })
            }
          >
            전체 코스 보기
          </Button>
        </div>
      )}
      {state.plan.length > 0 && (
        <button
          className="tr-text-link"
          onClick={() => act({ type: 'show', stage: 'plan' })}
        >
          내 일정으로 돌아가기
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}

export function CommunityTripBody({ trip,onPreview }: { trip: CommunityTrip;onPreview?:(trip:CommunityTrip)=>void }) {
  return <CommunityTripDetails key={trip.id} trip={trip} onPreview={onPreview}/>;
}

export function CommunityAuthorPanel({authorId,onClose,onPreview,onFilter,showHeading=true}:{authorId:string;onClose:()=>void;onPreview?:(trip:CommunityTrip)=>void;onFilter?:(authorId:string)=>void;showHeading?:boolean}){
  const profile=communityAuthorProfile(authorId);
  if(!profile)return null;
  return <section className="tr-community-author-panel" aria-label="작성자 소개">{showHeading&&<div><h3>{profile.name}</h3><button onClick={onClose}>소개 닫기</button></div>}<span>{profile.gradeLabel}</span><p>{profile.introduction}</p><small>{profile.gradeNote}</small><h4>이 작성자의 공개 코스</h4>{profile.trips.map(course=>onPreview?<button className="tr-community-author-course" key={course.id} onClick={()=>onPreview(course)}>{course.title} · {period(course.days)}<ChevronRight size={14}/></button>:<p key={course.id}>{course.title} · {period(course.days)}</p>)}{onFilter&&<button onClick={()=>onFilter(authorId)}>이 작성자 코스만 보기</button>}</section>;
}

function CommunityAuthorSheet({authorId,container,onClose,onPreview,onFilter}:{authorId:string|null;container:HTMLElement|null;onClose:()=>void;onPreview?:(trip:CommunityTrip)=>void;onFilter?:(authorId:string)=>void}){
  const profile=authorId?communityAuthorProfile(authorId):undefined;
  return <Dialog open={Boolean(profile)} onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent presentation="bottom-sheet" portalContainer={container??undefined} className="tr-sheet tr-community-author-sheet" showCloseButton={false}>
      <div className="tr-sheet-handle" aria-hidden="true"/>
      <DialogHeader><div className="sheet-title-row"><DialogTitle>{profile?.name??'작성자 소개'}</DialogTitle><Button variant="ghost" size="icon" aria-label="작성자 소개 닫기" onClick={onClose}><X/></Button></div><DialogDescription>프로필의 출처와 같은 작성자의 코스를 확인하세요. 소개를 여닫아도 대화는 추가되지 않아요.</DialogDescription></DialogHeader>
      <div className="sheet-body">{profile&&authorId&&<CommunityAuthorPanel authorId={authorId} onClose={onClose} showHeading={false} onPreview={onPreview?trip=>{onClose();onPreview(trip);}:undefined} onFilter={onFilter?id=>{onClose();onFilter(id);}:undefined}/>}</div>
    </DialogContent>
  </Dialog>;
}

function CommunityTripDetails({ trip,onPreview }: { trip: CommunityTrip;onPreview?:(trip:CommunityTrip)=>void }) {
  const cover = findPlace(trip.coverPlaceId);
  const preview = useMemo(() => createCommunityTripPreview(trip), [trip]);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const visitRows = useRef(new Map<string, HTMLLIElement>());
  const [authorOpen,setAuthorOpen]=useState(false);
  const detailRoot=useRef<HTMLDivElement>(null);
  const [authorContainer,setAuthorContainer]=useState<HTMLElement|null>(null);
  const openAuthor=()=>{setAuthorContainer(detailRoot.current?.closest<HTMLElement>('[data-spotlog-device]')??null);setAuthorOpen(true);};

  function selectVisit(visitId: string) {
    setSelectedVisitId(visitId);
    visitRows.current.get(visitId)?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }

  return (
    <div className="tr-community-detail" ref={detailRoot}>
      {cover?.registered&&cover.photos?<RegisteredPhotoGallery name={cover.name} photos={cover.photos}/>:cover && (
        <><figure className="tr-detail-photo">
          <img
            src={cover.image}
            alt={`${cover.name} 풍경`}
            width={600}
            height={300}
          />
        </figure><EntityPhotoSourceButton entityId={cover.id} image={cover.image} name={cover.name}/></>
      )}
      <div className="tr-community-detail-intro">
        <CommunityAuthorLink trip={trip} onClick={openAuthor} />
        <p>{trip.description}</p>
        <SocialSummary target={{kind:'course',id:trip.id}} />
        <div className="tr-community-detail-meta">
          <span className="tr-community-content-kind">{communityTypeLabel(trip)}</span>
          <div className="tr-business-tags">
            <span>{trip.region}</span>
            <span>{period(trip.days)}</span>
            <span>오전·오후 코스</span>
          </div>
        </div>
        {trip.story&&<details className="tr-community-story"><summary>여행 소개 전체 읽기</summary><p>{trip.story}</p></details>}
      </div>
      <section
        className="tr-community-route-preview"
        aria-label="공개 코스 동선 미리보기"
      >
        <h3>
          <Route size={17} /> 코스 전체 동선
        </h3>
        <p>
          내 여행으로 가져오기 전에 전체 경로를 둘러보세요. 지도에서 장소를
          누르면 아래 방문 일정으로 이동해요.
        </p>
        <TripMap
          state={preview}
          archived
          selectedVisitId={selectedVisitId}
          onSelectVisit={selectVisit}
          onViewDay={() => setSelectedVisitId(null)}
        />
      </section>
      {Array.from({ length: trip.days }, (_, i) => i + 1).map((day) => (
        <section className="tr-community-day" key={day}>
          <h3>DAY {day} · {trip.dayStories?.find(story=>story.day===day)?.title??'방문 코스'}</h3>
          {trip.dayStories?.filter(story=>story.day===day).map(story=><div className="tr-community-day-story" key={story.day}><small>{story.provenance==='app-editorial'?'앱 공개 기획 원문':'직접 작성한 데모 설명'}</small><p>{story.story}</p>{story.blocks.map(block=>block.type==='text'?<section key={block.id}><h4>{block.heading}</h4><p>{block.body}</p></section>:block.type==='photo'?(()=>{const photo=communityPhoto(block.photoId);return photo?<section key={block.id}><RegisteredPhotoGallery name={photo.title} photos={[photo]}/><p className="tr-community-photo-caption">{block.caption}</p></section>:null;})():<button className="tr-community-story-place" key={block.id} onClick={()=>{const row=preview.plan.find(visit=>visit.day===day&&visit.entityId===block.entityId);if(row)selectVisit(row.id);}}><MapPin size={13}/>{visitTitle(block.entityId)} 일정 보기</button>)}</div>)}
          <ol>
            {preview.plan
              .filter((v) => v.day === day)
              .map((visit) => {
                return (
                  <li
                    key={visit.id}
                    ref={(element) => {
                      if (element) visitRows.current.set(visit.id, element);
                      else visitRows.current.delete(visit.id);
                    }}
                    className={`tr-course-visit-row${selectedVisitId === visit.id ? ' is-preview-map-selected' : ''}`}
                    aria-current={
                      selectedVisitId === visit.id ? 'location' : undefined
                    }
                    data-preview-visit-id={visit.id}
                  >
                    <CommunityVisitAccordion visit={visit} courseId={trip.id} visitIndex={preview.plan.findIndex(row=>row.id===visit.id)} />
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
      {trip.notes?.map(note=><p className="tr-detail-caption" key={note}>{note}</p>)}
      {trip.sourceAppId&&<a className="tr-text-link" href={buildSpotlogAppUrl({type:'open_spotlog',target:'share_source',journeyId:trip.sourceAppId})} target="_blank" rel="noreferrer">Spotlog 앱의 같은 공개 기획 열기 <ArrowRight size={14}/></a>}
      <CommunityAuthorSheet authorId={authorOpen?communityAuthorId(trip):null} container={authorContainer} onClose={()=>setAuthorOpen(false)} onPreview={onPreview}/>
    </div>
  );
}
