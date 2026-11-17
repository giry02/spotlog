import { useState } from 'react';
import { Bookmark, ChevronRight, Compass, Route, Users } from 'lucide-react';
import type { HomeTripTemplate } from './consumerPublicSeed';
import type { readSavedCourses } from './savedCourseStore';
import './saved-course-library.css';

export default function SavedCourseList({ library, templates, onOpen, onTravel, onAppointment, onRemove, onExplore }: {
  library: ReturnType<typeof readSavedCourses>; templates: readonly HomeTripTemplate[];
  onOpen: (id: string) => void; onTravel: (id: string) => void; onAppointment: (id: string) => void;
  onRemove: (id: string) => void; onExplore: () => void;
}) {
  const [region, setRegion] = useState('');
  const byId = new Map(templates.map(template => [template.id, template]));
  const regions = [...new Set(library.ids.flatMap(id => { const value = byId.get(id)?.region; return value ? [value] : []; }))];
  const activeRegion = regions.includes(region) ? region : '';
  const visible = library.ids.filter(id => !activeRegion || byId.get(id)?.region === activeRegion);
  return <section className="saved-course-library" aria-label="저장한 코스">
    {library.status !== 'ready' ? <p role="status">{library.message}</p> : !library.ids.length ? <div className="saved-course-empty"><Route size={25} aria-hidden="true"/><h2>저장한 코스가 없어요</h2><p>마음에 드는 코스를 저장해 두고, 내 여행이나 함께 갈 약속으로 만들어 보세요.</p><button type="button" className="outline" onClick={onExplore}><Compass size={17} aria-hidden="true"/>어디 갈까?</button></div> : <>
      <div className="saved-course-library__toolbar"><strong>저장한 코스 {library.ids.length}개</strong>{regions.length > 1 && <label><span className="saved-course-sr-only">코스 지역</span><select value={activeRegion} onChange={event => setRegion(event.target.value)}><option value="">전체 지역</option>{regions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}</div>
      <ul>{visible.map(id => {
        const template = byId.get(id);
        return <li key={id} className="saved-course-row">
          <div className="saved-course-row__head">{template ? <button type="button" className="saved-course-row__open" onClick={() => onOpen(id)}><span className="saved-course-row__photo">{template.cover ? <img src={template.cover} alt="" loading="lazy"/> : <Route size={22} aria-hidden="true"/>}</span><span className="saved-course-row__copy"><small>{template.region} · {template.duration}</small><strong>{template.title}</strong><small>{template.places.length}곳 · 방문 순서 보기</small></span><ChevronRight size={17} aria-hidden="true"/></button> : <div className="saved-course-row__copy saved-course-row__unavailable"><strong>지금은 열 수 없는 코스</strong><small>공개 상태나 장소 정보가 바뀐 코스예요.</small></div>}<button type="button" className="saved-course-row__remove" onClick={() => onRemove(id)} aria-label={template ? `${template.title} 저장 해제` : '열 수 없는 코스 저장 해제'}><Bookmark size={20} fill="currentColor" aria-hidden="true"/></button></div>
          {template && <div className="saved-course-row__uses"><button type="button" onClick={() => onAppointment(id)}><Users size={17} aria-hidden="true"/>이 코스로 약속 만들기</button><button type="button" onClick={() => onTravel(id)}><Route size={17} aria-hidden="true"/>내 여행에 담기</button></div>}
        </li>;
      })}</ul>
    </>}
    <p className="device-record-note">이 기기에 저장한 코스예요. 같은 로그인 상태에서 다시 열 수 있어요.</p>
  </section>;
}
