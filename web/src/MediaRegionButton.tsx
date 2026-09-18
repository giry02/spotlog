import { MapPin } from 'lucide-react';
import './media-region-button.css';

export function MediaRegionButton({ region, onChoose }: { region: string; onChoose: (trigger: HTMLButtonElement) => void }) {
  return <div className="media-region-action">
    <button type="button" className="media-region-trigger" aria-label={`${region || '모든 지역'} · 지역 변경`} aria-haspopup="dialog" onClick={(event) => onChoose(event.currentTarget)}><MapPin size={23} /></button>
    <span>{region || '지역'}</span>
  </div>;
}
