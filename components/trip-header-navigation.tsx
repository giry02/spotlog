'use client';

import { Bookmark, Compass, History, Home } from 'lucide-react';
import './trip-header-navigation.css';

type TripHeaderNavigationProps = {
  ready: boolean;
  busy: boolean;
  onHome: () => void;
  onHistory: () => void;
  onLibrary: () => void;
  onScenarios: () => void;
};

export function TripHeaderNavigation({
  ready,
  busy,
  onHome,
  onHistory,
  onLibrary,
  onScenarios,
}: TripHeaderNavigationProps) {
  const items = [
    { label: '처음으로', icon: Home, onClick: onHome, disabled: !ready },
    {
      label: '대화 이력',
      icon: History,
      onClick: onHistory,
      disabled: busy || !ready,
    },
    {
      label: '저장한 여행',
      icon: Bookmark,
      onClick: onLibrary,
      disabled: busy || !ready,
    },
    {
      label: '여행 시나리오',
      icon: Compass,
      onClick: onScenarios,
      disabled: false,
      accent: true,
    },
  ];

  return (
    <nav className="tr-header-navigation" aria-label="상단 메뉴">
      {items.map(({ label, icon: Icon, onClick, disabled, accent }) => (
        <button
          key={label}
          type="button"
          className={`tr-header-link${accent ? ' tr-header-link-accent' : ''}`}
          aria-label={label}
          title={label}
          disabled={disabled}
          onClick={onClick}
        >
          <span className="tr-header-icon" aria-hidden="true">
            <Icon size={22} strokeWidth={1.8} />
          </span>
        </button>
      ))}
    </nav>
  );
}
