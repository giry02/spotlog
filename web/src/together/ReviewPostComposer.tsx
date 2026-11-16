import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ImagePlus, MapPin, PenLine, Sparkles, Star, Trash2, X } from 'lucide-react';
import type { Place } from '../data';
import { togetherId, type TogetherPhotoAttachment, type TogetherPost, type TogetherState } from './model';
import { discoveryProfile, isDiscoverableGroup } from './discovery';
import { createFactualReviewDraft, type GroupPostInput, type ReviewDraftFacts } from './groupContent';
import { isSafeTogetherImageUrl, isTogetherPhotoAttachments, MAX_POST_PHOTOS, readTogetherPhoto } from './contentMedia';
import { captureReviewDraft, isReviewDraftCurrent, type ReviewDraftCapture } from './reviewAiDraft';
import { placeExperienceTags } from './businessAssessments';
import { MAX_REVIEW_PLACE_EXPERIENCES, selectReviewExperiencePlaces, validateReviewPlaceExperiences, type ReviewPlaceExperienceDraft } from './reviewPlaceExperience';
import './content-panels.css';

export function TogetherPhotoPicker({ purpose = 'POST', label = '사진 추가', disabled = false, onSelect }: {
  purpose?: 'POST' | 'AVATAR' | 'COVER'; label?: string; disabled?: boolean; onSelect: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  return <div className="tg-photo-picker"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const token = ++generation.current; setBusy(true); setError('');
    try { const url = await readTogetherPhoto(file, purpose); if (generation.current === token) onSelect(url); }
    catch (reason) { if (generation.current === token) setError(reason instanceof Error ? reason.message : '사진을 준비하지 못했어요.'); }
    finally { if (generation.current === token) setBusy(false); }
  }}/><button type="button" className="tg-photo-picker__button" disabled={disabled || busy} onClick={() => input.current?.click()}><ImagePlus size={18}/>{busy ? '사진 준비 중…' : label}</button>{error && <p role="alert" className="tg-error">{error}</p>}</div>;
}

function PostPhoto({ photo }: { photo: TogetherPhotoAttachment }) {
  const [failed, setFailed] = useState(false);
  return <figure>{failed ? <div className="tg-post-photos__failed">사진을 불러오지 못했어요.</div> : <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.caption || '게시글에 첨부한 사진'} loading="lazy" onError={() => setFailed(true)}/></a>}{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>;
}

export function PostPhotoGallery({ attachments }: { attachments?: TogetherPhotoAttachment[] }) {
  const photos = attachments?.filter(item => isSafeTogetherImageUrl(item.url)).slice(0, MAX_POST_PHOTOS) || [];
  return photos.length ? <div className="tg-post-photos">{photos.map(photo => <PostPhoto key={photo.id} photo={photo}/>)}</div> : null;
}

