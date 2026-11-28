import { ChevronDown, ChevronRight, MapPin, MessageCircle, Star } from 'lucide-react';
import type { Place } from './data';
import { placeKindLabel } from './data';
import { demoPlaceStoriesEnabled, getDemoPlaceReview } from './demoPlaceReviewData';
import { resolvePlacePhotos } from './placePhotos';
import './demo-place-stories.css';

export function DemoPlaceRating({ place }: { place: Place }) {
  const review = demoPlaceStoriesEnabled && getDemoPlaceReview(place);
  if (!review) return null;
  return <span className="demo-place-rating" aria-label={`시연 평점 5점 만점에 ${review.rating.toFixed(1)}점, 후기 ${review.reviewCount}개`}>
    <Star size={14} fill="currentColor" aria-hidden="true"/>
    <strong>{review.rating.toFixed(1)}</strong><span>예시 후기 {review.reviewCount}</span>
  </span>;
}

export function DemoPlaceReviewThread({ place }: { place: Place }) {
  const review = demoPlaceStoriesEnabled && getDemoPlaceReview(place);
  if (!review) return null;
  return <section className="demo-place-review" aria-label={`${place.name} 시연 후기와 댓글`}>
    <header className="demo-place-review__header">
      <div><h3>방문 후기</h3><p>시연용으로 작성한 후기와 대화예요.</p></div>
      <DemoPlaceRating place={place}/>
    </header>
    <ul className="demo-place-review__comments">
      {review.comments.map(comment => <li key={comment.author} className="demo-place-review__comment">
        <div className="demo-place-review__author">
          <span className="demo-place-review__avatar" aria-hidden="true">{comment.author.slice(0, 1)}</span>
          <strong>{comment.author}</strong>
          <span className="demo-place-review__score" aria-label={`5점 만점에 ${comment.rating}점`}>
            <Star size={13} fill="currentColor" aria-hidden="true"/>{comment.rating.toFixed(1)}
          </span>
        </div>
        <p>{comment.text}</p>
        {comment.replies?.length ? <details className="demo-place-review__thread">
          <summary><MessageCircle size={15} aria-hidden="true"/>답글 {comment.replies.length}개 보기<ChevronDown size={15} aria-hidden="true"/></summary>
          <ul>
            {comment.replies.map((reply, index) => <li key={index}><strong>{reply.author}</strong><p>{reply.text}</p></li>)}
          </ul>
        </details> : null}
      </li>)}
    </ul>
  </section>;
}

export function DemoSponsoredPlace({ place, onOpen }: { place: Place; onOpen: () => void }) {
  if (!demoPlaceStoriesEnabled) return null;
  const photo = resolvePlacePhotos(place)[0];
  return <article className="demo-sponsored-place" aria-label={`광고 시연 예시 ${place.name}`}>
    <div className="demo-sponsored-place__labels"><span>광고</span><small>시연 예시</small></div>
    <button type="button" className="demo-sponsored-place__open" aria-label={`광고 예시 ${place.name} 상세 보기`} onClick={onOpen}>
      <span className="demo-sponsored-place__photo" aria-hidden="true">
        <MapPin size={22}/>
        {photo && <img src={photo.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }}/>}
      </span>
      <span className="demo-sponsored-place__title"><small>{placeKindLabel[place.kind]} · {place.area}</small><strong>{place.name}</strong></span>
      <ChevronRight size={17} aria-hidden="true"/>
    </button>
  </article>;
}
