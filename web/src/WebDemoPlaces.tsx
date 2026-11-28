import { Fragment, useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { DemoPlaceRating, DemoPlaceReviewThread, DemoSponsoredPlace } from './DemoPlaceStories';
import { PhotoCredit } from './PublicTourismCredit';
import { placeCatalog, placeKindLabel, type Place } from './data';
import { compareDemoPlaceReviews, getDemoPlaceReview, selectDemoSponsoredPlace } from './demoPlaceReviewData';
import { resolvePlacePhotos } from './placePhotos';
import './web-demo-places.css';

const categories = {
  cafe: {
    label: '카페',
    area: '부산 기장',
    organicIds: ['catalog-busan-waveon', 'catalog-busan-hanok'],
    adId: 'catalog-busan-sea-and-tree',
  },
  food: {
    label: '음식점',
    area: '부산 해운대',
    organicIds: ['catalog-busan-haemok', 'busan-amso', 'catalog-busan-geumsu'],
    adId: 'catalog-busan-pungwon-gogi',
  },
  hotel: {
    label: '호텔',
    area: '부산 해운대',
    organicIds: ['busan-signiel', 'catalog-busan-shilla-stay', 'catalog-busan-park-hyatt'],
    adId: 'catalog-busan-paradise',
  },
} as const;

type Category = keyof typeof categories;
type Sort = 'rating' | 'popular';
const categoryEntries = Object.entries(categories) as [Category, typeof categories[Category]][];
const venues = new Map(placeCatalog.map(place => [place.id, place]));

function PlaceOverview({ place }: { place: Place }) {
  const photo = resolvePlacePhotos(place)[0];
  return <article className="web-demo-venue-detail">
    {photo && <figure>
      <img src={photo.image} alt={photo.alt || place.name} />
      <figcaption><PhotoCredit image={photo.image} sourceId={photo.sourceId} /></figcaption>
    </figure>}
    <div className="web-demo-venue-title">
      <h2>{place.name}</h2>
      <span>{placeKindLabel[place.kind]} · {place.area}</span>
    </div>
    {place.description && <p>{place.description}</p>}
    {place.address && <p className="web-demo-venue-address"><MapPin size={16} aria-hidden="true" />{place.address}</p>}
  </article>;
}

function PlaceReviews({ places }: { places: Place[] }) {
  const [selected, setSelected] = useState('');
  const place = places.find(item => item.id === selected) ?? places[0];
  if (!place) return <p>시연 장소를 불러오지 못했어요.</p>;
  return <>
    <label className="web-demo-venue-field">
      후기를 볼 장소
      <select value={place.id} onChange={event => setSelected(event.currentTarget.value)}>
        {places.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <PlaceOverview place={place} />
    <DemoPlaceReviewThread key={place.id} place={place} />
  </>;
}

function PlaceRankings({ places, ad, title }: { places: Place[]; ad?: Place; title: string }) {
  const [sort, setSort] = useState<Sort>('rating');
  const [details, setDetails] = useState<{ place: Place; sponsored: boolean } | null>(null);
  const ranked = [...places].sort(sort === 'rating' ? compareDemoPlaceReviews : (left, right) =>
    (getDemoPlaceReview(right)?.reviewCount ?? 0) - (getDemoPlaceReview(left)?.reviewCount ?? 0));
  const sponsored = ad && selectDemoSponsoredPlace(ranked, [...places, ad]);
  return <>
    <div className="web-demo-venue-toolbar">
      <h2>{title}</h2>
      <label className="web-demo-venue-field">
        추천 순위 정렬
        <select value={sort} onChange={event => setSort(event.currentTarget.value as Sort)}>
          <option value="rating">평점 높은순</option>
          <option value="popular">후기 많은순</option>
        </select>
      </label>
    </div>
    <div className="web-demo-venue-results" aria-label="장소 추천 결과">
      {ranked.map((place, index) => {
        const photo = resolvePlacePhotos(place)[0];
        return <Fragment key={place.id}>
          <article className="web-demo-venue-result">
            <button type="button" onClick={() => setDetails({ place, sponsored: false })} aria-label={place.name + ' 상세 보기'}>
              <span className="web-demo-venue-rank" aria-label={'추천 ' + (index + 1) + '위'}>{index + 1}</span>
              <span className="web-demo-venue-photo" aria-hidden="true">
                <MapPin size={20} />
                {photo && <img src={photo.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
              </span>
              <span className="web-demo-venue-name">
                <strong>{place.name}</strong>
                <DemoPlaceRating place={place} />
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </article>
          {index === 0 && sponsored && <DemoSponsoredPlace place={sponsored} onOpen={() => setDetails({ place: sponsored, sponsored: true })} />}
        </Fragment>;
      })}
    </div>
    {details && <BottomSheet title="장소 상세" description={details.sponsored ? '광고 시연 예시' : undefined} onClose={() => setDetails(null)}>
      <PlaceOverview place={details.place} />
      <DemoPlaceReviewThread place={details.place} />
    </BottomSheet>}
  </>;
}

export default function WebDemoPlaces({ scene }: { scene: 'reviews' | 'ads' }) {
  const [category, setCategory] = useState<Category>('cafe');
  const current = categories[category];
  const organic = current.organicIds.flatMap(id => {
    const place = venues.get(id);
    return place ? [place] : [];
  });
  const ad = venues.get(current.adId);
  return <section className="web-demo-places" aria-label={scene === 'reviews' ? '장소 후기 시연' : '추천 순위와 광고 시연'}>
    <div className="web-demo-venue-types" role="group" aria-label="장소 유형">
      {categoryEntries.map(([id, entry]) =>
        <button type="button" key={id} aria-pressed={id === category} onClick={() => setCategory(id)}>{entry.label}</button>)}
    </div>
    {scene === 'reviews' ? <PlaceReviews places={ad ? [...organic, ad] : organic} />
      : <PlaceRankings places={organic} ad={ad} title={current.area + ' ' + current.label} />}
  </section>;
}