export interface ReviewPostComposerProps {
  state: TogetherState; viewerId: string; groupId: string; activityId?: string; initialCategory?: TogetherPost['category'];
  initialTitle?: string; initialBody?: string; onSubmit: (input: GroupPostInput, experiences?: ReviewPlaceExperienceDraft[]) => boolean;
  places?: Place[];
  onGenerateDraft?: (facts: ReviewDraftFacts, signal: AbortSignal) => Promise<{ title: string; body: string }>;
  onCancel?: () => void;
}
export default function ReviewPostComposer({ state, viewerId, groupId, activityId, initialCategory = 'FREE', initialTitle = '', initialBody = '', onSubmit, places, onGenerateDraft, onCancel }: ReviewPostComposerProps) {
  const [category, setCategory] = useState(initialCategory), [title, setTitle] = useState(initialTitle), [body, setBody] = useState(initialBody);
  const [photos, setPhotos] = useState<TogetherPhotoAttachment[]>([]), [error, setError] = useState(''), [publicReview, setPublicReview] = useState(false), [excerpt, setExcerpt] = useState('');
  const [suggestion, setSuggestion] = useState<{ title: string; body: string; origin: string; capture: ReviewDraftCapture } | null>(null), [generating, setGenerating] = useState(false);
  const experienceOwner = JSON.stringify([viewerId, groupId, activityId || null]);
  const [experienceSelection, setExperienceSelection] = useState<{ owner: string; drafts: ReviewPlaceExperienceDraft[] }>(() => ({ owner: experienceOwner, drafts: [] }));
  const experiences = experienceSelection.owner === experienceOwner ? experienceSelection.drafts : [];
  const photoDraft = useRef(photos); photoDraft.current = photos;
  const controller = useRef<AbortController | null>(null), live = useRef(true), generation = useRef(0);
  const pendingCapture = useRef<ReviewDraftCapture | null>(null);
  const context = { state, viewerId, groupId, activityId, category };
  const latest = useRef(context); latest.current = context;
  const cancelGeneration = () => { generation.current += 1; controller.current?.abort(); controller.current = null; pendingCapture.current = null; setGenerating(false); };
  useEffect(() => { live.current = true; return () => { live.current = false; generation.current += 1; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (pendingCapture.current && !isReviewDraftCurrent(context, pendingCapture.current)) cancelGeneration();
    if (suggestion && !isReviewDraftCurrent(context, suggestion.capture)) setSuggestion(null);
  }, [state, viewerId, groupId, activityId, category]);
  const group = state.groups.find(item => item.id === groupId);
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  const canWrite = Boolean(viewerId && state.members.some(item => item.id === viewerId) && group?.memberIds.includes(viewerId) && !group.blockedMemberIds?.includes(viewerId) && !group.archived && (!activityId || activity && activity.status !== 'CANCELLED'));
  if (!group || !canWrite) return <p>현재 모임원만 이 공간에 글을 남길 수 있어요.</p>;
  const canNotice = group.ownerId === viewerId || group.managerIds.includes(viewerId);
  const scopeName = activity?.title || group.name;
  const visibleSuggestion = suggestion && isReviewDraftCurrent(context, suggestion.capture) ? suggestion : null;
  let experiencePlaces: ReturnType<typeof selectReviewExperiencePlaces> = [];
  try { if (places) experiencePlaces = selectReviewExperiencePlaces(state, viewerId, groupId, places, activityId); } catch { /* Canonical submit returns a readable access/source error. */ }
  const updateExperience = (placeId: string, patch: Partial<ReviewPlaceExperienceDraft>) => {
    setExperienceSelection(current => ({ owner: experienceOwner, drafts: (current.owner === experienceOwner ? current.drafts : []).map(item => item.placeId === placeId ? { ...item, ...patch } : item) }));
    setError('');
  };
  const fillFromFacts = () => { cancelGeneration(); try { const capture = captureReviewDraft(context); const draft = createFactualReviewDraft(capture.facts); setSuggestion({ ...draft, capture, origin: '약속 정보로 만든 작성 틀' }); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : '기록을 확인하지 못했어요.'); } };
  const generate = async () => {
    if (!onGenerateDraft) return;
    cancelGeneration(); const request = new AbortController(), token = ++generation.current; controller.current = request; setGenerating(true); setError('');
    try {
      const capture = captureReviewDraft(context); pendingCapture.current = capture;
      const draft = await onGenerateDraft(capture.facts, request.signal);
      if (request.signal.aborted || !live.current || token !== generation.current || !isReviewDraftCurrent(latest.current, capture)) return;
      if (!draft.title.trim() || draft.title.length > 120 || draft.body.length > 12000) throw new Error('초안 내용을 확인하지 못했어요. 직접 작성해 주세요.');
      setSuggestion({ ...draft, capture, origin: 'AI가 만든 검토용 초안' });
    } catch (reason) { if (!request.signal.aborted && live.current && token === generation.current) setError(reason instanceof Error ? reason.message : '초안을 만들지 못했어요. 직접 작성할 수 있어요.'); }
    finally { if (live.current && token === generation.current) { pendingCapture.current = null; controller.current = null; setGenerating(false); } }
  };
  return <form className="tg-form tg-review-composer" onSubmit={event => { event.preventDefault(); setError('');
    if (!isTogetherPhotoAttachments(photos)) return setError('사진은 4장까지, 저장 용량 합계 2MB 이내로 올려 주세요.');
    if (publicReview && category === 'REVIEW' && !excerpt.trim()) return setError('모임 소개에 공개할 짧은 후기를 적어 주세요.');
    const input = { title, body, category, attachments: photos, ...(publicReview && category === 'REVIEW' && isDiscoverableGroup(group) ? { publicExcerpt: excerpt } : {}) };
    const selected = category === 'REVIEW' ? experiences : [];
    try { validateReviewPlaceExperiences(state, viewerId, groupId, input, selected, places || [], activityId); onSubmit(input, selected); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '장소 경험과 작성 공간을 다시 확인해 주세요. 입력은 유지돼요.'); }
  }}>
    <div className="tg-content-scope"><strong>{scopeName}</strong><small>{activity ? '이 약속의 모임원에게 공유해요' : '모임 전체에 공유해요'}</small></div>
    <label>글 종류<select value={category} onChange={event => { cancelGeneration(); setCategory(event.target.value as TogetherPost['category']); setSuggestion(null); }}><option value="FREE">일상·자유글</option><option value="QUESTION">질문</option><option value="REVIEW">모임·약속 후기</option>{canNotice && <option value="NOTICE">공지</option>}</select></label>
    {category === 'REVIEW' && <section className="tg-review-assist"><div><PenLine size={19}/><strong>후기, 편하게 시작해요</strong></div><p>약속 정보를 불러오거나 직접 작성할 수 있어요. 초안을 적용한 뒤 내용을 고칠 수 있어요.</p><div className="tg-row"><button type="button" onClick={fillFromFacts}>약속 정보로 작성 틀 만들기</button><button type="button" disabled={!onGenerateDraft || generating} onClick={generate}><Sparkles size={16}/>{generating ? '초안 만드는 중…' : 'AI 후기 초안'}</button></div>{!onGenerateDraft && <small>AI 서버 연결 후 사용할 수 있어요.</small>}</section>}
    {visibleSuggestion && <section className="tg-review-suggestion"><div className="tg-between"><strong>{visibleSuggestion.origin}</strong><button type="button" aria-label="초안 닫기" onClick={() => setSuggestion(null)}><X size={17}/></button></div><h3>{visibleSuggestion.title}</h3><p>{visibleSuggestion.body}</p><small>참석 여부·느낀 점·사진은 직접 확인해서 더해 주세요.</small><button type="button" onClick={() => {
      if (!isReviewDraftCurrent(latest.current, visibleSuggestion.capture)) { setSuggestion(null); setError('기록이나 작성 공간이 바뀌었어요. 초안을 다시 만들어 주세요.'); return; }
      setTitle(visibleSuggestion.title); setBody(visibleSuggestion.body); setSuggestion(null);
    }}>이 초안을 편집기에 적용</button></section>}
    <label>제목<input required maxLength={120} value={title} placeholder={category === 'REVIEW' ? '어떤 시간을 함께했나요?' : '제목을 적어 주세요'} onChange={event => setTitle(event.target.value)}/></label>
    <label>내용<textarea rows={7} maxLength={12000} value={body} placeholder="기억하고 싶은 이야기와 사진을 남겨 주세요." onChange={event => setBody(event.target.value)}/></label>
    <section className="tg-photo-editor"><div className="tg-between"><strong>사진 {photos.length}/{MAX_POST_PHOTOS}</strong><TogetherPhotoPicker key={`${viewerId}:${groupId}:${activityId || ''}`} disabled={photos.length >= MAX_POST_PHOTOS} onSelect={url => { const next = [...photoDraft.current, { id: togetherId('photo'), url, caption: '' }]; if (!isTogetherPhotoAttachments(next)) { setError('사진 저장 용량 합계는 2MB까지예요. 다른 사진을 선택해 주세요.'); return; } photoDraft.current = next; setPhotos(next); setError(''); }}/></div><small>JPG·PNG·WebP, 원본 5MB 이하. 사진은 저장에 맞게 줄여요.</small>
      <div className="tg-photo-editor__grid">{photos.map(photo => <figure key={photo.id}><img src={photo.url} alt={photo.caption || '선택한 사진'}/><input value={photo.caption} maxLength={300} aria-label="사진 설명" placeholder="사진 설명 · 선택" onChange={event => setPhotos(items => items.map(item => item.id === photo.id ? { ...item, caption: event.target.value } : item))}/><button type="button" aria-label="선택한 사진 삭제" onClick={() => setPhotos(items => items.filter(item => item.id !== photo.id))}><Trash2 size={15}/>삭제</button></figure>)}</div>
    </section>
    {category === 'REVIEW' && places && <details className="tg-review-experiences">
      <summary><MapPin size={18}/><span><strong>함께 간 장소 경험도 남기기</strong><small>선택 · {experiences.length}곳 선택</small></span><ChevronDown size={17}/></summary>
      <div className="tg-review-experiences__body"><p>직접 이용한 곳만 골라 주세요. 이 공간의 업체 평가로 저장하고, 모임 전체와 지난 약속의 경험은 우리 취향 지도에서 다시 볼 수 있어요. 후기 본문·사진·공개 요약은 복사하지 않아요.</p>
        {!experiencePlaces.length && <p className="tg-review-experiences__empty">이 공간에 공유한 공개 장소가 없어요. 장소 경험 없이 후기를 등록할 수 있어요.</p>}
        {experiencePlaces.map(item => { const draft = experiences.find(value => value.placeId === item.place.id); return <article className="tg-review-experience" key={item.place.id}>
          <div className="tg-review-experience__heading"><label><input type="checkbox" checked={Boolean(draft)} disabled={item.hasOwnReview || !draft && experiences.length >= MAX_REVIEW_PLACE_EXPERIENCES} onChange={event => {
            const checked = event.target.checked;
            setExperienceSelection(current => { const previous = current.owner === experienceOwner ? current.drafts : []; return { owner: experienceOwner, drafts: checked ? [...previous, { placeId: item.place.id, sourceVersion: item.sourceVersion, rating: 0, note: '', recommended: false, experienceTags: [] }] : previous.filter(value => value.placeId !== item.place.id) }; }); setError('');
          }}/><span><strong>{item.place.name}</strong><small>{item.hasOwnReview ? '이미 내 평가가 있어요 · 이번 후기에서는 덮어쓰지 않아요' : item.place.address || item.place.area}</small></span></label></div>
          {item.ownReview && <details className="tg-review-experience__existing"><summary>이미 남긴 내 평가 확인<ChevronDown size={16}/></summary><div><strong>{item.ownReview.withdrawn ? '삭제한 내 평가 · 현재 집계에서 제외됨' : `내 별점 ${item.ownReview.rating}점${item.ownReview.recommended ? ' · 추천' : ''}`}</strong>{item.ownReview.note && <p>{item.ownReview.note}</p>}{item.ownReview.experienceTags.length > 0 && <p>{item.ownReview.experienceTags.map(tag => placeExperienceTags.find(value => value.id === tag)?.label).filter(Boolean).join(' · ')}</p>}<small>이 후기를 등록해도 기존 평가는 바뀌지 않아요. 수정·삭제·복원은 업체의 ‘우리 평가’에서 직접 진행해 주세요.</small></div></details>}
          {draft && <div className="tg-review-experience__fields">
            {draft.sourceVersion !== item.sourceVersion || item.hasOwnReview ? <p className="tg-review-experiences__empty" role="status">장소나 기존 평가가 바뀌었어요. 이번 선택에서 빼고 현재 내용을 확인해 주세요.<button type="button" onClick={() => setExperienceSelection(current => ({ owner: experienceOwner, drafts: current.drafts.filter(value => value.placeId !== item.place.id) }))}>이 장소 선택 해제</button></p> : <>
              <fieldset><legend>내 별점 · 직접 선택</legend><div className="tg-review-experience__stars">{[1,2,3,4,5].map(rating => <button type="button" key={rating} aria-label={`${item.place.name} ${rating}점`} aria-pressed={draft.rating === rating} onClick={() => updateExperience(item.place.id, { rating })}><Star size={22} fill={draft.rating >= rating ? 'currentColor' : 'none'}/></button>)}</div><small>{draft.rating ? `${draft.rating}점 선택` : '별점을 선택해 주세요'}</small></fieldset>
              <fieldset><legend>직접 경험한 특징 · 선택</legend><div className="tg-review-experience__tags">{placeExperienceTags.map(tag => <button type="button" key={tag.id} aria-pressed={draft.experienceTags.includes(tag.id)} onClick={() => updateExperience(item.place.id, { experienceTags: draft.experienceTags.includes(tag.id) ? draft.experienceTags.filter(value => value !== tag.id) : [...draft.experienceTags, tag.id] })}>{tag.label}</button>)}</div></fieldset>
              <label className="tg-review-experience__note">이 장소에 대한 한마디 · 선택<textarea rows={2} maxLength={2000} value={draft.note} onChange={event => updateExperience(item.place.id, { note: event.target.value })} placeholder="이 장소에서 직접 느낀 점만 적어 주세요"/></label>
              <label className="tg-review-experience__recommend"><input type="checkbox" checked={draft.recommended} onChange={event => updateExperience(item.place.id, { recommended: event.target.checked })}/><span>이 공간의 멤버에게 추천해요</span></label>
            </>}
          </div>}
        </article>; })}
        {experiences.some(draft => !experiencePlaces.some(item => item.place.id === draft.placeId)) && <div className="tg-review-experiences__empty" role="status"><p>선택한 장소 중 현재 공유 목록에서 빠진 곳이 있어요. 해당 선택을 해제하면 후기를 이어서 등록할 수 있어요.</p><button type="button" onClick={() => setExperienceSelection(current => ({ owner: experienceOwner, drafts: current.drafts.filter(draft => experiencePlaces.some(item => item.place.id === draft.placeId)) }))}>공유 목록에서 빠진 장소 선택 해제</button></div>}
        <small>장소 경험은 최대 {MAX_REVIEW_PLACE_EXPERIENCES}곳이에요. 선택하지 않으면 기존 후기만 등록해요.</small>
      </div>
    </details>}
    {category === 'REVIEW' && isDiscoverableGroup(group) && <section className="tg-review-public"><label className="tg-check"><input type="checkbox" checked={publicReview} onChange={event => setPublicReview(event.target.checked)}/><span>모임 소개에 짧은 후기를 공개하기</span></label><small>제목과 아래에 적은 요약만 가입 전에도 보여요. 본문·사진·내 프로필은 공개하지 않아요.</small>{publicReview && <label>공개할 짧은 후기<textarea required maxLength={240} rows={3} value={excerpt} onChange={event => setExcerpt(event.target.value)} placeholder="누구나 볼 수 있는 소개용 후기를 직접 적어 주세요."/><small>{excerpt.length}/240자 · {discoveryProfile(group).recruitment === 'OPEN' ? '공개 모집 중인 모임 소개' : '공개된 모임 소개'}에 표시</small></label>}</section>}
    {error && <p className="tg-error" role="alert">{error}</p>}
    <div className="tg-row">{onCancel && <button type="button" onClick={onCancel}>취소</button>}<button className="tg-primary" type="submit">{category === 'REVIEW' ? '후기 등록' : '게시글 등록'}</button></div>
  </form>;
}
