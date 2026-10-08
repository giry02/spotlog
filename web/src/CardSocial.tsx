import { useUiCopy } from './frontendCopy';
import { useAccount } from './accountContext';
import { ContentLanguageControls, ContentTranslationScope, TranslationText } from './TranslationText';
import { sourceVersion } from './travelGuide';
import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Heart,MessageCircle,Reply,Edit3,Trash2} from 'lucide-react';
import {BottomSheet} from './BottomSheet';
import {Button,Field} from './ui';
import {CreatorAvatar} from './CreatorAvatar';
import { ReportButton, useReport } from './ReportSheet';
import type { Journey } from './data';
import { usePublicReview, localPublicReviewEnabled } from './publicReview';
import { recordPublicCardReaction } from './reviewServiceBridge';
import {cardKey,deleteCardComment,emptyThread,getCardCommentGroups,saveCardComment,type CardSocialStore,type CardThread,type CardComment,type CardSocialUser} from './cardSocialState';
type Context={store:CardSocialStore;save:(action:(current:CardSocialStore)=>CardSocialStore)=>boolean;user:CardSocialUser};
const SocialContext=createContext<Context|null>(null);
export const useCardSocialStore=()=>useContext(SocialContext)?.store;
export function CardSocialProvider({children,...value}:Context&{children:ReactNode}){return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;}
export function CardSocial({journeyId,blockId,placeName}:{journeyId:string;blockId:string;placeName:string}){
  const account = useAccount();
  const copy=useUiCopy();
  const context=useContext(SocialContext);
  const reportContext=useReport(), {state:reviewState}=usePublicReview();
  const [panel,setPanel]=useState<'comments'|'likes'|null>(null),[error,setError]=useState('');
  if(!context)return null;
  const {store,save,user}=context,key=cardKey(journeyId,blockId),thread=store[key]??emptyThread();
  const journey=reportContext?.publicJourney(journeyId);
  const visibleComments:CardComment[]=[...new Map([...thread.comments,...reviewState.comments.filter(c=>c.journalId===journeyId&&c.cardId===blockId&&c.moderation==='VISIBLE').map(c=>({id:c.commentId,authorId:c.authorId,author:c.authorName??c.authorId,avatar:c.authorAvatar,body:c.original,parentId:c.parentId,createdAt:c.createdAt}))].filter(c=>!reviewState.commentModeration.some(m=>m.id===c.id&&m.state!=='VISIBLE')).map(c=>[c.id,c])).values()];
  const write=(next:CardThread)=>{const ok=save(current=>({...current,[key]:next}));setError(ok?'':copy("저장하지 못했어요. 다시 시도해 주세요."));return ok;};
  const liked=account?.session.state==='SIGNED_IN' && thread.likes.some(item=>item.id===user.id);
  const publicCard=reviewState.publicJournals.find(j=>j.journalId===journeyId)?.cards.find(c=>c.cardId===blockId);
  const visibleLikes=[...new Map([...thread.likes,...(publicCard?.likeUsers??[]).filter(u=>u.name).map(u=>({id:u.memberId,name:u.name!,avatar:u.avatarUrl??undefined}))].map(u=>[u.id,u])).values()];
  const toggleLike=()=>{if(!account?.requireMember('좋아요를 남기려면 로그인이 필요해요.'))return;if(!write({...thread,likes:liked?thread.likes.filter(item=>item.id!==user.id):[...thread.likes,{...user}]}))return;if(journey&&localPublicReviewEnabled())try{recordPublicCardReaction(journey,blockId,user,!liked);}catch(failure){setError(failure instanceof Error?failure.message:copy("공개 반응 검수 자료를 저장하지 못했어요."));}};
  return <div className="card-social" role="group" aria-label={`${placeName} 반응`}><button aria-label={`${placeName} ${liked?copy("좋아요 취소"):copy("좋아요")}`} aria-pressed={liked} onClick={toggleLike}><Heart size={17} aria-hidden="true" fill={liked?'currentColor':'none'}/>{visibleLikes.length}</button><button aria-label={`${placeName} 좋아요 목록`} onClick={()=>setPanel('likes')}>{copy("좋아요 목록")}</button><button aria-label={`${placeName} 댓글 ${visibleComments.filter(item=>!item.deleted).length}`} onClick={()=>setPanel('comments')}><MessageCircle size={17} aria-hidden="true"/>{copy("댓글")}{' '}{visibleComments.filter(item=>!item.deleted).length}</button>{error&&<p role="alert">{error}</p>}
    {panel==='likes'&&<BottomSheet title={`${placeName}에 좋아요`} onClose={()=>setPanel(null)}><div className="plan-form"><p className="plan-help">{copy("이 여행기의 장소에 남긴 반응 미리보기예요.")}</p>{visibleLikes.length?visibleLikes.map(item=>{const author=item.id===user.id?user:item;return <div className="card-social-person" key={item.id}><CreatorAvatar name={author.name} image={author.avatar} size="small"/><strong>{author.name}</strong></div>;}):<p>{copy("아직 좋아요가 없어요.")}</p>}</div></BottomSheet>}
    {panel==='comments'&&<CardComments key={key} placeName={placeName} thread={thread} visibleComments={visibleComments} journey={journey} blockId={blockId} user={user} onSave={write} onClose={()=>setPanel(null)}/>}
  </div>;
}
function CardComments({thread,visibleComments,journey,blockId,user,onSave,onClose,placeName}:{thread:CardThread;visibleComments:CardComment[];journey?:Journey;blockId:string;user:Context['user'];onSave:(thread:CardThread)=>boolean;onClose:()=>void;placeName:string}){
  const account = useAccount();
  const copy=useUiCopy();
  const [draft,setDraft]=useState(thread.draft??{body:''}),[error,setError]=useState(''),[limit,setLimit]=useState(10);
  const [removing,setRemoving]=useState<string|null>(null);
  const list=useRef<HTMLDivElement>(null),[postedRoot,setPostedRoot]=useState(0);
  useLayoutEffect(()=>{if(postedRoot)list.current?.closest('.phase-sheet-body')?.scrollTo({top:0,behavior:'instant'});},[postedRoot]);
  const save=(next:CardThread)=>{const ok=onSave(next);setError(ok?'':copy("저장하지 못했어요. 입력한 내용은 유지돼요. 다시 시도해 주세요."));return ok;};
  const editDraft=(next:typeof draft)=>{setDraft(next);save({...thread,draft:next});};
  const submit=()=>{if(account?.session.state!=='SIGNED_IN'){if(!save({...thread,draft}))return;onClose();account?.openAccount('login','댓글·답글 등록에는 로그인이 필요해요.');return;}try{if(save((()=>{const next=saveCardComment({...thread,comments:visibleComments},user,draft.body,draft.parentId,draft.editingId);return {...next,comments:next.comments.filter(c=>thread.comments.some(local=>local.id===c.id)||c.authorId===user.id)};})())){if(!draft.parentId&&!draft.editingId)setPostedRoot(value=>value+1);setDraft({body:''});}}catch(error){setError(error instanceof Error?error.message:copy("댓글을 저장하지 못했어요."));}};
  const row=(comment:CardComment)=>{
    const name=comment.authorId===user.id?user.name:comment.author,avatar=comment.authorId===user.id?user.avatar:comment.avatar;
    return <article key={comment.id} className={`card-comment ${comment.parentId?'card-reply':''}`}><div className="card-comment-author"><CreatorAvatar name={name} image={avatar} size="small"/><div className="card-comment-byline"><strong>{name}</strong><small>{new Date(comment.createdAt).toLocaleDateString('ko-KR')}{comment.editedAt?copy(" · 수정됨"):''}</small></div></div>{comment.deleted ? <p>{copy("삭제된 댓글입니다.")}</p> : <TranslationText sourceId={`comment:${comment.id}`} sourceVersion={sourceVersion(comment.body)} text={comment.body} kind="comment" />}{!comment.deleted&&<div className="card-comment-actions"><button aria-label={copy("답글")} title={copy("답글")} onClick={()=>editDraft({body:'',parentId:comment.parentId??comment.id})}><Reply size={16} aria-hidden="true"/></button>{comment.authorId===user.id?<><button aria-label={copy("수정")} title={copy("수정")} onClick={()=>editDraft({body:comment.body,parentId:comment.parentId,editingId:comment.id})}><Edit3 size={16} aria-hidden="true"/></button><button aria-label={copy("삭제")} title={copy("삭제")} onClick={()=>setRemoving(comment.id)}><Trash2 size={16} aria-hidden="true"/></button></>:journey&&<ReportButton iconOnly label={comment.parentId?'답글 신고':'댓글 신고'} beforeOpen={onClose} target={{type:'COMMENT',id:comment.id,label:`${name} · ${comment.parentId?'답글':'댓글'}`,journey,cardId:blockId,comment:{commentId:comment.id,revision:1,journalId:journey.id,cardId:blockId,parentId:comment.parentId,authorId:comment.authorId,authorName:name,authorAvatar:avatar,original:comment.body,english:'',createdAt:comment.createdAt,moderation:'VISIBLE',sourceKind:'PUBLIC_SAMPLE'}}}/>}</div>}{removing===comment.id&&<div className="plan-form"><p>{copy("이 댓글을 삭제할까요? 답글은 남아요.")}</p><Button variant="danger" onClick={()=>{try{if(save(deleteCardComment(thread,user.id,comment.id)))setRemoving(null);}catch(error){setError(String(error));}}}>{copy("댓글 삭제")}</Button><Button variant="secondary" onClick={()=>setRemoving(null)}>{copy("취소")}</Button></div>}</article>;
  };
  const groups=getCardCommentGroups(visibleComments),parent=draft.parentId?visibleComments.find(item=>item.id===draft.parentId):null;
  return <ContentTranslationScope><BottomSheet title={`${placeName} 댓글 ${visibleComments.filter(item=>!item.deleted).length}`} description={copy("이 여행기의 장소에 대한 이야기 · 이 기기의 미리보기")} onClose={onClose}><div ref={list} className="plan-form card-comment-sheet"><ContentLanguageControls />
    <span className="card-comment-order">{copy("최신순")}</span>
    {!groups.length&&<p>{copy("이 장소에 첫 댓글을 남겨보세요.")}</p>}
    {groups.slice(0,limit).map(({comment,replies})=><div key={comment.id}>{row(comment)}{replies.map(row)}</div>)}
    {groups.length>limit&&<Button variant="secondary" onClick={()=>setLimit(limit+10)}>{copy("댓글 더 보기")}</Button>}

    {(parent||draft.editingId)&&<div className="card-comment-context"><span>{draft.editingId?copy("댓글 수정 중"):`${parent?.authorId===user.id?user.name:parent?.author}에게 답글`}</span><button onClick={()=>editDraft({body:''})}>{copy("취소")}</button></div>}
    <Field label={draft.editingId?copy("댓글 수정"):parent?copy("답글 작성"):copy("댓글 작성")}><textarea rows={3} maxLength={1000} value={draft.body} onChange={event=>editDraft({...draft,body:event.target.value})} placeholder={copy("이 장소에 대한 이야기를 남겨주세요.")}/></Field>
    <p className="plan-help">{draft.body.length}{copy("/1,000 · 작성 중 내용은 이 장소 카드에 보관돼요.")}</p><Button disabled={!draft.body.trim()} onClick={submit}>{error?copy("다시 저장"):draft.editingId?copy("수정 저장"):parent?copy("답글 등록"):copy("댓글 등록")}</Button>{error&&<p role="alert" className="ui-error">{error}</p>}
  </div></BottomSheet></ContentTranslationScope>;
}
