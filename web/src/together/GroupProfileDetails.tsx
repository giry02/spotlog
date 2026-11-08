import { groupAvailabilityOptions, type GroupJoinDraft, type GroupJoinFields } from './groupJoining';
import './group-creation.css';
export interface GroupProfileDetailsProps { profile?: GroupJoinDraft; fields?: GroupJoinFields; title?: string }
/** Parent screens retain the current-member/application-manager permission boundary. */
export default function GroupProfileDetails({profile,fields,title='모임에서 나눈 소개'}:GroupProfileDetailsProps) {
  if(!profile)return <p className="group-form-hint">선택 소개를 남기지 않았어요.</p>;
  const answers=profile.answers.filter(item=>item.answer.trim());
  const hasContent=profile.nickname||profile.introduction||answers.length||profile.availableTimes.length;
  return <section className="group-profile-details"><h3>{title}</h3>{!hasContent?<p className="group-form-hint">선택 소개를 남기지 않았어요.</p>:<dl>{profile.nickname&&<div><dt>모임 이름표</dt><dd>{profile.nickname}</dd></div>}{profile.introduction&&<div><dt>자기소개</dt><dd>{profile.introduction}</dd></div>}{answers.map(item=><div key={item.questionId}><dt>{item.question||fields?.questions.find(question=>question.id===item.questionId)?.label||'이전에 답한 가입 질문'}</dt><dd>{item.answer}</dd></div>)}{profile.availableTimes.length>0&&<div><dt>함께하기 편한 시간</dt><dd>{profile.availableTimes.map(id=>groupAvailabilityOptions.find(item=>item.id===id)?.label).filter(Boolean).join(' · ')}</dd></div>}</dl>}</section>;
}
