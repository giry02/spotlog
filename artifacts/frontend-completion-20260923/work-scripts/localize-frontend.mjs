import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const names=process.argv.includes('--extras')?['DayNavigation.tsx','CardSocial.tsx','JournalPhotos.tsx','LandmarkGuideCard.tsx','SavedLandmarkDetailSheet.tsx','TripTrashSheet.tsx']:['PersonalTrip.tsx','NearbyBusinessSheet.tsx','RouteMap.tsx','App.tsx','BottomSheet.tsx'];
const dictPath=path.join(root,'web/src/frontend-copy.en.json');
const dict=fs.existsSync(dictPath)?JSON.parse(fs.readFileSync(dictPath,'utf8')):{};
const inventory=new Set();
const apply=process.argv.includes('--apply');
for(const name of names){
  const file=path.join(root,'web/src',name),source=fs.readFileSync(file,'utf8');
  const sf=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[];
  const korean=s=>/[가-힣]/.test(s);
  for(const fn of sf.statements){
    if(!ts.isFunctionDeclaration(fn)||!fn.name||!/^[A-Z]/.test(fn.name.text)||!fn.body)continue;
    const before=edits.length;
    const replacement=(node,text,format)=>{if(!korean(text))return;inventory.add(text);if(dict[text])edits.push({start:node.getStart(sf),end:node.end,text:format(`copy(${JSON.stringify(text)})`)});};
    const visit=node=>{
      if(ts.isJsxText(node)){
        const raw=node.getFullText(sf),text=raw.replace(/\s+/g,' ').trim();
        if(korean(text)){
          inventory.add(text);
          if(dict[text]){
            // Keep inline spacing in the reviewed Korean layout.
            const leading=/^[ \t]+\S/.test(raw)?"{' '}":'',trailing=/\S[ \t]+$/.test(raw)?"{' '}":'';
            edits.push({start:node.pos,end:node.end,text:`${leading}{copy(${JSON.stringify(text)})}${trailing}`});
            // Translated option labels must never change the stored region/value.
            const parent=node.parent;
            if(ts.isJsxElement(parent)&&parent.openingElement.tagName.getText(sf)==='option'&&!parent.openingElement.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)==='value')){
              edits.push({start:parent.openingElement.tagName.end,end:parent.openingElement.tagName.end,text:` value=${JSON.stringify(text)}`});
            }
          }
        }return;
      }
      if(ts.isJsxAttribute(node)&&node.initializer&&ts.isStringLiteral(node.initializer)&&['label','title','placeholder','aria-label','description','hint'].includes(node.name.getText(sf))){replacement(node.initializer,node.initializer.text,s=>`{${s}}`);return;}
      if(ts.isJsxExpression(node)&&node.expression){
        const e=node.expression;
        if(ts.isStringLiteral(e)){replacement(e,e.text,s=>s);return;}
      }
      if(ts.isStringLiteral(node)&&korean(node.text)){
        const parent=node.parent;
        if(ts.isConditionalExpression(parent)&&(parent.whenTrue===node||parent.whenFalse===node))replacement(node,node.text,s=>s);
        else if(ts.isBinaryExpression(parent)&&parent.right===node&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind))replacement(node,node.text,s=>s);
        else if(ts.isCallExpression(parent)&&['setError','setStatus','showToast'].includes(parent.expression.getText(sf)))replacement(node,node.text,s=>s);
        return;
      }
      ts.forEachChild(node,visit);
    };
    visit(fn.body);
    if(edits.length>before&&!fn.body.getText(sf).includes('const copy=useUiCopy()'))edits.push({start:fn.body.getStart(sf)+1,end:fn.body.getStart(sf)+1,text:'\n  const copy=useUiCopy();'});
  }
  if(apply&&edits.length){
    edits.sort((a,b)=>b.start-a.start);
    let result=source;for(const e of edits)result=result.slice(0,e.start)+e.text+result.slice(e.end);
    if(!result.includes("import { useUiCopy }"))result="import { useUiCopy } from './frontendCopy';\n"+result;
    fs.writeFileSync(file,result);
  }
}
const missing=[...inventory].filter(k=>!dict[k]);
fs.mkdirSync(path.join(root,'artifacts/frontend-completion-20260923'),{recursive:true});
fs.writeFileSync(path.join(root,'artifacts/frontend-completion-20260923/untranslated.json'),JSON.stringify(missing,null,2));
console.log(JSON.stringify({keys:inventory.size,missing:missing.length,applied:apply}));
