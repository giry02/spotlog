import { AlertCircle, ArrowRight, MapPin, Route, Users } from 'lucide-react';
import type { Place } from '../data';
import type { TogetherState } from './model';
import { selectPersonalRouteSummary } from './personalRouteSummaryModel';
import './shared-route-entry.css';

export default function PersonalRouteSummary({ state, userId, groupId, activityId, places, onOpen, onMembers, onChanges, onGuide }: {
  state: TogetherState; userId: string; groupId: string; activityId: string; places: Place[];
  onOpen: () => void; onMembers: () => void; onChanges: () => void; onGuide: () => void;
}) {
  let selection;
  try { selection = selectPersonalRouteSummary(state, userId, { groupId, activityId }, places); } catch { return null; }
  const { own, members, route } = selection;
  if (!selection.canWithdraw && !route.stops.length && !own && !members.length) return null;
  const selected = own?.stops || [], needsReview = own && own.status !== 'CURRENT';
  const changedCount = members.filter(member => member.status !== 'CURRENT').length;
  const label = needsReview ? '선택한 구간을 다시 확인해 주세요' : selected.length ? `${selected[0].name}${selected.length > 1 ? ` → ${selected.at(-1)!.name}` : ' · 한 곳'}` : route.stops.length ? '어디서 합류하고, 어디까지 함께할까요?' : '함께 갈 곳을 담고 내 구간을 정해요';
  const participation = selection.participationLabel;
  return <section className="shared-route-summary" aria-label="각자의 참여 구간과 방문 안내">
    <header><Route size={20}/><div><h3>공동 동선 · 내 참여 구간</h3></div></header>
    <button type="button" className="shared-route-own" onClick={onOpen}><span><small>{own && selection.participation === 'DECLINED' ? '저장한 내 구간' : own ? '내 참여 구간' : selection.writable ? '내 구간 정하기' : '구간 기록 보기'} · {selected.length ? `${selected.length}곳 · ` : ''}{participation}</small><strong>{!selection.writable && !own ? '이 약속에 저장된 공동 동선 보기' : label}</strong></span><ArrowRight size={19}/></button>
    {changedCount > 0 && <button type="button" className="shared-route-changes" onClick={needsReview ? onChanges : onMembers}><AlertCircle size={17}/><span>일정 변경 후 {changedCount}명의 구간 확인이 필요해요.</span><ArrowRight size={16}/></button>}
    <div className="shared-route-links"><button type="button" onClick={onMembers}><Users size={17}/><span>구간 선택 {members.length}명</span></button><button type="button" onClick={onGuide}><MapPin size={17}/><span>방문 안내</span><ArrowRight size={15}/></button></div>
  </section>;
}
