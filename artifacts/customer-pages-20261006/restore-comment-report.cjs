const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/Giry/Documents/Spotlog-Customer-Pages-20261006/web/src';
const swap=(text,old,next)=>{if(!text.includes(old))throw Error('Missing '+old.slice(0,80));return text.replace(old,next);};
const edit=(file,fn)=>{const name=path.join(root,file);fs.writeFileSync(name,fn(fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n')));};
edit('App.tsx',text=>{
 text=swap(text,"import { JournalReportButton, ReportProvider } from './ReportSheet';","import { JournalReportButton, ReportButton, ReportProvider } from './ReportSheet';");
 return swap(text,'<time>{comment.createdAt}</time></div><TranslationText sourceId={`journal-comment:${comment.id}`}',`<time>{comment.createdAt}</time>{journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' && !journey.trash && comment.author !== profile.displayName && <ReportButton iconOnly label="댓글 신고" target={{ type: 'COMMENT', id: comment.id, label: \`\${comment.author} · 댓글\`, journey, comment: reviewState.comments.find(item => item.commentId === comment.id && item.journalId === journey.id && !item.cardId) ?? { commentId: comment.id, revision: 1, journalId: journey.id, authorId: \`public-author:\${comment.author}\`, authorName: comment.author, authorAvatar: comment.avatar, original: comment.body, english: '', createdAt: Number.isFinite(Date.parse(comment.createdAt)) ? new Date(comment.createdAt).toISOString() : new Date().toISOString(), moderation: 'VISIBLE', sourceKind: 'PUBLIC_SAMPLE' } }} />}</div><TranslationText sourceId={\`journal-comment:\${comment.id}\`}`);
});
edit('CardSocial.tsx',text=>{
 text=swap(text,"import { useReport } from './ReportSheet';","import { ReportButton, useReport } from './ReportSheet';\nimport type { Journey } from './data';");
 text=swap(text,'visibleComments={visibleComments} user={user}','visibleComments={visibleComments} journey={journey} blockId={blockId} user={user}');
 text=swap(text,'function CardComments({thread,visibleComments,user,onSave,onClose,placeName}:{thread:CardThread;visibleComments:CardComment[];user:', 'function CardComments({thread,visibleComments,journey,blockId,user,onSave,onClose,placeName}:{thread:CardThread;visibleComments:CardComment[];journey?:Journey;blockId:string;user:');
 return swap(text,'</>:null}</div>}{removing',`</>:journey&&<ReportButton iconOnly label={comment.parentId?'답글 신고':'댓글 신고'} beforeOpen={onClose} target={{type:'COMMENT',id:comment.id,label:\`\${name} · \${comment.parentId?'답글':'댓글'}\`,journey,cardId:blockId,comment:{commentId:comment.id,revision:1,journalId:journey.id,cardId:blockId,parentId:comment.parentId,authorId:comment.authorId,authorName:name,authorAvatar:avatar,original:comment.body,english:'',createdAt:comment.createdAt,moderation:'VISIBLE',sourceKind:'PUBLIC_SAMPLE'}}}/>}</div>}{removing`);
});
console.log('Restored icon-only comment and reply reporting.');
