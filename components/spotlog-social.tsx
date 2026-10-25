'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Bookmark, Heart, MessageCircle, Pencil, Reply, Send, ThumbsUp, Undo2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { SpotlogSocialProvider, useSpotlogSocial } from './spotlog-social-provider';
import { getSocialReaction, selectSocialComments, socialCharacterCount, type SocialComment, type SocialReactionKind } from '@/lib/spotlog-social';
import { resolveSocialTarget, type SocialTarget } from '@/lib/social-target';
import { getSocialSample, type SocialSampleThread } from '@/lib/social-samples';
import type { SavedPlan } from '@/lib/trip-engine';
import './spotlog-social.css';

export type SocialView = 'overview' | 'threads' | 'reactions';
const cheers = [
  { kind: 'LOVE', label: '너무 좋아요', icon: Heart },
  { kind: 'BEST', label: '최고예요', icon: ThumbsUp },
  { kind: 'HELPFUL', label: '동선이 유용해요', icon: Bookmark },
] as const;
type SocialLayerValue = { library: readonly SavedPlan[]; open: (target: SocialTarget, view?: SocialView, trigger?: HTMLElement) => void };
const SocialLayerContext = createContext<SocialLayerValue>({ library: [], open: () => {} });

export function SpotlogSocialLayer({ children, library }: { children: ReactNode; library: readonly SavedPlan[] }) {
  return <SpotlogSocialProvider><SocialLayerContent library={library}>{children}</SocialLayerContent></SpotlogSocialProvider>;
}

function SocialLayerContent({ children, library }: { children: ReactNode; library: readonly SavedPlan[] }) {
  const [selected, setSelected] = useState<{ target: SocialTarget; view: SocialView } | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const info = selected ? resolveSocialTarget(selected.target) : null;
  const close = () => setSelected(null);
  return <SocialLayerContext.Provider value={{ library, open: (target, view = 'overview', trigger) => {
    if (!resolveSocialTarget(target)) return;
    setContainer(trigger?.closest<HTMLElement>('[data-spotlog-device]') ?? document.querySelector<HTMLElement>('[data-spotlog-device]'));
    setSelected({ target, view });
  } }}>
    {children}
    <Dialog open={Boolean(info)} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent presentation="bottom-sheet" portalContainer={container ?? undefined} className="tr-sheet tr-social-sheet" showCloseButton={false}>
        <div className="tr-sheet-handle" aria-hidden="true" />
        <DialogHeader><div className="sheet-title-row"><DialogTitle>{info?.title ?? '평가와 스레드'}</DialogTitle><Button variant="ghost" size="icon" aria-label="평가·스레드 닫기" onClick={close}><X /></Button></div><DialogDescription>{info?.subtitle ?? '장소와 코스에 대한 반응을 나눠보세요.'}</DialogDescription></DialogHeader>
        <div className="sheet-body">{selected && info && <SocialPanel key={info.key} target={selected.target} initialView={selected.view} showIdentity={false} />}</div>
      </DialogContent>
    </Dialog>
  </SocialLayerContext.Provider>;
}

const number = (value: number) => value.toLocaleString('ko-KR');
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

