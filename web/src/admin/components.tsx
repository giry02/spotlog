import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import type { AdminKind } from './types';
import { AdminSelect } from './AdminSelect';
export { AdminSelect } from './AdminSelect';

export const kindLabel: Record<AdminKind, string> = { LANDMARK: '랜드마크', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑' };
export function formatTime(value: string) { return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '미확인'; }
export function Panel({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode }) { return <section className="admin-panel"><header className="admin-panel-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="admin-actions">{actions}</div>}</header><div className="admin-panel-body">{children}</div></section>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={'admin-badge ' + tone}>{children}</span>; }
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: string }) { return <div className={'admin-notice ' + tone}>{children}</div>; }
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  const generated = useId(), control = isValidElement(children) ? children as ReactElement<{id?:string}> : null;
  const id = control?.props.id ?? generated;
  return <div className="admin-field"><label htmlFor={id}>{label}</label>{control?.type === 'select' ? <AdminSelect {...control.props} id={id} label={label} /> : control ? cloneElement(control,{id}) : children}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) { return <div className="admin-empty"><strong>{title}</strong>{description && <p>{description}</p>}{action}</div>; }
export function Tabs({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <div className="admin-tabs" role="tablist" onKeyDown={event => {
    if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
    const current = items.findIndex(item => item.id === value), next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length;
    event.preventDefault(); onChange(items[next].id); event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  }}>{items.map(item => <button type="button" key={item.id} role="tab" tabIndex={value === item.id ? 0 : -1} aria-selected={value === item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}
export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) { return <button type="button" className="admin-icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>; }
