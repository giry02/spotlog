import { useId, useState } from 'react';
import { ArrowRight, ChevronRight, ImageOff } from 'lucide-react';
import { homeJournalSourceLabel, type HomeTravelCourseCard, type HomeTravelJournalCard } from './travelHomeModel';
import './travel-home-sections.css';

interface Props {
  courses: HomeTravelCourseCard[]; journals: HomeTravelJournalCard[];
  onOpenCourse: (id: string) => void; onOpenJournal: (id: string) => void;
  onMoreCourses: () => void; onMoreJournals: () => void;
}

function Photo({ src }: { src: string }) {
  const [failed, setFailed] = useState('');
  return src && failed !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)}/>
    : <span className="travel-home__no-photo" aria-hidden="true"><ImageOff size={24}/></span>;
}

/** Public presentation DTOs only. Opening a card uses the caller's current approved catalogue. */
export default function TravelHomeSections({ courses, journals, onOpenCourse, onOpenJournal, onMoreCourses, onMoreJournals }: Props) {
  const uid = useId(), shownCourses = courses.slice(0, 2);
  const courseCovers = new Set(shownCourses.map(item => item.cover).filter(Boolean));
  // Avoid repeating the same lead photograph when other approved records exist; retain source order.
  const differentJournals = journals.filter(item => !item.cover || !courseCovers.has(item.cover));
  const shownJournals = (differentJournals.length >= 2 ? differentJournals : journals).slice(0, 2);
  if (!courses.length && !journals.length) return null;
  return <div className="travel-home">
    {shownCourses.length > 0 && <section className="travel-home__section" aria-labelledby={`${uid}-courses`}>
      <div className="travel-home__heading"><h2 id={`${uid}-courses`}>가져와 쓰는 여행 코스</h2><button type="button" onClick={onMoreCourses}>더 보기<ChevronRight size={16}/></button></div>
      {shownCourses.length ? <div className={`travel-home__courses${shownCourses.length === 1 ? ' is-single' : ''}`}>{shownCourses.map(course => <article className="travel-home__course" key={course.id}>
        <button type="button" onClick={() => onOpenCourse(course.id)} aria-label={`${course.title} · ${course.duration} · ${course.placeCount}곳 · 여행 일정 미리보기`}>
          <span className="travel-home__course-photo"><Photo src={course.cover}/><span className="travel-home__duration">{course.duration}</span></span>
          <span className="travel-home__course-copy"><span className="travel-home__meta">{course.region} · {course.placeCount}곳</span><strong>{course.title}</strong><span className="travel-home__course-action">코스 미리보기<ArrowRight size={16}/></span></span>
        </button>
      </article>)}</div> : <p className="travel-home__none">선택한 조건의 공개 여행 코스가 없어요.</p>}
    </section>}
    {shownJournals.length > 0 && <section className="travel-home__section" aria-labelledby={`${uid}-journals`}>
      <div className="travel-home__heading"><h2 id={`${uid}-journals`}>여행기로 둘러보는 지역</h2><button type="button" onClick={onMoreJournals}>더 보기<ChevronRight size={16}/></button></div>
      {shownJournals.length ? <div className="travel-home__journals">{shownJournals.map(journal => <article key={journal.id} className="travel-home__journal">
        <button type="button" onClick={() => onOpenJournal(journal.id)} aria-label={`${journal.title} · ${homeJournalSourceLabel(journal.sourceKind)} 보기`}>
          <span className="travel-home__journal-photo"><Photo src={journal.cover}/></span>
          <span className="travel-home__journal-copy"><span className="travel-home__meta">{homeJournalSourceLabel(journal.sourceKind)} · {journal.region}</span><strong>{journal.title}</strong><span className="travel-home__meta">{journal.duration} · {journal.placeCount}곳{journal.sourceKind === 'SERVER' && journal.author ? ` · ${journal.author}` : ''}</span></span>
          <ChevronRight size={17} aria-hidden="true"/>
        </button>
      </article>)}</div> : <p className="travel-home__none">선택한 조건의 공개 여행기가 없어요.</p>}
    </section>}
  </div>;
}
