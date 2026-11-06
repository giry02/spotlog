import type { KeyboardEvent, ReactNode } from 'react';
import './screen-header.css';

export interface ScreenHeaderProps {
  title: string;
  context?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  variant?: 'root' | 'detail' | 'editor' | 'sheet' | 'media';
  brand?: boolean;
  className?: string;
}

/** Visual slots only: the owning screen keeps navigation, permissions and mutations. */
export function ScreenHeader({ title, context, leading, actions, variant = 'root', brand = false, className = '' }: ScreenHeaderProps) {
  const Title = brand ? 'strong' : 'h1';
  return <header className={`screen-header screen-header--${variant}${brand ? ' screen-header--brand' : ''}${className ? ` ${className}` : ''}`}>
    {leading && <div className="screen-header__leading">{leading}</div>}
    <div className="screen-header__copy">
      <Title className="screen-header__title" title={title}>{title}</Title>
      {context && <div className="screen-header__context">{context}</div>}
    </div>
    {actions && <div className="screen-header__actions">{actions}</div>}
  </header>;
}

export interface ScreenTab { id: string; label: ReactNode; panelId?: string; tabId?: string }
export interface ScreenTabsProps {
  label: string;
  items: ScreenTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  idPrefix?: string;
}

/** Content destinations, separate from region/category filters and list/map tools. */
export function ScreenTabs({ label, items, value, onChange, className = '', idPrefix }: ScreenTabsProps) {
  const selected = items.some(item => item.id === value) ? value : items[0]?.id;
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return <div className={`screen-tabs${className ? ` ${className}` : ''}`} role="tablist" aria-label={label}>
    {items.map((item, index) => <button key={item.id} type="button" id={item.tabId ?? (idPrefix ? `${idPrefix}-${item.id}` : undefined)} className="screen-tabs__tab" role="tab" aria-selected={item.id === selected} aria-controls={item.panelId} tabIndex={item.id === selected ? 0 : -1} onClick={() => onChange(item.id)} onKeyDown={event => move(event, index)}>{item.label}</button>)}
  </div>;
}
