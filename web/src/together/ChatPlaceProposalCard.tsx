import { useMemo, useState } from 'react';
import { Image } from 'lucide-react';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { usePublicReview } from '../publicReview';
import type { ChatPlaceProposal } from './placeProposal';
import './chat-place-proposal-card.css';

export default function ChatPlaceProposalCard({ proposal }: { proposal: ChatPlaceProposal }) {
  const { place, name, area } = proposal;
  const { state: { withdrawnImages } } = usePublicReview();
  const photo = useMemo(() => place && !place.personal
    ? getPlacePhotos(place).find(item => !withdrawnImages.includes(item.image))
    : undefined, [place, withdrawnImages]);
  const [failedPhoto, setFailedPhoto] = useState('');

  return <span className="tg-message-proposal-card">
    <span className="tg-message-proposal-image" aria-hidden="true">
      {photo && photo.image !== failedPhoto
        ? <img src={photo.image} alt="" loading="lazy" decoding="async" draggable={false}
            style={photo.objectPosition ? { objectPosition: photo.objectPosition } : undefined}
            onError={() => setFailedPhoto(photo.image)}/>
        : <Image size={17}/>}
    </span>
    <span className="tg-message-proposal-label">
      <strong>{name}</strong>
      {area && <small>{area}</small>}
    </span>
  </span>;
}
