import { BottomSheet } from './BottomSheet';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { placeKindLabel, type Place } from './data';
import './saved-landmark-detail.css';

/** Read-only detail keeps the saved list and its trip placement unchanged. */
export function SavedLandmarkDetailSheet({ place, onClose }: { place: Place; onClose: () => void }) {
  return <BottomSheet title={place.name} description={`${place.area} · ${placeKindLabel[place.kind]}`} onClose={onClose}>
    <section className="saved-landmark-detail" aria-label={`${place.name} 상세 정보`}>
      <LandmarkGuideCard place={place} actions={null} footer={
        <dl className="saved-landmark-facts">
          <dt>주소</dt><dd>{place.address?.trim() || '주소 확인 중'}</dd>
          {place.duration?.trim() && <><dt>추천 체류</dt><dd>{place.duration}</dd></>}
          {place.bestTime?.trim() && <><dt>방문 참고</dt><dd>{place.bestTime}</dd></>}
        </dl>
      } />
    </section>
  </BottomSheet>;
}