/** Public sample baselines remain immutable; this device's contribution is a separate overlay. */
export function SocialSummary({ target, compact = false }: { target: SocialTarget; compact?: boolean }) {
  const { store, ready, readonly } = useSpotlogSocial();
  const { library, open } = useContext(SocialLayerContext);
  const info = resolveSocialTarget(target);
  if (!info) return null;
  const comments = selectSocialComments(store, target).filter(comment => !comment.deletedAt).length;
  const reaction = getSocialReaction(store, target);
  const copies = target.kind === 'course' ? library.filter(plan => !plan.deletedAt && plan.communitySourceId === target.id).length : 0;
  const sample = getSocialSample(target);
  const personalReady = ready && !readonly;
  const sampleReactions = sample ? Object.values(sample.reactions).reduce((sum, count) => sum + count, 0) : 0;
  const openView = (view: SocialView, trigger: HTMLElement) => open(target, view, trigger);
  return <section className={`tr-social-summary${compact ? ' is-compact' : ''}`} aria-label={`${info.title} 반응 요약`}>
    <div className="tr-social-summary-actions">
      {target.kind === 'course' && <button type="button" onClick={event => openView('overview', event.currentTarget)} aria-label={`${info.title} 담김 정보 보기`}><Bookmark size={15} /><span>담김<strong>{sample ? `${number((sample.copies ?? 0) + (ready ? copies : 0))}회` : '—'}</strong></span></button>}
      <button type="button" onClick={event => openView('reactions', event.currentTarget)} aria-label={`${info.title} 평가 보기`}><Heart size={15} fill={personalReady && reaction ? 'currentColor' : 'none'} /><span>{target.kind === 'course' ? '평가' : '좋아요'}<strong>{sample ? `${number(sampleReactions + (personalReady && reaction ? 1 : 0))}개` : '—'}</strong></span></button>
      <button type="button" onClick={event => openView('threads', event.currentTarget)} aria-label={`${info.title} 스레드 보기`}><MessageCircle size={15} /><span>스레드<strong>{sample ? `${number(sample.threads.length + (personalReady ? comments : 0))}개` : '—'}</strong></span></button>
    </div>
    <p><span className="tr-social-sample-label">샘플</span> 커뮤니티 + 이 기기의 내 기록{!ready ? ' · 내 기록 확인 중' : readonly ? ' · 내 기록 확인 불가' : ''}</p>
  </section>;
}

