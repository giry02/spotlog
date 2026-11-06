const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/Giry/Documents/Spotlog-Customer-Pages-20261006/web/src';
const edit=(file,fn)=>{const name=path.join(root,file);fs.writeFileSync(name,fn(fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n')));};
const swap=(text,old,next)=>{if(!text.includes(old))throw Error('Missing '+old.slice(0,90));return text.replace(old,next);};
const between=(text,start,end,next='')=>{const first=text.indexOf(start);if(first<0)throw Error('Missing start '+start);const last=text.indexOf(end,first+start.length);if(last<0)throw Error('Missing end '+end);return text.slice(0,first)+next+text.slice(last);};
if(!fs.readFileSync(path.join(root,'App.tsx'),'utf8').includes('JournalReportButton'))edit('App.tsx',text=>{
  text=swap(text,"import { CardSocial, CardSocialProvider } from './CardSocial.tsx';","import { CardSocial, CardSocialProvider, useCardSocialStore } from './CardSocial.tsx';");
  text=swap(text,"import { ReportButton, ReportProvider, PlaceReportActions } from './ReportSheet';","import { JournalReportButton, ReportProvider } from './ReportSheet';");
  text=between(text,'<section className="journal-lead">{journey.visibility', '<PhotoCredit image={journey.cover}', '<section className="journal-lead">');
  text=between(text,"{journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' && comment.author !== profile.displayName && <ReportButton",'</div></article>)');
  text=between(text,'{!journey.isMine && journey.visibility === "PUBLIC"','\n    <div className="detail-creator-card">');
  text=swap(text,'const dayHeadingRef = useRef<HTMLElement>(null);','const cardSocial = useCardSocialStore();\n  const dayHeadingRef = useRef<HTMLElement>(null);');
  text=swap(text,'<JournalPhotos block={block} journey={journey}/>','<JournalPhotos block={block}/>');
  text=swap(text,'<CreatorJourneySection journey={journey} profile={profile} authorJourneys={authorJourneys} onOpenJourney={onOpenJourney} />','<CreatorJourneySection journey={journey} profile={profile} authorJourneys={authorJourneys} onOpenJourney={onOpenJourney} />\n    <JournalReportButton journey={journey} comments={comments} threads={cardSocial} selfName={profile.displayName} />');
  text=between(text,'{!preview&&<PlaceReportActions',' {!preview&&social&&');
  return text;
});
edit('JournalPhotos.tsx',text=>{
  text=swap(text,"import type {Journey,StoryBlock} from './data';","import type {StoryBlock} from './data';");
  text=swap(text,"import { ReportButton } from './ReportSheet';\n",'');
  text=swap(text,'export function JournalPhotos({block,journey}:{block:StoryBlock;journey?:Journey})','export function JournalPhotos({block}:{block:StoryBlock})');
  return between(text,"{journey?.visibility==='PUBLIC'",'</div>;');
});
edit('CardSocial.tsx',text=>{
  text=swap(text,"import { ReportButton, useReport } from './ReportSheet';","import { useReport } from './ReportSheet';");
  text=swap(text,"import type { Journey } from './data';\n",'');
  text=swap(text,'const SocialContext=createContext<Context|null>(null);','const SocialContext=createContext<Context|null>(null);\nexport const useCardSocialStore=()=>useContext(SocialContext)?.store;');
  text=swap(text,'visibleComments={visibleComments} journey={journey} blockId={blockId} user={user}','visibleComments={visibleComments} user={user}');
  text=swap(text,'{thread,visibleComments,journey,blockId,user,onSave,onClose,placeName}','{thread,visibleComments,user,onSave,onClose,placeName}');
  text=swap(text,'visibleComments:CardComment[];journey?:Journey;blockId:string;user:','visibleComments:CardComment[];user:');
  return between(text,'</>:journey&&<ReportButton','</div>}{removing','</>:null}');
});
console.log('Consolidated journal report controls in 3 components.');
