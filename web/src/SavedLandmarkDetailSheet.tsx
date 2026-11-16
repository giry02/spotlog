import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { placeKindLabel, type Place } from './data';
import PublicPlaceFacts from './community/PublicPlaceFacts';
import './saved-landmark-detail.css';

/** Read-only detail keeps the saved list and its trip placement unchanged. */
export function SavedLandmarkDetailSheet({ place, onClose, actions }: { place: Place; onClose: () => void; actions?: ReactNode }) {
  return <BottomSheet title={place.name} description={`${place.area} · ${placeKindLabel[place.kind]}`} onClose={onClose}>
    <section className="saved-landmark-detail" aria-label={`${place.name} 상세 정보`}>
      <LandmarkGuideCard place={place} variant="detail" facts={<PublicPlaceFacts key={place.id} place={place}/>} showCredit actions={null}/>
      {actions && <div className="saved-landmark-actions">{actions}</div>}
    </section>
  </BottomSheet>;
}