export function SocialPanel({ target, initialView = 'overview', showIdentity = true }: { target: SocialTarget; initialView?: SocialView; showIdentity?: boolean }) {
  const { ready, store, error, readonly, dispatch } = useSpotlogSocial();
  const { library, open } = useContext(SocialLayerContext);
  const [view, setView] = useState<SocialView>(initialView);
  const [body, setBody] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [confirmation, setConfirmation] = useState<{ id: string; edited: boolean } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string | null; sequence: number } | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const commentRefs = useRef(new Map<string, HTMLElement>());
  const pendingSubmission = useRef<{ key: string; before: Set<string>; body: string; parentId: string | null; editingId: string | null } | null>(null);
  const info = resolveSocialTarget(target);
  const targetKey = info?.key;
  useEffect(() => { if (parentId || editingId) inputRef.current?.focus(); }, [parentId, editingId]);
  useEffect(() => {
    const pending = pendingSubmission.current;
    if (!pending) return;
    pendingSubmission.current = null;
    if (!ready || readonly || pending.key !== targetKey) return;
    const targetCommentIds = new Set(selectSocialComments(store, target).map(comment => comment.id));
    const saved = [...store.comments].reverse().find(comment => targetCommentIds.has(comment.id) && !comment.deletedAt && comment.body === pending.body &&
      (pending.editingId ? comment.id === pending.editingId : !pending.before.has(comment.id) && comment.parentId === pending.parentId));
    if (saved) setConfirmation({ id: saved.id, edited: Boolean(pending.editingId) });
  }, [store, ready, readonly, targetKey, target]);
  useEffect(() => {
    if (!focusRequest || view !== 'threads' || !ready || readonly) return;
    const validComment = focusRequest.id && selectSocialComments(store, target).some(comment => comment.id === focusRequest.id && !comment.deletedAt);
    const element = focusRequest.id ? validComment ? commentRefs.current.get(focusRequest.id) : null : inputRef.current;
    if (!element) { setFocusRequest(null); return; }
    const frame = requestAnimationFrame(() => {
      element.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      element.focus({ preventScroll: true });
      setFocusRequest(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, view, ready, readonly, store, target]);
  const sample = getSocialSample(target);
  if (!info || !sample) return <p className="tr-social-note">이 장소나 코스의 반응을 확인할 수 없어요.</p>;
  const comments = selectSocialComments(store, target);
  const activeComments = comments.filter(comment => !comment.deletedAt);
  const reaction = getSocialReaction(store, target);
  const copies = target.kind === 'course' ? library.filter(plan => !plan.deletedAt && plan.communitySourceId === target.id).length : 0;
  const disabled = !ready || readonly;
  const ownCount = disabled ? null : activeComments.length;
  const ownCountLabel = ownCount === null ? ready ? '확인 불가' : '확인 중' : `${ownCount}개`;
  const newestOwn = [...activeComments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt))[0];
  const confirmedComment = confirmation && activeComments.find(comment => comment.id === confirmation.id);
  const commentCount = sample.threads.length + (ownCount ?? 0);
  const sampleReactionCount = Object.values(sample.reactions).reduce((sum, count) => sum + count, 0);
  const reactionCount = sampleReactionCount + (!disabled && reaction ? 1 : 0);
  type ThreadRow = { source: 'SAMPLE'; comment: SocialSampleThread } | { source: 'LOCAL'; comment: SocialComment };
  const rows: ThreadRow[] = [...sample.threads.map(comment => ({ source: 'SAMPLE' as const, comment })), ...(!disabled ? comments.map(comment => ({ source: 'LOCAL' as const, comment })) : [])];
  const topLevel = rows.filter(row => !row.comment.parentId).sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt) || a.comment.id.localeCompare(b.comment.id));
  const replyParent = rows.find(row => row.comment.id === parentId);
  const parentAuthor = replyParent?.source === 'SAMPLE' ? replyParent.comment.author.name : '내 스레드';
  function choose(kind: SocialReactionKind) {
    if (dispatch({ type: 'set-reaction', target, reaction: reaction === kind ? null : kind })) { setConfirmation(null); setFeedback(reaction === kind ? '내 반응을 취소했어요. 샘플 반응은 그대로예요.' : '내 반응 1개를 이 기기에 저장했어요.'); }
  }
  function focusThreads(id: string | null = null) {
    if (disabled) return;
    setView('threads');
    setFocusRequest(previous => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
  }
  function cancelEditor() { setParentId(null); setEditingId(null); setBody(''); }
  function submit() {
    pendingSubmission.current = { key: info!.key, before: new Set(comments.map(comment => comment.id)), body: body.replace(/\r\n?/g, '\n').trim(), parentId, editingId };
    const success = editingId
      ? dispatch({ type: 'edit-comment', id: editingId, body: body.trim() })
      : dispatch({ type: 'add-comment', target, body: body.trim(), ...(parentId ? { parentId } : {}) });
    if (success) { setConfirmation(null); setFeedback(editingId ? '글을 수정했어요.' : parentId ? '답글을 이 기기에 저장했어요.' : '스레드를 이 기기에 저장했어요.'); cancelEditor(); }
    else pendingSubmission.current = null;
  }
  function commentRow(row: ThreadRow, isReply = false) {
    const comment = row.comment;
    const own = row.source === 'LOCAL';
    const deleted = own && Boolean(row.comment.deletedAt);
    const author = row.source === 'SAMPLE' ? row.comment.author.name : '나';
    return <article ref={element => { if (own) { if (element) commentRefs.current.set(comment.id, element); else commentRefs.current.delete(comment.id); } }} tabIndex={own ? -1 : undefined} className={`tr-social-comment${isReply ? ' is-reply' : ''}${own ? ' is-own' : ' is-sample'}`} key={comment.id} aria-label={own ? isReply ? '내 답글' : '내 스레드' : `${author}의 샘플 ${isReply ? '답글' : '스레드'}`}>
      <div className="tr-social-comment-author"><span className="tr-social-avatar" aria-hidden="true">{row.source === 'SAMPLE' ? row.comment.author.initial : '나'}</span><div><strong>{author} <small>{own ? '이 기기' : '샘플'}</small></strong><time dateTime={comment.createdAt}>{date(comment.createdAt)}{own && row.comment.updatedAt !== row.comment.createdAt ? ' · 수정됨' : ''}</time></div></div>
      {deleted ? <p className="tr-social-deleted">삭제한 글입니다. 답글은 남아 있어요.</p> : <p className="tr-social-comment-body">{comment.body}</p>}
      <div className="tr-social-comment-actions">
        {!deleted && !isReply && <button type="button" disabled={disabled} aria-label={own ? '내 스레드에 답글' : `${author}에게 답글`} onClick={() => { setParentId(comment.id); setEditingId(null); setBody(''); }}><Reply size={13} />답글</button>}
        {row.source === 'LOCAL' && <>
          {!deleted && <button type="button" disabled={disabled} onClick={() => { setEditingId(comment.id); setParentId(null); setBody(comment.body); }}><Pencil size={12} />수정</button>}
          <button type="button" disabled={disabled} onClick={() => { if (dispatch({ type: deleted ? 'restore-comment' : 'delete-comment', id: comment.id })) { setConfirmation(null); setFeedback(deleted ? '글을 복원했어요.' : '글을 삭제했어요. 다시 복원할 수 있어요.'); if (editingId === comment.id || parentId === comment.id) cancelEditor(); } }}>{deleted && <Undo2 size={12} />}{deleted ? '복원' : '삭제'}</button>
        </>}
      </div>
    </article>;
  }
  return <section className="tr-social-panel" aria-label={`${info.title} 평가와 스레드`}>
    {showIdentity && <header className="tr-social-panel-heading"><h3>{info.title}</h3><p>{info.subtitle}</p></header>}
    <div className="tr-social-scope"><span>샘플 커뮤니티</span><p>{target.kind === 'course-place' ? '이 코스의 이 장소 카드에 남긴 이야기예요.' : target.kind === 'course' ? '여행 전체에 대한 평가와 이야기예요.' : '이 장소·업체에 남긴 이야기예요.'} 이름·글·집계는 체험용 샘플이며, 내 기록은 이 기기에만 저장돼요.</p></div>
    <div className="tr-social-tabs" role="tablist" aria-label="반응 종류">{([{ value: 'overview', label: '담김·반응' }, { value: 'reactions', label: '평가' }, { value: 'threads', label: `스레드 ${commentCount}` }] as const).map(item => <button type="button" role="tab" aria-selected={view === item.value} key={item.value} onClick={() => setView(item.value)}>{item.label}</button>)}</div>
    {view !== 'threads' && <div className="tr-social-entry-actions"><button type="button" disabled={disabled} onClick={() => focusThreads()}><Pencil size={14} />글 쓰기</button><button type="button" disabled={disabled || !newestOwn} onClick={() => newestOwn && focusThreads(newestOwn.id)}><MessageCircle size={14} />내 글 확인{ownCount !== null && ` · ${ownCount}개`}</button></div>}
    {view === 'overview' && <div className="tr-social-overview">
      <div className={`tr-social-metrics${target.kind !== 'course' ? ' has-two' : ''}`} aria-label="샘플과 내 기록의 체험 합계">
        {target.kind === 'course' && <div><Bookmark size={17} /><strong>{number((sample.copies ?? 0) + (ready ? copies : 0))}</strong><span>담김 횟수</span><small>샘플 {number(sample.copies ?? 0)} + 내 사본 {ready ? copies : '…'}</small></div>}
        <div><Heart size={17} /><strong>{number(reactionCount)}</strong><span>{target.kind === 'course' ? '평가' : '좋아요'}</span><small>샘플 {number(sampleReactionCount)} + 내 반응 {disabled ? '—' : reaction ? 1 : 0}</small></div>
        <div><MessageCircle size={17} /><strong>{number(commentCount)}</strong><span>스레드·답글</span><small>샘플 {sample.threads.length} + 내 글 {ownCount ?? '—'}</small></div>
      </div>
      <p className="tr-social-note">체험 합계예요. 실제 회원 통계가 아니며, 내 반응이나 글을 더하면 이 기기의 합계에 반영돼요.</p>
      <div className="tr-social-local-facts">{target.kind === 'course' && <p><Bookmark size={15} /><span>내가 저장한 여행 사본</span><b>{ready ? copies : '…'}개</b></p>}<p><Heart size={15} /><span>내가 남긴 평가</span><b>{!ready ? '확인 중' : readonly ? '확인 불가' : reaction ? target.kind === 'course' ? cheers.find(item => item.kind === reaction)?.label : '좋아요' : '아직 없음'}</b></p><p><MessageCircle size={15} /><span>내 스레드·답글</span><b>{ownCountLabel}</b></p></div>
      {target.kind === 'course' && <p className="tr-social-note">내 사본은 저장한 여행에 남아 있는 사본만 세며, 휴지통의 여행은 제외해요. 사람 수가 아닌 담김 횟수입니다.</p>}
      <button className="tr-social-primary" type="button" onClick={() => setView('threads')}>사람들의 이야기 보기<MessageCircle size={15} /></button>
    </div>}
    {view === 'reactions' && <div className="tr-social-reactions"><h3>{target.kind === 'course' ? '이 코스, 어땠나요?' : '이 장소가 마음에 드나요?'}</h3><p>마음에 드는 반응을 남겨보세요. 한 번 더 누르면 취소돼요.</p>{info.reactionMode === 'cheer' ? <div className="tr-social-cheers">{cheers.map(({ kind, label, icon: Icon }) => <button type="button" aria-pressed={reaction === kind} disabled={disabled} key={kind} onClick={() => choose(kind)}><Icon size={20} /><span>{label}</span><b>{number(sample.reactions[kind] + (!disabled && reaction === kind ? 1 : 0))}</b><small>{reaction === kind && !disabled ? '내 평가 포함' : '샘플 반응'}</small></button>)}</div> : <button className="tr-social-like" type="button" aria-pressed={reaction === 'LIKE'} disabled={disabled} onClick={() => choose('LIKE')}><ThumbsUp size={19} />좋아요 <b>{number(sample.reactions.LIKE + (!disabled && reaction === 'LIKE' ? 1 : 0))}</b>{reaction === 'LIKE' && !disabled && <small>내 반응 포함</small>}</button>}<p className="tr-social-note">샘플 반응에 내 선택 1개를 더해 표시해요. 평가를 바꾸거나 취소해도 다른 사람의 샘플 수는 변하지 않아요.</p></div>}
    {view === 'threads' && <div className="tr-social-threads"><div className="tr-social-thread-heading"><div><h3>이야기 나누기</h3><span>{commentCount}개 · 답글 포함</span></div><button type="button" disabled={disabled} onClick={() => focusThreads()}><Pencil size={14} />글 쓰기</button></div>
      <div className="tr-social-own-shortcut"><span>내 스레드·답글 {ownCountLabel}</span><button type="button" disabled={disabled || !newestOwn} onClick={() => newestOwn && focusThreads(newestOwn.id)}>내 글 확인</button></div>
      <div className="tr-social-thread-list">{topLevel.map(row => <div className="tr-social-thread" key={row.comment.id}>{commentRow(row)}{rows.filter(reply => reply.comment.parentId === row.comment.id).sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt)).map(reply => commentRow(reply, true))}</div>)}</div>
      <form className="tr-social-composer" onSubmit={event => { event.preventDefault(); if (!disabled && body.trim()) submit(); }}>
        <div><label htmlFor={inputId}>{editingId ? '글 수정' : parentId ? '답글 작성' : '스레드 작성'}</label>{(editingId || parentId) && <button type="button" onClick={cancelEditor}>취소</button>}</div>
        {parentId && <p className="tr-social-reply-context">{parentAuthor}{replyParent?.source === 'SAMPLE' ? '님의 샘플 스레드에' : '에'} 답글을 남겨요.</p>}
        <textarea ref={inputRef} id={inputId} disabled={disabled} value={body} onChange={event => setBody(Array.from(event.target.value).slice(0, info.commentLimit).join(''))} placeholder={parentId ? '이 스레드에 답글을 남겨보세요' : '방문 계획이나 궁금한 점을 이야기해 보세요'} rows={3} />
        <div><span>{socialCharacterCount(body)}/{info.commentLimit}</span><button type="submit" disabled={disabled || !body.trim()}><Send size={14} />{editingId ? '수정 저장' : parentId ? '답글 등록' : '스레드 등록'}</button></div>
      </form>
    </div>}
    {target.kind === 'course-place' && info.entityId && <button type="button" className="tr-social-entity-link" onClick={event => open({ kind: 'entity', id: info.entityId! }, 'threads', event.currentTarget)}>이 장소·업체 전체 의견 따로 보기<MessageCircle size={14} /></button>}
    {error && <p role="alert" className="tr-social-error">{error}</p>}
    {!ready && <output className="tr-social-note">이 기기의 반응을 불러오는 중이에요.</output>}
    {feedback && <output className="tr-social-feedback"><span>{feedback}</span>{!disabled && confirmation && confirmedComment && <button type="button" onClick={() => focusThreads(confirmation.id)}>{confirmation.edited ? '수정한 글 보기' : '등록한 글 보기'}<MessageCircle size={13} /></button>}</output>}
    <p className="tr-social-footnote">샘플 사용자는 가상의 인물이에요. 내가 작성한 글·답글·평가는 이 브라우저에 보관되며 실제 회원에게 게시되지 않아요.</p>
  </section>;
}
