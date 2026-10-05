export const CARD_SOCIAL_KEY = 'spotlog.card-social.v1';
export type CardSocialUser = {id:string;name:string;avatar?:string};
export type CardComment = { id:string; authorId:string; author:string; avatar?:string; body:string; parentId?:string; createdAt:string; editedAt?:string; deleted?:boolean; reportReason?:string };
export type CardThread = { likes:CardSocialUser[]; comments:CardComment[]; draft?:{body:string;parentId?:string;editingId?:string} };
export type CardSocialStore = Record<string,CardThread>;
export const cardKey=(journeyId:string,blockId:string)=>JSON.stringify([journeyId,blockId]);
export const emptyThread=():CardThread=>({likes:[],comments:[]});
export function getCardCommentGroups(comments:CardComment[]){
  const entries=comments.map((comment,index)=>({comment,index,time:Date.parse(comment.createdAt)||0}));
  const chronological=(a:typeof entries[number],b:typeof entries[number])=>a.time-b.time||a.index-b.index;
  return entries.filter(({comment})=>!comment.parentId).sort((a,b)=>chronological(b,a)).map(({comment})=>({
    comment,replies:entries.filter(entry=>entry.comment.parentId===comment.id).sort(chronological).map(entry=>entry.comment),
  }));
}
export function saveCardComment(thread:CardThread,user:CardSocialUser,body:string,parentId?:string,editingId?:string):CardThread {
  const text=body.trim();
  if(!text||text.length>1000)throw new Error('댓글은 1~1,000자로 입력해 주세요.');
  if(editingId){
    const comment=thread.comments.find(item=>item.id===editingId);
    if(!comment||comment.authorId!==user.id||comment.deleted)throw new Error('수정할 수 없는 댓글이에요.');
    return {...thread,draft:undefined,comments:thread.comments.map(item=>item.id===editingId?{...item,body:text,editedAt:new Date().toISOString()}:item)};
  }
  const parent=parentId?thread.comments.find(item=>item.id===parentId):undefined;
  if(parentId&&(!parent||parent.parentId))throw new Error('답글을 달 댓글을 다시 선택해 주세요.');
  return {...thread,draft:undefined,comments:[...thread.comments,{id:crypto.randomUUID(),authorId:user.id,author:user.name,avatar:user.avatar,body:text,parentId,createdAt:new Date().toISOString()}]};
}
export function deleteCardComment(thread:CardThread,userId:string,id:string):CardThread {
  const target=thread.comments.find(item=>item.id===id);
  if(!target||target.authorId!==userId)throw new Error('내 댓글만 삭제할 수 있어요.');
  return {...thread,comments:thread.comments.map(item=>item.id===id?{...item,body:'',deleted:true}:item),draft:thread.draft?.editingId===id?undefined:thread.draft};
}
export function isCardSocialStore(value:unknown):value is CardSocialStore {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  return Object.entries(value).every(([key,item])=>{
    let ids:unknown;try{ids=JSON.parse(key);}catch{return false;}
    if(!Array.isArray(ids)||ids.length!==2||!ids.every(id=>typeof id==='string')||!item||typeof item!=='object')return false;
    const t=item as CardThread,optional=(v:unknown)=>v===undefined||typeof v==='string';
    return Array.isArray(t.likes)&&t.likes.every(user=>user&&typeof user.id==='string'&&typeof user.name==='string'&&optional(user.avatar))
      &&Array.isArray(t.comments)&&t.comments.every(c=>c&&['id','authorId','author','body','createdAt'].every(k=>typeof c[k as keyof CardComment]==='string')&&optional(c.avatar)&&optional(c.parentId)&&optional(c.editedAt)&&optional(c.reportReason)&&(c.deleted===undefined||typeof c.deleted==='boolean'))
      &&(t.draft===undefined||(!!t.draft&&typeof t.draft.body==='string'&&optional(t.draft.parentId)&&optional(t.draft.editingId)));
  });
}
