import type { OpsReference } from './publicServiceTypes';
export type CreatorGradeIcon = 'SPARKLES' | 'AWARD' | 'STAR' | 'ROUTE' | 'CROWN';
export interface CreatorGradeRule { min: number; label: string; shortLabel: string; icon: CreatorGradeIcon }
export const defaultCreatorGrades: CreatorGradeRule[] = [
  {min:0,label:'새싹 기록자',shortLabel:'새싹',icon:'SPARKLES'},
  {min:10,label:'동네 가이드',shortLabel:'가이드',icon:'AWARD'},
  {min:100,label:'여행 큐레이터',shortLabel:'큐레이터',icon:'STAR'},
  {min:1000,label:'루트 메이커',shortLabel:'루트메이커',icon:'ROUTE'},
  {min:5000,label:'Spotlog 마스터',shortLabel:'마스터',icon:'CROWN'},
];
/** One versioned policy; public copy counts are supplied by the service, never entered here. */
export function parseCreatorGrades(value: string): CreatorGradeRule[] {
  let parsed: unknown;try{parsed=JSON.parse(value);}catch{throw new Error('등급 기준은 min·label·shortLabel·icon JSON 배열로 입력하세요.');}
  if(!Array.isArray(parsed)||parsed.length<1||parsed.length>10)throw new Error('등급은 1~10단계로 입력하세요.');
  const icons=['SPARKLES','AWARD','STAR','ROUTE','CROWN'];
  for(const rule of parsed)if(!rule||typeof rule!=='object'||Object.keys(rule).some(key=>!['min','label','shortLabel','icon'].includes(key))||!Number.isSafeInteger(rule.min)||rule.min<0||!['label','shortLabel'].every(key=>typeof rule[key]==='string'&&rule[key].trim()&&rule[key].length<=40)||!icons.includes(rule.icon))throw new Error('등급의 담김 횟수·이름·짧은 이름·아이콘을 확인하세요.');
  if(parsed[0].min!==0||parsed.some((rule,index)=>index>0&&rule.min<=parsed[index-1].min))throw new Error('첫 등급은 0회부터 시작하고 담김 기준은 중복 없이 증가해야 합니다.');
  return parsed.map(rule=>({...rule,label:rule.label.trim(),shortLabel:rule.shortLabel.trim()}));
}
export function creatorGradeRules(references: OpsReference[] = []): CreatorGradeRule[] {
  const active=references.filter(reference=>reference.category==='GRADE'&&reference.enabled);
  if(active.length===1)try{return parseCreatorGrades(active[0].value);}catch{/* retain approved defaults for malformed legacy projections */}
  return defaultCreatorGrades.map(rule=>({...rule}));
}
export function currentCreatorGrade(count:number,rules:CreatorGradeRule[]=defaultCreatorGrades):CreatorGradeRule {
  const safe=Number.isSafeInteger(count)&&count>=0?count:0;
  return [...rules].reverse().find(rule=>safe>=rule.min)??rules[0];
}
